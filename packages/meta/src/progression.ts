// Player levels and loot boxes (docs/equipment.md §4.1): experience per match, the level curve, the
// bar's loot-box bubbles and what a box holds. Pure functions over the content's economy data; the
// server stores the results.

import { nextInt, pieceId, pieceProblems, PIECE_MAX_COMPONENTS, type ContentBundle, type CurrencyAmounts, type RngState } from '@arena/engine';
import { isForfeit, rollDrops, type Outcome } from './economy.js';

/** Where a total of experience puts the player. */
export interface LevelState {
  level: number;
  /** Experience into the current level. */
  xp: number;
  /** Experience the current level takes. */
  needed: number;
  total: number;
}

/** A bubble on the bar reached: the level it was on, its percent and the box it pays. */
export interface Milestone {
  level: number;
  at: number;
  box: string;
}

/** What one match's experience did: shown after the match. */
export interface XpGain {
  gained: number;
  /** The level reached, and how far into it. */
  after: LevelState;
  levelsGained: number;
  /** Loot boxes earned, by box id (uncommon, rare, epic). */
  boxes: string[];
}

/** Experience from `level` to the next. */
export function xpForLevel(content: ContentBundle, level: number): number {
  const l = content.economy.progression?.levels;
  if (!l) return Infinity;
  return Math.min(l.max, l.base + l.step * (Math.max(1, level) - 1));
}

export function levelOf(content: ContentBundle, total: number): LevelState {
  let level = 1;
  let rest = Math.max(0, total);
  for (;;) {
    const needed = xpForLevel(content, level);
    if (rest < needed) return { level, xp: rest, needed, total };
    rest -= needed;
    level++;
  }
}

/** Experience at which a level starts. */
function levelStart(content: ContentBundle, level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(content, l);
  return total;
}

/** The bubbles crossed going from `before` to `after` total experience, in order. */
export function milestonesBetween(content: ContentBundle, before: number, after: number): Milestone[] {
  const p = content.economy.progression;
  if (!p || after <= before) return [];
  const out: Milestone[] = [];
  for (let level = levelOf(content, before).level; level <= levelOf(content, after).level; level++) {
    const start = levelStart(content, level);
    const needed = xpForLevel(content, level);
    for (const m of p.milestones) {
      const at = start + Math.ceil((needed * m.at) / 100);
      if (before < at && at <= after) out.push({ level, at: m.at, box: m.box });
    }
  }
  return out;
}

export interface MatchXpInput {
  /** casual, ranked, practice, arcade, story or tutorial (kinds without an entry pay none). */
  kind: string;
  outcome: Outcome;
  endReason: string;
  turns: number;
}

/** The experience a finished match pays: like gold, none for forfeited losses or short matches. */
export function matchXp(content: ContentBundle, input: MatchXpInput): number {
  const r = content.economy.progression?.xp[input.kind];
  if (!r || input.turns < r.minTurns) return 0;
  if (input.outcome === 'loss' && isForfeit(input.endReason)) return 0;
  return r[input.outcome];
}

/** What adding `gained` to `before` total experience does. */
export function xpGain(content: ContentBundle, before: number, gained: number): XpGain {
  const after = levelOf(content, before + gained);
  return {
    gained,
    after,
    levelsGained: after.level - levelOf(content, before).level,
    boxes: milestonesBetween(content, before, before + gained).map((m) => m.box),
  };
}

// ---------------------------------------------------------------- loot boxes

/** One roll from a box: gold (the lowest), or a piece of gear of tier 1–3 (its component count). */
export type LootRoll = { kind: 'gold'; currency: CurrencyAmounts } | { kind: 'gear'; tier: 1 | 2 | 3; item: string };

/** Rolls a box's contents, lowest first: gold, then gear by tier. */
export function openLootBox(content: ContentBundle, boxId: string, rng: RngState): LootRoll[] {
  const box = content.economy.lootBoxes?.[boxId];
  const table = content.economy.progression?.table ?? 'standard';
  if (!box) throw new Error(`Unknown loot box "${boxId}"`);
  const rolls: LootRoll[] = [];
  for (let i = 0; i < box.count; i++) {
    const band = weighted(rng, [
      ['gold', box.bands.gold],
      ['gear', box.bands.gear],
      ['prize', box.bands.prize],
    ] as const);
    if (band === 'gold') {
      rolls.push({ kind: 'gold', currency: { gold: box.gold.min + nextInt(rng, box.gold.max - box.gold.min + 1) } });
    } else {
      const tier = band === 'prize' ? 3 : weighted(rng, [[1, box.gear['1']], [2, box.gear['2']]] as const);
      rolls.push({ kind: 'gear', tier, item: randomForgedPiece(content, table, tier, rng) });
    }
  }
  const rank = (r: LootRoll) => (r.kind === 'gold' ? 0 : r.tier);
  return rolls.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map(({ r }) => r);
}

/**
 * A legal piece of `size` components drawn from a drop table (at most one Sigil, no skill twice), in
 * the order drawn, so it's named as if forged in that order. A forged piece (2 or 3 components) is
 * built on a Skill, so it's always gear that grants something: a Skill first, then the table's draws.
 */
export function randomForgedPiece(content: ContentBundle, table: string, size: number, rng: RngState): string {
  const n = Math.max(1, Math.min(PIECE_MAX_COMPONENTS, size));
  const excluded = new Set(content.economy.dropTables[table]?.exclude ?? []);
  const skills = Object.values(content.items)
    .filter((i) => i.type === 'Skill' && !excluded.has(i.id))
    .map((i) => i.id)
    .sort();
  for (let attempt = 0; attempt < 100; attempt++) {
    const parts: string[] = n > 1 && skills.length ? [skills[nextInt(rng, skills.length)]!] : [];
    for (let tries = 0; parts.length < n && tries < 50; tries++) {
      const next = rollDrops(content, table, 1, rng)[0];
      if (next && pieceProblems(content, [...parts, next]).length === 0) parts.push(next);
    }
    if (parts.length === n) return pieceId(parts);
  }
  throw new Error(`Drop table "${table}" can't make a piece of ${n} components`);
}

function weighted<T>(rng: RngState, options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((n, [, w]) => n + Math.max(0, w), 0);
  let roll = nextInt(rng, Math.max(1, total));
  for (const [v, w] of options) if ((roll -= Math.max(0, w)) < 0) return v;
  return options[options.length - 1]![0];
}
