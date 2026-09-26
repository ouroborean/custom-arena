// Enumerates legal queue commands for the current planning state. Used by bots and UI affordances.

import { makeCtx, skillDef, type Ctx } from './ctx.js';
import { checkQueue } from './commands.js';
import type { ContentBundle, SkillDef } from './defs.js';
import { extraTargetFor, modifiedCost } from './queries.js';
import type { Command, Cost, GameState, PlayerId, Unit, UnitId } from './types.js';

export type QueueCommand = Extract<Command, { t: 'queue' }>;

function baseOptions(state: GameState, player: PlayerId, def: SkillDef): UnitId[][] {
  if (def.target === 'enemy') return state.units.filter((t) => t.alive && t.owner !== player).map((t) => [t.id]);
  if (def.target === 'ally') return state.units.filter((t) => t.alive && t.owner === player).map((t) => [t.id]);
  if (def.target === 'any') return state.units.filter((t) => t.alive).map((t) => [t.id]);
  return [[]];
}

/** Candidate target lists, including extra targets equipment opens up (then self skills pick too). */
function targetOptions(ctx: Ctx, state: GameState, actor: Unit, def: SkillDef): UnitId[][] {
  const base = baseOptions(state, actor.owner, def);
  if (def.target === 'allEnemies' || def.target === 'allAllies' || def.target === 'none') return base;
  const extra = state.units.filter((t) => t.alive && extraTargetFor(ctx, actor, def, t)).map((t) => t.id);
  if (extra.length === 0) return base;
  const single = def.target === 'self' ? [actor.id] : base.map((o) => o[0]!);
  return [...new Set([...single, ...extra])].map((id) => [id]);
}

export function legalQueueCommands(content: ContentBundle, state: GameState, player: PlayerId): QueueCommand[] {
  return skillAvailability(content, state, player).flatMap((a) =>
    a.targets.map((targets) => ({ t: 'queue' as const, actor: a.actor, slot: a.slot, targets })),
  );
}

export interface SkillAvailability {
  actor: UnitId;
  slot: number;
  skill: string;
  /** Cost after modifiers (Focus, Confusion, …). */
  cost: Cost;
  /** Legal target lists (each [] for self/AoE skills). Empty = not usable now. */
  targets: UnitId[][];
  /** Why the skill can't be queued, when `targets` is empty. */
  reason: string | null;
}

/** Per-skill usability for every living unit of `player` (UI: enabled state, reasons, highlights). */
export function skillAvailability(content: ContentBundle, state: GameState, player: PlayerId): SkillAvailability[] {
  const ctx = makeCtx(state, content);
  const out: SkillAvailability[] = [];
  const planning = state.phase === 'planning' && state.activePlayer === player;
  for (const u of state.units) {
    if (u.owner !== player || !u.alive) continue;
    u.skills.forEach((slot, i) => {
      const def = skillDef(content, slot.defId);
      const targets: UnitId[][] = [];
      let reason: string | null = planning ? null : 'Not your turn';
      if (planning) {
        for (const t of targetOptions(ctx, state, u, def)) {
          const err = checkQueue(ctx, player, { t: 'queue', actor: u.id, slot: i, targets: t });
          if (err === null) targets.push(t);
          else reason ??= err.message;
        }
        if (targets.length > 0) reason = null;
        else reason ??= 'No valid targets';
      }
      out.push({ actor: u.id, slot: i, skill: def.id, cost: modifiedCost(ctx, u, def), targets, reason });
    });
  }
  return out;
}
