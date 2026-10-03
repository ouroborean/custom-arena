// Arcade mode: stages issued by the server, played "in the browser" (here by a bot standing in for the
// player), verified by replay, paid in full, and climbed one at a time until a loss ends the run.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { botFor, normalBot, playMatch } from '@arena/ai';
import type { MatchConfig } from '@arena/engine';
import { arcadeDef, singlePlayerBotSeed } from '@arena/meta';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { spAttempts } from '../src/db/schema.js';

const content = loadContentOrThrow();
const def = arcadeDef(content);
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 2600;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

interface Started {
  attemptId: string;
  stage: number;
  bot: 'easy' | 'normal' | 'hard';
  config: MatchConfig;
  resumed: boolean;
}

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: 'Climber' } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  for (let i = 0; i < 3; i++) await app.inject({ method: 'POST', url: '/api/characters/roll', headers: { cookie } });
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const gold = async () => (await call('GET', '/api/wallet')).json().wallet.gold as number;
  const items = async () => ((await call('GET', '/api/inventory')).json().items as unknown[]).length;
  const start = async () => (await call('POST', '/api/arcade/start')).json() as Started;
  const finish = (s: Started, commands: unknown) => call('POST', `/api/arcade/attempts/${s.attemptId}/finish`, { commands });
  /** Plays the stage with a bot in the player's seat and submits it. */
  const play = async (s: Started) => {
    const played = playMatch(content, s.config, [normalBot(s.stage * 7), botFor(s.bot, singlePlayerBotSeed(s.config.seed))]);
    return (await finish(s, played.record.commands)).json();
  };
  return { call, gold, items, start, finish, play };
}

describe('arcade mode', () => {
  it('starts at stage 1 against 2-skill enemies without infusions, and reissues an unfinished stage', async () => {
    const a = await account('arcade-start@example.com');
    expect((await a.call('GET', '/api/arcade')).json()).toMatchObject({ stage: 1, stages: def.stages.length, best: 0, dropsToday: 0 });
    const s = await a.start();
    expect(s).toMatchObject({ stage: 1, bot: def.stages[0]!.bot, resumed: false });
    for (const c of s.config.teams[1]) {
      expect(c.skills).toHaveLength(2);
      expect(c.skills.every((id) => content.skills[id]!.element === 'None')).toBe(true);
    }
    // Leaving and coming back gets the same stage, not a new roll of the enemies.
    const again = await a.start();
    expect(again).toMatchObject({ attemptId: s.attemptId, resumed: true, config: s.config });
  });

  it('a won stage pays its reward in full and moves the run up; a loss ends the run', async () => {
    const a = await account('arcade-climb@example.com');
    let gold = await a.gold();
    let items = await a.items();
    let climbed = 0;
    for (let tries = 0; tries < 12 && climbed < 2; tries++) {
      const s = await a.start();
      expect(s.stage).toBe(climbed + 1);
      const r = await a.play(s);
      const fromAchievements = (r.achievements as { reward: { currency: { gold?: number } } }[]).reduce((n, x) => n + (x.reward.currency.gold ?? 0), 0);
      const stage = def.stages[s.stage - 1]!;
      if (r.outcome === 'win') {
        expect(r.reward.currency.gold).toBe(stage.win.currency!.gold);
        expect(r.reward.items).toHaveLength(stage.win.drops!.count);
        climbed++;
        expect(r.arcade).toMatchObject({ stage: s.stage, ladderComplete: false, next: { stage: climbed + 1, best: climbed } });
      } else {
        expect(r.reward.items).toEqual([]);
        climbed = 0;
        expect(r.arcade.next.stage).toBe(1);
      }
      expect(await a.gold()).toBe(gold + (r.reward.currency.gold ?? 0) + fromAchievements);
      expect(await a.items()).toBe(items + r.reward.items.length);
      gold = await a.gold();
      items = await a.items();
    }
    expect(climbed).toBe(2);

    // Surrendering stage 3 ends the run, pays nothing, and the next run starts over.
    const s = await a.start();
    expect(s.stage).toBe(3);
    const quit = (await a.finish(s, [{ player: 0, cmd: { t: 'surrender' } }])).json();
    expect(quit).toMatchObject({ outcome: 'loss', reward: { currency: {}, items: [] }, arcade: { next: { stage: 1, best: 2 } } });
    expect((await a.start()).stage).toBe(1);
  }, 120_000);

  it('a stage is paid once, and tampered or unfinished replays are refused', async () => {
    const a = await account('arcade-honest@example.com');
    const s = await a.start();
    expect((await a.finish(s, [])).statusCode).toBe(400);
    expect((await a.finish(s, [{ player: 0, cmd: { t: 'surrender' } }])).statusCode).toBe(200);
    expect((await a.finish(s, [{ player: 0, cmd: { t: 'surrender' } }])).statusCode).toBe(409);
  });

  it('a stage issued before the game changed is voided: a new one is issued, and the run goes on', async () => {
    const a = await account('arcade-void@example.com');
    const first = await a.start();
    const won = await a.play(first);
    const next = won.outcome === 'win' ? 2 : 1;
    const stale = await a.start();
    await dbh.db.update(spAttempts).set({ contentVersion: 'old' }).where(eq(spAttempts.id, stale.attemptId));
    const fresh = await a.start();
    expect(fresh.attemptId).not.toBe(stale.attemptId);
    expect(fresh).toMatchObject({ stage: next, resumed: false });
    const [row] = await dbh.db.select().from(spAttempts).where(eq(spAttempts.id, stale.attemptId));
    expect(row!.outcome).toBe('void');
  }, 60_000);
});
