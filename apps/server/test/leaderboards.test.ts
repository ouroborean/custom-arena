// Home's leaderboards and the forge's trade-in (decided 2026-10-06). Leaderboards: the longest current
// win streaks in casual and ranked matches, and the highest ranked ratings; places nobody has earned
// go to the earliest accounts, in registration order. Trade-in: any 3 unequipped single components
// become one random other component.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { ENGINE_VERSION, pieceComponentIds } from '@arena/engine';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { matches, ratings } from '../src/db/schema.js';
import { currentStreaks } from '../src/routes/leaderboards.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 7100;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++, devGrants: true });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(name: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `${name}@example.com`, password: 'password123', displayName: name } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const userId = (res.json() as { user: { id: string } }).user.id;
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  return { userId, name, call };
}

interface Board {
  winstreak: { name: string; value: number | null; detail?: string }[];
  rank: { name: string; value: number | null; detail?: string }[];
}

let t = Date.UTC(2026, 9, 1);
/** A finished match between two accounts; `winner` is the seat that won (null: a draw). */
async function finished(kind: string, p0: string, p1: string, winner: 0 | 1 | null) {
  t += 60_000;
  await dbh.db.insert(matches).values({
    kind,
    status: 'finished',
    contentVersion: content.version,
    engineVersion: ENGINE_VERSION,
    config: { seed: 1, teams: [[], []] },
    p0User: p0,
    p1User: p1,
    winner,
    endReason: 'elimination',
    turns: 20,
    endedAt: new Date(t),
  });
}

describe('current win streaks', () => {
  it('count wins back from the newest match; a loss or draw ends the run', () => {
    // Newest first.
    const rows = [
      { p0User: 'a', p1User: 'b', winner: 0 },
      { p0User: 'c', p1User: 'a', winner: 1 },
      { p0User: 'a', p1User: 'b', winner: null },
      { p0User: 'a', p1User: 'c', winner: 0 },
    ];
    const s = currentStreaks(rows);
    expect(s.get('a')).toBe(2); // two wins, then the draw ends it
    expect(s.get('b') ?? 0).toBe(0);
    expect(s.get('c') ?? 0).toBe(0);
  });
});

describe('leaderboards', () => {
  it('show the first 10 players to register while nobody has progress, on both boards', async () => {
    const players = [];
    for (let i = 0; i < 12; i++) players.push(await account(`early${i}`));
    const board = (await players[0]!.call('GET', '/api/leaderboards')).json() as Board;
    const firstTen = players.slice(0, 10).map((p) => p.name);
    expect(board.winstreak.map((e) => e.name)).toEqual(firstTen);
    expect(board.rank.map((e) => e.name)).toEqual(firstTen);
    expect(board.winstreak.every((e) => e.value === null)).toBe(true);
  });

  it('rank current casual and ranked win streaks first, ignoring private matches', async () => {
    const [a, b, c] = [await account('streakA'), await account('streakB'), await account('streakC')];
    await finished('casual', a.userId, b.userId, 0);
    await finished('ranked', c.userId, a.userId, 1);
    await finished('casual', a.userId, c.userId, 0); // a: 3 in a row
    await finished('ranked', b.userId, c.userId, 0); // b: lost, then won 1
    await finished('private', c.userId, a.userId, 0); // private: doesn't count
    const board = (await a.call('GET', '/api/leaderboards')).json() as Board;
    expect(board.winstreak.slice(0, 2)).toEqual([
      { name: 'streakA', value: 3 },
      { name: 'streakB', value: 1 },
    ]);
    // The rest are filled from registration order.
    expect(board.winstreak).toHaveLength(10);
    expect(board.winstreak[2]).toEqual({ name: 'early0', value: null });
  });

  it('rank by ranked display rating this season, with tier or Placement', async () => {
    const [a, b] = [await account('rankA'), await account('rankB')];
    await dbh.db.insert(ratings).values([
      { userId: a.userId, queue: 'ranked-s1', rating: 1700, rd: 60, vol: 0.06, games: 12, wins: 9 },
      { userId: b.userId, queue: 'ranked-s1', rating: 1800, rd: 60, vol: 0.06, games: 3, wins: 3 },
    ]);
    const board = (await a.call('GET', '/api/leaderboards')).json() as Board;
    expect(board.rank.slice(0, 2).map((e) => [e.name, e.value])).toEqual([
      ['rankB', 1800 - 120],
      ['rankA', 1700 - 120],
    ]);
    expect(board.rank[0]!.detail).toBe('Placement'); // fewer than the season's minimum games
  });
});

describe('trading in components', () => {
  const grant = async (a: Awaited<ReturnType<typeof account>>, itemId: string) =>
    ((await a.call('POST', '/api/dev/grant', { itemId })).json() as { item: { id: string } }).item.id;
  const inventory = async (a: Awaited<ReturnType<typeof account>>) =>
    ((await a.call('GET', '/api/inventory')).json() as { items: { id: string; itemId: string; source: string }[] }).items;

  it('turns 3 single components into one random other component', async () => {
    const a = await account('trader');
    const ids = [await grant(a, 'fire_shard'), await grant(a, 'fire_shard'), await grant(a, 'shortbow')];
    const res = await a.call('POST', '/api/inventory/trade-in', { ids });
    expect(res.statusCode).toBe(201);
    const made = (res.json() as { item: { itemId: string } }).item.itemId;
    expect(pieceComponentIds(made)).toHaveLength(1);
    expect(['fire_shard', 'shortbow']).not.toContain(made);
    const items = await inventory(a);
    // The three are gone, and the new one is there.
    expect(items.filter((i) => ids.includes(i.id))).toEqual([]);
    expect(items.filter((i) => i.source === 'trade-in').map((i) => i.itemId)).toEqual([made]);
  });

  it('needs exactly 3 unequipped single components', async () => {
    const a = await account('trader2');
    const start = (await inventory(a)).length;
    const two = [await grant(a, 'fire_shard'), await grant(a, 'ice_shard')];
    expect((await a.call('POST', '/api/inventory/trade-in', { ids: two })).statusCode).toBe(400);
    const forged = await grant(a, 'shortbow+chalice');
    expect((await a.call('POST', '/api/inventory/trade-in', { ids: [...two, forged] })).statusCode).toBe(400);
    expect((await a.call('POST', '/api/inventory/trade-in', { ids: [...two, two[0]!] })).statusCode).toBe(400);
    expect(await inventory(a)).toHaveLength(start + 3); // nothing was used up
  });
});
