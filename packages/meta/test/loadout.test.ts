import { describe, expect, it } from 'vitest';
import { createMatch } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { resolveLoadout, toCharacterSpec, type CharacterRecord, type Loadout } from '../src/index.js';

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

describe('resolveLoadout', () => {
  it('an empty loadout keeps the native skills', () => {
    const r = resolveLoadout(content, warrior(), {});
    expect(r.problems).toEqual([]);
    expect(r.skills.map((s) => s.base)).toEqual(['strike', 'smash', 'titan', 'charge', 'shout']);
  });

  it('Type A: infuses its skill (the character already has it) and counts its passive', () => {
    const r = resolveLoadout(content, warrior(), { mainHand: { itemId: 'magma_hammer' } });
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'smash')?.infusion).toBe('Fire');
    expect(r.usage).toEqual({ skills: 0, passives: 1, infusions: 1 });
    expect(r.passiveEffects).toEqual([]); // passives aren't implemented yet (Phase 7)
  });

  it('grants a missing skill when there is room', () => {
    const r = resolveLoadout(content, warrior('legendary', 3), { accessories: [{ itemId: 'trackers_shortbow' }] });
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'shot')).toMatchObject({ source: 'equipment', infusion: null });
  });

  it('respects the 5-skill cap', () => {
    const r = resolveLoadout(content, warrior(), { accessories: [{ itemId: 'trackers_shortbow' }] });
    expect(r.problems.some((p) => p.includes('cap'))).toBe(true);
  });

  it('player-chosen infusions need a target; `unused` switches one off', () => {
    const shard: Loadout = { sockets: [{ itemId: 'ice_shard' }] };
    expect(resolveLoadout(content, warrior(), shard).problems[0]).toContain('Choose a skill');
    const chosen = resolveLoadout(content, warrior(), { sockets: [{ itemId: 'ice_shard', targets: ['titan'] }] });
    expect(skillOf(chosen, 'titan')?.infusion).toBe('Ice');
    const unused = resolveLoadout(content, warrior(), { sockets: [{ itemId: 'ice_shard', unused: [0] }] });
    expect(unused.problems).toEqual([]);
    expect(unused.usage.infusions).toBe(0);
  });

  it('locked default infusions and one-infusion-per-skill conflicts are reported', () => {
    const locked = resolveLoadout(content, warrior(), { mainHand: { itemId: 'wind_katana' } }); // Strike is locked Fire
    expect(locked.problems.some((p) => p.includes('locked'))).toBe(true);
    const clash = resolveLoadout(content, warrior(), {
      mainHand: { itemId: 'magma_hammer' },
      body: { itemId: 'frostblood_mallet' }, // also infuses Smash
    });
    expect(clash.problems.some((p) => p.includes('already infused'))).toBe(true);
    const resolved = resolveLoadout(content, warrior(), {
      mainHand: { itemId: 'magma_hammer' },
      body: { itemId: 'frostblood_mallet', unused: [0] },
    });
    expect(resolved.problems).toEqual([]);
    expect(skillOf(resolved, 'smash')?.infusion).toBe('Fire');
  });

  it('checks slot types, two-handed exclusivity, class armor and slot counts', () => {
    const r = resolveLoadout(content, warrior('common', 3), {
      mainHand: { itemId: 'soldier_spear' }, // type B in a main-hand slot
      twoHanded: { itemId: 'soldier_greataxe' },
      body: { itemId: 'hand_of_healing' }, // Paladin armor
      accessories: [{ itemId: 'worn_blade' }, { itemId: 'mighty_greathammer' }, { itemId: 'infantry_spear' }],
      sockets: [
        { itemId: 'ice_shard', unused: [0] },
        { itemId: 'fire_shard', unused: [0] },
      ],
    });
    const has = (s: string) => r.problems.some((p) => p.includes(s));
    expect(has("doesn't fit")).toBe(true);
    expect(has('both hands')).toBe(true);
    expect(has('Paladin armor')).toBe(true);
    expect(has('accessory slots')).toBe(true);
    expect(has('crystal sockets')).toBe(true);
  });

  it('enforces the rarity budget', () => {
    // A Common can use 1 equipment skill: two J items granting new skills exceed it.
    const r = resolveLoadout(content, warrior('common', 3), {
      accessories: [{ itemId: 'trackers_shortbow' }, { itemId: 'marksmans_rifle' }],
    });
    expect(r.problems.some((p) => p.includes('Equipment grants 2 skills'))).toBe(true);
  });

  it('the resolved loadout makes a playable engine character', () => {
    const rec = warrior('legendary', 4);
    const r = resolveLoadout(content, rec, {
      mainHand: { itemId: 'magma_hammer' },
      offHand: { itemId: 'storm_chaser', targets: [null, 'titan'] }, // JSON-safe: index 0 is fixed
    });
    expect(r.problems).toEqual([]);
    const spec = toCharacterSpec(rec, r);
    expect(spec.skills).toEqual(['strike.fire', 'smash.fire', 'titan.wind', 'charge.lightning']);
    const { state } = createMatch(content, { seed: 1, teams: [[spec], [spec]] });
    expect(state.units[0]!.skills.map((s) => s.defId)).toEqual(spec.skills);
  });
});
