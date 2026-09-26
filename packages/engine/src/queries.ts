// Modifier queries (GDD §11.3). Every rules question that effects can bend is answered here by
// folding the ModifierSpecs of the relevant effect instances. Adding a new status never requires
// touching these functions unless it needs a brand-new modifier kind.

import { effectDef, effectsOn, isEnemy, makeCtx, type Ctx } from './ctx.js';
import type { DamageWhen, ModifierSpec, SkillClass, SkillDef, SkillTag } from './defs.js';
import { applyGenericModifier, costTotal } from './energy.js';
import { evalCond, evalValue } from './ops.js';
import { COLORS, type Color, type Cost, type DamageType, type EffectInstance, type GameState, type Unit } from './types.js';
import type { ContentBundle } from './defs.js';

type ModOf<K extends ModifierSpec['mod']> = Extract<ModifierSpec, { mod: K }>;

export function modsOn<K extends ModifierSpec['mod']>(
  s: GameState,
  c: ContentBundle,
  bearer: string,
  kind: K,
): { spec: ModOf<K>; effect: EffectInstance }[] {
  const out: { spec: ModOf<K>; effect: EffectInstance }[] = [];
  for (const e of effectsOn(s, bearer)) {
    for (const m of effectDef(c, e).modifiers ?? []) {
      if (m.mod !== kind) continue;
      // Conditional modifiers (equipment: "while at or above 80 Health") are checked for the bearer.
      if (m.if && !evalCond(makeCtx(s, c), m.if, bearerScope(bearer))) continue;
      out.push({ spec: m as ModOf<K>, effect: e });
    }
  }
  return out;
}

function bearerScope(id: string) {
  return { actor: id, bearer: id, it: id, targets: [], vars: {}, lastDamage: 0, lastDamaged: [], direct: false, bypass: false };
}

/** modsOn, keeping only modifiers whose archetype / tag filters (if any) match `skill`. */
export function modsFor<K extends ModifierSpec['mod']>(
  ctx: Ctx,
  bearer: string,
  kind: K,
  skill: SkillDef | undefined,
): { spec: ModOf<K>; effect: EffectInstance }[] {
  return modsOn(ctx.s, ctx.c, bearer, kind).filter(
    ({ spec }) =>
      (!spec.archetypes || (!!skill && spec.archetypes.includes(skill.archetype))) &&
      (!spec.skillsWith || (!!skill && spec.skillsWith.some((t) => skill.tags.includes(t)))),
  );
}

/** A skill's tags after the user's modifiers (equipment can add Bypass, Uncounterable, …). */
export function effectiveTags(ctx: Ctx, u: Unit, def: SkillDef): SkillTag[] {
  const mods = modsFor(ctx, u.id, 'skillTags', def);
  if (mods.length === 0) return def.tags;
  const tags = new Set(def.tags);
  for (const { spec } of mods) {
    for (const t of spec.remove ?? []) tags.delete(t);
    for (const t of spec.add ?? []) tags.add(t);
  }
  return [...tags];
}

/** Equipment forbidding `def` from picking `target` (Hand of Healing: not yourself). */
export function isExcludedTarget(ctx: Ctx, u: Unit, def: SkillDef, target: Unit): boolean {
  return modsFor(ctx, u.id, 'targetExclude', def).some(({ spec }) => evalCond(ctx, spec.where, { ...bearerScope(u.id), it: target.id }));
}

/** An equipment rule letting `def` also target `target` (and how it resolves then), if any. */
export function extraTargetFor(ctx: Ctx, u: Unit, def: SkillDef, target: Unit): ModOf<'extraTargets'> | null {
  for (const { spec } of modsFor(ctx, u.id, 'extraTargets', def)) {
    // Casting "as the target" only makes sense for skills that act on their user.
    if (spec.castAs && def.target !== 'self') continue;
    if (evalCond(ctx, spec.where, { ...bearerScope(u.id), it: target.id })) return spec;
  }
  return null;
}

function scaled(amount: number, perStack: boolean | undefined, e: EffectInstance): number {
  return perStack ? amount * e.stacks : amount;
}

function damageWhenMatches(when: DamageWhen | undefined, type: DamageType, direct: boolean): boolean {
  if (!when) return true;
  if (when.direct !== undefined && when.direct !== direct) return false;
  if (when.types && !when.types.includes(type)) return false;
  return true;
}

export function skillClass(def: SkillDef): SkillClass {
  return def.tags.includes('Strategic') ? 'Strategic' : 'NonStrategic';
}

// ---------------------------------------------------------------- costs & cooldowns

