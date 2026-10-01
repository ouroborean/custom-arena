// The skill DSL interpreter (GDD §11.5) and the trigger queue (GDD §11.4).

import {
  archetypeOf,
  effectDef,
  effectsOn,
  emit,
  findUnit,
  hasEffect,
  isEnemy,
  livingUnits,
  MAX_TRIGGER_CHAIN,
  nextId,
  resolveEffectDef,
  stacksOf,
  unit,
  type Ctx,
  type PendingTrigger,
} from './ctx.js';
import { dealDamage, heal, killUnit } from './damage.js';
import { costTotal } from './energy.js';
import type { Cond, DurationSpec, EffectDef, NamedSelector, Op, ResolvedDuration, Selector, SkillDef, TriggerSpec, Value } from './defs.js';
import { applyEffect, interruptChannels, isProtected, removeEffect, restack, revealEffect } from './effects.js';
import { canTarget, modsOn } from './queries.js';
import { nextInt, pick, sample } from './rng.js';
import { COLORS, type EffectInstance, type Energy, type SkillSlot, type Unit, type UnitId } from './types.js';

export interface Scope {
  actor: UnitId;
  targets: UnitId[];
  bearer?: UnitId;
  /** The effect whose trigger / expiry is executing. */
  self?: EffectInstance;
  eventSource?: UnitId;
  eventTarget?: UnitId;
  eventTargets?: UnitId[];
  it?: UnitId;
  vars: Record<string, number | boolean>;
  lastDamage: number;
  /** Healing the most recent heal op couldn't give (target full). */
  lastOverheal?: number;
  lastDamaged: UnitId[];
  lastSummoned?: UnitId;
  /** Default for damage ops: true for a skill's own ops, false for triggers and ticks. */
  direct: boolean;
  bypass: boolean;
  skill?: SkillDef | undefined;
  /** Slot of the skill being used (for resetCooldown). */
  slot?: number;
  /** Skill (def id) behind the event that started this trigger. */
  eventSkill?: string;
  /** Effect (instance id) the event is about. */
  eventEffect?: string;
  eventAmount?: number;
  /** Effects the event's unit carried at the time (deaths). */
  snapshot?: EffectInstance[];
  /** Duration of the event's effect when it has no instance (a negated Stun). */
  eventDuration?: number | null;
}

export type ScriptFn = (ctx: Ctx, scope: Scope, params: Record<string, unknown>) => void;

/** Registered escape-hatch scripts (GDD §11.6). Keep this list short and generic. */
export const scripts: Record<string, ScriptFn> = {};

// ---------------------------------------------------------------- selectors

function one(ctx: Ctx, id: UnitId | undefined): Unit[] {
  if (id === undefined) return [];
  const u = findUnit(ctx.s, id);
  return u ? [u] : [];
}

function selectNamed(ctx: Ctx, sel: NamedSelector, sc: Scope): Unit[] {
  const actor = unit(ctx, sc.actor);
  switch (sel) {
    case 'actor':
      return [actor];
    case 'targets':
      return sc.targets.map((id) => unit(ctx, id)).filter((u) => u.alive);
    case 'primary':
      return one(ctx, sc.targets[0]).filter((u) => u.alive);
    case 'primaryAllies': {
      const p = one(ctx, sc.targets[0])[0];
      if (!p) return [];
      return livingUnits(ctx.s, p.owner).filter((u) => u.id !== p.id && canTarget(ctx, actor, u, sc.bypass));
    }
    case 'allEnemies':
      return ctx.s.units.filter((u) => u.alive && isEnemy(actor, u) && canTarget(ctx, actor, u, sc.bypass));
    case 'allAllies':
      return livingUnits(ctx.s, actor.owner).filter((u) => canTarget(ctx, actor, u, sc.bypass));
    case 'bearer':
      return one(ctx, sc.bearer);
    case 'eventSource':
      return one(ctx, sc.eventSource);
    case 'eventTarget':
      return one(ctx, sc.eventTarget);
    case 'effectTargets':
      return (sc.self?.targets ?? []).flatMap((id) => one(ctx, id));
    case 'it':
      return one(ctx, sc.it);
    case 'lastDamaged':
      return sc.lastDamaged.flatMap((id) => one(ctx, id));
    case 'summoner':
      return one(ctx, actor.summonedBy);
    case 'eventTargets':
      return (sc.eventTargets ?? []).flatMap((id) => one(ctx, id)).filter((u) => u.alive);
    case 'eventPrimary':
      return one(ctx, sc.eventTargets?.[0]).filter((u) => u.alive);
    case 'lastSummoned':
      return sc.lastSummoned ? one(ctx, sc.lastSummoned) : [];
    case 'allUnits':
      return ctx.s.units.filter((u) => u.alive);
    // Fusion kits: "the ally with the least HP", "the enemy with the least / most HP" (characters
    // only; ties go to the earliest in team order).
    case 'weakestAlly':
      return extremeHp(livingUnits(ctx.s, actor.owner).filter((u) => u.kind === 'character' && canTarget(ctx, actor, u, sc.bypass)), 'min');
    case 'weakestEnemy':
      return extremeHp(ctx.s.units.filter((u) => u.alive && u.kind === 'character' && isEnemy(actor, u) && canTarget(ctx, actor, u, sc.bypass)), 'min');
    case 'bearerAllies': {
      const b = one(ctx, sc.bearer)[0];
      if (!b) return [];
      return livingUnits(ctx.s, b.owner).filter((u) => u.id !== b.id);
    }
    case 'randomBearerAlly': {
      const b = one(ctx, sc.bearer)[0];
      if (!b) return [];
      return sample(ctx.s.rng, livingUnits(ctx.s, b.owner).filter((u) => u.id !== b.id), 1);
    }
    case 'primaryPartners': {
      const p = sc.targets[0];
      if (!p) return [];
      const groups = new Set(
        modsOn(ctx.s, ctx.c, p, 'entangleLink').map(({ effect }) => effect.data.group),
      );
      const ids = new Set(ctx.s.effects.filter((x) => groups.has(x.data.group) && x.bearer !== p).map((x) => x.bearer));
      return [...ids].flatMap((id) => one(ctx, id)).filter((u) => u.alive);
    }
    case 'lastAttacker': {
      const u = actor.lastAttacker ? findUnit(ctx.s, actor.lastAttacker) : undefined;
      return u?.alive ? [u] : [];
    }
    case 'summonerLastAttacker': {
      const s = actor.summonedBy ? findUnit(ctx.s, actor.summonedBy) : undefined;
      const u = s?.lastAttacker ? findUnit(ctx.s, s.lastAttacker) : undefined;
      return u?.alive ? [u] : [];
    }
    case 'primaryLastAttacker': {
      const p = sc.targets[0] ? findUnit(ctx.s, sc.targets[0]) : undefined;
      const u = p?.lastAttacker ? findUnit(ctx.s, p.lastAttacker) : undefined;
      return u?.alive ? [u] : [];
    }
    case 'strongestEnemy':
      return extremeHp(ctx.s.units.filter((u) => u.alive && u.kind === 'character' && isEnemy(actor, u) && canTarget(ctx, actor, u, sc.bypass)), 'max');
  }
}

function extremeHp(units: Unit[], pick: 'min' | 'max'): Unit[] {
  let best: Unit | undefined;
  for (const u of units) if (!best || (pick === 'min' ? u.hp < best.hp : u.hp > best.hp)) best = u;
  return best ? [best] : [];
}

export function select(ctx: Ctx, sel: Selector, sc: Scope): Unit[] {
  if (typeof sel === 'string') return selectNamed(ctx, sel, sc);
  const excluded = new Set(sel.exclude ? selectNamed(ctx, sel.exclude, sc).map((u) => u.id) : []);
  if ('filter' in sel) {
    const cond = sel.where;
    return selectNamed(ctx, sel.filter, sc).filter(
      (u) => !excluded.has(u.id) && withIt(sc, u.id, () => evalCond(ctx, cond, sc)),
    );
  }
  const where = sel.where;
  const enemies = 'randomEnemy' in sel;
  const pool = selectNamed(ctx, enemies ? 'allEnemies' : 'allAllies', sc).filter(
    (u) => !excluded.has(u.id) && (!where || withIt(sc, u.id, () => evalCond(ctx, where, sc))),
  );
  return sample(ctx.s.rng, pool, enemies ? sel.randomEnemy : sel.randomAlly);
}

