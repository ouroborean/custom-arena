// The Skill Use Pipeline (GDD §3.6). Every skill use, queued or reflected, goes through here.

import { effectDef, effectsOn, emit, findUnit, isEnemy, livingUnits, skillDef, unit, type Ctx } from './ctx.js';
import type { SkillDef, TriggerSpec } from './defs.js';
import { costTotal } from './energy.js';
import { interruptChannels, removeEffect, revealEffect } from './effects.js';
import { enqueueTriggers, flushTriggers, runOps, runTrigger, type Scope } from './ops.js';
import { canTarget, cannotUseReason, cooldownOnUse, forcedTargets, modifiedCost } from './queries.js';
import type { EffectInstance, QueuedAction, Unit, UnitId } from './types.js';

export type TargetResult = { ok: true; targets: UnitId[] } | { ok: false; reason: string };

/**
 * Resolves a skill's targets. `strict` (queue time) rejects a declared target that breaks a Taunt;
 * at resolution time the target is redirected to the taunter instead.
 */
export function resolveTargets(ctx: Ctx, actor: Unit, def: SkillDef, declared: UnitId[], strict: boolean): TargetResult {
  const bypass = def.tags.includes('Bypass');
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

function interceptorFor(
  ctx: Ctx,
  actor: Unit,
  targets: UnitId[],
): { effect: EffectInstance; spec: TriggerSpec } | null {
  const found: { effect: EffectInstance; spec: TriggerSpec }[] = [];
  for (const e of effectsOn(ctx.s, actor.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on === 'skillUsed' && spec.intercept && spec.when?.harmful !== false) found.push({ effect: e, spec });
    }
  }
  for (const tid of targets) {
    const t = unit(ctx, tid);
    if (!isEnemy(actor, t)) continue;
    for (const e of effectsOn(ctx.s, tid)) {
      for (const spec of effectDef(ctx.c, e).triggers ?? []) {
        if (spec.on === 'skillTargeted' && spec.intercept && spec.when?.harmful !== false) found.push({ effect: e, spec });
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
  const blocked = cannotUseReason(ctx, actor, def);
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

  // "Until the bearer uses a skill" effects end now (they were applied before this use).
  for (const e of effectsOn(ctx.s, actor.id)) {
    if (!e.until) continue;
    if (e.until.skillUsed.harmful && !harmful) continue;
    removeEffect(ctx, e, 'consumed');
  }

  // 4a. Traps and other on-use triggers fire whether or not the skill is countered.
  enqueueTriggers(ctx, actor.id, 'skillUsed', { harmful, eventSource: actor.id, eventTarget: actor.id });
  flushTriggers(ctx);
  if (!actor.alive || ctx.s.phase === 'finished') return;

  // 4b. Counters and reflects.
  if (harmful && !def.tags.includes('Uncounterable')) {
    const hit = interceptorFor(ctx, actor, targets);
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
      if (spec.intercept === 'reflect' && reflector.alive && actor.alive) {
        const aoe = def.target === 'allEnemies';
        const reflectedTargets = aoe ? livingUnits(ctx.s, actor.owner).map((u) => u.id) : [actor.id];
        runSkillOps(ctx, reflector, def, reflectedTargets);
      }
      return;
    }
  }

  // 5. Execute the skill's ops.
  runSkillOps(ctx, actor, def, targets);
}

function runSkillOps(ctx: Ctx, actor: Unit, def: SkillDef, targets: UnitId[]): void {
  const sc: Scope = {
    actor: actor.id,
    targets,
    vars: {},
    lastDamage: 0,
    lastDamaged: [],
    direct: true,
    bypass: def.tags.includes('Bypass'),
    skill: def,
  };
  runOps(ctx, def.ops, sc);
}
