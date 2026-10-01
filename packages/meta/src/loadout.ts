// Equipment loadouts (GDD §7.3, §8): four slots that take any item, the pool of elemental infusions
// the items provide, the player's choice of which skills those infusions go on, budgets, and
// resolution into the character's effective skill list. Validated on save and again at match start.

import { fusionOf, nextInt, variantId, type ContentBundle, type ItemDef, type ItemType, type RngState } from '@arena/engine';
import type { CharacterRecord, CharacterSkill } from './character.js';
import { MAX_SKILLS, RARITIES } from './rarity.js';

/** Items a character can have equipped at once, of any types (GDD §8.3, decided 2026-09-27). */
export const EQUIPMENT_SLOTS = 4;

/**
 * Infusions one skill can hold, counting a locked native one (GDD §7.3). Two make the pair's fusion
 * element (content `fusions`), and the skill becomes its fusion version (strike.dragon for Fire + Fire).
 */
export const MAX_INFUSIONS_PER_SKILL = 2;

export interface EquippedItem {
  /** Content item id. */
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
}

export const EMPTY_LOADOUT: Loadout = { items: [], infusions: [] };

/** What each item type is, for display (the sheet's categories; any type fits any slot). */
export const ITEM_TYPE_NAMES: Record<ItemType, string> = {
  A: 'Weapon',
  B: 'Two-handed weapon',
  C: 'Exotic weapon',
  D: 'Elemental weapon',
  E: 'Off-hand',
  F: 'Elemental armor',
  G: 'Class armor',
  H: 'Charm',
  I: 'Perfect crystal',
  J: 'Skill trinket',
  K: 'Shard',
  L: 'Trinket',
};

export interface ResolvedLoadout {
  /** Native skills plus equipment-granted ones, with every applied infusion. */
  skills: CharacterSkill[];
  /** Items whose passives count against the budget. */
  passiveItems: string[];
  /** Status ids of implemented passives, applied at match start. */
  passiveEffects: string[];
  /** Every equipped item id (records and analytics). */
  items: string[];
  /** Infusions the equipment provides, by element. */
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

/** The elements every equipped item adds to the pool. */
export function infusionPool(content: ContentBundle, items: readonly EquippedItem[]): Record<string, number> {
  const pool: Record<string, number> = {};
  for (const eq of items) for (const inf of content.items[eq.itemId]?.infusions ?? []) pool[inf.element] = (pool[inf.element] ?? 0) + 1;
  return pool;
}

export function resolveLoadout(content: ContentBundle, record: CharacterRecord, loadout: Loadout): ResolvedLoadout {
  const problems: string[] = [];
  const rarity = RARITIES[record.rarity];
  const skills: CharacterSkill[] = record.skills.filter((s) => s.source === 'native').map((s) => ({ ...s }));
  const usage = { skills: 0, passives: 0, infusions: 0 };
  const passiveItems: string[] = [];
  const passiveEffects: string[] = [];
  const equipped = loadout.items ?? [];

  if (equipped.length > EQUIPMENT_SLOTS) problems.push(`A character can equip ${EQUIPMENT_SLOTS} items (this has ${equipped.length})`);

  const items: { eq: EquippedItem; def: ItemDef }[] = [];
  const instances = new Set<string>();
  for (const eq of equipped) {
    const def = content.items[eq.itemId];
    if (!def) {
      problems.push(`Unknown item "${eq.itemId}"`);
      continue;
    }
    if (def.classId && def.classId !== record.classId) problems.push(`${def.name} is ${content.classes[def.classId]?.name ?? def.classId} armor`);
    if (eq.instanceId) {
      if (instances.has(eq.instanceId)) problems.push(`${def.name} is equipped twice`);
      instances.add(eq.instanceId);
    }
    items.push({ eq, def });
  }

  // Skill grants: added when missing (a skill the character already has counts as granted).
  for (const { def } of items) {
    for (const base of def.skills) {
      if (skills.some((s) => s.base === base)) continue;
      skills.push({ base, infusion: null, source: 'equipment', locked: false });
      usage.skills++;
    }
  }
  if (skills.length > MAX_SKILLS) problems.push(`Too many skills (${skills.length}; the cap is ${MAX_SKILLS})`);

  // Infusions: the items supply elements; the player puts each on a skill.
  const pool = infusionPool(content, items.map((i) => i.eq));
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

  const b = rarity.budget;
  if (usage.skills > b.skills) problems.push(`Equipment grants ${usage.skills} skills; ${rarity.name} characters can use ${b.skills}`);
  if (usage.passives > b.passives) problems.push(`${usage.passives} item passives; ${rarity.name} characters can use ${b.passives}`);

  return { skills, passiveItems, passiveEffects, items: items.map((i) => i.def.id), pool, unassigned, usage, problems };
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

/** Drops assignments that no longer hold: their skill is gone, or the pool no longer has the element. */
export function pruneInfusions(content: ContentBundle, record: CharacterRecord, loadout: Loadout): Loadout {
  const bases = new Set(resolveLoadout(content, record, { items: loadout.items, infusions: [] }).skills.map((s) => s.base));
  const left = infusionPool(content, loadout.items);
  const infusions = (loadout.infusions ?? []).filter((a) => {
    if (!bases.has(a.skill) || !left[a.element]) return false;
    left[a.element]!--;
    return true;
  });
  return { items: loadout.items, infusions };
}

/** `loadout` with an item added (at `slot`, replacing what's there, or in the next free slot). */
export function withItem(
  content: ContentBundle,
  record: CharacterRecord,
  loadout: Loadout,
  item: EquippedItem,
  slot?: number,
): Loadout {
  const items = [...(loadout.items ?? [])];
  const at = slot !== undefined && slot < items.length ? slot : items.length;
  items.splice(at, at < items.length ? 1 : 0, item);
  return pruneInfusions(content, record, { items, infusions: loadout.infusions ?? [] });
}

/** `loadout` without the item in `slot` (and without infusions that depended on it). */
export function withoutItem(content: ContentBundle, record: CharacterRecord, loadout: Loadout, slot: number): Loadout {
  return pruneInfusions(content, record, { items: loadout.items.filter((_, i) => i !== slot), infusions: loadout.infusions ?? [] });
}

/**
 * A random loadout the resolver accepts (balance simulations, bots): random items for this class
 * are tried one by one, each kept when the loadout stays valid, until the slots are full or the
 * tries run out; then each pool infusion goes on a random skill that can take it.
 */
export function randomLoadout(content: ContentBundle, record: CharacterRecord, rng: RngState, triesPerSlot = 8): Loadout {
  const pool = Object.values(content.items)
    .filter((i) => !i.classId || i.classId === record.classId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  let loadout: Loadout = { items: [], infusions: [] };
  for (let t = 0; t < EQUIPMENT_SLOTS * triesPerSlot && loadout.items.length < EQUIPMENT_SLOTS; t++) {
    const def = pool[nextInt(rng, pool.length)];
    if (!def) break;
    const next: Loadout = { items: [...loadout.items, { itemId: def.id }], infusions: [] };
    if (resolveLoadout(content, record, next).problems.length === 0) loadout = next;
  }
  const elements = Object.entries(infusionPool(content, loadout.items)).flatMap(([el, n]) => Array<string>(n).fill(el));
  for (const element of elements) {
    const skills = resolveLoadout(content, record, loadout).skills.filter((s) => canInfuse(content, record, loadout, s.base, element));
    const pick = skills[nextInt(rng, Math.max(1, skills.length))];
    if (pick) loadout = { items: loadout.items, infusions: [...loadout.infusions, { skill: pick.base, element }] };
  }
  return loadout;
}