// ---------------------------------------------------------------- values & conditions

function withIt<T>(sc: Scope, id: UnitId, fn: () => T): T {
  const prev = sc.it;
  sc.it = id;
  try {
    return fn();
  } finally {
    sc.it = prev;
  }
}

export function evalValue(ctx: Ctx, v: Value, sc: Scope): number {
  if (typeof v === 'number') return v;
  if ('var' in v) {
    const x = sc.vars[v.var];
    return typeof x === 'boolean' ? (x ? 1 : 0) : (x ?? 0);
  }
  if ('lastDamage' in v) return sc.lastDamage;
  if ('effectValue' in v) return sc.self?.value ?? 0;
  if ('timesUsed' in v) return timesUsed(ctx, sc);
  if ('counter' in v) return unit(ctx, sc.actor).counters[`c:${v.counter}`] ?? 0;
  if ('counterOf' in v) {
    const u = select(ctx, v.counterOf.unit, sc)[0];
    return u ? (u.counters[`c:${v.counterOf.name}`] ?? 0) : 0;
  }
  if ('turn' in v) return ctx.s.turn;
  if ('lastOverheal' in v) return sc.lastOverheal ?? 0;
  if ('effectValueOf' in v) {
    const u = select(ctx, v.effectValueOf.unit, sc)[0];
    return u ? effectsOn(ctx.s, u.id).filter((e) => effectKeyOf(e) === v.effectValueOf.effect).reduce((n, e) => n + e.value, 0) : 0;
  }
  if ('effectData' in v) {
    const d = sc.self?.data[v.effectData];
    return typeof d === 'number' ? d : 0;
  }
  if ('kindCount' in v) {
    const u = select(ctx, v.kindCount.unit, sc)[0];
    if (!u) return 0;
    const of = effectsOn(ctx.s, u.id).filter((e) => effectDef(ctx.c, e).kind === v.kindCount.kind);
    return v.kindCount.stacks ? of.reduce((n, e) => n + e.stacks, 0) : of.length;
  }
  if ('effectStacks' in v) return sc.self?.stacks ?? 0;
  if ('stacks' in v) {
    const u = select(ctx, v.stacks.unit, sc)[0];
    return u ? stacksOf(ctx.s, u.id, v.stacks.effect) : 0;
  }
  if ('count' in v) {
    const keys = new Set(v.count.effects);
    const where = v.count.in ? new Set(select(ctx, v.count.in, sc).map((u) => u.id)) : null;
    return ctx.s.effects.filter((e) => keys.has(effectKeyOf(e)) && (!where || where.has(e.bearer))).length;
  }
  if ('countOf' in v) return select(ctx, v.countOf, sc).length;
  if ('totalStacks' in v) {
    const ids = new Set(select(ctx, v.totalStacks.in, sc).map((u) => u.id));
    return ctx.s.effects.filter((e) => ids.has(e.bearer) && effectKeyOf(e) === v.totalStacks.effect).reduce((n, e) => n + e.stacks, 0);
  }
  if ('hp' in v) return select(ctx, v.hp, sc)[0]?.hp ?? 0;
  if ('missingHp' in v) {
    const u = select(ctx, v.missingHp, sc)[0];
    return u ? u.maxHp - u.hp : 0;
  }
  if ('div' in v) {
    const d = evalValue(ctx, v.div[1], sc);
    return d === 0 ? 0 : Math.floor(evalValue(ctx, v.div[0], sc) / d);
  }
  if ('sum' in v) return v.sum.reduce<number>((n, x) => n + evalValue(ctx, x, sc), 0);
  if ('mul' in v) return v.mul.reduce<number>((n, x) => n * evalValue(ctx, x, sc), 1);
  if ('skillCost' in v) {
    const d = scopeSkill(ctx, sc);
    return d ? costTotal(d.cost) : 0;
  }
  if ('skillCooldown' in v) return scopeSkill(ctx, sc)?.cooldown ?? 0;
  if ('energyOf' in v) {
    const u = select(ctx, v.energyOf.unit, sc)[0];
    if (!u) return 0;
    const pool = ctx.s.players[u.owner].energy;
    return v.energyOf.colors ? COLORS.filter((c) => pool[c] > 0).length : COLORS.reduce((n, c) => n + pool[c], 0);
  }
  if ('totalHp' in v) return select(ctx, v.totalHp, sc).reduce((n, u) => n + u.hp, 0);
  if ('skillsOnCooldown' in v) return select(ctx, v.skillsOnCooldown, sc)[0]?.skills.filter((s) => s.cooldown > 0).length ?? 0;
  if ('recentDeaths' in v) {
    return ctx.s.units.filter((u) => !u.alive && (u.counters['c:died_turn'] ?? -9) >= ctx.s.turn - 2).length;
  }
  if ('minionsLost' in v) {
    const me = unit(ctx, sc.actor);
    return ctx.s.units.filter(
      (u) => u.kind === 'minion' && !u.alive && u.owner === me.owner && (u.counters['c:died_turn'] ?? -9) >= ctx.s.turn - 2,
    ).length;
  }
  if ('deadCount' in v) {
    const me = unit(ctx, sc.actor);
    return ctx.s.units.filter(
      (u) => u.kind === 'character' && !u.alive && (v.deadCount === 'enemies' ? u.owner !== me.owner : u.owner === me.owner),
    ).length;
  }
  if ('alliesActed' in v) {
    const me = unit(ctx, sc.actor);
    return ctx.s.units.filter(
      (u) => u.kind === 'character' && u.alive && u.owner === me.owner && u.id !== me.id && u.counters.actedTurn === ctx.s.turn,
    ).length;
  }
  if ('eventAmount' in v) return sc.eventAmount ?? 0;
  if ('eventDuration' in v) return ctx.s.effects.find((e) => e.id === sc.eventEffect)?.duration ?? 0;
  if ('energy' in v) {
    const pool = ctx.s.players[unit(ctx, sc.actor).owner].energy;
    return COLORS.reduce((n, c) => n + pool[c], 0);
  }
  return evalCond(ctx, v.if, sc) ? evalValue(ctx, v.then, sc) : evalValue(ctx, v.else, sc);
}

/** The skill an expression is about: the event's skill in triggers, else the skill being used. */
function scopeSkill(ctx: Ctx, sc: Scope): SkillDef | undefined {
  return sc.eventSkill ? ctx.c.skills[sc.eventSkill] : sc.skill;
}

