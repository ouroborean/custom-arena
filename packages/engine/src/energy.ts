// Energy math: cost parsing, reservation feasibility (GDD §3.4) and random-cost allocation.

import { COLORS, type Color, type Cost, type Energy } from './types.js';

export const ZERO_COST: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };

export function emptyEnergy(): Energy {
  return { S: 0, A: 0, I: 0, W: 0 };
}

/** Parses the sheet shorthand: "Sr" → {S:1, r:1}; "nc" / "" → no cost. "G" is GEN (= r). */
export function parseCost(text: string): Cost {
  const cost: Cost = { ...ZERO_COST };
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'nc') return cost;
  for (const ch of trimmed) {
    if (ch === 'S' || ch === 'A' || ch === 'I' || ch === 'W') cost[ch] += 1;
    else if (ch === 'r' || ch === 'G') cost.r += 1;
    else throw new Error(`Unknown cost symbol "${ch}" in "${text}"`);
  }
  return cost;
}

export function formatCost(cost: Cost): string {
  const parts = COLORS.flatMap((c) => Array<string>(cost[c]).fill(c));
  parts.push(...Array<string>(cost.r).fill('r'));
  return parts.length ? parts.join('') : 'nc';
}

export function costTotal(cost: Cost): number {
  return cost.S + cost.A + cost.I + cost.W + cost.r;
}

export function addCosts(a: Cost, b: Cost): Cost {
  return { S: a.S + b.S, A: a.A + b.A, I: a.I + b.I, W: a.W + b.W, r: a.r + b.r };
}

export function sumCosts(costs: readonly Cost[]): Cost {
  return costs.reduce(addCosts, { ...ZERO_COST });
}

export function energyTotal(e: Energy): number {
  return e.S + e.A + e.I + e.W;
}

/** Applies a net GEN modifier: positive adds r; negative reduces r only, never below 0 (Q8). */
export function applyGenericModifier(cost: Cost, delta: number): Cost {
  return { ...cost, r: Math.max(0, cost.r + delta) };
}

/**
 * A set of reserved costs is payable iff every specific color fits in the pool and the grand total
 * fits in the total pool. Because r is a pure wildcard, no search is needed.
 */
export function isPayable(pool: Energy, reserved: Cost): boolean {
  for (const c of COLORS) if (reserved[c] > pool[c]) return false;
  return costTotal(reserved) <= energyTotal(pool);
}

/** Checks that `allocation` pays exactly `reserved.r` using energy left after specific costs. */
export function isValidAllocation(pool: Energy, reserved: Cost, allocation: Energy): boolean {
  let total = 0;
  for (const c of COLORS) {
    const a = allocation[c];
    if (!Number.isInteger(a) || a < 0) return false;
    if (reserved[c] + a > pool[c]) return false;
    total += a;
  }
  return total === reserved.r;
}

/** Default allocation: pay r from whichever colors have the most left over (ties: S, A, I, W). */
export function autoAllocate(pool: Energy, reserved: Cost): Energy {
  const left: Energy = { S: pool.S - reserved.S, A: pool.A - reserved.A, I: pool.I - reserved.I, W: pool.W - reserved.W };
  const alloc = emptyEnergy();
  for (let i = 0; i < reserved.r; i++) {
    let best: Color | null = null;
    for (const c of COLORS) if (left[c] > 0 && (best === null || left[c] > left[best])) best = c;
    if (best === null) throw new Error('autoAllocate: reservation is not payable');
    left[best] -= 1;
    alloc[best] += 1;
  }
  return alloc;
}
