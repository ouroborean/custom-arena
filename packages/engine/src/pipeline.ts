// The Skill Use Pipeline (GDD §3.6). Every skill use, queued or reflected, goes through here.

import { effectDef, effectsOn, emit, findUnit, isEnemy, livingUnits, skillDef, unit, type Ctx } from './ctx.js';
import type { SkillDef, TriggerSpec } from './defs.js';
import { dealDamage } from './damage.js';
import { costTotal } from './energy.js';
import { interruptChannels, removeEffect, revealEffect } from './effects.js';
import { broadcastSignal, enqueueFor, enqueueTriggers, evalCond, flushTriggers, mutedTrap, runOps, runTrigger, type Scope } from './ops.js';
import {
  canTarget,
  cannotUseReason,
  cooldownOnUse,
  effectiveTags,
  extraTargetFor,
  forcedTargets,
  hasGrantBypass,
  ignoresCounters,
  isExcludedTarget,
  bloodPriceHp,
  modifiedCost,
  modsFor,
  modsOn,
} from './queries.js';
import { nextInt } from './rng.js';
import type { EffectInstance, QueuedAction, Unit, UnitId } from './types.js';

export type TargetResult = { ok: true; targets: UnitId[] } | { ok: false; reason: string };

/**
 * Resolves a skill's targets. `strict` (queue time) rejects a declared target that breaks a Taunt;
 * at resolution time the target is redirected to the taunter instead.
 */
export function resolveTargets(ctx: Ctx, actor: Unit, def: SkillDef, declared: UnitId[], strict: boolean): TargetResult {
  const r = resolveTargetsWithExtras(ctx, actor, def, declared, strict);
  // Equipment can also rule targets out (Hand of Healing: never yourself).
  if (!r.ok) return r;
  // Thunder's Stormspire: a skill aimed at every one of a side hits only the unit drawing the storm.
  if (def.target === 'allEnemies' && r.targets.length > 1) {
    const rod = r.targets.find((id) => modsOn(ctx.s, ctx.c, id, 'absorbAoE').length > 0);
    if (rod) return { ok: true, targets: [rod] };
  }
  const kept = r.targets.filter((id) => !isExcludedTarget(ctx, actor, def, unit(ctx, id)));
  if (kept.length === r.targets.length) return r;
  if (kept.length === 0) return { ok: false, reason: 'target not allowed' };
  return { ok: true, targets: kept };
}

function resolveTargetsWithExtras(ctx: Ctx, actor: Unit, def: SkillDef, declared: UnitId[], strict: boolean): TargetResult {
  // Equipment can open extra targets (a Maneuver on an ally, a Consume on an allied minion).
  const first = declared[0] === undefined ? undefined : findUnit(ctx.s, declared[0]);
  if (first?.alive && extraTargetFor(ctx, actor, def, first) && !naturalTarget(ctx, actor, def, first)) {
    return { ok: true, targets: [first.id] };
  }
  const r = resolveTargetsRaw(ctx, actor, def, declared, strict);
  // "Target Condemned enemy" and similar requirements on single-target skills.
  if (r.ok && def.targetFilter && (def.target === 'enemy' || def.target === 'ally' || def.target === 'any')) {
    const t = r.targets[0]!;
    const ok = evalCond(ctx, def.targetFilter, {
      actor: actor.id,
      targets: r.targets,
      it: t,
      vars: {},
      lastDamage: 0,
      lastDamaged: [],
      direct: true,
      bypass: false,
    });
    if (!ok) return { ok: false, reason: 'target does not meet the requirement' };
  }
  return r;
}

/** Would the skill normally be able to pick this target (without equipment)? */
function naturalTarget(ctx: Ctx, actor: Unit, def: SkillDef, t: Unit): boolean {
  if (def.target === 'self') return t.id === actor.id;
  return resolveTargetsRaw(ctx, actor, def, [t.id], true).ok;
}

