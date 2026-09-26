// Roster (characters) and teams (GDD §7, §9.1). Rolling is free for now; its cost and currency
// arrive with the economy (Phase 7).

import { MAX_SKILLS, rollCharacter, toCharacterSpec, validateCharacter } from '@arena/meta';
import { seedRng } from '@arena/engine';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import { characters, teams, users } from '../db/schema.js';
import { recordOf, resolveStored } from './equipment.js';

/** Upper bound on roster size while rolling is free. */
export const MAX_ROSTER = 60;

type CharacterRow = typeof characters.$inferSelect;

export function characterJson(c: CharacterRow) {
  return {
    id: c.id,
    name: c.name,
    classId: c.classId,
    element: c.element,
    rarity: c.rarity,
    portraitId: c.portraitId,
    skills: c.skills,
    loadout: c.loadout,
    contentVersion: c.contentVersion,
    createdAt: c.createdAt,
  };
}

/** Rolls a character for a user (class weighting and pity from their roster) and stores it. */
export async function rollForUser(ctx: AppContext, userId: string): Promise<CharacterRow> {
  const owned = await ctx.db.select({ classId: characters.classId }).from(characters).where(eq(characters.userId, userId));
  if (owned.length >= MAX_ROSTER) throw new HttpError(409, `Your roster is full (${MAX_ROSTER})`);
  const ownedClassCounts: Record<string, number> = {};
  for (const o of owned) ownedClassCounts[o.classId] = (ownedClassCounts[o.classId] ?? 0) + 1;
  const [u] = await ctx.db.select({ rollsSincePity: users.rollsSincePity }).from(users).where(eq(users.id, userId));

  const { character, rollsSincePity } = rollCharacter(ctx.content, seedRng(ctx.rollSeed()), {
    ownedClassCounts,
    rollsSincePity: u?.rollsSincePity ?? 0,
  });
  const [row] = await ctx.db
    .insert(characters)
    .values({ userId, ...character, contentVersion: ctx.content.version })
    .returning();
  await ctx.db.update(users).set({ rollsSincePity }).where(eq(users.id, userId));
  if (!row) throw new HttpError(500, 'Could not store the character');
  return row;
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

async function activeTeam(ctx: AppContext, userId: string) {
  const [team] = await ctx.db
    .select()
    .from(teams)
    .where(and(eq(teams.userId, userId), eq(teams.isActive, true)))
    .limit(1);
  return team ?? null;
}

const IdParam = z.object({ id: z.uuid() });

export function rosterRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', async (req) => {
      if (req.url.startsWith('/api/characters') || req.url.startsWith('/api/teams')) await requireUser(req);
    });

    app.get('/api/characters', async (req) => {
      const rows = await ctx.db.select().from(characters).where(eq(characters.userId, req.user!.id)).orderBy(characters.createdAt);
      return { characters: rows.map(characterJson), maxRoster: MAX_ROSTER, maxSkills: MAX_SKILLS };
    });

    app.get('/api/characters/:id', async (req) => {
      const { id } = parse(IdParam, req.params);
      const row = await ownedCharacter(ctx, req.user!.id, id);
      return {
        character: characterJson(row),
        problems: validateCharacter(ctx.content, recordOf(row)),
        resolved: resolveStored(ctx, row),
      };
    });

    app.post('/api/characters/roll', async (req, reply) => {
      const row = await rollForUser(ctx, req.user!.id);
      return reply.status(201).send({ character: characterJson(row) });
    });

    app.patch('/api/characters/:id', async (req) => {
      const { id } = parse(IdParam, req.params);
      const { name } = parse(z.object({ name: z.string().trim().min(1).max(24) }), req.body);
      await ownedCharacter(ctx, req.user!.id, id);
      const [row] = await ctx.db.update(characters).set({ name }).where(eq(characters.id, id)).returning();
      return { character: characterJson(row!) };
    });

    app.delete('/api/characters/:id', async (req, reply) => {
      const { id } = parse(IdParam, req.params);
      await ownedCharacter(ctx, req.user!.id, id);
      const team = await activeTeam(ctx, req.user!.id);
      if (team?.characterIds.includes(id)) throw new HttpError(409, 'That character is in your active team');
      await ctx.db.delete(characters).where(eq(characters.id, id));
      return reply.status(204).send();
    });

    app.get('/api/teams/active', async (req) => {
      const team = await activeTeam(ctx, req.user!.id);
      if (!team) return { team: null };
      return { team: { id: team.id, name: team.name, characterIds: team.characterIds } };
    });

    app.put('/api/teams/active', async (req) => {
      const { characterIds } = parse(z.object({ characterIds: z.array(z.uuid()).length(3) }), req.body);
      if (new Set(characterIds).size !== 3) throw new HttpError(400, 'A team needs 3 different characters');
      for (const id of characterIds) await ownedCharacter(ctx, req.user!.id, id);
      const team = await activeTeam(ctx, req.user!.id);
      if (team) {
        await ctx.db.update(teams).set({ characterIds }).where(eq(teams.id, team.id));
        return { team: { id: team.id, name: team.name, characterIds } };
      }
      const [row] = await ctx.db
        .insert(teams)
        .values({ userId: req.user!.id, name: 'Team 1', characterIds, isActive: true })
        .returning();
      return { team: { id: row!.id, name: row!.name, characterIds } };
    });

    /** The active team as engine input, equipment included; loadouts are re-validated (GDD §7.3). */
    app.get('/api/teams/active/specs', async (req) => {
      const team = await activeTeam(ctx, req.user!.id);
      if (!team) throw new HttpError(404, 'No active team');
      const specs = [];
      for (const id of team.characterIds) {
        const c = await ownedCharacter(ctx, req.user!.id, id);
        const resolved = resolveStored(ctx, c);
        if (resolved.problems.length) throw new HttpError(409, `${c.name}'s loadout needs fixing`, { problems: resolved.problems });
        specs.push(toCharacterSpec(recordOf(c), resolved));
      }
      return { specs };
    });
  };
}
