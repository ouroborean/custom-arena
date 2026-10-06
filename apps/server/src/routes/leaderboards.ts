// Leaderboards on Home (decided 2026-10-06): the longest current win streaks in casual and ranked
// matches, and the highest ranked ratings this season. Places nobody has earned yet go to the earliest
// accounts, in the order they registered, so a new server still shows ten names.

import { displayRating, seasonAt, seasonTier } from '@arena/meta';
import { and, asc, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireUser, type AppContext } from '../app.js';
import { matches, ratings, users } from '../db/schema.js';

export const LEADERBOARD_SIZE = 10;

/** How many recent finished matches the streaks are read from. */
const STREAK_WINDOW = 5000;

export interface LeaderboardEntry {
  name: string;
  /** The streak or display rating; null for a place filled by registration order. */
  value: number | null;
  /** The ranked tier (or "Placement"), on the rank board. */
  detail?: string;
}

/** Each player's current run of wins, newest match first: a loss or a draw ends it. */
export function currentStreaks(rows: { p0User: string; p1User: string; winner: number | null }[]): Map<string, number> {
  const streak = new Map<string, number>();
  const ended = new Set<string>();
  for (const m of rows) {
    for (const seat of [0, 1] as const) {
      const user = seat === 0 ? m.p0User : m.p1User;
      if (ended.has(user)) continue;
      if (m.winner === seat) streak.set(user, (streak.get(user) ?? 0) + 1);
      else ended.add(user);
    }
  }
  return streak;
}

export function leaderboardRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    app.get('/api/leaderboards', async () => {
      const [recent, earliest] = await Promise.all([
        ctx.db
          .select({ p0User: matches.p0User, p1User: matches.p1User, winner: matches.winner })
          .from(matches)
          .where(and(eq(matches.status, 'finished'), inArray(matches.kind, ['casual', 'ranked']), isNotNull(matches.endedAt)))
          .orderBy(desc(matches.endedAt))
          .limit(STREAK_WINDOW),
        ctx.db.select({ id: users.id, name: users.displayName }).from(users).orderBy(asc(users.createdAt)).limit(LEADERBOARD_SIZE * 2),
      ]);

      // Fills the rest of a board with the earliest accounts not already on it.
      const fill = (board: (LeaderboardEntry & { id: string })[]): LeaderboardEntry[] => {
        const on = new Set(board.map((e) => e.id));
        for (const u of earliest) {
          if (board.length >= LEADERBOARD_SIZE) break;
          if (!on.has(u.id)) board.push({ id: u.id, name: u.name, value: null });
        }
        return board.slice(0, LEADERBOARD_SIZE).map(({ id: _id, ...e }) => e);
      };

      const streaks = [...currentStreaks(recent)].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, LEADERBOARD_SIZE);
      const season = seasonAt(ctx.seasons, ctx.clock.now());
      const rated = season
        ? (await ctx.db.select().from(ratings).where(and(eq(ratings.queue, season.id), gt(ratings.games, 0))))
            .map((r) => ({ r, display: displayRating(r) }))
            .sort((a, b) => b.display - a.display)
            .slice(0, LEADERBOARD_SIZE)
        : [];
      const ids = [...new Set([...streaks.map(([id]) => id), ...rated.map(({ r }) => r.userId)])];
      const names = new Map(
        ids.length ? (await ctx.db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, ids))).map((u) => [u.id, u.name]) : [],
      );

      return {
        winstreak: fill(streaks.map(([id, n]) => ({ id, name: names.get(id) ?? 'Player', value: n }))),
        rank: fill(
          rated.map(({ r, display }) => ({
            id: r.userId,
            name: names.get(r.userId) ?? 'Player',
            value: display,
            detail: seasonTier(ctx.seasons, r)?.name ?? 'Placement',
          })),
        ),
        season: season && { id: season.id, name: season.name },
      };
    });
  };
}
