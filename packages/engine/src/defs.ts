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
  | 'lastDamaged'; // units damaged by the most recent damage op

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
  | { sum: Value[] }
  | { mul: Value[] }
  | { if: Cond; then: Value; else: Value };

export type Cond =
  | { has: { unit: Selector; effect: string } }
  | { hasFromArchetype: { unit: Selector; archetype: string } }
  | { hpAtMost: { unit: Selector; value: number } }
  | { hpAbove: { unit: Selector; value: number } }
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
      until?: { skillUsed: { harmful?: boolean } };
    }
  | { op: 'summon'; minion: string; count?: number; duration?: DurationSpec }
  | { op: 'kill'; to: Selector }
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
  | { mod: 'energyGain'; amount: number };

export type TriggerEvent = 'damaged' | 'skillUsed' | 'skillTargeted' | 'turnEnd' | 'turnStart';

export interface TriggerSpec {
  on: TriggerEvent;
  when?: { direct?: boolean; harmful?: boolean; byEnemy?: boolean };
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
  /** independent (default): each application is its own instance. unique: one per bearer, reapplying refreshes. */
  stacking?: 'independent' | 'unique';
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

export type TargetKind = 'self' | 'enemy' | 'ally' | 'allEnemies' | 'allAllies' | 'none';

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
}
