// Equipment loadouts (GDD §7.3, §8): four slots that take any piece of equipment (one component or up
// to 3 forged together, docs/equipment.md §6), the pool of elemental infusions the pieces provide, the
// player's choice of which skills those infusions go on, budgets, and resolution into the character's
// effective skill list. Validated on save and again at match start.

import {
  describePiece,
  fusionOf,
  nextInt,
  pieceId,
  pieceProblems,
  PIECE_MAX_COMPONENTS,
  variantId,
  type ContentBundle,
  type ItemType,
  type PieceDef,
  type RngState,
} from '@arena/engine';
import type { CharacterRecord, CharacterSkill } from './character.js';
import { MAX_SKILLS, NATIVE_INFUSIONS, PASSIVE_BUDGET } from './rules.js';

/** Pieces a character can have equipped at once, of any kind (GDD §8.3, decided 2026-09-27). */
export const EQUIPMENT_SLOTS = 4;

/**
 * Infusions one skill can hold, counting a locked native one (GDD §7.3). Two make the pair's fusion
 * element (content `fusions`), and the skill becomes its fusion version (strike.dragon for Fire + Fire).
 */
export const MAX_INFUSIONS_PER_SKILL = 2;

export interface EquippedItem {
  /** Piece id: a component id, or forged components' ids joined with "+" (@arena/engine `pieceId`). */
  itemId: string;
  /** Inventory instance, when it comes from a player's inventory. */
  instanceId?: string;
}

/** One infusion from the equipment pool, applied to one of the character's skills. */
export interface InfusionAssignment {
  /** Base skill id. */
  skill: string;
  element: string;
}

export interface Loadout {
  /** Up to EQUIPMENT_SLOTS items, in slot order. */
  items: EquippedItem[];
  /**
   * Which skills the pool's infusions go on. The items only supply elements: nothing is applied
   * until the player assigns it, and an element can go on any skill that has a version in it.
   */
  infusions: InfusionAssignment[];
  /**
   * Which equipment-granted skills are prepared (base ids, in order). The pieces put their skills in a
   * pool; only prepared ones join the character's skills, within the 5-skill cap. Absent on loadouts saved before the pool: every granted skill is prepared.
   */
  skills?: string[];
}

export const EMPTY_LOADOUT: Loadout = { items: [], infusions: [], skills: [] };

/** What a piece is, for display and filters: its one component's type, or Forged. */
export type PieceKind = ItemType | 'Forged';

export const PIECE_KIND_NAMES: Record<PieceKind, string> = {
  Forged: 'Forged',
  Skill: 'Skill',
  Shard: 'Shard',
  Sigil: 'Sigil',
};

export function pieceKind(piece: PieceDef): PieceKind {
  return piece.components.length === 1 ? piece.components[0]!.type : 'Forged';
}

export interface ResolvedLoadout {
  /** Native skills plus prepared equipment-granted ones, with every applied infusion. */
  skills: CharacterSkill[];
  /** Skills the equipment grants that the character lacks natively (base ids, prepared or not). */
  skillPool: string[];
  /** Pool skills that aren't prepared (they stay out of battle). */
  unprepared: string[];
  /** Pieces whose passives count against the budget. */
  passiveItems: string[];
  /** Status ids of implemented passives, applied at match start. */
  passiveEffects: string[];
  /** Every equipped piece id (records and analytics). */
  items: string[];
  /** Infusions in the pool, by element: the base element's native one plus the equipment's. */
  pool: Record<string, number>;
  /** Pool infusions not applied to any skill, by element (only elements with some left). */
  unassigned: Record<string, number>;
  usage: { skills: number; passives: number; infusions: number };
  problems: string[];
}

/** The element a skill takes with these infusions: none, the one element, or the pair's fusion. */
export function infusedElement(content: ContentBundle, elements: readonly string[]): string | null | undefined {
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0]!;
  return elements.length === 2 ? fusionOf(content, elements[0]!, elements[1]!)?.name : undefined;
}

/**
 * The skill def id for a base skill with these infusions, or undefined when the game has none. One
 * infusion gives the element's variant; two give the variant of their fusion element (strike.dragon
 * for Fire + Fire).
 */
export function infusedSkillId(content: ContentBundle, base: string, elements: readonly string[]): string | undefined {
  const element = infusedElement(content, elements);
  if (element === undefined) return undefined;
  const id = element === null ? base : variantId(base, element);
  return content.skills[id] ? id : undefined;
}

