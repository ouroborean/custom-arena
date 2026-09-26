// Content definition types: the data language skills, statuses, minions and classes are written in
// (GDD §11.5). Content files are validated against Zod schemas in @arena/content that are typed
// against these interfaces, so the two can't drift apart.

import type { Cost, DamageType, RemoveReason } from './types.js';

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
  | { enemyTurns: number | Value }
  | { ownTurns: number | Value }
  /** Internal ticks. */
  | { raw: number | Value }
  /** However long the event's effect has left (permanent if it's permanent). */
  | { sameAsEvent: true };

/** A DurationSpec whose turn counts have been evaluated. */
export type ResolvedDuration =
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
  | 'summoner' // the unit that summoned the actor (for minions)
  | 'eventTargets' // for skillUsed/skillResolved triggers: the targets of the triggering skill
  | 'allUnits' // every living unit on both sides
  | 'lastSummoned'; // the unit the most recent summon op created

export type Selector =
  | NamedSelector
  /** `where` filters candidates (evaluated with `it` = each candidate). */
  | { randomEnemy: number; exclude?: NamedSelector; where?: Cond }
  /** Every unit of `filter` for which `where` holds (evaluated with `it`), minus `exclude`. */
  | { filter: NamedSelector; where: Cond; exclude?: NamedSelector }
  | { randomAlly: number; exclude?: NamedSelector; where?: Cond };

