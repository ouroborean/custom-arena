// Phase 1 exit criteria: bot-vs-bot matches run to completion, never break invariants, never leak
// hidden information, and replay byte-for-byte.

import { describe, expect, it } from 'vitest';
import {
  COLORS,
  replay,
  stateFingerprint,
  viewFor,
  type ContentBundle,
  type GameState,
} from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { greedyBot, playMatch, randomBot, randomConfig } from '../src/index.js';

const content: ContentBundle = loadContentOrThrow();

function checkInvariants(s: GameState): void {
  for (const p of s.players) for (const c of COLORS) expect(p.energy[c]).toBeGreaterThanOrEqual(0);
  for (const u of s.units) {
    expect(u.hp).toBeLessThanOrEqual(u.maxHp);
    if (u.alive) expect(u.hp).toBeGreaterThan(0);
    for (const slot of u.skills) expect(slot.cooldown).toBeGreaterThanOrEqual(0);
  }
  for (const e of s.effects) {
    expect(s.units.find((u) => u.id === e.bearer)?.alive).toBe(true);
    if (e.duration !== null) expect(e.duration).toBeGreaterThan(0);
  }
  // No unrevealed Invisible effect of one side ever shows up in the other side's view.
  for (const viewer of [0, 1] as const) {
    for (const e of viewFor(content, s, viewer).effects) {
      const def = e.inline ?? content.statuses[e.defId];
      if (def?.visibility === 'hidden' && !e.revealed) expect(e.sourceOwner).toBe(viewer);
    }
  }
}

describe('bot vs bot simulation', () => {
  it('random bots: 150 matches finish without errors or broken invariants', () => {
    const results = { 0: 0, 1: 0, draw: 0 };
    for (let seed = 1; seed <= 150; seed++) {
      const { state } = playMatch(content, randomConfig(content, seed), [randomBot(seed), randomBot(seed + 1000)], {
        onStep: (s) => checkInvariants(s),
      });
      expect(state.phase).toBe('finished');
      const w = state.result!.winner;
      results[w === null ? 'draw' : w] += 1;
    }
    expect(results[0] + results[1] + results.draw).toBe(150);
  }, 120_000);

  it('greedy bots beat random bots most of the time', () => {
    let greedyWins = 0;
    const n = 60;
    for (let seed = 1; seed <= n; seed++) {
      const greedyFirst = seed % 2 === 0;
      const bots = greedyFirst ? ([greedyBot(seed), randomBot(seed)] as const) : ([randomBot(seed), greedyBot(seed)] as const);
      const { state } = playMatch(content, randomConfig(content, seed), [bots[0], bots[1]]);
      if (state.result?.winner === (greedyFirst ? 0 : 1)) greedyWins += 1;
    }
    expect(greedyWins / n).toBeGreaterThan(0.6);
  }, 60_000);
});

describe('determinism (GDD §11.8)', () => {
  it('replaying a recorded match reproduces the exact final state and event log', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const played = playMatch(content, randomConfig(content, seed), [greedyBot(seed), randomBot(seed)]);
      const again = replay(content, JSON.parse(JSON.stringify(played.record)));
      expect(stateFingerprint(again.state)).toBe(stateFingerprint(played.state));
      expect(JSON.stringify(again.events)).toBe(JSON.stringify(played.events));
    }
  }, 60_000);

  it('the same seed and commands always give the same match; different seeds differ', () => {
    const a = playMatch(content, randomConfig(content, 99), [greedyBot(1), greedyBot(2)]);
    const b = playMatch(content, randomConfig(content, 99), [greedyBot(1), greedyBot(2)]);
    const c = playMatch(content, randomConfig(content, 100), [greedyBot(1), greedyBot(2)]);
    expect(stateFingerprint(a.state)).toBe(stateFingerprint(b.state));
    expect(stateFingerprint(a.state)).not.toBe(stateFingerprint(c.state));
  });
});
