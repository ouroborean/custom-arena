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
  modifiedHealing,
} from './queries.js';
import type { DamageType, Unit } from './types.js';

export interface DamageArgs {
  source: Unit;
  target: Unit;
  amount: number;
  type: DamageType;
  direct: boolean;
  bypass: boolean;
  /** Per-effect exception: this damage never hits Invulnerable targets (Fire Explode, Q14). */
  respectsInvulnerable?: boolean;
}

/** Returns the damage actually dealt (absorbed by Shield + lost HP). */
export function dealDamage(ctx: Ctx, a: DamageArgs): number {
  const { source, target } = a;
  if (!target.alive) return 0;
  const enemy = isEnemy(source, target);

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

  const shattered = hasNoArmorOrShield(ctx, target);
  const taken = damageTakenBonus(ctx, target, a.type, a.direct);
  const bonus = damageDealtBonus(ctx, source, a.type, a.direct) + taken.other;
  const armor = shattered ? 0 : taken.armor;
  const amount = Math.max(0, a.amount + bonus + armor);
  const breakdown = { base: a.amount, bonus, armor };
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
  if (a.type !== 'Affliction' && !shattered) {
    for (const e of effectsOn(ctx.s, target.id)) {
      if (remaining === 0) break;
      if (!effectDef(ctx.c, e).shield) continue;
      const take = Math.min(e.value, remaining);
      e.value -= take;
      remaining -= take;
      absorbed += take;
      if (e.value <= 0) removeEffect(ctx, e, 'depleted');
    }
  }
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

  enqueueDamagedTriggers(ctx, source, target, a.direct);
  if (target.hp <= 0) killUnit(ctx, target);
  return amount;
}

function enqueueDamagedTriggers(ctx: Ctx, source: Unit, target: Unit, direct: boolean): void {
  for (const e of effectsOn(ctx.s, target.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'damaged') continue;
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
