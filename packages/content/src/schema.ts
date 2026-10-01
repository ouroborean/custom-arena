// Zod schemas for content files. Each schema is annotated with the engine's definition type, so
// any drift between the content language and the engine is a compile error.

import {
  parseCost,
  type AchievementDef,
  type ChapterDef,
  type ClassDef,
  type EncounterDef,
  type FusionDef,
  type ItemDef,
  type TutorialDef,
  type Cond,
  type Cost,
  type DurationSpec,
  type EffectDef,
  type MinionDef,
  type ModifierSpec,
  type Op,
  type Selector,
  type SkillDef,
  type TriggerSpec,
  type Value,
} from '@arena/engine';
import { z } from 'zod';

const damageType = z.enum(['Normal', 'Piercing', 'Affliction']);
const effectKind = z.enum(['Buff', 'Debuff', 'Neutral']);

export const costSchema: z.ZodType<Cost> = z.union([
  z.string().transform((s, ctx) => {
    try {
      return parseCost(s);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  }),
  z.strictObject({
    S: z.number().int().min(0).default(0),
    A: z.number().int().min(0).default(0),
    I: z.number().int().min(0).default(0),
    W: z.number().int().min(0).default(0),
    r: z.number().int().min(0).default(0),
  }),
]) as z.ZodType<Cost>;

export const durationSchema: z.ZodType<DurationSpec> = z.lazy(() =>
  z.union([
    z.literal('permanent'),
    z.strictObject({ thisTurn: z.literal(true) }),
    z.strictObject({ enemyTurns: z.union([z.number().int().min(1), valueSchema]) }),
    z.strictObject({ ownTurns: z.union([z.number().int().min(1), valueSchema]) }),
    z.strictObject({ raw: z.union([z.number().int().min(1), valueSchema]) }),
    z.strictObject({ sameAsEvent: z.literal(true) }),
  ]),
) as z.ZodType<DurationSpec>;

const namedSelector = z.enum([
  'actor',
  'targets',
  'primary',
  'primaryAllies',
  'allEnemies',
  'allAllies',
  'bearer',
  'eventSource',
  'eventTarget',
  'effectTargets',
  'it',
  'lastDamaged',
  'summoner',
  'eventTargets',
  'eventPrimary',
  'allUnits',
  'lastSummoned',
  'weakestAlly',
  'weakestEnemy',
  'strongestEnemy',
  'lastAttacker',
  'primaryLastAttacker',
  'summonerLastAttacker',
  'primaryPartners',
  'bearerAllies',
  'randomBearerAlly',
  'randomAnyEnemy',
]);

export const selectorSchema: z.ZodType<Selector> = z.lazy(() =>
  z.union([
    namedSelector,
    z.strictObject({ randomEnemy: z.number().int().min(1), exclude: namedSelector.optional(), where: condSchema.optional() }),
    z.strictObject({ randomAlly: z.number().int().min(1), exclude: namedSelector.optional(), where: condSchema.optional() }),
    z.strictObject({ filter: namedSelector, where: condSchema, exclude: namedSelector.optional() }),
  ]),
) as z.ZodType<Selector>;

export const condSchema: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.strictObject({ has: z.strictObject({ unit: selectorSchema, effect: z.string(), mine: z.boolean().optional(), exact: z.boolean().optional() }) }),
    z.strictObject({ hasFromArchetype: z.strictObject({ unit: selectorSchema, archetype: z.string(), mine: z.boolean().optional() }) }),
    z.strictObject({ hpAtMost: z.strictObject({ unit: selectorSchema, value: z.number() }) }),
    z.strictObject({ hpAbove: z.strictObject({ unit: selectorSchema, value: z.number() }) }),
    z.strictObject({
      stackTotal: z.strictObject({ unit: selectorSchema, effects: z.array(z.string()).min(1), moreThan: z.number().int() }),
    }),
    z.strictObject({ kind: z.strictObject({ unit: selectorSchema, is: z.enum(['character', 'minion']) }) }),
    z.strictObject({ check: z.strictObject({ cond: z.string(), unit: selectorSchema }) }),
    z.strictObject({ isActor: selectorSchema }),
    z.strictObject({ isPrimary: selectorSchema }),
    z.strictObject({ isEnemy: selectorSchema }),
    z.strictObject({
      minion: z.strictObject({
        unit: selectorSchema,
        types: z.array(z.string()).optional(),
        fromArchetypes: z.array(z.string()).optional(),
        mine: z.boolean().optional(),
      }),
    }),
    z.strictObject({ isEventTarget: selectorSchema }),
    z.strictObject({ eventTargetIs: selectorSchema }),
    z.strictObject({ appliedFromArchetype: z.string() }),
    z.strictObject({ eventTargetHad: z.strictObject({ archetypes: z.array(z.string()).min(1).optional(), effects: z.array(z.string()).min(1).optional() }) }),
    z.strictObject({
      eventSkill: z.strictObject({
        archetypes: z.array(z.string()).optional(),
        costAtLeast: z.number().optional(),
        tags: z.array(z.string()).optional(),
        elements: z.array(z.string()).optional(),
        single: z.boolean().optional(),
      }),
    }),
    z.strictObject({ channeling: selectorSchema }),
    z.strictObject({ stunned: selectorSchema }),
    z.strictObject({ actedThisTurn: selectorSchema }),
    z.strictObject({ hasShield: selectorSchema }),
    z.strictObject({ hasSkill: z.strictObject({ unit: selectorSchema, archetypes: z.array(z.string()).min(1) }) }),
    z.strictObject({ hasKind: z.strictObject({ unit: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']) }) }),
    z.strictObject({
      compare: z.strictObject({ value: valueSchema, atLeast: z.number().optional(), atMost: z.number().optional() }),
    }),
    z.strictObject({ any: z.strictObject({ in: selectorSchema, cond: condSchema }) }),
    z.strictObject({ all: z.strictObject({ in: selectorSchema, cond: condSchema }) }),
    z.strictObject({ and: z.array(condSchema) }),
    z.strictObject({ or: z.array(condSchema) }),
    z.strictObject({ not: condSchema }),
    z.strictObject({ flag: z.string() }),
    z.strictObject({ varTrue: z.string() }),
    z.strictObject({ crest: z.literal(true) }),
  ]),
) as z.ZodType<Cond>;

export const valueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ var: z.string() }),
    z.strictObject({ lastDamage: z.literal(true) }),
    z.strictObject({ effectValue: z.literal(true) }),
    z.strictObject({ effectStacks: z.literal(true) }),
    z.strictObject({ effectData: z.string().min(1) }),
    z.strictObject({ kindCount: z.strictObject({ unit: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']), stacks: z.boolean().optional() }) }),
    z.strictObject({ timesUsed: z.literal(true) }),
    z.strictObject({ counter: z.string().min(1) }),
    z.strictObject({ counterOf: z.strictObject({ unit: selectorSchema, name: z.string().min(1) }) }),
    z.strictObject({ turn: z.literal(true) }),
    z.strictObject({ lastOverheal: z.literal(true) }),
    z.strictObject({ effectValueOf: z.strictObject({ unit: selectorSchema, effect: z.string() }) }),
    z.strictObject({ stacks: z.strictObject({ unit: selectorSchema, effect: z.string() }) }),
    z.strictObject({ count: z.strictObject({ effects: z.array(z.string()).min(1), in: selectorSchema.optional() }) }),
    z.strictObject({ countOf: selectorSchema }),
    z.strictObject({ missingHp: selectorSchema }),
    z.strictObject({ hp: selectorSchema }),
    z.strictObject({ skillCost: z.literal(true) }),
    z.strictObject({ skillCooldown: z.literal(true) }),
    z.strictObject({ skillsOnCooldown: selectorSchema }),
    z.strictObject({ energyOf: z.strictObject({ unit: selectorSchema, colors: z.boolean().optional() }) }),
    z.strictObject({ totalHp: selectorSchema }),
    z.strictObject({ deadCount: z.enum(['enemies', 'allies']) }),
    z.strictObject({ minionsLost: z.literal(true) }),
    z.strictObject({ recentDeaths: z.literal(true) }),
    z.strictObject({ alliesActed: z.literal(true) }),
    z.strictObject({ eventAmount: z.literal(true) }),
    z.strictObject({ eventDuration: z.literal(true) }),
    z.strictObject({ energy: z.literal(true) }),
    z.strictObject({ totalStacks: z.strictObject({ in: selectorSchema, effect: z.string() }) }),
    z.strictObject({ div: z.tuple([valueSchema, valueSchema]) }),
    z.strictObject({ sum: z.array(valueSchema) }),
    z.strictObject({ mul: z.array(valueSchema) }),
    z.strictObject({ if: condSchema, then: valueSchema, else: valueSchema }),
  ]),
) as z.ZodType<Value>;

const damageWhen = z.strictObject({ direct: z.boolean().optional(), types: z.array(damageType).optional() });
const skillClass = z.enum(['Strategic', 'NonStrategic']);

/** Fields every modifier may carry: an `if` condition and archetype / tag filters (equipment). */
const modBase = {
  if: z.lazy(() => condSchema).optional(),
  archetypes: z.array(z.string()).optional(),
  skillsWith: z.array(z.string()).optional(),
  elements: z.array(z.string()).optional(),
};
const mod = <T extends z.ZodRawShape>(shape: T) => z.strictObject({ ...shape, ...modBase });

export const modifierSchema: z.ZodType<ModifierSpec> = z.discriminatedUnion('mod', [
  mod({
    mod: z.literal('damageDealt'),
    amount: z.number(),
    perStack: z.boolean().optional(),
    when: damageWhen.optional(),
    value: z.lazy(() => valueSchema).optional(),
    target: z.lazy(() => condSchema).optional(),
    mul: z.number().min(0).optional(),
    onePerTurn: z.boolean().optional(),
  }),
  mod({
    mod: z.literal('damageTaken'),
    amount: z.number(),
    perStack: z.boolean().optional(),
    when: damageWhen.optional(),
    armor: z.boolean().optional(),
    value: z.lazy(() => valueSchema).optional(),
    atLeast: z.number().optional(),
    oncePerTurn: z.boolean().optional(),
    mul: z.number().min(0).optional(),
  }),
  mod({ mod: z.literal('costGeneric'), amount: z.number().int(), perStack: z.boolean().optional() }),
  mod({ mod: z.literal('cooldownOnUse'), amount: z.number().int(), perStack: z.boolean().optional(), min: z.number().int().min(0).optional() }),
  mod({ mod: z.literal('untargetable'), by: z.enum(['enemies', 'allies']), bypassable: z.boolean() }),
  mod({ mod: z.literal('blockIndirectDamage') }),
  mod({ mod: z.literal('cannotUseSkills'), classes: z.array(skillClass).optional(), harmful: z.boolean().optional() }),
  mod({ mod: z.literal('noCostReduction') }),
  mod({ mod: z.literal('cannotApplyBuffs') }),
  mod({ mod: z.literal('immuneToDebuffsFrom'), sourceHas: z.array(z.string()).min(1) }),
  mod({ mod: z.literal('invulnerableTo'), sourceHas: z.array(z.string()).min(1) }),
  mod({ mod: z.literal('ignoreCounters') }),
  mod({ mod: z.literal('bonusStacksOnApply'), effect: z.string(), amount: z.number().int() }),
  mod({ mod: z.literal('immuneTo'), kind: effectKind }),
  mod({ mod: z.literal('negateNext'), effect: z.string() }),
  mod({ mod: z.literal('forceTarget') }),
  mod({ mod: z.literal('noArmorOrShield') }),
  mod({ mod: z.literal('energyGain'), amount: z.number().int(), atStacks: z.number().int().min(1).optional() }),
  mod({ mod: z.literal('healingReceived'), mul: z.number().min(0), roundUpTo: z.number().int().min(1).optional() }),
  mod({ mod: z.literal('healFromDirectDamage') }),
  mod({ mod: z.literal('hpFloor'), amount: z.number().int() }),
  mod({ mod: z.literal('lifesteal') }),
  mod({ mod: z.literal('nextSkillStealthy') }),
  mod({ mod: z.literal('randomPrimaryTarget') }),
  mod({ mod: z.literal('costToRandom') }),
  mod({ mod: z.literal('freeSkills') }),
  mod({ mod: z.literal('costSpecific'), amount: z.number().int().max(-1) }),
  mod({ mod: z.literal('keepChannels') }),
  mod({ mod: z.literal('targetExclude'), where: z.lazy(() => condSchema) }),
  mod({ mod: z.literal('redirectDamage') }),
  mod({ mod: z.literal('exposed'), anyEnemy: z.boolean().optional() }),
  mod({ mod: z.literal('maxHp'), amount: z.number().int(), perStack: z.boolean().optional() }),
  mod({ mod: z.literal('armorMul'), mul: z.number().min(0) }),
  mod({ mod: z.literal('stackCap'), effect: z.string(), max: z.number().int().min(2) }),
  mod({ mod: z.literal('skillTags'), add: z.array(z.string()).optional(), remove: z.array(z.string()).optional() }),
  mod({
    mod: z.literal('extraTargets'),
    where: z.lazy(() => condSchema),
    castAs: z.boolean().optional(),
    ops: z.lazy(() => z.array(opSchema)).optional(),
  }),
  mod({ mod: z.literal('grantBypass') }),
  mod({ mod: z.literal('maxHpLossPerHit'), amount: z.number().int().min(0) }),
  mod({ mod: z.literal('maxHpLossPerTurn'), amount: z.number().int().min(0) }),
  mod({ mod: z.literal('borrowShield') }),
  mod({ mod: z.literal('muteTraps') }),
  mod({ mod: z.literal('absorbAoE') }),
  mod({ mod: z.literal('driftSkills') }),
  mod({ mod: z.literal('protectEffects'), effects: z.array(z.string()).min(1) }),
  mod({ mod: z.literal('adaptiveHide') }),
  mod({ mod: z.literal('shareDamage') }),
  mod({ mod: z.literal('invertHealing') }),
  mod({ mod: z.literal('banished') }),
  mod({ mod: z.literal('catalyst') }),
  mod({ mod: z.literal('normalAsPiercing') }),
  mod({ mod: z.literal('immuneToEffects'), effects: z.array(z.string()), fromData: z.boolean().optional() }),
  mod({ mod: z.literal('freezeCooldowns') }),
  mod({ mod: z.literal('suspendEffects') }),
  mod({ mod: z.literal('fogged') }),
  mod({ mod: z.literal('bloodPrice') }),
  mod({ mod: z.literal('suppressBuffs') }),
  mod({ mod: z.literal('suppressDebuffs') }),
  mod({ mod: z.literal('charmed'), own: z.boolean().optional() }),
  mod({ mod: z.literal('warded') }),
  mod({ mod: z.literal('cooldownTick'), amount: z.number().int() }),
  mod({ mod: z.literal('entangleLink'), kinds: z.array(effectKind).optional() }),
  mod({ mod: z.literal('deferHits'), status: z.string(), reduceBy: z.number().int().min(0), delay: z.number().int().min(1) }),
]) as z.ZodType<ModifierSpec>;

export const opSchema: z.ZodType<Op> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.strictObject({
      op: z.literal('damage'),
      to: selectorSchema,
      amount: valueSchema,
      type: damageType.optional(),
      direct: z.boolean().optional(),
      bypass: z.boolean().optional(),
      respectsInvulnerable: z.boolean().optional(),
      wakes: z.boolean().optional(),
      from: selectorSchema.optional(),
      raw: z.boolean().optional(),
    }),
    z.strictObject({ op: z.literal('heal'), to: selectorSchema, amount: valueSchema, raw: z.boolean().optional(), quiet: z.boolean().optional() }),
    z.strictObject({
      op: z.literal('apply'),
      to: selectorSchema,
      effect: z.union([z.string(), effectDefSchema]),
      stacks: valueSchema.optional(),
      value: valueSchema.optional(),
      duration: durationSchema.optional(),
      remember: selectorSchema.optional(),
      until: z
        .strictObject({
          skillUsed: z.strictObject({
            harmful: z.boolean().optional(),
            nonStrategic: z.boolean().optional(),
            archetypes: z.array(z.string()).optional(),
          }),
        })
        .optional(),
      bindTo: selectorSchema.optional(),
      linkTo: z.string().optional(),
      from: selectorSchema.optional(),
      quiet: z.boolean().optional(),
      whileActorHas: z.string().optional(),
      linkToEvent: z.boolean().optional(),
    }),
    z.strictObject({
      op: z.literal('summon'),
      minion: z.string(),
      count: z.number().int().min(1).optional(),
      duration: durationSchema.optional(),
    }),
    z.strictObject({ op: z.literal('kill'), to: selectorSchema }),
    z.strictObject({ op: z.literal('revive'), hp: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('swapCooldowns'), a: selectorSchema, b: selectorSchema }),
    z.strictObject({ op: z.literal('shiftEnergy'), of: selectorSchema, count: z.number().int().min(1).optional() }),
    z.strictObject({ op: z.literal('stealEnergy'), from: selectorSchema }),
    z.strictObject({ op: z.literal('spendEnergy'), amount: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('invertCooldowns'), on: selectorSchema, ready: z.number().int().min(0) }),
    z.strictObject({ op: z.literal('copyEffects'), from: selectorSchema, to: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']), fromSnapshot: z.boolean().optional() }),
    z.strictObject({ op: z.literal('expire'), on: selectorSchema, effect: z.string(), times: z.number().int().min(1).optional() }),
    z.strictObject({ op: z.literal('interrupt'), to: selectorSchema }),
    z.strictObject({ op: z.literal('removeShields'), from: selectorSchema }),
    z.strictObject({ op: z.literal('setCounter'), name: z.string().min(1), value: valueSchema, on: selectorSchema.optional() }),
    z.strictObject({ op: z.literal('transformMinion'), to: selectorSchema, minion: z.string() }),
    z.strictObject({ op: z.literal('shareEffects'), a: selectorSchema, b: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']) }),
    z.strictObject({ op: z.literal('entangle'), to: selectorSchema, with: selectorSchema.optional(), effect: z.string(), duration: durationSchema.optional() }),
    z.strictObject({ op: z.literal('moveEffects'), from: selectorSchema, to: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']).optional(), effects: z.array(z.string()).optional() }),
    z.strictObject({ op: z.literal('transmute'), on: selectorSchema, effects: z.array(z.string()).optional(), kind: z.enum(['Buff', 'Debuff', 'Neutral']).optional(), count: z.number().int().min(1).optional(), event: z.boolean().optional(), removeUnmatched: z.boolean().optional() }),
    z.strictObject({ op: z.literal('reveal'), by: selectorSchema.optional(), event: z.boolean().optional(), end: z.boolean().optional() }),
    z.strictObject({ op: z.literal('growShield'), to: selectorSchema, effect: z.string(), amount: valueSchema, max: z.number().int().min(1).optional() }),
    z.strictObject({ op: z.literal('removeEffect'), from: selectorSchema, effect: z.string() }),
    z.strictObject({ op: z.literal('addMaxHp'), to: selectorSchema, amount: valueSchema }),
    z.strictObject({ op: z.literal('scaleShields'), on: selectorSchema, factor: z.number().positive() }),
    z.strictObject({ op: z.literal('boostShields'), on: selectorSchema, amount: z.number().int() }),
    z.strictObject({
      op: z.literal('stealRandom'),
      from: selectorSchema,
      to: selectorSchema,
      kind: z.enum(['Buff', 'Debuff', 'Neutral']),
      nonElemental: z.boolean().optional(),
    }),
    z.strictObject({ op: z.literal('removeKind'), from: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']) }),
    z.strictObject({ op: z.literal('removeStacks'), from: selectorSchema, effect: z.string(), amount: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('macro'), id: z.string() }),
    z.strictObject({ op: z.literal('signal'), name: z.string() }),
    z.strictObject({ op: z.literal('random'), options: z.array(z.array(opSchema)).min(1) }),
    z.strictObject({ op: z.literal('convertEffects'), from: z.string(), to: z.string() }),
    z.strictObject({ op: z.literal('gainEnergy'), amount: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('resetCooldown'), skill: z.string().optional(), archetypes: z.array(z.string()).optional(), lastUsed: z.boolean().optional() }),
    z.strictObject({
      op: z.literal('castSkill'),
      skill: z.string().optional(),
      archetype: z.string().optional(),
      eventSkill: z.boolean().optional(),
      lastUsedBy: selectorSchema.optional(),
      on: selectorSchema,
      as: z.enum(['actor', 'it']).optional(),
    }),
    z.strictObject({
      op: z.literal('eventEffect'),
      permanent: z.boolean().optional(),
      extendBy: z.number().int().optional(),
      expireNow: z.boolean().optional(),
      remove: z.boolean().optional(),
    }),
    z.strictObject({ op: z.literal('immunize'), to: selectorSchema, effect: z.string().optional(), duration: durationSchema.optional() }),
    z.strictObject({ op: z.literal('copyEventEffect'), to: selectorSchema, noChain: z.boolean().optional() }),
    z.strictObject({
      op: z.literal('removeRandom'),
      from: selectorSchema,
      kind: z.enum(['Buff', 'Debuff', 'Neutral']),
      count: z.number().int().min(1).optional(),
    }),
    z.strictObject({
      op: z.literal('adjustCooldowns'),
      to: selectorSchema,
      by: z.union([z.number().int(), valueSchema]),
      exceptCurrent: z.boolean().optional(),
      skill: z.string().optional(),
      archetypes: z.array(z.string()).optional(),
      exceptEvent: z.boolean().optional(),
      onlyEvent: z.boolean().optional(),
      random: z.boolean().optional(),
    }),
    z
      .strictObject({
        op: z.literal('extendEffects'),
        on: selectorSchema,
        effects: z.array(z.string()).min(1).optional(),
        kind: z.enum(['Buff', 'Debuff', 'Neutral']).optional(),
        except: z.array(z.string()).optional(),
        by: z.number().int(),
        onceKey: z.string().optional(),
      })
      .refine((o) => o.effects !== undefined || o.kind !== undefined, 'extendEffects needs `effects` or `kind`'),
    z.strictObject({ op: z.literal('if'), cond: condSchema, then: z.array(opSchema), else: z.array(opSchema).optional() }),
    z.strictObject({ op: z.literal('set'), var: z.string(), value: z.union([valueSchema, z.boolean()]) }),
    z.strictObject({ op: z.literal('forEach'), in: selectorSchema, do: z.array(opSchema) }),
    z.strictObject({ op: z.literal('repeat'), times: valueSchema, do: z.array(opSchema) }),
    z.strictObject({ op: z.literal('extendSelf'), by: z.number().int() }),
    z.strictObject({ op: z.literal('setFlag'), flag: z.string(), value: z.boolean().optional() }),
    z.strictObject({ op: z.literal('addStacksSelf'), amount: z.number().int() }),
    z.strictObject({ op: z.literal('removeSelf') }),
    z.strictObject({ op: z.literal('script'), id: z.string(), params: z.record(z.string(), z.unknown()).optional() }),
  ]),
) as z.ZodType<Op>;

export const triggerSchema: z.ZodType<TriggerSpec> = z.lazy(() =>
  z.strictObject({
    on: z.enum(['damaged', 'skillUsed', 'skillResolved', 'skillTargeted', 'turnEnd', 'turnStart', 'signal', 'effectGained', 'dealtDamage', 'shieldDamaged', 'summoned', 'ownEffectTriggered', 'ownEffectEnded', 'effectApplied', 'healed', 'battleStart', 'countered', 'effectNegated', 'incomingNegated', 'healDone', 'energyFromEffect', 'counterIgnored']),
    signal: z.string().optional(),
    effect: z.string().optional(),
    when: z
      .strictObject({
        direct: z.boolean().optional(),
        harmful: z.boolean().optional(),
        byEnemy: z.boolean().optional(),
        side: z.enum(['ally', 'enemy']).optional(),
        fromSide: z.enum(['ally', 'enemy']).optional(),
        strategic: z.boolean().optional(),
        wakes: z.boolean().optional(),
        archetypes: z.array(z.string()).optional(),
        counter: z.boolean().optional(),
        reason: z.array(z.enum(['expired', 'consumed', 'died', 'interrupted', 'depleted', 'removed'])).optional(),
        untriggered: z.boolean().optional(),
        effects: z.array(z.string()).optional(),
        toEnemy: z.boolean().optional(),
        kind: z.enum(['Buff', 'Debuff', 'Neutral']).optional(),
        reflected: z.boolean().optional(),
        shield: z.boolean().optional(),
        costAtLeast: z.number().int().min(1).optional(),
        anyTags: z.array(z.string()).optional(),
      })
      .optional(),
    intercept: z.enum(['counter', 'reflect']).optional(),
    do: z.array(opSchema).optional(),
    consume: z.boolean().optional(),
  }),
) as z.ZodType<TriggerSpec>;

export const effectDefSchema: z.ZodType<EffectDef> = z.lazy(() =>
  z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: effectKind,
    element: z.string().optional(),
    description: z.string().optional(),
    stacking: z.enum(['independent', 'unique', 'merge']).optional(),
    maxStacks: z.number().int().min(1).optional(),
    stealth: z.boolean().optional(),
    visibility: z.enum(['public', 'hidden', 'hiddenTarget']).optional(),
    shield: z.boolean().optional(),
    interruptible: z.boolean().optional(),
    respectsInvulnerable: z.boolean().optional(),
    countsAs: z.array(z.string()).optional(),
    modifiers: z.array(modifierSchema).optional(),
    triggers: z.array(triggerSchema).optional(),
    onExpire: z.array(opSchema).optional(),
    onDeath: z.array(opSchema).optional(),
  }),
) as z.ZodType<EffectDef>;

const skillTag = z.enum([
  'Harmful',
  'Helpful',
  'Strategic',
  'NonStrategic',
  'Invisible',
  'HiddenTarget',
  'Channeled',
  'Uncounterable',
  'Bypass',
  'Unstunnable',
  'UsableWhileStunned',
  'Stealthy',
  'Drift',
  'Radiant',
  'FreeAction',
  'BloodPrice',
]);

/** Skills are keyed by id in the file; the loader injects `id`. */
export const skillFileEntry = z.strictObject({
  archetype: z.string().min(1),
  element: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  cost: costSchema,
  cooldown: z.number().int().min(0),
  tags: z.array(skillTag),
  target: z.enum(['self', 'enemy', 'ally', 'any', 'allEnemies', 'allAllies', 'none']),
  targetFilter: condSchema.optional(),
  requires: condSchema.optional(),
  onCountered: z.array(opSchema).optional(),
  altCost: z.strictObject({ when: condSchema, cost: costSchema }).optional(),
  costAdjust: valueSchema.optional(),
  ops: z.array(opSchema),
});

export const minionFileEntry = z.strictObject({
  name: z.string().min(1),
  hp: z.number().int().min(1),
  skills: z.array(z.string()).default([]),
  passives: z.array(z.union([z.string(), effectDefSchema])).default([]),
  onSummon: z.array(opSchema).optional(),
  onDeath: z.array(opSchema).optional(),
  tags: z.array(z.string()).optional(),
});

export const macroFileEntry = z.array(opSchema);

export const conditionFileEntry = condSchema;

export const classFileEntry = z.strictObject({
  name: z.string().min(1),
  signatures: z.array(z.string()).length(3),
  affinity: z.array(z.string()).length(3),
});

export const itemFileEntry = z.strictObject({
  name: z.string().min(1),
  type: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']),
  skills: z.array(z.string()).max(2).default([]),
  infusions: z.array(z.strictObject({ element: z.string() })).max(2).default([]),
  passive: z.string().optional(),
  passiveEffect: z.string().optional(),
  classId: z.string().optional(),
  placeholder: z.boolean().optional(),
});

const itemType = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
const amounts = z.record(z.string(), z.number().int().min(0));
const rewardSpec = z.strictObject({
  currency: amounts.optional(),
  drops: z.strictObject({ table: z.string(), count: z.number().int().min(1) }).optional(),
});

/** The economy file(s): top-level sections merged from every economy*.yaml. */
export const economySchema = z.strictObject({
  currencies: z.record(z.string(), z.strictObject({ name: z.string().min(1), start: z.number().int().min(0) })),
  roll: z.strictObject({ cost: amounts }),
  rewards: z.record(
    z.string(),
    z.strictObject({ minTurns: z.number().int().min(0), win: rewardSpec, loss: rewardSpec, draw: rewardSpec }),
  ),
  dailyDropCap: z.number().int().min(0),
  dropTables: z.record(
    z.string(),
    z.strictObject({ types: z.partialRecord(itemType, z.number().int().min(0)), exclude: z.array(z.string()).optional() }),
  ),
  recipes: z.record(
    z.string(),
    z.strictObject({
      name: z.string().min(1),
      description: z.string().min(1),
      inputs: z.strictObject({ type: itemType, count: z.number().int().min(1), sameElement: z.boolean().optional() }),
      output: z.strictObject({ type: itemType }),
      cost: amounts.optional(),
    }),
  ),
  salvage: z.partialRecord(itemType, amounts),
});

const grantSpec = z.strictObject({
  currency: amounts.optional(),
  items: z.array(z.string()).optional(),
  rolls: z.number().int().min(1).max(3).optional(),
});
const energy = z.strictObject({ S: z.number().int().min(0), A: z.number().int().min(0), I: z.number().int().min(0), W: z.number().int().min(0) });

const encounterUnit = z.strictObject({
  name: z.string().min(1),
  classId: z.string(),
  element: z.string().optional(),
  skills: z.array(z.string()).min(1).max(5).optional(),
  skillCount: z.number().int().min(1).max(5).optional(),
  hp: z.number().int().min(1).optional(),
  passives: z.array(z.string()).optional(),
});

const scriptRule = z.strictObject({
  when: z
    .strictObject({
      turn: z.number().int().min(1).optional(),
      every: z.number().int().min(1).optional(),
      from: z.number().int().min(1).optional(),
      hpAtMost: z.strictObject({ unit: z.number().int().min(0), value: z.number().int().min(1) }).optional(),
    })
    .optional(),
  unit: z.number().int().min(0),
  skill: z.string(),
  target: z.union([z.enum(['lowestHp', 'highestHp', 'self', 'weakestAlly']), z.number().int().min(0)]).optional(),
});

export const encounterFileEntry = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  enemies: z.array(encounterUnit).min(1).max(3),
  ai: z.strictObject({ tier: z.enum(['easy', 'normal', 'hard']), script: z.array(scriptRule).optional() }),
  playerTeam: z.array(encounterUnit).min(1).max(3).optional(),
  first: z.enum(['player', 'enemy']).optional(),
  settings: z
    .strictObject({
      turnLimitPerPlayer: z.number().int().min(1).optional(),
      minionCap: z.number().int().min(0).optional(),
      fixedEnergy: z.strictObject({ player: z.union([z.literal(0), z.literal(1)]), turns: z.array(energy) }).optional(),
    })
    .optional(),
  rewards: z.strictObject({ first: grantSpec.optional(), repeat: grantSpec.optional() }).optional(),
});

export const chapterFileEntry = z.strictObject({
  name: z.string().min(1),
  element: z.string().optional(),
  description: z.string().min(1),
  encounters: z.array(z.string()).min(1),
  requires: z.string().optional(),
  tutorial: z.boolean().optional(),
  reward: grantSpec.optional(),
});

const coachTarget = z.union([
  z.enum(['energy', 'endTurn', 'queue', 'enemies', 'log']),
  z.strictObject({ skill: z.string() }),
  z.strictObject({ unit: z.string() }),
]);

export const tutorialFileEntry = z.strictObject({
  id: z.string(),
  steps: z
    .array(
      z.strictObject({
        text: z.string().min(1),
        highlight: coachTarget.optional(),
        expect: z
          .union([z.strictObject({ queue: z.strictObject({ skill: z.string(), target: z.string().optional() }) }), z.strictObject({ endTurn: z.literal(true) })])
          .optional(),
      }),
    )
    .min(1),
});

export const achievementFileEntry = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  when: z.strictObject({
    outcome: z.enum(['win', 'loss', 'draw']).optional(),
    modes: z.array(z.string()).optional(),
    withClass: z.string().optional(),
    withElement: z.string().optional(),
    encounter: z.string().optional(),
    chapter: z.string().optional(),
    maxTurns: z.number().int().min(1).optional(),
  }),
  count: z.number().int().min(1),
  streak: z.boolean().optional(),
  reward: grantSpec.optional(),
});

