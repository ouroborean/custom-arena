// Infused Recruits (decided 2026-10-09): the chosen class and element, a Tier 2 class-skill piece with a
// shard of the element, a Tier 1 class skill item and two shards, never the character's own skills,
// with every infusion placed.

import { describePiece, seedRng } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { describe, expect, it } from 'vitest';
import { autoInfuse, EMPTY_LOADOUT, infusedRecruitKit, resolveLoadout, rollableClasses, rollableElements, rollCharacter, withItem } from '../src/index.js';

const content = loadContentOrThrow();

describe('Infused Recruits', () => {
  it('recruit the chosen class and element, equipped with a legal, fully infused kit', () => {
    for (const cls of rollableClasses(content)) {
      for (const element of rollableElements(content)) {
        for (let seed = 1; seed <= 3; seed++) {
          const { character } = rollCharacter(content, seedRng(seed * 97), { classId: cls.id, element });
          expect(character.classId).toBe(cls.id);
          expect(character.element).toBe(element);

          const kit = infusedRecruitKit(content, character, seedRng(seed));
          const [forged, single, shardA, shardB] = kit.map((id) => describePiece(content, id)!);
          // Tier 2 = a class skill + a shard of the element; Tier 1 = a class skill; then two shards.
          expect(forged!.components).toHaveLength(2);
          expect(forged!.infusions.map((i) => i.element)).toEqual([element]);
          expect(single!.components).toHaveLength(1);
          expect(single!.skills).toHaveLength(1);
          for (const shard of [shardA!, shardB!]) {
            expect(shard.skills).toEqual([]);
            expect(shard.infusions.map((i) => i.element)).toEqual([element]);
          }
          const granted = [...forged!.skills, ...single!.skills];
          const pool = [...cls.signatures, ...cls.affinity];
          const native = character.skills.map((s) => s.base);
          expect(new Set(granted).size).toBe(2);
          for (const g of granted) {
            expect(pool).toContain(g);
            expect(native).not.toContain(g);
          }

          let loadout = EMPTY_LOADOUT;
          for (const itemId of kit) loadout = withItem(content, character, loadout, { itemId });
          loadout = autoInfuse(content, character, loadout);
          const r = resolveLoadout(content, character, loadout);
          expect(r.problems, `${cls.id} ${element}`).toEqual([]);
          expect(r.skills.map((s) => s.base).sort()).toEqual([...native, ...granted].sort());
          expect(r.unassigned).toEqual({});
          // One infusion of the element on each of the four skills.
          expect(r.skills.every((s) => s.infusion === element)).toBe(true);
        }
      }
    }
  });

  it('refuse a class or element that cannot be recruited', () => {
    expect(() => rollCharacter(content, seedRng(1), { classId: 'nonsense' })).toThrow();
    expect(() => rollCharacter(content, seedRng(1), { element: 'Dragon' })).toThrow();
  });
});