function resolveTargetsRaw(ctx: Ctx, actor: Unit, def: SkillDef, declared: UnitId[], strict: boolean): TargetResult {
  const bypass = effectiveTags(ctx, actor, def).includes('Bypass') || hasGrantBypass(ctx, actor);
  switch (def.target) {
    case 'self':
      return { ok: true, targets: [actor.id] };
    case 'none':
      return { ok: true, targets: [] };
    case 'allEnemies': {
      const ts = ctx.s.units.filter((u) => u.alive && isEnemy(actor, u) && canTarget(ctx, actor, u, bypass));
      return ts.length ? { ok: true, targets: ts.map((u) => u.id) } : { ok: false, reason: 'no valid targets' };
    }
    case 'allAllies': {
      const ts = livingUnits(ctx.s, actor.owner).filter((u) => canTarget(ctx, actor, u, bypass));
      return ts.length ? { ok: true, targets: ts.map((u) => u.id) } : { ok: false, reason: 'no valid targets' };
    }
    case 'enemy': {
      let id = declared[0];
      const forced = forcedTargets(ctx, actor).filter((f) => {
        const fu = findUnit(ctx.s, f);
        return !!fu && canTarget(ctx, actor, fu, bypass);
      });
      if (forced.length > 0 && (id === undefined || !forced.includes(id))) {
        if (strict) return { ok: false, reason: 'taunted' };
        id = forced[0];
      }
      const t = id === undefined ? undefined : findUnit(ctx.s, id);
      if (!t || !t.alive) return { ok: false, reason: 'target is not alive' };
      if (!isEnemy(actor, t)) return { ok: false, reason: 'target is not an enemy' };
      if (!canTarget(ctx, actor, t, bypass)) return { ok: false, reason: 'target cannot be targeted' };
      return { ok: true, targets: [t.id] };
    }
    case 'any': {
      const id = declared[0];
      const t = id === undefined ? undefined : findUnit(ctx.s, id);
      if (!t || !t.alive) return { ok: false, reason: 'target is not alive' };
      if (!canTarget(ctx, actor, t, bypass)) return { ok: false, reason: 'target cannot be targeted' };
      if (isEnemy(actor, t)) {
        const forced = forcedTargets(ctx, actor);
        if (forced.length > 0 && !forced.includes(t.id)) {
          if (strict) return { ok: false, reason: 'taunted' };
          const f = findUnit(ctx.s, forced[0]!);
          if (f?.alive && canTarget(ctx, actor, f, bypass)) return { ok: true, targets: [f.id] };
        }
      }
      return { ok: true, targets: [t.id] };
    }
    case 'ally': {
      const id = declared[0];
      const t = id === undefined ? undefined : findUnit(ctx.s, id);
      if (!t || !t.alive) return { ok: false, reason: 'target is not alive' };
      if (isEnemy(actor, t)) return { ok: false, reason: 'target is not an ally' };
      if (!canTarget(ctx, actor, t, bypass)) return { ok: false, reason: 'target cannot be targeted' };
      return { ok: true, targets: [t.id] };
    }
  }
}

function fail(ctx: Ctx, actor: Unit, def: SkillDef, reason: string, refunded: boolean): void {
  const privateTo = def.tags.includes('Invisible') ? actor.owner : undefined;
  emit(ctx, { t: 'skillFailed', actor: actor.id, skill: def.id, reason, refunded }, privateTo);
}

/** Requirement on the user ("Requires Flow"); returns a reason if it isn't met. */
export function unmetRequirement(ctx: Ctx, actor: Unit, def: SkillDef): string | null {
  if (!def.requires) return null;
  const ok = evalCond(ctx, def.requires, {
    actor: actor.id,
    targets: [],
    vars: {},
    lastDamage: 0,
    lastDamaged: [],
    direct: true,
    bypass: false,
  });
  return ok ? null : 'requirement not met';
}

/** Is this use Harmful? A Radiant skill is Harmful only when its first target is an enemy (Divine). */
export function harmfulUse(ctx: Ctx, actor: Unit, def: SkillDef, targets: UnitId[]): boolean {
  if (!def.tags.includes('Radiant')) return def.tags.includes('Harmful');
  const first = targets[0] === undefined ? undefined : findUnit(ctx.s, targets[0]);
  return !!first && isEnemy(actor, first);
}