/**
 * A keyword (glossary*.yaml). A `status` keyword defaults to that status's name and description;
 * `forms` default to the name.
 */
export const glossaryFileEntry = z.strictObject({
  name: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  forms: z.array(z.string().min(1)).min(1).optional(),
  element: z.string().min(1).optional(),
});

/** A fusion element: its name and the pair of base elements that makes it (fusions*.yaml). */
export const fusionFileEntry = z.strictObject({
  name: z.string().min(1),
  elements: z.tuple([z.string().min(1), z.string().min(1)]),
  passives: z.array(z.string().min(1)).optional(),
});

// Compile-time checks that file entries + injected id produce the engine's types.
type Assert<T extends true> = T;
export type _SkillOk = Assert<z.output<typeof skillFileEntry> & { id: string } extends SkillDef ? true : false>;
export type _MinionOk = Assert<z.output<typeof minionFileEntry> & { id: string } extends MinionDef ? true : false>;
export type _ClassOk = Assert<z.output<typeof classFileEntry> & { id: string } extends ClassDef ? true : false>;
export type _ItemOk = Assert<z.output<typeof itemFileEntry> & { id: string } extends ItemDef ? true : false>;
export type _EncounterOk = Assert<z.output<typeof encounterFileEntry> & { id: string } extends EncounterDef ? true : false>;
export type _ChapterOk = Assert<z.output<typeof chapterFileEntry> & { id: string } extends ChapterDef ? true : false>;
export type _AchievementOk = Assert<z.output<typeof achievementFileEntry> & { id: string } extends AchievementDef ? true : false>;
export type _TutorialOk = Assert<z.output<typeof tutorialFileEntry> extends TutorialDef ? true : false>;
export type _FusionOk = Assert<z.output<typeof fusionFileEntry> & { id: string } extends FusionDef ? true : false>;