export function evalCond(ctx: Ctx, c: Cond, sc: Scope): boolean {
  if ('has' in c) {
    const u = select(ctx, c.has.unit, sc)[0];
    if (!u) return false;
    // A status can count as another for these checks (Cloud's Aloft counts as Leaping).
    const matches = (e: EffectInstance) =>
      effectKeyOf(e) === c.has.effect || (!c.has.exact && (effectDef(ctx.c, e).countsAs?.includes(c.has.effect) ?? false));
    if (!c.has.mine) return hasEffect(ctx.s, u.id, c.has.effect) || effectsOn(ctx.s, u.id).some(matches);
    return effectsOn(ctx.s, u.id).some((e) => matches(e) && e.source === sc.actor);
  }
  if ('hasFromArchetype' in c) {
    const u = select(ctx, c.hasFromArchetype.unit, sc)[0];
    const { archetype, mine } = c.hasFromArchetype;
    return !!u && effectsOn(ctx.s, u.id).some((e) => e.sourceArchetype === archetype && (!mine || e.source === sc.actor));
  }
  if ('hpAtMost' in c) {
    const u = select(ctx, c.hpAtMost.unit, sc)[0];
    return !!u && u.hp <= c.hpAtMost.value;
  }
  if ('hpAbove' in c) {
    const u = select(ctx, c.hpAbove.unit, sc)[0];
    return !!u && u.hp > c.hpAbove.value;
  }
  if ('stackTotal' in c) {
    const u = select(ctx, c.stackTotal.unit, sc)[0];
    if (!u) return false;
    const keys = new Set(c.stackTotal.effects);
    const total = effectsOn(ctx.s, u.id).filter((e) => keys.has(effectKeyOf(e))).reduce((n, e) => n + e.stacks, 0);
    return total > c.stackTotal.moreThan;
  }
  if ('kind' in c) {
    const u = select(ctx, c.kind.unit, sc)[0];
    return !!u && u.kind === c.kind.is;
  }
  if ('check' in c) {
    const u = select(ctx, c.check.unit, sc)[0];
    const named = ctx.c.conditions[c.check.cond];
    if (!named) throw new Error(`Unknown condition ${c.check.cond}`);
    return !!u && withIt(sc, u.id, () => evalCond(ctx, named, sc));
  }
  if ('isActor' in c) return select(ctx, c.isActor, sc)[0]?.id === sc.actor;
  if ('isPrimary' in c) return !!sc.targets[0] && select(ctx, c.isPrimary, sc)[0]?.id === sc.targets[0];
  if ('isEnemy' in c) {
    const u = select(ctx, c.isEnemy, sc)[0];
    return !!u && isEnemy(unit(ctx, sc.actor), u);
  }
  if ('minion' in c) {
    const u = select(ctx, c.minion.unit, sc)[0];
    if (!u || u.kind !== 'minion') return false;
    const from = c.minion.fromArchetypes;
    if (from && !from.includes(u.summonArchetype ?? '')) return false;
    if (c.minion.mine && u.summonedBy !== sc.actor) return false;
    const types = c.minion.types;
    return !types || types.includes(u.defId) || (ctx.c.minions[u.defId]?.tags ?? []).some((t) => types.includes(t));
  }
  if ('hasShield' in c) {
    const u = select(ctx, c.hasShield, sc)[0];
    return !!u && effectsOn(ctx.s, u.id).some((e) => effectDef(ctx.c, e).shield && e.value > 0);
  }
  if ('hasSkill' in c) {
    const u = select(ctx, c.hasSkill.unit, sc)[0];
    return !!u && u.skills.some((s) => c.hasSkill.archetypes.includes(ctx.c.skills[s.defId]?.archetype ?? ''));
  }
  if ('hasKind' in c) {
    const u = select(ctx, c.hasKind.unit, sc)[0];
    return !!u && effectsOn(ctx.s, u.id).some((e) => effectDef(ctx.c, e).kind === c.hasKind.kind);
  }
  if ('compare' in c) {
    const n = evalValue(ctx, c.compare.value, sc);
    if (c.compare.atLeast !== undefined && n < c.compare.atLeast) return false;
    if (c.compare.atMost !== undefined && n > c.compare.atMost) return false;
    return true;
  }
  if ('any' in c) return select(ctx, c.any.in, sc).some((u) => withIt(sc, u.id, () => evalCond(ctx, c.any.cond, sc)));
  if ('all' in c) return select(ctx, c.all.in, sc).every((u) => withIt(sc, u.id, () => evalCond(ctx, c.all.cond, sc)));
  if ('and' in c) return c.and.every((x) => evalCond(ctx, x, sc));
  if ('or' in c) return c.or.some((x) => evalCond(ctx, x, sc));
  if ('not' in c) return !evalCond(ctx, c.not, sc);
  if ('flag' in c) return !!sc.self?.data[c.flag];
  if ('eventTargetIs' in c) {
    const u = select(ctx, c.eventTargetIs, sc)[0];
    return !!u && sc.eventTarget === u.id;
  }
  if ('isEventTarget' in c) {
    const u = select(ctx, c.isEventTarget, sc)[0];
    return !!u && (sc.eventTargets ?? []).includes(u.id);
  }
  if ('appliedFromArchetype' in c) {
    return ctx.s.effects.some((e) => e.source === sc.actor && archetypeOf(ctx.c, e.sourceSkill) === c.appliedFromArchetype);
  }
  if ('eventTargetHad' in c) {
    const { archetypes, effects } = c.eventTargetHad;
    return (sc.snapshot ?? []).some(
      (e) =>
        e.source === sc.actor &&
        (!archetypes || archetypes.includes(archetypeOf(ctx.c, e.sourceSkill) ?? '')) &&
        (!effects || effects.includes(effectKeyOf(e)) || (effectDef(ctx.c, e).countsAs ?? []).some((k) => effects.includes(k))),
    );
  }
  if ('eventSkill' in c) {
    const d = scopeSkill(ctx, sc);
    if (!d) return false;
    if (c.eventSkill.archetypes && !c.eventSkill.archetypes.includes(d.archetype)) return false;
    if (c.eventSkill.costAtLeast !== undefined && costTotal(d.cost) < c.eventSkill.costAtLeast) return false;
    if (c.eventSkill.tags && !c.eventSkill.tags.some((t) => d.tags.includes(t))) return false;
    if (c.eventSkill.elements && !c.eventSkill.elements.includes(d.element)) return false;
    if (c.eventSkill.single !== undefined && c.eventSkill.single !== ['enemy', 'ally', 'any'].includes(d.target)) return false;
    return true;
  }
  if ('channeling' in c) {
    const u = select(ctx, c.channeling, sc)[0];
    return !!u && effectsOn(ctx.s, u.id).some((e) => effectDef(ctx.c, e).interruptible);
  }
  if ('actedThisTurn' in c) {
    const u = select(ctx, c.actedThisTurn, sc)[0];
    return !!u && u.counters.actedTurn === ctx.s.turn;
  }
  if ('stunned' in c) {
    const u = select(ctx, c.stunned, sc)[0];
    // Blocks limited to certain skills (an Ice Hammer's Taunt lock) don't count.
    return !!u && modsOn(ctx.s, ctx.c, u.id, 'cannotUseSkills').some(({ spec }) => !spec.archetypes && !spec.skillsWith);
  }
  if ('crest' in c) return timesUsed(ctx, sc) % 2 === 0;
  return !!sc.vars[c.varTrue];
}

/** How many times the actor has used the skill in scope before this use. */
function timesUsed(ctx: Ctx, sc: Scope): number {
  const id = sc.skill?.id;
  return id ? (unit(ctx, sc.actor).counters[`uses:${id}`] ?? 0) : 0;
}

// ---------------------------------------------------------------- ops

/** Evaluates turn counts given as Values; null means "0 or fewer turns: apply nothing". */
function resolveDuration(ctx: Ctx, d: DurationSpec | undefined, sc: Scope): ResolvedDuration | undefined | null {
  if (d === undefined || d === 'permanent' || 'thisTurn' in d) return d;
  if ('sameAsEvent' in d) {
    const e = ctx.s.effects.find((x) => x.id === sc.eventEffect);
    const left = e ? e.duration : sc.eventDuration;
    if (left === undefined) return null;
    return left === null ? 'permanent' : left > 0 ? { raw: left } : null;
  }
  if ('raw' in d) {
    const n = typeof d.raw === 'number' ? d.raw : evalValue(ctx, d.raw, sc);
    return n > 0 ? { raw: n } : null;
  }
  if ('enemyTurns' in d) {
    const n = typeof d.enemyTurns === 'number' ? d.enemyTurns : evalValue(ctx, d.enemyTurns, sc);
    return n > 0 ? { enemyTurns: n } : null;
  }
  const n = typeof d.ownTurns === 'number' ? d.ownTurns : evalValue(ctx, d.ownTurns, sc);
  return n > 0 ? { ownTurns: n } : null;
}

export function runOps(ctx: Ctx, ops: readonly Op[], sc: Scope): void {
  for (const op of ops) {
    runOp(ctx, op, sc);
    flushTriggers(ctx);
    if (ctx.s.phase === 'finished') return;
  }
}

