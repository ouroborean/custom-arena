// Commands: the only way state changes after match creation (GDD §11.7).
// `applyCommand` never mutates its input; it works on a clone and returns the new state + events.

import { effectDef, findUnit, makeCtx, other, skillDef, type Ctx } from './ctx.js';
import type { ContentBundle } from './defs.js';
import { autoAllocate, isPayable, isValidAllocation, sumCosts } from './energy.js';
import { resolveTargets, unmetRequirement, useQueuedSkill } from './pipeline.js';
import { cannotUseReason, modifiedCost } from './queries.js';
import { checkGameOver, endTurn, finish } from './turn.js';
import { COLORS, type ApplyResult, type Command, type Energy, type GameState, type PlayerId } from './types.js';

export class CommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

function reject(code: string, message: string): never {
  throw new CommandError(code, message);
}

/** Read-only check for a queue command. Returns an error, or null if it's legal right now. */
export function checkQueue(ctx: Ctx, player: PlayerId, cmd: Extract<Command, { t: 'queue' }>): CommandError | null {
  const s = ctx.s;
  const actor = findUnit(s, cmd.actor);
  if (!actor || actor.owner !== player) return new CommandError('bad_actor', 'Not your unit');
  if (!actor.alive) return new CommandError('bad_actor', `${actor.name} is dead`);
  if (s.players[player].queue.some((q) => q.actor === actor.id)) {
    return new CommandError('already_queued', `${actor.name} already has a queued skill`);
  }
  const slot = actor.skills[cmd.slot];
  if (!slot) return new CommandError('bad_slot', 'No such skill');
  const def = skillDef(ctx.c, slot.defId);
  if (slot.cooldown > 0) return new CommandError('on_cooldown', `${def.name} is on cooldown (${slot.cooldown})`);
  const blocked = cannotUseReason(ctx, actor, def) ?? unmetRequirement(ctx, actor, def);
  if (blocked) return new CommandError('cannot_act', `${actor.name} can't use ${def.name}: ${blocked}`);
  const tr = resolveTargets(ctx, actor, def, cmd.targets, true);
  if (!tr.ok) return new CommandError('bad_target', tr.reason);
  const cost = modifiedCost(ctx, actor, def);
  const reserved = sumCosts([...s.players[player].queue.map((q) => q.cost), cost]);
  if (!isPayable(s.players[player].energy, reserved)) return new CommandError('no_energy', 'Not enough energy');
  return null;
}

export function applyCommand(content: ContentBundle, state: GameState, player: PlayerId, cmd: Command): ApplyResult {
  const s = structuredClone(state);
  const ctx = makeCtx(s, content);
  if (s.phase === 'finished') reject('finished', 'The match is over');

  if (cmd.t === 'surrender') {
    finish(ctx, { winner: other(player), reason: 'surrender' });
    return { state: s, events: ctx.events };
  }
  if (player !== s.activePlayer) reject('not_your_turn', 'It is not your turn');
  const ps = s.players[player];

  switch (cmd.t) {
    case 'queue': {
      const err = checkQueue(ctx, player, cmd);
      if (err) throw err;
      const actor = findUnit(s, cmd.actor);
      if (!actor) reject('bad_actor', 'Not your unit');
      const def = skillDef(content, actor.skills[cmd.slot]!.defId);
      const tr = resolveTargets(ctx, actor, def, cmd.targets, true);
      ps.queue.push({
        actor: actor.id,
        slot: cmd.slot,
        // Single-target skills keep the declared target; AoE/self targets are recomputed at resolution.
        targets: def.target === 'enemy' || def.target === 'ally' || def.target === 'any' ? (tr.ok ? tr.targets : []) : [],
        cost: modifiedCost(ctx, actor, def),
      });
      break;
    }
    case 'unqueue':
      if (!ps.queue[cmd.index]) reject('bad_index', 'Nothing queued at that index');
      ps.queue.splice(cmd.index, 1);
      break;
    case 'reorder': {
      const n = ps.queue.length;
      const sorted = [...cmd.order].sort((a, b) => a - b);
      if (sorted.length !== n || sorted.some((v, i) => v !== i)) reject('bad_order', 'Order must be a permutation of the queue');
      ps.queue = cmd.order.map((i) => ps.queue[i]!);
      break;
    }
    case 'setTickOrder': {
      for (const id of cmd.order) {
        const e = s.effects.find((x) => x.id === id);
        const ticks = e && (effectDef(content, e).triggers ?? []).some((t) => t.on === 'turnEnd');
        if (!e || e.sourceOwner !== player || !ticks) reject('bad_tick', `Effect ${id} is not one of your ticking effects`);
      }
      ps.tickOrder = [...cmd.order];
      break;
    }
    case 'endTurn':
      commitTurn(ctx, player, cmd.allocation);
      break;
  }
  return { state: s, events: ctx.events };
}

function commitTurn(ctx: Ctx, player: PlayerId, allocation: Energy | undefined): void {
  const s = ctx.s;
  const ps = s.players[player];
  const reserved = sumCosts(ps.queue.map((q) => q.cost));
  if (!isPayable(ps.energy, reserved)) reject('no_energy', 'Queued skills are no longer affordable');
  const alloc = allocation ?? autoAllocate(ps.energy, reserved);
  if (!isValidAllocation(ps.energy, reserved, alloc)) reject('bad_allocation', 'Random-cost allocation is invalid');

  // Pay everything now, recording the exact colors each action used (for refunds).
  const left: Energy = { ...alloc };
  for (const q of ps.queue) {
    const paid: Energy = { S: q.cost.S, A: q.cost.A, I: q.cost.I, W: q.cost.W };
    let r = q.cost.r;
    for (const c of COLORS) {
      const take = Math.min(r, left[c]);
      paid[c] += take;
      left[c] -= take;
      r -= take;
    }
    q.paid = paid;
    for (const c of COLORS) ps.energy[c] -= paid[c];
  }

  for (const q of [...ps.queue]) {
    useQueuedSkill(ctx, q);
    if (checkGameOver(ctx)) return;
  }
  endTurn(ctx);
}
