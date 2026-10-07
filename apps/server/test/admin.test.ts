// The admin tool (decided 2026-10-07): only accounts listed in ADMIN_EMAILS can see player counts,
// the player list and each player's account details; everyone else gets 403.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 9900;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++, adminEmails: ['Boss@Example.com'] });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string, displayName: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const userId = (res.json() as { user: { id: string } }).user.id;
  const call = (method: 'GET' | 'POST', url: string) => app.inject({ method, url, headers: { cookie } });
  return { userId, call };
}

describe('the admin tool', () => {
  it('is only for accounts in ADMIN_EMAILS (any case), and says who is one', async () => {
    const boss = await account('boss@example.com', 'Boss');
    const player = await account('player@example.com', 'Player');
    expect((await boss.call('GET', '/api/me')).json().user.isAdmin).toBe(true);
    expect((await player.call('GET', '/api/me')).json().user.isAdmin).toBe(false);
    for (const url of ['/api/admin/overview', '/api/admin/players', `/api/admin/players/${boss.userId}`]) {
      expect((await player.call('GET', url)).statusCode, url).toBe(403);
      expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(401);
    }
  });

  it('counts registered players and lists them, newest first, searchable by name or email', async () => {
    await account('boss2@example.com', 'Boss Two');
    await app.close();
    // A second app with this boss as admin (the list is read from the same database).
    app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++, adminEmails: ['boss2@example.com'] });
    const a = await account('alpha@example.com', 'Alpha');
    for (let i = 0; i < 2; i++) await a.call('POST', '/api/characters/roll');
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'boss2@example.com', password: 'password123' } });
    const cookie = `arena_session=${login.cookies.find((c) => c.name === 'arena_session')!.value}`;
    const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

    const overview = (await get('/api/admin/overview')).json() as { registered: number; newToday: number; online: unknown[] };
    expect(overview.registered).toBe(4);
    expect(overview.newToday).toBe(4);
    expect(overview.online).toEqual([]); // no live connections in this test

    const list = (await get('/api/admin/players')).json() as { total: number; players: { displayName: string; characters: number; level: number }[] };
    expect(list.total).toBe(4);
    expect(list.players[0]).toMatchObject({ displayName: 'Alpha', characters: 2, level: 1 });
    const found = (await get('/api/admin/players?q=alp')).json() as { total: number; players: { email: string }[] };
    expect(found.total).toBe(1);
    expect(found.players[0]!.email).toBe('alpha@example.com');
  });

  it("shows a player's account: characters and loadouts, level, wallet, inventory, team and progress", async () => {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'boss2@example.com', password: 'password123' } });
    const cookie = `arena_session=${login.cookies.find((c) => c.name === 'arena_session')!.value}`;
    const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
    const p = await account('beta@example.com', 'Beta');
    for (let i = 0; i < 3; i++) await p.call('POST', '/api/characters/roll');

    const res = await get(`/api/admin/players/${p.userId}`);
    expect(res.statusCode).toBe(200);
    const d = res.json() as {
      account: { displayName: string; email: string };
      progress: { level: number; unopenedBoxes: number };
      wallet: { gold: number };
      characters: { id: string; name: string; skills: unknown[]; resolved: { skills: unknown[] } }[];
      team: string[];
      inventory: unknown[];
      story: { cleared: number };
      recentMatches: unknown[];
    };
    expect(d.account).toMatchObject({ displayName: 'Beta', email: 'beta@example.com' });
    expect(d.progress.level).toBe(1);
    expect(d.characters).toHaveLength(3);
    expect(d.characters[0]!.resolved.skills.length).toBeGreaterThan(0);
    expect(d.team).toHaveLength(3);
    expect(d.wallet.gold).toBe(content.economy.currencies.gold!.start - 3 * content.economy.roll.cost.gold!);
    expect(d.story.cleared).toBe(0);
    expect((await get('/api/admin/players/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
  });
});
