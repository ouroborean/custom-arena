// Damage and healing pipelines (GDD §3.7, decision Q5).
//
//   Type  (what mitigates it):  Normal → Armor + Shield,  Piercing → Shield,  Affliction → neither
//   Direct (what amplifies it): damage from a skill's use gets Might/Weakness/Vulnerable and fires
//                               "on direct damage" effects; triggered and ticking damage does not.

import { effectDef, effectsOn, emit, isEnemy, type Ctx, type PendingTrigger } from './ctx.js';
import { interruptChannels, removeEffect } from './effects.js';
import {
  blocksIndirectDamage,
  canTarget,
  damageDealtBonus,
  damageTakenBonus,
  hasNoArmorOrShield,
  invulnerableToSource,
  modifiedHealing,
  modsOn,
} from './queries.js';
import type { DamageType, EffectInstance, Unit } from './types.js';

export interface DamageArgs {
  source: Unit;
  target: Unit;
  amount: number;
  type: DamageType;
  direct: boolean;
  bypass: boolean;
  /** Per-effect exception: this damage never hits Invulnerable targets (Fire Explode, Q14). */
  respectsInvulnerable?: boolean;
  /** `false`: doesn't end Sleep. */
  wakes?: boolean;
}

/** Returns the damage actually dealt (absorbed by Shield + lost HP). */
export function dealDamage(ctx: Ctx, a: DamageArgs): number {
  const { source, target } = a;
  if (!target.alive) return 0;
  const enemy = isEnemy(source, target);

  if (enemy && !a.bypass && invulnerableToSource(ctx, source, target)) {
    emit(ctx, { t: 'damageBlocked', source: source.id, target: target.id, reason: 'invulnerable to that source' });
    return 0;
  }
  if (enemy && a.direct && !canTarget(ctx, source, target, a.bypass)) {
    emit(ctx, { t: 'damageBlocked', source: source.id, target: target.id, reason: 'untargetable' });
    return 0;
  }
  if (
    enemy &&
    !a.direct &&
    !a.bypass &&
    blocksIndirectDamage(ctx, target) &&
    (a.type !== 'Affliction' || a.respectsInvulnerable)
  ) {
    emit(ctx, { t: 'damageBlocked', source: source.id, target: target.id, reason: 'invulnerable' });
    return 0;
  }

  // Retribution: direct damage from enemies heals instead (after all damage modifiers).
  const heals = enemy && a.direct && modsOn(ctx.s, ctx.c, target.id, 'healFromDirectDamage').length > 0;

  const shattered = hasNoArmorOrShield(ctx, target);
  const taken = damageTakenBonus(ctx, target, a.type, a.direct);
  const bonus = damageDealtBonus(ctx, source, a.type, a.direct) + taken.other;
  const armor = shattered ? 0 : taken.armor;
  const amount = Math.max(0, a.amount + bonus + armor);
  const breakdown = { base: a.amount, bonus, armor };
  if (heals) {
    heal(ctx, source, target, amount);
    return 0;
  }
  if (amount === 0) {
    emit(ctx, {
      t: 'damage',
      source: source.id,
      target: target.id,
      amount: 0,
      absorbed: 0,
      type: a.type,
      direct: a.direct,
      hp: target.hp,
      ...breakdown,
    });
    return 0;
  }

  let remaining = amount;
  let absorbed = 0;
  const hitShields: EffectInstance[] = [];
  if (a.type !== 'Affliction' && !shattered) {
    for (const e of effectsOn(ctx.s, target.id)) {
      if (remaining === 0) break;
      if (!effectDef(ctx.c, e).shield) continue;
      const take = Math.min(e.value, remaining);
      e.value -= take;
      remaining -= take;
      absorbed += take;
      if (take > 0) hitShields.push(e);
      if (e.value <= 0) removeEffect(ctx, e, 'depleted');
    }
  }
  // Immortal: HP can't be pushed below the floor (HP already under it doesn't drop further).
  const floors = modsOn(ctx.s, ctx.c, target.id, 'hpFloor').map(({ spec }) => spec.amount);
  if (floors.length > 0) remaining = Math.min(remaining, Math.max(0, target.hp - Math.max(...floors)));
  target.hp -= remaining;
  emit(ctx, {
    t: 'damage',
    source: source.id,
    target: target.id,
    amount: remaining,
    absorbed,
    type: a.type,
    direct: a.direct,
    hp: Math.max(0, target.hp),
    ...breakdown,
  });

  // Lifesteal: heal for the Health removed from another character (not Shield, not minions).
  if (remaining > 0 && source !== target && target.kind === 'character' && source.alive) {
    if (modsOn(ctx.s, ctx.c, source.id, 'lifesteal').length > 0) heal(ctx, source, source, remaining);
  }

  enqueueDamagedTriggers(ctx, source, target, a.direct, a.wakes ?? true);
  for (const e of hitShields) enqueueOn(ctx, e, 'shieldDamaged', source, target, a.direct);
  if (source !== target) {
    for (const e of effectsOn(ctx.s, source.id)) enqueueOn(ctx, e, 'dealtDamage', source, target, a.direct);
  }
  if (target.hp <= 0) killUnit(ctx, target);
  return amount;
}

