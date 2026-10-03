// Arcade mode (docs/single-player.md §Arcade): a ladder of bot teams that grow on a fixed curve. Like
// practice, the server issues each stage (seed and teams), the match is played in the browser, and on
// finish the server replays it before paying. A win moves the run up a stage; a loss or draw ends it.
//
// A stage that was issued but never finished is issued again (same seed, same enemies) rather than
// rerolled, so leaving a match can't shop for an easier team; the game updating in between voids it.

import { botFor } from '@arena/ai';
import { seedRng, type Command, type MatchConfig } from '@arena/engine';
import { arcadeDef, arcadeNextStage, arcadeReward, arcadeStage, arcadeTeam, singlePlayerBotSeed, storyStatus, type ArcadeLast, type Outcome } from '@arena/meta';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import type { Db } from '../db/client.js';
import { itemInstances, spAttempts, storyProgress } from '../db/schema.js';
import { credit, inTransaction, walletOf } from '../economy.js';
import { engineVersion, matchFact, recordAchievements, verifyMatch } from '../singleplayer.js';
import { activeTeamSpecs } from './roster.js';

const Submitted = z.object({
  commands: z.array(z.object({ player: z.number().int().min(0).max(1), cmd: z.record(z.string(), z.unknown()) })).max(4000),
});

/** The player always moves first in the arcade. */
const SEAT = 0 as const;

/** The player's last finished stage (voided attempts don't count). */
async function lastStage(db: Db, userId: string): Promise<ArcadeLast | undefined> {
  const [row] = await db
    .select()
    .from(spAttempts)
    .where(and(eq(spAttempts.userId, userId), eq(spAttempts.mode, 'arcade'), inArray(spAttempts.outcome, ['win', 'loss', 'draw'])))
    .orderBy(desc(spAttempts.finishedAt))
    .limit(1);
  return row ? { stage: Number(row.ref), outcome: row.outcome as Outcome } : undefined;
}

/** The highest stage the player has ever cleared (0 for none). */
async function bestStage(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(${spAttempts.ref}::int), 0)::int` })
    .from(spAttempts)
    .where(and(eq(spAttempts.userId, userId), eq(spAttempts.mode, 'arcade'), eq(spAttempts.outcome, 'win')));
  return row?.n ?? 0;
}

/** Arcade item drops since the start of the current UTC day (the arcade has its own cap). */
export async function arcadeDropsToday(db: Db, userId: string, now: Date): Promise<number> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(jsonb_array_length(${spAttempts.reward}->'items')), 0)::int` })
    .from(spAttempts)
    .where(and(eq(spAttempts.userId, userId), eq(spAttempts.mode, 'arcade'), gte(spAttempts.finishedAt, since)));
  return row?.n ?? 0;
}

