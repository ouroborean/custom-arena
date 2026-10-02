// Practice against a bot: issued by the server, played "in the browser" (here by bots on both sides),
// verified by replay, and paid from the economy's `practice` rewards.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { botFor, normalBot, playMatch } from '@arena/ai';
import type { MatchConfig } from '@arena/engine';
import { singlePlayerBotSeed } from '@arena/meta';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';

const content = loadContentOrThrow();
const practice = content.economy.rewards.practice!;
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 1300;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: 'Trainee' } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  // Three recruits make the active team.
  for (let i = 0; i < 3; i++) await app.inject({ method: 'POST', url: '/api/characters/roll', headers: { cookie } });
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const gold = async () => (await call('GET', '/api/wallet')).json().wallet.gold as number;
  return { call, gold };
}

/** Plays a practice match like the client would: our seat by a bot standing in for the player. */
function play(config: MatchConfig, seat: 0 | 1, bot: 'easy' | 'normal' | 'hard', humanSeed: number) {
  const ai = botFor(bot, singlePlayerBotSeed(config.seed));
  const human = normalBot(humanSeed);
  return playMatch(content, config, seat === 0 ? [human, ai] : [ai, human]);
}

describe('practice against a bot', () => {
  it('issues your active team against a bot team, in the seat you chose', async () => {
    const a = await account('seat@example.com');
    const team = (await a.call('GET', '/api/teams/active/specs')).json().specs as { name: string }[];
    for (const seat of [0, 1] as const) {
      const res = await a.call('POST', '/api/practice/start', { bot: 'easy', seat });
      expect(res.statusCode).toBe(201);
      const config = res.json().config as MatchConfig;
      expect(config.teams[seat].map((c) => c.name)).toEqual(team.map((c) => c.name));
      expect(config.teams[seat === 0 ? 1 : 0].every((c) => c.name.startsWith('Bot '))).toBe(true);
    }
  });

  it("pays the practice rewards for the server's own replay of the result, once", async () => {
    const a = await account('practice@example.com');
    const before = await a.gold();
    const start = (await a.call('POST', '/api/practice/start', { bot: 'easy', seat: 1 })).json() as { attemptId: string; config: MatchConfig };
    const played = play(start.config, 1, 'easy', 7);
    const res = await a.call('POST', `/api/practice/attempts/${start.attemptId}/finish`, { commands: played.record.commands });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      outcome: 'win' | 'loss' | 'draw';
      turns: number;
      reward: { currency: { gold?: number }; items: string[] };
      achievements: { reward: { currency: { gold?: number } } }[];
    };
    const w = played.state.result!.winner;
    expect(body.outcome).toBe(w === null ? 'draw' : w === 1 ? 'win' : 'loss');
    const expected = body.turns < practice.minTurns ? 0 : (practice[body.outcome].currency?.gold ?? 0);
    expect(body.reward.currency.gold ?? 0).toBe(expected);
    const fromAchievements = body.achievements.reduce((n, x) => n + (x.reward.currency.gold ?? 0), 0); // a first win counts for First Victory
    expect(await a.gold()).toBe(before + expected + fromAchievements);
    if (body.outcome !== 'win') expect(body.reward.items).toEqual([]);
    expect(body.reward.items.length).toBeLessThanOrEqual(1);
    const again = await a.call('POST', `/api/practice/attempts/${start.attemptId}/finish`, { commands: played.record.commands });
    expect(again.statusCode).toBe(409);
  }, 60_000);

  it('a surrender pays nothing, and tampered or unfinished replays are refused', async () => {
    const a = await account('quitter@example.com');
    const before = await a.gold();
    const start = (await a.call('POST', '/api/practice/start', { bot: 'easy', seat: 0 })).json() as { attemptId: string; config: MatchConfig };
    const quit = await a.call('POST', `/api/practice/attempts/${start.attemptId}/finish`, { commands: [{ player: 0, cmd: { t: 'surrender' } }] });
    expect(quit.statusCode).toBe(200);
    expect(quit.json().outcome).toBe('loss');
    expect(quit.json().reward).toEqual({ currency: {}, items: [] });
    expect(await a.gold()).toBe(before);

    const fresh = (await a.call('POST', '/api/practice/start', { bot: 'easy', seat: 0 })).json() as { attemptId: string; config: MatchConfig };
    expect((await a.call('POST', `/api/practice/attempts/${fresh.attemptId}/finish`, { commands: [] })).statusCode).toBe(400);
  });
});
