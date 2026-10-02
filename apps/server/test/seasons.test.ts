// Ranked seasons against an in-memory PGlite database: the schedule file, soft resets, rating into
// the season a match started in, the ratings endpoint, and at-most-once season close-outs.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { ENGINE_VERSION } from '@arena/engine';
import type { SeasonSchedule } from '@arena/meta';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { matches, ratings } from '../src/db/schema.js';
import { realClock } from '../src/match/clock.js';
import { dbRoomStore, queueRatingOf } from '../src/match/store.js';
import { closeSeason, loadSeasons } from '../src/seasons.js';

const content = loadContentOrThrow();
const schedule: SeasonSchedule = {
  seasons: [
    { id: 'ranked-s1', name: 'Season 1', start: '2026-01-01T00:00:00Z', end: '2026-04-01T00:00:00Z' },
    { id: 'ranked-s2', name: 'Season 2', start: '2026-04-08T00:00:00Z' },
  ],
  softReset: { keep: 0.5, rd: 200 },
  minGames: 2,
  tiers: [
    { id: 'bronze', name: 'Bronze', min: 0, reward: { currency: { gold: 100 } } },
    { id: 'gold', name: 'Gold', min: 1400, reward: { currency: { gold: 400 }, items: ['longsword+wind_shard+sigil_momentum'] } },
  ],
};
const at = (iso: string) => Date.parse(iso);
let now = at('2026-02-01T00:00:00Z');
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 900;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++, seasons: schedule, clock: { now: () => now, after: realClock.after } });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: email.split('@')[0]! } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const get = async (url: string) => (await app.inject({ url, headers: { cookie } })).json();
  const userId = (await get('/api/me')).user.id as string;
  return { userId, get, gold: async () => (await get('/api/wallet')).wallet.gold as number };
}

const setRating = (userId: string, queue: string, rating: number, rd: number, games: number) =>
  dbh.db.insert(ratings).values({ userId, queue, rating, rd, vol: 0.06, games, wins: Math.floor(games / 2) });

async function rankedMatch(p0: string, p1: string, startedAt: string, status = 'active') {
  const [m] = await dbh.db
    .insert(matches)
    .values({
      kind: 'ranked',
      status,
      contentVersion: content.version,
      engineVersion: ENGINE_VERSION,
      config: { seed: 1, teams: [[], []] },
      p0User: p0,
      p1User: p1,
      startedAt: new Date(startedAt),
    })
    .returning();
  return m!.id;
}

