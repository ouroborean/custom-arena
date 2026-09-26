// Postgres persistence for match rooms: the replay log, results and Glicko-2 ratings.

import { DEFAULT_RATING, rateMatch, type Rating } from '@arena/meta';
import type { PlayerId } from '@arena/engine';
import type { MatchKind, RatingChange } from '@arena/protocol';
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { matchActions, matches, ratings } from '../db/schema.js';
import type { EndReason, RoomStore } from './room.js';

/** Ranked ratings are per season; casual has one hidden matchmaking rating. */
export const RANKED_SEASON = 'ranked-s1';

export function ratingQueue(kind: MatchKind): string | null {
  return kind === 'ranked' ? RANKED_SEASON : kind === 'casual' ? 'casual' : null;
}

export async function ratingOf(db: Db, userId: string, queue: string): Promise<Rating & { games: number; wins: number }> {
  const [row] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.queue, queue)));
  return row ? { rating: row.rating, rd: row.rd, vol: row.vol, games: row.games, wins: row.wins } : { ...DEFAULT_RATING, games: 0, wins: 0 };
}

export function dbRoomStore(db: Db): RoomStore {
  return {
    async appendActions(matchId, actions) {
      if (actions.length === 0) return;
      await db.insert(matchActions).values(actions.map((a) => ({ matchId, seq: a.seq, player: a.player, command: a.command })));
    },

    async finish(matchId, r: { winner: PlayerId | null; endReason: EndReason; turns: number }) {
      const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
      if (!m) return null;
      const queue = ratingQueue(m.kind as MatchKind);
      let changes: [RatingChange, RatingChange] | null = null;
      if (queue) {
        const [a, b] = await Promise.all([ratingOf(db, m.p0User, queue), ratingOf(db, m.p1User, queue)]);
        const score = r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5;
        const [na, nb] = rateMatch(a, b, score);
        const upsert = async (userId: string, next: Rating, prev: { games: number; wins: number }, won: boolean) => {
          const row = { userId, queue, ...next, games: prev.games + 1, wins: prev.wins + (won ? 1 : 0), updatedAt: new Date() };
          await db
            .insert(ratings)
            .values(row)
            .onConflictDoUpdate({
              target: [ratings.userId, ratings.queue],
              set: { rating: row.rating, rd: row.rd, vol: row.vol, games: row.games, wins: row.wins, updatedAt: row.updatedAt },
            });
        };
        await upsert(m.p0User, na, a, r.winner === 0);
        await upsert(m.p1User, nb, b, r.winner === 1);
        if (m.kind === 'ranked') {
          changes = [
            { before: Math.round(a.rating), after: Math.round(na.rating) },
            { before: Math.round(b.rating), after: Math.round(nb.rating) },
          ];
        }
      }
      await db
        .update(matches)
        .set({
          status: 'finished',
          winner: r.winner,
          endReason: r.endReason,
          turns: r.turns,
          endedAt: new Date(),
          ...(changes ? { ratingChanges: changes } : {}),
        })
        .where(eq(matches.id, matchId));
      return changes;
    },
  };
}

/** Matches left active by a previous server process can't resume (rooms live in memory). */
export async function abortStaleMatches(db: Db): Promise<number> {
  const rows = await db
    .update(matches)
    .set({ status: 'aborted', endReason: 'server_restart', endedAt: sql`now()` })
    .where(eq(matches.status, 'active'))
    .returning({ id: matches.id });
  return rows.length;
}
