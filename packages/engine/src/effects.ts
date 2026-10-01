// Effect lifecycle: applying, refreshing, removing, revealing and interrupting effect instances.

import { effectDef, effectKey, effectsOn, emit, findUnit, nextId, skillDef, type Ctx } from './ctx.js';
import type { EffectDef, ResolvedDuration, SkillDef, UntilSpec } from './defs.js';
import { compileDuration } from './duration.js';
import { sample } from './rng.js';
import { broadcastSignal, enqueueFor } from './ops.js';
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
  /** Don't fire the bearer's effectGained triggers (copies that would echo back: Mycorrhizal Bond). */
  noChain?: boolean;
  /** The effect ends once `unit` carries no effect from a skill of `archetype` ("during Titan"). */
  whileActorHas?: { unit: UnitId; archetype: string };
}

export function isHidden(ctx: Ctx, e: EffectInstance): boolean {
  return effectDef(ctx.c, e).visibility === 'hidden' && !e.revealed;
}

export function applyEffect(ctx: Ctx, a: ApplyArgs): EffectInstance | null {
  const r = applyEffectOnce(ctx, a);
  if (r && !ctx.entangling) spreadEntangled(ctx, a, r);
  return r;
}

/** Dimension's Entangled: an effect applied to a linked unit is applied to its partners too. */
function spreadEntangled(ctx: Ctx, a: ApplyArgs, applied: EffectInstance): void {
  if ((effectDef(ctx.c, applied).modifiers ?? []).some((m) => m.mod === 'entangleLink')) return;
  const partners = new Set<string>();
  for (const { spec, effect } of modsOn(ctx.s, ctx.c, a.bearer.id, 'entangleLink')) {
    if (spec.kinds && !spec.kinds.includes(a.def.kind)) continue;
    for (const x of ctx.s.effects) if (x.data.group === effect.data.group && x.bearer !== a.bearer.id) partners.add(x.bearer);
  }
  if (partners.size === 0) return;
  ctx.entangling = true;
  try {
    for (const id of partners) {
      const u = findUnit(ctx.s, id);
      if (u?.alive) applyEffectOnce(ctx, { ...a, bearer: u });
    }
  } finally {
    ctx.entangling = false;
  }
}

