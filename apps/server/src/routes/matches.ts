// Match history, replays and ratings (GDD Phase 5). Replays are seed + team snapshots + the
// command log; the engine rebuilds everything else deterministically (GDD §10.5).

import { ENGINE_VERSION, type MatchRecord, type PlayerId } from '@arena/engine';
import { displayRating } from '@arena/meta';
import { asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import { matchActions, matches, users } from '../db/schema.js';
import { RANKED_SEASON, ratingOf } from '../match/store.js';

export function matchRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    app.get('/api/matches', async (req) => {
      const me = req.user!.id;
      const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }), req.query);
      const rows = await ctx.db
        .select()
        .from(matches)
        .where(or(eq(matches.p0User, me), eq(matches.p1User, me)))
        .orderBy(desc(matches.startedAt))
        .limit(limit);
      const opponentIds = [...new Set(rows.map((m) => (m.p0User === me ? m.p1User : m.p0User)))];
      const names = opponentIds.length
        ? await ctx.db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, opponentIds))
        : [];
      const nameOf = new Map(names.map((n) => [n.id, n.displayName]));
      return {
        matches: rows.map((m) => {
          const seat: PlayerId = m.p0User === me ? 0 : 1;
          const outcome =
            m.status !== 'finished' ? null : m.winner === null ? 'draw' : m.winner === seat ? 'win' : 'loss';
          return {
            id: m.id,
            kind: m.kind,
            status: m.status,
            seat,
            opponent: nameOf.get(seat === 0 ? m.p1User : m.p0User) ?? 'Unknown',
            outcome,
            endReason: m.endReason,
            turns: m.turns,
            startedAt: m.startedAt,
            endedAt: m.endedAt,
            rating: m.ratingChanges?.[seat] ?? null,
          };
        }),
      };
    });

    /** The replay record; only for participants, and only once the match is over. */
    app.get('/api/matches/:id/replay', async (req) => {
      const { id } = parse(z.object({ id: z.uuid() }), req.params);
      const [m] = await ctx.db.select().from(matches).where(eq(matches.id, id));
      const me = req.user!.id;
      if (!m || (m.p0User !== me && m.p1User !== me)) throw new HttpError(404, 'No such match');
      if (m.status !== 'finished') throw new HttpError(409, 'The match has no replay yet');
      const actions = await ctx.db.select().from(matchActions).where(eq(matchActions.matchId, id)).orderBy(asc(matchActions.seq));
      const record: MatchRecord = {
        engineVersion: m.engineVersion,
        contentVersion: m.contentVersion,
        config: m.config,
        commands: actions.map((a) => ({ player: a.player as PlayerId, cmd: a.command })),
      };
      return { record, seat: (m.p0User === me ? 0 : 1) as PlayerId, playable: m.engineVersion === ENGINE_VERSION && m.contentVersion === ctx.content.version };
    });

    app.get('/api/ratings', async (req) => {
      const [ranked, casual] = await Promise.all([ratingOf(ctx.db, req.user!.id, RANKED_SEASON), ratingOf(ctx.db, req.user!.id, 'casual')]);
      return {
        season: RANKED_SEASON,
        ranked: { rating: Math.round(ranked.rating), rd: Math.round(ranked.rd), display: displayRating(ranked), games: ranked.games, wins: ranked.wins },
        casual: { games: casual.games, wins: casual.wins },
      };
    });
  };
}
