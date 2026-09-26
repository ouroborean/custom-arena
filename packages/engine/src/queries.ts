// Modifier queries (GDD §11.3). Every rules question that effects can bend is answered here by
// folding the ModifierSpecs of the relevant effect instances. Adding a new status never requires
// touching these functions unless it needs a brand-new modifier kind.

import { effectDef, effectsOn, isEnemy, type Ctx } from './ctx.js';
import type { DamageWhen, ModifierSpec, SkillClass, SkillDef } from './defs.js';
import { applyGenericModifier } from './energy.js';
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
  let delta = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, u.id, 'costGeneric')) delta += scaled(spec.amount, spec.perStack, effect);
  return applyGenericModifier(def.cost, delta);
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
  for (const { spec } of modsOn(ctx.s, ctx.c, u.id, 'cannotUseSkills')) {
    if (!spec.classes || spec.classes.includes(cls)) return 'stunned';
  }
  return null;
}

/** Can `source` pick `target` with a skill (single or AoE)? */
export function canTarget(ctx: Ctx, source: Unit, target: Unit, bypass: boolean): boolean {
  if (!target.alive) return false;
  const enemy = isEnemy(source, target);
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

export function energyGainBonus(ctx: Ctx, u: Unit): number {
  let n = 0;
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, u.id, 'energyGain')) n += scaled(spec.amount, false, effect);
  return n;
}
