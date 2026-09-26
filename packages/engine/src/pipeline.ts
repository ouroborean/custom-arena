// The Skill Use Pipeline (GDD §3.6). Every skill use, queued or reflected, goes through here.

import { effectDef, effectsOn, emit, findUnit, isEnemy, livingUnits, skillDef, unit, type Ctx } from './ctx.js';
import type { SkillDef, TriggerSpec } from './defs.js';
import { costTotal } from './energy.js';
import { interruptChannels, removeEffect, revealEffect } from './effects.js';
import { enqueueTriggers, evalCond, flushTriggers, runOps, runTrigger, type Scope } from './ops.js';
import { canTarget, cannotUseReason, cooldownOnUse, forcedTargets, hasGrantBypass, ignoresCounters, modifiedCost } from './queries.js';
import type { EffectInstance, QueuedAction, Unit, UnitId } from './types.js';

export type TargetResult = { ok: true; targets: UnitId[] } | { ok: false; reason: string };

/**
 * Resolves a skill's targets. `strict` (queue time) rejects a declared target that breaks a Taunt;
 * at resolution time the target is redirected to the taunter instead.
 */
export function resolveTargets(ctx: Ctx, actor: Unit, def: SkillDef, declared: UnitId[], strict: boolean): TargetResult {
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

function resolveTargetsRaw(ctx: Ctx, actor: Unit, def: SkillDef, declared: UnitId[], strict: boolean): TargetResult {
  const bypass = def.tags.includes('Bypass') || hasGrantBypass(ctx, actor);
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

function interceptorFor(
  ctx: Ctx,
  actor: Unit,
  def: SkillDef,
  targets: UnitId[],
): { effect: EffectInstance; spec: TriggerSpec } | null {
  const harmful = def.tags.includes('Harmful');
  const strategic = def.tags.includes('Strategic');
  // Counters catch Harmful skills unless they say otherwise (Dunk: Helpful; Riverbend: Strategic).
  const matches = (spec: TriggerSpec) =>
    (spec.when?.harmful ?? true) === harmful && (spec.when?.strategic === undefined || spec.when.strategic === strategic);
  const found: { effect: EffectInstance; spec: TriggerSpec }[] = [];
  for (const e of effectsOn(ctx.s, actor.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on === 'skillUsed' && spec.intercept && matches(spec)) found.push({ effect: e, spec });
    }
  }
  for (const tid of targets) {
    const t = unit(ctx, tid);
    if (!isEnemy(actor, t)) continue;
    for (const e of effectsOn(ctx.s, tid)) {
      for (const spec of effectDef(ctx.c, e).triggers ?? []) {
        if (spec.on === 'skillTargeted' && spec.intercept && matches(spec)) found.push({ effect: e, spec });
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

  useSkill(ctx, actor, action.slot, def, tr.targets);
}

export function useSkill(ctx: Ctx, actor: Unit, slotIndex: number, def: SkillDef, targets: UnitId[]): void {
  const harmful = def.tags.includes('Harmful');

  // 3. Cooldown starts, and using a skill ends the user's other channels (Q6).
  const slot = actor.skills[slotIndex];
  if (slot) slot.cooldown = cooldownOnUse(ctx, actor, def);
  interruptChannels(ctx, actor, 'skillUse');

  const secret = def.tags.includes('HiddenTarget');
  const privateTo = def.tags.includes('Invisible') ? actor.owner : undefined;
  emit(
    ctx,
    {
      t: 'skillUsed',
      actor: actor.id,
      skill: def.id,
      targets,
      ...(secret ? { secretFrom: actor.owner === 0 ? 1 : 0 } : {}),
    },
    privateTo,
  );

  // "Until the bearer uses a skill" effects apply to this use, then end once it has resolved.
  // Only effects that existed before this use qualify (not ones the skill itself applies).
  const ending = effectsOn(ctx.s, actor.id).filter(
    (e) =>
      e.until &&
      !(e.until.skillUsed.harmful && !harmful) &&
      !(e.until.skillUsed.nonStrategic && def.tags.includes('Strategic')),
  );
  try {
    resolveUse(ctx, actor, slotIndex, def, targets, harmful);
  } finally {
    for (const e of ending) removeEffect(ctx, e, 'consumed');
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
  });
  flushTriggers(ctx);
  if (!actor.alive || ctx.s.phase === 'finished') return;

  // 4b. Counters and reflects (Uncounterable skills and Flow users ignore them).
  if (!def.tags.includes('Uncounterable') && !ignoresCounters(ctx, actor)) {
    const hit = interceptorFor(ctx, actor, def, targets);
    if (hit) {
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
    bypass: def.tags.includes('Bypass') || hasGrantBypass(ctx, actor),
    skill: def,
  };
  runOps(ctx, def.ops, sc);
}
