// Zod schemas for content files. Each schema is annotated with the engine's definition type, so
// any drift between the content language and the engine is a compile error.

import {
  parseCost,
  type ClassDef,
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

export const durationSchema: z.ZodType<DurationSpec> = z.union([
  z.literal('permanent'),
  z.strictObject({ thisTurn: z.literal(true) }),
  z.strictObject({ enemyTurns: z.number().int().min(1) }),
  z.strictObject({ ownTurns: z.number().int().min(1) }),
  z.strictObject({ raw: z.number().int().min(1) }),
]);

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
]);

export const selectorSchema: z.ZodType<Selector> = z.union([
  namedSelector,
  z.strictObject({ randomEnemy: z.number().int().min(1), exclude: namedSelector.optional() }),
]) as z.ZodType<Selector>;

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
    z.strictObject({ sum: z.array(valueSchema) }),
    z.strictObject({ mul: z.array(valueSchema) }),
    z.strictObject({ if: condSchema, then: valueSchema, else: valueSchema }),
  ]),
) as z.ZodType<Value>;

const damageWhen = z.strictObject({ direct: z.boolean().optional(), types: z.array(damageType).optional() });
const skillClass = z.enum(['Strategic', 'NonStrategic']);

export const modifierSchema: z.ZodType<ModifierSpec> = z.discriminatedUnion('mod', [
  z.strictObject({ mod: z.literal('damageDealt'), amount: z.number(), perStack: z.boolean().optional(), when: damageWhen.optional() }),
  z.strictObject({
    mod: z.literal('damageTaken'),
    amount: z.number(),
    perStack: z.boolean().optional(),
    when: damageWhen.optional(),
    armor: z.boolean().optional(),
  }),
  z.strictObject({ mod: z.literal('costGeneric'), amount: z.number().int(), perStack: z.boolean().optional() }),
  z.strictObject({ mod: z.literal('cooldownOnUse'), amount: z.number().int(), perStack: z.boolean().optional() }),
  z.strictObject({ mod: z.literal('untargetable'), by: z.enum(['enemies', 'allies']), bypassable: z.boolean() }),
  z.strictObject({ mod: z.literal('blockIndirectDamage') }),
  z.strictObject({ mod: z.literal('cannotUseSkills'), classes: z.array(skillClass).optional() }),
  z.strictObject({ mod: z.literal('immuneTo'), kind: effectKind }),
  z.strictObject({ mod: z.literal('negateNext'), effect: z.string() }),
  z.strictObject({ mod: z.literal('forceTarget') }),
  z.strictObject({ mod: z.literal('noArmorOrShield') }),
  z.strictObject({ mod: z.literal('energyGain'), amount: z.number().int() }),
  z.strictObject({ mod: z.literal('healingReceived'), mul: z.number().min(0), roundUpTo: z.number().int().min(1).optional() }),
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
    }),
    z.strictObject({
      op: z.literal('summon'),
      minion: z.string(),
      count: z.number().int().min(1).optional(),
      duration: durationSchema.optional(),
    }),
    z.strictObject({ op: z.literal('kill'), to: selectorSchema }),
    z.strictObject({ op: z.literal('removeEffect'), from: selectorSchema, effect: z.string() }),
    z.strictObject({ op: z.literal('macro'), id: z.string() }),
    z.strictObject({ op: z.literal('signal'), name: z.string() }),
    z.strictObject({ op: z.literal('random'), options: z.array(z.array(opSchema)).min(1) }),
    z.strictObject({ op: z.literal('convertEffects'), from: z.string(), to: z.string() }),
    z.strictObject({ op: z.literal('gainEnergy'), amount: z.number().int().min(1) }),
    z.strictObject({ op: z.literal('resetCooldown') }),
    z.strictObject({ op: z.literal('if'), cond: condSchema, then: z.array(opSchema), else: z.array(opSchema).optional() }),
    z.strictObject({ op: z.literal('set'), var: z.string(), value: z.union([valueSchema, z.boolean()]) }),
    z.strictObject({ op: z.literal('forEach'), in: selectorSchema, do: z.array(opSchema) }),
    z.strictObject({ op: z.literal('extendSelf'), by: z.number().int() }),
    z.strictObject({ op: z.literal('setFlag'), flag: z.string() }),
    z.strictObject({ op: z.literal('addStacksSelf'), amount: z.number().int() }),
    z.strictObject({ op: z.literal('removeSelf') }),
    z.strictObject({ op: z.literal('script'), id: z.string(), params: z.record(z.string(), z.unknown()).optional() }),
  ]),
) as z.ZodType<Op>;

export const triggerSchema: z.ZodType<TriggerSpec> = z.lazy(() =>
  z.strictObject({
    on: z.enum(['damaged', 'skillUsed', 'skillTargeted', 'turnEnd', 'turnStart', 'signal']),
    signal: z.string().optional(),
    when: z
      .strictObject({
        direct: z.boolean().optional(),
        harmful: z.boolean().optional(),
        byEnemy: z.boolean().optional(),
        side: z.enum(['ally', 'enemy']).optional(),
        fromSide: z.enum(['ally', 'enemy']).optional(),
        strategic: z.boolean().optional(),
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
  ops: z.array(opSchema),
});

export const minionFileEntry = z.strictObject({
  name: z.string().min(1),
  hp: z.number().int().min(1),
  skills: z.array(z.string()).default([]),
  passives: z.array(z.union([z.string(), effectDefSchema])).default([]),
  onSummon: z.array(opSchema).optional(),
});

export const macroFileEntry = z.array(opSchema);

export const conditionFileEntry = condSchema;

export const classFileEntry = z.strictObject({
  name: z.string().min(1),
  signatures: z.array(z.string()).length(3),
  affinity: z.array(z.string()).length(3),
});

// Compile-time checks that file entries + injected id produce the engine's types.
type Assert<T extends true> = T;
export type _SkillOk = Assert<z.output<typeof skillFileEntry> & { id: string } extends SkillDef ? true : false>;
export type _MinionOk = Assert<z.output<typeof minionFileEntry> & { id: string } extends MinionDef ? true : false>;
export type _ClassOk = Assert<z.output<typeof classFileEntry> & { id: string } extends ClassDef ? true : false>;
