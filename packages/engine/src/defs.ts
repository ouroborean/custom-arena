// Content definition types: the data language skills, statuses, minions and classes are written in
// (GDD §11.5). Content files are validated against Zod schemas in @arena/content that are typed
// against these interfaces, so the two can't drift apart.

import type { Cost, DamageType, MatchSettings, RemoveReason } from './types.js';

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
  | 'eventPrimary' // the first of eventTargets (the triggering skill's primary target)
  | 'allUnits' // every living unit on both sides
  | 'lastSummoned' // the unit the most recent summon op created
  | 'weakestAlly' // the actor's living, targetable character ally (or self) with the least HP
  | 'weakestEnemy' // the actor's targetable enemy character with the least HP
  | 'strongestEnemy' // the actor's targetable enemy character with the most HP
  | 'lastAttacker' // the last enemy who damaged the actor (if still alive)
  | 'primaryLastAttacker' // the last enemy who damaged the first target (Mechanic's Rivet Gun)
  | 'summonerLastAttacker' // the last enemy who damaged the actor's summoner (Night's Rime Revenant)
  | 'primaryPartners' // units Entangled with the first target (Dimension)
  | 'bearerAllies' // the bearer's living allies, not the bearer
  | 'randomBearerAlly' // one random living ally of the bearer, not the bearer (Spore spreading)
  | 'randomAnyEnemy'
  | 'weakestOtherAlly'; // the actor's other allied character with the least HP (Faceless Void) // one random living enemy, Stealthed or not (Vigilante's Searchlight)

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
  /** A number the executing effect tracks in its data (e.g. "prevented" for Diamond). */
  | { effectData: string }
  /** How many effects of this kind the unit carries. */
  | { kindCount: { unit: Selector; kind: EffectKind; stacks?: boolean } }
  /** How many times the actor used this skill before this use (Ocean's Crest and Trough, Myth). */
  | { timesUsed: true }
  /** A number the actor stored with setCounter (0 if never set). */
  | { counter: string }
  /** A number a unit stored with setCounter (0 if never set). */
  | { counterOf: { unit: Selector; name: string } }
  /** The current turn number. */
  | { turn: true }
  /** Healing the most recent heal op couldn't give because the target was full (Ocean's Brimming). */
  | { lastOverheal: true }
  /** The summed value (Shield left) of a unit's effects with this key. */
  | { effectValueOf: { unit: Selector; effect: string } }
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
  /** Base cooldown of the skill in scope (the skill being used, or the one behind the event). */
  | { skillCooldown: true }
  /** How many of the (first) selected unit's skills are on cooldown. */
  | { skillsOnCooldown: Selector }
  /** Energy banked by the (first) selected unit's player; `colors`: how many colors they hold instead. */
  | { energyOf: { unit: Selector; colors?: boolean } }
  /** Summed HP of the selected units. */
  | { totalHp: Selector }
  /** Dead characters on the actor's enemy / own side. */
  | { deadCount: 'enemies' | 'allies' }
  /** Allied minions that died since the actor's side last started a turn (Spore's Compost Bed). */
  | { minionsLost: true }
  /** Units on either side that died since the actor's side last started a turn (Grave's Requiem). */
  | { recentDeaths: true }
  /** Identifies the skill use in progress (compare with counter `hit_in_use`: units it hit directly). */
  | { useSeq: true }
  /** The actor's other characters that have used a skill this turn. */
  | { alliesActed: true }
  /** The amount carried by the event (healing received). */
  | { eventAmount: true }
  /** Remaining internal duration of the event's effect (0 if permanent or gone). */
  | { eventDuration: true }
  /** Energy the actor's player has banked (all colors). */
  | { energy: true };

