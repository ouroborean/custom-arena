// Effect lifecycle: applying, refreshing, removing, revealing and interrupting effect instances.

import { effectDef, effectKey, effectsOn, emit, nextId, skillDef, type Ctx } from './ctx.js';
import type { EffectDef, ResolvedDuration, SkillDef, UntilSpec } from './defs.js';
import { compileDuration } from './duration.js';
import { enqueueFor } from './ops.js';
import { cannotUseReason, modsOn } from './queries.js';
import type { EffectInstance, RemoveReason, Unit, UnitId } from './types.js';

export interface ApplyArgs {
  def: EffectDef;
  /** True when `def` is defined inline (not a named status). */
  inline: boolean;
  bearer: Unit;
  source: Unit;
  sourceSkill?: SkillDef | undefined;
  stacks?: number;
  value?: number;
  duration?: ResolvedDuration | undefined;
  targets?: UnitId[];
  until?: UntilSpec | undefined;
  /** The effect ends when this unit leaves the board. */
  boundTo?: UnitId | undefined;
  /** Effect id this one is linked to: it ends when that effect ends. */
  linkedTo?: string | undefined;
  /** Don't fire effectApplied triggers (effects applied by passives about other applications). */
  quiet?: boolean;
}

export function isHidden(ctx: Ctx, e: EffectInstance): boolean {
  return effectDef(ctx.c, e).visibility === 'hidden' && !e.revealed;
}

export function applyEffect(ctx: Ctx, a: ApplyArgs): EffectInstance | null {
  const { def, bearer, source } = a;
  if (!bearer.alive) return null;
  const hidden = def.visibility === 'hidden';
  const privateTo = hidden ? source.owner : undefined;

  // Numb: the source can't apply Buffs.
  if (def.kind === 'Buff' && modsOn(ctx.s, ctx.c, source.id, 'cannotApplyBuffs').length > 0) {
    emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: `${source.name} can't apply buffs` }, privateTo);
    return null;
  }
  // Frostborn: immune to Debuffs from sources carrying certain effects.
  if (def.kind === 'Debuff') {
    for (const { spec } of modsOn(ctx.s, ctx.c, bearer.id, 'immuneToDebuffsFrom')) {
      if (spec.sourceHas.some((k) => effectsOn(ctx.s, source.id).some((e) => effectKey(e) === k))) {
        emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: 'immune to that source' }, privateTo);
        return null;
      }
    }
  }

  // Immune (and similar): cannot receive effects of this kind.
  if (modsOn(ctx.s, ctx.c, bearer.id, 'immuneTo').some(({ spec }) => spec.kind === def.kind)) {
    emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: 'immune' }, privateTo);
    return null;
  }

  // Swiftness-style negation: consume one stack of the negating effect instead.
  const negator = modsOn(ctx.s, ctx.c, bearer.id, 'negateNext').find(({ spec }) => spec.effect === def.id);
  if (negator) {
    const n = negator.effect;
    n.stacks -= 1;
    emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: `negated by ${effectDef(ctx.c, n).name}` });
    if (n.stacks <= 0) removeEffect(ctx, n, 'consumed');
    return null;
  }

  const duration = compileDuration(a.duration, source.owner, ctx.s.activePlayer);
  let stacks = a.stacks ?? 1;
  // Surge-style bonus: the source's next application of this effect gets extra stacks.
  const bonus = modsOn(ctx.s, ctx.c, source.id, 'bonusStacksOnApply').find(({ spec }) => spec.effect === def.id);
  if (bonus) {
    stacks += bonus.spec.amount;
    removeEffect(ctx, bonus.effect, 'consumed');
  }
  if (def.maxStacks !== undefined) stacks = Math.min(stacks, def.maxStacks);
  const value = a.value ?? 0;

  if (def.stacking === 'unique' || def.stacking === 'merge') {
    const merge = def.stacking === 'merge';
    const existing = effectsOn(ctx.s, bearer.id).find(
      (e) => effectKey(e) === def.id && (!merge || e.sourceOwner === source.owner),
    );
    if (existing) {
      existing.duration =
        existing.duration === null || duration === null ? null : Math.max(existing.duration, duration);
      existing.stacks = merge ? existing.stacks + stacks : Math.max(existing.stacks, stacks);
      if (def.maxStacks !== undefined) existing.stacks = Math.min(existing.stacks, def.maxStacks);
      existing.value = Math.max(existing.value, value);
      existing.source = source.id;
      existing.sourceOwner = source.owner;
      emit(
        ctx,
        {
          t: 'effectApplied',
          effect: existing.id,
          defId: existing.defId,
          bearer: bearer.id,
          source: source.id,
          stacks: existing.stacks,
          value: existing.value,
          duration: existing.duration,
        },
        privateTo,
      );
      enqueueEffectGained(ctx, bearer, def.id, source);
      if (!a.quiet) announceApplied(ctx, a, existing);
      return existing;
    }
  }

  const inst: EffectInstance = {
    id: nextId(ctx, 'e'),
    defId: a.inline ? `${a.sourceSkill?.id ?? 'effect'}:${def.id}` : def.id,
    source: source.id,
    sourceOwner: source.owner,
    bearer: bearer.id,
    stacks,
    value,
    duration,
    targets: a.targets ?? [],
    revealed: false,
    data: {},
    seq: ctx.s.seq,
  };
  if (a.inline) inst.inline = def;
  if (a.sourceSkill) {
    inst.sourceSkill = a.sourceSkill.id;
    inst.sourceArchetype = a.sourceSkill.archetype;
  }
  if (a.until) inst.until = a.until;
  if (a.boundTo) inst.data.boundTo = a.boundTo;
  if (a.linkedTo) inst.data.linkedTo = a.linkedTo;
  ctx.s.effects.push(inst);
  emit(
    ctx,
    {
      t: 'effectApplied',
      effect: inst.id,
      defId: inst.defId,
      bearer: bearer.id,
      source: source.id,
      stacks,
      value,
      duration,
    },
    privateTo,
  );

  // A new stun interrupts any channel whose skill it now blocks (GDD §3.10).
  if ((def.modifiers ?? []).some((m) => m.mod === 'cannotUseSkills')) interruptChannels(ctx, bearer, 'stun');
  enqueueEffectGained(ctx, bearer, def.id, source);
  if (!a.quiet) announceApplied(ctx, a, inst);
  return inst;
}

