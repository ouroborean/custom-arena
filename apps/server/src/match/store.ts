// Postgres persistence for match rooms: the replay log, results and Glicko-2 ratings.

import { DEFAULT_RATING, earlierSeasons, rateMatch, seasonAt, softReset, type Rating, type SeasonSchedule } from '@arena/meta';
import type { ContentBundle, PlayerId } from '@arena/engine';
import type { MatchKind, RatingChange } from '@arena/protocol';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { grantMatchRewards } from '../economy.js';
import { matchFact, recordAchievements } from '../singleplayer.js';
import { matchActions, matches, ratings } from '../db/schema.js';
import type { EndReason, RoomStore } from './room.js';

/**
 * The ratings queue a match counts toward: ranked ratings are per season (the one running at `at`,
 * null between seasons); casual has one hidden matchmaking rating; private matches are unrated.
 */
export function ratingQueue(kind: MatchKind, seasons: SeasonSchedule, at: number): string | null {
  return kind === 'ranked' ? (seasonAt(seasons, at)?.id ?? null) : kind === 'casual' ? 'casual' : null;
}

export async function ratingOf(db: Db, userId: string, queue: string): Promise<Rating & { games: number; wins: number }> {
  const [row] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.queue, queue)));
  return row ? { rating: row.rating, rd: row.rd, vol: row.vol, games: row.games, wins: row.wins } : { ...DEFAULT_RATING, games: 0, wins: 0 };
}

/** A rating in a queue; a player's first games of a season start from a soft reset of their latest earlier season. */
export async function queueRatingOf(db: Db, seasons: SeasonSchedule, userId: string, queue: string): Promise<Rating & { games: number; wins: number }> {
  const r = await ratingOf(db, userId, queue);
  const earlier = earlierSeasons(seasons, queue).map((s) => s.id);
  if (r.games > 0 || earlier.length === 0) return r;
  const rows = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), inArray(ratings.queue, earlier)));
  const prev = earlier.map((id) => rows.find((x) => x.queue === id)).find((x) => x !== undefined);
  return prev ? { ...softReset(prev, seasons.softReset), games: 0, wins: 0 } : r;
}

/** Postgres-backed room persistence; `seed` feeds reward drop rolls. */
export function dbRoomStore(db: Db, content: ContentBundle, seed: () => number, seasons: SeasonSchedule): RoomStore {
  return {
    async appendActions(matchId, actions) {
      if (actions.length === 0) return;
      await db.insert(matchActions).values(actions.map((a) => ({ matchId, seq: a.seq, player: a.player, command: a.command })));
    },

    async finish(matchId, r: { winner: PlayerId | null; endReason: EndReason; turns: number }) {
      const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
      if (!m) return null;
      // Ratings and achievements apply once per match (rewards are keyed at-most-once separately).
      const firstFinish = m.status !== 'finished';
      // A ranked match rates into the season it started in.
      const queue = ratingQueue(m.kind as MatchKind, seasons, m.startedAt.getTime());
      let changes: [RatingChange, RatingChange] | null = null;
      if (queue && firstFinish) {
        const [a, b] = await Promise.all([queueRatingOf(db, seasons, m.p0User, queue), queueRatingOf(db, seasons, m.p1User, queue)]);
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
      const rewards = await grantMatchRewards(
        db,
        content,
        { matchId, kind: m.kind, users: [m.p0User, m.p1User], winner: r.winner, endReason: r.endReason, turns: r.turns },
        seed,
      );
      // Achievements count casual and ranked matches that meet the reward rules' minimum length.
      const achievements: [string[], string[]] = [[], []];
      const rules = content.economy.rewards[m.kind];
      if (firstFinish && rules && r.turns >= rules.minTurns) {
        for (const p of [0, 1] as const) {
          const outcome = r.winner === null ? 'draw' : r.winner === p ? 'win' : 'loss';
          const unlocked = await recordAchievements(db, content, p === 0 ? m.p0User : m.p1User, matchFact(m.kind, outcome, r.turns, m.config.teams[p]));
          achievements[p] = unlocked.map((u) => u.id);
        }
      }
      return { ratings: changes, rewards, achievements };
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