/** The character's infusion pool: its base element's native infusion, plus the elements every equipped piece adds. */
export function infusionPool(content: ContentBundle, record: CharacterRecord, items: readonly EquippedItem[]): Record<string, number> {
  const pool: Record<string, number> = {};
  if (record.element && record.element !== 'None') pool[record.element] = NATIVE_INFUSIONS;
  for (const eq of items) for (const inf of describePiece(content, eq.itemId)?.infusions ?? []) pool[inf.element] = (pool[inf.element] ?? 0) + 1;
  return pool;
}

export function resolveLoadout(content: ContentBundle, record: CharacterRecord, loadout: Loadout): ResolvedLoadout {
  const problems: string[] = [];
  const skills: CharacterSkill[] = record.skills.filter((s) => s.source === 'native').map((s) => ({ ...s }));
  const usage = { skills: 0, passives: 0, infusions: 0 };
  const passiveItems: string[] = [];
  const passiveEffects: string[] = [];
  const equipped = loadout.items ?? [];

  if (equipped.length > EQUIPMENT_SLOTS) problems.push(`A character can equip ${EQUIPMENT_SLOTS} items (this has ${equipped.length})`);

  const items: { eq: EquippedItem; def: PieceDef }[] = [];
  const instances = new Set<string>();
  for (const eq of equipped) {
    const def = describePiece(content, eq.itemId);
    if (!def) {
      problems.push(`Unknown item "${eq.itemId}"`);
      continue;
    }
    if (eq.instanceId) {
      if (instances.has(eq.instanceId)) problems.push(`${def.name} is equipped twice`);
      instances.add(eq.instanceId);
    }
    items.push({ eq, def });
  }

  // Skill grants go into a pool (a skill the character already has adds nothing); the player prepares
  // the ones that go into battle.
  const skillPool: string[] = [];
  for (const { def } of items) {
    for (const base of def.skills) if (!skills.some((s) => s.base === base) && !skillPool.includes(base)) skillPool.push(base);
  }
  for (const base of loadout.skills ?? skillPool) {
    const name = content.skills[base]?.name ?? base;
    if (skills.some((s) => s.base === base)) {
      problems.push(skillPool.includes(base) ? `${name} is prepared twice` : `${name} is already one of the character's skills`);
      continue;
    }
    if (!skillPool.includes(base)) {
      problems.push(`${name} is prepared, but no equipped piece grants it`);
      continue;
    }
    skills.push({ base, infusion: null, source: 'equipment', locked: false });
    usage.skills++;
  }
  const unprepared = skillPool.filter((base) => !skills.some((s) => s.base === base));
  if (skills.length > MAX_SKILLS) problems.push(`Too many skills (${skills.length}; the cap is ${MAX_SKILLS})`);

  // Infusions: the base element and the pieces supply elements; the player puts each on a skill.
  const pool = infusionPool(content, record, items.map((i) => i.eq));
  const used: Record<string, number> = {};
  const added = new Map<string, string[]>();
  const over = new Set<string>();
  for (const a of loadout.infusions ?? []) {
    const skill = skills.find((s) => s.base === a.skill);
    const skillName = content.skills[a.skill]?.name ?? a.skill;
    if (!skill) {
      problems.push(`${skillName} has a ${a.element} infusion but isn't one of the character's skills`);
      continue;
    }
    used[a.element] = (used[a.element] ?? 0) + 1;
    if (used[a.element]! > (pool[a.element] ?? 0)) {
      if (!over.has(a.element)) problems.push(`More ${a.element} infusions are applied than the equipment provides (${pool[a.element] ?? 0})`);
      over.add(a.element);
      continue;
    }
    const list = added.get(a.skill) ?? [];
    const held = (skill.infusion ? 1 : 0) + list.length;
    if (held >= MAX_INFUSIONS_PER_SKILL) {
      problems.push(`${skillName} can hold ${MAX_INFUSIONS_PER_SKILL} infusions`);
      continue;
    }
    list.push(a.element);
    added.set(a.skill, list);
  }
  for (const [base, extra] of added) {
    const skill = skills.find((s) => s.base === base)!;
    const elements = [...(skill.infusion ? [skill.infusion] : []), ...extra];
    const name = content.skills[base]?.name ?? base;
    if (!infusedSkillId(content, base, elements)) {
      const fusion = elements.length > 1 ? infusedElement(content, elements) : undefined;
      problems.push(
        elements.length === 1
          ? `There's no ${elements[0]} version of ${name}`
          : fusion
            ? `${name}: ${elements.join(' + ')} make ${fusion}, and there's no ${fusion} version of it`
            : `${name}: ${elements.join(' + ')} don't make a fusion element`,
      );
      continue;
    }
    skill.infusion = infusedElement(content, elements)!;
    usage.infusions += extra.length;
  }
  const unassigned: Record<string, number> = {};
  for (const [el, n] of Object.entries(pool)) if (n > (used[el] ?? 0)) unassigned[el] = n - (used[el] ?? 0);

  for (const { def } of items) {
    if (!def.passive) continue;
    passiveItems.push(def.id);
    usage.passives++;
    if (def.passiveEffect) passiveEffects.push(def.passiveEffect);
  }

  if (usage.passives > PASSIVE_BUDGET) problems.push(`${usage.passives} item passives; a character can use ${PASSIVE_BUDGET}`);

  return { skills, skillPool, unprepared, passiveItems, passiveEffects, items: items.map((i) => i.def.id), pool, unassigned, usage, problems };
}

