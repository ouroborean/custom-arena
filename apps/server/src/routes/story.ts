// Story mode and achievements (docs/single-player.md). Attempts are issued here, played in the
// browser, and verified by replay when they're submitted.

import { chapterOf, encounterConfig, matchXp, storyStatus, type Reward } from '@arena/meta';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import type { Db } from '../db/client.js';
import { achievementProgress, spAttempts, storyChapters, storyProgress } from '../db/schema.js';
import { grant, inTransaction, sumRewards, walletOf } from '../economy.js';
import { awardXp } from '../progression.js';
import { attemptBot, engineVersion, matchFact, recordAchievements, verifyMatch, type AchievementUnlock } from '../singleplayer.js';
import { activeTeamSpecs, characterJson, rollForUser } from './roster.js';
import type { GrantSpec } from '@arena/engine';

async function clearedSet(db: Db, userId: string): Promise<Map<string, number>> {
  const rows = await db.select().from(storyProgress).where(eq(storyProgress.userId, userId));
  return new Map(rows.map((r) => [r.encounterId, r.clears]));
}

type CharacterRow = Awaited<ReturnType<typeof rollForUser>>;

/** Pays a grant, including free character rolls (skipped once the roster is full). */
async function payGrant(ctx: AppContext, db: Db, userId: string, spec: GrantSpec | undefined, characters: CharacterRow[], boxSource: string): Promise<Reward> {
  const reward = await grant(db, ctx.content, userId, spec, 'story', boxSource);
  for (let i = 0; i < (spec?.rolls ?? 0); i++) {
    try {
      characters.push(await rollForUser({ ...ctx, db }, userId));
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 409)) throw e;
    }
  }
  return reward;
}

const Submitted = z.object({
  commands: z.array(z.object({ player: z.number().int().min(0).max(1), cmd: z.record(z.string(), z.unknown()) })).max(4000),
});

