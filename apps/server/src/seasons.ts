// Ranked seasons on the server (docs/live-ops.md §4): the schedule in seasons.json, and closing a
// finished season — each placed player gets their tier's reward, at most once (season_rewards).

import { readFileSync } from 'node:fs';
import type { ContentBundle } from '@arena/engine';
import { checkSchedule, displayRating, seasonEnded, seasonTier, type Season, type SeasonSchedule } from '@arena/meta';
import { and, count, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from './db/client.js';
import { matches, ratings, seasonRewards, users } from './db/schema.js';
import { grant, inTransaction } from './economy.js';

export const SEASONS_FILE = new URL('../seasons.json', import.meta.url);

const Amounts = z.record(z.string(), z.number().int().min(0));
const ScheduleSchema = z.object({
  seasons: z
    .array(z.strictObject({ id: z.string().min(1).max(40), name: z.string().min(1), start: z.string(), end: z.string().optional() }))
    .min(1),
  softReset: z.strictObject({ keep: z.number(), rd: z.number().positive() }),
  minGames: z.number().int().min(0),
  tiers: z.array(
    z.strictObject({
      id: z.string().min(1),
      name: z.string().min(1),
      min: z.number(),
      reward: z.strictObject({ currency: Amounts.optional(), items: z.array(z.string()).optional() }).optional(),
    }),
  ),
});

/** Reads and checks a season schedule; throws listing every problem. */
export function loadSeasons(content: ContentBundle, file: string | URL = SEASONS_FILE): SeasonSchedule {
  const r = ScheduleSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!r.success) throw new Error(`${String(file)}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const problems = checkSchedule(r.data, content);
  if (problems.length) throw new Error(`${String(file)}:\n  ${problems.join('\n  ')}`);
  return r.data;
}

export interface SeasonPayout {
  userId: string;
  displayName: string;
  tier: string;
  rating: number;
  games: number;
}

export interface CloseReport {
  season: Season;
  /** Newly paid (or, in a dry run, that would be paid). */
  paid: SeasonPayout[];
  /** Already paid by an earlier close-out. */
  alreadyPaid: number;
  /** Rated players below `minGames` or the lowest tier. */
  unplaced: number;
}

/**
 * Pays a finished season's tier rewards. Safe to run again: players already paid are skipped. Refuses
 * before the season's end, and while ranked matches started in it are still being played (they rate
 * into it when they finish).
 */
export async function closeSeason(
  db: Db,
  content: ContentBundle,
  schedule: SeasonSchedule,
  seasonId: string,
  now: number,
  opts: { dryRun?: boolean } = {},
): Promise<CloseReport> {
  const season = schedule.seasons.find((s) => s.id === seasonId);
  if (!season) throw new Error(`No season "${seasonId}" in the schedule (${schedule.seasons.map((s) => s.id).join(', ')})`);
  if (!seasonEnded(season, now)) throw new Error(`${season.name} hasn't ended (${season.end ? `it ends ${season.end}` : 'it has no end date yet'})`);
  const [live] = await db
    .select({ n: count() })
    .from(matches)
    .where(
      and(
        eq(matches.kind, 'ranked'),
        eq(matches.status, 'active'),
        gte(matches.startedAt, new Date(season.start)),
        lt(matches.startedAt, new Date(season.end!)),
      ),
    );
  if (live && live.n > 0) throw new Error(`${live.n} ranked match(es) from ${season.name} are still being played; try again once they finish`);

  const rows = await db
    .select({ userId: ratings.userId, rating: ratings.rating, rd: ratings.rd, vol: ratings.vol, games: ratings.games, displayName: users.displayName })
    .from(ratings)
    .innerJoin(users, eq(users.id, ratings.userId))
    .where(eq(ratings.queue, season.id));
  const paidBefore = new Set(
    (await db.select({ userId: seasonRewards.userId }).from(seasonRewards).where(eq(seasonRewards.seasonId, season.id))).map((r) => r.userId),
  );

  const report: CloseReport = { season, paid: [], alreadyPaid: 0, unplaced: 0 };
  for (const row of rows) {
    const tier = seasonTier(schedule, row);
    if (!tier) {
      report.unplaced++;
      continue;
    }
    if (paidBefore.has(row.userId)) {
      report.alreadyPaid++;
      continue;
    }
    const payout = { userId: row.userId, displayName: row.displayName, tier: tier.id, rating: displayRating(row), games: row.games };
    if (!opts.dryRun) {
      const paid = await inTransaction(db, async (tx) => {
        // The row is the at-most-once key: a concurrent close-out that got here first wins.
        const inserted = await tx
          .insert(seasonRewards)
          .values({ userId: row.userId, seasonId: season.id, tier: tier.id, rating: payout.rating, currency: { ...tier.reward?.currency }, items: [...(tier.reward?.items ?? [])] })
          .onConflictDoNothing()
          .returning({ userId: seasonRewards.userId });
        if (inserted.length === 0) return false;
        await grant(tx, content, row.userId, tier.reward, `season:${season.id}`);
        return true;
      });
      if (!paid) {
        report.alreadyPaid++;
        continue;
      }
    }
    report.paid.push(payout);
  }
  report.paid.sort((a, b) => b.rating - a.rating);
  return report;
}
