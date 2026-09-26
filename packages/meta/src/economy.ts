// The economy's rules (GDD §8.4): wallets, match rewards, drops, crafting and salvage, as pure
// functions over the content's economy data. The server stores the results.

import { nextInt, type ContentBundle, type CurrencyAmounts, type ItemDef, type RngState } from '@arena/engine';

export type Outcome = 'win' | 'loss' | 'draw';

export interface Reward {
  currency: CurrencyAmounts;
  /** Item ids granted. */
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
  const wanted = spec.drops?.count ?? 0;
  const count = cap > 0 ? Math.max(0, Math.min(wanted, cap - input.dropsToday)) : wanted;
  return {
    currency: { ...spec.currency },
    items: spec.drops && count > 0 ? rollDrops(content, spec.drops.table, count, rng) : [],
  };
}

/** Rolls `count` items: a type by the table's weights, then one of its items uniformly. */
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

/** An item's element, for Shards and Crystals (their first infusion). */
export function itemElement(item: ItemDef): string | undefined {
  return item.infusions[0]?.element;
}

export type CraftResult = { ok: true; output: string; cost: CurrencyAmounts } | { ok: false; problems: string[] };

/** Checks a recipe against the chosen input items (by item id) and names what it makes. */
export function craft(content: ContentBundle, recipeId: string, inputs: readonly string[]): CraftResult {
  const r = content.economy.recipes[recipeId];
  if (!r) return { ok: false, problems: [`No recipe "${recipeId}"`] };
  const problems: string[] = [];
  if (inputs.length !== r.inputs.count) problems.push(`${r.name} takes ${r.inputs.count} items`);
  const defs = inputs.map((id) => content.items[id]);
  if (defs.some((d) => !d || d.type !== r.inputs.type)) problems.push(`${r.name} only takes type ${r.inputs.type} items`);
  const elements = new Set(defs.map((d) => (d ? itemElement(d) : undefined)));
  if (r.inputs.sameElement && elements.size > 1) problems.push('The items must all be of one element');
  if (problems.length) return { ok: false, problems };
  const element = [...elements][0];
  const outputs = itemsOfType(content, r.output.type).filter((o) => !r.inputs.sameElement || itemElement(o) === element);
  if (outputs.length !== 1) return { ok: false, problems: [`${r.name} has no single result for these items`] };
  return { ok: true, output: outputs[0]!.id, cost: { ...r.cost } };
}

/** What salvaging an item pays. */
export function salvageValue(content: ContentBundle, itemId: string): CurrencyAmounts {
  const item = content.items[itemId];
  return item ? { ...content.economy.salvage[item.type] } : {};
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
