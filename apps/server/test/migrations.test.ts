// Data migrations: rows written in an older shape are converted by the migration's own SQL.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { openDb, type OpenDb } from '../src/db/client.js';
import { characters, itemInstances, loadoutPresets, users } from '../src/db/schema.js';

let dbh: OpenDb;
beforeAll(async () => {
  dbh = await openDb();
});
afterAll(async () => {
  await dbh.close();
});

/** The data statements of a migration (updates and deletes, not ALTER TABLE). */
function dataStatements(file: string): string[] {
  const text = readFileSync(new URL(`../src/db/migrations/${file}`, import.meta.url), 'utf8');
  return text
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.includes('UPDATE') || s.includes('DELETE'));
}

describe('0006 equipment slots', () => {
  it('turns typed slots into up to four items, in slot order', async () => {
    const [u] = await dbh.db.insert(users).values({ email: 'm@example.com', displayName: 'M', passwordHash: 'x' }).returning();
    const legacy = {
      mainHand: { itemId: 'magma_hammer', instanceId: 'i1' },
      offHand: { itemId: 'storm_chaser', instanceId: 'i2', targets: [null, 'titan'] },
      body: { itemId: 'frostblood_mallet', instanceId: 'i3', unused: [0] },
      accessories: [{ itemId: 'worn_blade', instanceId: 'i4' }, { itemId: 'trackers_shortbow', instanceId: 'i5' }],
      sockets: [{ itemId: 'ice_shard', instanceId: 'i6', targets: ['smash'] }],
    };
    const base = { userId: u!.id, name: 'Old', classId: 'warrior', element: 'Fire', rarity: 'legendary' as const, portraitId: 'warrior.fire.01', skills: [], contentVersion: 'x' };
    // Written the way the old code stored them (the column's type is the new shape).
    const rows = await dbh.db
      .insert(characters)
      .values([
        { ...base, loadout: sql`${JSON.stringify(legacy)}::jsonb` as never },
        { ...base, name: 'Twohander', loadout: sql`${JSON.stringify({ twoHanded: { itemId: 'soldier_greataxe', instanceId: 'j1' } })}::jsonb` as never },
        { ...base, name: 'Empty', loadout: sql`'{}'::jsonb` as never },
        { ...base, name: 'New', loadout: sql`${JSON.stringify({ items: [{ itemId: 'ice_shard', instanceId: 'k1', targets: ['smash'] }] })}::jsonb` as never },
      ])
      .returning();
    await dbh.db.insert(loadoutPresets).values({ characterId: rows[0]!.id, name: 'P', loadout: sql`${JSON.stringify({ sockets: [{ itemId: 'fire_shard' }] })}::jsonb` as never });

    for (const statement of dataStatements('0006_equipment_slots.sql')) await dbh.db.execute(sql.raw(statement));

    const after = await dbh.db.select().from(characters).where(eq(characters.userId, u!.id));
    const by = (name: string) => after.find((c) => c.name === name)!.loadout;
    expect(by('Old')).toEqual({
      items: [
        { itemId: 'magma_hammer', instanceId: 'i1' },
        { itemId: 'storm_chaser', instanceId: 'i2', targets: [null, 'titan'] },
        { itemId: 'frostblood_mallet', instanceId: 'i3', unused: [0] },
        { itemId: 'worn_blade', instanceId: 'i4' },
      ], // trackers_shortbow and the shard went back to the inventory
    });
    expect(by('Twohander')).toEqual({ items: [{ itemId: 'soldier_greataxe', instanceId: 'j1' }] });
    expect(by('Empty')).toEqual({ items: [] });
    expect(by('New')).toEqual({ items: [{ itemId: 'ice_shard', instanceId: 'k1', targets: ['smash'] }] }); // untouched
    const [preset] = await dbh.db.select().from(loadoutPresets).where(eq(loadoutPresets.characterId, rows[0]!.id));
    expect(preset!.loadout).toEqual({ items: [{ itemId: 'fire_shard' }] });
  });
});