function runOp(ctx: Ctx, op: Op, sc: Scope): void {
  const actor = unit(ctx, sc.actor);
  switch (op.op) {
    case 'damage': {
      sc.lastDamage = 0;
      sc.lastDamaged = [];
      const respectsInvulnerable = op.respectsInvulnerable ?? (sc.self ? effectDef(ctx.c, sc.self).respectsInvulnerable : undefined);
      const dealer = op.from ? select(ctx, op.from, sc)[0] : actor;
      if (!dealer) return;
      // The skill "dealing" it: the one being used, or the one that applied the ticking/delayed effect.
      const damageSkill = sc.skill?.id ?? sc.self?.sourceSkill;
      for (const t of select(ctx, op.to, sc)) {
        const amount = withIt(sc, t.id, () => evalValue(ctx, op.amount, sc)) * catalyze(ctx, t);
        const dealt = dealDamage(ctx, {
          source: dealer,
          target: t,
          amount,
          type: (op.type ?? 'Normal') === 'Normal' && modsOn(ctx.s, ctx.c, dealer.id, 'normalAsPiercing').length > 0 ? 'Piercing' : (op.type ?? 'Normal'),
          direct: op.direct ?? sc.direct,
          bypass: op.bypass ?? sc.bypass,
          ...(respectsInvulnerable ? { respectsInvulnerable } : {}),
          ...(op.wakes === false ? { wakes: false } : {}),
          ...(damageSkill ? { skill: damageSkill } : {}),
          ...(op.raw ? { raw: true } : {}),
        });
        sc.lastDamage += dealt;
        if (dealt > 0) sc.lastDamaged.push(t.id);
      }
      return;
    }
    case 'heal':
      for (const t of select(ctx, op.to, sc)) {
        const want = withIt(sc, t.id, () => evalValue(ctx, op.amount, sc)) * catalyze(ctx, t);
        const room = t.maxHp - t.hp;
        heal(ctx, actor, t, want, { raw: op.raw, quiet: op.quiet });
        sc.lastOverheal = Math.max(0, want - room);
      }
      return;
    case 'apply': {
      const def = resolveEffectDef(ctx.c, op.effect);
      const remembered = op.remember ? select(ctx, op.remember, sc).map((u) => u.id) : [];
      const boundTo = op.bindTo ? select(ctx, op.bindTo, sc)[0]?.id : undefined;
      const src = op.from ? select(ctx, op.from, sc)[0] : actor;
      if (!src) return; // e.g. the minion it should come from wasn't summoned
      const linkedTo = op.linkTo
        ? effectsOn(ctx.s, actor.id).filter((e) => effectKeyOf(e) === op.linkTo).at(-1)?.id
        : op.linkToEvent
          ? ctx.s.effects.find((e) => e.id === sc.eventEffect)?.id
          : undefined;
      if ((op.linkTo || op.linkToEvent) && !linkedTo) return; // what it belongs to isn't there
      // "During Titan": nothing to attach to if the actor carries no Titan effect.
      if (op.whileActorHas && !effectsOn(ctx.s, actor.id).some((e) => e.sourceArchetype === op.whileActorHas)) return;
      const duration = resolveDuration(ctx, op.duration, sc);
      if (duration === null) return; // e.g. "1 turn per 15 missing health" with too little missing
      for (const t of select(ctx, op.to, sc)) {
        withIt(sc, t.id, () => {
          let stacks = op.stacks === undefined ? 1 : evalValue(ctx, op.stacks, sc);
          if (stacks <= 0) return; // "1 Might per Ignite" with no Ignites applies nothing
          // Catalyst doubles what a skill applies, but not another Catalyst.
          const doubled = (def.modifiers ?? []).some((m) => m.mod === 'catalyst') ? 1 : catalyze(ctx, t);
          stacks *= doubled;
          applyEffect(ctx, {
            def,
            inline: typeof op.effect !== 'string',
            bearer: t,
            source: src,
            sourceSkill: sc.skill,
            stacks,
            value: op.value === undefined ? 0 : evalValue(ctx, op.value, sc),
            duration: doubled > 1 && duration ? doubleDuration(duration) : duration,
            targets: remembered,
            until: op.until,
            boundTo,
            linkedTo,
            ...(op.quiet ? { quiet: true } : {}),
            ...(op.whileActorHas ? { whileActorHas: { unit: actor.id, archetype: op.whileActorHas } } : {}),
          });
        });
      }
      return;
    }
    case 'summon': {
      const duration = resolveDuration(ctx, op.duration, sc);
      if (duration === null) return;
      for (let i = 0; i < (op.count ?? 1); i++) {
        const m = summonMinion(ctx, actor, op.minion, duration, sc.skill);
        if (m) sc.lastSummoned = m.id;
      }
      return;
    }
    case 'kill':
      for (const t of select(ctx, op.to, sc)) killUnit(ctx, t, actor, sc.skill?.id);
      return;
    case 'interrupt':
      for (const t of select(ctx, op.to, sc)) interruptChannels(ctx, t, 'skillUse');
      return;
    case 'entangle': {
      const units = [...new Set([...select(ctx, op.to, sc), ...(op.with ? select(ctx, op.with, sc) : [])])];
      if (units.length < 2) return;
      const group = nextId(ctx, 'g');
      const def = resolveEffectDef(ctx.c, op.effect);
      const duration = resolveDuration(ctx, op.duration, sc);
      if (duration === null) return;
      for (const u of units) {
        const e = applyEffect(ctx, { def, inline: false, bearer: u, source: actor, sourceSkill: sc.skill, duration });
        if (e) e.data.group = group;
      }
      return;
    }
    case 'moveEffects': {
      const to = select(ctx, op.to, sc)[0];
      if (!to) return;
      const moving = select(ctx, op.from, sc).filter((u) => u !== to).flatMap((from) => effectsOn(ctx.s, from.id)).filter(
        (e) => (op.kind ? effectDef(ctx.c, e).kind === op.kind : true) && (op.effects ? op.effects.includes(effectKeyOf(e)) : true),
      );
      for (const e of moving) {
        applyEffect(ctx, {
          def: effectDef(ctx.c, e),
          inline: !!e.inline,
          bearer: to,
          source: findUnit(ctx.s, e.source) ?? actor,
          sourceSkill: e.sourceSkill ? ctx.c.skills[e.sourceSkill] : undefined,
          stacks: e.stacks,
          value: e.value,
          duration: e.duration === null ? 'permanent' : { raw: e.duration },
        });
        removeEffect(ctx, e, 'removed');
      }
      return;
    }
    case 'transmute': {
      let total = 0;
      const event = op.event ? ctx.s.effects.find((x) => x.id === sc.eventEffect) : undefined;
      for (const u of select(ctx, op.on, sc)) {
        const recipes = isEnemy(actor, u) ? TRANSMUTE_ENEMY : TRANSMUTE_ALLY;
        let pool = effectsOn(ctx.s, u.id).filter(
          (e) =>
            (!op.event || e === event) &&
            (!op.effects || op.effects.includes(effectKeyOf(e))) &&
            (!op.kind || effectDef(ctx.c, e).kind === op.kind) &&
            !isProtected(ctx, e),
        );
        const recipeFor = (e: EffectInstance): string | undefined =>
          recipes[effectKeyOf(e)] ?? (!isEnemy(actor, u) && effectDef(ctx.c, e).kind === 'Debuff' ? 'renew' : undefined);
        if (!op.removeUnmatched) pool = pool.filter((e) => recipeFor(e) !== undefined);
        if (op.count !== undefined) pool = sample(ctx.s.rng, pool, op.count);
        // Everything leaves first, so a removed Immune doesn't block the new Debuffs.
        const recipesNow = pool.map((e) => [e, recipeFor(e)] as const);
        for (const e of pool) removeEffect(ctx, e, 'removed');
        for (const [e, into] of recipesNow) {
          if (!into || !ctx.c.statuses[into]) continue;
          applyEffect(ctx, {
            def: ctx.c.statuses[into]!,
            inline: false,
            bearer: u,
            source: actor,
            sourceSkill: sc.skill,
            stacks: e.stacks,
            duration: e.duration === null ? 'permanent' : { raw: e.duration },
          });
          total += e.stacks;
        }
      }
      sc.vars.transmuted = total;
      return;
    }
    case 'shareEffects': {
      const ua = select(ctx, op.a, sc)[0];
      const ub = select(ctx, op.b, sc)[0];
      if (!ua || !ub || ua === ub) return;
      const snap = (u: Unit) => effectsOn(ctx.s, u.id).filter((e) => effectDef(ctx.c, e).kind === op.kind);
      const fromA = snap(ua);
      const fromB = snap(ub);
      const copy = (e: EffectInstance, to: Unit) => {
        const src = findUnit(ctx.s, e.source) ?? actor;
        applyEffect(ctx, {
          def: effectDef(ctx.c, e),
          inline: !!e.inline,
          bearer: to,
          source: src,
          sourceSkill: e.sourceSkill ? ctx.c.skills[e.sourceSkill] : undefined,
          stacks: e.stacks,
          value: e.value,
          duration: e.duration === null ? 'permanent' : { raw: e.duration },
        });
      };
      for (const e of fromA) copy(e, ub);
      for (const e of fromB) copy(e, ua);
      return;
    }
    case 'reveal': {
      if (op.event) {
        const e = ctx.s.effects.find((x) => x.id === sc.eventEffect);
        if (e) revealEffect(ctx, e);
      }
      if (op.by) {
        const ids = new Set(select(ctx, op.by, sc).map((u) => u.id));
        for (const e of ctx.s.effects.filter((x) => ids.has(x.source))) {
          const hidden = effectDef(ctx.c, e).visibility === 'hidden';
          revealEffect(ctx, e);
          if (op.end && hidden) removeEffect(ctx, e, 'removed');
        }
      }
      return;
    }
    case 'setCounter':
      for (const t of op.on ? select(ctx, op.on, sc) : [actor]) t.counters[`c:${op.name}`] = withIt(sc, t.id, () => evalValue(ctx, op.value, sc));
      return;
    case 'transformMinion': {
      const def = ctx.c.minions[op.minion];
      if (!def) throw new Error(`Unknown minion ${op.minion}`);
      for (const t of select(ctx, op.to, sc)) {
        if (t.kind !== 'minion' || !t.alive) continue;
        // The old kind's own passives go; the new kind's come.
        for (const e of effectsOn(ctx.s, t.id)) if (e.source === t.id && e.sourceSkill === undefined) removeEffect(ctx, e, 'removed');
        t.defId = def.id;
        t.name = def.name;
        t.maxHp = def.hp;
        t.hp = def.hp;
        t.skills = def.skills.map((defId) => ({ defId, cooldown: 0 }));
        emit(ctx, { t: 'summoned', unit: t.id, defId: def.id, by: t.summonedBy ?? t.id });
        for (const p of def.passives) applyEffect(ctx, { def: resolveEffectDef(ctx.c, p), inline: typeof p !== 'string', bearer: t, source: t });
      }
      return;
    }
    case 'growShield': {
      const def = resolveEffectDef(ctx.c, op.effect);
      const max = op.max ?? Number.POSITIVE_INFINITY;
      for (const t of select(ctx, op.to, sc)) {
        const amount = withIt(sc, t.id, () => evalValue(ctx, op.amount, sc));
        const e = effectsOn(ctx.s, t.id).find((x) => effectKeyOf(x) === op.effect);
        if (e) {
          e.value = Math.min(max, e.value + amount);
          if (e.value <= 0) removeEffect(ctx, e, 'depleted');
        } else if (amount > 0) {
          applyEffect(ctx, { def, inline: false, bearer: t, source: actor, sourceSkill: sc.skill, value: Math.min(max, amount), duration: 'permanent' });
        }
      }
      return;
    }
    case 'removeShields':
      for (const t of select(ctx, op.from, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (effectDef(ctx.c, e).shield) removeEffect(ctx, e, 'removed');
      }
      return;
    case 'removeEffect':
      for (const t of select(ctx, op.from, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (effectKeyOf(e) === op.effect) removeEffect(ctx, e, 'consumed');
      }
      return;
    case 'expire':
      for (const u of select(ctx, op.on, sc)) {
        for (const e of effectsOn(ctx.s, u.id)) {
          if (effectKeyOf(e) === op.effect || effectDef(ctx.c, e).countsAs?.includes(op.effect)) expireEffect(ctx, e, op.times ?? 1);
        }
      }
      return;
    case 'shiftEnergy': {
      const u = select(ctx, op.of, sc)[0];
      if (!u) return;
      const pool = ctx.s.players[u.owner].energy;
      for (let i = 0; i < (op.count ?? 1); i++) {
        const held = COLORS.flatMap((c) => Array<typeof c>(pool[c]).fill(c));
        if (held.length === 0) return;
        const from = pick(ctx.s.rng, held);
        const to = pick(ctx.s.rng, COLORS.filter((c) => c !== from));
        pool[from] -= 1;
        pool[to] += 1;
        const gained: Energy = { S: 0, A: 0, I: 0, W: 0 };
        gained[from] = -1;
        gained[to] = 1;
        emit(ctx, { t: 'energyGained', player: u.owner, gained }, u.owner);
      }
      return;
    }
    case 'stealEnergy': {
      const u = select(ctx, op.from, sc)[0];
      if (!u || u.owner === actor.owner) return;
      const pool = ctx.s.players[u.owner].energy;
      const most = COLORS.reduce((best, c) => (pool[c] > pool[best] ? c : best), COLORS[0]!);
      if (pool[most] <= 0) return;
      pool[most] -= 1;
      ctx.s.players[actor.owner].energy[most] += 1;
      emit(ctx, { t: 'energyGained', player: u.owner, gained: { S: 0, A: 0, I: 0, W: 0, [most]: -1 } }, u.owner);
      emit(ctx, { t: 'energyGained', player: actor.owner, gained: { S: 0, A: 0, I: 0, W: 0, [most]: 1 } }, actor.owner);
      return;
    }
    case 'spendEnergy': {
      const pool = ctx.s.players[actor.owner].energy;
      const gained: Energy = { S: 0, A: 0, I: 0, W: 0 };
      for (let i = 0; i < op.amount; i++) {
        const held = COLORS.filter((c) => pool[c] > 0);
        if (held.length === 0) break;
        const c = pick(ctx.s.rng, held);
        pool[c] -= 1;
        gained[c] -= 1;
      }
      emit(ctx, { t: 'energyGained', player: actor.owner, gained }, actor.owner);
      return;
    }
    case 'invertCooldowns':
      for (const u of select(ctx, op.on, sc)) {
        for (const slot of u.skills) slot.cooldown = slot.cooldown > 0 ? 0 : op.ready;
      }
      return;
    case 'copyEffects': {
      const from = select(ctx, op.from, sc)[0];
      if (!from) return;
      for (const to of select(ctx, op.to, sc)) {
        if (to === from) continue;
        const pool = op.fromSnapshot ? (sc.snapshot ?? []) : effectsOn(ctx.s, from.id);
        for (const e of pool.filter((x) => effectDef(ctx.c, x).kind === op.kind)) {
          applyEffect(ctx, {
            def: effectDef(ctx.c, e),
            inline: !!e.inline,
            bearer: to,
            source: actor,
            stacks: e.stacks,
            value: e.value,
            duration: e.duration === null ? 'permanent' : { raw: e.duration },
          });
        }
      }
      return;
    }
    case 'swapCooldowns': {
      const longest = (u: Unit | undefined) =>
        u?.skills
          .filter((_, i) => !(u.id === actor.id && i === sc.slot))
          .reduce<SkillSlot | undefined>((best, s) => (!best || s.cooldown > best.cooldown ? s : best), undefined);
      const sa = longest(select(ctx, op.a, sc)[0]);
      const sb = longest(select(ctx, op.b, sc)[0]);
      if (sa && sb) [sa.cooldown, sb.cooldown] = [sb.cooldown, sa.cooldown];
      return;
    }
    case 'revive':
      for (const u of ctx.s.units.filter((x) => !x.alive && x.kind === 'character' && x.owner === actor.owner)) {
        u.alive = true;
        u.hp = Math.min(op.hp, u.maxHp);
        u.counters['c:revived_turn'] = ctx.s.turn;
        emit(ctx, { t: 'revived', unit: u.id, hp: u.hp });
      }
      return;
    case 'addMaxHp':
      for (const t of select(ctx, op.to, sc)) {
        t.maxHp = Math.max(1, t.maxHp + withIt(sc, t.id, () => evalValue(ctx, op.amount, sc)));
        t.hp = Math.min(t.hp, t.maxHp);
      }
      return;
    case 'scaleShields':
      for (const t of select(ctx, op.on, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (effectDef(ctx.c, e).shield) e.value = Math.round(e.value * op.factor);
      }
      return;
    case 'boostShields':
      for (const t of select(ctx, op.on, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (effectDef(ctx.c, e).shield) e.value += op.amount;
      }
      return;
    case 'stealRandom': {
      const to = select(ctx, op.to, sc)[0];
      if (!to) return;
      for (const t of select(ctx, op.from, sc)) {
        const pool = effectsOn(ctx.s, t.id).filter((e) => {
          const d = effectDef(ctx.c, e);
          return d.kind === op.kind && !(op.nonElemental && d.element && d.element !== 'None');
        });
        const e = sample(ctx.s.rng, pool, 1)[0];
        if (!e) continue;
        removeEffect(ctx, e, 'removed');
        applyEffect(ctx, {
          def: effectDef(ctx.c, e),
          inline: !!e.inline,
          bearer: to,
          source: actor,
          sourceSkill: e.sourceSkill ? ctx.c.skills[e.sourceSkill] : undefined,
          stacks: e.stacks,
          value: e.value,
          duration: e.duration === null ? 'permanent' : { raw: e.duration },
        });
      }
      return;
    }
    case 'castSkill': {
      const own = op.archetype ? actor.skills.map((x) => ctx.c.skills[x.defId]).find((d) => d?.archetype === op.archetype) : undefined;
      const mimicked = op.lastUsedBy ? select(ctx, op.lastUsedBy, sc)[0] : undefined;
      const mimicId = mimicked && mimicked.counters.lastSlot !== undefined ? mimicked.skills[mimicked.counters.lastSlot]?.defId : undefined;
      const def = op.lastUsedBy
        ? mimicId ? ctx.c.skills[mimicId] : undefined
        : op.eventSkill ? scopeSkill(ctx, sc) : (own ?? (op.skill ? ctx.c.skills[op.skill] : undefined));
      if (!def) return;
      for (const t of select(ctx, op.on, sc)) {
        const caster = op.as === 'it' ? t : actor;
        if (!caster.alive) continue;
        const targets =
          def.target === 'self'
            ? [caster.id]
            : def.target === 'allEnemies'
              ? ctx.s.units.filter((u) => u.alive && isEnemy(caster, u) && canTarget(ctx, caster, u, false)).map((u) => u.id)
              : def.target === 'allAllies'
                ? ctx.s.units.filter((u) => u.alive && u.owner === caster.owner).map((u) => u.id)
                : def.target === 'none'
                  ? []
                  : def.target === 'ally' && op.lastUsedBy
                    ? [caster.id]
                    : [t.id];
        if ((ctx.castDepth ?? 0) >= 2) continue;
        emit(ctx, { t: 'skillUsed', actor: caster.id, skill: def.id, targets });
        ctx.castDepth = (ctx.castDepth ?? 0) + 1;
        try {
          runOps(ctx, def.ops, {
            actor: caster.id,
            targets,
            vars: {},
            lastDamage: 0,
            lastDamaged: [],
            direct: true,
            bypass: def.tags.includes('Bypass'),
            skill: def,
          });
        } finally {
          ctx.castDepth -= 1;
        }
      }
      return;
    }
    case 'eventEffect': {
      const e = ctx.s.effects.find((x) => x.id === sc.eventEffect);
      if (!e) return;
      if (op.permanent) e.duration = null;
      if (op.extendBy && e.duration !== null) e.duration += op.extendBy;
      if (op.expireNow && effectDef(ctx.c, e).onExpire) expireEffect(ctx, e);
      if (op.remove) removeEffect(ctx, e, 'removed');
      return;
    }
    case 'immunize': {
      const ev = ctx.s.effects.find((x) => x.id === sc.eventEffect);
      const key = op.effect ?? (ev ? effectKeyOf(ev) : undefined);
      if (!key) return;
      const duration = resolveDuration(ctx, op.duration, sc);
      if (duration === null) return;
      for (const t of select(ctx, op.to, sc)) {
        const e = applyEffect(ctx, { def: resolveEffectDef(ctx.c, 'immunity'), inline: false, bearer: t, source: actor, sourceSkill: sc.skill, duration });
        if (e) e.data.immuneKey = key;
      }
      return;
    }
    case 'copyEventEffect': {
      const e = ctx.s.effects.find((x) => x.id === sc.eventEffect);
      if (!e) return;
      for (const t of select(ctx, op.to, sc)) {
        applyEffect(ctx, {
          def: effectDef(ctx.c, e),
          inline: !!e.inline,
          bearer: t,
          source: actor,
          sourceSkill: e.sourceSkill ? ctx.c.skills[e.sourceSkill] : undefined,
          stacks: e.stacks,
          value: e.value,
          duration: e.duration === null ? 'permanent' : { raw: e.duration },
          quiet: true,
          noChain: op.noChain,
        });
      }
      return;
    }
    case 'removeRandom':
      for (const t of select(ctx, op.from, sc)) {
        const pool = effectsOn(ctx.s, t.id).filter((e) => effectDef(ctx.c, e).kind === op.kind);
        for (const e of sample(ctx.s.rng, pool, op.count ?? 1)) removeEffect(ctx, e, 'removed');
      }
      return;
    case 'removeKind':
      for (const t of select(ctx, op.from, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (effectDef(ctx.c, e).kind === op.kind) removeEffect(ctx, e, 'removed');
      }
      return;
    case 'removeStacks':
      for (const t of select(ctx, op.from, sc)) {
        let left = op.amount;
        for (const e of effectsOn(ctx.s, t.id)) {
          if (left <= 0 || effectKeyOf(e) !== op.effect || isProtected(ctx, e)) continue;
          const take = Math.min(e.stacks, left);
          e.stacks -= take;
          restack(ctx, e, e.stacks + take);
          left -= take;
          if (e.stacks <= 0) removeEffect(ctx, e, 'consumed');
        }
      }
      return;
    case 'macro': {
      const ops = ctx.c.macros[op.id];
      if (!ops) throw new Error(`Unknown macro ${op.id}`);
      runOps(ctx, ops, sc);
      return;
    }
    case 'signal':
      broadcastSignal(ctx, op.name, actor);
      return;
    case 'random': {
      if (op.options.length === 0) return;
      runOps(ctx, op.options[nextInt(ctx.s.rng, op.options.length)]!, sc);
      return;
    }
    case 'convertEffects': {
      const to = resolveEffectDef(ctx.c, op.to);
      for (const e of ctx.s.effects.filter((x) => effectKeyOf(x) === op.from)) {
        const bearer = unit(ctx, e.bearer);
        removeEffect(ctx, e, 'removed');
        applyEffect(ctx, {
          def: to,
          inline: false,
          bearer,
          source: actor,
          sourceSkill: sc.skill,
          stacks: e.stacks,
          value: e.value,
          duration: e.duration === null ? 'permanent' : { raw: e.duration },
        });
      }
      return;
    }
    case 'gainEnergy': {
      const gained: Energy = { S: 0, A: 0, I: 0, W: 0 };
      for (let i = 0; i < op.amount; i++) gained[pick(ctx.s.rng, COLORS)] += 1;
      for (const c of COLORS) ctx.s.players[actor.owner].energy[c] += gained[c];
      emit(ctx, { t: 'energyGained', player: actor.owner, gained }, actor.owner);
      return;
    }
    case 'resetCooldown': {
      if (op.archetypes) {
        for (const s of actor.skills) if (op.archetypes.includes(archetypeOf(ctx.c, s.defId) ?? '')) s.cooldown = 0;
        return;
      }
      const last = actor.counters.lastSlot;
      const slot = op.lastUsed
        ? last === undefined ? undefined : actor.skills[last]
        : op.skill ? actor.skills.find((x) => x.defId === op.skill) : sc.slot === undefined ? undefined : actor.skills[sc.slot];
      if (slot) slot.cooldown = 0;
      return;
    }
    case 'adjustCooldowns': {
      const by = evalValue(ctx, op.by, sc);
      const slots = select(ctx, op.to, sc).flatMap((t) =>
        t.skills.filter((slot, i) => {
          if (op.exceptCurrent && t.id === actor.id && i === sc.slot) return false;
          if (op.skill && slot.defId !== op.skill) return false;
          if (op.archetypes && !op.archetypes.includes(archetypeOf(ctx.c, slot.defId) ?? '')) return false;
          if (op.exceptEvent && slot.defId === sc.eventSkill) return false;
          if (op.onlyEvent && slot.defId !== sc.eventSkill) return false;
          return true;
        }),
      );
      // "A random Charge, Dance or Maneuver": one of those still cooling down.
      const chosen = op.random ? sample(ctx.s.rng, slots.filter((s) => s.cooldown > 0), 1) : slots;
      for (const slot of chosen) slot.cooldown = Math.max(0, slot.cooldown + by);
      return;
    }
    case 'extendEffects': {
      const keys = op.effects ? new Set(op.effects) : null;
      const except = new Set(op.except ?? []);
      for (const t of select(ctx, op.on, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) {
          if (e.duration === null || except.has(effectKeyOf(e))) continue;
          if (keys && !keys.has(effectKeyOf(e))) continue;
          if (op.kind && effectDef(ctx.c, e).kind !== op.kind) continue;
          if (op.onceKey) {
            if (e.data[op.onceKey]) continue;
            e.data[op.onceKey] = true;
          }
          e.duration += op.by;
        }
      }
      return;
    }
    case 'if':
      runOps(ctx, evalCond(ctx, op.cond, sc) ? op.then : (op.else ?? []), sc);
      return;
    case 'set':
      sc.vars[op.var] = typeof op.value === 'boolean' ? op.value : evalValue(ctx, op.value, sc);
      return;
    case 'forEach':
      for (const t of select(ctx, op.in, sc)) withIt(sc, t.id, () => runOps(ctx, op.do, sc));
      return;
    case 'repeat': {
      const n = evalValue(ctx, op.times, sc);
      for (let i = 0; i < n && ctx.s.phase !== 'finished'; i++) runOps(ctx, op.do, sc);
      return;
    }
    case 'extendSelf':
      if (sc.self && sc.self.duration !== null) sc.self.duration += op.by;
      return;
    case 'setFlag':
      if (sc.self) sc.self.data[op.flag] = op.value ?? true;
      return;
    case 'addStacksSelf':
      if (sc.self) {
        sc.self.stacks += op.amount;
        restack(ctx, sc.self, sc.self.stacks - op.amount);
        if (sc.self.stacks <= 0) removeEffect(ctx, sc.self, 'consumed');
      }
      return;
    case 'removeSelf':
      if (sc.self) removeEffect(ctx, sc.self, 'consumed');
      return;
    case 'script': {
      const fn = scripts[op.id];
      if (!fn) throw new Error(`Unknown script ${op.id}`);
      fn(ctx, sc, op.params ?? {});
      return;
    }
  }
}

/** Ends an effect as if its time ran out: removed as 'expired', then its onExpire payload runs. */
export function expireEffect(ctx: Ctx, e: EffectInstance, times = 1): void {
  if (!ctx.s.effects.includes(e)) return;
  const onExpire = effectDef(ctx.c, e).onExpire;
  removeEffect(ctx, e, 'expired');
  // Once the match is over, no more payloads run.
  if (!onExpire || !unit(ctx, e.bearer).alive || ctx.s.phase === 'finished') return;
  const sc: Scope = {
    actor: e.source,
    targets: e.targets,
    bearer: e.bearer,
    self: e,
    vars: {},
    lastDamage: 0,
    lastDamaged: [],
    // Delayed payloads (Snipe) are the skill's own effect, so their damage is direct.
    direct: true,
    bypass: false,
  };
  if (e.sourceSkill) sc.skill = ctx.c.skills[e.sourceSkill];
  for (let i = 0; i < times; i++) runOps(ctx, onExpire, sc);
}

const LIFETIME: EffectDef = {
  id: 'lifetime',
  name: 'Summoned',
  kind: 'Neutral',
  description: 'This minion leaves the battle when the duration ends.',
  onExpire: [{ op: 'kill', to: 'bearer' }],
};

function summonMinion(
  ctx: Ctx,
  summoner: Unit,
  minionId: string,
  duration: ResolvedDuration | undefined,
  skill: SkillDef | undefined,
): Unit | undefined {
  const def = ctx.c.minions[minionId];
  if (!def) throw new Error(`Unknown minion ${minionId}`);
  const living = ctx.s.units.filter((u) => u.alive && u.owner === summoner.owner && u.kind === 'minion').length;
  if (living >= ctx.s.settings.minionCap) {
    emit(ctx, { t: 'effectBlocked', defId: minionId, bearer: summoner.id, reason: 'minion cap reached' });
    return undefined;
  }
  const m: Unit = {
    id: nextId(ctx, 'm'),
    owner: summoner.owner,
    kind: 'minion',
    defId: def.id,
    name: def.name,
    hp: def.hp,
    maxHp: def.hp,
    alive: true,
    skills: def.skills.map((defId) => ({ defId, cooldown: 0 })),
    summonedBy: summoner.id,
    counters: {},
  };
  if (skill) m.summonArchetype = skill.archetype;
  ctx.s.units.push(m);
  emit(ctx, { t: 'summoned', unit: m.id, defId: def.id, by: summoner.id });
  // Everyone can react to a new minion (Emblem of the Permafrost).
  broadcastSignal(ctx, 'summoned', summoner, { target: m, eventSkill: skill?.id });
  // "If target enemy creates a minion" (Earth Boulder Trap): the summoner's effects react.
  for (const e of effectsOn(ctx.s, summoner.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'summoned') continue;
      if (spec.when?.archetypes && !spec.when.archetypes.includes(skill?.archetype ?? '')) continue;
      ctx.triggerQueue.push({ effect: e.id, inst: e, spec, eventSource: summoner.id, eventTarget: m.id, ...(skill ? { eventSkill: skill.id } : {}) });
    }
  }
  for (const p of def.passives) {
    applyEffect(ctx, { def: resolveEffectDef(ctx.c, p), inline: typeof p !== 'string', bearer: m, source: m, sourceSkill: skill });
  }
  if (duration !== undefined && duration !== 'permanent') {
    applyEffect(ctx, { def: LIFETIME, inline: true, bearer: m, source: summoner, sourceSkill: skill, duration });
  }
  if (def.onSummon?.length) {
    runOps(ctx, def.onSummon, {
      actor: m.id,
      targets: [],
      vars: {},
      lastDamage: 0,
      lastDamaged: [],
      direct: false,
      bypass: false,
      skill,
    });
  }
  return m;
}

/** Queues `on: signal` triggers on every effect on the board that listens for `name`. */
export function broadcastSignal(
  ctx: Ctx,
  name: string,
  source: Unit,
  extra: { target?: Unit; snapshot?: EffectInstance[]; eventSkill?: string | undefined } = {},
): void {
  for (const e of ctx.s.effects) {
    const bearer = findUnit(ctx.s, e.bearer);
    if (!bearer?.alive) continue;
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'signal' || spec.signal !== name) continue;
      const side = bearer.owner === source.owner ? 'ally' : 'enemy';
      if (spec.when?.side && spec.when.side !== side) continue;
      if (spec.when?.archetypes && !spec.when.archetypes.includes(archetypeOf(ctx.c, extra.eventSkill) ?? '')) continue;
      ctx.triggerQueue.push({
        effect: e.id,
        spec,
        eventSource: source.id,
        eventTarget: extra.target?.id ?? bearer.id,
        ...(extra.snapshot ? { snapshot: extra.snapshot } : {}),
        ...(extra.eventSkill ? { eventSkill: extra.eventSkill } : {}),
      });
    }
  }
}

/** Filters for trigger events about effects, skills and amounts (see TriggerSpec.when). */
export interface EventInfo {
  eventSource?: UnitId;
  eventTarget?: UnitId;
  eventTargets?: UnitId[];
  eventSkill?: string | undefined;
  eventEffect?: string;
  eventAmount?: number;
  /** For filtering. */
  effectKey?: string;
  effectKind?: string;
  toEnemy?: boolean;
  counter?: boolean;
  reason?: string;
  untriggered?: boolean;
  harmful?: boolean;
  reflected?: boolean;
  eventDuration?: number | null;
  shield?: boolean;
}

/** Queues a unit's triggers for one of the equipment-era events (ownEffect*, effectApplied, healed). */
export function enqueueFor(ctx: Ctx, unitId: UnitId, on: TriggerSpec['on'], info: EventInfo): void {
  for (const e of effectsOn(ctx.s, unitId)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== on) continue;
      const w = spec.when;
      if (w?.archetypes && !w.archetypes.includes(archetypeOf(ctx.c, info.eventSkill) ?? '')) continue;
      if (w?.counter !== undefined && w.counter !== !!info.counter) continue;
      if (w?.reason && !w.reason.includes(info.reason as never)) continue;
      if (w?.untriggered && !info.untriggered) continue;
      if (w?.effects && !w.effects.includes(info.effectKey ?? '')) continue;
      if (w?.kind && w.kind !== info.effectKind) continue;
      if (w?.toEnemy !== undefined && w.toEnemy !== info.toEnemy) continue;
      if (w?.harmful !== undefined && w.harmful !== info.harmful) continue;
      if (w?.reflected !== undefined && w.reflected !== !!info.reflected) continue;
      if (w?.shield !== undefined && w.shield !== !!info.shield) continue;
      ctx.triggerQueue.push({
        effect: e.id,
        inst: e,
        spec,
        ...(info.eventSource !== undefined ? { eventSource: info.eventSource } : {}),
        ...(info.eventTarget !== undefined ? { eventTarget: info.eventTarget } : {}),
        ...(info.eventTargets !== undefined ? { eventTargets: info.eventTargets } : {}),
        ...(info.eventSkill !== undefined ? { eventSkill: info.eventSkill } : {}),
        ...(info.eventEffect !== undefined ? { eventEffect: info.eventEffect } : {}),
        ...(info.eventAmount !== undefined ? { eventAmount: info.eventAmount } : {}),
        ...(info.eventDuration !== undefined ? { eventDuration: info.eventDuration } : {}),
      });
    }
  }
}

