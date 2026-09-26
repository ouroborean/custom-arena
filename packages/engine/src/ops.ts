// The skill DSL interpreter (GDD §11.5) and the trigger queue (GDD §11.4).

import {
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
import type { Cond, DurationSpec, EffectDef, NamedSelector, Op, ResolvedDuration, Selector, SkillDef, Value } from './defs.js';
import { applyEffect, removeEffect, revealEffect } from './effects.js';
import { canTarget } from './queries.js';
import { nextInt, pick, sample } from './rng.js';
import { COLORS, type EffectInstance, type Energy, type Unit, type UnitId } from './types.js';

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
  lastDamaged: UnitId[];
  lastSummoned?: UnitId;
  /** Default for damage ops: true for a skill's own ops, false for triggers and ticks. */
  direct: boolean;
  bypass: boolean;
  skill?: SkillDef | undefined;
  /** Slot of the skill being used (for resetCooldown). */
  slot?: number;
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
    case 'lastSummoned':
      return sc.lastSummoned ? one(ctx, sc.lastSummoned) : [];
    case 'allUnits':
      return ctx.s.units.filter((u) => u.alive);
  }
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
  return evalCond(ctx, v.if, sc) ? evalValue(ctx, v.then, sc) : evalValue(ctx, v.else, sc);
}

export function evalCond(ctx: Ctx, c: Cond, sc: Scope): boolean {
  if ('has' in c) {
    const u = select(ctx, c.has.unit, sc)[0];
    return !!u && hasEffect(ctx.s, u.id, c.has.effect);
  }
  if ('hasFromArchetype' in c) {
    const u = select(ctx, c.hasFromArchetype.unit, sc)[0];
    return !!u && effectsOn(ctx.s, u.id).some((e) => e.sourceArchetype === c.hasFromArchetype.archetype);
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
  return !!sc.vars[c.varTrue];
}

// ---------------------------------------------------------------- ops

/** Evaluates turn counts given as Values; null means "0 or fewer turns: apply nothing". */
function resolveDuration(ctx: Ctx, d: DurationSpec | undefined, sc: Scope): ResolvedDuration | undefined | null {
  if (d === undefined || d === 'permanent' || 'thisTurn' in d || 'raw' in d) return d;
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
      for (const t of select(ctx, op.to, sc)) {
        const amount = withIt(sc, t.id, () => evalValue(ctx, op.amount, sc));
        const dealt = dealDamage(ctx, {
          source: actor,
          target: t,
          amount,
          type: op.type ?? 'Normal',
          direct: op.direct ?? sc.direct,
          bypass: op.bypass ?? sc.bypass,
          ...(respectsInvulnerable ? { respectsInvulnerable } : {}),
          ...(op.wakes === false ? { wakes: false } : {}),
        });
        sc.lastDamage += dealt;
        if (dealt > 0) sc.lastDamaged.push(t.id);
      }
      return;
    }
    case 'heal':
      for (const t of select(ctx, op.to, sc)) heal(ctx, actor, t, withIt(sc, t.id, () => evalValue(ctx, op.amount, sc)));
      return;
    case 'apply': {
      const def = resolveEffectDef(ctx.c, op.effect);
      const remembered = op.remember ? select(ctx, op.remember, sc).map((u) => u.id) : [];
      const boundTo = op.bindTo ? select(ctx, op.bindTo, sc)[0]?.id : undefined;
      const src = op.from ? select(ctx, op.from, sc)[0] : actor;
      if (!src) return; // e.g. the minion it should come from wasn't summoned
      const linkedTo = op.linkTo
        ? effectsOn(ctx.s, actor.id).filter((e) => effectKeyOf(e) === op.linkTo).at(-1)?.id
        : undefined;
      if (op.linkTo && !linkedTo) return; // the channel it belongs to isn't running
      const duration = resolveDuration(ctx, op.duration, sc);
      if (duration === null) return; // e.g. "1 turn per 15 missing health" with too little missing
      for (const t of select(ctx, op.to, sc)) {
        withIt(sc, t.id, () => {
          const stacks = op.stacks === undefined ? 1 : evalValue(ctx, op.stacks, sc);
          if (stacks <= 0) return; // "1 Might per Ignite" with no Ignites applies nothing
          applyEffect(ctx, {
            def,
            inline: typeof op.effect !== 'string',
            bearer: t,
            source: src,
            sourceSkill: sc.skill,
            stacks,
            value: op.value === undefined ? 0 : evalValue(ctx, op.value, sc),
            duration,
            targets: remembered,
            until: op.until,
            boundTo,
            linkedTo,
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
      for (const t of select(ctx, op.to, sc)) killUnit(ctx, t);
      return;
    case 'removeEffect':
      for (const t of select(ctx, op.from, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (effectKeyOf(e) === op.effect) removeEffect(ctx, e, 'consumed');
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
          if (left <= 0 || effectKeyOf(e) !== op.effect) continue;
          const take = Math.min(e.stacks, left);
          e.stacks -= take;
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
      const slot = op.skill ? actor.skills.find((x) => x.defId === op.skill) : sc.slot === undefined ? undefined : actor.skills[sc.slot];
      if (slot) slot.cooldown = 0;
      return;
    }
    case 'adjustCooldowns': {
      const by = evalValue(ctx, op.by, sc);
      for (const t of select(ctx, op.to, sc)) {
        t.skills.forEach((slot, i) => {
          if (op.exceptCurrent && t.id === actor.id && i === sc.slot) return;
          if (op.skill && slot.defId !== op.skill) return;
          slot.cooldown = Math.max(0, slot.cooldown + by);
        });
      }
      return;
    }
    case 'extendEffects': {
      const keys = new Set(op.effects);
      for (const t of select(ctx, op.on, sc)) {
        for (const e of effectsOn(ctx.s, t.id)) if (keys.has(effectKeyOf(e)) && e.duration !== null) e.duration += op.by;
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
  ctx.s.units.push(m);
  emit(ctx, { t: 'summoned', unit: m.id, defId: def.id, by: summoner.id });
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
function broadcastSignal(ctx: Ctx, name: string, source: Unit): void {
  for (const e of ctx.s.effects) {
    const bearer = findUnit(ctx.s, e.bearer);
    if (!bearer?.alive) continue;
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'signal' || spec.signal !== name) continue;
      const side = bearer.owner === source.owner ? 'ally' : 'enemy';
      if (spec.when?.side && spec.when.side !== side) continue;
      ctx.triggerQueue.push({ effect: e.id, spec, eventSource: source.id, eventTarget: bearer.id });
    }
  }
}

function effectKeyOf(e: EffectInstance): string {
  return e.inline ? e.inline.id : e.defId;
}

// ---------------------------------------------------------------- triggers

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

export function runTrigger(ctx: Ctx, e: EffectInstance, p: PendingTrigger): void {
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
  };
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
  event: 'skillUsed' | 'skillResolved' | 'skillTargeted' | 'turnStart' | 'turnEnd',
  filter: {
    harmful?: boolean;
    strategic?: boolean;
    /** The event source's side relative to the bearer (for `when.side`). */
    side?: 'ally' | 'enemy';
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
      ctx.triggerQueue.push({
        effect: e.id,
        spec,
        ...(filter.eventSource !== undefined ? { eventSource: filter.eventSource } : {}),
        ...(filter.eventTarget !== undefined ? { eventTarget: filter.eventTarget } : {}),
        ...(filter.eventTargets !== undefined ? { eventTargets: filter.eventTargets } : {}),
      });
    }
  }
}

