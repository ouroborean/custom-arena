// Difficulty tiers (GDD §11.9): Easy, Normal and Hard play legal, complete matches from their
// views alone, and Normal clearly beats the old greedy bot.

import { describe, expect, it } from 'vitest';
import { viewFor, type ContentBundle } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { createMatch, seedRng } from '@arena/engine';
import { botFor, determinize, easyBot, evaluate, greedyBot, hardBot, normalBot, playMatch, randomConfig, type Bot } from '../src/index.js';

const content: ContentBundle = loadContentOrThrow();

function duel(a: (s: number) => Bot, b: (s: number) => Bot, seeds: number[]): number {
  let wins = 0;
  for (const seed of seeds) {
    const aFirst = seed % 2 === 0;
    const bots: [Bot, Bot] = aFirst ? [a(seed), b(seed + 500)] : [b(seed + 500), a(seed)];
    const { state } = playMatch(content, randomConfig(content, seed), bots);
    expect(state.phase).toBe('finished');
    if (state.result!.winner === (aFirst ? 0 : 1)) wins++;
  }
  return wins;
}

describe('difficulty tiers', () => {
  it('Easy and Hard finish matches against Normal without illegal commands', () => {
    duel(easyBot, normalBot, [1, 2, 3]);
    duel(hardBot, normalBot, [4, 5]);
  }, 60_000);

  it('Normal beats the greedy bot most of the time', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(duel(normalBot, greedyBot, seeds)).toBeGreaterThanOrEqual(20);
  }, 60_000);

  it('botFor maps difficulty names to tiers', () => {
    expect(['easy', 'normal', 'hard'].map((d) => botFor(d as 'easy', 1).name)).toEqual(['easy', 'normal', 'hard']);
  });

  it('determinizing a view never brings back what the view hides', () => {
    const { state } = createMatch(content, randomConfig(content, 9));
    // Give the opponent a hidden effect: it must not appear in our guessed world.
    state.effects.push({
      id: 'hidden1',
      defId: 'trap',
      source: 'p1c0',
      sourceOwner: 1,
      bearer: 'p0c0',
      stacks: 1,
      value: 15,
      duration: 4,
      targets: [],
      revealed: false,
      data: {},
      seq: 999,
    });
    const world = determinize(viewFor(content, state, 0), seedRng(3));
    expect(world.effects.some((e) => e.id === 'hidden1')).toBe(false);
    expect(Number.isFinite(evaluate(content, world, 0))).toBe(true);
  });
});