describe('0007 infusion pool', () => {
  it('drops per-item targets and starts every loadout with no infusions applied', async () => {
    const [u] = await dbh.db.insert(users).values({ email: 'p@example.com', displayName: 'P', passwordHash: 'x' }).returning();
    const base = { userId: u!.id, name: 'Old', classId: 'warrior', element: 'Fire', rarity: 'rare' as const, portraitId: 'warrior.fire.01', skills: [], contentVersion: 'x' };
    const old = { items: [{ itemId: 'magma_hammer', instanceId: 'i1' }, { itemId: 'ice_crystal', instanceId: 'i2', targets: ['titan', null], unused: [1] }] };
    const rows = await dbh.db
      .insert(characters)
      .values([
        { ...base, loadout: sql`${JSON.stringify(old)}::jsonb` as never },
        { ...base, name: 'Current', loadout: { items: [{ itemId: 'ice_shard', instanceId: 'k1' }], infusions: [{ skill: 'smash', element: 'Ice' }] } },
      ])
      .returning();
    await dbh.db.insert(loadoutPresets).values({ characterId: rows[0]!.id, name: 'P', loadout: sql`${JSON.stringify({ items: [{ itemId: 'fire_shard', targets: ['smash'] }] })}::jsonb` as never });

    for (const statement of dataStatements('0007_infusion_pool.sql')) await dbh.db.execute(sql.raw(statement));

    const after = await dbh.db.select().from(characters).where(eq(characters.userId, u!.id));
    expect(after.find((c) => c.name === 'Old')!.loadout).toEqual({
      items: [{ itemId: 'magma_hammer', instanceId: 'i1' }, { itemId: 'ice_crystal', instanceId: 'i2' }],
      infusions: [],
    });
    expect(after.find((c) => c.name === 'Current')!.loadout).toEqual({ items: [{ itemId: 'ice_shard', instanceId: 'k1' }], infusions: [{ skill: 'smash', element: 'Ice' }] });
    const [preset] = await dbh.db.select().from(loadoutPresets).where(eq(loadoutPresets.characterId, rows[0]!.id));
    expect(preset!.loadout).toEqual({ items: [{ itemId: 'fire_shard' }], infusions: [] });
  });
});

describe('0008 item renames', () => {
  it('moves owned instances, loadouts and presets to the renamed single-skill item ids, leaving others alone', async () => {
    const [u] = await dbh.db.insert(users).values({ email: 'r@example.com', displayName: 'R', passwordHash: 'x' }).returning();
    await dbh.db.insert(itemInstances).values([
      { userId: u!.id, itemId: 'mighty_greathammer', source: 'test' },
      { userId: u!.id, itemId: 'blackjack', source: 'test' },
      { userId: u!.id, itemId: 'ice_shard', source: 'test' },
    ]);
    const base = { userId: u!.id, name: 'Old', classId: 'warrior', element: 'Fire', rarity: 'rare' as const, portraitId: 'warrior.fire.01', skills: [], contentVersion: 'x' };
    const old = { items: [{ itemId: 'worn_blade', instanceId: 'i1' }, { itemId: 'ice_shard', instanceId: 'i2' }, { itemId: 'book_of_hymns', instanceId: 'i3' }], infusions: [{ skill: 'strike', element: 'Ice' }] };
    const [c] = await dbh.db.insert(characters).values({ ...base, loadout: old }).returning();
    await dbh.db.insert(loadoutPresets).values({ characterId: c!.id, name: 'P', loadout: { items: [{ itemId: 'trackers_shortbow' }], infusions: [] } });

    for (const statement of dataStatements('0008_item_renames.sql')) await dbh.db.execute(sql.raw(statement));

    const owned = await dbh.db.select().from(itemInstances).where(eq(itemInstances.userId, u!.id));
    expect(owned.map((i) => i.itemId).sort()).toEqual(['blackjack', 'greathammer', 'ice_shard']);
    const [after] = await dbh.db.select().from(characters).where(eq(characters.id, c!.id));
    expect(after!.loadout).toEqual({
      items: [{ itemId: 'longsword', instanceId: 'i1' }, { itemId: 'ice_shard', instanceId: 'i2' }, { itemId: 'hymnal', instanceId: 'i3' }],
      infusions: [{ skill: 'strike', element: 'Ice' }],
    });
    const [preset] = await dbh.db.select().from(loadoutPresets).where(eq(loadoutPresets.characterId, c!.id));
    expect(preset!.loadout).toEqual({ items: [{ itemId: 'shortbow' }], infusions: [] });
  });
});

