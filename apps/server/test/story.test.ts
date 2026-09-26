// Story attempts: issued by the server, played "in the browser" (here by bots), verified by replay.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { encounterBot, normalBot, playMatch } from '@arena/ai';
import type { MatchConfig } from '@arena/engine';
import { singlePlayerBotSeed } from '@arena/meta';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 900;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: 'Hero' } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  return { call };
}

/** Plays an attempt like the client would: our side by a bot, the enemy by the encounter's own AI. */
function play(encounter: string, config: MatchConfig, humanSeed: number) {
  const enc = content.encounters[encounter]!;
  return playMatch(content, config, [normalBot(humanSeed), encounterBot(enc, singlePlayerBotSeed(config.seed))]);
}

async function winEncounter(a: Awaited<ReturnType<typeof account>>, encounter: string) {
  for (let tries = 0; tries < 6; tries++) {
    const start = (await a.call('POST', `/api/story/${encounter}/start`)).json();
    const played = play(encounter, start.config, tries);
    if (played.state.result?.winner !== 0) continue;
    const res = await a.call('POST', `/api/story/attempts/${start.attemptId}/finish`, { commands: played.record.commands });
    expect(res.statusCode).toBe(200);
    return { start, played, body: res.json() };
  }
  throw new Error(`Couldn't win ${encounter}`);
}

describe('story', () => {
  it('opens with the first encounter only', async () => {
    const a = await account('story1@example.com');
    const story = (await a.call('GET', '/api/story')).json();
    expect(story.chapters[0].encounters.map((e: { unlocked: boolean }) => e.unlocked)).toEqual([true, false, false]);
    expect((await a.call('POST', '/api/story/embers_2/start')).statusCode).toBe(403);
  });

  it('a verified win pays the first-clear reward, unlocks the next encounter and counts achievements', async () => {
    const a = await account('story2@example.com');
    const { body } = await winEncounter(a, 'embers_1');
    expect(body.outcome).toBe('win');
    expect(body.reward).toEqual({ currency: { gold: 50 }, items: [] });
    expect(body.chapters[0].encounters[1].unlocked).toBe(true);
    expect(body.achievements.map((x: { id: string }) => x.id)).toContain('first_victory');
    const fromAchievements = body.achievements.reduce((n: number, x: { reward: { currency: { gold?: number } } }) => n + (x.reward.currency.gold ?? 0), 0);
    expect(body.wallet.gold).toBe(300 + 50 + fromAchievements); // first-clear reward + First Victory (+ Quick Work)

    const again = await winEncounter(a, 'embers_1');
    expect(again.body.reward).toEqual({ currency: { gold: 10 }, items: [] }); // repeat reward
    const ach = (await a.call('GET', '/api/achievements')).json().achievements as { id: string; done: boolean }[];
    expect(ach.find((x) => x.id === 'first_victory')?.done).toBe(true);
  }, 60_000);

  it('refuses resubmissions, unfinished or tampered replays', async () => {
    const a = await account('story3@example.com');
    const { start, played } = await winEncounter(a, 'embers_1');
    const resubmit = await a.call('POST', `/api/story/attempts/${start.attemptId}/finish`, { commands: played.record.commands });
    expect(resubmit.statusCode).toBe(409);

    const fresh = (await a.call('POST', '/api/story/embers_1/start')).json();
    const game = play('embers_1', fresh.config, 1);
    const cut = game.record.commands.slice(0, Math.floor(game.record.commands.length / 2));
    expect((await a.call('POST', `/api/story/attempts/${fresh.attemptId}/finish`, { commands: cut })).statusCode).toBe(400);
    // Another attempt's winning commands don't fit this attempt's seed and teams.
    const other = (await a.call('POST', '/api/story/embers_1/start')).json();
    const forged = await a.call('POST', `/api/story/attempts/${other.attemptId}/finish`, { commands: played.record.commands });
    expect(forged.statusCode === 400 || forged.json().outcome !== 'win').toBe(true);
  }, 60_000);

  it('finishing the tutorial pays its lessons, then a free character and a crystal', async () => {
    const a = await account('tutorial@example.com');
    const before = (await a.call('GET', '/api/characters')).json().characters.length;
    await winEncounter(a, 'tutorial_1');
    await winEncounter(a, 'tutorial_2');
    const last = await winEncounter(a, 'tutorial_3');
    expect(last.body.chapterComplete).toBe('tutorial');
    expect(last.body.characters).toHaveLength(1);
    expect(last.body.reward.items).toEqual(['fire_shard', 'fire_crystal']);
    expect((await a.call('GET', '/api/characters')).json().characters.length).toBe(before + 1);
    // Tutorial wins count as 'tutorial' matches for achievements (First Victory counts any mode).
    const ach = (await a.call('GET', '/api/achievements')).json().achievements as { id: string; done: boolean }[];
    expect(ach.find((x) => x.id === 'first_victory')?.done).toBe(true);
  }, 60_000);

  it('a surrender is a recorded loss that pays nothing', async () => {
    const a = await account('story4@example.com');
    const start = (await a.call('POST', '/api/story/embers_1/start')).json();
    const res = await a.call('POST', `/api/story/attempts/${start.attemptId}/finish`, { commands: [{ player: 0, cmd: { t: 'surrender' } }] });
    expect(res.json()).toMatchObject({ outcome: 'loss', reward: { currency: {}, items: [] } });
    expect(res.json().chapters[0].encounters[1].unlocked).toBe(false);
  });
});