export type Value =
  | number
  | { var: string }
  | { lastDamage: true }
  | { effectValue: true }
  | { effectStacks: true }
  | { stacks: { unit: Selector; effect: string } }
  /** Number of active effect instances with these keys, on `in` (default: the whole board). */
  | { count: { effects: string[]; in?: Selector } }
  /** Number of units the selector yields (e.g. lastDamaged). */
  | { countOf: Selector }
  /** Max HP minus current HP of the (first) selected unit. */
  | { missingHp: Selector }
  /** Current HP of the (first) selected unit. */
  | { hp: Selector }
  /** Total stacks of an effect across the selected units. */
  | { totalStacks: { in: Selector; effect: string } }
  /** Integer division, rounded down. */
  | { div: [Value, Value] }
  | { sum: Value[] }
  | { mul: Value[] }
  | { if: Cond; then: Value; else: Value }
  /** Total base cost of the skill in scope (the skill being used, or the one behind the event). */
  | { skillCost: true }
  /** Dead characters on the actor's enemy / own side. */
  | { deadCount: 'enemies' | 'allies' }
  /** The actor's other characters that have used a skill this turn. */
  | { alliesActed: true }
  /** The amount carried by the event (healing received). */
  | { eventAmount: true }
  /** Remaining internal duration of the event's effect (0 if permanent or gone). */
  | { eventDuration: true };

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
  /** The unit carries at least one effect of this kind (e.g. "targets with no Buffs"). */
  | { hasKind: { unit: Selector; kind: EffectKind } }
  /** The selected unit is the actor (e.g. a targetFilter excluding the user). */
  | { isActor: Selector }
  /** The selected unit is an enemy of the actor. */
  | { isEnemy: Selector }
  /** The unit is a minion, optionally of one of these types (minion id or tag). */
  | { minion: { unit: Selector; types?: string[]; fromArchetypes?: string[] } }
  /** The unit carries any Shield effect with value left. */
  | { hasShield: Selector }
  /** The unit has a skill of one of these archetypes (Wind: mobility skills). */
  | { hasSkill: { unit: Selector; archetypes: string[] } }
  /** A numeric comparison. */
  | { compare: { value: Value; atLeast?: number; atMost?: number } }
  /** The unit is one of the event's targets (the skill that caused the event). */
  | { isEventTarget: Selector }
  /** An effect the actor applied from a skill of this archetype is on the board (e.g. an active Taunt). */
  | { appliedFromArchetype: string }
  /** At the time of the event, its unit carried an effect the actor applied from one of these archetypes. */
  | { eventTargetHad: { archetypes: string[] } }
  /** The skill behind the event (or in scope) matches. */
  | { eventSkill: { archetypes?: string[]; costAtLeast?: number } }
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
      /** `false`: doesn't end Sleep (Shadow Dream Seeker). Damage wakes by default. */
      wakes?: boolean;
      /** Deal the damage as this unit instead of the actor (a launched Boulder). */
      from?: Selector;
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
      /** End the effect when the actor's effect with this key ends (a channel's mark on its target). */
      linkTo?: string;
      /** Apply as if from this unit instead of the actor (a taunt "by that minion"). */
      from?: Selector;
    }
  | { op: 'summon'; minion: string; count?: number; duration?: DurationSpec }
  | { op: 'kill'; to: Selector }
  /** Removes every instance of an effect (by key) from the selected units. */
  | { op: 'removeEffect'; from: Selector; effect: string }
  /** Removes every effect of this kind (e.g. all Debuffs) from the selected units. */
  | { op: 'removeKind'; from: Selector; kind: EffectKind }
  /** Raises max HP (current HP is unchanged). */
  | { op: 'addMaxHp'; to: Selector; amount: number }
  /** Multiplies the value of every Shield effect on the selected units (Earth Rampart). */
  | { op: 'scaleShields'; on: Selector; factor: number }
  /** Removes up to `amount` stacks of an effect (by key) from each selected unit. */
  | { op: 'removeStacks'; from: Selector; effect: string; amount: number }
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
  /** A skill comes off cooldown: the skill being used, or the actor's skill with this id. */
  | { op: 'resetCooldown'; skill?: string; archetypes?: string[] }
  /**
   * Uses a skill without cost or cooldown (GDD §11.5 meta ops): a content skill id, or the actor's
   * own skill of an archetype. Single-target skills hit each unit of `on`; self and AoE skills
   * resolve their own targets. `as: 'it'` casts it as each unit of `on` instead (e.g. on a minion).
   */
  | { op: 'castSkill'; skill?: string; archetype?: string; on: Selector; as?: 'actor' | 'it' }
  /** Changes the effect the event is about (the one just applied). */
  | { op: 'eventEffect'; permanent?: boolean; extendBy?: number }
  /** Changes the remaining cooldown of every skill of the selected units (optionally not the skill being used). */
  | {
      op: 'adjustCooldowns';
      to: Selector;
      by: number | Value;
      exceptCurrent?: boolean;
      skill?: string;
      /** Only skills of these archetypes. */
      archetypes?: string[];
      /** Skip the skill behind the event (e.g. the Dance that was just used). */
      exceptEvent?: boolean;
    }
  /** Adds `by` turn-ends to the remaining duration of these effects on the selected units. */
  | { op: 'extendEffects'; on: Selector; effects: string[]; by: number }
  | { op: 'if'; cond: Cond; then: Op[]; else?: Op[] }
  | { op: 'set'; var: string; value: Value | boolean }
  | { op: 'forEach'; in: Selector; do: Op[] }
  /** Runs `do` `times` times (evaluated once, up front). */
  | { op: 'repeat'; times: Value; do: Op[] }
  | { op: 'extendSelf'; by: number }
  /** Sets (or with `value: false`, clears) a flag on the executing effect. */
  | { op: 'setFlag'; flag: string; value?: boolean }
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

/** Fields every modifier may carry (equipment passives rely on them). */
export interface ModifierBase {
  /** Only active while this holds (evaluated with actor = it = the bearer). */
  if?: Cond;
  /** Only for skills of these archetypes (the skill being used, or the one dealing the damage). */
  archetypes?: string[];
}