function applyEffectOnce(ctx: Ctx, a: ApplyArgs): EffectInstance | null {
  const { def, bearer, source } = a;
  if (!bearer.alive) return null;
  // "Any target that attempts to become Invulnerable" (Emblem of the Blackout): heard before any block.
  broadcastSignal(ctx, `applying:${def.id}`, source, { target: bearer });
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

  // Mechanic's Contraptions (and similar): can't gain these effects at all.
  if (
    modsOn(ctx.s, ctx.c, bearer.id, 'immuneToEffects').some(({ spec, effect }) =>
      spec.fromData ? effect.data.immuneKey === def.id : spec.effects.includes(def.id),
    )
  ) {
    emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: 'immune' }, privateTo);
    return null;
  }
  // Immune (and similar): cannot receive effects of this kind.
  if (modsOn(ctx.s, ctx.c, bearer.id, 'immuneTo').some(({ spec }) => spec.kind === def.kind)) {
    emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: 'immune' }, privateTo);
    return null;
  }

  const compiled = compileDuration(a.duration, source.owner, ctx.s.activePlayer);
  // Applied after this turn's countdown (by an effect expiring): turn-based durations already missed that
  // tick. Raw tick counts are taken as written.
  const turnBased = a.duration !== undefined && a.duration !== 'permanent' && ('enemyTurns' in a.duration || 'ownTurns' in a.duration);
  const duration = compiled !== null && ctx.pastTick && turnBased ? Math.max(1, compiled - 1) : compiled;

  // Swiftness-style negation: consume one stack of the negating effect instead.
  const negator = modsOn(ctx.s, ctx.c, bearer.id, 'negateNext').find(({ spec }) => spec.effect === def.id);
  if (negator) {
    const n = negator.effect;
    n.stacks -= 1;
    emit(ctx, { t: 'effectBlocked', defId: def.id, bearer: bearer.id, reason: `negated by ${effectDef(ctx.c, n).name}` });
    if (n.stacks <= 0) removeEffect(ctx, n, 'consumed');
    // The applier's equipment hears it (Shadowrune Bolas), with how long it would have lasted.
    enqueueFor(ctx, source.id, 'effectNegated', {
      eventTarget: bearer.id,
      eventSkill: a.sourceSkill?.id,
      effectKey: def.id,
      effectKind: def.kind,
      toEnemy: source.owner !== bearer.owner,
      eventDuration: duration,
    });
    // …and so does the bearer's (Emblem of the Monsoon).
    enqueueFor(ctx, bearer.id, 'incomingNegated', {
      eventSource: source.id,
      eventTarget: bearer.id,
      effectKey: def.id,
      effectKind: def.kind,
    });
    return null;
  }

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
    // Equipment can let a non-stacking effect stack a little (Emblem of the Inferno: Ignite).
    const cap = def.stacking === 'unique' ? modsOn(ctx.s, ctx.c, source.id, 'stackCap').find(({ spec }) => spec.effect === def.id) : undefined;
    const merge = def.stacking === 'merge';
    const existing = effectsOn(ctx.s, bearer.id).find(
      (e) => effectKey(e) === def.id && (!merge || e.sourceOwner === source.owner),
    );
    if (existing) {
      const before = existing.stacks;
      existing.duration =
        existing.duration === null || duration === null ? null : Math.max(existing.duration, duration);
      existing.stacks = merge ? existing.stacks + stacks : Math.max(existing.stacks, stacks);
      if (cap) existing.stacks = Math.min(existing.stacks + stacks, Math.max(existing.stacks, cap.spec.max));
      if (def.maxStacks !== undefined) existing.stacks = Math.min(existing.stacks, def.maxStacks);
      existing.value = Math.max(existing.value, value);
      // A Catalyst spent by the skill in progress is re-armed by being applied again, for the next skill.
      if (existing.data.catalyzed) {
        delete existing.data.catalyzed;
        ctx.s.seq += 1;
        existing.data.armedAt = ctx.s.seq;
      }
      restack(ctx, existing, before);
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
      if (!a.noChain) enqueueEffectGained(ctx, bearer, def, existing, source);
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
  if (a.whileActorHas) {
    inst.data.whileUnit = a.whileActorHas.unit;
    inst.data.whileArchetype = a.whileActorHas.archetype;
  }
  ctx.s.effects.push(inst);
  // Bonus max Health comes with as much current Health.
  shiftMaxHp(bearer, maxHpBonus(def, inst.stacks));
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
  if (!a.noChain) enqueueEffectGained(ctx, bearer, def, inst, source);
  if (!a.quiet) announceApplied(ctx, a, inst);
  return inst;
}

function maxHpBonus(def: EffectDef, stacks = 1): number {
  return (def.modifiers ?? []).reduce((n, m) => (m.mod === 'maxHp' ? n + m.amount * (m.perStack ? stacks : 1) : n), 0);
}

/** Shifts max Health by `delta`: a rise comes with as much current Health, a fall caps it (Blight's Withered). */
function shiftMaxHp(bearer: Unit, delta: number): void {
  if (delta === 0) return;
  bearer.maxHp = Math.max(1, bearer.maxHp + delta);
  bearer.hp = delta > 0 ? bearer.hp + delta : Math.min(bearer.hp, bearer.maxHp);
}

/** After an effect's stacks changed from `before`: per-stack max Health modifiers follow. */
export function restack(ctx: Ctx, e: EffectInstance, before: number): void {
  const def = effectDef(ctx.c, e);
  const bearer = findUnit(ctx.s, e.bearer);
  if (!bearer?.alive) return;
  shiftMaxHp(bearer, maxHpBonus(def, Math.max(0, e.stacks)) - maxHpBonus(def, before));
}

