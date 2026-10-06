// Player levels and loot boxes on top of @arena/meta's rules (docs/equipment.md §4.1): experience is
// added in the same transaction as a match's other rewards, and every bubble it crosses on the bar
// stores a loot box for the player to open.

import { seedRng, type ContentBundle } from '@arena/engine';
import { levelOf, milestonesBetween, openLootBox, xpGain, type LevelState, type LootRoll, type Wallet, type XpGain } from '@arena/meta';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { HttpError } from './app.js';
import type { Db } from './db/client.js';
import { itemInstances, lootBoxes, playerProgress } from './db/schema.js';
import { credit, inTransaction, walletOf } from './economy.js';

export interface LootBoxView {
  id: string;
  box: string;
  /** level (a bubble on the bar), tutorial, guide, … */
  source: string;
  /** Level-up boxes: the level and bubble that paid it. */
  level: number | null;
  at: number | null;
  createdAt: Date;
}

export interface ProgressView extends LevelState {
  /** Unopened boxes, oldest first. */
  boxes: LootBoxView[];
}

async function totalXp(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ xp: playerProgress.xp }).from(playerProgress).where(eq(playerProgress.userId, userId));
  return row?.xp ?? 0;
}

/** The player's level, progress into it and unopened boxes. */
export async function progressOf(db: Db, content: ContentBundle, userId: string): Promise<ProgressView> {
  const [xp, boxes] = await Promise.all([
    totalXp(db, userId),
    db
      .select({ id: lootBoxes.id, box: lootBoxes.box, source: lootBoxes.source, level: lootBoxes.level, at: lootBoxes.at, createdAt: lootBoxes.createdAt })
      .from(lootBoxes)
      .where(and(eq(lootBoxes.userId, userId), isNull(lootBoxes.openedAt)))
      .orderBy(asc(lootBoxes.createdAt), asc(lootBoxes.level), asc(lootBoxes.at)),
  ]);
  return { ...levelOf(content, xp), boxes };
}

/**
 * Adds `xp` to the player's total and stores a box for every bubble crossed. Call it inside the
 * transaction that pays the match, after the match has been claimed, so it happens at most once.
 */
export async function awardXp(db: Db, content: ContentBundle, userId: string, xp: number): Promise<XpGain | undefined> {
  if (xp <= 0) return undefined;
  const [row] = await db
    .insert(playerProgress)
    .values({ userId, xp })
    .onConflictDoUpdate({ target: playerProgress.userId, set: { xp: sql`${playerProgress.xp} + ${xp}`, updatedAt: new Date() } })
    .returning({ xp: playerProgress.xp });
  const before = row!.xp - xp;
  const crossed = milestonesBetween(content, before, row!.xp);
  if (crossed.length) await db.insert(lootBoxes).values(crossed.map((m) => ({ userId, box: m.box, level: m.level, at: m.at })));
  return xpGain(content, before, xp);
}

export interface OpenedBox {
  box: string;
  rolls: LootRoll[];
  wallet: Wallet;
}

/** Opens one of the player's boxes: rolls it, pays it and marks it opened (at most once). */
export async function openBox(db: Db, content: ContentBundle, userId: string, id: string, seed: number): Promise<OpenedBox> {
  return inTransaction(db, async (tx) => {
    const [row] = await tx.select().from(lootBoxes).where(and(eq(lootBoxes.id, id), eq(lootBoxes.userId, userId)));
    if (!row) throw new HttpError(404, 'No such loot box');
    if (row.openedAt) throw new HttpError(409, 'That loot box is already open');
    if (!content.economy.lootBoxes?.[row.box]) throw new HttpError(409, 'That kind of loot box no longer exists');
    const rolls = openLootBox(content, row.box, seedRng(seed));
    const claimed = await tx
      .update(lootBoxes)
      .set({ openedAt: new Date(), contents: rolls })
      .where(and(eq(lootBoxes.id, id), isNull(lootBoxes.openedAt)))
      .returning();
    if (claimed.length === 0) throw new HttpError(409, 'That loot box is already open');
    for (const r of rolls) {
      if (r.kind === 'gold') await credit(tx, content, userId, r.currency);
      else await tx.insert(itemInstances).values({ userId, itemId: r.item, source: `lootbox:${row.box}` });
    }
    return { box: row.box, rolls, wallet: await walletOf(tx, content, userId) };
  });
}
