import { describe, expect, it } from 'vitest';
import { createMatch } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { EQUIPMENT_SLOTS, resolveLoadout, toCharacterSpec, withItem, type CharacterRecord, type Loadout } from '../src/index.js';

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
const of = (...items: Loadout['items']): Loadout => ({ items });

describe('resolveLoadout', () => {
  it('an empty loadout keeps the native skills', () => {
    const r = resolveLoadout(content, warrior(), of());
    expect(r.problems).toEqual([]);
    expect(r.skills.map((s) => s.base)).toEqual(['strike', 'smash', 'titan', 'charge', 'shout']);
  });

  it('Type A: infuses its skill (the character already has it) and counts its passive', () => {
    const r = resolveLoadout(content, warrior(), of({ itemId: 'magma_hammer' }));
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'smash')?.infusion).toBe('Fire');
    expect(r.usage).toEqual({ skills: 0, passives: 1, infusions: 1 });
    expect(r.passiveEffects).toEqual(['eq_magma_hammer']); // applied at match start
  });

  it('grants a missing skill when there is room', () => {
    const r = resolveLoadout(content, warrior('legendary', 3), of({ itemId: 'trackers_shortbow' }));
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'shot')).toMatchObject({ source: 'equipment', infusion: null });
  });

  it('respects the 5-skill cap', () => {
    const r = resolveLoadout(content, warrior(), of({ itemId: 'trackers_shortbow' }));
    expect(r.problems.some((p) => p.includes('cap'))).toBe(true);
  });

  it('player-chosen infusions need a target; `unused` switches one off', () => {
    const shard = of({ itemId: 'ice_shard' });
    expect(resolveLoadout(content, warrior(), shard).problems[0]).toContain('Choose a skill');
    const chosen = resolveLoadout(content, warrior(), of({ itemId: 'ice_shard', targets: ['titan'] }));
    expect(skillOf(chosen, 'titan')?.infusion).toBe('Ice');
    const unused = resolveLoadout(content, warrior(), of({ itemId: 'ice_shard', unused: [0] }));
    expect(unused.problems).toEqual([]);
    expect(unused.usage.infusions).toBe(0);
  });

  it('locked default infusions and one-infusion-per-skill conflicts are reported', () => {
    const locked = resolveLoadout(content, warrior(), of({ itemId: 'wind_katana' })); // Strike is locked Fire
    expect(locked.problems.some((p) => p.includes('locked'))).toBe(true);
    const clash = resolveLoadout(
      content,
      warrior(),
      of({ itemId: 'magma_hammer' }, { itemId: 'frostblood_mallet' }), // both infuse Smash
    );
    expect(clash.problems.some((p) => p.includes('already infused'))).toBe(true);
    const resolved = resolveLoadout(content, warrior(), of({ itemId: 'magma_hammer' }, { itemId: 'frostblood_mallet', unused: [0] }));
    expect(resolved.problems).toEqual([]);
    expect(skillOf(resolved, 'smash')?.infusion).toBe('Fire');
  });

  it(`has ${EQUIPMENT_SLOTS} slots that take any item type; class armor stays with its class`, () => {
    // Two weapons, a two-handed one and a shard: any mix of types fits.
    const mixed = resolveLoadout(
      content,
      warrior('legendary', 3),
      of({ itemId: 'soldier_spear' }, { itemId: 'soldier_greataxe' }, { itemId: 'worn_blade' }, { itemId: 'ice_shard', unused: [0] }),
    );
    expect(mixed.problems.filter((p) => p.includes('slot') || p.includes("doesn't fit"))).toEqual([]);
    const five = resolveLoadout(content, warrior(), of(...Array.from({ length: 5 }, () => ({ itemId: 'ice_shard', unused: [0] }))));
    expect(five.problems).toContain('A character can equip 4 items (this has 5)');
    const armor = resolveLoadout(content, warrior(), of({ itemId: 'hand_of_healing' })); // Paladin armor
    expect(armor.problems.some((p) => p.includes('Paladin armor'))).toBe(true);
  });

  it('enforces the rarity budget', () => {
    // A Common can use 1 equipment skill: two J items granting new skills exceed it.
    const r = resolveLoadout(content, warrior('common', 3), of({ itemId: 'trackers_shortbow' }, { itemId: 'marksmans_rifle' }));
    expect(r.problems.some((p) => p.includes('Equipment grants 2 skills'))).toBe(true);
  });

  it('the resolved loadout makes a playable engine character', () => {
    const rec = warrior('legendary', 4);
    const r = resolveLoadout(
      content,
      rec,
      of({ itemId: 'magma_hammer' }, { itemId: 'storm_chaser', targets: [null, 'titan'] }), // JSON-safe: index 0 is fixed
    );
    expect(r.problems).toEqual([]);
    const spec = toCharacterSpec(rec, r);
    expect(spec.skills).toEqual(['strike.fire', 'smash.fire', 'titan.wind', 'charge.lightning']);
    expect(spec.items).toEqual(['magma_hammer', 'storm_chaser']); // recorded for analytics
    const { state } = createMatch(content, { seed: 1, teams: [[spec], [spec]] });
    expect(state.units[0]!.skills.map((s) => s.defId)).toEqual(spec.skills);
  });
});

describe('withItem', () => {
  it('fills the next free slot, or replaces one, aiming chosen infusions at skills that can take them', () => {
    const rec = warrior('legendary', 4); // Strike is locked Fire
    const one = withItem(content, rec, of(), { itemId: 'ice_shard', instanceId: 'a' });
    expect(one.items).toEqual([{ itemId: 'ice_shard', instanceId: 'a', targets: ['smash'] }]); // not Strike: locked
    const two = withItem(content, rec, one, { itemId: 'fire_shard' });
    expect(two.items[1]).toEqual({ itemId: 'fire_shard', targets: ['titan'] }); // Smash is taken
    expect(resolveLoadout(content, rec, two).problems).toEqual([]);
    const replaced = withItem(content, rec, two, { itemId: 'wind_shard' }, 0);
    expect(replaced.items.map((i) => [i.itemId, i.targets?.[0]])).toEqual([
      ['wind_shard', 'smash'],
      ['fire_shard', 'titan'],
    ]);
    // A crystal's two infusions with one skill left to take them: the other is marked unused.
    const crystal = withItem(content, rec, two, { itemId: 'ice_crystal' });
    expect(crystal.items[2]).toEqual({ itemId: 'ice_crystal', targets: ['charge', null], unused: [1] });
    expect(resolveLoadout(content, rec, crystal).problems).toEqual([]);
  });
});

describe('randomLoadout', () => {
  it('builds loadouts the resolver accepts, usually with equipment', async () => {
    const { rollCharacter, randomLoadout } = await import('../src/index.js');
    const { seedRng } = await import('@arena/engine');
    let equipped = 0;
    for (let s = 1; s <= 60; s++) {
      const rng = seedRng(s);
      const { character } = rollCharacter(content, rng);
      const loadout = randomLoadout(content, character, rng);
      const r = resolveLoadout(content, character, loadout);
      expect(r.problems).toEqual([]);
      if (loadout.items.length > 0) equipped++;
      expect(loadout.items.length).toBeLessThanOrEqual(EQUIPMENT_SLOTS);
      // The team spec is valid engine input.
      createMatch(content, { seed: s, teams: [[toCharacterSpec(character, r)], [toCharacterSpec(character, r)]] });
    }
    expect(equipped).toBeGreaterThan(50);
  });
});
