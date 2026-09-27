// Equipment loadouts (GDD §7.3, §8): four slots that take any item, skill/infusion/passive grants,
// budgets, and resolution into the character's effective skill list. Validated on save and again at
// match start.

import { nextInt, variantId, type ContentBundle, type ItemDef, type ItemType, type RngState } from '@arena/engine';
import type { CharacterRecord, CharacterSkill } from './character.js';
import { MAX_SKILLS, RARITIES } from './rarity.js';

/** Items a character can have equipped at once, of any types (GDD §8.3, decided 2026-09-27). */
export const EQUIPMENT_SLOTS = 4;

export interface EquippedItem {
  /** Content item id. */
  itemId: string;
  /** Inventory instance, when it comes from a player's inventory. */
  instanceId?: string;
  /**
   * Per infusion (same order as the item's `infusions`): the base skill to infuse, for infusions
   * the player chooses. Entries for fixed-target infusions are ignored (use `null` there).
   */
  targets?: (string | null)[];
  /** Indexes of infusions to leave unused (e.g. to resolve a conflict). */
  unused?: number[];
}

export interface Loadout {
  /** Up to EQUIPMENT_SLOTS items, in slot order. */
  items: EquippedItem[];
}

export const EMPTY_LOADOUT: Loadout = { items: [] };

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
  /** Native skills plus equipment-granted ones, with every active infusion applied. */
  skills: CharacterSkill[];
  /** Items whose passives count against the budget. */
  passiveItems: string[];
  /** Status ids of implemented passives, applied at match start. */
  passiveEffects: string[];
  /** Every equipped item id (records and analytics). */
  items: string[];
  usage: { skills: number; passives: number; infusions: number };
  problems: string[];
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

  // Infusions: one per skill; locked default infusions can't be replaced (R8).
  const infusedBy = new Map<string, string>();
  for (const { eq, def } of items) {
    def.infusions.forEach((inf, i) => {
      if (eq.unused?.includes(i)) return; // left unused on purpose
      const target = inf.target ?? eq.targets?.[i];
      if (!target) {
        problems.push(`Choose a skill for ${def.name}'s ${inf.element} infusion`);
        return;
      }
      const skill = skills.find((s) => s.base === target);
      if (!skill) {
        problems.push(`${def.name} infuses ${target}, which the character doesn't have`);
        return;
      }
      if (skill.locked) {
        problems.push(`${target} has a locked ${skill.infusion} infusion; ${def.name}'s ${inf.element} can't replace it`);
        return;
      }
      const other = infusedBy.get(target);
      if (other) {
        problems.push(`${target} is already infused by ${other}; pick which item applies (one infusion per skill)`);
        return;
      }
      if (!content.skills[variantId(target, inf.element)]) {
        problems.push(`There's no ${inf.element} version of ${target}`);
        return;
      }
      skill.infusion = inf.element;
      infusedBy.set(target, def.name);
      usage.infusions++;
    });
  }

  for (const { def } of items) {
    if (!def.passive) continue;
    passiveItems.push(def.id);
    usage.passives++;
    if (def.passiveEffect) passiveEffects.push(def.passiveEffect);
  }

  const b = rarity.budget;
  if (usage.skills > b.skills) problems.push(`Equipment grants ${usage.skills} skills; ${rarity.name} characters can use ${b.skills}`);
  if (usage.passives > b.passives) problems.push(`${usage.passives} item passives; ${rarity.name} characters can use ${b.passives}`);
  if (usage.infusions > b.infusions) problems.push(`${usage.infusions} equipment infusions; ${rarity.name} characters can use ${b.infusions}`);

  return { skills, passiveItems, passiveEffects, items: items.map((i) => i.def.id), usage, problems };
}

/**
 * Targets for an item's player-chosen infusions when it joins `loadout`: for each, a skill that can
 * take it (not locked, not already infused, has that element's variant), counting the skills the
 * item itself grants. `choose` picks among the candidates (default: the first, in skill order).
 */
export function infusionTargets(
  content: ContentBundle,
  record: CharacterRecord,
  loadout: Loadout,
  def: ItemDef,
  choose: (candidates: string[]) => string | undefined = (c) => c[0],
): (string | null)[] | undefined {
  if (def.infusions.every((inf) => inf.target)) return undefined;
  const now = resolveLoadout(content, record, loadout).skills;
  const bases = [...new Set([...now.map((s) => s.base), ...def.skills])];
  const fixed = new Set(def.infusions.flatMap((inf) => (inf.target ? [inf.target] : [])));
  const taken = new Set<string>(fixed);
  return def.infusions.map((inf) => {
    if (inf.target) return null;
    const ok = bases.filter((b) => {
      const s = now.find((x) => x.base === b);
      return !taken.has(b) && !s?.locked && !s?.infusion && !!content.skills[variantId(b, inf.element)];
    });
    const pick = choose(ok) ?? null;
    if (pick) taken.add(pick);
    return pick;
  });
}

/**
 * `loadout` with an item added (at `slot`, replacing what's there, or in the next free slot). Its
 * chosen infusions are aimed at skills that can take them; one that no skill can take is marked unused.
 */
export function withItem(
  content: ContentBundle,
  record: CharacterRecord,
  loadout: Loadout,
  item: { itemId: string; instanceId?: string },
  slot?: number,
): Loadout {
  const def = content.items[item.itemId];
  const items = [...(loadout.items ?? [])];
  const at = slot !== undefined && slot < items.length ? slot : items.length;
  const rest = { items: items.filter((_, i) => i !== at) };
  const targets = def ? infusionTargets(content, record, rest, def) : undefined;
  const unused = targets?.flatMap((t, i) => (t === null && !def!.infusions[i]!.target ? [i] : [])) ?? [];
  const eq: EquippedItem = { ...item, ...(targets ? { targets } : {}), ...(unused.length ? { unused } : {}) };
  items.splice(at, at < items.length ? 1 : 0, eq);
  return { items };
}

/**
 * A random loadout the resolver accepts (balance simulations, bots): random items for this class
 * are tried one by one, each kept when the loadout stays valid, until the slots are full or the
 * tries run out. Chosen infusions go to random eligible skills.
 */
export function randomLoadout(content: ContentBundle, record: CharacterRecord, rng: RngState, triesPerSlot = 8): Loadout {
  const pool = Object.values(content.items)
    .filter((i) => !i.classId || i.classId === record.classId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  let loadout: Loadout = { items: [] };
  for (let t = 0; t < EQUIPMENT_SLOTS * triesPerSlot && loadout.items.length < EQUIPMENT_SLOTS; t++) {
    const def = pool[nextInt(rng, pool.length)];
    if (!def) break;
    const targets = infusionTargets(content, record, loadout, def, (c) => c[nextInt(rng, Math.max(1, c.length))]);
    const next: Loadout = { items: [...loadout.items, { itemId: def.id, ...(targets ? { targets } : {}) }] };
    if (resolveLoadout(content, record, next).problems.length === 0) loadout = next;
  }
  return loadout;
}
