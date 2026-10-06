// Roster order (decided 2026-10-06): the player arranges their characters by dragging; the order is
// saved, and characters recruited since go last.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 9100;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: 'Arranger' } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const roster = async () => ((await call('GET', '/api/characters')).json() as { characters: { id: string }[] }).characters.map((c) => c.id);
  return { call, roster };
}

describe('roster order', () => {
  it('is saved, and recruits since go last', async () => {
    const a = await account('order@example.com');
    for (let i = 0; i < 4; i++) await a.call('POST', '/api/characters/roll');
    const [w, x, y, z] = await a.roster();
    const order = [z!, w!, y!, x!];
    expect((await a.call('PUT', '/api/characters/order', { ids: order })).statusCode).toBe(200);
    expect(await a.roster()).toEqual(order);
    await a.call('POST', '/api/characters/roll');
    const after = await a.roster();
    expect(after.slice(0, 4)).toEqual(order);
    expect(after).toHaveLength(5);
  });

  it('must list each of the player\'s own characters exactly once', async () => {
    const a = await account('order2@example.com');
    const b = await account('order3@example.com');
    for (let i = 0; i < 2; i++) await a.call('POST', '/api/characters/roll');
    await b.call('POST', '/api/characters/roll');
    const mine = await a.roster();
    const theirs = await b.roster();
    expect((await a.call('PUT', '/api/characters/order', { ids: [mine[0]] })).statusCode).toBe(400);
    expect((await a.call('PUT', '/api/characters/order', { ids: [mine[0], mine[0]] })).statusCode).toBe(400);
    expect((await a.call('PUT', '/api/characters/order', { ids: [mine[0], theirs[0]] })).statusCode).toBe(400);
    expect(await a.roster()).toEqual(mine);
  });
});
