import { describe, expect, it } from 'vitest';
import { createMatch } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import {
  canInfuse,
  canPrepare,
  EQUIPMENT_SLOTS,
  prepareSkill,
  pruneInfusions,
  resolveLoadout,
  toCharacterSpec,
  unprepareSkill,
  withItem,
  withoutItem,
  type CharacterRecord,
  type InfusionAssignment,
  type Loadout,
} from '../src/index.js';

const content = loadContentOrThrow();

// A Fire Warrior with `count` native skills: Strike, Smash, Titan, Charge, Shout. Its base element's
// infusion (Fire) is in its pool, not on a skill.
const warrior = (count = 5): CharacterRecord => ({
  name: 'Test',
  classId: 'warrior',
  element: 'Fire',
  portraitId: 'warrior.fire.01',
  skills: [
    { base: 'strike', infusion: null, source: 'native', locked: false },
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
    expect(r.pool).toEqual({ Fire: 1 }); // the base element's infusion, waiting to be placed
    expect(r.unassigned).toEqual({ Fire: 1 });
  });

  it("an item's infusions go into the pool; nothing is applied until the player puts them on skills", () => {
    const r = resolveLoadout(content, warrior(), of(['greathammer+fire_shard+sigil_eruptions'])); // Smash + a Fire infusion + a passive
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'smash')?.infusion).toBeNull(); // not aimed at the item's own skill
    expect(r.pool).toEqual({ Fire: 2 }); // the item's and the base element's
    expect(r.unassigned).toEqual({ Fire: 2 });
    expect(r.usage).toEqual({ skills: 0, passives: 1, infusions: 0 });
    expect(r.passiveEffects).toEqual(['eq_magma_hammer']); // applied at match start

    const applied = resolveLoadout(content, warrior(), of(['greathammer+fire_shard+sigil_eruptions'], [{ skill: 'titan', element: 'Fire' }]));
    expect(applied.problems).toEqual([]);
    expect(skillOf(applied, 'titan')?.infusion).toBe('Fire');
    expect(applied.unassigned).toEqual({ Fire: 1 });
    expect(applied.usage.infusions).toBe(1);
  });

  it('grants a missing skill when there is room, and pool infusions can go on it', () => {
    const r = resolveLoadout(content, warrior(3), of(['shortbow', 'ice_shard'], [{ skill: 'shot', element: 'Ice' }]));
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'shot')).toMatchObject({ source: 'equipment', infusion: 'Ice' });
  });

  it('respects the 5-skill cap', () => {
    expect(has(resolveLoadout(content, warrior(), of(['shortbow'])), 'cap')).toBe(true);
  });

  it('checks assignments against the pool and the skills', () => {
    expect(has(resolveLoadout(content, warrior(), of([], [{ skill: 'smash', element: 'Ice' }])), 'More Ice infusions are applied than the equipment provides (0)')).toBe(
      true,
    );
    const twoFromOne = resolveLoadout(content, warrior(), of(['ice_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'titan', element: 'Ice' }]));
    expect(has(twoFromOne, 'provides (1)')).toBe(true);
    expect(has(resolveLoadout(content, warrior(3), of(['ice_shard'], [{ skill: 'shot', element: 'Ice' }])), "isn't one of the character's skills")).toBe(true);
    // A crystal's two infusions can go on two different skills.
    const crystal = resolveLoadout(content, warrior(), of(['ice_shard+ice_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'titan', element: 'Ice' }]));
    expect(crystal.problems).toEqual([]);
  });

  it('a skill holds up to two infusions; two make their fusion element, if it has that skill', () => {
    // The base element's Fire and a Wind shard on Strike make Fire + Wind, Mechanic.
    const fused = resolveLoadout(content, warrior(), of(['wind_shard'], [{ skill: 'strike', element: 'Fire' }, { skill: 'strike', element: 'Wind' }]));
    expect(fused.problems).toEqual([]);
    expect(skillOf(fused, 'strike')?.infusion).toBe('Mechanic');
    const two = resolveLoadout(content, warrior(), of(['holy_shard', 'shadow_shard'], [{ skill: 'smash', element: 'Holy' }, { skill: 'smash', element: 'Shadow' }]));
    expect(two.problems).toEqual([]);
    expect(skillOf(two, 'smash')?.infusion).toBe('Vigilante');
    const three = resolveLoadout(
      content,
      warrior(),
      of(['ice_shard+ice_shard', 'wind_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'smash', element: 'Ice' }, { skill: 'smash', element: 'Wind' }]),
    );
    expect(has(three, 'can hold 2 infusions')).toBe(true);
  });

  it('infusions have no budget', () => {
    // Three equipment infusions applied (an old rarity budget allowed two).
    const r = resolveLoadout(
      content,
      warrior(3),
      of(['shortbow', 'ice_shard', 'fire_shard', 'wind_shard'], [
        { skill: 'smash', element: 'Ice' },
        { skill: 'titan', element: 'Fire' },
        { skill: 'shot', element: 'Wind' },
      ]),
    );
    expect(r.problems).toEqual([]);
    expect(r.usage.infusions).toBe(3);
  });

  it(`has ${EQUIPMENT_SLOTS} slots that take any piece, forged or not, on any class`, () => {
    // Forged three-component pieces, a single Skill and a Shard: any mix fits.
    const mixed = resolveLoadout(content, warrior(3), of(['spear+rapier+sigil_vanguard', 'spear+warhelm+sigil_wrath', 'longsword', 'ice_shard']));
    expect(mixed.problems.filter((p) => p.includes('slot') || p.includes("doesn't fit"))).toEqual([]);
    expect(resolveLoadout(content, warrior(), of(Array(5).fill('ice_shard'))).problems).toContain('A character can equip 4 items (this has 5)');
    // A Mace with Hand of Healing's Sigil (a Paladin theme): a Warrior can wear it.
    expect(resolveLoadout(content, warrior(), of(['mace+sigil_selflessness'])).problems.some((p) => /armor|Paladin/.test(p))).toBe(false);
  });

  it("a forged piece grants all its components: each skill, each infusion and the Sigil's passive", () => {
    const r = resolveLoadout(content, warrior(3), of(['shortbow+fire_shard', 'greathammer+fire_shard+sigil_eruptions']));
    expect(r.problems).toEqual([]);
    expect(skillOf(r, 'shot')).toMatchObject({ source: 'equipment' });
    expect(r.pool).toEqual({ Fire: 3 }); // two shards and the base element
    expect(r.passiveEffects).toEqual(['eq_magma_hammer']);
    expect(r.usage).toMatchObject({ skills: 1, passives: 1 });
  });

  it('rejects pieces that break the forging rules', () => {
    expect(has(resolveLoadout(content, warrior(), of(['ice_shard+ice_shard+ice_shard+ice_shard'])), 'Unknown item')).toBe(true);
    expect(has(resolveLoadout(content, warrior(), of(['sigil_momentum+sigil_eruptions'])), 'Unknown item')).toBe(true);
    expect(has(resolveLoadout(content, warrior(), of(['wind_katana'])), 'Unknown item')).toBe(true); // a retired static item
  });

  it('every character can use one item passive; equipment skills are only limited by the 5-skill cap', () => {
    expect(resolveLoadout(content, warrior(2), of(['greathammer+fire_shard+sigil_eruptions'])).problems).toEqual([]);
    expect(has(resolveLoadout(content, warrior(2), of(['sigil_momentum', 'sigil_eruptions'])), 'a character can use 1')).toBe(true);
    // Two native skills and three from equipment: five, the cap.
    expect(resolveLoadout(content, warrior(2), of(['shortbow+longrifle+chalice'])).problems).toEqual([]);
    expect(has(resolveLoadout(content, warrior(3), of(['shortbow+longrifle+chalice'])), 'cap')).toBe(true);
  });

  it('the resolved loadout makes a playable engine character', () => {
    const rec = warrior(4);
    const r = resolveLoadout(
      content,
      rec,
      of(['greathammer+fire_shard+sigil_eruptions', 'spear+lightning_shard+wind_shard'], [
        { skill: 'smash', element: 'Fire' },
        { skill: 'charge', element: 'Lightning' },
        { skill: 'titan', element: 'Wind' },
      ]),
    );
    expect(r.problems).toEqual([]);
    const spec = toCharacterSpec(rec, r);
    expect(spec.skills).toEqual(['strike', 'smash.fire', 'titan.wind', 'charge.lightning']);
    expect(spec.items).toEqual(['greathammer+fire_shard+sigil_eruptions', 'spear+lightning_shard+wind_shard']); // recorded for analytics
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
    const rec = warrior(4);
    const one = withItem(content, rec, of([]), { itemId: 'ice_shard', instanceId: 'a' });
    expect(one).toEqual({ items: [{ itemId: 'ice_shard', instanceId: 'a' }], infusions: [], skills: [] }); // nothing applied by itself
    const two = withItem(content, rec, { ...one, infusions: [{ skill: 'smash', element: 'Ice' }] }, { itemId: 'fire_shard' });
    expect(two.infusions).toEqual([{ skill: 'smash', element: 'Ice' }]);
    const replaced = withItem(content, rec, two, { itemId: 'wind_shard' }, 0); // the Ice shard goes, and its infusion
    expect(replaced).toEqual({ items: [{ itemId: 'wind_shard' }, { itemId: 'fire_shard' }], infusions: [], skills: [] });
    const granted: Loadout = { items: [{ itemId: 'shortbow' }, { itemId: 'ice_shard' }], infusions: [{ skill: 'shot', element: 'Ice' }] };
    expect(withoutItem(content, warrior(3), granted, 0).infusions).toEqual([]); // Shot left with its item
    expect(pruneInfusions(content, rec, of(['ice_shard'], [{ skill: 'smash', element: 'Ice' }, { skill: 'titan', element: 'Ice' }])).infusions).toEqual([
      { skill: 'smash', element: 'Ice' },
    ]);
  });

  it('canInfuse: the pool has one left, the skill has room, and the result exists', () => {
    const rec = warrior();
    const l = of(['ice_shard']);
    expect(canInfuse(content, rec, l, 'smash', 'Ice')).toBe(true);
    expect(canInfuse(content, rec, l, 'smash', 'Water')).toBe(false); // none in the pool
    expect(canInfuse(content, rec, l, 'smash', 'Fire')).toBe(true); // the base element's infusion
    expect(canInfuse(content, rec, { ...l, infusions: [{ skill: 'strike', element: 'Fire' }] }, 'strike', 'Ice')).toBe(true); // Fire + Ice: Apocalypse
    expect(canInfuse(content, rec, { ...l, infusions: [{ skill: 'titan', element: 'Ice' }] }, 'smash', 'Ice')).toBe(false); // used up
  });

  it('canInfuse: a second infusion makes the fusion; a skill holding two takes no third', () => {
    const rec = warrior();
    const l = of(['holy_shard', 'shadow_shard', 'ice_shard']);
    const oneOn = { ...l, infusions: [{ skill: 'smash', element: 'Holy' }] };
    expect(canInfuse(content, rec, oneOn, 'smash', 'Shadow')).toBe(true); // Holy + Shadow: Vigilante
    const twoOn = { ...l, infusions: [...oneOn.infusions, { skill: 'smash', element: 'Shadow' }] };
    expect(canInfuse(content, rec, twoOn, 'smash', 'Ice')).toBe(false); // full
    expect(canInfuse(content, rec, { ...l, infusions: [{ skill: 'strike', element: 'Fire' }, { skill: 'strike', element: 'Holy' }] }, 'strike', 'Ice')).toBe(false); // Fire + Holy: full
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

describe('the skill pool', () => {
  // Pieces put their skills in a pool; only prepared ones join the character, within the 5-skill cap. A
  // full character can still wear a piece for its other components.
  const prepared = (items: string[], skills: string[], infusions: InfusionAssignment[] = []): Loadout => ({ items: items.map((itemId) => ({ itemId })), infusions, skills });

  it('granted skills wait in the pool until prepared; only prepared ones go into battle', () => {
    const rec = warrior(3);
    const r = resolveLoadout(content, rec, prepared(['shortbow+chalice+ice_shard'], []));
    expect(r.problems).toEqual([]);
    expect(r.skillPool).toEqual(['shot', 'bless']);
    expect(r.unprepared).toEqual(['shot', 'bless']);
    expect(r.skills.map((s) => s.base)).toEqual(['strike', 'smash', 'titan']);
    expect(r.usage.skills).toBe(0);
    const one = resolveLoadout(content, rec, prepared(['shortbow+chalice+ice_shard'], ['bless']));
    expect(one.skills.map((s) => s.base)).toEqual(['strike', 'smash', 'titan', 'bless']);
    expect(one.unprepared).toEqual(['shot']);
    expect(toCharacterSpec(rec, one).skills).toEqual(['strike', 'smash', 'titan', 'bless']);
  });

  it('a character at four skills can wear a two-skill piece, preparing only one of its skills', () => {
    const rec = warrior(4);
    const piece = 'shortbow+chalice+ice_shard';
    expect(resolveLoadout(content, rec, prepared([piece], ['shot'], [{ skill: 'smash', element: 'Ice' }])).problems).toEqual([]);
    expect(resolveLoadout(content, rec, prepared([piece], ['shot', 'bless'])).problems.some((p) => p.includes('Too many skills'))).toBe(true);
    const l = prepared([piece], ['shot']);
    expect(canPrepare(content, rec, l, 'bless')).toBe(false); // the cap
    expect(canPrepare(content, rec, prepared([piece], []), 'bless')).toBe(true);
  });

  it('a two-skill recruit can prepare three equipment skills, up to the cap', () => {
    const recruit = warrior(2);
    const l = prepared(['shortbow+chalice+longrifle'], ['shot', 'bless']);
    expect(resolveLoadout(content, recruit, l).problems).toEqual([]);
    expect(canPrepare(content, recruit, l, 'snipe')).toBe(true);
    expect(resolveLoadout(content, recruit, prepared(['shortbow+chalice+longrifle'], ['shot', 'bless', 'snipe'])).skills).toHaveLength(5);
  });

  it('a skill no equipped piece grants, or one the character already has, cannot be prepared', () => {
    const rec = warrior(3);
    expect(resolveLoadout(content, rec, prepared([], ['shot'])).problems.some((p) => p.includes('no equipped piece grants it'))).toBe(true);
    expect(resolveLoadout(content, rec, prepared(['greathammer'], ['smash'])).problems.some((p) => p.includes("already one of the character's skills"))).toBe(true);
    expect(resolveLoadout(content, rec, prepared(['greathammer'], [])).skillPool).toEqual([]); // a native skill adds nothing to the pool
  });

  it('only prepared skills take infusions; unpreparing one gives its infusions back', () => {
    const rec = warrior(3);
    expect(resolveLoadout(content, rec, prepared(['shortbow+ice_shard'], [], [{ skill: 'shot', element: 'Ice' }])).problems.some((p) => p.includes("isn't one of the character's skills"))).toBe(
      true,
    );
    const on = prepared(['shortbow+ice_shard'], ['shot'], [{ skill: 'shot', element: 'Ice' }]);
    expect(resolveLoadout(content, rec, on).problems).toEqual([]);
    const off = unprepareSkill(content, rec, on, 'shot');
    expect(off.skills).toEqual([]);
    expect(off.infusions).toEqual([]);
    expect(prepareSkill(content, rec, off, 'shot').skills).toEqual(['shot']);
  });

  it('equipping prepares the new skills that fit and leaves the rest in the pool; removing the piece takes them away', () => {
    const rec = warrior(4);
    const next = withItem(content, rec, prepared([], []), { itemId: 'shortbow+chalice' });
    expect(next.skills).toEqual(['shot']); // the fifth skill; Bless waits in the pool
    expect(withoutItem(content, rec, next, 0).skills).toEqual([]);
  });

  it('a loadout saved before the pool prepares every granted skill', () => {
    const r = resolveLoadout(content, warrior(3), { items: [{ itemId: 'shortbow+chalice' }], infusions: [] });
    expect(r.skills.map((s) => s.base)).toEqual(['strike', 'smash', 'titan', 'shot', 'bless']);
    expect(r.unprepared).toEqual([]);
  });
});
