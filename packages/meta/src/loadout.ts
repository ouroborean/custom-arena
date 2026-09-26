// Equipment loadouts (GDD §7.3, §8): slot layout, skill/infusion/passive grants, budgets, and
// resolution into the character's effective skill list. Validated on save and again at match start.

import { variantId, type ContentBundle, type ItemDef, type ItemType } from '@arena/engine';
import type { CharacterRecord, CharacterSkill } from './character.js';
import { MAX_SKILLS, RARITIES } from './rarity.js';

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
  mainHand?: EquippedItem;
  offHand?: EquippedItem;
  /** Replaces both hands. */
  twoHanded?: EquippedItem;
  body?: EquippedItem;
  /** Up to the rarity's equipment slots. */
  accessories?: EquippedItem[];
  /** Crystals and shards; up to the rarity's free sockets. */
  sockets?: EquippedItem[];
}

/** Which item types each slot accepts (GDD §8.3). */
export const SLOT_TYPES: Record<'mainHand' | 'offHand' | 'twoHanded' | 'body' | 'accessory' | 'socket', readonly ItemType[]> = {
  mainHand: ['A', 'C', 'D'],
  offHand: ['E'],
  twoHanded: ['B'],
  body: ['F', 'G'],
  accessory: ['H', 'J', 'L'],
  socket: ['I', 'K'],
};

export interface ResolvedLoadout {
  /** Native skills plus equipment-granted ones, with every active infusion applied. */
  skills: CharacterSkill[];
  /** Items whose passives count against the budget. */
  passiveItems: string[];
  /** Status ids of implemented passives, applied at match start. */
  passiveEffects: string[];
  usage: { skills: number; passives: number; infusions: number };
  problems: string[];
}

type SlotKey = keyof typeof SLOT_TYPES;

/** Every equipped item with the slot it sits in, in resolution order. */
export function equippedItems(l: Loadout): { slot: SlotKey; eq: EquippedItem }[] {
  const out: { slot: SlotKey; eq: EquippedItem }[] = [];
  if (l.twoHanded) out.push({ slot: 'twoHanded', eq: l.twoHanded });
  if (l.mainHand) out.push({ slot: 'mainHand', eq: l.mainHand });
  if (l.offHand) out.push({ slot: 'offHand', eq: l.offHand });
  if (l.body) out.push({ slot: 'body', eq: l.body });
  for (const eq of l.accessories ?? []) out.push({ slot: 'accessory', eq });
  for (const eq of l.sockets ?? []) out.push({ slot: 'socket', eq });
  return out;
}

export function resolveLoadout(content: ContentBundle, record: CharacterRecord, loadout: Loadout): ResolvedLoadout {
  const problems: string[] = [];
  const rarity = RARITIES[record.rarity];
  const skills: CharacterSkill[] = record.skills.filter((s) => s.source === 'native').map((s) => ({ ...s }));
  const usage = { skills: 0, passives: 0, infusions: 0 };
  const passiveItems: string[] = [];
  const passiveEffects: string[] = [];

  // Slot layout.
  if (loadout.twoHanded && (loadout.mainHand || loadout.offHand)) problems.push('A two-handed item uses both hands');
  const accessories = loadout.accessories ?? [];
  const sockets = loadout.sockets ?? [];
  if (accessories.length > rarity.equipmentSlots) problems.push(`${rarity.name} characters have ${rarity.equipmentSlots} accessory slots`);
  if (sockets.length > rarity.freeSockets) problems.push(`${rarity.name} characters have ${rarity.freeSockets} crystal sockets`);

  const items: { slot: SlotKey; eq: EquippedItem; def: ItemDef }[] = [];
  const instances = new Set<string>();
  for (const { slot, eq } of equippedItems(loadout)) {
    const def = content.items[eq.itemId];
    if (!def) {
      problems.push(`Unknown item "${eq.itemId}"`);
      continue;
    }
    if (!SLOT_TYPES[slot].includes(def.type)) problems.push(`${def.name} (type ${def.type}) doesn't fit the ${slot} slot`);
    if (def.classId && def.classId !== record.classId) problems.push(`${def.name} is ${content.classes[def.classId]?.name ?? def.classId} armor`);
    if (eq.instanceId) {
      if (instances.has(eq.instanceId)) problems.push(`${def.name} is equipped twice`);
      instances.add(eq.instanceId);
    }
    items.push({ slot, eq, def });
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

  return { skills, passiveItems, passiveEffects, usage, problems };
}
