// Player levels and loot boxes (decided 2026-10-05): finished matches pay experience with their other
// rewards; reaching a bubble on the bar (25, 50, 75, 100%) stores a loot box; opening one pays its three
// rolls (gold, or gear into the inventory), once.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { botFor, normalBot, playMatch } from '@arena/ai';
import type { MatchConfig } from '@arena/engine';
import { matchXp, singlePlayerBotSeed, xpForLevel, type LootRoll } from '@arena/meta';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { awardXp } from '../src/progression.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 4200;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

interface Progress {
  level: number;
  xp: number;
  needed: number;
  total: number;
  boxes: { id: string; box: string; level: number; at: number }[];
}

async function account(email: string, recruits = 0) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: 'Climber' } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const userId = (res.json() as { user: { id: string } }).user.id;
  for (let i = 0; i < recruits; i++) await app.inject({ method: 'POST', url: '/api/characters/roll', headers: { cookie } });
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const progress = async () => (await call('GET', '/api/progress')).json() as Progress;
  return { userId, call, progress };
}

describe('experience', () => {
  it('starts at level 1 with an empty bar and no boxes', async () => {
    const a = await account('fresh@example.com');
    expect(await a.progress()).toEqual({ level: 1, xp: 0, needed: xpForLevel(content, 1), total: 0, boxes: [] });
  });

  it('is paid by a finished match, with the rest of its reward', async () => {
    const a = await account('xp@example.com', 3);
    const start = (await a.call('POST', '/api/practice/start', { bot: 'easy' })).json() as { attemptId: string; config: MatchConfig };
    const played = playMatch(content, start.config, [normalBot(3), botFor('easy', singlePlayerBotSeed(start.config.seed))]);
    const body = (await a.call('POST', `/api/practice/attempts/${start.attemptId}/finish`, { commands: played.record.commands })).json() as {
      outcome: 'win' | 'loss' | 'draw';
      turns: number;
      reward: { xp?: { gained: number; after: { total: number } } };
    };
    const expected = matchXp(content, { kind: 'practice', outcome: body.outcome, endReason: played.state.result!.reason, turns: body.turns });
    expect(expected).toBeGreaterThan(0);
    expect(body.reward.xp).toMatchObject({ gained: expected, after: { total: expected } });
    expect((await a.progress()).total).toBe(expected);
  });
});

describe('loot boxes', () => {
  it('are paid at each bubble on the bar: uncommon, rare, uncommon, then epic for the level-up', async () => {
    const a = await account('bubbles@example.com');
    const n = xpForLevel(content, 1);
    const gain = await awardXp(dbh.db, content, a.userId, n);
    expect(gain).toMatchObject({ gained: n, levelsGained: 1, boxes: ['uncommon', 'rare', 'uncommon', 'epic'] });
    const p = await a.progress();
    expect(p).toMatchObject({ level: 2, xp: 0, total: n });
    expect(p.boxes.map((b) => [b.box, b.level, b.at])).toEqual([
      ['uncommon', 1, 25],
      ['rare', 1, 50],
      ['uncommon', 1, 75],
      ['epic', 1, 100],
    ]);
    // Small steps pay nothing until the next bubble.
    await awardXp(dbh.db, content, a.userId, 1);
    expect((await a.progress()).boxes).toHaveLength(4);
  });

  it('open into three rolls that are paid out: gold to the wallet, gear to the inventory', async () => {
    const a = await account('open@example.com');
    await awardXp(dbh.db, content, a.userId, xpForLevel(content, 1));
    const boxes = (await a.progress()).boxes;
    const goldBefore = ((await a.call('GET', '/api/wallet')).json() as { wallet: { gold: number } }).wallet.gold;
    const rolls: LootRoll[] = [];
    for (const b of boxes) {
      const res = await a.call('POST', `/api/loot-boxes/${b.id}/open`);
      expect(res.statusCode).toBe(200);
      const body = res.json() as { box: string; rolls: LootRoll[]; progress: Progress };
      expect(body.box).toBe(b.box);
      expect(body.rolls).toHaveLength(3);
      rolls.push(...body.rolls);
    }
    const gold = rolls.reduce((n, r) => n + (r.kind === 'gold' ? (r.currency.gold ?? 0) : 0), 0);
    const wallet = ((await a.call('GET', '/api/wallet')).json() as { wallet: { gold: number } }).wallet.gold;
    expect(wallet).toBe(goldBefore + gold);
    const items = ((await a.call('GET', '/api/inventory')).json() as { items: { itemId: string; source: string }[] }).items;
    const gear = rolls.filter((r) => r.kind === 'gear').map((r) => r.item);
    expect(items.filter((i) => i.source.startsWith('lootbox:')).map((i) => i.itemId).sort()).toEqual([...gear].sort());
    expect((await a.progress()).boxes).toEqual([]);
  });

  it('open only once, and only for their owner', async () => {
    const a = await account('once@example.com');
    const b = await account('thief@example.com');
    await awardXp(dbh.db, content, a.userId, Math.ceil(xpForLevel(content, 1) / 4));
    const [box] = (await a.progress()).boxes;
    expect((await b.call('POST', `/api/loot-boxes/${box!.id}/open`)).statusCode).toBe(404);
    expect((await a.call('POST', `/api/loot-boxes/${box!.id}/open`)).statusCode).toBe(200);
    expect((await a.call('POST', `/api/loot-boxes/${box!.id}/open`)).statusCode).toBe(409);
  });
});