export type ModifierSpec = ModifierBase &
  (
  /**
   * Bearer is the damage source. `value` (actor = bearer, it = target) replaces `amount`; `target`
   * limits it to matching targets; `mul` multiplies the final damage (0 = no damage).
   */
  | { mod: 'damageDealt'; amount: number; perStack?: boolean; when?: DamageWhen; value?: Value; target?: Cond; mul?: number }
  /** Bearer is the damage target. `armor: true` marks Armor-style reduction (disabled by Shattered). */
  | { mod: 'damageTaken'; amount: number; perStack?: boolean; when?: DamageWhen; armor?: boolean; value?: Value }
  /** +n adds r cost, −n reduces r cost only (GDD §3.4). */
  | { mod: 'costGeneric'; amount: number; perStack?: boolean }
  | { mod: 'cooldownOnUse'; amount: number; perStack?: boolean }
  | { mod: 'untargetable'; by: 'enemies' | 'allies'; bypassable: boolean }
  | { mod: 'blockIndirectDamage' }
  /** Stun. `classes` limits it to Strategic / non-Strategic skills; `harmful` to Harmful (true) or Helpful (false) ones. */
  | { mod: 'cannotUseSkills'; classes?: SkillClass[]; harmful?: boolean }
  /** The bearer's costs can't be reduced (Chilled). */
  | { mod: 'noCostReduction' }
  /** The bearer can't apply Buffs, to anyone (Numb). */
  | { mod: 'cannotApplyBuffs' }
  /** The bearer can't receive Debuffs from units carrying any of these effects (Frostborn). */
  | { mod: 'immuneToDebuffsFrom'; sourceHas: string[] }
  /** Units carrying any of these effects can't target or damage the bearer (Frostborn); Bypass ignores it. */
  | { mod: 'invulnerableTo'; sourceHas: string[] }
  /** The bearer's skills ignore counters and reflects (Water Flow). */
  | { mod: 'ignoreCounters' }
  /** The next time the bearer applies `effect`, it applies `amount` extra stacks; then this effect ends (Surge). */
  | { mod: 'bonusStacksOnApply'; effect: string; amount: number }
  | { mod: 'immuneTo'; kind: EffectKind }
  | { mod: 'negateNext'; effect: string }
  | { mod: 'forceTarget' }
  | { mod: 'noArmorOrShield' }
  /** With `atStacks`, only once the effect has that many stacks, and the effect is then removed (Charged, Sapped). */
  | { mod: 'energyGain'; amount: number; atStacks?: number }
  /** Multiplies healing the bearer receives, rounding up to a multiple of `roundUpTo` (Scorched). */
  | { mod: 'healingReceived'; mul: number; roundUpTo?: number }
  /** Direct damage from enemies heals the bearer instead (Holy Retribution). */
  | { mod: 'healFromDirectDamage' }
  /** The bearer's skills Bypass (ignore Invulnerable and Isolated) — Ghosted. */
  | { mod: 'grantBypass' }
  /** The bearer's HP can't be reduced below `amount` (Unholy Immortal). */
  | { mod: 'hpFloor'; amount: number }
  /** The bearer heals for the HP it removes from other characters (Unholy Lifesteal). */
  | { mod: 'lifesteal' }
  /** The bearer's next skill counts as Stealthy (Shadow Long Shadow); apply with `until`. */
  | { mod: 'nextSkillStealthy' }
  /** The primary target of the bearer's single-target skills is chosen at random (Blinded). */
  | { mod: 'randomPrimaryTarget' }
  /** The bearer's skill costs become all random (r) energy. */
  | { mod: 'costToRandom' }
  /** Adds or removes skill tags (e.g. Snipes gain Bypass and Uncounterable). */
  | { mod: 'skillTags'; add?: SkillTag[]; remove?: SkillTag[] }
  /**
   * Skills may also target units matching `where` (it = candidate). Then either `ops` run instead of
   * the skill's own, or (`castAs`) the skill resolves as if the target had used it on itself.
   */
  | { mod: 'extraTargets'; where: Cond; castAs?: boolean; ops?: Op[] }
  );

/**
 * - skillResolved: after the bearer's skill has fully resolved (not countered); sees its targets.
 * - effectGained: the bearer gains the effect named in `effect` (applied or refreshed).
 */
