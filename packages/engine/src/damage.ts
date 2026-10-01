// Damage and healing pipelines (GDD §3.7, decision Q5).
//
//   Type  (what mitigates it):  Normal → Armor + Shield,  Piercing → Shield,  Affliction → neither
//   Direct (what amplifies it): damage from a skill's use gets Might/Weakness/Vulnerable and fires
//                               "on direct damage" effects; triggered and ticking damage does not.

import { archetypeOf, effectDef, effectsOn, emit, findUnit, isEnemy, type Ctx, type PendingTrigger } from './ctx.js';
import { broadcastSignal, enqueueFor, runOps } from './ops.js';
import { applyEffect, interruptChannels, removeEffect } from './effects.js';
import {
  blocksIndirectDamage,
  canTarget,
  damageDealtBonus,
  damageTakenBonus,
  hasNoArmorOrShield,
  invulnerableToSource,
  modifiedHealing,
  modsOn,
  thresholdReduction,
} from './queries.js';
import { nextInt } from './rng.js';
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
  /** Skill (def id) dealing the damage, for equipment that cares ("your Strike skills"). */
  skill?: string;
  /** Not affected by any damage modifier (Cultist Scythe). */
  raw?: boolean;
  /** Already one share of a split hit (Life's Common Root): don't split again. */
  split?: boolean;
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

  // Blood's Bloodbound Familiar: it shares its summoner's HP, so the hit lands on them.
  const linked = hpLinkOf(ctx, target);
  if (linked) return dealDamage(ctx, { ...a, target: linked });

  // Rod of Domination: damage from others lands on a random allied minion instead.
  if (source !== target && modsOn(ctx.s, ctx.c, target.id, 'redirectDamage').length > 0) {
    const minions = ctx.s.units.filter((u) => u.alive && u.owner === target.owner && u.kind === 'minion');
    if (minions.length > 0) return dealDamage(ctx, { ...a, target: minions[nextInt(ctx.s.rng, minions.length)]! });
  }

  // Dimension's Banished: out of the fight, nothing reaches them.
  if (modsOn(ctx.s, ctx.c, target.id, 'banished').length > 0) {
    emit(ctx, { t: 'damageBlocked', source: source.id, target: target.id, reason: 'banished' });
    return 0;
  }

  // Life's Common Root: the hit is split evenly across every unit on that side that shares it.
  if (!a.split && modsOn(ctx.s, ctx.c, target.id, 'shareDamage').length > 0) {
    const group = ctx.s.units.filter((u) => u.alive && u.owner === target.owner && modsOn(ctx.s, ctx.c, u.id, 'shareDamage').length > 0);
    if (group.length > 1) {
      const share = Math.floor(a.amount / group.length);
      const rest = a.amount - share * group.length;
      let total = 0;
      for (const u of group) total += dealDamage(ctx, { ...a, target: u, amount: u === target ? share + rest : share, split: true });
      return total;
    }
  }

  // Cloud's Rain Check: the hit is held and lands later, smaller (as the held status's own damage).
  const defer = a.raw ? undefined : modsOn(ctx.s, ctx.c, target.id, 'deferHits')[0];
  if (defer && source !== target && ctx.c.statuses[defer.spec.status]) {
    applyEffect(ctx, {
      def: ctx.c.statuses[defer.spec.status]!,
      inline: false,
      bearer: target,
      source,
      value: Math.max(0, a.amount - defer.spec.reduceBy),
      duration: { raw: defer.spec.delay },
    });
    emit(ctx, { t: 'damageBlocked', source: source.id, target: target.id, reason: 'held' });
    return 0;
  }

  // Retribution: direct damage from enemies heals instead (after all damage modifiers).
  const heals = enemy && a.direct && modsOn(ctx.s, ctx.c, target.id, 'healFromDirectDamage').length > 0;

  const shattered = hasNoArmorOrShield(ctx, target);
  const taken = a.raw ? { other: 0, armor: 0, mul: 1 } : damageTakenBonus(ctx, target, a.type, a.direct, a.skill ? ctx.c.skills[a.skill] : undefined);
  const dealt = a.raw
    ? { bonus: 0, mul: 1 }
    : damageDealtBonus(ctx, source, a.type, a.direct, a.skill ? ctx.c.skills[a.skill] : undefined, target);
  let bonus = dealt.bonus + taken.other;
  // Big-hit reductions apply first, measured before Armor (Helmet of the Ancestors).
  if (!a.raw) bonus += thresholdReduction(ctx, target, a.type, a.direct, a.amount + bonus);
  const armor = shattered ? 0 : taken.armor;
  // Evolution's Adaptive Hide: what the target learned about this skill (rest of the match).
  const learned = a.direct && a.skill && enemy ? (target.counters[`adapt:${a.skill}`] ?? 0) : 0;
  const amount = Math.max(0, Math.round((a.amount + bonus + armor - learned) * dealt.mul * taken.mul));
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
  const hitShields: { e: EffectInstance; take: number }[] = [];
  if (a.type !== 'Affliction' && !shattered) {
    // The bearer's own Shields, then any Shield they borrow (Crystal's Latticework).
    const borrowed = modsOn(ctx.s, ctx.c, target.id, 'borrowShield')
      .map(({ effect }) => ctx.s.effects.find((x) => x.id === effect.data.linkedTo))
      .filter((x): x is EffectInstance => !!x && x.bearer !== target.id);
    for (const e of [...effectsOn(ctx.s, target.id), ...borrowed]) {
      if (remaining === 0) break;
      if (!effectDef(ctx.c, e).shield || !ctx.s.effects.includes(e)) continue;
      const take = Math.min(e.value, remaining);
      e.value -= take;
      remaining -= take;
      absorbed += take;
      if (take > 0) hitShields.push({ e, take });
      if (e.value <= 0) removeEffect(ctx, e, 'depleted');
    }
  }
  // Crystal's Diamond and Faceted Ward: caps on HP lost per hit and per turn.
  target.counters['c:hit_capped'] = 0; // content can ask whether the last hit was capped (Flawless Challenge)
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, target.id, 'maxHpLossPerHit')) {
    if (remaining <= spec.amount) continue;
    target.counters['c:hit_capped'] = 1;
    effect.data.prevented = ((effect.data.prevented as number | undefined) ?? 0) + remaining - spec.amount;
    remaining = spec.amount;
  }
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, target.id, 'maxHpLossPerTurn')) {
    if (effect.data.turn !== ctx.s.turn) {
      effect.data.turn = ctx.s.turn;
      effect.data.lost = 0;
    }
    const left = Math.max(0, spec.amount - (effect.data.lost as number));
    if (remaining > left) {
      effect.data.prevented = ((effect.data.prevented as number | undefined) ?? 0) + remaining - left;
      remaining = left;
    }
    effect.data.lost = (effect.data.lost as number) + remaining;
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

  enqueueDamagedTriggers(ctx, source, target, a.direct, a.wakes ?? true, a.skill, remaining + absorbed);
  // Anyone can listen for damage anywhere (Blood Chalice).
  broadcastSignal(ctx, 'unitDamaged', source, { target, eventSkill: a.skill });
  for (const { e, take } of hitShields) enqueueOn(ctx, e, 'shieldDamaged', source, target, a.direct, a.skill, take);
  // The bearer's other effects hear it too ("when their Shield breaks...": Wall of Bones, Bone Carapace).
  if (hitShields.length > 0) {
    const absorbedTotal = hitShields.reduce((n, h) => n + h.take, 0);
    for (const e of effectsOn(ctx.s, target.id)) {
      if (effectDef(ctx.c, e).shield) continue;
      enqueueOn(ctx, e, 'shieldDamaged', source, target, a.direct, a.skill, absorbedTotal);
    }
  }
  if (source !== target) {
    for (const e of effectsOn(ctx.s, source.id)) enqueueOn(ctx, e, 'dealtDamage', source, target, a.direct, a.skill, remaining);
  }
  if (enemy) target.lastAttacker = source.id;
  if (enemy && a.direct && a.skill && modsOn(ctx.s, ctx.c, target.id, 'adaptiveHide').length > 0) {
    target.counters[`adapt:${a.skill}`] = Math.min(15, (target.counters[`adapt:${a.skill}`] ?? 0) + 5);
  }
  if (target.hp <= 0) killUnit(ctx, target, source, a.skill);
  return amount;
}

