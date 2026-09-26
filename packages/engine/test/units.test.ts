import { describe, expect, it } from 'vitest';
import {
  autoAllocate,
  compileDuration,
  isPayable,
  isValidAllocation,
  nextInt,
  parseCost,
  seedRng,
  sumCosts,
} from '../src/index.js';

describe('rng', () => {
  it('is deterministic per seed and in range', () => {
    const a = seedRng(42);
    const b = seedRng(42);
    const xs = Array.from({ length: 50 }, () => nextInt(a, 4));
    const ys = Array.from({ length: 50 }, () => nextInt(b, 4));
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 4)).toBe(true);
    expect(new Set(xs).size).toBe(4);
    expect(Array.from({ length: 5 }, () => nextInt(seedRng(1), 1000))).not.toEqual(
      Array.from({ length: 5 }, () => nextInt(seedRng(2), 1000)),
    );
  });
});

describe('costs and energy (GDD §3.4)', () => {
  it('parses sheet shorthand', () => {
    expect(parseCost('Sr')).toEqual({ S: 1, A: 0, I: 0, W: 0, r: 1 });
    expect(parseCost('Wrr')).toEqual({ S: 0, A: 0, I: 0, W: 1, r: 2 });
    expect(parseCost('nc')).toEqual({ S: 0, A: 0, I: 0, W: 0, r: 0 });
    expect(parseCost('G')).toEqual({ S: 0, A: 0, I: 0, W: 0, r: 1 });
    expect(() => parseCost('X')).toThrow();
  });

  it('checks reservations with the closed-form rule', () => {
    const pool = { S: 1, A: 1, I: 0, W: 0 };
    expect(isPayable(pool, sumCosts([parseCost('S'), parseCost('r')]))).toBe(true);
    expect(isPayable(pool, sumCosts([parseCost('S'), parseCost('rr')]))).toBe(false);
    expect(isPayable(pool, parseCost('I'))).toBe(false);
    expect(isPayable(pool, parseCost('SS'))).toBe(false);
  });

  it('allocates random costs from the most plentiful leftover colors', () => {
    const pool = { S: 3, A: 1, I: 2, W: 0 };
    const reserved = parseCost('Srr');
    const alloc = autoAllocate(pool, reserved);
    expect(alloc).toEqual({ S: 1, A: 0, I: 1, W: 0 });
    expect(isValidAllocation(pool, reserved, alloc)).toBe(true);
    expect(isValidAllocation(pool, reserved, { S: 0, A: 0, I: 0, W: 2 })).toBe(false);
    expect(isValidAllocation(pool, reserved, { S: 1, A: 0, I: 0, W: 0 })).toBe(false);
  });
});

describe('duration compilation (GDD §3.8, Q1)', () => {
  it('applied on the applier’s own turn', () => {
    expect(compileDuration({ thisTurn: true }, 0, 0)).toBe(1);
    expect(compileDuration({ enemyTurns: 1 }, 0, 0)).toBe(2);
    expect(compileDuration({ ownTurns: 1 }, 0, 0)).toBe(3);
    expect(compileDuration({ enemyTurns: 3 }, 0, 0)).toBe(6);
    expect(compileDuration('permanent', 0, 0)).toBeNull();
    expect(compileDuration(undefined, 0, 0)).toBeNull();
  });

  it('applied during the opponent’s turn (R2)', () => {
    expect(compileDuration({ enemyTurns: 1 }, 0, 1)).toBe(3);
    expect(compileDuration({ ownTurns: 1 }, 0, 1)).toBe(2);
    expect(compileDuration({ thisTurn: true }, 0, 1)).toBe(1);
  });
});
