// The mutable working context for one command. Commands run on a structuredClone of the input
// state, so the public API stays immutable while internals can mutate freely.

import type { ContentBundle, EffectDef, SkillDef, TriggerSpec } from './defs.js';
import type { EffectInstance, EventBody, GameEvent, GameState, PlayerId, Unit, UnitId } from './types.js';

export interface PendingTrigger {
  effect: string;
  /** The instance itself, so triggers queued before the bearer died still resolve. */
  inst?: EffectInstance;
  spec: TriggerSpec;
  eventSource?: UnitId;
  eventTarget?: UnitId;
  eventTargets?: UnitId[];
  /** Skill (def id) behind the event. */
  eventSkill?: string;
  /** Effect (instance id) the event is about. */
  eventEffect?: string;
  eventAmount?: number;
  /** Effects the event's unit carried at the time (deaths). */
  snapshot?: EffectInstance[];
  /** Internal duration of the effect the event is about, when there's no instance (negated effects). */
  eventDuration?: number | null;
}

export interface Ctx {
  s: GameState;
  c: ContentBundle;
  events: GameEvent[];
  triggerQueue: PendingTrigger[];
  flushing: boolean;
  /** Set while Entangled copies are being applied, so they don't spread again. */
  entangling?: boolean;
  /** Set while a skill resolves (Alchemy's Catalyst only doubles skills). */
  inSkill?: boolean;
  /** Nested castSkill depth (Mirror's Mimic can't copy a copy forever). */
  castDepth?: number;
  /** State snapshots for `checkpoint` events, or null when they weren't asked for. */
  checkpoints: GameState[] | null;
}

export const MAX_TRIGGER_CHAIN = 64;

export function makeCtx(s: GameState, c: ContentBundle, checkpoints = false): Ctx {
  return { s, c, events: [], triggerQueue: [], flushing: false, checkpoints: checkpoints ? [] : null };
}

/** Snapshots the state for playback (when asked for) and marks the spot in the event stream. */
export function checkpoint(ctx: Ctx): void {
  if (!ctx.checkpoints) return;
  ctx.checkpoints.push(structuredClone(ctx.s));
  emit(ctx, { t: 'checkpoint', n: ctx.checkpoints.length - 1 });
}

export function emit(ctx: Ctx, body: EventBody, visibleTo?: PlayerId): void {
  ctx.events.push(visibleTo === undefined ? body : { ...body, visibleTo });
}

export function nextId(ctx: Ctx, prefix: string): string {
  ctx.s.seq += 1;
  return `${prefix}${ctx.s.seq}`;
}

// ---------------------------------------------------------------- lookups

export function unit(ctx: Ctx, id: UnitId): Unit {
  const u = ctx.s.units.find((x) => x.id === id);
  if (!u) throw new Error(`Unknown unit ${id}`);
  return u;
}

export function findUnit(s: GameState, id: UnitId): Unit | undefined {
  return s.units.find((x) => x.id === id);
}

/** Archetype of a skill id (undefined for unknown / missing ids). */
export function archetypeOf(c: ContentBundle, id: string | undefined): string | undefined {
  return id ? c.skills[id]?.archetype : undefined;
}

export function skillDef(c: ContentBundle, id: string): SkillDef {
  const d = c.skills[id];
  if (!d) throw new Error(`Unknown skill ${id}`);
  return d;
}

export function effectDef(c: ContentBundle, e: EffectInstance): EffectDef {
  if (e.inline) return e.inline;
  const d = c.statuses[e.defId];
  if (!d) throw new Error(`Unknown status ${e.defId}`);
  return d;
}

export function resolveEffectDef(c: ContentBundle, ref: string | EffectDef): EffectDef {
  if (typeof ref !== 'string') return ref;
  const d = c.statuses[ref];
  if (!d) throw new Error(`Unknown status ${ref}`);
  return d;
}

export function effectsOn(s: GameState, bearer: UnitId): EffectInstance[] {
  return s.effects.filter((e) => e.bearer === bearer);
}

/** Effect id (named status or inline id) without the skill prefix, for `has` checks. */
export function effectKey(e: EffectInstance): string {
  return e.inline ? e.inline.id : e.defId;
}

export function hasEffect(s: GameState, bearer: UnitId, key: string): boolean {
  return s.effects.some((e) => e.bearer === bearer && effectKey(e) === key);
}

export function stacksOf(s: GameState, bearer: UnitId, key: string): number {
  return s.effects.filter((e) => e.bearer === bearer && effectKey(e) === key).reduce((n, e) => n + e.stacks, 0);
}

// ---------------------------------------------------------------- sides

export function isEnemy(a: Unit, b: Unit): boolean {
  return a.owner !== b.owner;
}

export function livingUnits(s: GameState, owner: PlayerId): Unit[] {
  return s.units.filter((u) => u.alive && u.owner === owner);
}

export function livingCharacters(s: GameState, owner: PlayerId): Unit[] {
  return s.units.filter((u) => u.alive && u.owner === owner && u.kind === 'character');
}

export function other(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}
