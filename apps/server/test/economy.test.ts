// Wallets, roll costs, forging, splitting, salvage and match rewards against an in-memory PGlite database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { ENGINE_VERSION } from '@arena/engine';
import { OPEN_SCHEDULE } from '@arena/meta';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { itemInstances, matches } from '../src/db/schema.js';
import { dbRoomStore } from '../src/match/store.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 500;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++, devGrants: true });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: 'Eco' } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const grant = async (itemId: string) => (await call('POST', '/api/dev/grant', { itemId })).json().item.id as string;
  const gold = async () => (await call('GET', '/api/wallet')).json().wallet.gold as number;
  const userId = (await call('GET', '/api/me')).json().user.id as string;
  return { call, grant, gold, userId };
}

describe('wallet and rolling', () => {
  it('new accounts start with 300 Gold; a roll costs 100; a short wallet rolls nothing', async () => {
    const a = await account('roll@example.com');
    expect(await a.gold()).toBe(300);
    for (let i = 0; i < 3; i++) expect((await a.call('POST', '/api/characters/roll')).statusCode).toBe(201);
    expect(await a.gold()).toBe(0);
    const before = (await a.call('GET', '/api/characters')).json().characters.length;
    const broke = await a.call('POST', '/api/characters/roll');
    expect(broke.statusCode).toBe(402);
    expect((await a.call('GET', '/api/characters')).json().characters.length).toBe(before);
    expect(await a.gold()).toBe(0);
  });
});

describe('forging, splitting and salvage', () => {
  it('forges an addition onto a base for Gold: both are used up, and the base keeps its place', async () => {
    const a = await account('forge@example.com');
    const bow = await a.grant('shortbow');
    const chalice = await a.grant('chalice');
    const res = await a.call('POST', '/api/forge', { base: bow, addition: chalice });
    expect(res.statusCode).toBe(201);
    expect(res.json().item.itemId).toBe('shortbow+chalice'); // a Saint Bow
    expect(res.json().wallet.gold).toBe(250);
    const spear = await a.grant('spear');
    const third = await a.call('POST', '/api/forge', { base: res.json().item.id, addition: spear });
    expect(third.json().item.itemId).toBe('shortbow+chalice+spear'); // a Reckless Saint Bow
    expect(third.json().wallet.gold).toBe(150); // three components cost more
    const inv = (await a.call('GET', '/api/inventory')).json().items as { id: string; itemId: string }[];
    expect(inv.some((i) => [bow, chalice, spear].includes(i.id))).toBe(false);
    expect(inv.filter((i) => i.itemId === 'shortbow+chalice+spear')).toHaveLength(1);
  });

  it('refuses illegal pieces, unowned items and equipped ones, taking nothing', async () => {
    const a = await account('noforge@example.com');
    const b = await account('thief@example.com');
    const one = await a.grant('sigil_momentum');
    const two = await a.grant('sigil_eruptions');
    const bad = await a.call('POST', '/api/forge', { base: one, addition: two });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().problems[0]).toContain('one Sigil');
    expect((await b.call('POST', '/api/forge', { base: one, addition: two })).statusCode).toBe(404);
    expect((await a.call('POST', '/api/forge', { base: one, addition: one })).statusCode).toBe(400); // the same piece twice
    expect(await a.gold()).toBe(300);
    expect((await a.call('GET', '/api/inventory')).json().items.filter((i: { id: string }) => [one, two].includes(i.id))).toHaveLength(2);

    const chars = (await a.call('GET', '/api/characters')).json().characters as { id: string; skills: { base: string; infusion: string | null }[] }[];
    const c = chars[0]!;
    const shard = await a.grant('ice_shard');
    const target = c.skills.find((s) => !s.infusion)!.base;
    const put = await a.call('PUT', `/api/characters/${c.id}/loadout`, {
      loadout: { items: [{ itemId: 'ice_shard', instanceId: shard }], infusions: [{ skill: target, element: 'Ice' }] },
    });
    expect(put.statusCode).toBe(200);
    expect((await a.call('POST', '/api/forge', { base: shard, addition: one })).statusCode).toBe(409);
    expect((await a.call('POST', `/api/inventory/${shard}/salvage`)).statusCode).toBe(409);
  });

  it('splits a forged piece back into its components for a fee; a single component does not split', async () => {
    const a = await account('split@example.com');
    const katana = await a.grant('longsword+wind_shard+sigil_momentum');
    const res = await a.call('POST', `/api/inventory/${katana}/split`);
    expect(res.statusCode).toBe(201);
    expect((res.json().items as { itemId: string }[]).map((i) => i.itemId)).toEqual(['longsword', 'wind_shard', 'sigil_momentum']);
    expect(res.json().wallet.gold).toBe(275);
    expect((await a.call('POST', `/api/inventory/${katana}/split`)).statusCode).toBe(404);
    const sword = (res.json().items as { id: string }[])[0]!.id;
    expect((await a.call('POST', `/api/inventory/${sword}/split`)).statusCode).toBe(400);
  });

  it('salvage pays for each component and removes the piece', async () => {
    const a = await account('salvage@example.com');
    const katana = await a.grant('longsword+wind_shard+sigil_momentum');
    const res = await a.call('POST', `/api/inventory/${katana}/salvage`);
    expect(res.json()).toMatchObject({ paid: { gold: 45 }, wallet: { gold: 345 } });
    expect((await a.call('POST', `/api/inventory/${katana}/salvage`)).statusCode).toBe(404);
  });
});