export function storyRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    app.get('/api/story', async (req) => {
      const clears = await clearedSet(ctx.db, req.user!.id);
      return { chapters: storyStatus(ctx.content, new Set(clears.keys())), clears: Object.fromEntries(clears) };
    });

    /** Issues an attempt: the teams (your active team, or the encounter's own) and a fresh seed. */
    app.post('/api/story/:id/start', async (req, reply) => {
      const userId = req.user!.id;
      const { id } = parse(z.object({ id: z.string() }), req.params);
      const enc = ctx.content.encounters[id];
      if (!enc || !chapterOf(ctx.content, id)) throw new HttpError(404, 'No such story encounter');
      const clears = await clearedSet(ctx.db, userId);
      const open = storyStatus(ctx.content, new Set(clears.keys()))
        .flatMap((c) => c.encounters)
        .find((e) => e.id === id)?.unlocked;
      if (!open) throw new HttpError(403, 'That encounter is still locked');
      const team = enc.playerTeam ? undefined : await activeTeamSpecs(ctx, userId);
      const config = encounterConfig(ctx.content, enc, ctx.rollSeed(), team);
      const [row] = await ctx.db
        .insert(spAttempts)
        .values({ userId, mode: 'story', ref: id, contentVersion: ctx.content.version, engineVersion, config })
        .returning();
      return reply.status(201).send({ attemptId: row!.id, encounter: id, config });
    });

    /** Verifies a finished attempt by replay, then records progress and pays rewards. */
    app.post('/api/story/attempts/:id/finish', async (req) => {
      const userId = req.user!.id;
      const { id } = parse(z.object({ id: z.uuid() }), req.params);
      const { commands } = parse(Submitted, req.body);
      const [attempt] = await ctx.db
        .select()
        .from(spAttempts)
        .where(and(eq(spAttempts.id, id), eq(spAttempts.userId, userId), eq(spAttempts.mode, 'story')));
      if (!attempt) throw new HttpError(404, 'No such attempt');
      if (attempt.outcome !== null) throw new HttpError(409, 'That attempt was already submitted');
      if (attempt.contentVersion !== ctx.content.version || attempt.engineVersion !== engineVersion) {
        throw new HttpError(409, 'The game was updated during that attempt; start the encounter again');
      }
      const typed = commands as { player: number; cmd: import('@arena/engine').Command }[];
      const result = verifyMatch(ctx.content, attempt.config, attemptBot(ctx.content, attempt.ref, attempt.config), typed);

      const enc = ctx.content.encounters[attempt.ref]!;
      const chapterId = chapterOf(ctx.content, attempt.ref)!;
      const boxSource = ctx.content.chapters[chapterId]?.tutorial ? 'tutorial' : 'story';
      const paid = await inTransaction(ctx.db, async (db) => {
        // Only the first submission of an attempt counts.
        const claimed = await db
          .update(spAttempts)
          .set({ outcome: result.outcome, turns: result.turns, commands: typed, finishedAt: new Date() })
          .where(and(eq(spAttempts.id, id), isNull(spAttempts.outcome)))
          .returning();
        if (claimed.length === 0) throw new HttpError(409, 'That attempt was already submitted');
        const rewards: Reward[] = [];
        const characters: CharacterRow[] = [];
        let chapterDone = false;
        if (result.outcome === 'win') {
          const [prev] = await db
            .select()
            .from(storyProgress)
            .where(and(eq(storyProgress.userId, userId), eq(storyProgress.encounterId, attempt.ref)));
          if (prev) {
            await db
              .update(storyProgress)
              .set({ clears: prev.clears + 1 })
              .where(and(eq(storyProgress.userId, userId), eq(storyProgress.encounterId, attempt.ref)));
          } else {
            await db.insert(storyProgress).values({ userId, encounterId: attempt.ref, clears: 1 });
          }
          rewards.push(await payGrant(ctx, db, userId, prev ? enc.rewards?.repeat : enc.rewards?.first, characters, boxSource));
          // The chapter's reward, the first time all its encounters are cleared.
          const chapter = ctx.content.chapters[chapterId]!;
          const cleared = await clearedSet(db, userId);
          if (chapter.encounters.every((e) => cleared.has(e))) {
            const ins = await db.insert(storyChapters).values({ userId, chapterId }).onConflictDoNothing().returning();
            if (ins.length) {
              chapterDone = true;
              rewards.push(await payGrant(ctx, db, userId, chapter.reward, characters, boxSource));
            }
          }
        }
        const reward = sumRewards(rewards);
        // Tutorial lessons pay no experience (their reward is a loot box): 'tutorial' has no xp entry.
        const kind = ctx.content.chapters[chapterId]?.tutorial ? 'tutorial' : 'story';
        const gain = await awardXp(db, ctx.content, userId, matchXp(ctx.content, { kind, outcome: result.outcome, endReason: result.endReason, turns: result.turns }));
        if (gain) reward.xp = gain;
        return { reward, chapterDone, characters };
      });

      const achievements: AchievementUnlock[] = await recordAchievements(
        ctx.db,
        ctx.content,
        userId,
        matchFact(ctx.content.chapters[chapterId]?.tutorial ? 'tutorial' : 'story', result.outcome, result.turns, attempt.config.teams[0], {
          encounter: attempt.ref,
          content: ctx.content,
        }),
      );
      const clears = await clearedSet(ctx.db, userId);
      return {
        outcome: result.outcome,
        turns: result.turns,
        reward: paid.reward,
        chapterComplete: paid.chapterDone ? chapterId : null,
        characters: paid.characters.map(characterJson),
        achievements,
        chapters: storyStatus(ctx.content, new Set(clears.keys())),
        wallet: await walletOf(ctx.db, ctx.content, userId),
      };
    });

    app.get('/api/achievements', async (req) => {
      const rows = await ctx.db.select().from(achievementProgress).where(eq(achievementProgress.userId, req.user!.id));
      return {
        achievements: Object.values(ctx.content.achievements).map((a) => {
          const r = rows.find((x) => x.achievementId === a.id);
          return { id: a.id, count: r?.count ?? 0, done: !!r?.completedAt, completedAt: r?.completedAt ?? null };
        }),
      };
    });
  };
}