/**
 * Whether one more `element` infusion can go on `base` in this loadout: the pool has one left, the
 * skill has room, and the game has the resulting skill (its element version, or with a second
 * infusion its fusion version).
 */
export function canInfuse(content: ContentBundle, record: CharacterRecord, loadout: Loadout, base: string, element: string): boolean {
  const r = resolveLoadout(content, record, loadout);
  if (!r.unassigned[element] || !r.skills.some((s) => s.base === base)) return false;
  // Count what the skill holds from the record and the assignments: the resolved skill only shows the
  // element they make (two infusions resolve to one fusion name).
  const native = record.skills.find((s) => s.base === base && s.source === 'native')?.infusion;
  const held = (loadout.infusions ?? []).filter((a) => a.skill === base).map((a) => a.element);
  const elements = [...(native ? [native] : []), ...held, element];
  return elements.length <= MAX_INFUSIONS_PER_SKILL && !!infusedSkillId(content, base, elements);
}

/** Base ids of the skills these pieces grant that the character lacks natively, in slot order. */
export function skillPoolOf(content: ContentBundle, record: CharacterRecord, items: readonly EquippedItem[]): string[] {
  const native = new Set(record.skills.filter((s) => s.source === 'native').map((s) => s.base));
  const out: string[] = [];
  for (const eq of items) for (const base of describePiece(content, eq.itemId)?.skills ?? []) if (!native.has(base) && !out.includes(base)) out.push(base);
  return out;
}

/** The prepared skills, made explicit (a loadout from before the skill pool prepares all of them). */
const preparedOf = (content: ContentBundle, record: CharacterRecord, loadout: Loadout) => loadout.skills ?? skillPoolOf(content, record, loadout.items ?? []);

/**
 * Drops what no longer holds: prepared skills no equipped piece grants, and infusion assignments whose
 * skill is gone or whose element the pool no longer has.
 */
export function pruneInfusions(content: ContentBundle, record: CharacterRecord, loadout: Loadout): Loadout {
  const grantable = skillPoolOf(content, record, loadout.items);
  const skills = preparedOf(content, record, loadout).filter((b, i, all) => grantable.includes(b) && all.indexOf(b) === i);
  const bases = new Set(resolveLoadout(content, record, { items: loadout.items, infusions: [], skills }).skills.map((s) => s.base));
  const left = infusionPool(content, record, loadout.items);
  const infusions = (loadout.infusions ?? []).filter((a) => {
    if (!bases.has(a.skill) || !left[a.element]) return false;
    left[a.element]!--;
    return true;
  });
  return { items: loadout.items, infusions, skills };
}

/**
 * Whether one more pool skill can be prepared: it's granted and unprepared, and preparing it breaks no
 * rule the loadout keeps now (the 5-skill cap).
 */
export function canPrepare(content: ContentBundle, record: CharacterRecord, loadout: Loadout, base: string): boolean {
  const before = resolveLoadout(content, record, loadout);
  if (!before.unprepared.includes(base)) return false;
  const after = resolveLoadout(content, record, prepareSkill(content, record, loadout, base));
  return after.problems.every((p) => before.problems.includes(p));
}