export function arcadeRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    const status = async (userId: string) => {
      const def = arcadeDef(ctx.content);
      const stage = arcadeNextStage(ctx.content, await lastStage(ctx.db, userId));
      return {
        stage,
        stages: def.stages.length,
        bot: arcadeStage(ctx.content, stage).bot,
        best: await bestStage(ctx.db, userId),
        dropsToday: await arcadeDropsToday(ctx.db, userId, new Date()),
        dailyDropCap: def.dailyDropCap,
      };
    };

    /** Where the player's run stands: the next stage, their best, and today's drops. */
    app.get('/api/arcade', async (req) => status(req.user!.id));

    /** Issues the run's next stage (or reissues an unfinished one): your active team against its bots. */
    app.post('/api/arcade/start', async (req, reply) => {
      const userId = req.user!.id;
      const [open] = await ctx.db
        .select()
        .from(spAttempts)
        .where(and(eq(spAttempts.userId, userId), eq(spAttempts.mode, 'arcade'), isNull(spAttempts.outcome)))
        .orderBy(desc(spAttempts.createdAt))
        .limit(1);
      if (open) {
        const stage = Number(open.ref);
        if (open.contentVersion === ctx.content.version && open.engineVersion === engineVersion && arcadeDef(ctx.content).stages[stage - 1]) {
          return reply.status(201).send({ attemptId: open.id, stage, bot: arcadeStage(ctx.content, stage).bot, config: open.config, resumed: true });
        }
        // Issued before the game changed: it can't be verified any more, so it doesn't count either way.
        await ctx.db.update(spAttempts).set({ outcome: 'void', finishedAt: new Date() }).where(and(eq(spAttempts.id, open.id), isNull(spAttempts.outcome)));
      }
      const team = await activeTeamSpecs(ctx, userId);
      const stage = arcadeNextStage(ctx.content, await lastStage(ctx.db, userId));
      const seed = ctx.rollSeed();
      const bots = arcadeTeam(ctx.content, stage, seedRng(seed ^ 0x2545f491));
      const config: MatchConfig = { seed, teams: [team, bots] };
      const [row] = await ctx.db
        .insert(spAttempts)
        .values({ userId, mode: 'arcade', ref: String(stage), contentVersion: ctx.content.version, engineVersion, config })
        .returning();
      return reply.status(201).send({ attemptId: row!.id, stage, bot: arcadeStage(ctx.content, stage).bot, config, resumed: false });
    });

    /** Verifies a finished stage by replay, then pays it and moves the run on (or ends it). */
    app.post('/api/arcade/attempts/:id/finish', async (req) => {
      const userId = req.user!.id;
      const { id } = parse(z.object({ id: z.uuid() }), req.params);
      const { commands } = parse(Submitted, req.body);
      const [attempt] = await ctx.db
        .select()
        .from(spAttempts)
        .where(and(eq(spAttempts.id, id), eq(spAttempts.userId, userId), eq(spAttempts.mode, 'arcade')));
      if (!attempt) throw new HttpError(404, 'No such attempt');
      if (attempt.outcome !== null) throw new HttpError(409, 'That stage was already submitted');
      if (attempt.contentVersion !== ctx.content.version || attempt.engineVersion !== engineVersion) {
        throw new HttpError(409, 'The game was updated during that stage; start it again');
      }
      const stage = Number(attempt.ref);
      const typed = commands as { player: number; cmd: Command }[];
      const result = verifyMatch(ctx.content, attempt.config, botFor(arcadeStage(ctx.content, stage).bot, singlePlayerBotSeed(attempt.config.seed)), typed, SEAT);
      const reward = arcadeReward(
        ctx.content,
        { stage, outcome: result.outcome, endReason: result.endReason, dropsToday: await arcadeDropsToday(ctx.db, userId, new Date()) },
        seedRng(ctx.rollSeed()),
      );
      await inTransaction(ctx.db, async (db) => {
        // Only the first submission of an attempt counts.
        const claimed = await db
          .update(spAttempts)
          .set({ outcome: result.outcome, turns: result.turns, commands: typed, reward, finishedAt: new Date() })
          .where(and(eq(spAttempts.id, id), isNull(spAttempts.outcome)))
          .returning();
        if (claimed.length === 0) throw new HttpError(409, 'That stage was already submitted');
        await credit(db, ctx.content, userId, reward.currency);
        if (reward.items.length) await db.insert(itemInstances).values(reward.items.map((itemId) => ({ userId, itemId, source: 'reward' })));
      });

      const achievements = await recordAchievements(ctx.db, ctx.content, userId, matchFact('arcade', result.outcome, result.turns, attempt.config.teams[SEAT]));
      const cleared = await ctx.db.select().from(storyProgress).where(eq(storyProgress.userId, userId));
      return {
        outcome: result.outcome,
        turns: result.turns,
        reward,
        chapterComplete: null,
        characters: [],
        achievements,
        chapters: storyStatus(ctx.content, new Set(cleared.map((r) => r.encounterId))),
        wallet: await walletOf(ctx.db, ctx.content, userId),
        arcade: {
          stage,
          ladderComplete: result.outcome === 'win' && stage === arcadeDef(ctx.content).stages.length,
          next: await status(userId),
        },
      };
    });
  };
}