function effectKeyOf(e: EffectInstance): string {
  return e.inline ? e.inline.id : e.defId;
}

// ---------------------------------------------------------------- triggers

/** Trigger kinds that aren't reactions (they don't count as an effect "triggering"). */
const PERIODIC = new Set([
  'turnEnd',
  'turnStart',
  'ownEffectTriggered',
  'ownEffectEnded',
  'effectApplied',
  'healed',
  'effectGained',
  'battleStart',
  'countered',
  'effectNegated',
  'incomingNegated',
  'healDone',
  'energyFromEffect',
  'counterIgnored',
]);

/** Runs queued triggers FIFO. Nested calls return immediately; the outermost loop drains the queue. */
export function flushTriggers(ctx: Ctx): void {
  if (ctx.flushing) return;
  ctx.flushing = true;
  try {
    let n = 0;
    while (ctx.triggerQueue.length > 0) {
      if (++n > MAX_TRIGGER_CHAIN) throw new Error('Trigger chain limit exceeded');
      const p = ctx.triggerQueue.shift() as PendingTrigger;
      // A trigger queued before its bearer died still resolves (e.g. Sanctify on a killing blow).
      // Likewise a Shield's own trigger on the hit that depleted it.
      const gone = p.inst?.data.removedReason;
      const e =
        ctx.s.effects.find((x) => x.id === p.effect) ?? (gone === 'died' || gone === 'depleted' ? p.inst : undefined);
      if (!e) continue;
      runTrigger(ctx, e, p);
      if (ctx.s.phase === 'finished') {
        ctx.triggerQueue.length = 0;
        return;
      }
    }
  } finally {
    ctx.flushing = false;
  }
}