/** `loadout` with a pool skill prepared. */
export function prepareSkill(content: ContentBundle, record: CharacterRecord, loadout: Loadout, base: string): Loadout {
  const skills = preparedOf(content, record, loadout);
  return skills.includes(base) ? { ...loadout, skills } : { ...loadout, skills: [...skills, base] };
}

/** `loadout` with a skill unprepared (back in the pool), and without the infusions it held. */
export function unprepareSkill(content: ContentBundle, record: CharacterRecord, loadout: Loadout, base: string): Loadout {
  return pruneInfusions(content, record, { ...loadout, skills: preparedOf(content, record, loadout).filter((b) => b !== base) });
}

/**
 * `loadout` with an item added (at `slot`, replacing what's there, or in the next free slot). Skills the
 * new piece adds to the pool are prepared when they fit; the rest wait in the pool.
 */
export function withItem(
  content: ContentBundle,
  record: CharacterRecord,
  loadout: Loadout,
  item: EquippedItem,
  slot?: number,
): Loadout {
  const items = [...(loadout.items ?? [])];
  const at = slot !== undefined && slot < items.length ? slot : items.length;
  const poolBefore = skillPoolOf(content, record, items);
  items.splice(at, at < items.length ? 1 : 0, item);
  let next = pruneInfusions(content, record, { items, infusions: loadout.infusions ?? [], skills: preparedOf(content, record, loadout) });
  for (const base of skillPoolOf(content, record, items)) {
    if (!poolBefore.includes(base) && canPrepare(content, record, next, base)) next = prepareSkill(content, record, next, base);
  }
  return next;
}

/** `loadout` without the item in `slot` (and without the skills and infusions that depended on it). */
export function withoutItem(content: ContentBundle, record: CharacterRecord, loadout: Loadout, slot: number): Loadout {
  return pruneInfusions(content, record, { ...loadout, items: loadout.items.filter((_, i) => i !== slot), skills: preparedOf(content, record, loadout) });
}

/** A random legal piece of 1 to 3 components (simulations and tests). */
export function randomPiece(content: ContentBundle, rng: RngState, tries = 8): string | undefined {
  const pool = Object.keys(content.items).sort();
  for (let t = 0; t < tries && pool.length; t++) {
    const n = 1 + nextInt(rng, PIECE_MAX_COMPONENTS);
    const ids = Array.from({ length: n }, () => pool[nextInt(rng, pool.length)]!);
    if (pieceProblems(content, ids).length === 0) return pieceId(ids);
  }
  return undefined;
}

/**
 * A random loadout the resolver accepts (balance simulations, bots): random pieces are tried one by
 * one, each kept when the loadout stays valid, until the slots are full or the tries run out; pool
 * skills are prepared in a random order while they fit; then each pool infusion goes on a random skill
 * that can take it.
 */
export function randomLoadout(content: ContentBundle, record: CharacterRecord, rng: RngState, triesPerSlot = 8): Loadout {
  let loadout: Loadout = { items: [], infusions: [], skills: [] };
  for (let t = 0; t < EQUIPMENT_SLOTS * triesPerSlot && loadout.items.length < EQUIPMENT_SLOTS; t++) {
    const piece = randomPiece(content, rng);
    if (!piece) continue;
    const next: Loadout = { items: [...loadout.items, { itemId: piece }], infusions: [], skills: [] };
    if (resolveLoadout(content, record, next).problems.length === 0) loadout = next;
  }
  const pool = skillPoolOf(content, record, loadout.items);
  while (pool.length) {
    const base = pool.splice(nextInt(rng, pool.length), 1)[0]!;
    if (canPrepare(content, record, loadout, base)) loadout = prepareSkill(content, record, loadout, base);
  }
  const elements = Object.entries(infusionPool(content, record, loadout.items)).flatMap(([el, n]) => Array<string>(n).fill(el));
  for (const element of elements) {
    const skills = resolveLoadout(content, record, loadout).skills.filter((s) => canInfuse(content, record, loadout, s.base, element));
    const pick = skills[nextInt(rng, Math.max(1, skills.length))];
    if (pick) loadout = { ...loadout, infusions: [...loadout.infusions, { skill: pick.base, element }] };
  }
  return loadout;
}
