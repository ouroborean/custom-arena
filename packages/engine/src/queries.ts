// Modifier queries (GDD §11.3). Every rules question that effects can bend is answered here by
// folding the ModifierSpecs of the relevant effect instances. Adding a new status never requires
// touching these functions unless it needs a brand-new modifier kind.

import { effectDef, effectsOn, isEnemy, type Ctx } from './ctx.js';
import type { DamageWhen, ModifierSpec, SkillClass, SkillDef } from './defs.js';
import { applyGenericModifier } from './energy.js';
import { evalCond, evalValue } from './ops.js';
import type { Cost, DamageType, EffectInstance, GameState, Unit } from './types.js';
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
      if (m.mod === kind) out.push({ spec: m as ModOf<K>, effect: e });
    }
  }
  return out;
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
  let delta = def.costAdjust === undefined ? 0 : evalValue(ctx, def.costAdjust, scope);
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, u.id, 'costGeneric')) delta += scaled(spec.amount, spec.perStack, effect);
  // Chilled: costs can't go down.
  if (delta < 0 && modsOn(ctx.s, ctx.c, u.id, 'noCostReduction').length > 0) delta = 0;
  return applyGenericModifier(base, delta);
}

export function cooldownOnUse(ctx: Ctx, u: Unit, def: SkillDef): number {
  let extra = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, u.id, 'cooldownOnUse')) extra += scaled(spec.amount, spec.perStack, effect);
  // GDD §3.5: remaining = n + 1 (+ modifiers), decremented at the end of each owner turn incl. this one.
  return Math.max(0, def.cooldown + extra) + 1;
}

// ---------------------------------------------------------------- acting & targeting

/** Why `u` can't use `def` right now, or null if it can. */
export function cannotUseReason(ctx: Ctx, u: Unit, def: SkillDef): string | null {
  if (!u.alive) return 'dead';
  if (def.tags.includes('UsableWhileStunned') || def.tags.includes('Unstunnable')) return null;
  const cls = skillClass(def);
  const harmful = def.tags.includes('Harmful');
  for (const { spec } of modsOn(ctx.s, ctx.c, u.id, 'cannotUseSkills')) {
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
export function canTarget(ctx: Ctx, source: Unit, target: Unit, bypass: boolean): boolean {
  if (!target.alive) return false;
  const enemy = isEnemy(source, target);
  if (enemy && !bypass && invulnerableToSource(ctx, source, target)) return false;
  for (const { spec } of modsOn(ctx.s, ctx.c, target.id, 'untargetable')) {
    if (bypass && spec.bypassable) continue;
    if (spec.by === 'enemies' && enemy) return false;
    if (spec.by === 'allies' && !enemy && source.id !== target.id) return false;
  }
  return true;
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

export function damageDealtBonus(ctx: Ctx, source: Unit, type: DamageType, direct: boolean): number {
  let n = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, source.id, 'damageDealt')) {
    if (damageWhenMatches(spec.when, type, direct)) n += scaled(spec.amount, spec.perStack, effect);
  }
  return n;
}

export function damageTakenBonus(ctx: Ctx, target: Unit, type: DamageType, direct: boolean): { other: number; armor: number } {
  let other = 0;
  let armor = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, target.id, 'damageTaken')) {
    if (!damageWhenMatches(spec.when, type, direct)) continue;
    const v = scaled(spec.amount, spec.perStack, effect);
    if (spec.armor) armor += v;
    else other += v;
  }
  return { other, armor };
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
