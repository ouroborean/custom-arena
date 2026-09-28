import { describe, expect, it } from 'vitest';
import { createMatch } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import {
  canInfuse,
  EQUIPMENT_SLOTS,
  pruneInfusions,
  resolveLoadout,
  toCharacterSpec,
  withItem,
  withoutItem,
  type CharacterRecord,
  type InfusionAssignment,
  type Loadout,
} from '../src/index.js';

const content = loadContentOrThrow();

// A Legendary-budget Warrior: Strike (Fire, locked), Smash, Titan, Charge, Shout.
const warrior = (rarity: CharacterRecord['rarity'] = 'legendary', count = 5): CharacterRecord => ({
  name: 'Test',
  classId: 'warrior',
  element: 'Fire',
  rarity,
  portraitId: 'warrior.fire.01',
  skills: [
    { base: 'strike', infusion: 'Fire', source: 'native', locked: true },
    { base: 'smash', infusion: null, source: 'native', locked: false },
    { base: 'titan', infusion: null, source: 'native', locked: false },
    { base: 'charge', infusion: null, source: 'native', locked: false },
    { base: 'shout', infusion: null, source: 'native', locked: false },
  ].slice(0, count) as CharacterRecord['skills'],
});

const skillOf = (r: ReturnType<typeof resolveLoadout>, base: string) => r.skills.find((s) => s.base === base);
const of = (items: string[], infusions: InfusionAssignment[] = []): Loadout => ({ items: items.map((itemId) => ({ itemId })), infusions });
const has = (r: ReturnType<typeof resolveLoadout>, text: string) => r.problems.some((p) => p.includes(text));