export type Cond =
  /** `mine`: only an instance the actor applied. */
  /** `exact`: statuses that only count as this one (countsAs) don't match. */
  | { has: { unit: Selector; effect: string; mine?: boolean; exact?: boolean } }
  /** `mine`: only effects the actor applied. */
  | { hasFromArchetype: { unit: Selector; archetype: string; mine?: boolean } }
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
  /** The selected unit is the first target of the skill in scope. */
  | { isPrimary: Selector }
  /** The selected unit is an enemy of the actor. */
  | { isEnemy: Selector }
  /** The unit is a minion, optionally of one of these types (minion id or tag); `mine`: summoned by the actor. */
  | { minion: { unit: Selector; types?: string[]; fromArchetypes?: string[]; mine?: boolean } }
  /** The unit carries any Shield effect with value left. */
  | { hasShield: Selector }
  /** The unit has a skill of one of these archetypes (Wind: mobility skills). */
  | { hasSkill: { unit: Selector; archetypes: string[] } }
  /** A numeric comparison. */
  | { compare: { value: Value; atLeast?: number; atMost?: number } }
  /** The unit is one of the event's targets (the skill that caused the event). */
  | { isEventTarget: Selector }
  | { eventTargetIs: Selector } // the single event target (a 'died' signal's dead unit)
  /** An effect the actor applied from a skill of this archetype is on the board (e.g. an active Taunt). */
  | { appliedFromArchetype: string }
  /** At the time of the event, its unit carried an effect the actor applied from one of these archetypes. */
  /** `effects`: instead, an effect the actor applied with one of these keys (or counting as one). */
  | { eventTargetHad: { archetypes?: string[]; effects?: string[] } }
  /** The skill behind the event (or in scope) matches. */
  /** `single`: only single-target skills (target enemy, ally or any). */
  | { eventSkill: { archetypes?: string[]; costAtLeast?: number; tags?: SkillTag[]; elements?: string[]; single?: boolean } }
  /** The unit is channeling (carries an interruptible effect). */
  | { channeling: Selector }
  /** The unit can't use at least some skills (Stun, Sleep, …). */
  | { stunned: Selector }
  /** The unit has used a skill this turn. */
  | { actedThisTurn: Selector }
  | { any: { in: Selector; cond: Cond } }
  | { all: { in: Selector; cond: Cond } }
  | { and: Cond[] }
  | { or: Cond[] }
  | { not: Cond }
  | { flag: string }
  | { varTrue: string }
  /** Ocean: this skill is in its Crest form (the actor has used it an even number of times). */
  | { crest: true };

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
      /** Ignore every damage modifier (Might, Armor, Vulnerable, …). */
      raw?: boolean;
    }
  /** `raw`: not changed by healing modifiers; `quiet`: fires no healing triggers. */
  | { op: 'heal'; to: Selector; amount: Value; raw?: boolean; quiet?: boolean }
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
      /** Don't tell the applier's equipment (passives reacting to applications use this). */
      quiet?: boolean;
      /** End the effect once the actor carries no effect from its skills of this archetype ("during Titan"). */
      whileActorHas?: string;
      /** End the effect when the event's effect ends ("for as long as the Taunt lasts"). */
      linkToEvent?: boolean;
    }
  | { op: 'summon'; minion: string; count?: number; duration?: DurationSpec }
  | { op: 'kill'; to: Selector }
  /** Every fallen character on the actor's side returns with `hp` HP and no effects (Phoenix's Second Dawn). */
  | { op: 'revive'; hp: number }
  /** Swaps the longest remaining cooldown of `a` with that of `b` (the actor's skill being used is skipped). */
  | { op: 'swapCooldowns'; a: Selector; b: Selector }
  /** Aurora's Dazzled: `count` random energies of the (first) unit's player change to another color. */
  | { op: 'shiftEnergy'; of: Selector; count?: number }
  /** Aurora's Drink the Light: the unit's player loses 1 energy of the color they hold most; the actor's gains it. */
  | { op: 'stealEnergy'; from: Selector }
  /** The actor's player pays `amount` random energy (as much as they have). */
  | { op: 'spendEnergy'; amount: number }
  /** Mirror's Inverted Echo: skills on cooldown become ready, ready ones go on cooldown for `ready` turns. */
  | { op: 'invertCooldowns'; on: Selector; ready: number }
  /** Gives `to` copies of `from`'s effects of `kind` (same stacks, value and time left). */
  | { op: 'copyEffects'; fromSnapshot?: boolean; from: Selector; to: Selector; kind: EffectKind }
  /** Ends the units' effects with this key (or counting as it) as if their time ran out; `times` runs the onExpire that often (Devil's Collection Day). */
  | { op: 'expire'; on: Selector; effect: string; times?: number }
  /** Ends every channel the targets hold, as a Stun would (Dragon's Tail Sweep). */
  | { op: 'interrupt'; to: Selector }
  /** Removes every Shield effect from the targets (Crystal's Glass Harmonic). */
  | { op: 'removeShields'; from: Selector }
  /** Stores a number on the actor, read back with the `counter` value. */
  /** Stores a number on the actor, or on each unit in `on`; read back with `counter` / `counterOf`. */
  | { op: 'setCounter'; name: string; value: Value; on?: Selector }
  /**
   * Turns minions into another minion in place (Life's Bloom: a Seedling becomes a Treant): new
   * def, skills and passives, full HP at the new max. Its owner and summoner stay.
   */
  | { op: 'transformMinion'; to: Selector; minion: string }
  /**
   * `a` and `b` (one unit each) each gain copies of the other's effects of `kind`, as they stood
   * before this op, with the same stacks, value and time left (Ocean's Crosscurrent).
   */
  | { op: 'shareEffects'; a: Selector; b: Selector; kind: EffectKind }
  /** Moves `from`'s effects (of `kind`, or these keys) onto `to`, keeping stacks, value and time left. */
  | { op: 'moveEffects'; from: Selector; to: Selector; kind?: EffectKind; effects?: string[] }
  /**
   * Alchemy's Transmute: turns effects on each unit into others, stack for stack, keeping time left.
   * On the actor's enemies: Might → Weakness, Armor → Vulnerable, Focus → Confusion, Renew →
   * Weakness. On allies the reverse, and other Debuffs become Renew. `effects` limits it to these
   * keys, `kind` to one kind, `count` to that many random instances per unit, `event` to the event's
   * effect; `removeUnmatched` removes matching effects with no recipe. The stacks converted are
   * stored in the variable `transmuted`.
   */
  | {
      op: 'transmute';
      on: Selector;
      effects?: string[];
      kind?: EffectKind;
      count?: number;
      event?: boolean;
      removeUnmatched?: boolean;
    }
  /** Links the selected units (2 or more) with `effect` (a status with entangleLink) in one new group. */
  /** `with` adds more units to the same group (e.g. a random ally of the target). */
  | { op: 'entangle'; to: Selector; with?: Selector; effect: string; duration?: DurationSpec }
  /**
   * Reveals hidden effects: every one applied by a unit in `by`, or (`event`) the effect the
   * triggering event is about (Ocean's Whalesong).
   */
  /** `end`: hidden effects found this way also end (Divine's Revelation). */
  | { op: 'reveal'; by?: Selector; event?: boolean; end?: boolean }
  /**
   * Adds `amount` to the targets' Shield effect `effect` (a Shield status id), up to `max`; a new
   * one is made if they have none. A negative amount drains it, ending it at 0 (Ocean's Brimming).
   */
  | { op: 'growShield'; to: Selector; effect: string; amount: Value; max?: number }
  /** Removes every instance of an effect (by key) from the selected units. */
  | { op: 'removeEffect'; from: Selector; effect: string }
  /** Removes every effect of this kind (e.g. all Debuffs) from the selected units. */
  | { op: 'removeKind'; from: Selector; kind: EffectKind }
  /** Raises max HP (current HP is unchanged). */
  | { op: 'addMaxHp'; to: Selector; amount: Value }
  /** Multiplies the value of every Shield effect on the selected units (Earth Rampart). */
  | { op: 'scaleShields'; on: Selector; factor: number }
  /** Adds to the value of every Shield effect on the selected units. */
  | { op: 'boostShields'; on: Selector; amount: number }
  /** Moves a random effect of a kind from `from` to `to` (same stacks, value and time left). */
  | { op: 'stealRandom'; from: Selector; to: Selector; kind: EffectKind; nonElemental?: boolean }
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
  /** `lastUsed`: the skill the actor used before this one (Thunder's Second Flash). */
  | { op: 'resetCooldown'; skill?: string; archetypes?: string[]; lastUsed?: boolean }
  /**
   * Uses a skill without cost or cooldown (GDD §11.5 meta ops): a content skill id, or the actor's
   * own skill of an archetype. Single-target skills hit each unit of `on`; self and AoE skills
   * resolve their own targets. `as: 'it'` casts it as each unit of `on` instead (e.g. on a minion).
   */
  /** `archetype` falls back to `skill` when the actor has no skill of it; `eventSkill` casts the event's skill. */
  /** `lastUsedBy`: the last skill that unit used (Mirror's Mimic); an ally-target copy lands on its caster. */
  | { op: 'castSkill'; skill?: string; archetype?: string; eventSkill?: boolean; lastUsedBy?: Selector; on: Selector; as?: 'actor' | 'it' }
  /** Changes the effect the event is about (the one just applied). `expireNow` ends it as if its time ran out. */
  /** `remove`: takes it off its bearer (Mirror's Looking Glass). */
  | { op: 'eventEffect'; permanent?: boolean; extendBy?: number; expireNow?: boolean; remove?: boolean }
  /** Gives `to` a copy of the event's effect (same kind, stacks, value and time left), from the actor. */
  | { op: 'copyEventEffect'; to: Selector; noChain?: boolean }
  /** Applies status `immunity` keyed to `effect` (default: the event's effect), for Antidote's Inoculated. */
  | { op: 'immunize'; to: Selector; effect?: string; duration?: DurationSpec }
  /** Removes `count` (default 1) random effects of a kind from each selected unit. */
  | { op: 'removeRandom'; from: Selector; kind: EffectKind; count?: number }
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
      onlyEvent?: boolean;
      /** Only one of the matching skills on cooldown, chosen at random. */
      random?: boolean;
    }
  /**
   * Adds `by` turn-ends to the remaining duration of effects on the selected units: these keys, or
   * every effect of `kind` (minus `except`). With `onceKey`, each effect can only be extended once.
   */
  | { op: 'extendEffects'; on: Selector; effects?: string[]; kind?: EffectKind; except?: string[]; by: number; onceKey?: string }
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
  /** `archetypes`: only skills of these archetypes (a free next Riposte). */
  skillUsed: { harmful?: boolean; nonStrategic?: boolean; archetypes?: string[] };
}

