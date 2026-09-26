// Inventory, loadouts and presets (GDD §7.3, §8). Items are content ids; the database holds owned
// instances. A loadout is validated on save (ownership, one character per instance, and the
// @arena/meta rules) and again when the team is turned into engine specs.

import { pick, seedRng } from '@arena/engine';
import { resolveLoadout, equippedItems, type CharacterRecord, type Loadout, type ResolvedLoadout } from '@arena/meta';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import { characters, itemInstances, loadoutPresets } from '../db/schema.js';

type CharacterRow = typeof characters.$inferSelect;

const Equipped = z.strictObject({
  itemId: z.string(),
  instanceId: z.uuid(),
  targets: z.array(z.string().nullable()).max(2).optional(),
  unused: z.array(z.number().int().min(0).max(1)).max(2).optional(),
});
export const LoadoutSchema = z.strictObject({
  mainHand: Equipped.optional(),
  offHand: Equipped.optional(),
  twoHanded: Equipped.optional(),
  body: Equipped.optional(),
  accessories: z.array(Equipped).max(5).optional(),
  sockets: z.array(Equipped).max(3).optional(),
});

export const recordOf = (c: CharacterRow): CharacterRecord => ({
  name: c.name,
  classId: c.classId,
  element: c.element,
  rarity: c.rarity,
  portraitId: c.portraitId,
  skills: c.skills,
});

/** Resolves a stored loadout without the ownership checks (used for display and match specs). */
export function resolveStored(ctx: AppContext, c: CharacterRow): ResolvedLoadout {
  return resolveLoadout(ctx.content, recordOf(c), c.loadout);
}

/** Full validation of a loadout the user wants to save on a character; throws 400 with problems. */
export async function checkLoadout(ctx: AppContext, userId: string, c: CharacterRow, loadout: Loadout): Promise<ResolvedLoadout> {
  const eqs = equippedItems(loadout).map((x) => x.eq);
  const ids = eqs.map((e) => e.instanceId!).filter(Boolean);
  const owned = ids.length
    ? await ctx.db
        .select()
        .from(itemInstances)
        .where(and(eq(itemInstances.userId, userId), inArray(itemInstances.id, ids)))
    : [];
  const problems: string[] = [];
  for (const e of eqs) {
    const inst = owned.find((o) => o.id === e.instanceId);
    if (!inst) problems.push(`You don't own that ${ctx.content.items[e.itemId]?.name ?? e.itemId}`);
    else if (inst.itemId !== e.itemId) problems.push(`Instance ${e.instanceId} is a ${inst.itemId}, not ${e.itemId}`);
  }
  // An instance can only be equipped on one character.
  const others = await ctx.db
    .select({ name: characters.name, loadout: characters.loadout })
    .from(characters)
    .where(and(eq(characters.userId, userId), ne(characters.id, c.id)));
  for (const o of others) {
    for (const { eq: e } of equippedItems(o.loadout)) {
      if (e.instanceId && ids.includes(e.instanceId)) problems.push(`${ctx.content.items[e.itemId]?.name ?? e.itemId} is equipped on ${o.name}`);
    }
  }
  const resolved = resolveLoadout(ctx.content, recordOf(c), loadout);
  problems.push(...resolved.problems);
  if (problems.length) throw new HttpError(400, 'That loadout is invalid', { problems });
  return resolved;
}

/** Gives a new account a few items to try equipment with (acquisition proper is Phase 7). */
export async function grantStarterKit(ctx: AppContext, userId: string): Promise<void> {
  const rng = seedRng(ctx.rollSeed());
  const ofType = (t: string, filter: (skills: string[]) => boolean = () => true) =>
    Object.values(ctx.content.items)
      .filter((i) => i.type === t && filter(i.skills))
      .map((i) => i.id)
      .sort();
  const picks = [pick(rng, ofType('K')), pick(rng, ofType('J', (s) => s.length === 1)), pick(rng, ofType('F'))];
  await ctx.db.insert(itemInstances).values(picks.map((itemId) => ({ userId, itemId, source: 'starter' })));
}

async function ownedCharacter(ctx: AppContext, userId: string, id: string): Promise<CharacterRow> {
  const [row] = await ctx.db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .limit(1);
  if (!row) throw new HttpError(404, 'No such character');
  return row;
}

const IdParam = z.object({ id: z.uuid() });
const PresetParam = z.object({ id: z.uuid(), presetId: z.uuid() });

