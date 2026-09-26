// Content definition types: the data language skills, statuses, minions and classes are written in
// (GDD §11.5). Content files are validated against Zod schemas in @arena/content that are typed
// against these interfaces, so the two can't drift apart.

import type { Cost, DamageType } from './types.js';

// ---------------------------------------------------------------- durations (GDD §3.8)

/**
 * Durations are authored by intent and compiled to an internal tick count at application time.
 * - thisTurn:   removed at the end of the current turn (1)
 * - enemyTurns: spans N turns of the side opposite the applier
 * - ownTurns:   spans N more turns of the applier's own side
 * - raw:        exact internal tick count
 */
export type DurationSpec =
  | 'permanent'
  | { thisTurn: true }
  | { enemyTurns: number }
  | { ownTurns: number }
  | { raw: number };

// ---------------------------------------------------------------- selectors, values, conditions

export type NamedSelector =
  | 'actor' // the skill user, or the effect's source for effect payloads
  | 'targets' // the skill's resolved targets
  | 'primary' // the first resolved target
  | 'primaryAllies' // the primary target's allies (excluding the primary)
  | 'allEnemies' // living enemies of the actor
  | 'allAllies' // living allies of the actor (including the actor)
  | 'bearer' // the unit carrying the executing effect
  | 'eventSource' // for triggers: who caused the event (skill user / damager)
  | 'eventTarget' // for triggers: who the event happened to
  | 'effectTargets' // units remembered by the executing effect
  | 'it' // the current unit inside forEach / any / all
  | 'lastDamaged' // units damaged by the most recent damage op
  | 'summoner'; // the unit that summoned the actor (for minions)

export type Selector =
  | NamedSelector
  | { randomEnemy: number; exclude?: NamedSelector };

export type Value =
  | number
  | { var: string }
  | { lastDamage: true }
  | { effectValue: true }
  | { effectStacks: true }
  | { stacks: { unit: Selector; effect: string } }
  /** Number of active effect instances with these keys, on `in` (default: the whole board). */
  | { count: { effects: string[]; in?: Selector } }
  | { sum: Value[] }
  | { mul: Value[] }
  | { if: Cond; then: Value; else: Value };

export type Cond =
  | { has: { unit: Selector; effect: string } }
  | { hasFromArchetype: { unit: Selector; archetype: string } }
  | { hpAtMost: { unit: Selector; value: number } }
  | { hpAbove: { unit: Selector; value: number } }
  /** Total stacks of the listed effects on the unit is more than `moreThan`. */
  | { stackTotal: { unit: Selector; effects: string[]; moreThan: number } }
  /** The unit is a character or a minion. */
  | { kind: { unit: Selector; is: 'character' | 'minion' } }
  /** A named condition from content (e.g. Poison's "prey"), evaluated with `it` = the unit. */
  | { check: { cond: string; unit: Selector } }
  | { any: { in: Selector; cond: Cond } }
  | { all: { in: Selector; cond: Cond } }
  | { and: Cond[] }
  | { or: Cond[] }
  | { not: Cond }
  | { flag: string }
  | { varTrue: string };

// ---------------------------------------------------------------- ops

export type Op =
  | {
      op: 'damage';
      to: Selector;
      amount: Value;
      type?: DamageType;
      /** Defaults to true inside a skill's own ops, false inside triggers/ticks (GDD §3.7). */
      direct?: boolean;
      bypass?: boolean;
      /** This damage never hits Invulnerable targets, even if it's Affliction (Fire Explode, Q14). */
      respectsInvulnerable?: boolean;
    }
  | { op: 'heal'; to: Selector; amount: Value }
  | {
      op: 'apply';
      to: Selector;
      effect: string | EffectDef;
      stacks?: Value;
      value?: Value;
      duration?: DurationSpec;
      /** Remember these units on the new effect (Snipe target, etc.). */
      remember?: Selector;
      /** End the effect when the bearer next uses a skill (e.g. "next action" buffs). */
      until?: UntilSpec;
      /** End the effect when this unit leaves the board (auras granted by minions). */
      bindTo?: Selector;
    }
  | { op: 'summon'; minion: string; count?: number; duration?: DurationSpec }
  | { op: 'kill'; to: Selector }
  /** Removes every instance of an effect (by key) from the selected units. */
  | { op: 'removeEffect'; from: Selector; effect: string }
  /** Runs a named, reusable op list from content (e.g. Fire's "explode"). */
  | { op: 'macro'; id: string }
  /** Broadcasts a named event that effects can react to (trigger `on: signal`). */
  | { op: 'signal'; name: string }
  /** Runs one of the option lists, chosen at random. */
  | { op: 'random'; options: Op[][] }
  /** Every instance of `from` in the battle becomes `to` (same bearer, stacks, duration). */
  | { op: 'convertEffects'; from: string; to: string }
  /** The actor's player gains random-colored energy. */
  | { op: 'gainEnergy'; amount: number }
  /** The skill being used comes off cooldown. */
  | { op: 'resetCooldown' }
  | { op: 'if'; cond: Cond; then: Op[]; else?: Op[] }
  | { op: 'set'; var: string; value: Value | boolean }
  | { op: 'forEach'; in: Selector; do: Op[] }
  | { op: 'extendSelf'; by: number }
  | { op: 'setFlag'; flag: string }
  | { op: 'addStacksSelf'; amount: number }
  | { op: 'removeSelf' }
  | { op: 'script'; id: string; params?: Record<string, unknown> };

// ---------------------------------------------------------------- modifiers (queries) and triggers

export interface DamageWhen {
  direct?: boolean;
  types?: DamageType[];
}

export type SkillClass = 'Strategic' | 'NonStrategic';

