// Rarity table and roll tuning (GDD §7.2, R10: first pass, to tune).

export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RarityDef {
  id: RarityId;
  name: string;
  /** Relative roll weight. */
  weight: number;
  /** Native (class) skills rolled. */
  nativeSkills: number;
  /** Default (locked) infusions of the base element: [min, max], uniform. */
  defaultInfusions: [number, number];
  /**
   * Most equipment-granted skills, passives and infusions the character can use at once (GDD §8.2:
   * "3 skills 2 passives 4 element" for a fully kitted character, scaled down by rarity).
   */
  budget: { skills: number; passives: number; infusions: number };
}

export const RARITY_ORDER: readonly RarityId[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITIES: Record<RarityId, RarityDef> = {
  common: {
    id: 'common',
    name: 'Common',
    weight: 50,
    nativeSkills: 3,
    defaultInfusions: [1, 1],
    budget: { skills: 1, passives: 1, infusions: 2 },
  },
  uncommon: {
    id: 'uncommon',
    name: 'Uncommon',
    weight: 28,
    nativeSkills: 3,
    defaultInfusions: [1, 2],
    budget: { skills: 2, passives: 1, infusions: 2 },
  },
  rare: {
    id: 'rare',
    name: 'Rare',
    weight: 14,
    nativeSkills: 4,
    defaultInfusions: [1, 2],
    budget: { skills: 2, passives: 2, infusions: 3 },
  },
  epic: {
    id: 'epic',
    name: 'Epic',
    weight: 6,
    nativeSkills: 4,
    defaultInfusions: [2, 3],
    budget: { skills: 3, passives: 2, infusions: 3 },
  },
  legendary: {
    id: 'legendary',
    name: 'Legendary',
    weight: 2,
    nativeSkills: 5,
    defaultInfusions: [2, 3],
    budget: { skills: 3, passives: 2, infusions: 4 },
  },
};

/**
 * Pity timer: after `threshold − 1` rolls in a row below `minimum`, the next roll is at least
 * `minimum` (drawn from the eligible rarities by weight).
 */
export const PITY = { threshold: 30, minimum: 'epic' as RarityId };

/** Characters never exceed 5 skills, native plus equipment-granted (GDD §7.3). */
export const MAX_SKILLS = 5;

export function rarityAtLeast(r: RarityId, min: RarityId): boolean {
  return RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf(min);
}