/**
 * Queues `on: effectGained` triggers on the bearer's effects that watch for this effect: by key
 * (`effect` or `when.effects`), or by `when.kind` / `when.shield`.
 */
function enqueueEffectGained(ctx: Ctx, bearer: Unit, def: EffectDef, inst: EffectInstance, source: Unit): void {
  for (const e of effectsOn(ctx.s, bearer.id)) {
    for (const spec of effectDef(ctx.c, e).triggers ?? []) {
      if (spec.on !== 'effectGained') continue;
      const w = spec.when;
      const keyed = spec.effect !== undefined || w?.effects !== undefined;
      if (keyed && spec.effect !== def.id && !w?.effects?.includes(def.id)) continue;
      if (w?.kind && w.kind !== def.kind) continue;
      if (w?.shield !== undefined && w.shield !== !!def.shield) continue;
      if (!keyed && !w?.kind && w?.shield === undefined) continue; // watches nothing in particular
      ctx.triggerQueue.push({ effect: e.id, spec, eventSource: source.id, eventTarget: bearer.id, eventEffect: inst.id });
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
    shield: !!a.def.shield,
  });
}

/** A status the bearer protects (`protectEffects`) can't be removed or reduced by other effects. */
export function isProtected(ctx: Ctx, e: EffectInstance): boolean {
  const key = effectKey(e);
  return modsOn(ctx.s, ctx.c, e.bearer, 'protectEffects').some(({ spec, effect }) => effect !== e && spec.effects.includes(key));
}

export function removeEffect(ctx: Ctx, e: EffectInstance, reason: RemoveReason): void {
  const i = ctx.s.effects.indexOf(e);
  if (i < 0) return;
  if ((reason === 'removed' || reason === 'consumed') && isProtected(ctx, e)) return;
  ctx.s.effects.splice(i, 1);
  e.data.removedReason = reason;
  let privateTo = isHidden(ctx, e) ? e.sourceOwner : undefined;
  // Q11: an Invisible effect that expires untriggered is shown to both players.
  if (privateTo !== undefined && reason === 'expired') {
    e.revealed = true;
    privateTo = undefined;
  }
  emit(ctx, { t: 'effectRemoved', effect: e.id, defId: e.defId, bearer: e.bearer, reason }, privateTo);
  // Bonus max Health goes away; current Health is capped, never lowered otherwise.
  const bonusHp = maxHpBonus(effectDef(ctx.c, e), Math.max(0, e.stacks));
  const bearer = findUnit(ctx.s, e.bearer);
  if (bonusHp !== 0 && bearer?.alive) {
    bearer.maxHp -= bonusHp;
    bearer.hp = Math.min(bearer.hp, bearer.maxHp);
  }
  // Curse's Lingering: a Hex that's cleansed, or whose bearer dies, jumps to a random ally of theirs.
  const lingering = effectDef(ctx.c, e);
  if (lingering.lingers && bearer && (reason === 'died' || (reason === 'removed' && !e.data.moved))) {
    const to = sample(ctx.s.rng, ctx.s.units.filter((u) => u.alive && u.owner === bearer.owner && u.id !== bearer.id), 1)[0];
    const src = findUnit(ctx.s, e.source);
    if (to && src) {
      applyEffect(ctx, {
        def: lingering,
        inline: !!e.inline,
        bearer: to,
        source: src,
        stacks: e.stacks,
        value: e.value,
        duration: e.duration === null ? 'permanent' : { raw: e.duration },
      });
    }
  }
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
  // "During Titan": effects tied to the bearer's Titan end with its last Titan effect.
  const arch = e.sourceArchetype;
  if (arch && !effectsOn(ctx.s, e.bearer).some((y) => y.sourceArchetype === arch)) {
    for (const x of ctx.s.effects.filter((y) => y.data.whileUnit === e.bearer && y.data.whileArchetype === arch)) {
      removeEffect(ctx, x, 'removed');
    }
  }
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
