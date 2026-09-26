import { describe, expect, it } from 'vitest';
import { createMatch, seedRng } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import {
  PITY,
  RARITIES,
  rarityAtLeast,
  rollCharacter,
  rollRarity,
  toCharacterSpec,
  validateCharacter,
  type CharacterRecord,
} from '../src/index.js';

const content = loadContentOrThrow();

describe('rollCharacter', () => {
  it('is deterministic for a seed', () => {
    const a = rollCharacter(content, seedRng(42));
    const b = rollCharacter(content, seedRng(42));
    expect(a).toEqual(b);
  });

  it('always produces a valid, playable character', () => {
    const rng = seedRng(7);
    for (let i = 0; i < 300; i++) {
      const { character: c } = rollCharacter(content, rng);
      expect(validateCharacter(content, c)).toEqual([]);
      const cls = content.classes[c.classId]!;
      const r = RARITIES[c.rarity];
      expect(c.skills).toHaveLength(r.nativeSkills);
      expect(c.skills.filter((s) => cls.signatures.includes(s.base)).length).toBeGreaterThanOrEqual(2);
      const locked = c.skills.filter((s) => s.locked);
      expect(locked.length).toBeGreaterThanOrEqual(r.defaultInfusions[0]);
      expect(locked.length).toBeLessThanOrEqual(r.defaultInfusions[1]);
      expect(locked.every((s) => s.infusion === c.element)).toBe(true);
    }
  });

  it('feeds the engine: three rolled characters make a match', () => {
    const rng = seedRng(3);
    const team = () => [0, 1, 2].map(() => toCharacterSpec(rollCharacter(content, rng).character));
    const { state } = createMatch(content, { seed: 1, teams: [team(), team()] });
    expect(state.units.filter((u) => u.kind === 'character')).toHaveLength(6);
  });

  it('favors classes the player owns fewer of', () => {
    const owned = Object.fromEntries(Object.keys(content.classes).map((id) => [id, 20]));
    owned.mage = 0;
    const rng = seedRng(11);
    let mages = 0;
    for (let i = 0; i < 400; i++) if (rollCharacter(content, rng, { ownedClassCounts: owned }).character.classId === 'mage') mages++;
    expect(mages).toBeGreaterThan(400 * 0.5); // weight 1200 vs 9 × 57
  });
});

describe('rarity', () => {
  it('rolls roughly by weight', () => {
    const rng = seedRng(5);
    const n = 20000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const r = rollRarity(rng);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts.common! / n).toBeGreaterThan(0.45);
    expect(counts.common! / n).toBeLessThan(0.55);
    expect(counts.legendary! / n).toBeLessThan(0.04);
  });

  it('pity: the threshold roll is at least the minimum, and the counter resets', () => {
    const rng = seedRng(9);
    for (let i = 0; i < 50; i++) expect(rarityAtLeast(rollRarity(rng, PITY.threshold - 1), PITY.minimum)).toBe(true);
    const r = rollCharacter(content, seedRng(1), { rollsSincePity: PITY.threshold - 1 });
    expect(r.rollsSincePity).toBe(0);
  });
});

describe('validateCharacter', () => {
  const base: CharacterRecord = {
    name: 'Test',
    classId: 'warrior',
    element: 'Fire',
    rarity: 'common',
    portraitId: 'warrior.fire.01',
    skills: [
      { base: 'strike', infusion: 'Fire', source: 'native', locked: true },
      { base: 'smash', infusion: null, source: 'native', locked: false },
      { base: 'titan', infusion: null, source: 'native', locked: false },
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