/** Fields every modifier may carry (equipment passives rely on them). */
export interface ModifierBase {
  /** Only active while this holds (evaluated with actor = it = the bearer). */
  if?: Cond;
  /** Only for skills of these archetypes (the skill being used, or the one dealing the damage). */
  archetypes?: string[];
  /** Only for skills with one of these tags (e.g. Helpful). */
  skillsWith?: SkillTag[];
  /** Only for skills of these elements (Current's Soaked bonus). */
  elements?: string[];
}

export type ModifierSpec = ModifierBase &
  (
  /**
   * Bearer is the damage source. `value` (actor = bearer, it = target) replaces `amount`; `target`
   * limits it to matching targets; `mul` multiplies the final damage (0 = no damage); `onePerTurn`
   * limits it to one target each turn (the first one it applies to).
   */
  | {
      mod: 'damageDealt';
      amount: number;
      perStack?: boolean;
      when?: DamageWhen;
      value?: Value;
      target?: Cond;
      mul?: number;
      onePerTurn?: boolean;
    }
  /**
   * Bearer is the damage target. `armor: true` marks Armor-style reduction (disabled by Shattered).
   * `atLeast`: only against hits of at least this much (before Armor), applied first; `oncePerTurn`
   * limits that to one hit per turn. `mul` multiplies the damage taken.
   */
  | {
      mod: 'damageTaken';
      amount: number;
      perStack?: boolean;
      when?: DamageWhen;
      armor?: boolean;
      value?: Value;
      atLeast?: number;
      oncePerTurn?: boolean;
      mul?: number;
    }
  /** +n adds r cost, −n reduces r cost only (GDD §3.4). */
  | { mod: 'costGeneric'; amount: number; perStack?: boolean }
  /** `min`: a reduction can't take the cooldown below this (a skill that starts lower stays put). */
  | { mod: 'cooldownOnUse'; amount: number; perStack?: boolean; min?: number }
  | { mod: 'untargetable'; by: 'enemies' | 'allies'; bypassable: boolean }
  | { mod: 'blockIndirectDamage' }
  /** Stun. `classes` limits it to Strategic / non-Strategic skills; `harmful` to Harmful (true) or Helpful (false) ones. */
  | { mod: 'cannotUseSkills'; classes?: SkillClass[]; harmful?: boolean; evenUnstunnable?: boolean }
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
  /**
   * Crystal's Diamond: no single hit takes more than `amount` HP (after Armor and Shield). What it
   * prevents is added to the effect's `data.prevented`.
   */
  | { mod: 'maxHpLossPerHit'; amount: number }
  /** No more than `amount` HP lost in one turn (Crystal's Faceted Ward); also tracks `prevented`. */
  | { mod: 'maxHpLossPerTurn'; amount: number }
  /** Hits on the bearer use the Shield this effect is linked to first (Crystal's Latticework). */
  | { mod: 'borrowShield' }
  /** Thunder's Deafened: counters, reflects and Traps the bearer applied can't trigger. */
  | { mod: 'muteTraps' }
  /** Thunder's Stormspire: enemy skills aimed at all of the bearer's side hit only the bearer. */
  | { mod: 'absorbAoE' }
  /** Cloud's Becalmed: the bearer's skills Drift. */
  | { mod: 'driftSkills' }
  /** These statuses on the bearer can't be removed or reduced by other effects (they still expire). */
  | { mod: 'protectEffects'; effects: string[] }
  /**
   * Evolution's Adaptive Hide: each enemy skill that damages the bearer meanwhile teaches them to
   * take 5 less from it, for the rest of the match (max 15 per skill).
   */
  | { mod: 'adaptiveHide' }
  /**
   * Life's Common Root: damage to the bearer is split evenly among every living unit on their side
   * that also has this (the remainder stays on the one hit).
   */
  | { mod: 'shareDamage' }
  /** Evil's Unhallowed: healing the bearer would receive deals that much Affliction damage instead. */
  | { mod: 'invertHealing' }
  /**
   * Dimension's Banished: the bearer is out of the fight. No damage, no ticks or countdowns on its
   * effects (other than the Banished effect itself), no turn-start triggers. Pair it with
   * cannotUseSkills and untargetable in the status.
   */
  | { mod: 'banished' }
  /**
   * Alchemy's Catalyst: the next skill that affects the bearer is doubled for them (damage, healing,
   * and the stacks and duration of effects it applies). Ends once that skill has resolved.
   */
  | { mod: 'catalyst' }
  /** The bearer's Normal damage is dealt as Piercing (Alchemy's Universal Solvent). */
  | { mod: 'normalAsPiercing' }
  /** The bearer can't gain these effects (Mechanic's Contraptions: Stun, Sleep, Confusion, Renew). */
  | { mod: 'immuneToEffects'; effects: string[]; fromData?: boolean }
  /** Glacier's Icebound: the bearer's cooldowns don't tick down. */
  | { mod: 'freezeCooldowns' }
  /** Stasis's Suspended: the bearer's other effects don't tick, count down or fire turn-start triggers. */
  | { mod: 'suspendEffects' }
  /** Mist's Fog: enemy single-target skills aimed at the bearer land on a random unit of their side. */
  | { mod: 'fogged' }
  /** Blood: the bearer's skills pay their random costs with 10 HP each. */
  | { mod: 'bloodPrice' }
  /** Ion's Suppressed: the bearer's Buffs' modifiers have no effect. */
  | { mod: 'suppressBuffs' }
  | { mod: 'suppressDebuffs' }
  /** Faerie's Charmed: single-target skills pick any other living unit (`own`: only the bearer's allies). */
  | { mod: 'charmed'; own?: boolean }
  /** Angel's Ward: the first Harmful single-target skill each turn aimed at the bearer goes to this effect's source. */
  | { mod: 'warded' }
  /** Glacier's Meltwater: the bearer's cooldowns tick down `amount` more at the end of their turns. */
  | { mod: 'cooldownTick'; amount: number }
  /**
   * Dimension's Entangled: effects applied to the bearer are applied to every unit sharing this
   * effect's link group too (only these kinds, if given). Made by the `entangle` op.
   */
  | { mod: 'entangleLink'; kinds?: EffectKind[] }
  /**
   * Cloud's Rain Check: hits on the bearer are held instead of landing. Each becomes `status` (whose
   * onExpire should deal its value) with value = the hit minus `reduceBy`, lasting `delay` ticks.
   */
  | { mod: 'deferHits'; status: string; reduceBy: number; delay: number }
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
  /** The bearer's skills cost nothing. */
  | { mod: 'freeSkills' }
  /** −n removes n specific-color pips from the cost (the most common color first). */
  | { mod: 'costSpecific'; amount: number }
  /** Using these skills doesn't end the bearer's channels. */
  | { mod: 'keepChannels' }
  /** The bearer's skills can't pick targets matching `where` (it = candidate). */
  | { mod: 'targetExclude'; where: Cond; singleOnly?: boolean }
  /** Damage to the bearer from others goes to a random allied minion instead, if there is one. */
  | { mod: 'redirectDamage' }
  /** The minion shares its summoner's HP: damage and healing to it go to them (Bloodbound Familiar). */
  | { mod: 'hpLink' }
  /** The bearer's single-target Harmful skills land on this effect's source (Mist's Voice in the Fog). */
  | { mod: 'lured' }
  /** Skills of this effect's source Bypass against the bearer. */
  /** `anyEnemy`: every enemy of the bearer may target them (Dimension's Void Brand), not only its source. */
  | { mod: 'exposed'; anyEnemy?: boolean; total?: boolean }
  /** Raises the bearer's max (and current) Health while the effect lasts. */
  | { mod: 'maxHp'; amount: number; perStack?: boolean }
  /** Multiplies the bearer's Armor. */
  | { mod: 'armorMul'; mul: number }
  /** A non-stacking effect the bearer applies can stack up to `max` (Emblem of the Inferno: Ignite). */
  | { mod: 'stackCap'; effect: string; max: number }
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
  | 'healed'
  /** Once, when the match starts (equipment). */
  | 'battleStart'
  /** One of this bearer's skills was countered or reflected; eventSource = the unit that stopped it. */
  | 'countered'
  /** An effect this bearer tried to apply was negated (Swiftness); eventTarget = who negated it. */
  | 'effectNegated'
  /** This bearer negated an effect aimed at it (its Swiftness stopped a Stun). */
  | 'incomingNegated'
  /** This bearer healed someone (eventTarget); eventAmount = HP restored. */
  | 'healDone'
  /** An effect on this bearer turned into energy (Charged at 3); `effects` filters by key. */
  | 'energyFromEffect'
  /** A counter or reflect was ignored because of this bearer's Flow. */
  | 'counterIgnored';

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
    /** countered / ownEffectTriggered: only reflects (true) or only counters (false). */
    reflected?: boolean;
    /** effectGained / effectApplied: only Shield effects. */
    shield?: boolean;
    /** Intercepting skillUsed / skillTargeted: only skills whose listed cost totals at least this. */
    costAtLeast?: number;
    /** Intercepting skillUsed: only skills with any of these tags (Vigilante's Sting Operation). */
    anyTags?: string[];
    /** Intercepting skillUsed / skillTargeted: only when the skill's user meets this named condition. */
    sourceIs?: string;
  };
  /** For skillUsed / skillTargeted: negate (counter) or redirect (reflect) the skill. */
  intercept?: 'counter' | 'reflect';
  do?: Op[];
  /** A hidden effect reacting this way isn't revealed (bookkeeping, e.g. a Trap growing). */
  silent?: boolean;
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
  /**
   * Ends, every instance of it, once the bearer has used a skill (whether it resolves or is
   * countered); it still applies to that skill (Confusion raises its cost). Like `until: { skillUsed }`
   * on an apply, but for the status wherever it comes from.
   */
  endsOnSkillUse?: boolean;
  /** hidden: invisible to the opponent of the applier. hiddenTarget: visible, but its remembered targets aren't. */
  visibility?: 'public' | 'hidden' | 'hiddenTarget';
  /** Damage-absorbing pool stored in the instance's value. */
  shield?: boolean;
  /** Channels: end on stun, death, or the bearer using another skill (GDD §3.10). */
  interruptible?: boolean;
  /** Explicit exception to the Invulnerable rule for Affliction/indirect damage it deals (Fire Explode). */
  respectsInvulnerable?: boolean;
  /** Status keys this one also counts as for `has` checks (Cloud's Aloft counts as Leaping). */
  countsAs?: string[];
  modifiers?: ModifierSpec[];
  triggers?: TriggerSpec[];
  /** Runs when the effect's duration naturally reaches 0 (not when interrupted or consumed). */
  onExpire?: Op[];
  /** Curse's Lingering: cleansed, or on its bearer's death, it jumps to a random ally of theirs. */
  lingers?: boolean;
  /** Runs when the bearer dies, before its effects are removed (actor = the source, eventSource = the killer). */
  onDeath?: Op[];
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
  | 'Stealthy'
  /** Cloud: the skill hangs in the air and lands at the start of its user's next turn. */
  | 'Drift'
  /** Divine: can target any unit; Harmful when aimed at an enemy, Helpful when aimed at an ally. */
  | 'Radiant'
  /** Dimension's Folded Moment: doesn't use up the character's action this turn. */
  | 'FreeAction'
  /** Blood: random costs are paid with 10 HP each. */
  | 'BloodPrice'
  /** A Condemned user isn't punished for using it; it purges the Condemnation instead (no skill uses it since 2026-10-05). */
  | 'Purifying';

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
  /** Ops run once when it dies, with the (dead) minion as the actor (Apocalypse's Salamander). */
  onDeath?: Op[];
  /** Extra minion types it counts as (Earth: Forest Stalker counts as a Seedling). */
  tags?: string[];
}

