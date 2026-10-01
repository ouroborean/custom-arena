import { describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { checkSchedule, earlierSeasons, nextSeason, seasonAt, seasonEnded, seasonTier, softReset, type SeasonSchedule } from '../src/index.js';

const content = loadContentOrThrow();
const schedule: SeasonSchedule = {
  seasons: [
    { id: 'ranked-s1', name: 'Season 1', start: '2026-01-01T00:00:00Z', end: '2026-04-01T00:00:00Z' },
    { id: 'ranked-s2', name: 'Season 2', start: '2026-04-08T00:00:00Z', end: '2026-07-01T00:00:00Z' },
    { id: 'ranked-s3', name: 'Season 3', start: '2026-07-01T00:00:00Z' },
  ],
  softReset: { keep: 0.5, rd: 200 },
  minGames: 10,
  tiers: [
    { id: 'bronze', name: 'Bronze', min: 0, reward: { currency: { gold: 100 } } },
    { id: 'gold', name: 'Gold', min: 1400, reward: { currency: { gold: 400 } } },
  ],
};
const at = (iso: string) => Date.parse(iso);

describe('seasons', () => {
  it('finds the running season, the gap between two, and the next one', () => {
    expect(seasonAt(schedule, at('2026-02-01T00:00:00Z'))?.id).toBe('ranked-s1');
    expect(seasonAt(schedule, at('2026-04-01T00:00:00Z'))).toBeNull(); // the end is exclusive
    expect(nextSeason(schedule, at('2026-04-01T00:00:00Z'))?.id).toBe('ranked-s2');
    expect(seasonAt(schedule, at('2026-07-01T00:00:00Z'))?.id).toBe('ranked-s3');
    expect(seasonAt(schedule, at('2030-01-01T00:00:00Z'))?.id).toBe('ranked-s3'); // open-ended
    expect(seasonAt(schedule, at('2025-01-01T00:00:00Z'))).toBeNull();
    expect(earlierSeasons(schedule, 'ranked-s3').map((s) => s.id)).toEqual(['ranked-s2', 'ranked-s1']);
    expect(seasonEnded(schedule.seasons[0]!, at('2026-04-01T00:00:00Z'))).toBe(true);
    expect(seasonEnded(schedule.seasons[2]!, at('2030-01-01T00:00:00Z'))).toBe(false);
  });

  it('soft-resets toward 1500 and restores uncertainty', () => {
    expect(softReset({ rating: 1900, rd: 60, vol: 0.07 }, schedule.softReset)).toEqual({ rating: 1700, rd: 200, vol: 0.07 });
    expect(softReset({ rating: 1300, rd: 300, vol: 0.06 }, schedule.softReset)).toEqual({ rating: 1400, rd: 300, vol: 0.06 });
  });

  it('places final ratings in tiers by display rating once enough games are played', () => {
    expect(seasonTier(schedule, { rating: 1700, rd: 100, vol: 0.06, games: 9 })).toBeNull();
    expect(seasonTier(schedule, { rating: 1500, rd: 100, vol: 0.06, games: 10 })?.id).toBe('bronze'); // display 1300
    expect(seasonTier(schedule, { rating: 1700, rd: 100, vol: 0.06, games: 10 })?.id).toBe('gold'); // display 1500
    expect(seasonTier({ ...schedule, tiers: [{ id: 'x', name: 'X', min: 1000 }] }, { rating: 1100, rd: 100, vol: 0.06, games: 30 })).toBeNull();
  });

  it('checks schedules', () => {
    expect(checkSchedule(schedule, content)).toEqual([]);
    const bad: SeasonSchedule = {
      ...schedule,
      seasons: [
        { id: 'ranked-s1', name: 'A', start: '2026-01-01T00:00:00Z' },
        { id: 'ranked-s1', name: 'B', start: '2026-03-01T00:00:00Z', end: '2026-02-01T00:00:00Z' },
      ],
      tiers: [
        { id: 'a', name: 'A', min: 100, reward: { currency: { gems: 5 }, items: ['nope'] } },
        { id: 'b', name: 'B', min: 100 },
      ],
    };
    expect(checkSchedule(bad, content)).toEqual([
      'seasons[0] (ranked-s1): only the last season may leave out its end',
      'seasons[1] (ranked-s1): duplicate id',
      'seasons[1] (ranked-s1): ends before it starts',
      'tiers[0] (a): unknown currency gems',
      'tiers[0] (a): unknown item nope',
      "tiers[1] (b): min must be above a's",
    ]);
  });
});
