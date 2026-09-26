// Equipment loadouts (GDD §7.3, §8): slot layout, skill/infusion/passive grants, budgets, and
// resolution into the character's effective skill list. Validated on save and again at match start.

import { nextInt, sample, variantId, type ContentBundle, type ItemDef, type ItemType, type RngState } from '@arena/engine';
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

/**
 * A random loadout the resolver accepts (balance simulations, bots): slots are filled in a random
 * order, each with a random fitting item that keeps the loadout valid; chosen infusions go to
 * random eligible skills. Slots may stay empty when nothing fits the budget.
 */
export function randomLoadout(content: ContentBundle, record: CharacterRecord, rng: RngState, triesPerSlot = 8): Loadout {
  const rarity = RARITIES[record.rarity];
  const byType = (types: readonly ItemType[]) =>
    Object.values(content.items)
      .filter((i) => types.includes(i.type) && (!i.classId || i.classId === record.classId))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  type Slot = 'weapon' | 'offHand' | 'body' | 'accessory' | 'socket';
  const slots: Slot[] = sample(
    rng,
    ['weapon', 'offHand', 'body', ...Array<Slot>(rarity.equipmentSlots).fill('accessory'), ...Array<Slot>(rarity.freeSockets).fill('socket')],
    3 + rarity.equipmentSlots + rarity.freeSockets,
  );
  let loadout: Loadout = {};
  for (const slot of slots) {
    for (let t = 0; t < triesPerSlot; t++) {
      const twoHanded = slot === 'weapon' && nextInt(rng, 3) === 0;
      if (slot === 'offHand' && loadout.twoHanded) break;
      const pool = byType(
        slot === 'weapon' ? SLOT_TYPES[twoHanded ? 'twoHanded' : 'mainHand'] : slot === 'offHand' ? SLOT_TYPES.offHand : SLOT_TYPES[slot],
      );
      const def = pool[nextInt(rng, pool.length)];
      if (!def) break;
      const eq = equipWithTargets(content, record, loadout, def, rng);
      const next: Loadout =
        slot === 'weapon'
          ? twoHanded
            ? { ...withoutHands(loadout), twoHanded: eq }
            : { ...loadout, mainHand: eq }
          : slot === 'offHand'
            ? { ...loadout, offHand: eq }
            : slot === 'body'
              ? { ...loadout, body: eq }
              : slot === 'accessory'
                ? { ...loadout, accessories: [...(loadout.accessories ?? []), eq] }
                : { ...loadout, sockets: [...(loadout.sockets ?? []), eq] };
      if (slot === 'weapon' && twoHanded && (loadout.mainHand || loadout.offHand)) continue;
      if (resolveLoadout(content, record, next).problems.length === 0) {
        loadout = next;
        break;
      }
    }
  }
  return loadout;
}

function withoutHands(l: Loadout): Loadout {
  const { mainHand: _m, offHand: _o, ...rest } = l;
  return rest;
}

/** The item, with its player-chosen infusions aimed at random skills that can take them. */
function equipWithTargets(content: ContentBundle, record: CharacterRecord, current: Loadout, def: ItemDef, rng: RngState): EquippedItem {
  if (def.infusions.every((inf) => inf.target)) return { itemId: def.id };
  const now = resolveLoadout(content, record, current).skills;
  const bases = [...new Set([...now.map((s) => s.base), ...def.skills])];
  const taken = new Set<string>();
  const targets = def.infusions.map((inf) => {
    if (inf.target) return null;
    const ok = bases.filter((b) => {
      const s = now.find((x) => x.base === b);
      return !taken.has(b) && !s?.locked && !s?.infusion && !!content.skills[variantId(b, inf.element)];
    });
    const pick = ok[nextInt(rng, Math.max(1, ok.length))] ?? null;
    if (pick) taken.add(pick);
    return pick;
  });
  return { itemId: def.id, targets };
}
