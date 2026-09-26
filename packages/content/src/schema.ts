// Zod schemas for content files. Each schema is annotated with the engine's definition type, so
// any drift between the content language and the engine is a compile error.

import {
  parseCost,
  type ClassDef,
  type ItemDef,
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
  'allUnits',
  'lastSummoned',
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
    z.strictObject({ has: z.strictObject({ unit: selectorSchema, effect: z.string() }) }),
    z.strictObject({ hasFromArchetype: z.strictObject({ unit: selectorSchema, archetype: z.string() }) }),
    z.strictObject({ hpAtMost: z.strictObject({ unit: selectorSchema, value: z.number() }) }),
    z.strictObject({ hpAbove: z.strictObject({ unit: selectorSchema, value: z.number() }) }),
    z.strictObject({
      stackTotal: z.strictObject({ unit: selectorSchema, effects: z.array(z.string()).min(1), moreThan: z.number().int() }),
    }),
    z.strictObject({ kind: z.strictObject({ unit: selectorSchema, is: z.enum(['character', 'minion']) }) }),
    z.strictObject({ check: z.strictObject({ cond: z.string(), unit: selectorSchema }) }),
    z.strictObject({ isActor: selectorSchema }),
    z.strictObject({ isEnemy: selectorSchema }),
    z.strictObject({
      minion: z.strictObject({ unit: selectorSchema, types: z.array(z.string()).optional(), fromArchetypes: z.array(z.string()).optional() }),
    }),
    z.strictObject({ isEventTarget: selectorSchema }),
    z.strictObject({ appliedFromArchetype: z.string() }),
    z.strictObject({ eventTargetHad: z.strictObject({ archetypes: z.array(z.string()).min(1) }) }),
    z.strictObject({ eventSkill: z.strictObject({ archetypes: z.array(z.string()).optional(), costAtLeast: z.number().optional() }) }),
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
  ]),
) as z.ZodType<Cond>;

export const valueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ var: z.string() }),
    z.strictObject({ lastDamage: z.literal(true) }),
    z.strictObject({ effectValue: z.literal(true) }),
    z.strictObject({ effectStacks: z.literal(true) }),
    z.strictObject({ stacks: z.strictObject({ unit: selectorSchema, effect: z.string() }) }),
    z.strictObject({ count: z.strictObject({ effects: z.array(z.string()).min(1), in: selectorSchema.optional() }) }),
    z.strictObject({ countOf: selectorSchema }),
    z.strictObject({ missingHp: selectorSchema }),
    z.strictObject({ hp: selectorSchema }),
    z.strictObject({ skillCost: z.literal(true) }),
    z.strictObject({ deadCount: z.enum(['enemies', 'allies']) }),
    z.strictObject({ alliesActed: z.literal(true) }),
    z.strictObject({ eventAmount: z.literal(true) }),
    z.strictObject({ eventDuration: z.literal(true) }),
    z.strictObject({ totalStacks: z.strictObject({ in: selectorSchema, effect: z.string() }) }),
    z.strictObject({ div: z.tuple([valueSchema, valueSchema]) }),
    z.strictObject({ sum: z.array(valueSchema) }),
    z.strictObject({ mul: z.array(valueSchema) }),
    z.strictObject({ if: condSchema, then: valueSchema, else: valueSchema }),
  ]),
) as z.ZodType<Value>;

const damageWhen = z.strictObject({ direct: z.boolean().optional(), types: z.array(damageType).optional() });
const skillClass = z.enum(['Strategic', 'NonStrategic']);