function interceptorFor(
  ctx: Ctx,
  actor: Unit,
  def: SkillDef,
  targets: UnitId[],
): { effect: EffectInstance; spec: TriggerSpec } | null {
  const harmful = harmfulUse(ctx, actor, def, targets);
  const strategic = def.tags.includes('Strategic');
  // Counters catch Harmful skills unless they say otherwise (Dunk: Helpful; Riverbend: Strategic).
  const matches = (spec: TriggerSpec) =>
    (spec.when?.harmful ?? true) === harmful &&
    (spec.when?.strategic === undefined || spec.when.strategic === strategic) &&
    (spec.when?.costAtLeast === undefined || costTotal(def.cost) >= spec.when.costAtLeast);
  const found: { effect: EffectInstance; spec: TriggerSpec }[] = [];
  for (const e of effectsOn(ctx.s, actor.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on === 'skillUsed' && spec.intercept && matches(spec) && !mutedTrap(ctx, e, spec)) found.push({ effect: e, spec });
    }
  }
  for (const tid of targets) {
    const t = unit(ctx, tid);
    if (!isEnemy(actor, t)) continue;
    for (const e of effectsOn(ctx.s, tid)) {
      for (const spec of effectDef(ctx.c, e).triggers ?? []) {
        if (spec.on === 'skillTargeted' && spec.intercept && matches(spec) && !mutedTrap(ctx, e, spec)) found.push({ effect: e, spec });
      }
    }
  }
  found.sort((a, b) => a.effect.seq - b.effect.seq);
  return found[0] ?? null;
}

/** Executes one queued action. Energy was already paid at commit. */
export function useQueuedSkill(ctx: Ctx, action: QueuedAction): void {
  const actor = unit(ctx, action.actor);
  const slot = actor.skills[action.slot];
  if (!slot) throw new Error(`Bad slot ${action.slot} on ${actor.id}`);
  const def = skillDef(ctx.c, slot.defId);
  const player = ctx.s.players[actor.owner];

  // 1. Can-act check. Failure: energy stays spent, no cooldown (Q7, R1).
  if (!actor.alive) return fail(ctx, actor, def, 'dead', false);
  const blocked = cannotUseReason(ctx, actor, def) ?? unmetRequirement(ctx, actor, def);
  if (blocked) return fail(ctx, actor, def, blocked, false);

  // Cost re-validation: if the cost rose since queueing, the skill fails and is refunded (§3.4).
  if (costTotal(modifiedCost(ctx, actor, def)) > costTotal(action.cost)) {
    if (action.paid) for (const c of ['S', 'A', 'I', 'W'] as const) player.energy[c] += action.paid[c];
    return fail(ctx, actor, def, 'cost increased', true);
  }

  // 2. Target re-resolution.
  const tr = resolveTargets(ctx, actor, def, action.targets, false);
  if (!tr.ok) return fail(ctx, actor, def, tr.reason, false);

  const targets = fogTargets(ctx, actor, def, blindTargets(ctx, actor, def, tr.targets));
  // Blood's Blood Price: the random costs are paid in HP now (it fails if that would kill).
  const blood = bloodPriceHp(ctx, actor, def);
  actor.counters.blood_paid = blood;
  if (blood > 0) {
    if (blood >= actor.hp) return fail(ctx, actor, def, 'Blood Price would kill', false);
    dealDamage(ctx, { source: actor, target: actor, amount: blood, type: 'Affliction', direct: false, bypass: true, raw: true });
  }
  // Cloud's Drift: the use hangs in the air (cooldown starts now) and lands next turn (landDrifting).
  if (def.tags.includes('Drift') || modsOn(ctx.s, ctx.c, actor.id, 'driftSkills').length > 0) {
    if (slot) slot.cooldown = cooldownOnUse(ctx, actor, def);
    actor.counters.actedTurn = ctx.s.turn;
    (ctx.s.drifting ??= []).push({ actor: actor.id, slot: action.slot, defId: def.id, targets });
    emit(ctx, { t: 'skillDrifting', actor: actor.id, skill: def.id, targets });
    return;
  }
  useSkill(ctx, actor, action.slot, def, targets);
}

