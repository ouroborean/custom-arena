// Character generation ("roll/summon", GDD §7.2). Pure and seeded: the server owns the RNG seed.

import { nextInt, sample, variantId, type ContentBundle, type RngState } from '@arena/engine';
import type { CharacterRecord, CharacterSkill } from './character.js';
import { generateName } from './names.js';
import { PITY, RARITIES, RARITY_ORDER, rarityAtLeast, type RarityId } from './rarity.js';

export interface RollContext {
  /** How many characters of each class the player already owns; rarer classes are favored (§7.2). */
  ownedClassCounts?: Record<string, number>;
  /** Rolls in a row without reaching the pity minimum, before this one. */
  rollsSincePity?: number;
}

export interface RollResult {
  character: CharacterRecord;
  /** The new "rolls since pity" counter to store. */
  rollsSincePity: number;
}

/** Elements that have variants in this content bundle (the base element pool). */
export function rollableElements(content: ContentBundle): string[] {
  return [...new Set(Object.values(content.skills).map((s) => s.element).filter((e) => e !== 'None'))].sort();
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

export function rollRarity(rng: RngState, rollsSincePity = 0): RarityId {
  const forced = rollsSincePity + 1 >= PITY.threshold;
  const pool = forced ? RARITY_ORDER.filter((r) => rarityAtLeast(r, PITY.minimum)) : RARITY_ORDER;
  return weighted(rng, pool, (r) => RARITIES[r].weight);
}

export function rollCharacter(content: ContentBundle, rng: RngState, ctx: RollContext = {}): RollResult {
  const rarityId = rollRarity(rng, ctx.rollsSincePity ?? 0);
  const rarity = RARITIES[rarityId];

  // Class: weighted towards classes the player owns fewer of (weight ∝ 1 / (1 + owned)).
  const classes = Object.values(content.classes).sort((a, b) => a.id.localeCompare(b.id));
  const owned = ctx.ownedClassCounts ?? {};
  const cls = weighted(rng, classes, (c) => Math.round(1200 / (1 + (owned[c.id] ?? 0))));

  const elements = rollableElements(content);
  const element = elements[nextInt(rng, elements.length)]!;

  // Native skills: at least 2 of the 3 signatures, the rest from the remaining pool (§6.2, R9).
  const sigs = sample(rng, cls.signatures, 2);
  const rest = [...cls.signatures, ...cls.affinity].filter((s) => !sigs.includes(s));
  const bases = [...sigs, ...sample(rng, rest, rarity.nativeSkills - 2)];

  // Default infusions of the base element, locked (R8).
  const [lo, hi] = rarity.defaultInfusions;
  const infusable = bases.filter((b) => content.skills[variantId(b, element)]);
  const k = Math.min(infusable.length, lo + nextInt(rng, hi - lo + 1));
  const infused = new Set(sample(rng, infusable, k));

  const skills: CharacterSkill[] = bases.map((base) => ({
    base,
    infusion: infused.has(base) ? element : null,
    source: 'native',
    locked: infused.has(base),
  }));

  const character: CharacterRecord = {
    name: generateName(rng, cls.id, cls.name, element),
    classId: cls.id,
    element,
    rarity: rarityId,
    portraitId: `${cls.id}.${element.toLowerCase()}.01`,
    skills,
  };
  return { character, rollsSincePity: rarityAtLeast(rarityId, PITY.minimum) ? 0 : (ctx.rollsSincePity ?? 0) + 1 };
}
