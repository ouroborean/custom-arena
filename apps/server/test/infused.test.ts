// Infused Recruits (decided 2026-10-09): every account has 3; each recruits the chosen class and element
// already equipped (meta infusedRecruitKit) with the pieces in the inventory; all or nothing.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { resolveLoadout, type Loadout } from '@arena/meta';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { characters, users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 4100;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++ });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

async function account(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: 'password123', displayName: email.split('@')[0] } });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const userId = (res.json() as { user: { id: string } }).user.id;
  const call = (method: 'GET' | 'POST', url: string, payload?: object) => app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  return { userId, call };
}

describe('Infused Recruits', () => {
  it('every account has 3; each recruits the chosen class and element, equipped and infused', async () => {
    const a = await account('infused@example.com');
    expect((await a.call('GET', '/api/characters')).json().infusedRecruits).toBe(3);
    type Inv = { items: { id: string; itemId: string; equippedOn: string | null }[] };
    const before = new Set(((await a.call('GET', '/api/inventory')).json() as Inv).items.map((i) => i.id));

    const res = await a.call('POST', '/api/characters/recruit-infused', { classId: 'priest', element: 'Holy' });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { character: { classId: string; element: string; skills: { base: string }[]; loadout: Loadout }; infusedRecruits: number };
    expect(body.infusedRecruits).toBe(2);
    const c = body.character;
    expect(c.classId).toBe('priest');
    expect(c.element).toBe('Holy');
    expect(c.loadout.items).toHaveLength(4);
    expect(c.loadout.items.every((i) => i.instanceId)).toBe(true);

    // The pieces are in the inventory, worn by this character.
    const added = ((await a.call('GET', '/api/inventory')).json() as Inv).items.filter((i) => !before.has(i.id));
    expect(added.map((i) => i.itemId).sort()).toEqual(c.loadout.items.map((i) => i.itemId).sort());
    expect(added.every((i) => i.equippedOn)).toBe(true);

    // Valid, every infusion placed, no equipped skill duplicating a native one.
    const [row] = await dbh.db.select().from(characters).where(eq(characters.userId, a.userId));
    const r = resolveLoadout(content, { classId: row!.classId, element: row!.element, skills: row!.skills, name: row!.name, portraitId: row!.portraitId }, row!.loadout);
    expect(r.problems).toEqual([]);
    expect(r.unassigned).toEqual({});
    expect(r.skills).toHaveLength(4);
    expect(new Set(r.skills.map((s) => s.base)).size).toBe(4);
  });

  it('runs out after 3, and refuses bad choices without spending one', async () => {
    const a = await account('infused2@example.com');
    expect((await a.call('POST', '/api/characters/recruit-infused', { classId: 'dragon', element: 'Fire' })).statusCode).toBe(400);
    expect((await a.call('POST', '/api/characters/recruit-infused', { classId: 'mage', element: 'Dragon' })).statusCode).toBe(400);
    for (const [classId, element] of [['mage', 'Fire'], ['rogue', 'Shadow'], ['knight', 'Earth']] as const) {
      expect((await a.call('POST', '/api/characters/recruit-infused', { classId, element })).statusCode).toBe(201);
    }
    expect((await a.call('POST', '/api/characters/recruit-infused', { classId: 'mage', element: 'Fire' })).statusCode).toBe(409);
    const list = (await a.call('GET', '/api/characters')).json() as { infusedRecruits: number; characters: unknown[] };
    expect(list.infusedRecruits).toBe(0);
    expect(list.characters).toHaveLength(3);
  });

  it('a full roster leaves the count and inventory untouched', async () => {
    const a = await account('infused3@example.com');
    await dbh.db.update(users).set({ infusedRecruits: 1 }).where(eq(users.id, a.userId));
    const roster = Array.from({ length: 60 }, (_, i) => ({ userId: a.userId, name: `R${i}`, classId: 'mage', element: 'Fire', portraitId: 'mage.fire.01', skills: [], contentVersion: content.version }));
    await dbh.db.insert(characters).values(roster);
    const items = async () => ((await a.call('GET', '/api/inventory')).json() as { items: unknown[] }).items.length;
    const before = await items();
    expect((await a.call('POST', '/api/characters/recruit-infused', { classId: 'mage', element: 'Fire' })).statusCode).toBe(409);
    expect((await a.call('GET', '/api/characters')).json().infusedRecruits).toBe(1);
    expect(await items()).toBe(before);
  });
});