/**
 * Lands the active player's drifting skills: each resolves now on the same targets if they're still
 * valid (otherwise a random valid one), even if the user is Stunned; it's lost if they died.
 */
export function landDrifting(ctx: Ctx): void {
  const p = ctx.s.activePlayer;
  const mine = (ctx.s.drifting ?? []).filter((d) => unit(ctx, d.actor).owner === p);
  if (mine.length === 0) return;
  ctx.s.drifting = (ctx.s.drifting ?? []).filter((d) => !mine.includes(d));
  for (const d of mine) {
    const actor = unit(ctx, d.actor);
    if (!actor.alive || ctx.s.phase === 'finished') continue;
    const def = skillDef(ctx.c, d.defId);
    let tr = resolveTargets(ctx, actor, def, d.targets, false);
    if (!tr.ok && (def.target === 'enemy' || def.target === 'ally' || def.target === 'any')) {
      const legal = ctx.s.units.filter((u) => u.alive && resolveTargets(ctx, actor, def, [u.id], true).ok);
      if (legal.length > 0) tr = { ok: true, targets: [legal[nextInt(ctx.s.rng, legal.length)]!.id] };
    }
    if (!tr.ok) continue;
    useSkill(ctx, actor, d.slot, def, tr.targets, { landing: true });
    flushTriggers(ctx);
  }
}

/** Blinded: a single-target skill's primary target is re-rolled among every legal target (GDD §3.6). */
function blindTargets(ctx: Ctx, actor: Unit, def: SkillDef, targets: UnitId[]): UnitId[] {
  if (def.target !== 'enemy' && def.target !== 'ally' && def.target !== 'any') return targets;
  if (modsOn(ctx.s, ctx.c, actor.id, 'randomPrimaryTarget').length === 0) return targets;
  const legal = ctx.s.units.filter((u) => u.alive && resolveTargets(ctx, actor, def, [u.id], true).ok);
  if (legal.length === 0) return targets;
  return [legal[nextInt(ctx.s.rng, legal.length)]!.id];
}

/**
 * Mist's Fog: an enemy single-target skill aimed at a Fogged unit lands on a random legal unit of
 * that side instead. A redirect onto someone else sends a `fog_redirect` signal from the Fogged unit
 * (its target is the skill's user).
 */
function fogTargets(ctx: Ctx, actor: Unit, def: SkillDef, targets: UnitId[]): UnitId[] {
  if (def.target !== 'enemy' && def.target !== 'ally' && def.target !== 'any') return targets;
  const first = targets[0] ? findUnit(ctx.s, targets[0]) : undefined;
  if (!first || !isEnemy(actor, first) || modsOn(ctx.s, ctx.c, first.id, 'fogged').length === 0) return targets;
  const legal = ctx.s.units.filter((u) => u.alive && u.owner === first.owner && resolveTargets(ctx, actor, def, [u.id], true).ok);
  if (legal.length === 0) return targets;
  const pick = legal[nextInt(ctx.s.rng, legal.length)]!;
  if (pick.id !== first.id) {
    first.counters.fog_redirect_turn = ctx.s.turn;
    broadcastSignal(ctx, 'fog_redirect', first, { target: actor });
  }
  return [pick.id];
}