/** Fields every modifier may carry: an `if` condition and an archetype filter (equipment). */
const modBase = {
  if: z.lazy(() => condSchema).optional(),
  archetypes: z.array(z.string()).optional(),
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
  }),
  mod({
    mod: z.literal('damageTaken'),
    amount: z.number(),
    perStack: z.boolean().optional(),
    when: damageWhen.optional(),
    armor: z.boolean().optional(),
    value: z.lazy(() => valueSchema).optional(),
  }),
  mod({ mod: z.literal('costGeneric'), amount: z.number().int(), perStack: z.boolean().optional() }),
  mod({ mod: z.literal('cooldownOnUse'), amount: z.number().int(), perStack: z.boolean().optional() }),
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
  mod({ mod: z.literal('skillTags'), add: z.array(z.string()).optional(), remove: z.array(z.string()).optional() }),
  mod({
    mod: z.literal('extraTargets'),
    where: z.lazy(() => condSchema),
    castAs: z.boolean().optional(),
    ops: z.lazy(() => z.array(opSchema)).optional(),
  }),
  mod({ mod: z.literal('grantBypass') }),
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
    }),
    z.strictObject({ op: z.literal('heal'), to: selectorSchema, amount: valueSchema }),
    z.strictObject({
      op: z.literal('apply'),
      to: selectorSchema,
      effect: z.union([z.string(), effectDefSchema]),
      stacks: valueSchema.optional(),
      value: valueSchema.optional(),
      duration: durationSchema.optional(),
      remember: selectorSchema.optional(),
      until: z
        .strictObject({ skillUsed: z.strictObject({ harmful: z.boolean().optional(), nonStrategic: z.boolean().optional() }) })
        .optional(),
      bindTo: selectorSchema.optional(),
      linkTo: z.string().optional(),
      from: selectorSchema.optional(),
    }),
    z.strictObject({
      op: z.literal('summon'),
      minion: z.string(),
      count: z.number().int().min(1).optional(),
      duration: durationSchema.optional(),
    }),
    z.strictObject({ op: z.literal('kill'), to: selectorSchema }),
    z.strictObject({ op: z.literal('removeEffect'), from: selectorSchema, effect: z.string() }),
    z.strictObject({ op: z.literal('addMaxHp'), to: selectorSchema, amount: z.number().int() }),
    z.strictObject({ op: z.literal('scaleShields'), on: selectorSchema, factor: z.number().positive() }),
    z.strictObject({ op: z.literal('removeKind'), from: selectorSchema, kind: z.enum(['Buff', 'Debuff', 'Neutral']) }),
    z.strictObject({ op: z.literal('removeStacks'), from: selectorSchema, effect: z.string(), amount: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('macro'), id: z.string() }),
    z.strictObject({ op: z.literal('signal'), name: z.string() }),
    z.strictObject({ op: z.literal('random'), options: z.array(z.array(opSchema)).min(1) }),
    z.strictObject({ op: z.literal('convertEffects'), from: z.string(), to: z.string() }),
    z.strictObject({ op: z.literal('gainEnergy'), amount: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('resetCooldown'), skill: z.string().optional(), archetypes: z.array(z.string()).optional() }),
    z.strictObject({
      op: z.literal('castSkill'),
      skill: z.string().optional(),
      archetype: z.string().optional(),
      on: selectorSchema,
      as: z.enum(['actor', 'it']).optional(),
    }),
    z.strictObject({ op: z.literal('eventEffect'), permanent: z.boolean().optional(), extendBy: z.number().int().optional() }),
    z.strictObject({
      op: z.literal('adjustCooldowns'),
      to: selectorSchema,
      by: z.union([z.number().int(), valueSchema]),
      exceptCurrent: z.boolean().optional(),
      skill: z.string().optional(),
      archetypes: z.array(z.string()).optional(),
      exceptEvent: z.boolean().optional(),
    }),
    z.strictObject({ op: z.literal('extendEffects'), on: selectorSchema, effects: z.array(z.string()).min(1), by: z.number().int() }),
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
    on: z.enum(['damaged', 'skillUsed', 'skillResolved', 'skillTargeted', 'turnEnd', 'turnStart', 'signal', 'effectGained', 'dealtDamage', 'shieldDamaged', 'summoned', 'ownEffectTriggered', 'ownEffectEnded', 'effectApplied', 'healed']),
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
    modifiers: z.array(modifierSchema).optional(),
    triggers: z.array(triggerSchema).optional(),
    onExpire: z.array(opSchema).optional(),
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
  infusions: z.array(z.strictObject({ element: z.string(), target: z.string().optional() })).max(2).default([]),
  passive: z.string().optional(),
  passiveEffect: z.string().optional(),
  classId: z.string().optional(),
  placeholder: z.boolean().optional(),
});

// Compile-time checks that file entries + injected id produce the engine's types.
type Assert<T extends true> = T;
export type _SkillOk = Assert<z.output<typeof skillFileEntry> & { id: string } extends SkillDef ? true : false>;
export type _MinionOk = Assert<z.output<typeof minionFileEntry> & { id: string } extends MinionDef ? true : false>;
export type _ClassOk = Assert<z.output<typeof classFileEntry> & { id: string } extends ClassDef ? true : false>;
export type _ItemOk = Assert<z.output<typeof itemFileEntry> & { id: string } extends ItemDef ? true : false>;
