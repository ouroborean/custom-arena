// Turn structure (GDD §3.3): start-of-turn energy, end-of-turn ticks, duration countdown,
// cooldowns, win checks.

import { checkpoint, effectDef, effectKey, emit, livingCharacters, other, type Ctx } from './ctx.js';
import { removeEffect } from './effects.js';
import { enqueueFor, enqueueTriggers, expireEffect, flushTriggers } from './ops.js';
import { energyGainBonus, modsOn } from './queries.js';
import { landDrifting } from './pipeline.js';
import { pick } from './rng.js';
import { COLORS, type EffectInstance, type Energy } from './types.js';

export function checkGameOver(ctx: Ctx): boolean {
  if (ctx.s.phase === 'finished') return true;
  const a = livingCharacters(ctx.s, 0).length;
  const b = livingCharacters(ctx.s, 1).length;
  if (a > 0 && b > 0) return false;
  const result = a === 0 && b === 0 ? { winner: null, reason: 'draw' as const } : { winner: a === 0 ? (1 as const) : (0 as const), reason: 'elimination' as const };
  finish(ctx, result);
  return true;
}

export function finish(ctx: Ctx, result: { winner: 0 | 1 | null; reason: 'elimination' | 'draw' | 'surrender' | 'turnLimit' }): void {
  ctx.s.phase = 'finished';
  ctx.s.result = result;
  ctx.triggerQueue.length = 0;
  emit(ctx, { t: 'gameOver', result });
}

export function startTurn(ctx: Ctx): void {
  const p = ctx.s.activePlayer;
  emit(ctx, { t: 'turnStart', turn: ctx.s.turn, player: p });

  // Energy: 1 on the very first turn of the match, otherwise 1 per living character (not minions).
  const chars = livingCharacters(ctx.s, p);
  let count = ctx.s.turn === 1 ? 1 : chars.length;
  const spent: EffectInstance[] = [];
  for (const u of chars) count += energyGainBonus(ctx, u, spent);
  let gained: Energy = { S: 0, A: 0, I: 0, W: 0 };
  const fixed = ctx.s.settings.fixedEnergy;
  const forced = fixed?.player === p ? fixed.turns[ctx.s.players[p].turnsTaken] : undefined;
  if (forced) gained = { ...forced };
  else for (let i = 0; i < Math.max(0, count); i++) gained[pick(ctx.s.rng, COLORS)] += 1;
  for (const c of COLORS) ctx.s.players[p].energy[c] += gained[c];
  emit(ctx, { t: 'energyGained', player: p, gained }, p);
  for (const e of spent) {
    // Charged / Sapped fire once at 3 stacks; equipment hears it (Emblem of the Tempest).
    enqueueFor(ctx, e.bearer, 'energyFromEffect', { effectKey: effectKey(e), eventEffect: e.id });
    removeEffect(ctx, e, 'consumed');
  }

  // Cloud's Drift: last turn's drifting skills land now.
  landDrifting(ctx);
  for (const u of ctx.s.units) if (u.alive && u.owner === p && !isBanished(ctx, u.id)) enqueueTriggers(ctx, u.id, 'turnStart');
  flushTriggers(ctx);
  checkGameOver(ctx);
  checkpoint(ctx);
}

/** Dimension's Banished: the unit is out of the fight. */
function isBanished(ctx: Ctx, unitId: string): boolean {
  return modsOn(ctx.s, ctx.c, unitId, 'banished').length > 0 || modsOn(ctx.s, ctx.c, unitId, 'suspendEffects').length > 0;
}

/** Effects on a Banished unit neither tick nor count down (except the Banished effect itself). */
function frozen(ctx: Ctx, e: EffectInstance): boolean {
  if (!isBanished(ctx, e.bearer)) return false;
  return !(effectDef(ctx.c, e).modifiers ?? []).some((m) => m.mod === 'banished' || m.mod === 'suspendEffects');
}

function hasTurnEndTrigger(ctx: Ctx, e: EffectInstance): boolean {
  return (effectDef(ctx.c, e).triggers ?? []).some((t) => t.on === 'turnEnd');
}

/** The active player's ticking effects, in their chosen order (then application order). */
export function tickingEffects(ctx: Ctx): EffectInstance[] {
  const p = ctx.s.activePlayer;
  const mine = ctx.s.effects.filter((e) => e.sourceOwner === p && hasTurnEndTrigger(ctx, e) && !frozen(ctx, e));
  const order = ctx.s.players[p].tickOrder ?? [];
  const rank = (e: EffectInstance) => {
    const i = order.indexOf(e.id);
    return i < 0 ? order.length : i;
  };
  return [...mine].sort((a, b) => rank(a) - rank(b) || a.seq - b.seq);
}

export function endTurn(ctx: Ctx): void {
  const s = ctx.s;
  const p = s.activePlayer;

  // a. Ticks of effects this player applied (Q3), in their chosen order.
  for (const e of tickingEffects(ctx)) {
    if (!s.effects.includes(e)) continue;
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'turnEnd') continue;
      ctx.triggerQueue.push({ effect: e.id, spec, eventTarget: e.bearer });
    }
    flushTriggers(ctx);
    checkpoint(ctx);
    if (checkGameOver(ctx)) return;
  }

  // Glacier's Icebound: units frozen as the turn ends, before anything expires.
  const icebound = new Set(s.units.filter((u) => modsOn(s, ctx.c, u.id, 'freezeCooldowns').length > 0).map((u) => u.id));

  // b. Every effect on the board counts down; those reaching 0 expire (Q1).
  const expired: EffectInstance[] = [];
  for (const e of s.effects) {
    if (e.duration === null || frozen(ctx, e)) continue;
    e.duration -= 1;
    if (e.duration <= 0) expired.push(e);
  }
  for (const e of expired) {
    if (!s.effects.includes(e)) continue;
    expireEffect(ctx, e);
    checkGameOver(ctx);
  }
  if (s.phase === 'finished') return;
  flushTriggers(ctx);
  checkpoint(ctx);
  if (checkGameOver(ctx)) return;

  // c. The active player's cooldowns tick (owner's turns only, Q15).
  for (const u of s.units) {
    if (u.owner !== p) continue;
    // Glacier: Icebound freezes them; Meltwater ticks them faster (`thawed` counts skills it freed).
    if (icebound.has(u.id)) continue;
    const extra = modsOn(s, ctx.c, u.id, 'cooldownTick').reduce((n, { spec }) => n + spec.amount, 0);
    let thawed = 0;
    for (const slot of u.skills) {
      const before = Math.max(0, slot.cooldown - 1);
      slot.cooldown = Math.max(0, before - extra);
      if (before > 0 && slot.cooldown === 0) thawed++;
    }
    u.counters['c:thawed'] = thawed;
  }

  const ps = s.players[p];
  ps.turnsTaken += 1;
  ps.queue = [];
  ps.tickOrder = null;
  emit(ctx, { t: 'turnEnd', turn: s.turn, player: p });
  checkpoint(ctx);

  // Stalling backstop (R3): both players at the turn limit → draw.
  if (s.players[0].turnsTaken >= s.settings.turnLimitPerPlayer && s.players[1].turnsTaken >= s.settings.turnLimitPerPlayer) {
    finish(ctx, { winner: null, reason: 'turnLimit' });
    return;
  }

  s.activePlayer = other(p);
  s.turn += 1;
  startTurn(ctx);
}