describe('0009 modular items', () => {
  it('turns retired static items into the forged pieces of their parts, leaving components alone', async () => {
    const [u] = await dbh.db.insert(users).values({ email: 'mod@example.com', displayName: 'M', passwordHash: 'x' }).returning();
    await dbh.db.insert(itemInstances).values([
      { userId: u!.id, itemId: 'wind_katana', source: 'test' },
      { userId: u!.id, itemId: 'ice_crystal', source: 'test' },
      { userId: u!.id, itemId: 'emblem_of_the_inferno', source: 'test' },
      { userId: u!.id, itemId: 'longsword', source: 'test' },
    ]);
    const base = { userId: u!.id, name: 'Old', classId: 'warrior', element: 'Fire', rarity: 'rare' as const, portraitId: 'warrior.fire.01', skills: [], contentVersion: 'x' };
    const old = { items: [{ itemId: 'soldier_spear', instanceId: 'i1' }, { itemId: 'ice_shard', instanceId: 'i2' }], infusions: [{ skill: 'charge', element: 'Ice' }] };
    const [c] = await dbh.db.insert(characters).values({ ...base, loadout: old }).returning();
    await dbh.db.insert(loadoutPresets).values({ characterId: c!.id, name: 'P', loadout: { items: [{ itemId: 'hand_of_healing' }], infusions: [] } });

    for (const statement of dataStatements('0009_modular_items.sql')) await dbh.db.execute(sql.raw(statement));

    const owned = await dbh.db.select().from(itemInstances).where(eq(itemInstances.userId, u!.id));
    expect(owned.map((i) => i.itemId).sort()).toEqual(['fire_shard+fire_shard+sigil_inferno', 'ice_shard+ice_shard', 'longsword', 'longsword+wind_shard+sigil_momentum']);
    const [after] = await dbh.db.select().from(characters).where(eq(characters.id, c!.id));
    expect(after!.loadout).toEqual({
      items: [{ itemId: 'spear+rapier+sigil_vanguard', instanceId: 'i1' }, { itemId: 'ice_shard', instanceId: 'i2' }],
      infusions: [{ skill: 'charge', element: 'Ice' }],
    });
    const [preset] = await dbh.db.select().from(loadoutPresets).where(eq(loadoutPresets.characterId, c!.id));
    expect(preset!.loadout).toEqual({ items: [{ itemId: 'mace+sigil_selflessness' }], infusions: [] });
  });
});

describe('0011 drop test inventory', () => {
  it('removes the free testing copies (source dev) unless a character wears them', async () => {
    const [u] = await dbh.db.insert(users).values({ email: 'inv@example.com', displayName: 'I', passwordHash: 'x' }).returning();
    const rows = await dbh.db
      .insert(itemInstances)
      .values([
        { userId: u!.id, itemId: 'longsword', source: 'dev' },
        { userId: u!.id, itemId: 'fire_shard', source: 'dev' },
        { userId: u!.id, itemId: 'ice_shard', source: 'reward' },
        { userId: u!.id, itemId: 'spear+fire_shard', source: 'forge' },
      ])
      .returning();
    const worn = rows.find((r) => r.itemId === 'fire_shard')!;
    const base = { userId: u!.id, name: 'Wearer', classId: 'warrior', element: 'Fire', rarity: 'rare' as const, portraitId: 'warrior.fire.01', skills: [], contentVersion: 'x' };
    await dbh.db.insert(characters).values({ ...base, loadout: { items: [{ itemId: 'fire_shard', instanceId: worn.id }], infusions: [] } });

    for (const statement of dataStatements('0011_drop_test_inventory.sql')) await dbh.db.execute(sql.raw(statement));

    const left = await dbh.db.select().from(itemInstances).where(eq(itemInstances.userId, u!.id));
    expect(left.map((i) => i.itemId).sort()).toEqual(['fire_shard', 'ice_shard', 'spear+fire_shard']);
  });
});
