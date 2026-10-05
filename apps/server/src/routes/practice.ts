// Practice against a bot (docs/single-player.md): like story attempts, the server issues the seed,
// both teams and who moves first (a coin flip), the match is played in the browser, and on finish the server replays it before paying
// the `practice` rewards (a baseline of Gold, sometimes a drop).

import { botFor, randomConfig } from '@arena/ai';
import { seedRng, type Command, type MatchConfig } from '@arena/engine';
import { matchReward, matchXp, singlePlayerBotSeed, singlePlayerFirst, storyStatus } from '@arena/meta';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import { itemInstances, spAttempts, storyProgress } from '../db/schema.js';
import { credit, dropsToday, inTransaction, walletOf } from '../economy.js';
import { awardXp } from '../progression.js';
import { engineVersion, matchFact, recordAchievements, verifyMatch } from '../singleplayer.js';
import { activeTeamSpecs } from './roster.js';

const Bots = z.enum(['easy', 'normal', 'hard']);
const Submitted = z.object({
  commands: z.array(z.object({ player: z.number().int().min(0).max(1), cmd: z.record(z.string(), z.unknown()) })).max(4000),
});

/** `ref` of a practice attempt: the bot's difficulty and the player's seat. */
const refOf = (bot: string, seat: 0 | 1) => `${bot}:${seat}`;
function parseRef(ref: string): { bot: z.infer<typeof Bots>; seat: 0 | 1 } {
  const [bot, seat] = ref.split(':');
  return { bot: Bots.parse(bot), seat: seat === '1' ? 1 : 0 };
}

export function practiceRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    /**
     * Issues a practice match: your active team (seat 0) against a random bot team, with a fresh seed;
     * either side may move first.
     */
    app.post('/api/practice/start', async (req, reply) => {
      const userId = req.user!.id;
      const { bot } = parse(z.object({ bot: Bots }), req.body);
      const seat = 0;
      const team = await activeTeamSpecs(ctx, userId);
      const seed = ctx.rollSeed();
      const bots = randomConfig(ctx.content, seed).teams[1].map((c, i) => ({ ...c, name: `Bot ${ctx.content.classes[c.classId!]!.name} ${i + 1}` }));
      const config: MatchConfig = { seed, teams: [team, bots], firstPlayer: singlePlayerFirst(seed) };
      const [row] = await ctx.db
        .insert(spAttempts)
        .values({ userId, mode: 'practice', ref: refOf(bot, seat), contentVersion: ctx.content.version, engineVersion, config })
        .returning();
      return reply.status(201).send({ attemptId: row!.id, config });
    });

    /** Verifies a finished practice match by replay, then pays its rewards. */
    app.post('/api/practice/attempts/:id/finish', async (req) => {
      const userId = req.user!.id;
      const { id } = parse(z.object({ id: z.uuid() }), req.params);
      const { commands } = parse(Submitted, req.body);
      const [attempt] = await ctx.db
        .select()
        .from(spAttempts)
        .where(and(eq(spAttempts.id, id), eq(spAttempts.userId, userId), eq(spAttempts.mode, 'practice')));
      if (!attempt) throw new HttpError(404, 'No such attempt');
      if (attempt.outcome !== null) throw new HttpError(409, 'That match was already submitted');
      if (attempt.contentVersion !== ctx.content.version || attempt.engineVersion !== engineVersion) {
        throw new HttpError(409, 'The game was updated during that match; start a new one');
      }
      const { bot, seat } = parseRef(attempt.ref);
      const typed = commands as { player: number; cmd: Command }[];
      const result = verifyMatch(ctx.content, attempt.config, botFor(bot, singlePlayerBotSeed(attempt.config.seed)), typed, seat);
      const reward = matchReward(
        ctx.content,
        { kind: 'practice', outcome: result.outcome, endReason: result.endReason, turns: result.turns, dropsToday: await dropsToday(ctx.db, userId, new Date()) },
        seedRng(ctx.rollSeed()),
      );
      await inTransaction(ctx.db, async (db) => {
        // Only the first submission of an attempt counts.
        const claimed = await db
          .update(spAttempts)
          .set({ outcome: result.outcome, turns: result.turns, commands: typed, reward, finishedAt: new Date() })
          .where(and(eq(spAttempts.id, id), isNull(spAttempts.outcome)))
          .returning();
        if (claimed.length === 0) throw new HttpError(409, 'That match was already submitted');
        await credit(db, ctx.content, userId, reward.currency);
        if (reward.items.length) await db.insert(itemInstances).values(reward.items.map((itemId) => ({ userId, itemId, source: 'reward' })));
        const gain = await awardXp(db, ctx.content, userId, matchXp(ctx.content, { kind: 'practice', outcome: result.outcome, endReason: result.endReason, turns: result.turns }));
        if (gain) reward.xp = gain;
      });

      const achievements = await recordAchievements(ctx.db, ctx.content, userId, matchFact('practice', result.outcome, result.turns, attempt.config.teams[seat]));
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
      };
    });
  };
}