export function useSkill(ctx: Ctx, actor: Unit, slotIndex: number, def: SkillDef, targets: UnitId[], opts: { landing?: boolean } = {}): void {
  const harmful = harmfulUse(ctx, actor, def, targets);
  const tags = effectiveTags(ctx, actor, def);
  // "Allies that acted before you this turn" (equipment).
  actor.counters.actedTurn = ctx.s.turn;

  // 3. Cooldown starts, and using a skill ends the user's other channels (Q6), unless equipment says otherwise.
  const slot = actor.skills[slotIndex];
  // A landing Drift already started its cooldown when it was used.
  if (slot && !opts.landing) slot.cooldown = cooldownOnUse(ctx, actor, def);
  if (modsFor(ctx, actor.id, 'keepChannels', def).length === 0) interruptChannels(ctx, actor, 'skillUse');

  const secret = tags.includes('HiddenTarget');
  const privateTo = tags.includes('Invisible') ? actor.owner : undefined;
  // Stealth (Shadow): Stealthy skills keep it; anything else ends it once this use is over.
  const stealthy = def.tags.includes('Stealthy') || modsOn(ctx.s, ctx.c, actor.id, 'nextSkillStealthy').length > 0;
  const stealthed = effectsOn(ctx.s, actor.id).filter((e) => effectDef(ctx.c, e).stealth);
  emit(
    ctx,
    {
      t: 'skillUsed',
      actor: actor.id,
      skill: def.id,
      targets,
      ...(secret ? { secretFrom: actor.owner === 0 ? 1 : 0 } : {}),
      // R6: a Stealthed unit's Stealthy actions only show as "a Stealthed unit acted".
      ...(stealthy && stealthed.length > 0 ? { stealthFrom: actor.owner === 0 ? 1 : 0 } : {}),
    },
    privateTo,
  );
  // "Each time your team uses a Storm skill": every skill use is heard by its element (Storm's Tempest).
  broadcastSignal(ctx, `used:${def.element}`, actor, { eventSkill: def.id });

  // "Until the bearer uses a skill" effects apply to this use, then end once it has resolved.
  // Only effects that existed before this use qualify (not ones the skill itself applies).
  const ending = effectsOn(ctx.s, actor.id).filter(
    (e) =>
      e.until &&
      !(e.until.skillUsed.harmful && !harmful) &&
      !(e.until.skillUsed.nonStrategic && def.tags.includes('Strategic')) &&
      !(e.until.skillUsed.archetypes && !e.until.skillUsed.archetypes.includes(def.archetype)),
  );
  const wasInSkill = ctx.inSkill;
  ctx.inSkill = true;
  try {
    resolveUse(ctx, actor, slotIndex, def, targets, harmful);
  } finally {
    ctx.inSkill = wasInSkill;
    // Alchemy's Catalyst: spent once the skill it doubled has resolved.
    for (const e of ctx.s.effects.filter((x) => x.data.catalyzed)) removeEffect(ctx, e, 'consumed');
    // Uses per skill (Ocean's Crest and Trough alternate on it).
    actor.counters[`uses:${def.id}`] = (actor.counters[`uses:${def.id}`] ?? 0) + 1;
    actor.counters.lastSlot = slotIndex;
    for (const e of ending) removeEffect(ctx, e, 'consumed');
    for (const e of stealthed) {
      if (!ctx.s.effects.includes(e)) continue;
      if (!stealthy) removeEffect(ctx, e, 'consumed');
      else if (e.duration !== null) e.duration += 2;
    }
  }
}

