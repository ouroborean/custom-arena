// Infused Recruits (decided 2026-10-09): a gentler start. Every account has a few; each recruits a
// character of the class and element the player picks, already equipped: a Tier 2 piece (a class skill
// forged with a shard of its element), a Tier 1 skill item of its class, and two more shards of its
// element — with every infusion placed. The equipped skills are never the ones it was rolled with.

import { pieceId, sample, type ContentBundle, type RngState } from '@arena/engine';
import type { CharacterRecord } from './character.js';
import { canInfuse, resolveLoadout, type Loadout } from './loadout.js';

/** Infused Recruits every account starts with. */
export const INFUSED_RECRUITS_START = 3;

/** The Skill component that grants `base`. */
function skillItem(content: ContentBundle, base: string): string {
  const item = Object.values(content.items).find((i) => i.type === 'Skill' && i.skills?.length === 1 && i.skills[0] === base);
  if (!item) throw new Error(`No skill item grants "${base}"`);
  return item.id;
}

/** The Shard component of `element`. */
function shardOf(content: ContentBundle, element: string): string {
  const item = Object.values(content.items).find((i) => i.type === 'Shard' && i.infusions?.length === 1 && i.infusions[0]!.element === element);
  if (!item) throw new Error(`No shard of "${element}"`);
  return item.id;
}

/**
 * The pieces an Infused Recruit comes with, in slot order: [skill + shard, skill, shard, shard]. The
 * two skills are drawn from the class pool, never the character's own.
 */
export function infusedRecruitKit(content: ContentBundle, record: CharacterRecord, rng: RngState): string[] {
  const cls = content.classes[record.classId];
  if (!cls) throw new Error(`Unknown class "${record.classId}"`);
  const own = new Set(record.skills.map((s) => s.base));
  const spare = [...cls.signatures, ...cls.affinity].filter((b) => !own.has(b));
  const [forged, single] = sample(rng, spare, 2);
  if (!forged || !single) throw new Error(`${cls.name} has too few skills for an Infused Recruit`);
  const shard = shardOf(content, record.element);
  return [pieceId([skillItem(content, forged), shard]), skillItem(content, single), shard, shard];
}

/**
 * `loadout` with every unplaced infusion placed, spread so each goes on the skill holding the fewest
 * (natives first): a ready-to-play character the player can rearrange.
 */
export function autoInfuse(content: ContentBundle, record: CharacterRecord, loadout: Loadout): Loadout {
  let next: Loadout = { ...loadout, infusions: [...(loadout.infusions ?? [])] };
  for (let guard = 0; guard < 12; guard++) {
    const r = resolveLoadout(content, record, next);
    const element = Object.keys(r.unassigned).find((el) => (r.unassigned[el] ?? 0) > 0);
    if (!element) break;
    const held = (base: string) => next.infusions.filter((a) => a.skill === base).length;
    const target = [...r.skills]
      .sort((a, b) => held(a.base) - held(b.base))
      .find((s) => canInfuse(content, record, next, s.base, element));
    if (!target) break;
    next = { ...next, infusions: [...next.infusions, { skill: target.base, element }] };
  }
  return next;
}