describe('seasons', () => {
  it('the shipped schedule is valid', () => {
    const s = loadSeasons(content);
    expect(s.seasons[0]!.id).toBe('ranked-s1'); // Phase 5 ratings live in this queue
  });

  it('a ranked match rates into the season it started in; a new season starts from a soft reset', async () => {
    const a = await account('s-a@example.com');
    const b = await account('s-b@example.com');
    const store = dbRoomStore(dbh.db, content, () => seed++, schedule);
    const id = await rankedMatch(a.userId, b.userId, '2026-03-31T23:50:00Z');
    now = at('2026-04-01T00:10:00Z'); // finished after the season ended
    const out = await store.finish(id, { winner: 0, endReason: 'elimination', turns: 12 });
    expect(out?.ratings?.[0].after).toBeGreaterThan(1500);
    const [row] = await dbh.db.select().from(ratings).where(eq(ratings.userId, a.userId));
    expect(row).toMatchObject({ queue: 'ranked-s1', games: 1, wins: 1 });

    const s2 = await queueRatingOf(dbh.db, schedule, a.userId, 'ranked-s2');
    expect(s2.games).toBe(0);
    expect(s2.rating).toBeCloseTo(1500 + (row!.rating - 1500) / 2);
    expect(s2.rd).toBe(Math.max(row!.rd, 200));
    const fresh = await queueRatingOf(dbh.db, schedule, (await account('s-new@example.com')).userId, 'ranked-s2');
    expect(fresh).toMatchObject({ rating: 1500, rd: 350, games: 0 });
  });

  it('GET /api/ratings: the running season and standing, or the next season between seasons', async () => {
    const a = await account('s-c@example.com');
    await setRating(a.userId, 'ranked-s1', 1700, 50, 12);
    now = at('2026-03-01T00:00:00Z');
    const during = await a.get('/api/ratings');
    expect(during.season).toMatchObject({ id: 'ranked-s1', name: 'Season 1', end: '2026-04-01T00:00:00Z' });
    expect(during.ranked).toMatchObject({ rating: 1700, display: 1600, games: 12, placementGames: 0, tier: { id: 'gold', name: 'Gold' } });

    now = at('2026-04-03T00:00:00Z');
    const between = await a.get('/api/ratings');
    expect(between.season).toBeNull();
    expect(between.ranked).toBeNull();
    expect(between.next).toMatchObject({ id: 'ranked-s2', start: '2026-04-08T00:00:00Z' });

    now = at('2026-05-01T00:00:00Z');
    const next = await a.get('/api/ratings');
    expect(next.ranked).toMatchObject({ rating: 1600, rd: 200, games: 0, placementGames: 2, tier: null });
  });

  it('closing a season pays each placed player their tier once', async () => {
    const top = await account('s-top@example.com');
    const mid = await account('s-mid@example.com');
    const few = await account('s-few@example.com');
    await setRating(top.userId, 'ranked-s1', 1750, 60, 20); // display 1630: Gold
    await setRating(mid.userId, 'ranked-s1', 1450, 120, 4); // display 1210: Bronze
    await setRating(few.userId, 'ranked-s1', 1600, 250, 1); // below minGames
    const gold0 = await Promise.all([top.gold(), mid.gold(), few.gold()]);

    await expect(closeSeason(dbh.db, content, schedule, 'ranked-s1', at('2026-03-15T00:00:00Z'))).rejects.toThrow(/hasn't ended/);
    await expect(closeSeason(dbh.db, content, schedule, 'ranked-s2', at('2026-12-01T00:00:00Z'))).rejects.toThrow(/no end date/);
    await expect(closeSeason(dbh.db, content, schedule, 'ranked-s9', now)).rejects.toThrow(/No season/);
    const live = await rankedMatch(top.userId, mid.userId, '2026-03-31T23:00:00Z');
    await expect(closeSeason(dbh.db, content, schedule, 'ranked-s1', now)).rejects.toThrow(/still being played/);
    await dbh.db.update(matches).set({ status: 'aborted' }).where(eq(matches.id, live));

    const dry = await closeSeason(dbh.db, content, schedule, 'ranked-s1', now, { dryRun: true });
    const planned = dry.paid.filter((p) => [top.userId, mid.userId, few.userId].includes(p.userId));
    expect(planned.map((p) => [p.displayName, p.tier, p.rating])).toEqual([
      ['s-top', 'gold', 1630],
      ['s-mid', 'bronze', 1210],
    ]);
    expect(await top.gold()).toBe(gold0[0]);

    const first = await closeSeason(dbh.db, content, schedule, 'ranked-s1', now);
    expect(first.paid.length).toBe(dry.paid.length);
    expect(first.unplaced).toBeGreaterThanOrEqual(1);
    expect([await top.gold(), await mid.gold(), await few.gold()]).toEqual([gold0[0]! + 400, gold0[1]! + 100, gold0[2]]);
    const items = (await top.get('/api/inventory')).items as { itemId: string; source: string }[];
    expect(items.filter((i) => i.source === 'season:ranked-s1').map((i) => i.itemId)).toEqual(['longsword+wind_shard+sigil_momentum']);

    const again = await closeSeason(dbh.db, content, schedule, 'ranked-s1', now);
    expect(again.paid).toEqual([]);
    expect(again.alreadyPaid).toBe(first.paid.length);
    expect(await top.gold()).toBe(gold0[0]! + 400);

    const r = await top.get('/api/ratings');
    expect(r.lastReward).toMatchObject({ season: 'ranked-s1', seasonName: 'Season 1', tier: 'Gold', rating: 1630, currency: { gold: 400 }, items: ['longsword+wind_shard+sigil_momentum'] });
  });
});