describe('match rewards', () => {
  async function match(kind: string, p0: string, p1: string) {
    const [m] = await dbh.db
      .insert(matches)
      .values({ kind, status: 'active', contentVersion: content.version, engineVersion: ENGINE_VERSION, config: { seed: 1, teams: [[], []] }, p0User: p0, p1User: p1 })
      .returning();
    return m!.id;
  }

  it('a played-out casual match pays both players, once', async () => {
    const a = await account('winner@example.com');
    const b = await account('loser@example.com');
    const store = dbRoomStore(dbh.db, content, () => seed++, OPEN_SCHEDULE);
    const id = await match('casual', a.userId, b.userId);
    const out = await store.finish(id, { winner: 0, endReason: 'elimination', turns: 20 });
    expect(out?.rewards[0]).toMatchObject({ currency: { gold: 40 } });
    expect(out?.rewards[0]?.items).toHaveLength(1);
    expect(out?.rewards[1]).toEqual({ currency: { gold: 15 }, items: [] });
    // The winner's first online win also completes two achievements (First Victory, Arena Debut).
    expect(out?.achievements?.[0]).toEqual(['first_victory', 'online_debut']);
    expect([await a.gold(), await b.gold()]).toEqual([340 + 50 + 100, 315]);
    const drops = await dbh.db.select().from(itemInstances).where(eq(itemInstances.userId, a.userId));
    expect(drops.filter((d) => d.source === 'reward').map((d) => d.itemId)).toEqual(out!.rewards[0]!.items);

    const again = await store.finish(id, { winner: 0, endReason: 'elimination', turns: 20 });
    expect(again?.rewards).toEqual([null, null]);
    expect(await a.gold()).toBe(490);

    const history = (await a.call('GET', '/api/matches')).json().matches as { id: string; reward: unknown }[];
    expect(history.find((m) => m.id === id)?.reward).toEqual(out!.rewards[0]);
  });

  it('surrenders pay the loser nothing; short and private matches pay no one', async () => {
    const a = await account('w2@example.com');
    const b = await account('l2@example.com');
    const store = dbRoomStore(dbh.db, content, () => seed++, OPEN_SCHEDULE);
    const surrendered = await store.finish(await match('casual', a.userId, b.userId), { winner: 0, endReason: 'surrender', turns: 20 });
    expect(surrendered?.rewards[1]).toBeNull();
    const short = await store.finish(await match('ranked', a.userId, b.userId), { winner: 0, endReason: 'elimination', turns: 3 });
    expect(short?.rewards).toEqual([null, null]);
    const priv = await store.finish(await match('private', a.userId, b.userId), { winner: 0, endReason: 'elimination', turns: 30 });
    expect(priv?.rewards).toEqual([null, null]);
  });
});