function enqueueDamagedTriggers(ctx: Ctx, source: Unit, target: Unit, direct: boolean, wakes: boolean): void {
  for (const e of effectsOn(ctx.s, target.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'damaged') continue;
      if (spec.when?.wakes && !wakes) continue;
      if (spec.when?.direct !== undefined && spec.when.direct !== direct) continue;
      if (spec.when?.byEnemy && !isEnemy(source, target)) continue;
      if (spec.when?.fromSide) {
        const side = source.owner === e.sourceOwner ? 'ally' : 'enemy';
        if (side !== spec.when.fromSide) continue;
      }
      if (spec.consume) {
        if (e.data.pendingConsume) continue;
        e.data.pendingConsume = true;
      }
      const p: PendingTrigger = { effect: e.id, inst: e, spec, eventSource: source.id, eventTarget: target.id };
      ctx.triggerQueue.push(p);
    }
  }
}

/** Queues `e`'s triggers for a damage-related event (the damager is always the event source). */
function enqueueOn(
  ctx: Ctx,
  e: EffectInstance,
  on: 'shieldDamaged' | 'dealtDamage',
  source: Unit,
  target: Unit,
  direct: boolean,
): void {
  for (const spec of effectDef(ctx.c, e).triggers ?? []) {
    if (spec.on !== on) continue;
    if (spec.when?.direct !== undefined && spec.when.direct !== direct) continue;
    if (spec.when?.byEnemy && !isEnemy(source, target)) continue;
    ctx.triggerQueue.push({ effect: e.id, inst: e, spec, eventSource: source.id, eventTarget: target.id });
  }
}

export function heal(ctx: Ctx, source: Unit, target: Unit, amount: number): number {
  if (!target.alive || amount <= 0) return 0;
  const healed = Math.min(modifiedHealing(ctx, target, amount), target.maxHp - target.hp);
  target.hp += healed;
  emit(ctx, { t: 'heal', source: source.id, target: target.id, amount: healed, hp: target.hp });
  return healed;
}

export function killUnit(ctx: Ctx, u: Unit): void {
  if (!u.alive) return;
  u.alive = false;
  u.hp = 0;
  emit(ctx, { t: 'died', unit: u.id });
  interruptChannels(ctx, u, 'death');
  for (const e of effectsOn(ctx.s, u.id)) removeEffect(ctx, e, 'died');
  // Auras granted by this unit (e.g. a minion's gift to its owner) end with it.
  for (const e of ctx.s.effects.filter((x) => x.data.boundTo === u.id)) removeEffect(ctx, e, 'removed');
}
