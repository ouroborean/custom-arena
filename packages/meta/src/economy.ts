// The economy's rules (GDD §8.4): wallets, match rewards, drops, forging and salvage, as pure
// functions over the content's economy data. The server stores the results.

import {
  describePiece,
  forgedId,
  forgeProblems,
  nextInt,
  pieceComponentIds,
  type ContentBundle,
  type CurrencyAmounts,
  type ItemDef,
  type RngState,
} from '@arena/engine';

export type Outcome = 'win' | 'loss' | 'draw';

export interface Reward {
  currency: CurrencyAmounts;
  /** Piece ids granted. */
  items: string[];
}

/** Losses that weren't played out: they never pay (no surrender or AFK farming). */
const FORFEITS = new Set(['surrender', 'disconnect', 'afk']);

export interface MatchRewardInput {
  /** Match kind: casual, ranked, private, … (kinds without rewards in the economy earn nothing). */
  kind: string;
  outcome: Outcome;
  endReason: string;
  /** Total turns played (both players'). */
  turns: number;
  /** Item drops the account has already had today. */
  dropsToday: number;
}

export function matchReward(content: ContentBundle, input: MatchRewardInput, rng: RngState): Reward {
  const r = content.economy.rewards[input.kind];
  if (!r || input.turns < r.minTurns) return { currency: {}, items: [] };
  if (input.outcome === 'loss' && FORFEITS.has(input.endReason)) return { currency: {}, items: [] };
  const spec = r[input.outcome];
  const cap = content.economy.dailyDropCap;
  // Each drop happens with the spec's chance (rolled even past the daily cap, so the rng use is stable).
  const chance = spec.drops?.chance ?? 1;
  let wanted = 0;
  for (let i = 0; i < (spec.drops?.count ?? 0); i++) if (chance >= 1 || nextInt(rng, 1000) < Math.round(chance * 1000)) wanted++;
  const count = cap > 0 ? Math.max(0, Math.min(wanted, cap - input.dropsToday)) : wanted;
  return {
    currency: { ...spec.currency },
    items: spec.drops && count > 0 ? rollDrops(content, spec.drops.table, count, rng) : [],
  };
}

/** Rolls `count` components: a type by the table's weights, then one of its components uniformly. */
export function rollDrops(content: ContentBundle, tableId: string, count: number, rng: RngState): string[] {
  const table = content.economy.dropTables[tableId];
  if (!table) throw new Error(`Unknown drop table "${tableId}"`);
  const excluded = new Set(table.exclude ?? []);
  const pools = Object.entries(table.types)
    .filter(([, w]) => (w ?? 0) > 0)
    .map(([type, w]) => ({ weight: w!, items: itemsOfType(content, type).filter((i) => !excluded.has(i.id)) }))
    .filter((p) => p.items.length > 0);
  const total = pools.reduce((n, p) => n + p.weight, 0);
  if (total === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let roll = nextInt(rng, total);
    const pool = pools.find((p) => (roll -= p.weight) < 0)!;
    out.push(pool.items[nextInt(rng, pool.items.length)]!.id);
  }
  return out;
}

/** Items of a type in a stable order (so seeded rolls are reproducible). */
function itemsOfType(content: ContentBundle, type: string): ItemDef[] {
  return Object.values(content.items)
    .filter((i) => i.type === type)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export type ForgeResult = { ok: true; piece: string; cost: CurrencyAmounts } | { ok: false; problems: string[] };

/**
 * Forging `addition` onto `base` (docs/equipment.md §6): the result keeps the base's components first,
 * so the base keeps its name and gains a prefix or suffix. Costs by the result's component count.
 */
export function forge(content: ContentBundle, base: string, addition: string): ForgeResult {
  const problems = forgeProblems(content, base, addition);
  if (problems.length) return { ok: false, problems };
  const piece = forgedId(base, addition);
  return { ok: true, piece, cost: { ...content.economy.forge.cost[String(pieceComponentIds(piece).length)] } };
}

export type SplitResult = { ok: true; components: string[]; cost: CurrencyAmounts } | { ok: false; problems: string[] };

/** Splitting a forged piece back into its components. */
export function splitPiece(content: ContentBundle, piece: string): SplitResult {
  const def = describePiece(content, piece);
  if (!def) return { ok: false, problems: [`Unknown item "${piece}"`] };
  if (def.components.length < 2) return { ok: false, problems: [`${def.name} is a single component`] };
  return { ok: true, components: def.components.map((c) => c.id), cost: { ...content.economy.split.cost } };
}

/** What salvaging a piece pays: each component's value by its type. */
export function salvageValue(content: ContentBundle, piece: string): CurrencyAmounts {
  const total: CurrencyAmounts = {};
  for (const c of describePiece(content, piece)?.components ?? []) {
    for (const [k, n] of Object.entries(content.economy.salvage[c.type] ?? {})) total[k] = (total[k] ?? 0) + n;
  }
  return total;
}

// ---------------------------------------------------------------- wallets

export type Wallet = Record<string, number>;

/** A new account's balances. */
export function startingWallet(content: ContentBundle): Wallet {
  return Object.fromEntries(Object.entries(content.economy.currencies).map(([id, c]) => [id, c.start]));
}

export function canAfford(wallet: Wallet, cost: CurrencyAmounts): boolean {
  return Object.entries(cost).every(([k, n]) => (wallet[k] ?? 0) >= n);
}

/** "100 Gold, 2 Dust": for messages. */
export function formatAmounts(content: ContentBundle, amounts: CurrencyAmounts): string {
  const parts = Object.entries(amounts)
    .filter(([, n]) => n !== 0)
    .map(([k, n]) => `${n} ${content.economy.currencies[k]?.name ?? k}`);
  return parts.length ? parts.join(', ') : 'nothing';
}