export interface ClassDef {
  id: string;
  name: string;
  signatures: string[];
  affinity: string[];
  /** The skill every rolled character of the class starts with (a skill of its pool). */
  starter?: string;
  /** Not rolled yet: unlocked later. */
  advanced?: boolean;
}

/** What an equipment component is (docs/equipment.md §6): a skill, an element shard or a passive sigil. */
export type ItemType = 'Skill' | 'Shard' | 'Sigil';

/** An elemental infusion an item adds to its wearer's pool; the player chooses the skill it goes on. */
export interface ItemInfusion {
  element: string;
}

/** An equipment component. A piece of equipment is one component or up to 3 forged together; its id
 * is the components' ids joined with "+" (@arena/meta `piece`). Items never enter the engine directly:
 * the loadout resolver turns them into skills, infusions and passives on a CharacterSpec. */
export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  /** Base skills granted (added when the character lacks them and has room). One for a Skill. */
  skills: string[];
  /** One for a Shard. */
  infusions: ItemInfusion[];
  /** A Sigil's passive text. */
  passive?: string;
  /** Status implementing the passive (applied to the wearer at match start). */
  passiveEffect?: string;
  /** A Sigil's name suffix on forged pieces ("of Momentum"). */
  suffix?: string;
}

/** Names for forged pieces (data/items/forging.yaml). Keys are skill or element ids in alphabetical
 * order, joined with "+". */