export function modifiedCost(ctx: Ctx, u: Unit, def: SkillDef): Cost {
  const scope = { actor: u.id, targets: [], vars: {}, lastDamage: 0, lastDamaged: [], direct: true, bypass: false };
  const base = def.altCost && evalCond(ctx, def.altCost.when, scope) ? def.altCost.cost : def.cost;
  const chilled = modsOn(ctx.s, ctx.c, u.id, 'noCostReduction').length > 0;
  // "Costs no energy" (Chilled still stops it: costs can't go down).
  if (!chilled && modsFor(ctx, u.id, 'freeSkills', def).length > 0) return { S: 0, A: 0, I: 0, W: 0, r: 0 };
  let delta = def.costAdjust === undefined ? 0 : evalValue(ctx, def.costAdjust, scope);
  for (const { spec, effect } of modsFor(ctx, u.id, 'costGeneric', def)) delta += scaled(spec.amount, spec.perStack, effect);
  // Chilled: costs can't go down.
  if (delta < 0 && chilled) delta = 0;
  // "All costs become GEN": every specific pip turns into a random one.
  let shaped: Cost = modsFor(ctx, u.id, 'costToRandom', def).length > 0 ? { S: 0, A: 0, I: 0, W: 0, r: costTotal(base) } : { ...base };
  // "1 less Specific energy": drop pips of the most common color.
  let fewer = chilled ? 0 : -modsFor(ctx, u.id, 'costSpecific', def).reduce((n, { spec }) => n + Math.min(0, spec.amount), 0);
  while (fewer > 0) {
    const c = COLORS.reduce<Color | null>((best, x) => (shaped[x] > 0 && (best === null || shaped[x] > shaped[best]) ? x : best), null);
    if (c === null) break;
    shaped = { ...shaped, [c]: shaped[c] - 1 };
    fewer -= 1;
  }
  return applyGenericModifier(shaped, delta);
}

export function cooldownOnUse(ctx: Ctx, u: Unit, def: SkillDef): number {
  let extra = 0;
  let floor = 0;
  for (const { spec, effect } of modsFor(ctx, u.id, 'cooldownOnUse', def)) {
    extra += scaled(spec.amount, spec.perStack, effect);
    // "1 less cooldown, to a minimum of 1": never below 1, but a 0-cooldown skill isn't raised.
    if (spec.min !== undefined) floor = Math.max(floor, Math.min(spec.min, def.cooldown));
  }
  // GDD §3.5: remaining = n + 1 (+ modifiers), decremented at the end of each owner turn incl. this one.
  return Math.max(floor, def.cooldown + extra) + 1;
}

// ---------------------------------------------------------------- acting & targeting

/** Why `u` can't use `def` right now, or null if it can. */
export function cannotUseReason(ctx: Ctx, u: Unit, def: SkillDef): string | null {
  if (!u.alive) return 'dead';
  const tags = effectiveTags(ctx, u, def);
  if (tags.includes('UsableWhileStunned') || tags.includes('Unstunnable')) return null;
  const cls = skillClass(def);
  const harmful = def.tags.includes('Harmful');
  for (const { spec } of modsFor(ctx, u.id, 'cannotUseSkills', def)) {
    if (spec.classes && !spec.classes.includes(cls)) continue;
    if (spec.harmful !== undefined && spec.harmful !== harmful) continue;
    return 'stunned';
  }
  return null;
}

/** Frostborn-style: does `target` ignore `source` because the source carries one of the listed effects? */
export function invulnerableToSource(ctx: Ctx, source: Unit, target: Unit): boolean {
  for (const { spec } of modsOn(ctx.s, ctx.c, target.id, 'invulnerableTo')) {
    if (spec.sourceHas.some((k) => effectsOn(ctx.s, source.id).some((e) => (e.inline ? e.inline.id : e.defId) === k))) return true;
  }
  return false;
}

/** Can `source` pick `target` with a skill (single or AoE)? */
export function canTarget(ctx: Ctx, source: Unit, target: Unit, bypassing: boolean): boolean {
  if (!target.alive) return false;
  const bypass = bypassing || exposedTo(ctx, source, target);
  const enemy = isEnemy(source, target);
  if (enemy && !bypass && invulnerableToSource(ctx, source, target)) return false;
  for (const { spec } of modsOn(ctx.s, ctx.c, target.id, 'untargetable')) {
    if (bypass && spec.bypassable) continue;
    if (spec.by === 'enemies' && enemy) return false;
    if (spec.by === 'allies' && !enemy && source.id !== target.id) return false;
  }
  return true;
}

/** Boomerang Blade: the source's skills Bypass against a target it marked. */
export function exposedTo(ctx: Ctx, source: Unit, target: Unit): boolean {
  return modsOn(ctx.s, ctx.c, target.id, 'exposed').some(({ effect }) => effect.source === source.id);
}

/** Taunt sources that constrain `u`'s enemy targeting (the effect's source must be the target). */
export function forcedTargets(ctx: Ctx, u: Unit): string[] {
  return modsOn(ctx.s, ctx.c, u.id, 'forceTarget').map(({ effect }) => effect.source);
}

/** Flow: the unit's skills ignore counters and reflects. */
export function ignoresCounters(ctx: Ctx, u: Unit): boolean {
  return modsOn(ctx.s, ctx.c, u.id, 'ignoreCounters').length > 0;
}