/** Ends an effect on the bearer's next skill use, optionally only for Harmful or damaging ones. */
export interface UntilSpec {
  skillUsed: { harmful?: boolean; nonStrategic?: boolean };
}

export type ModifierSpec =
  /** Bearer is the damage source. */
  | { mod: 'damageDealt'; amount: number; perStack?: boolean; when?: DamageWhen }
  /** Bearer is the damage target. `armor: true` marks Armor-style reduction (disabled by Shattered). */
  | { mod: 'damageTaken'; amount: number; perStack?: boolean; when?: DamageWhen; armor?: boolean }
  /** +n adds r cost, −n reduces r cost only (GDD §3.4). */
  | { mod: 'costGeneric'; amount: number; perStack?: boolean }
  | { mod: 'cooldownOnUse'; amount: number; perStack?: boolean }
  | { mod: 'untargetable'; by: 'enemies' | 'allies'; bypassable: boolean }
  | { mod: 'blockIndirectDamage' }
  | { mod: 'cannotUseSkills'; classes?: SkillClass[] }
  | { mod: 'immuneTo'; kind: EffectKind }
  | { mod: 'negateNext'; effect: string }
  | { mod: 'forceTarget' }
  | { mod: 'noArmorOrShield' }
  | { mod: 'energyGain'; amount: number }
  /** Multiplies healing the bearer receives, rounding up to a multiple of `roundUpTo` (Scorched). */
  | { mod: 'healingReceived'; mul: number; roundUpTo?: number };

export type TriggerEvent = 'damaged' | 'skillUsed' | 'skillTargeted' | 'turnEnd' | 'turnStart' | 'signal';

export interface TriggerSpec {
  on: TriggerEvent;
  /** For `on: signal`: which signal. */
  signal?: string;
  /**
   * - side: for signals, whose side sent it relative to the bearer.
   * - fromSide: for damaged, the damager's side relative to the effect's applier.
   * - strategic: for skillUsed, only Strategic (true) or non-Strategic (false) skills.
   */
  when?: {
    direct?: boolean;
    harmful?: boolean;
    byEnemy?: boolean;
    side?: 'ally' | 'enemy';
    fromSide?: 'ally' | 'enemy';
    strategic?: boolean;
  };
  /** For skillUsed / skillTargeted: negate (counter) or redirect (reflect) the skill. */
  intercept?: 'counter' | 'reflect';
  do?: Op[];
  /** Remove the effect after it fires. */
  consume?: boolean;
}

export type EffectKind = 'Buff' | 'Debuff' | 'Neutral';

export interface EffectDef {
  id: string;
  name: string;
  kind: EffectKind;
  element?: string;
  description?: string;
  /**
   * - independent (default): each application is its own instance.
   * - unique: one per bearer; reapplying refreshes it.
   * - merge: one per bearer per applying side; reapplying adds stacks and refreshes (Toxin).
   */
  stacking?: 'independent' | 'unique' | 'merge';
  /** hidden: invisible to the opponent of the applier. hiddenTarget: visible, but its remembered targets aren't. */
  visibility?: 'public' | 'hidden' | 'hiddenTarget';
  /** Damage-absorbing pool stored in the instance's value. */
  shield?: boolean;
  /** Channels: end on stun, death, or the bearer using another skill (GDD §3.10). */
  interruptible?: boolean;
  /** Explicit exception to the Invulnerable rule for Affliction/indirect damage it deals (Fire Explode). */
  respectsInvulnerable?: boolean;
  modifiers?: ModifierSpec[];
  triggers?: TriggerSpec[];
  /** Runs when the effect's duration naturally reaches 0 (not when interrupted or consumed). */
  onExpire?: Op[];
}

// ---------------------------------------------------------------- skills, minions, classes

export type TargetKind = 'self' | 'enemy' | 'ally' | 'any' | 'allEnemies' | 'allAllies' | 'none';

export type SkillTag =
  | 'Harmful'
  | 'Helpful'
  | 'Strategic'
  | 'NonStrategic'
  | 'Invisible'
  | 'HiddenTarget'
  | 'Channeled'
  | 'Uncounterable'
  | 'Bypass'
  | 'Unstunnable'
  | 'UsableWhileStunned'
  | 'Stealthy';

export interface SkillDef {
  id: string;
  archetype: string;
  element: string;
  name: string;
  description: string;
  cost: Cost;
  cooldown: number;
  tags: SkillTag[];
  target: TargetKind;
  ops: Op[];
}

export interface MinionDef {
  id: string;
  name: string;
  hp: number;
  skills: string[];
  /** Effects applied to the minion when summoned (permanent), e.g. its automatic attack. */
  passives: (string | EffectDef)[];
  /** Ops run once when summoned, with the minion as the actor (e.g. grant its owner an aura). */
  onSummon?: Op[];
}

export interface ClassDef {
  id: string;
  name: string;
  signatures: string[];
  affinity: string[];
}

export interface ContentBundle {
  version: string;
  skills: Record<string, SkillDef>;
  statuses: Record<string, EffectDef>;
  minions: Record<string, MinionDef>;
  classes: Record<string, ClassDef>;
  /** Reusable op lists, referenced by `{ op: macro }`. */
  macros: Record<string, Op[]>;
  /** Named conditions, referenced by `{ check: { cond } }` (evaluated with `it` = the unit). */
  conditions: Record<string, Cond>;
}

/** Id of an archetype's elemental variant: base id + element, e.g. "strike.fire". */
export function variantId(baseSkillId: string, element: string): string {
  return element === 'None' ? baseSkillId : `${baseSkillId}.${element.toLowerCase()}`;
}