export interface ForgingDef {
  /** By skill: the prefix a third skill adds ("Reckless"). */
  prefixes: Record<string, string>;
  /** By two skills: the pair's name ("bless+shot": "Saint Bow"). */
  pairs: Record<string, string>;
  /** By fusion id: a two-shard piece's name when "<Fusion> Crystal" doesn't read well. */
  crystals: Record<string, string>;
  /** By three elements: a three-shard piece's title ("of the True Dragon"). */
  geodes: Record<string, string>;
}

// ---------------------------------------------------------------- economy (GDD §8.4)
// Like items, the economy never enters the engine: @arena/meta and the server read it.

/** Amounts by currency id, e.g. { gold: 100 }. */
export type CurrencyAmounts = Record<string, number>;

export interface RewardSpec {
  currency?: CurrencyAmounts;
  /** Items rolled from a drop table; each of the `count` drops happens with `chance` (default 1). */
  drops?: { table: string; count: number; chance?: number };
}

export interface ModeRewards {
  /** Matches shorter than this many turns (both players' turns counted) earn nothing. */
  minTurns: number;
  win: RewardSpec;
  /** Only for losses that were played out (not surrenders, forfeits or AFK). */
  loss: RewardSpec;
  draw: RewardSpec;
}

export interface DropTable {
  /** Relative weight of each component type; the components of a type are equally likely. */
  types: Partial<Record<ItemType, number>>;
  /** Components that never drop from this table. */
  exclude?: string[];
}

