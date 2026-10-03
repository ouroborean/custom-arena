// Recruiting characters (docs/meta.md §1, decided 2026-10-03): no rarity; every recruit has its
// class's starter skill, one more skill from the class pool, and its base element's infusion in its pool.

import { describe, expect, it } from 'vitest';
import { createMatch, seedRng } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import {
  infusionPool,
  NATIVE_SKILLS,
  resolveLoadout,
  rollableClasses,
  rollCharacter,
  toCharacterSpec,
  validateCharacter,
  type CharacterRecord,
} from '../src/index.js';

const content = loadContentOrThrow();
const STARTERS = {
  warrior: 'strike',
  rogue: 'stab',
  mage: 'bolt',
  priest: 'heal',
  paladin: 'cleave',
  ranger: 'shot',
  druid: 'companion',
  monk: 'smite',
  warlock: 'curse',
  knight: 'charge',
};

describe('rollCharacter', () => {
  it('is deterministic for a seed', () => {
    expect(rollCharacter(content, seedRng(42))).toEqual(rollCharacter(content, seedRng(42)));
  });

  it("recruits all ten classes, each with its starter", () => {
    expect(rollableClasses(content).map((c) => c.id).sort()).toEqual(Object.keys(STARTERS).sort());
    const rng = seedRng(4);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(rollCharacter(content, rng).character.classId);
    expect([...seen].sort()).toEqual(Object.keys(STARTERS).sort());
  });

  it("a recruit has its class's starter skill first, then one more from the class pool, none infused", () => {
    const rng = seedRng(7);
    for (let i = 0; i < 300; i++) {
      const { character: c } = rollCharacter(content, rng);
      expect(validateCharacter(content, c)).toEqual([]);
      const cls = content.classes[c.classId]!;
      expect(c.skills).toHaveLength(NATIVE_SKILLS);
      expect(c.skills[0]!.base).toBe(STARTERS[c.classId as keyof typeof STARTERS]);
      expect([...cls.signatures, ...cls.affinity]).toContain(c.skills[1]!.base);
      expect(c.skills[1]!.base).not.toBe(c.skills[0]!.base);
      expect(c.skills.every((s) => s.infusion === null && !s.locked && s.source === 'native')).toBe(true);
      expect(c).not.toHaveProperty('rarity');
    }
  });

  it("its base element's infusion waits in its pool, for the player to place", () => {
    const { character: c } = rollCharacter(content, seedRng(9));
    expect(infusionPool(content, c, [])).toEqual({ [c.element]: 1 });
    const r = resolveLoadout(content, c, { items: [], infusions: [], skills: [] });
    expect(r.unassigned).toEqual({ [c.element]: 1 });
    const placed = resolveLoadout(content, c, { items: [], infusions: [{ skill: c.skills[0]!.base, element: c.element }], skills: [] });
    expect(placed.problems).toEqual([]);
    expect(placed.skills[0]!.infusion).toBe(c.element);
  });

  it('feeds the engine: three recruits make a match', () => {
    const rng = seedRng(3);
    const team = () => [0, 1, 2].map(() => toCharacterSpec(rollCharacter(content, rng).character));
    const { state } = createMatch(content, { seed: 1, teams: [team(), team()] });
    expect(state.units.filter((u) => u.kind === 'character')).toHaveLength(6);
  });

  it('favors classes the player owns fewer of', () => {
    const owned = Object.fromEntries(rollableClasses(content).map((c) => [c.id, 20]));
    owned.mage = 0;
    const rng = seedRng(11);
    let mages = 0;
    for (let i = 0; i < 400; i++) if (rollCharacter(content, rng, { ownedClassCounts: owned }).character.classId === 'mage') mages++;
    expect(mages).toBeGreaterThan(400 * 0.5); // weight 1200 vs 5 × 57
  });
});

describe('validateCharacter', () => {
  const base: CharacterRecord = {
    name: 'Test',
    classId: 'warrior',
    element: 'Fire',
    portraitId: 'warrior.fire.01',
    skills: [
      { base: 'strike', infusion: null, source: 'native', locked: false },
      { base: 'smash', infusion: null, source: 'native', locked: false },
    ],
  };

  it('accepts a well-formed record', () => {
    expect(validateCharacter(content, base)).toEqual([]);
  });

  it('rejects skills outside the class pool, duplicates and bad locks', () => {
    const bad: CharacterRecord = {
      ...base,
      skills: [
        { base: 'shot', infusion: null, source: 'native', locked: false },
        { base: 'smash', infusion: null, source: 'native', locked: false },
        { base: 'smash', infusion: 'Ice', source: 'native', locked: true },
      ],
    };
    const errs = validateCharacter(content, bad);
    expect(errs.some((e) => e.includes('pool'))).toBe(true);
    expect(errs.some((e) => e.includes('duplicate'))).toBe(true);
    expect(errs.some((e) => e.includes('locked'))).toBe(true);
  });
});
