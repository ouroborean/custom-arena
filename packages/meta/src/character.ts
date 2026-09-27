// The persistent character record (GDD §7.1) and its conversion to an engine CharacterSpec.

import { variantId, type CharacterSpec, type ContentBundle } from '@arena/engine';
import { MAX_SKILLS, RARITIES, type RarityId } from './rarity.js';

export interface CharacterSkill {
  /** Base skill id (the archetype's id, e.g. "strike"). */
  base: string;
  /** Element infused into the skill, or null for the base version. */
  infusion: string | null;
  /** Native to the character, or granted by an equipped item. */
  source: 'native' | 'equipment';
  /** Default infusions are locked (R8): they can't be removed or replaced. */
  locked: boolean;
}

export interface CharacterRecord {
  name: string;
  classId: string;
  /** Base element: cosmetic plus default infusions (R8). */
  element: string;
  rarity: RarityId;
  portraitId: string;
  skills: CharacterSkill[];
}

/** The skill def id the engine uses for a record skill. */
export function skillDefId(s: CharacterSkill): string {
  return s.infusion ? variantId(s.base, s.infusion) : s.base;
}

/**
 * Engine input for a character. Pass the resolved loadout to include equipment skills, infusions
 * and passives; without it, only the native skills are used.
 */
export function toCharacterSpec(
  record: CharacterRecord,
  loadout?: { skills: CharacterSkill[]; passiveEffects: string[]; items?: string[] },
): CharacterSpec {
  return {
    name: record.name,
    classId: record.classId,
    element: record.element,
    skills: (loadout?.skills ?? record.skills).map(skillDefId),
    ...(loadout?.passiveEffects.length ? { passives: loadout.passiveEffects } : {}),
    ...(loadout?.items?.length ? { items: loadout.items } : {}),
  };
}

/** Problems with a record, or an empty list. Validates against content and the rarity budget. */
export function validateCharacter(content: ContentBundle, r: CharacterRecord): string[] {
  const errs: string[] = [];
  const cls = content.classes[r.classId];
  if (!cls) return [`unknown class "${r.classId}"`];
  const rarity = RARITIES[r.rarity];
  if (!rarity) return [`unknown rarity "${r.rarity}"`];
  if (r.skills.length < 1 || r.skills.length > MAX_SKILLS) errs.push(`must have 1–${MAX_SKILLS} skills`);
  const bases = r.skills.map((s) => s.base);
  if (new Set(bases).size !== bases.length) errs.push('duplicate skills');
  const pool = new Set([...cls.signatures, ...cls.affinity]);
  const native = r.skills.filter((s) => s.source === 'native');
  if (native.length > rarity.nativeSkills) errs.push(`too many native skills for ${rarity.name}`);
  for (const s of native) if (!pool.has(s.base)) errs.push(`"${s.base}" isn't in the ${cls.name} pool`);
  for (const s of r.skills) {
    const base = content.skills[s.base];
    if (!base || base.element !== 'None') errs.push(`"${s.base}" isn't a base skill`);
    else if (s.infusion && !content.skills[variantId(s.base, s.infusion)]) errs.push(`no ${s.infusion} variant of "${s.base}"`);
    if (s.locked && s.infusion !== r.element) errs.push(`locked infusion on "${s.base}" must be the base element`);
  }
  return errs;
}
