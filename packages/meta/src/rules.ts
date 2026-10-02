// Character rules (GDD §7.2–7.3, decided 2026-10-03). There's no rarity: every rolled character has
// the same shape, and equipment fills in the rest.

/** Native skills a rolled character has: its class's starter skill and one more from the class pool. */
export const NATIVE_SKILLS = 2;

/** Infusions of the base element in a character's pool: placed on a skill by the player, like equipment's. */
export const NATIVE_INFUSIONS = 1;

/** Characters never exceed 5 skills, native plus prepared equipment ones (GDD §7.3). */
export const MAX_SKILLS = 5;

/** Item passives (Sigils) a character can use at once. */
export const PASSIVE_BUDGET = 1;