/**
 * Thunder's Deafened: counters, reflects and Traps applied by a unit with `muteTraps` don't trigger.
 * Each muted attempt is announced as the `trapMuted` signal (from that unit).
 */
export function mutedTrap(ctx: Ctx, e: EffectInstance, spec: TriggerSpec): boolean {
  if (!spec.intercept && e.sourceArchetype !== 'Trap' && effectKeyOf(e) !== 'trap') return false;
  const src = findUnit(ctx.s, e.source);
  if (!src || modsOn(ctx.s, ctx.c, src.id, 'muteTraps').length === 0) return false;
  broadcastSignal(ctx, 'trapMuted', src, { target: unit(ctx, e.bearer) });
  return true;
}

export function runTrigger(ctx: Ctx, e: EffectInstance, p: PendingTrigger): void {
  if (mutedTrap(ctx, e, p.spec)) return;
  revealEffect(ctx, e);
  const sc: Scope = {
    actor: e.source,
    targets: e.targets,
    bearer: e.bearer,
    self: e,
    vars: {},
    lastDamage: 0,
    lastDamaged: [],
    direct: false,
    bypass: false,
    ...(p.eventSource !== undefined ? { eventSource: p.eventSource } : {}),
    ...(p.eventTarget !== undefined ? { eventTarget: p.eventTarget } : {}),
    ...(p.eventTargets !== undefined ? { eventTargets: p.eventTargets } : {}),
    ...(p.eventSkill !== undefined ? { eventSkill: p.eventSkill } : {}),
    ...(p.eventEffect !== undefined ? { eventEffect: p.eventEffect } : {}),
    ...(p.eventAmount !== undefined ? { eventAmount: p.eventAmount } : {}),
    ...(p.snapshot !== undefined ? { snapshot: p.snapshot } : {}),
    ...(p.eventDuration !== undefined ? { eventDuration: p.eventDuration } : {}),
  };
  // A skill's effect reacting to something counts as "triggered" (Traps, Counters, Misleads);
  // equipment can respond to that on the effect's source.
  if (!PERIODIC.has(p.spec.on)) {
    e.data.triggered = true;
    if (e.sourceSkill) {
      enqueueFor(ctx, e.source, 'ownEffectTriggered', {
        eventTarget: e.bearer,
        eventSkill: e.sourceSkill,
        eventEffect: e.id,
        ...(p.eventSource !== undefined ? { eventSource: p.eventSource } : {}),
        counter: !!p.spec.intercept,
        reflected: p.spec.intercept === 'reflect',
        effectKey: effectKeyOf(e),
      });
    }
  }
  // Run nested so triggers caused by this payload queue behind it.
  const wasFlushing = ctx.flushing;
  ctx.flushing = true;
  try {
    for (const op of p.spec.do ?? []) runOp(ctx, op, sc);
  } finally {
    ctx.flushing = wasFlushing;
  }
  if (p.spec.consume) removeEffect(ctx, e, 'consumed');
}