export interface EconomyDef {
  currencies: Record<string, { name: string; start: number }>;
  roll: { cost: CurrencyAmounts };
  /** Rewards per match kind (casual, ranked, …); kinds without an entry earn nothing. */
  rewards: Record<string, ModeRewards>;
  /** Item drops per account per UTC day, all modes together (0 = no cap). */
  dailyDropCap: number;
  dropTables: Record<string, DropTable>;
  /** Forging two pieces into one, by the result's component count ("2", "3"). */
  forge: { cost: Record<string, CurrencyAmounts> };
  /** Splitting a forged piece back into its components. */
  split: { cost: CurrencyAmounts };
  /** What salvaging a piece pays, per component, by component type. */
  salvage: Partial<Record<ItemType, CurrencyAmounts>>;
  /** Arcade mode's ladder (docs/single-player.md §Arcade); absent, the mode is off. */
  arcade?: ArcadeDef;
  /** Player levels (docs/equipment.md §4.1); absent, matches pay no experience. */
  progression?: ProgressionDef;
  /** Loot boxes by id (uncommon, rare, epic, …). */
  lootBoxes?: Record<string, LootBoxDef>;
}

/** Player levels: experience per match, the level curve and the bar's loot-box bubbles. */
export interface ProgressionDef {
  /** Experience per match kind (casual, ranked, practice, arcade, story, tutorial). */
  xp: Record<string, { minTurns: number; win: number; loss: number; draw: number }>;
  /** Experience from level L to L+1: base + step × (L − 1), at most max. */
  levels: { base: number; step: number; max: number };
  /** The bar's bubbles: at a percent of the level (1–100), the loot box paid. */
  milestones: { at: number; box: string }[];
  /** The drop table loot-box gear is built from. */
  table: string;
}

