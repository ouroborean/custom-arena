// Wallets and match rewards on top of @arena/meta's economy rules (docs/equipment.md §3).
// Spending is a conditional UPDATE, so a balance can never go negative, even under races.

import { seedRng, type ContentBundle, type CurrencyAmounts, type PlayerId } from '@arena/engine';
import { formatAmounts, matchReward, startingWallet, type Outcome, type Reward, type Wallet } from '@arena/meta';
import { and, eq, gte, sql } from 'drizzle-orm';
import { HttpError } from './app.js';
import type { Db } from './db/client.js';
import { currencies, itemInstances, matchRewards } from './db/schema.js';

/** Runs `fn` in a transaction. The handle has the same query API as Db. */
export function inTransaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction((tx) => fn(tx as unknown as Db));
}

/** The user's balances; accounts from before the economy (or a new currency) start at the configured amount. */
export async function walletOf(db: Db, content: ContentBundle, userId: string): Promise<Wallet> {
  const rows = await db.select().from(currencies).where(eq(currencies.userId, userId));
  const wallet: Wallet = Object.fromEntries(rows.map((r) => [r.kind, r.amount]));
  const missing = Object.entries(startingWallet(content)).filter(([k]) => wallet[k] === undefined);
  if (missing.length) {
    await db
      .insert(currencies)
      .values(missing.map(([kind, amount]) => ({ userId, kind, amount })))
      .onConflictDoNothing();
    for (const [k, n] of missing) wallet[k] = n;
  }
  return wallet;
}

export async function credit(db: Db, content: ContentBundle, userId: string, amounts: CurrencyAmounts): Promise<void> {
  await walletOf(db, content, userId);
  for (const [kind, n] of Object.entries(amounts)) {
    if (n === 0) continue;
    await db
      .insert(currencies)
      .values({ userId, kind, amount: n })
      .onConflictDoUpdate({ target: [currencies.userId, currencies.kind], set: { amount: sql`${currencies.amount} + ${n}` } });
  }
}

/**
 * Takes `cost` from the user's wallet or throws 402 having taken nothing — with more than one
 * currency, call it inside a transaction so a later shortfall rolls back the earlier ones.
 */
export async function spend(db: Db, content: ContentBundle, userId: string, cost: CurrencyAmounts): Promise<void> {
  await walletOf(db, content, userId);
  for (const [kind, n] of Object.entries(cost)) {
    if (n <= 0) continue;
    const rows = await db
      .update(currencies)
      .set({ amount: sql`${currencies.amount} - ${n}` })
      .where(and(eq(currencies.userId, userId), eq(currencies.kind, kind), gte(currencies.amount, n)))
      .returning();
    if (rows.length === 0) throw new HttpError(402, `Not enough ${content.economy.currencies[kind]?.name ?? kind}: that costs ${formatAmounts(content, cost)}`);
  }
}

/** Item drops the user has had from matches since the start of the current UTC day. */
async function dropsToday(db: Db, userId: string, now: Date): Promise<number> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(jsonb_array_length(${matchRewards.items})), 0)::int` })
    .from(matchRewards)
    .where(and(eq(matchRewards.userId, userId), gte(matchRewards.createdAt, since)));
  return row?.n ?? 0;
}

export interface FinishedMatch {
  matchId: string;
  kind: string;
  users: [string, string];
  winner: PlayerId | null;
  endReason: string;
  turns: number;
}

/** Works out and grants each player's reward (at most once per match); null where nothing was earned. */
export async function grantMatchRewards(
  db: Db,
  content: ContentBundle,
  m: FinishedMatch,
  seed: () => number,
): Promise<[Reward | null, Reward | null]> {
  const out: [Reward | null, Reward | null] = [null, null];
  for (const p of [0, 1] as const) {
    const userId = m.users[p];
    const outcome: Outcome = m.winner === null ? 'draw' : m.winner === p ? 'win' : 'loss';
    const reward = matchReward(
      content,
      { kind: m.kind, outcome, endReason: m.endReason, turns: m.turns, dropsToday: await dropsToday(db, userId, new Date()) },
      seedRng(seed()),
    );
    if (reward.items.length === 0 && Object.values(reward.currency).every((n) => n === 0)) continue;
    const granted = await inTransaction(db, async (tx) => {
      const ins = await tx
        .insert(matchRewards)
        .values({ matchId: m.matchId, userId, currency: reward.currency, items: reward.items })
        .onConflictDoNothing()
        .returning();
      if (ins.length === 0) return false;
      await credit(tx, content, userId, reward.currency);
      if (reward.items.length) await tx.insert(itemInstances).values(reward.items.map((itemId) => ({ userId, itemId, source: 'reward' })));
      return true;
    });
    if (granted) out[p] = reward;
  }
  return out;
}