/** Enqueues matching triggers of `event` on every effect borne by `bearer`. */
export function enqueueTriggers(
  ctx: Ctx,
  bearer: UnitId,
  event: 'skillUsed' | 'skillResolved' | 'skillTargeted' | 'turnStart' | 'turnEnd' | 'battleStart',
  filter: {
    harmful?: boolean;
    strategic?: boolean;
    /** The event source's side relative to the bearer (for `when.side`). */
    side?: 'ally' | 'enemy';
    /** The skill behind the event (for `when.archetypes`). */
    eventSkill?: string;
    eventSource?: UnitId;
    eventTarget?: UnitId;
    eventTargets?: UnitId[];
    /** Only effects that existed before this seq (so a skill's own new effects don't react to it). */
    maxSeq?: number;
  } = {},
): void {
  for (const e of effectsOn(ctx.s, bearer)) {
    if (filter.maxSeq !== undefined && e.seq > filter.maxSeq) continue;
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== event || spec.intercept) continue;
      if (spec.when?.harmful !== undefined && spec.when.harmful !== filter.harmful) continue;
      if (spec.when?.strategic !== undefined && spec.when.strategic !== filter.strategic) continue;
      if (spec.when?.side !== undefined && filter.side !== undefined && spec.when.side !== filter.side) continue;
      if (spec.when?.archetypes && !spec.when.archetypes.includes(archetypeOf(ctx.c, filter.eventSkill) ?? '')) continue;
      ctx.triggerQueue.push({
        ...(filter.eventSkill !== undefined ? { eventSkill: filter.eventSkill } : {}),
        effect: e.id,
        spec,
        ...(filter.eventSource !== undefined ? { eventSource: filter.eventSource } : {}),
        ...(filter.eventTarget !== undefined ? { eventTarget: filter.eventTarget } : {}),
        ...(filter.eventTargets !== undefined ? { eventTargets: filter.eventTargets } : {}),
      });
    }
  }
}


/** Alchemy's Transmute recipes, by the unit's side relative to the actor. */
const TRANSMUTE_ENEMY: Record<string, string> = { might: 'weakness', armor: 'vulnerable', focus: 'confusion', renew: 'weakness' };
const TRANSMUTE_ALLY: Record<string, string> = { weakness: 'might', vulnerable: 'armor', confusion: 'focus' };

/**
 * Alchemy's Catalyst: 2 while a skill resolves and `t` carries a Catalyst (which is marked spent,
 * to end when the skill has resolved), else 1.
 */
function catalyze(ctx: Ctx, t: Unit): number {
  if (!ctx.inSkill) return 1;
  const cat = modsOn(ctx.s, ctx.c, t.id, 'catalyst')[0];
  if (!cat) return 1;
  cat.effect.data.catalyzed = true;
  return 2;
}

function doubleDuration(d: ResolvedDuration): ResolvedDuration {
  if (d === 'permanent' || 'thisTurn' in d) return d;
  if ('enemyTurns' in d) return { enemyTurns: d.enemyTurns * 2 };
  if ('ownTurns' in d) return { ownTurns: d.ownTurns * 2 };
  return { raw: d.raw * 2 };
}
