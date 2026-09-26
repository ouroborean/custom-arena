import { describe, expect, it } from 'vitest';
import { DEFAULT_RATING, rateMatch, updateRating } from '../src/index.js';

describe('Glicko-2', () => {
  it("matches Glickman's worked example", () => {
    const r = updateRating({ rating: 1500, rd: 200, vol: 0.06 }, [
      { opponent: { rating: 1400, rd: 30 }, score: 1 },
      { opponent: { rating: 1550, rd: 100 }, score: 0 },
      { opponent: { rating: 1700, rd: 300 }, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('a win raises the winner and lowers the loser; RD shrinks', () => {
    const [a, b] = rateMatch(DEFAULT_RATING, DEFAULT_RATING, 1);
    expect(a.rating).toBeGreaterThan(1500);
    expect(b.rating).toBeLessThan(1500);
    expect(a.rating - 1500).toBeCloseTo(1500 - b.rating, 6);
    expect(a.rd).toBeLessThan(350);
  });

  it('a draw between equals changes nothing but RD', () => {
    const [a] = rateMatch(DEFAULT_RATING, DEFAULT_RATING, 0.5);
    expect(a.rating).toBeCloseTo(1500, 6);
  });

  it('upsets move ratings more than expected wins', () => {
    const strong = { rating: 1800, rd: 80, vol: 0.06 };
    const weak = { rating: 1400, rd: 80, vol: 0.06 };
    const expected = rateMatch(strong, weak, 1)[0].rating - 1800;
    const upset = rateMatch(weak, strong, 1)[0].rating - 1400;
    expect(upset).toBeGreaterThan(expected * 3);
  });
});