/**
 * A loot box: `count` rolls, each landing in a band by weight. `gold` pays an amount in its range;
 * `gear` a tier-1 or tier-2 piece (a component, or 2 forged together) by the `gear` weights; `prize`
 * a tier-3 piece (3 components).
 */
export interface LootBoxDef {
  name: string;
  count: number;
  bands: { gold: number; gear: number; prize: number };
  gold: { min: number; max: number };
  gear: { '1': number; '2': number };
}

/**
 * One rung of the arcade ladder: the shape of the bot team's kits. Each enemy has `skills` skills
 * (its class's starter first) carrying `infusions` infusions in all, `doubles` of those skills taking
 * two (a fusion element).
 */
export interface ArcadeStage {
  /** Skills per enemy (1–5). */
  skills: number;
  /** Infusions per enemy, counting both of a double skill's. */
  infusions: number;
  /** Skills with two infusions: the enemy's element and its second element. */
  doubles: number;
  /** Chance (0–1) that a single infusion is of the enemy's own elements rather than any element. */
  cohesion: number;
  /**
   * How the three enemies' elements relate: `none`, each its own; `partial`, each one's second
   * element is the next one's first; `full`, all three share the same two elements.
   */
  overlap: 'none' | 'partial' | 'full';
  bot: 'easy' | 'normal' | 'hard';
  /** Paid for clearing the stage. */
  win: RewardSpec;
}

export interface ArcadeDef {
  /** Arcade item drops per account per UTC day, apart from the match cap (0 = no cap). */
  dailyDropCap: number;
  /** Paid when a run ends in a played-out loss or a draw (never for a surrender). */
  loss: RewardSpec;
  /** Paid on top of the last stage's reward, for clearing the whole ladder. */
  complete: RewardSpec;
  stages: ArcadeStage[];
}

// ---------------------------------------------------------------- single-player (GDD §2.2, §11.9)
// Encounters, story chapters, achievements and tutorial lessons: data for @arena/meta, @arena/ai,
// the server and the client. Like items, they never enter the engine directly.

/** A fixed grant: currency and items (story and achievement rewards). */
export interface GrantSpec {
  currency?: CurrencyAmounts;
  items?: string[];
  /** Free character rolls (story and tutorial rewards; the roster cap still applies). */
  rolls?: number;
}

/** A character in an authored encounter. */
export interface EncounterUnitDef {
  name: string;
  classId: string;
  /** Base element: every skill with a variant in it is infused (unless `skills` lists ids). */
  element?: string;
  /** Skill ids (base or variant); default: the class's signatures, then affinity skills, up to `skillCount`. */
  skills?: string[];
  /** Skills when `skills` is omitted (1–5, default 4). */
  skillCount?: number;
  /** Starting and max Health (default 100). */
  hp?: number;
  /** Statuses on the unit for the whole match (boss traits, item passives). */
  passives?: string[];
}

/** A scripted AI rule: when `when` holds on the AI's turn, `unit` uses `skill` (GDD §11.9 "Scripted"). */
export interface ScriptRule {
  when?: {
    /** The AI's own turn number (1 = its first turn). */
    turn?: number;
    /** Every Nth own turn (2 = the 2nd, 4th, …). */
    every?: number;
    /** From this own turn on. */
    from?: number;
    /** The AI unit (index in its team) is at or below this Health. */
    hpAtMost?: { unit: number; value: number };
  };
  /** The AI unit (index in its team). */
  unit: number;
  /** The unit's skill: a skill id, or a base id matching its elemental variant. */
  skill: string;
  /** Target for single-target skills; default: the player's unit with the lowest Health. */
  target?: 'lowestHp' | 'highestHp' | 'self' | 'weakestAlly' | number;
}

