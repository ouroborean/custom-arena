// Single-player on the server (docs/single-player.md): verified story attempts, story progress and
// rewards, and achievements (for every kind of match).
//
// Story matches run in the browser. To keep rewards honest the server issues the seed and teams,
// and on finish replays the player's commands through the engine, re-deriving every AI move from
// the same seeded bot; only its own result counts.

import { encounterBot, type Bot } from '@arena/ai';
import {
  applyCommand,
  CommandError,
  createMatch,
  ENGINE_VERSION,
  viewFor,
  type CharacterSpec,
  type Command,
  type ContentBundle,
  type MatchConfig,
} from '@arena/engine';
import { advanceAchievement, chapterOf, singlePlayerBotSeed, type MatchFact, type Reward } from '@arena/meta';
import { and, eq } from 'drizzle-orm';
import { HttpError } from './app.js';
import type { Db } from './db/client.js';
import { achievementProgress } from './db/schema.js';
import { grant, inTransaction } from './economy.js';

export interface SubmittedCommand {
  player: number;
  cmd: Command;
}

export interface Verified {
  /** From the human's side. */
  outcome: 'win' | 'loss' | 'draw';
  turns: number;
  /** How it ended (elimination, surrender, …). */
  endReason: string;
}

/**
 * Replays a single-player match: the human's commands (seat `seat`, 0 unless given) in the order
 * submitted, and the AI's turns re-planned by `bot`. Throws 400 if a command is illegal, the match
 * doesn't finish, or commands are left over.
 */
export function verifyMatch(content: ContentBundle, config: MatchConfig, bot: Bot, submitted: SubmittedCommand[], seat: 0 | 1 = 0): Verified {
  let { state } = createMatch(content, config);
  const ai = seat === 0 ? 1 : 0;
  const human = submitted.filter((c) => c.player === seat).map((c) => c.cmd);
  let next = 0;
  for (let guard = 0; state.phase !== 'finished'; guard++) {
    if (guard > 5000) throw new HttpError(400, 'The match runs too long');
    if (state.activePlayer === ai) {
      for (const cmd of bot.planTurn(content, viewFor(content, state, ai))) {
        state = applyCommand(content, state, ai, cmd).state;
        if (state.phase === 'finished') break;
      }
      continue;
    }
    const cmd = human[next++];
    if (!cmd) throw new HttpError(400, "That match isn't finished");
    try {
      state = applyCommand(content, state, seat, cmd).state;
    } catch (e) {
      if (e instanceof CommandError) throw new HttpError(400, `Replay rejected: ${e.message}`);
      throw e;
    }
  }
  if (next < human.length) throw new HttpError(400, 'Commands after the end of the match');
  const w = state.result!.winner;
  return { outcome: w === null ? 'draw' : w === seat ? 'win' : 'loss', turns: state.turn, endReason: state.result!.reason };
}

/** The encounter's AI for an attempt, seeded as the client seeds it. */
export function attemptBot(content: ContentBundle, encounterId: string, config: MatchConfig): Bot {
  const enc = content.encounters[encounterId];
  if (!enc) throw new HttpError(404, `No encounter "${encounterId}"`);
  return encounterBot(enc, singlePlayerBotSeed(config.seed));
}

export const engineVersion = ENGINE_VERSION;

/** The facts achievements look at, for one side of a match. */
export function matchFact(
  mode: string,
  outcome: MatchFact['outcome'],
  turns: number,
  team: CharacterSpec[],
  extra: { encounter?: string; content?: ContentBundle } = {},
): MatchFact {
  const chapter = extra.encounter && extra.content ? chapterOf(extra.content, extra.encounter) : undefined;
  return {
    mode,
    outcome,
    turns,
    classes: [...new Set(team.map((c) => c.classId).filter((c): c is string => !!c))],
    elements: [...new Set(team.map((c) => c.element).filter((e): e is string => !!e && e !== 'None'))],
    ...(extra.encounter ? { encounter: extra.encounter } : {}),
    ...(chapter ? { chapter } : {}),
  };
}

export interface AchievementUnlock {
  id: string;
  reward: Reward;
}

/** Advances every achievement with one finished match; pays and returns the ones it completes. */
export async function recordAchievements(db: Db, content: ContentBundle, userId: string, fact: MatchFact): Promise<AchievementUnlock[]> {
  const rows = await db.select().from(achievementProgress).where(eq(achievementProgress.userId, userId));
  const unlocked: AchievementUnlock[] = [];
  for (const a of Object.values(content.achievements)) {
    const row = rows.find((r) => r.achievementId === a.id);
    const prev = row ? { count: row.count, done: row.completedAt !== null } : undefined;
    const next = advanceAchievement(a, prev, fact);
    if (prev && next.count === prev.count && next.done === prev.done) continue;
    if (!prev && next.count === 0) continue;
    const reward = await inTransaction(db, async (tx) => {
      const completed = next.done && !prev?.done;
      if (row) {
        // Only the first writer to complete it pays (completedAt is still null for them).
        const updated = await tx
          .update(achievementProgress)
          .set({ count: next.count, ...(completed ? { completedAt: new Date() } : {}) })
          .where(
            and(
              eq(achievementProgress.userId, userId),
              eq(achievementProgress.achievementId, a.id),
              ...(completed ? [eq(achievementProgress.count, row.count)] : []),
            ),
          )
          .returning();
        if (completed && updated.length === 0) return null;
      } else {
        const ins = await tx
          .insert(achievementProgress)
          .values({ userId, achievementId: a.id, count: next.count, ...(completed ? { completedAt: new Date() } : {}) })
          .onConflictDoNothing()
          .returning();
        if (ins.length === 0) return null;
      }
      return completed ? grant(tx, content, userId, a.reward, 'achievement') : null;
    });
    if (reward) unlocked.push({ id: a.id, reward });
  }
  return unlocked;
}