/** Ghosted: the unit's skills Bypass. */
export function hasGrantBypass(ctx: Ctx, u: Unit): boolean {
  return modsOn(ctx.s, ctx.c, u.id, 'grantBypass').length > 0;
}

export function blocksIndirectDamage(ctx: Ctx, target: Unit): boolean {
  return modsOn(ctx.s, ctx.c, target.id, 'blockIndirectDamage').length > 0;
}

export function hasNoArmorOrShield(ctx: Ctx, target: Unit): boolean {
  return modsOn(ctx.s, ctx.c, target.id, 'noArmorOrShield').length > 0;
}

// ---------------------------------------------------------------- damage

/**
 * Damage bonuses from the source's modifiers. `skill` is the skill dealing the damage (archetype
 * filters), `target` feeds `target` conditions and `value` expressions; `mul` multiplies the total.
 * Only called while dealing damage: one-target-per-turn modifiers pick their target here.
 */
export function damageDealtBonus(
  ctx: Ctx,
  source: Unit,
  type: DamageType,
  direct: boolean,
  skill?: SkillDef,
  target?: Unit,
): { bonus: number; mul: number } {
  let bonus = 0;
  let mul = 1;
  for (const { spec, effect } of modsFor(ctx, source.id, 'damageDealt', skill)) {
    if (!damageWhenMatches(spec.when, type, direct)) continue;
    const sc = { ...bearerScope(source.id), ...(target ? { it: target.id } : {}), ...(skill ? { skill } : {}) };
    if (spec.target && (!target || !evalCond(ctx, spec.target, sc))) continue;
    if (spec.onePerTurn) {
      if (!target) continue;
      if (effect.data.pickedTurn !== ctx.s.turn) {
        effect.data.pickedTurn = ctx.s.turn;
        effect.data.pickedUnit = target.id;
      } else if (effect.data.pickedUnit !== target.id) continue;
    }
    if (spec.mul !== undefined) mul *= spec.mul;
    bonus += spec.value !== undefined ? evalValue(ctx, spec.value, sc) : scaled(spec.amount, spec.perStack, effect);
  }
  return { bonus, mul };
}

export function damageTakenBonus(
  ctx: Ctx,
  target: Unit,
  type: DamageType,
  direct: boolean,
): { other: number; armor: number; mul: number } {
  let other = 0;
  let armor = 0;
  let mul = 1;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, target.id, 'damageTaken')) {
    if (spec.atLeast !== undefined) continue; // see thresholdReduction
    if (!damageWhenMatches(spec.when, type, direct)) continue;
    if (spec.mul !== undefined) mul *= spec.mul;
    const v = spec.value !== undefined ? evalValue(ctx, spec.value, bearerScope(target.id)) : scaled(spec.amount, spec.perStack, effect);
    if (spec.armor) armor += v;
    else other += v;
  }
  // Emblem of the Glacier: Armor counts double.
  for (const { spec } of modsOn(ctx.s, ctx.c, target.id, 'armorMul')) armor *= spec.mul;
  return { other, armor, mul };
}

/**
 * "If you would take 30 or more damage, first lower it by 10": reductions that only apply to big
 * hits (measured before Armor). Once-per-turn ones are used up here.
 */
export function thresholdReduction(ctx: Ctx, target: Unit, type: DamageType, direct: boolean, incoming: number): number {
  let n = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, target.id, 'damageTaken')) {
    if (spec.atLeast === undefined || incoming < spec.atLeast) continue;
    if (!damageWhenMatches(spec.when, type, direct)) continue;
    if (spec.oncePerTurn) {
      if (effect.data.usedTurn === ctx.s.turn) continue;
      effect.data.usedTurn = ctx.s.turn;
    }
    n += spec.value !== undefined ? evalValue(ctx, spec.value, bearerScope(target.id)) : scaled(spec.amount, spec.perStack, effect);
  }
  return n;
}

/** Healing after `healingReceived` modifiers (e.g. Scorched: ×0.5, rounded up to a multiple of 5). */
export function modifiedHealing(ctx: Ctx, target: Unit, amount: number): number {
  let n = amount;
  for (const { spec } of modsOn(ctx.s, ctx.c, target.id, 'healingReceived')) {
    n *= spec.mul;
    if (spec.roundUpTo) n = Math.ceil(n / spec.roundUpTo) * spec.roundUpTo;
  }
  return Math.max(0, Math.round(n));
}

/** Energy modifiers for `u`'s owner's generation; threshold effects that fired are added to `spent`. */
export function energyGainBonus(ctx: Ctx, u: Unit, spent: EffectInstance[] = []): number {
  let n = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, u.id, 'energyGain')) {
    if (spec.atStacks !== undefined) {
      if (effect.stacks < spec.atStacks) continue;
      spent.push(effect);
    }
    n += scaled(spec.amount, false, effect);
  }
  return n;
}
