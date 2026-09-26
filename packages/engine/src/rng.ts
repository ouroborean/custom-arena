// Seeded PRNG (sfc32, seeded through splitmix32). All randomness in the engine flows through
// state.rng, drawn in a documented order, so matches replay exactly (GDD §11.8).

import type { RngState } from './types.js';

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function seedRng(seed: number): RngState {
  const next = splitmix32(seed);
  return { a: next(), b: next(), c: next(), d: next() };
}

/** Advances the state in place and returns a uint32. */
export function nextU32(rng: RngState): number {
  const t = (((rng.a + rng.b) >>> 0) + rng.d) >>> 0;
  rng.d = (rng.d + 1) >>> 0;
  rng.a = (rng.b ^ (rng.b >>> 9)) >>> 0;
  rng.b = (rng.c + (rng.c << 3)) >>> 0;
  rng.c = ((rng.c << 21) | (rng.c >>> 11)) >>> 0;
  rng.c = (rng.c + t) >>> 0;
  return t;
}

/** Uniform integer in [0, n). */
export function nextInt(rng: RngState, n: number): number {
  if (n <= 0) throw new Error('nextInt: n must be positive');
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x100000000 / n) * n;
  let x = nextU32(rng);
  while (x >= limit) x = nextU32(rng);
  return x % n;
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  const item = items[nextInt(rng, items.length)];
  if (item === undefined) throw new Error('pick: empty list');
  return item;
}

/** Picks `count` distinct items, in draw order. */
export function sample<T>(rng: RngState, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const i = nextInt(rng, pool.length);
    out.push(pool.splice(i, 1)[0] as T);
  }
  return out;
}