export function equipmentRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireUser);

    app.get('/api/inventory', async (req) => {
      const userId = req.user!.id;
      const [items, chars] = await Promise.all([
        ctx.db.select().from(itemInstances).where(eq(itemInstances.userId, userId)).orderBy(itemInstances.acquiredAt),
        ctx.db.select({ id: characters.id, loadout: characters.loadout }).from(characters).where(eq(characters.userId, userId)),
      ]);
      const equippedOn = new Map<string, string>();
      for (const c of chars) for (const { eq: e } of equippedItems(c.loadout)) if (e.instanceId) equippedOn.set(e.instanceId, c.id);
      return {
        items: items.map((i) => ({ id: i.id, itemId: i.itemId, source: i.source, acquiredAt: i.acquiredAt, equippedOn: equippedOn.get(i.id) ?? null })),
      };
    });

    if (ctx.devGrants) {
      app.post('/api/dev/grant', async (req, reply) => {
        const { itemId } = parse(z.object({ itemId: z.string() }), req.body);
        if (!ctx.content.items[itemId]) throw new HttpError(404, `No item "${itemId}"`);
        const [row] = await ctx.db.insert(itemInstances).values({ userId: req.user!.id, itemId, source: 'dev' }).returning();
        return reply.status(201).send({ item: { id: row!.id, itemId: row!.itemId } });
      });
    }

    app.get('/api/characters/:id/loadout', async (req) => {
      const { id } = parse(IdParam, req.params);
      const c = await ownedCharacter(ctx, req.user!.id, id);
      return { loadout: c.loadout, resolved: resolveStored(ctx, c) };
    });

    app.put('/api/characters/:id/loadout', async (req) => {
      const { id } = parse(IdParam, req.params);
      const { loadout } = parse(z.object({ loadout: LoadoutSchema }), req.body);
      const c = await ownedCharacter(ctx, req.user!.id, id);
      const resolved = await checkLoadout(ctx, req.user!.id, c, loadout);
      await ctx.db.update(characters).set({ loadout }).where(eq(characters.id, id));
      return { loadout, resolved };
    });

    app.get('/api/characters/:id/presets', async (req) => {
      const { id } = parse(IdParam, req.params);
      await ownedCharacter(ctx, req.user!.id, id);
      const rows = await ctx.db.select().from(loadoutPresets).where(eq(loadoutPresets.characterId, id)).orderBy(loadoutPresets.createdAt);
      return { presets: rows.map((p) => ({ id: p.id, name: p.name, loadout: p.loadout })) };
    });

    app.post('/api/characters/:id/presets', async (req, reply) => {
      const { id } = parse(IdParam, req.params);
      const body = parse(z.object({ name: z.string().trim().min(1).max(24), loadout: LoadoutSchema.optional() }), req.body);
      const c = await ownedCharacter(ctx, req.user!.id, id);
      const loadout = body.loadout ?? c.loadout;
      // Presets only need to be valid for the character; instance conflicts are checked on apply.
      const problems = resolveLoadout(ctx.content, recordOf(c), loadout).problems;
      if (problems.length) throw new HttpError(400, 'That loadout is invalid', { problems });
      const [row] = await ctx.db.insert(loadoutPresets).values({ characterId: id, name: body.name, loadout }).returning();
      return reply.status(201).send({ preset: { id: row!.id, name: row!.name, loadout: row!.loadout } });
    });

    app.post('/api/characters/:id/presets/:presetId/apply', async (req) => {
      const { id, presetId } = parse(PresetParam, req.params);
      const c = await ownedCharacter(ctx, req.user!.id, id);
      const [p] = await ctx.db
        .select()
        .from(loadoutPresets)
        .where(and(eq(loadoutPresets.id, presetId), eq(loadoutPresets.characterId, id)));
      if (!p) throw new HttpError(404, 'No such preset');
      const resolved = await checkLoadout(ctx, req.user!.id, c, p.loadout);
      await ctx.db.update(characters).set({ loadout: p.loadout }).where(eq(characters.id, id));
      return { loadout: p.loadout, resolved };
    });

    app.delete('/api/characters/:id/presets/:presetId', async (req, reply) => {
      const { id, presetId } = parse(PresetParam, req.params);
      await ownedCharacter(ctx, req.user!.id, id);
      await ctx.db.delete(loadoutPresets).where(and(eq(loadoutPresets.id, presetId), eq(loadoutPresets.characterId, id)));
      return reply.status(204).send();
    });
  };
}
