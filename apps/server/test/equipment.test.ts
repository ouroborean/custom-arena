// Inventory, loadout and preset routes against an in-memory PGlite database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';

const content = loadContentOrThrow();
let app: FastifyInstance;
let dbh: OpenDb;
let seed = 100;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, rollSeed: () => seed++, devGrants: true });
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

interface Character {
  id: string;
  name: string;
  skills: { base: string; infusion: string | null; locked: boolean }[];
}

async function account(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'password123', displayName: 'Kit' },
  });
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const grant = async (itemId: string) => (await call('POST', '/api/dev/grant', { itemId })).json().item.id as string;
  const chars = (await call('GET', '/api/characters')).json().characters as Character[];
  return { call, grant, chars };
}

/** A skill a shard infusion can go on: a native skill without a (locked) infusion. */
const freeSkill = (c: Character) => c.skills.find((s) => !s.infusion)!.base;

describe('inventory', () => {
  it('new accounts get a starter kit (a shard, a gear item, an armor piece)', async () => {
    const { call } = await account('kit@example.com');
    const items = (await call('GET', '/api/inventory')).json().items as { itemId: string; equippedOn: string | null }[];
    expect(items.map((i) => content.items[i.itemId]!.type).sort()).toEqual(['F', 'J', 'K']);
    expect(items.every((i) => i.equippedOn === null)).toBe(true);
  });
});

describe('loadouts', () => {
  it('equips a shard and puts its infusion on a chosen skill; the team specs carry it', async () => {
    const { call, grant, chars } = await account('equip@example.com');
    const c = chars[0]!;
    const target = freeSkill(c);
    const shard = await grant('ice_shard');
    const put = await call('PUT', `/api/characters/${c.id}/loadout`, {
      loadout: { items: [{ itemId: 'ice_shard', instanceId: shard }], infusions: [{ skill: target, element: 'Ice' }] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().resolved.skills.find((s: { base: string }) => s.base === target).infusion).toBe('Ice');

    const inv = (await call('GET', '/api/inventory')).json().items as { id: string; equippedOn: string | null }[];
    expect(inv.find((i) => i.id === shard)!.equippedOn).toBe(c.id);

    const specs = (await call('GET', '/api/teams/active/specs')).json().specs as { skills: string[] }[];
    expect(specs[0]!.skills).toContain(`${target}.ice`);
  });

  it('rejects items the user does not own, mismatched ids and rule violations, with problems', async () => {
    const a = await account('owner@example.com');
    const b = await account('thief@example.com');
    const shard = await a.grant('fire_shard');
    const steal = await b.call('PUT', `/api/characters/${b.chars[0]!.id}/loadout`, {
      loadout: { items: [{ itemId: 'fire_shard', instanceId: shard }], infusions: [] },
    });
    expect(steal.statusCode).toBe(400);
    expect(steal.json().problems[0]).toContain("don't own");

    const mine = await b.grant('fire_shard');
    const mismatch = await b.call('PUT', `/api/characters/${b.chars[0]!.id}/loadout`, {
      loadout: { items: [{ itemId: 'ice_shard', instanceId: mine }], infusions: [] },
    });
    expect(mismatch.json().problems.some((p: string) => p.includes('not ice_shard'))).toBe(true);

    const skills = b.chars[0]!.skills.filter((s) => !s.infusion).map((s) => s.base);
    const overdrawn = await b.call('PUT', `/api/characters/${b.chars[0]!.id}/loadout`, {
      loadout: {
        items: [{ itemId: 'fire_shard', instanceId: mine }],
        infusions: skills.slice(0, 2).map((skill) => ({ skill, element: 'Fire' })), // one shard, two infusions
      },
    });
    expect(overdrawn.json().problems.some((p: string) => p.includes('than the equipment provides'))).toBe(true);
  });

  it('an item instance can only be equipped on one character', async () => {
    const { call, grant, chars } = await account('twice@example.com');
    const shard = await grant('wind_shard');
    const on = (c: Character) => ({ loadout: { items: [{ itemId: 'wind_shard', instanceId: shard }], infusions: [{ skill: freeSkill(c), element: 'Wind' }] } });
    expect((await call('PUT', `/api/characters/${chars[0]!.id}/loadout`, on(chars[0]!))).statusCode).toBe(200);
    const second = await call('PUT', `/api/characters/${chars[1]!.id}/loadout`, on(chars[1]!));
    expect(second.statusCode).toBe(400);
    expect(second.json().problems[0]).toContain(`equipped on ${chars[0]!.name}`);
  });

  it('presets save, apply and delete', async () => {
    const { call, grant, chars } = await account('presets@example.com');
    const c = chars[0]!;
    const shard = await grant('holy_shard');
    const loadout = { items: [{ itemId: 'holy_shard', instanceId: shard }], infusions: [{ skill: freeSkill(c), element: 'Holy' }] };
    const saved = await call('POST', `/api/characters/${c.id}/presets`, { name: 'Holy', loadout });
    expect(saved.statusCode).toBe(201);
    const presetId = saved.json().preset.id;
    expect((await call('GET', `/api/characters/${c.id}/presets`)).json().presets).toHaveLength(1);
    const applied = await call('POST', `/api/characters/${c.id}/presets/${presetId}/apply`);
    expect(applied.statusCode).toBe(200);
    expect((await call('GET', `/api/characters/${c.id}/loadout`)).json().loadout).toEqual(loadout);
    expect((await call('DELETE', `/api/characters/${c.id}/presets/${presetId}`)).statusCode).toBe(204);
  });

  it('dev grants are off unless enabled', async () => {
    const plain = await buildApp({ db: dbh.db, content });
    const res = await plain.inject({ method: 'POST', url: '/api/dev/grant', payload: { itemId: 'ice_shard' } });
    expect(res.statusCode).toBe(404);
    await plain.close();
  });
});
