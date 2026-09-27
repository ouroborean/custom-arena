// Data migrations: rows written in an older shape are converted by the migration's own SQL.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { openDb, type OpenDb } from '../src/db/client.js';
import { characters, loadoutPresets, users } from '../src/db/schema.js';

let dbh: OpenDb;
beforeAll(async () => {
  dbh = await openDb();
});
afterAll(async () => {
  await dbh.close();
});

/** The data statements of a migration (everything but ALTER TABLE). */
function dataStatements(file: string): string[] {
  const text = readFileSync(new URL(`../src/db/migrations/${file}`, import.meta.url), 'utf8');
  return text
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.includes('UPDATE'));
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
        { ...base, name: 'New', loadout: { items: [{ itemId: 'ice_shard', instanceId: 'k1', targets: ['smash'] }] } },
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