function resolveUse(ctx: Ctx, actor: Unit, slotIndex: number, def: SkillDef, targets: UnitId[], harmful: boolean): void {

  // 4a. Traps and other on-use triggers fire whether or not the skill is countered.
  const startSeq = ctx.s.seq;
  enqueueTriggers(ctx, actor.id, 'skillUsed', {
    harmful,
    strategic: def.tags.includes('Strategic'),
    eventSource: actor.id,
    eventTarget: actor.id,
    eventTargets: targets,
    eventSkill: def.id,
  });
  flushTriggers(ctx);
  if (!actor.alive || ctx.s.phase === 'finished') return;

  // 4b. Counters and reflects (Uncounterable skills and Flow users ignore them).
  const hit = effectiveTags(ctx, actor, def).includes('Uncounterable') ? null : interceptorFor(ctx, actor, def, targets);
  if (hit && ignoresCounters(ctx, actor)) {
    // Flow "triggers" (Emblem of the Tide).
    enqueueFor(ctx, actor.id, 'counterIgnored', {
      eventSource: hit.effect.bearer,
      eventSkill: def.id,
      reflected: hit.spec.intercept === 'reflect',
    });
    flushTriggers(ctx);
  } else if (hit) {
    const { effect, spec } = hit;
    const reflector = unit(ctx, effect.bearer);
    revealEffect(ctx, effect);
    emit(ctx, {
      t: 'skillCountered',
      actor: actor.id,
      skill: def.id,
      by: reflector.id,
      effect: effect.defId,
      reflected: spec.intercept === 'reflect',
    });
    runTrigger(ctx, effect, { effect: effect.id, spec, eventSource: actor.id, eventTarget: reflector.id });
    // The user's equipment hears its skill was stopped; so does everyone else's (Mask of Many Faces).
    enqueueFor(ctx, actor.id, 'countered', {
      eventSource: reflector.id,
      eventSkill: def.id,
      harmful,
      reflected: spec.intercept === 'reflect',
    });
    broadcastSignal(ctx, 'countered', actor, { target: reflector, eventSkill: def.id });
    flushTriggers(ctx);
    if (def.onCountered?.length && ctx.s.result === null) {
      runOps(ctx, def.onCountered, {
        actor: actor.id,
        targets,
        eventSource: reflector.id,
        vars: {},
        lastDamage: 0,
        lastDamaged: [],
        direct: true,
        bypass: false,
        skill: def,
      });
      flushTriggers(ctx);
    }
    if (spec.intercept === 'reflect' && reflector.alive && actor.alive) {
      const aoe = def.target === 'allEnemies';
      const reflectedTargets = aoe ? livingUnits(ctx.s, actor.owner).map((u) => u.id) : [actor.id];
      runSkillOps(ctx, reflector, def, reflectedTargets);
    }
    return;
  }

  // 5. Execute the skill's ops.
  runSkillOps(ctx, actor, def, targets, slotIndex);

  // 5b. "When targeted" reactions on the targets (Conduit), for effects that predate this use.
  if (ctx.s.result === null) {
    for (const id of targets) {
      const t = unit(ctx, id);
      if (!t.alive) continue;
      enqueueTriggers(ctx, id, 'skillTargeted', {
        harmful,
        strategic: def.tags.includes('Strategic'),
        side: t.owner === actor.owner ? 'ally' : 'enemy',
        eventSource: actor.id,
        eventTarget: id,
        maxSeq: startSeq,
      });
    }
    flushTriggers(ctx);
  }

  // 6. After-resolution triggers on the user (only effects that existed before this use).
  if (actor.alive && ctx.s.result === null) {
    enqueueTriggers(ctx, actor.id, 'skillResolved', {
      harmful,
      strategic: def.tags.includes('Strategic'),
      eventSource: actor.id,
      eventTargets: targets,
      maxSeq: startSeq,
      eventSkill: def.id,
    });
    flushTriggers(ctx);
  }
}

function runSkillOps(ctx: Ctx, actor: Unit, def: SkillDef, targets: UnitId[], slot?: number): void {
  const sc: Scope = {
    ...(slot !== undefined ? { slot } : {}),
    actor: actor.id,
    targets,
    vars: {},
    lastDamage: 0,
    lastDamaged: [],
    direct: true,
    bypass: effectiveTags(ctx, actor, def).includes('Bypass') || hasGrantBypass(ctx, actor),
    skill: def,
  };
  // A target opened by equipment: run its alternative ops, or resolve as the target's own use.
  const only = targets.length === 1 ? findUnit(ctx.s, targets[0]!) : undefined;
  const extra = only ? extraTargetFor(ctx, actor, def, only) : null;
  if (only && extra && !naturalTarget(ctx, actor, def, only)) {
    if (extra.ops) return runOps(ctx, extra.ops, sc);
    if (extra.castAs) sc.actor = only.id;
  }
  runOps(ctx, def.ops, sc);
}
