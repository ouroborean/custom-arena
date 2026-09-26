import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/match/clock.js';
import { BAND, bandAfter, Matchmaker, type QueueEntry } from '../src/match/matchmaker.js';

const entry = (userId: string, rating: number, mode: 'casual' | 'ranked' = 'ranked') => ({
  userId,
  displayName: userId,
  mode,
  rating,
  specs: [],
});

describe('Matchmaker', () => {
  it('pairs close ratings at once, and distant ones once the band has widened', () => {
    const clock = new FakeClock();
    const pairs: [QueueEntry, QueueEntry][] = [];
    const mm = new Matchmaker(clock, (a, b) => pairs.push([a, b]));
    mm.join(entry('a', 1500));
    mm.join(entry('b', 1800)); // 300 apart: needs (300 − 100) / 10 = 20 s
    clock.advance(1000);
    expect(pairs).toHaveLength(0);
    clock.advance(19_000);
    expect(pairs).toHaveLength(1);
    expect(mm.size).toBe(0);
  });

  it('prefers the closest rating and never mixes modes', () => {
    const clock = new FakeClock();
    const pairs: string[][] = [];
    const mm = new Matchmaker(clock, (a, b) => pairs.push([a.userId, b.userId].sort()));
    mm.join(entry('a', 1500));
    mm.join(entry('far', 1590));
    mm.join(entry('near', 1510));
    mm.join(entry('casual', 1500, 'casual'));
    clock.advance(1000);
    expect(pairs).toEqual([['a', 'near']]);
    expect(mm.has('casual')).toBe(true);
  });

  it('the band is capped', () => {
    expect(bandAfter(0)).toBe(BAND.base);
    expect(bandAfter(10 * 60_000)).toBe(BAND.max);
  });
});