describe('resolveLoadout', () => {
  it('an empty loadout keeps the native skills', () => {
    const r = resolveLoadout(content, warrior(), of([]));
    expect(r.problems).toEqual([]);
    expect(r.skills.map((s) => s.base)).toEqual(['strike', 'smash', 'titan', 'charge', 'shout']);
    expect(r.pool).toEqual({});
  });

  it("an item's infusions go into the pool; nothing is applied until the player puts them on skills", () => {
    const r = resolveLoadout(content, warrior(), of(['magma_hammer'])); // Smash + a Fire infusion + a passive
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'smash')?.infusion).toBeNull(); // not aimed at the item's own skill
    expect(r.pool).toEqual({ Fire: 1 });
    expect(r.unassigned).toEqual({ Fire: 1 });
    expect(r.usage).toEqual({ skills: 0, passives: 1, infusions: 0 });
    expect(r.passiveEffects).toEqual(['eq_magma_hammer']); // applied at match start

    const applied = resolveLoadout(content, warrior(), of(['magma_hammer'], [{ skill: 'titan', element: 'Fire' }]));
    expect(applied.problems).toEqual([]);
    expect(skillOf(applied, 'titan')?.infusion).toBe('Fire');
    expect(applied.unassigned).toEqual({});
    expect(applied.usage.infusions).toBe(1);
  });

  it('grants a missing skill when there is room, and pool infusions can go on it', () => {
    const r = resolveLoadout(content, warrior('legendary', 3), of(['trackers_shortbow', 'ice_shard'], [{ skill: 'shot', element: 'Ice' }]));
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'shot')).toMatchObject({ source: 'equipment', infusion: 'Ice' });
  });

  it('respects the 5-skill cap', () => {
    expect(has(resolveLoadout(content, warrior(), of(['trackers_shortbow'])), 'cap')).toBe(true);
  });

  it('checks assignments against the pool and the skills', () => {
    expect(has(resolveLoadout(content, warrior(), of([], [{ skill: 'smash', element: 'Ice' }])), 'More Ice infusions are applied than the equipment provides (0)')).toBe(
      true,
    );
    const twoFromOne = resolveLoadout(content, warrior(), of(['ice_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'titan', element: 'Ice' }]));
    expect(has(twoFromOne, 'provides (1)')).toBe(true);
    expect(has(resolveLoadout(content, warrior('legendary', 3), of(['ice_shard'], [{ skill: 'shot', element: 'Ice' }])), "isn't one of the character's skills")).toBe(true);
    // A crystal's two infusions can go on two different skills.
    const crystal = resolveLoadout(content, warrior(), of(['ice_crystal'], [{ skill: 'smash', element: 'Ice' }, { skill: 'titan', element: 'Ice' }]));
    expect(crystal.problems).toEqual([]);
  });

  it('a skill holds up to two infusions; two make their fusion element, which no skill has yet', () => {
    // Strike already has its locked native Fire: a second infusion would make Fire + Wind, Mechanic.
    const onLocked = resolveLoadout(content, warrior(), of(['wind_shard'], [{ skill: 'strike', element: 'Wind' }]));
    expect(onLocked.problems).toEqual(["Strike: Fire + Wind make Mechanic, and fusion elements aren't in the game yet"]);
    expect(skillOf(onLocked, 'strike')?.infusion).toBe('Fire'); // the native infusion stays
    const two = resolveLoadout(content, warrior(), of(['ice_shard', 'wind_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'smash', element: 'Wind' }]));
    expect(two.problems).toEqual(["Smash: Ice + Wind make Winter, and fusion elements aren't in the game yet"]);
    const three = resolveLoadout(
      content,
      warrior(),
      of(['ice_crystal', 'wind_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'smash', element: 'Ice' }, { skill: 'smash', element: 'Wind' }]),
    );
    expect(has(three, 'can hold 2 infusions')).toBe(true);
  });

  it('infusions have no budget', () => {
    // A Common with three equipment infusions applied (the old budget allowed two).
    const r = resolveLoadout(
      content,
      warrior('common', 3),
      of(['trackers_shortbow', 'ice_shard', 'fire_shard', 'wind_shard'], [
        { skill: 'smash', element: 'Ice' },
        { skill: 'titan', element: 'Fire' },
        { skill: 'shot', element: 'Wind' },
      ]),
    );
    expect(r.problems).toEqual([]);
    expect(r.usage.infusions).toBe(3);
  });

  it(`has ${EQUIPMENT_SLOTS} slots that take any item type; class armor stays with its class`, () => {
    // Two weapons, a two-handed one and a shard: any mix of types fits.
    const mixed = resolveLoadout(content, warrior('legendary', 3), of(['soldier_spear', 'soldier_greataxe', 'worn_blade', 'ice_shard']));
    expect(mixed.problems.filter((p) => p.includes('slot') || p.includes("doesn't fit"))).toEqual([]);
    expect(resolveLoadout(content, warrior(), of(Array(5).fill('ice_shard'))).problems).toContain('A character can equip 4 items (this has 5)');
    expect(has(resolveLoadout(content, warrior(), of(['hand_of_healing'])), 'Paladin armor')).toBe(true);
  });

  it('enforces the rarity budget for skills and passives', () => {
    // A Common can use 1 equipment skill: two J items granting new skills exceed it.
    expect(has(resolveLoadout(content, warrior('common', 3), of(['trackers_shortbow', 'marksmans_rifle'])), 'Equipment grants 2 skills')).toBe(true);
  });

  it('the resolved loadout makes a playable engine character', () => {
    const rec = warrior('legendary', 4);
    const r = resolveLoadout(
      content,
      rec,
      of(['magma_hammer', 'storm_chaser'], [
        { skill: 'smash', element: 'Fire' },
        { skill: 'charge', element: 'Lightning' },
        { skill: 'titan', element: 'Wind' },
      ]),
    );
    expect(r.problems).toEqual([]);
    const spec = toCharacterSpec(rec, r);
    expect(spec.skills).toEqual(['strike.fire', 'smash.fire', 'titan.wind', 'charge.lightning']);
    expect(spec.items).toEqual(['magma_hammer', 'storm_chaser']); // recorded for analytics
    const { state } = createMatch(content, { seed: 1, teams: [[spec], [spec]] });
    expect(state.units[0]!.skills.map((s) => s.defId)).toEqual(spec.skills);
  });
});

describe('fusion elements', () => {
  it('every pair of base elements makes one fusion, in either order', async () => {
    const { fusionOf } = await import('@arena/engine');
    const { infusedElement } = await import('../src/index.js');
    expect(Object.keys(content.fusions)).toHaveLength(55);
    expect(fusionOf(content, 'Fire', 'Ice')?.name).toBe('Apocalypse');
    expect(fusionOf(content, 'Ice', 'Fire')?.name).toBe('Apocalypse');
    expect(fusionOf(content, 'Fire', 'Fire')?.name).toBe('Dragon');
    expect(fusionOf(content, 'Shadow', 'Shadow')?.name).toBe('Dimension');
    expect(infusedElement(content, ['Holy', 'Unholy'])).toBe('Zealot');
    expect(infusedElement(content, ['Earth'])).toBe('Earth');
    expect(infusedElement(content, [])).toBeNull();
    const elements = ['Fire', 'Ice', 'Water', 'Lightning', 'Wind', 'Poison', 'Earth', 'Holy', 'Unholy', 'Shadow'];
    const names = new Set(elements.flatMap((a) => elements.map((b) => fusionOf(content, a, b)?.name)));
    expect(names.size).toBe(55);
    expect(names.has(undefined)).toBe(false);
  });
});

describe('editing a loadout', () => {
  it('withItem fills the next free slot or replaces one; removing an item drops the infusions it supplied', () => {
    const rec = warrior('legendary', 4);
    const one = withItem(content, rec, of([]), { itemId: 'ice_shard', instanceId: 'a' });
    expect(one).toEqual({ items: [{ itemId: 'ice_shard', instanceId: 'a' }], infusions: [] }); // nothing applied by itself
    const two = withItem(content, rec, { ...one, infusions: [{ skill: 'smash', element: 'Ice' }] }, { itemId: 'fire_shard' });
    expect(two.infusions).toEqual([{ skill: 'smash', element: 'Ice' }]);
    const replaced = withItem(content, rec, two, { itemId: 'wind_shard' }, 0); // the Ice shard goes, and its infusion
    expect(replaced).toEqual({ items: [{ itemId: 'wind_shard' }, { itemId: 'fire_shard' }], infusions: [] });
    const granted: Loadout = { items: [{ itemId: 'trackers_shortbow' }, { itemId: 'ice_shard' }], infusions: [{ skill: 'shot', element: 'Ice' }] };
    expect(withoutItem(content, warrior('legendary', 3), granted, 0).infusions).toEqual([]); // Shot left with its item
    expect(pruneInfusions(content, rec, of(['ice_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'titan', element: 'Ice' }])).infusions).toEqual([
      { skill: 'smash', element: 'Ice' },
    ]);
  });

  it('canInfuse: the pool has one left, the skill has room, and the result exists', () => {
    const rec = warrior();
    const l = of(['ice_shard']);
    expect(canInfuse(content, rec, l, 'smash', 'Ice')).toBe(true);
    expect(canInfuse(content, rec, l, 'smash', 'Fire')).toBe(false); // none in the pool
    expect(canInfuse(content, rec, l, 'strike', 'Ice')).toBe(false); // would be Apocalypse (Fire + Ice): no such skill yet
    expect(canInfuse(content, rec, { ...l, infusions: [{ skill: 'titan', element: 'Ice' }] }, 'smash', 'Ice')).toBe(false); // used up
  });
});

describe('randomLoadout', () => {
  it('builds loadouts the resolver accepts, usually with equipment and applied infusions', async () => {
    const { rollCharacter, randomLoadout } = await import('../src/index.js');
    const { seedRng } = await import('@arena/engine');
    let equipped = 0;
    let infused = 0;
    for (let s = 1; s <= 60; s++) {
      const rng = seedRng(s);
      const { character } = rollCharacter(content, rng);
      const loadout = randomLoadout(content, character, rng);
      const r = resolveLoadout(content, character, loadout);
      expect(r.problems).toEqual([]);
      if (loadout.items.length > 0) equipped++;
      if (loadout.infusions.length > 0) infused++;
      expect(loadout.items.length).toBeLessThanOrEqual(EQUIPMENT_SLOTS);
      // The team spec is valid engine input.
      createMatch(content, { seed: s, teams: [[toCharacterSpec(character, r)], [toCharacterSpec(character, r)]] });
    }
    expect(equipped).toBeGreaterThan(50);
    expect(infused).toBeGreaterThan(30);
  });
});
