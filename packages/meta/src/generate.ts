// Character generation ("recruit", GDD §7.2, decided 2026-10-03). Pure and seeded: the server owns the
// RNG seed. A character has its class's starter skill, one more skill from the class pool, and an
// infusion of its base element in its pool; equipment adds the rest.

import { nextInt, sample, type ContentBundle, type RngState } from '@arena/engine';
import type { CharacterRecord, CharacterSkill } from './character.js';
import { generateName } from './names.js';
import { NATIVE_SKILLS } from './rules.js';

export interface RollContext {
  /** How many characters of each class the player already owns; classes they own fewer of are favored. */
  ownedClassCounts?: Record<string, number>;
}

export interface RollResult {
  character: CharacterRecord;
}

/** Elements that have variants in this content bundle (the base element pool). */
export function rollableElements(content: ContentBundle): string[] {
  // Fusion elements (Dragon…) come from two infusions; no character is born with one.
  const fusions = new Set(Object.values(content.fusions ?? {}).map((f) => f.name));
  return [...new Set(Object.values(content.skills).map((s) => s.element).filter((e) => e !== 'None' && !fusions.has(e)))].sort();
}

/** Classes a recruit can be (advanced classes are unlocked later). */
export function rollableClasses(content: ContentBundle) {
  return Object.values(content.classes)
    .filter((c) => !c.advanced)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function weighted<T>(rng: RngState, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((n, t) => n + weight(t), 0);
  let roll = nextInt(rng, total);
  for (const t of items) {
    roll -= weight(t);
    if (roll < 0) return t;
  }
  return items[items.length - 1]!;
}

export function rollCharacter(content: ContentBundle, rng: RngState, ctx: RollContext = {}): RollResult {
  // Class: weighted towards classes the player owns fewer of (weight ∝ 1 / (1 + owned)).
  const owned = ctx.ownedClassCounts ?? {};
  const cls = weighted(rng, rollableClasses(content), (c) => Math.round(1200 / (1 + (owned[c.id] ?? 0))));

  const elements = rollableElements(content);
  const element = elements[nextInt(rng, elements.length)]!;

  // The class's starter skill first, then the rest drawn from the class pool.
  const pool = [...cls.signatures, ...cls.affinity];
  const starter = cls.starter ?? pool[0]!;
  const bases = [starter, ...sample(rng, pool.filter((s) => s !== starter), NATIVE_SKILLS - 1)];
  const skills: CharacterSkill[] = bases.map((base) => ({ base, infusion: null, source: 'native', locked: false }));

  const character: CharacterRecord = {
    name: generateName(rng, cls.id, cls.name, element),
    classId: cls.id,
    element,
    portraitId: `${cls.id}.${element.toLowerCase()}.01`,
    skills,
  };
  return { character };
}