/** Queues `on: effectGained` triggers on the bearer's effects that watch for this effect. */
function enqueueEffectGained(ctx: Ctx, bearer: Unit, key: string, source: Unit): void {
  for (const e of effectsOn(ctx.s, bearer.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'effectGained' || spec.effect !== key) continue;
      ctx.triggerQueue.push({ effect: e.id, spec, eventSource: source.id, eventTarget: bearer.id });
    }
  }
}

/** Tells the source's equipment it applied something (Sun Baton, Lightning Banner, …). */
function announceApplied(ctx: Ctx, a: ApplyArgs, inst: EffectInstance): void {
  enqueueFor(ctx, a.source.id, 'effectApplied', {
    eventTarget: a.bearer.id,
    eventEffect: inst.id,
    eventSkill: a.sourceSkill?.id,
    effectKey: a.def.id,
    effectKind: a.def.kind,
    toEnemy: a.source.owner !== a.bearer.owner,
  });
}

export function removeEffect(ctx: Ctx, e: EffectInstance, reason: RemoveReason): void {
  const i = ctx.s.effects.indexOf(e);
  if (i < 0) return;
  ctx.s.effects.splice(i, 1);
  e.data.removedReason = reason;
  let privateTo = isHidden(ctx, e) ? e.sourceOwner : undefined;
  // Q11: an Invisible effect that expires untriggered is shown to both players.
  if (privateTo !== undefined && reason === 'expired') {
    e.revealed = true;
    privateTo = undefined;
  }
  emit(ctx, { t: 'effectRemoved', effect: e.id, defId: e.defId, bearer: e.bearer, reason }, privateTo);
  // "When your Titan expires", "if your Trap fails to activate": the source's equipment hears it.
  if (e.sourceSkill) {
    enqueueFor(ctx, e.source, 'ownEffectEnded', {
      eventTarget: e.bearer,
      eventEffect: e.id,
      eventSkill: e.sourceSkill,
      effectKey: effectKey(e),
      reason,
      untriggered: !e.data.triggered,
    });
  }
  for (const x of ctx.s.effects.filter((y) => y.data.linkedTo === e.id)) removeEffect(ctx, x, 'removed');
}

export function revealEffect(ctx: Ctx, e: EffectInstance): void {
  if (!isHidden(ctx, e)) return;
  e.revealed = true;
  emit(ctx, { t: 'effectRevealed', effect: e.id, defId: e.defId, bearer: e.bearer, source: e.source });
}

/**
 * Ends the bearer's channels. With 'stun', only channels whose source skill the bearer can no
 * longer use are ended; with 'skillUse' or 'death', all of them.
 */
export function interruptChannels(ctx: Ctx, bearer: Unit, cause: 'stun' | 'skillUse' | 'death'): void {
  for (const e of effectsOn(ctx.s, bearer.id)) {
    if (!effectDef(ctx.c, e).interruptible) continue;
    if (cause === 'stun') {
      if (!e.sourceSkill) continue;
      if (cannotUseReason(ctx, bearer, skillDef(ctx.c, e.sourceSkill)) === null) continue;
    }
    removeEffect(ctx, e, 'interrupted');
  }
}