/** `amount`: the hit's size (HP lost plus Shield absorbed), as eventAmount. */
function enqueueDamagedTriggers(ctx: Ctx, source: Unit, target: Unit, direct: boolean, wakes: boolean, skill: string | undefined, amount: number): void {
  for (const e of effectsOn(ctx.s, target.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'damaged') continue;
      if (spec.when?.wakes && !wakes) continue;
      if (spec.when?.archetypes && !spec.when.archetypes.includes(archetypeOf(ctx.c, skill) ?? '')) continue;
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
      const p: PendingTrigger = {
        effect: e.id,
        inst: e,
        spec,
        eventSource: source.id,
        eventTarget: target.id,
        eventAmount: amount,
        ...(skill ? { eventSkill: skill } : {}),
      };
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
  skill?: string,
  amount?: number,
): void {
  for (const spec of effectDef(ctx.c, e).triggers ?? []) {
    if (spec.on !== on) continue;
    if (spec.when?.direct !== undefined && spec.when.direct !== direct) continue;
    if (spec.when?.byEnemy && !isEnemy(source, target)) continue;
    if (spec.when?.archetypes && !spec.when.archetypes.includes(archetypeOf(ctx.c, skill) ?? '')) continue;
    ctx.triggerQueue.push({
      effect: e.id,
      inst: e,
      spec,
      eventSource: source.id,
      eventTarget: target.id,
      ...(amount !== undefined ? { eventAmount: amount } : {}),
      ...(skill ? { eventSkill: skill } : {}),
    });
  }
}

/** The summoner whose HP an `hpLink` minion shares, if it's alive. */
function hpLinkOf(ctx: Ctx, u: Unit): Unit | undefined {
  if (!u.summonedBy || modsOn(ctx.s, ctx.c, u.id, 'hpLink').length === 0) return undefined;
  const s = findUnit(ctx.s, u.summonedBy);
  return s?.alive ? s : undefined;
}

/** `raw`: healing modifiers don't apply; `quiet`: no healing triggers (Revered Crown). */
export function heal(ctx: Ctx, source: Unit, target: Unit, amount: number, opts: { raw?: boolean | undefined; quiet?: boolean | undefined } = {}): number {
  if (!target.alive || amount <= 0) return 0;
  const linked = hpLinkOf(ctx, target);
  if (linked) return heal(ctx, source, linked, amount, opts);
  // Evil's Unhallowed: the healing hurts instead (its 'healed' triggers still hear it).
  if (modsOn(ctx.s, ctx.c, target.id, 'invertHealing').length > 0) {
    const hurt = opts.raw ? amount : modifiedHealing(ctx, target, amount);
    if (!opts.quiet) enqueueFor(ctx, target.id, 'healed', { eventSource: source.id, eventTarget: target.id, eventAmount: hurt });
    dealDamage(ctx, { source, target, amount: hurt, type: 'Affliction', direct: false, bypass: true, raw: true });
    return 0;
  }
  const healed = Math.min(opts.raw ? amount : modifiedHealing(ctx, target, amount), target.maxHp - target.hp);
  // When each unit was last healed (Evil's Cruel Blade reads it).
  if (healed > 0) target.counters['c:healed_turn'] = ctx.s.turn;
  target.hp += healed;
  emit(ctx, { t: 'heal', source: source.id, target: target.id, amount: healed, hp: target.hp });
  if (healed > 0 && !opts.quiet) {
    enqueueFor(ctx, target.id, 'healed', { eventSource: source.id, eventTarget: target.id, eventAmount: healed });
    enqueueFor(ctx, source.id, 'healDone', { eventSource: source.id, eventTarget: target.id, eventAmount: healed });
  }
  return healed;
}

export function killUnit(ctx: Ctx, u: Unit, killer?: Unit, skill?: string): void {
  if (!u.alive) return;
  u.alive = false;
  u.hp = 0;
  u.counters['c:died_turn'] = ctx.s.turn;
  emit(ctx, { t: 'died', unit: u.id });
  // "When an ally dies…": everyone hears it, with what the unit carried at the time.
  broadcastSignal(ctx, 'died', killer ?? u, { target: u, snapshot: effectsOn(ctx.s, u.id).slice(), eventSkill: skill });
  // Zealot's Martyr (and similar): effects that act as their bearer falls.
  for (const e of effectsOn(ctx.s, u.id)) {
    const ops = effectDef(ctx.c, e).onDeath;
    if (!ops?.length || !findUnit(ctx.s, e.source)) continue;
    runOps(ctx, ops, {
      actor: e.source,
      bearer: u.id,
      self: e,
      targets: e.targets,
      vars: {},
      lastDamage: 0,
      lastDamaged: [],
      direct: false,
      bypass: false,
      ...(killer ? { eventSource: killer.id } : {}),
    });
  }
  interruptChannels(ctx, u, 'death');
  const onDeath = u.kind === 'minion' ? ctx.c.minions[u.defId]?.onDeath : undefined;
  if (onDeath?.length) {
    runOps(ctx, onDeath, { actor: u.id, targets: [], vars: {}, lastDamage: 0, lastDamaged: [], direct: false, bypass: false });
  }
  // Dimension's Entangled: a death breaks every link it was part of.
  const groups = new Set(modsOn(ctx.s, ctx.c, u.id, 'entangleLink').map(({ effect }) => effect.data.group));
  for (const e of effectsOn(ctx.s, u.id)) removeEffect(ctx, e, 'died');
  // The dead unit drops out of each link; a link left with a single member ends.
  for (const g of groups) {
    const rest = ctx.s.effects.filter((x) => x.data.group === g && x.bearer !== u.id);
    if (new Set(rest.map((x) => x.bearer)).size < 2) for (const e of rest) removeEffect(ctx, e, 'removed');
  }
  // Auras granted by this unit (e.g. a minion's gift to its owner) end with it.
  for (const e of ctx.s.effects.filter((x) => x.data.boundTo === u.id)) removeEffect(ctx, e, 'removed');
}