export interface EncounterDef {
  id: string;
  name: string;
  description: string;
  enemies: EncounterUnitDef[];
  /** How the enemy plays: a difficulty tier, with script rules taking priority. */
  ai: { tier: 'easy' | 'normal' | 'hard'; script?: ScriptRule[] };
  /** A fixed team for the player (tutorial); otherwise the player brings their active team. */
  playerTeam?: EncounterUnitDef[];
  /** Who takes the first turn (default: the player). */
  first?: 'player' | 'enemy';
  settings?: Partial<MatchSettings>;
  /** Paid on the first clear, and (smaller) on later clears. */
  rewards?: { first?: GrantSpec; repeat?: GrantSpec };
}

export interface ChapterDef {
  id: string;
  name: string;
  element?: string;
  description: string;
  /** Encounter ids in order; each unlocks the next. */
  encounters: string[];
  /** A chapter to finish first. */
  requires?: string;
  /** The tutorial's lessons: shown on the Tutorial screen, not in the story. */
  tutorial?: boolean;
  /** Paid once, the first time the chapter's last encounter is cleared. */
  reward?: GrantSpec;
}

/** Counts finished matches that match `when` (GDD §8.4 achievement predicates). */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  when: {
    outcome?: 'win' | 'loss' | 'draw';
    /** Match kinds: casual, ranked, private, story, tutorial. */
    modes?: string[];
    /** A character of this class was on the player's team. */
    withClass?: string;
    /** A character of this base element was on the player's team. */
    withElement?: string;
    encounter?: string;
    chapter?: string;
    /** The match ended by turn N (both players' turns). */
    maxTurns?: number;
  };
  /** How many counting matches; with `streak`, in a row (a non-counting match of the same modes resets it). */
  count: number;
  streak?: boolean;
  reward?: GrantSpec;
}

/** Where the tutorial coach points (the client maps these to screen elements). */
export type CoachTarget = 'energy' | 'endTurn' | 'queue' | 'enemies' | 'log' | { skill: string } | { unit: string };

/** One step of a tutorial lesson: the coach's text, what to highlight, and what the player must do. */
export interface TutorialStep {
  text: string;
  highlight?: CoachTarget;
  /**
   * Nothing (the player clicks Next), queueing a skill (a skill id or base id, optionally on a unit),
   * or ending the turn. While a step expects something, the client refuses other commands.
   */
  expect?: { queue: { skill: string; target?: string } } | { endTurn: true };
}

/** The coach script for a tutorial encounter (keyed by the encounter id). */
export interface TutorialDef {
  id: string;
  steps: TutorialStep[];
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
  /** Equipment components. */
  items: Record<string, ItemDef>;
  /** Names for forged equipment. */
  forging: ForgingDef;
  /** Currencies, rewards, drops, forging and salvage. */
  economy: EconomyDef;
  encounters: Record<string, EncounterDef>;
  /** Story chapters, in play order (file order). */
  chapters: Record<string, ChapterDef>;
  achievements: Record<string, AchievementDef>;
  /** Tutorial coach scripts by encounter id. */
  tutorial: Record<string, TutorialDef>;
  /** Fusion elements by id: what two infusions on one skill make (GDD §7.3). */
  fusions: Record<string, FusionDef>;
  /** Keywords the client explains beside tooltips (hold Alt), by id. */
  glossary: Record<string, GlossaryDef>;
}

/**
 * A keyword the game explains (docs/glossary.md). `forms` are the exact, case-sensitive words that
 * count as it in text ("Chills", "Chilled"); a status keyword takes the status's own wording.
 */
export interface GlossaryDef {
  id: string;
  name: string;
  text: string;
  forms: string[];
  /** The element it belongs to, if any (for the explanation's color). */
  element?: string;
  /** The status it explains, if any. */
  status?: string;
}

/**
 * A fusion element (the codex's "Fusion recipe matrix"): the element a skill takes with two
 * infusions. The pair is unordered, and may be one element twice (Fire + Fire is Dragon).
 */
export interface FusionDef {
  id: string;
  name: string;
  elements: [string, string];
  /**
   * Status ids every character with at least one of this fusion's skills carries from the start
   * (a kit's resource or rule, such as Dragon's Hoard keeper).
   */
  passives?: string[];
}

/** The unordered key of an element pair: "Fire+Ice" for Fire + Ice or Ice + Fire. */
export function fusionKey(a: string, b: string): string {
  return a <= b ? `${a}+${b}` : `${b}+${a}`;
}

/** The fusion two elements make, if the content defines one. */
export function fusionOf(content: ContentBundle, a: string, b: string): FusionDef | undefined {
  const key = fusionKey(a, b);
  return Object.values(content.fusions ?? {}).find((f) => fusionKey(f.elements[0], f.elements[1]) === key);
}

/** Id of an archetype's elemental variant: base id + element, e.g. "strike.fire". */
export function variantId(baseSkillId: string, element: string): string {
  return element === 'None' ? baseSkillId : `${baseSkillId}.${element.toLowerCase()}`;
}
