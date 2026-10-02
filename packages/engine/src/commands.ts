// Commands: the only way state changes after match creation (GDD §11.7).
// `applyCommand` never mutates its input; it works on a clone and returns the new state + events.

import { checkpoint, effectDef, emit, findUnit, makeCtx, other, skillDef, type Ctx } from './ctx.js';
import type { ContentBundle } from './defs.js';
import { autoAllocate, isPayable, isValidAllocation, sumCosts } from './energy.js';
import { resolveTargets, unmetRequirement, useQueuedSkill } from './pipeline.js';
import { bloodPriceHp, cannotUseReason, modifiedCost } from './queries.js';
import { checkGameOver, endTurn, finish } from './turn.js';
import { COLORS, type ApplyOptions, type ApplyResult, type Color, type Command, type Cost, type Energy, type GameState, type PlayerId } from './types.js';

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

/** Energy given up and gained by one exchange (GDD §3.2, decided 2026-10-03). */
export const EXCHANGE = { give: 2, get: 1 } as const;

/** What an exchange check reads: a game state, or the player's own view of it. */
export interface ExchangeState {
  phase: GameState['phase'];
  activePlayer: PlayerId;
  players: readonly { energy: Energy | null; queue: readonly { cost: Cost }[]; exchanged?: unknown }[];
}

/**
 * Read-only check for an exchange: it's the player's turn, they haven't exchanged this turn, the two
 * colors differ, they have 2 of `give`, and what's left still pays for their queued skills.
 */
export function checkExchange(state: ExchangeState, player: PlayerId, give: Color, get: Color): CommandError | null {
  if (state.phase === 'finished') return new CommandError('finished', 'The match is over');
  if (player !== state.activePlayer) return new CommandError('not_your_turn', 'It is not your turn');
  const ps = state.players[player]!;
  if (!ps.energy) return new CommandError('not_your_turn', 'That energy is hidden');
  if (ps.exchanged) return new CommandError('already_exchanged', 'You can exchange energy once per turn');
  if (!COLORS.includes(give) || !COLORS.includes(get) || give === get) return new CommandError('bad_exchange', 'Exchange one color for a different one');
  if (ps.energy[give] < EXCHANGE.give) return new CommandError('no_energy', `Exchanging needs ${EXCHANGE.give} of a color`);
  const after: Energy = { ...ps.energy, [give]: ps.energy[give] - EXCHANGE.give, [get]: ps.energy[get] + EXCHANGE.get };
  if (!isPayable(after, sumCosts(ps.queue.map((q) => q.cost)))) {
    return new CommandError('energy_reserved', 'That energy is needed for your queued skills');
  }
  return null;
}

/** Read-only check for a queue command. Returns an error, or null if it's legal right now. */
export function checkQueue(ctx: Ctx, player: PlayerId, cmd: Extract<Command, { t: 'queue' }>): CommandError | null {
  const s = ctx.s;
  const actor = findUnit(s, cmd.actor);
  if (!actor || actor.owner !== player) return new CommandError('bad_actor', 'Not your unit');
  if (!actor.alive) return new CommandError('bad_actor', `${actor.name} is dead`);
  const slot = actor.skills[cmd.slot];
  if (!slot) return new CommandError('bad_slot', 'No such skill');
  const def = skillDef(ctx.c, slot.defId);
  // One skill per character per turn, plus one FreeAction skill (Dimension's Folded Moment).
  const free = def.tags.includes('FreeAction');
  const queued = s.players[player].queue.filter((q) => q.actor === actor.id);
  if (queued.some((q) => skillDef(ctx.c, actor.skills[q.slot]!.defId).tags.includes('FreeAction') === free)) {
    return new CommandError('already_queued', `${actor.name} already has a queued skill`);
  }
  if (slot.cooldown > 0) return new CommandError('on_cooldown', `${def.name} is on cooldown (${slot.cooldown})`);
  const blocked = cannotUseReason(ctx, actor, def) ?? unmetRequirement(ctx, actor, def);
  if (blocked) return new CommandError('cannot_act', `${actor.name} can't use ${def.name}: ${blocked}`);
  const tr = resolveTargets(ctx, actor, def, cmd.targets, true);
  if (!tr.ok) return new CommandError('bad_target', tr.reason);
  if (bloodPriceHp(ctx, actor, def) >= actor.hp) return new CommandError('cannot_act', `${def.name}'s Blood Price would kill ${actor.name}`);
  const cost = modifiedCost(ctx, actor, def);
  const reserved = sumCosts([...s.players[player].queue.map((q) => q.cost), cost]);
  if (!isPayable(s.players[player].energy, reserved)) return new CommandError('no_energy', 'Not enough energy');
  return null;
}

export function applyCommand(content: ContentBundle, state: GameState, player: PlayerId, cmd: Command, opts: ApplyOptions = {}): ApplyResult {
  const s = structuredClone(state);
  const ctx = makeCtx(s, content, opts.checkpoints);
  if (s.phase === 'finished') reject('finished', 'The match is over');

  if (cmd.t === 'surrender') {
    finish(ctx, { winner: other(player), reason: 'surrender' });
    return result(ctx);
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
        // Single-target skills keep the declared target; AoE/self targets are recomputed at resolution,
        // unless equipment redirected a self skill to another unit (Lightsaber Dirk).
        targets:
          def.target === 'enemy' || def.target === 'ally' || def.target === 'any' || (def.target === 'self' && tr.ok && tr.targets[0] !== actor.id)
            ? tr.ok
              ? tr.targets
              : []
            : [],
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
    case 'exchange': {
      const err = checkExchange(s, player, cmd.give, cmd.get);
      if (err) throw err;
      ps.energy[cmd.give] -= EXCHANGE.give;
      ps.energy[cmd.get] += EXCHANGE.get;
      ps.exchanged = { give: cmd.give, get: cmd.get };
      emit(ctx, { t: 'energyExchanged', player, give: cmd.give, get: cmd.get }, player);
      break;
    }
    case 'endTurn':
      commitTurn(ctx, player, cmd.allocation);
      break;
  }
  return result(ctx);
}

function result(ctx: Ctx): ApplyResult {
  return ctx.checkpoints ? { state: ctx.s, events: ctx.events, checkpoints: ctx.checkpoints } : { state: ctx.s, events: ctx.events };
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
    checkpoint(ctx);
    if (checkGameOver(ctx)) return;
  }
  endTurn(ctx);
}
