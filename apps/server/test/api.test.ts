// API tests against an in-memory PGlite database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMatch } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 1;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

/** Registers a user and returns their session cookie header. */
async function register(email: string, password = 'hunter22!', displayName = 'Tester') {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password, displayName } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === 'arena_session')!;
  return { cookie: `arena_session=${c.value}`, res };
}

describe('health and content', () => {
  it('reports versions', async () => {
    const res = await app.inject('/api/health');
    expect(res.json()).toMatchObject({ ok: true, content: content.version });
  });

  it('serves the current content bundle, immutable, and 404s other versions', async () => {
    const res = await app.inject(`/api/content/${content.version}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(Object.keys(res.json().skills).length).toBe(Object.keys(content.skills).length);
    expect((await app.inject('/api/content/nope')).statusCode).toBe(404);
  });
});

describe('auth', () => {
  it('registers, sets an httpOnly session, and gives a starter team of 3', async () => {
    const { cookie, res } = await register('A@Example.com');
    const set = res.cookies.find((x) => x.name === 'arena_session')!;
    expect(set.httpOnly).toBe(true);
    const me = await app.inject({ url: '/api/me', headers: { cookie } });
    expect(me.json().user.email).toBe('a@example.com');
    const team = await app.inject({ url: '/api/teams/active', headers: { cookie } });
    expect(team.json().team.characterIds).toHaveLength(3);
  });

  it('rejects duplicate emails (case-insensitive), bad input and wrong passwords', async () => {
    await register('dup@example.com');
    const again = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'DUP@example.com', password: 'whatever12', displayName: 'x' },
    });
    expect(again.statusCode).toBe(409);
    const short = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'short@example.com', password: 'short', displayName: 'x' },
    });
    expect(short.statusCode).toBe(400);
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dup@example.com', password: 'nope-nope' } });
    expect(wrong.statusCode).toBe(401);
  });

  it('logs in and out', async () => {
    await register('login@example.com', 'correct-horse');
    const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'LOGIN@example.com', password: 'correct-horse' } });
    expect(ok.statusCode).toBe(200);
    const cookie = `arena_session=${ok.cookies.find((x) => x.name === 'arena_session')!.value}`;
    expect((await app.inject({ url: '/api/me', headers: { cookie } })).statusCode).toBe(200);
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect((await app.inject({ url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('requires a session for roster routes', async () => {
    expect((await app.inject('/api/characters')).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/characters/roll', method: 'POST' })).statusCode).toBe(401);
  });
});

describe('roster and teams', () => {
  it('rolls, lists, renames and retires characters', async () => {
    const { cookie } = await register('roster@example.com');
    const roll = await app.inject({ method: 'POST', url: '/api/characters/roll', headers: { cookie } });
    expect(roll.statusCode).toBe(201);
    const c = roll.json().character;
    expect(c.skills.length).toBeGreaterThanOrEqual(3);

    const list = await app.inject({ url: '/api/characters', headers: { cookie } });
    expect(list.json().characters).toHaveLength(4);

    const renamed = await app.inject({ method: 'PATCH', url: `/api/characters/${c.id}`, headers: { cookie }, payload: { name: 'Bob' } });
    expect(renamed.json().character.name).toBe('Bob');

    const detail = await app.inject({ url: `/api/characters/${c.id}`, headers: { cookie } });
    expect(detail.json().problems).toEqual([]);

    expect((await app.inject({ method: 'DELETE', url: `/api/characters/${c.id}`, headers: { cookie } })).statusCode).toBe(204);
  });

  it('keeps characters private to their owner', async () => {
    const alice = await register('alice@example.com');
    const bob = await register('bob@example.com');
    const aliceChars = (await app.inject({ url: '/api/characters', headers: { cookie: alice.cookie } })).json().characters;
    const peek = await app.inject({ url: `/api/characters/${aliceChars[0].id}`, headers: { cookie: bob.cookie } });
    expect(peek.statusCode).toBe(404);
    const steal = await app.inject({
      method: 'PUT',
      url: '/api/teams/active',
      headers: { cookie: bob.cookie },
      payload: { characterIds: aliceChars.map((c: { id: string }) => c.id) },
    });
    expect(steal.statusCode).toBe(404);
  });

  it('sets the active team, protects its members, and exports engine specs', async () => {
    const { cookie } = await register('team@example.com');
    for (let i = 0; i < 2; i++) await app.inject({ method: 'POST', url: '/api/characters/roll', headers: { cookie } });
    const chars = (await app.inject({ url: '/api/characters', headers: { cookie } })).json().characters as { id: string }[];
    const ids = chars.slice(2, 5).map((c) => c.id);
    const put = await app.inject({ method: 'PUT', url: '/api/teams/active', headers: { cookie }, payload: { characterIds: ids } });
    expect(put.json().team.characterIds).toEqual(ids);

    const dup = await app.inject({
      method: 'PUT',
      url: '/api/teams/active',
      headers: { cookie },
      payload: { characterIds: [ids[0], ids[0], ids[1]] },
    });
    expect(dup.statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/api/characters/${ids[0]}`, headers: { cookie } })).statusCode).toBe(409);

    const specs = (await app.inject({ url: '/api/teams/active/specs', headers: { cookie } })).json().specs;
    const { state } = createMatch(content, { seed: 1, teams: [specs, specs] });
    expect(state.units.filter((u) => u.kind === 'character')).toHaveLength(6);
  });
});
