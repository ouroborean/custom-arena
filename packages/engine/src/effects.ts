// Effect lifecycle: applying, refreshing, removing, revealing and interrupting effect instances.

import { effectDef, effectKey, effectsOn, emit, nextId, skillDef, type Ctx } from './ctx.js';
import type { DurationSpec, EffectDef, SkillDef } from './defs.js';
import { compileDuration } from './duration.js';
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
  duration?: DurationSpec | undefined;
  targets?: UnitId[];
  until?: { skillUsed: { harmful?: boolean } } | undefined;
}

export function isHidden(ctx: Ctx, e: EffectInstance): boolean {
  return effectDef(ctx.c, e).visibility === 'hidden' && !e.revealed;
}

export function applyEffect(ctx: Ctx, a: ApplyArgs): EffectInstance | null {
  const { def, bearer, source } = a;
  if (!bearer.alive) return null;
  const hidden = def.visibility === 'hidden';
  const privateTo = hidden ? source.owner : undefined;

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
  const stacks = a.stacks ?? 1;
  const value = a.value ?? 0;

  if (def.stacking === 'unique') {
    const existing = effectsOn(ctx.s, bearer.id).find((e) => effectKey(e) === def.id);
    if (existing) {
      existing.duration =
        existing.duration === null || duration === null ? null : Math.max(existing.duration, duration);
      existing.stacks = Math.max(existing.stacks, stacks);
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
  return inst;
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