export type TriggerEvent =
  | 'damaged'
  | 'skillUsed'
  | 'skillResolved'
  | 'skillTargeted'
  | 'turnEnd'
  | 'turnStart'
  | 'signal'
  | 'effectGained'
  | 'dealtDamage'
  | 'shieldDamaged'
  | 'summoned'
  /** An effect this bearer applied (from a skill) triggered; eventTarget = its bearer. */
  | 'ownEffectTriggered'
  /** An effect this bearer applied (from a skill) ended; filter with when.reason / untriggered. */
  | 'ownEffectEnded'
  /** This bearer applied an effect to someone (eventTarget); eventEffect = that effect. */
  | 'effectApplied'
  /** This bearer was healed; eventAmount = HP restored. */
  | 'healed';

export interface TriggerSpec {
  on: TriggerEvent;
  /** For `on: signal`: which signal. */
  signal?: string;
  /** For `on: effectGained`: which effect (key). */
  effect?: string;
  /**
   * - side: for signals, whose side sent it relative to the bearer; for non-intercepting
   *   skillTargeted, the skill user's side relative to the bearer.
   * - byEnemy: for damaged, only damage from enemies; for dealtDamage, only damage to enemies.
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
    /** For damaged: `true` ignores damage that doesn't wake (`wakes: false`). */
    wakes?: boolean;
    /** Only events caused by (or effects applied from) skills of these archetypes. */
    archetypes?: string[];
    /** ownEffectTriggered: only counters/reflects (true) or only other triggers (false). */
    counter?: boolean;
    /** ownEffectEnded: only these removal reasons. */
    reason?: RemoveReason[];
    /** ownEffectEnded: only effects that never triggered. */
    untriggered?: boolean;
    /** effectApplied / effectGained: only these effect keys. */
    effects?: string[];
    /** effectApplied: only effects applied to enemies (true) or to allies (false). */
    toEnemy?: boolean;
    /** effectApplied: only effects of this kind. */
    kind?: EffectKind;
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
  /** Stacks on one instance never exceed this (Charged and Sapped: 3). */
  maxStacks?: number;
  /**
   * Shadow Stealth: ends after the bearer uses a skill that isn't Stealthy (whether it resolves or
   * is countered); a Stealthy skill extends it by one turn instead.
   */
  stealth?: boolean;
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
  /** Extra requirement on a single target (evaluated with `it` = the target), e.g. "target Condemned enemy". */
  targetFilter?: Cond;
  /** Requirement on the user to use this skill (evaluated with actor = the user), e.g. "Requires Flow". */
  requires?: Cond;
  /** Runs when this skill is countered or reflected; `eventSource` is the unit that countered it. */
  onCountered?: Op[];
  /** A different base cost while `when` holds for the user (Lightning Zap: I, or r when Charged). */
  altCost?: { when: Cond; cost: Cost };
  /** Added to the GEN (r) cost like Focus/Confusion, evaluated for the user (Earth Worldquake: −1 per minion). */
  costAdjust?: Value;
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
  /** Extra minion types it counts as (Earth: Forest Stalker counts as a Seedling). */
  tags?: string[];
}

export interface ClassDef {
  id: string;
  name: string;
  signatures: string[];
  affinity: string[];
}

/** Equipment types (GDD §8.2): which slot an item fits and what it grants. */
export type ItemType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export interface ItemInfusion {
  element: string;
  /** The skill (base id) it infuses; omitted when the player chooses the target. */
  target?: string;
}

/** An equipment item (GDD §8.1 grant model). Items never enter the engine directly: the loadout
 * resolver (@arena/meta) turns them into skills, infusions and passives on a CharacterSpec. */
export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  /** Base skills granted (added when the character lacks them and has room). */
  skills: string[];
  infusions: ItemInfusion[];
  /** Passive text from the sheet. */
  passive?: string;
  /** Status implementing the passive; absent until the passive is implemented (Phase 7). */
  passiveEffect?: string;
  /** Only this class can equip it (type G class armor). */
  classId?: string;
  /** The sheet left it unnamed; the name is a placeholder. */
  placeholder?: boolean;
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
  /** Equipment catalogue. */
  items: Record<string, ItemDef>;
}

/** Id of an archetype's elemental variant: base id + element, e.g. "strike.fire". */
export function variantId(baseSkillId: string, element: string): string {
  return element === 'None' ? baseSkillId : `${baseSkillId}.${element.toLowerCase()}`;
}
