// Spec-driven scenarios for Life (Earth + Earth): Flourish, Bloom, all 30 skills and the minion skills.
// Sources: skill/status descriptions, glossary.life.yaml, docs/rules.md §21.7, the Fusion Spec Kits table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

/** Life's fusion passive (Bloom), which `arena()` doesn't hand out by itself. */
const GROVE = ['life_grove'];

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

const maxHp = (a: Arena, id: string) => a.unit(id).maxHp;

describe('Life: Flourish', () => {
  it('healing past max HP raises max HP by the excess and fills it', () => {
    const a = arena({ p0: [['heal.life'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 90).use(A1, 'heal.life', A2).end();
    expect([a.hp(A2), maxHp(a, A2)]).toEqual([110, 110]);
  });

  it('healing that stays under max HP does not Flourish', () => {
    const a = arena({ p0: [['heal.life'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.life', A2).end();
    expect([a.hp(A2), maxHp(a, A2)]).toEqual([70, 100]);
  });

  it('is capped at +30 max HP per unit for the match', () => {
    const a = arena({ p0: [['heal.life'], ['heal.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal.life', A3).use(A2, 'heal.life', A3).end();
    expect([a.hp(A3), maxHp(a, A3)]).toEqual([130, 130]);
    // Two turns later, more overflow healing adds nothing.
    a.pass(3).use(A1, 'heal.life', A3).end();
    expect([a.hp(A3), maxHp(a, A3)]).toEqual([130, 130]);
  });

  it('the cap is per unit: another unit can still Flourish', () => {
    const a = arena({ p0: [['heal.life'], ['heal.life'], ['heal.life']], p1: [['shot']] });
    a.use(A1, 'heal.life', A3).use(A2, 'heal.life', A3).use(A3, 'heal.life', A1).end();
    expect([maxHp(a, A3), maxHp(a, A1)]).toEqual([130, 120]);
  });

  it('the raised max HP lasts for the rest of the match', () => {
    const a = arena({ p0: [['heal.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal.life', A2).end().pass(9);
    expect(maxHp(a, A2)).toBe(120);
  });

  it('non-Life healing (base Heal) does not Flourish', () => {
    const a = arena({ p0: [['heal'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 90).use(A1, 'heal', A2).end();
    expect([a.hp(A2), maxHp(a, A2)]).toEqual([100, 100]);
  });
});

describe('Life: Bloom (Grove Tender)', () => {
  it('a Life character\'s Seedling is still a Seedling after the creator\'s first turn after appearing', () => {
    const a = arena({ p0: [['summon.earth']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').end().pass(2); // turns 1..3 ended
    expect([minions(a, 0, 'seedling').length, minions(a, 0, 'treant').length]).toEqual([2, 0]);
  });

  it('at the end of the creator\'s second turn after appearing it becomes a Treant: 40 max HP, full, Treant Slam, still a Seedling', () => {
    const a = arena({ p0: [['summon.earth']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').end();
    const seedling = minions(a, 0, 'seedling')[0]!;
    a.unit(seedling.id).hp = 5;
    a.pass(4); // turns 2..5 ended
    const treants = minions(a, 0, 'treant');
    expect(treants).toHaveLength(2);
    expect(treants.map((t) => [t.maxHp, t.hp])).toEqual([[40, 40], [40, 40]]);
    expect(treants[0]!.skills.map((s) => s.defId)).toContain('treant_slam');
    // "Treants still count as Seedlings": Channel Growth (Seedlings only) reaches them.
    a.pass(1);
    expect(a.unit(treants[0]!.id).alive).toBe(true);
  });

  it('Treants still count as Seedlings: Channel Growth grows them', () => {
    const a = arena({ p0: [['summon.earth', 'shout.life'], ['heal.earth']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'shout.life').end().pass(1);
    expect(minions(a, 0, 'treant')).toHaveLength(2);
    a.use(A2, 'heal.earth', A2).end();
    expect(minions(a, 0, 'treant').map((t) => t.maxHp)).toEqual([50, 50]);
  });

  it('any Seedling a Life character creates Blooms, including one from an Earth skill', () => {
    const a = arena({ p0: [['summon.earth']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').end().pass(4);
    expect(minions(a, 0, 'treant')).toHaveLength(2);
  });

  it('every character with a Life skill carries Grove Tender from the start (§21.0)', () => {
    const a = arena({ p0: [['heal.life'], ['summon.earth']], p1: [['shot']] });
    expect([a.has(A1, 'life_grove'), a.has(A2, 'life_grove')]).toEqual([true, false]);
  });

  it('a Seedling made by a character without a Life skill never Blooms, even next to a Life ally', () => {
    const a = arena({ p0: [['heal.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(8);
    expect([minions(a, 0, 'seedling').length, minions(a, 0, 'treant').length]).toEqual([2, 0]);
  });

  it('a Seedling that dies before its timer does not come back as a Treant', () => {
    const a = arena({ p0: [['charge.life']], p1: [['strike']], passives: { p0c0: GROVE } });
    a.use(A1, 'charge.life', B1).end(); // one Seedling
    const s = minions(a, 0, 'seedling')[0]!;
    a.use(B1, 'strike', s.id).end().pass(4);
    expect([a.unit(s.id).alive, minions(a, 0).length]).toEqual([false, 0]);
  });

  it('Treant Slam (no cost): 15 damage to target enemy', () => {
    const a = arena({ p0: [['summon.earth', 'shout.life']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'shout.life').end().pass(1);
    const t = minions(a, 0, 'treant')[0]!;
    a.use(t.id, 'treant_slam', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('a Treant keeps Channel Earth: its creator gains 1 Might and 1 Armor', () => {
    const a = arena({ p0: [['summon.earth', 'shout.life']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'shout.life').end().pass(1);
    const t = minions(a, 0, 'treant')[0]!;
    a.use(t.id, 'seedling_channel_earth').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
  });
});

describe('Life skills', () => {
  it('Oakfist: 20 damage with no Flourish', () => {
    const a = arena({ p0: [['strike.life']], p1: [['shot']] });
    a.use(A1, 'strike.life', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Oakfist: +5 per full 10 max HP the user gained from Flourish', () => {
    const a = arena({ p0: [['strike.life'], ['heal.life']], p1: [['shot']] });
    a.use(A2, 'heal.life', A1).end().pass(1); // +20 Flourish
    a.use(A1, 'strike.life', B1).end();
    expect(a.hp(B1)).toBe(70); // 20 + 10
  });

  it('Oakfist: a partial 10 of Flourish adds nothing extra', () => {
    const a = arena({ p0: [['strike.life'], ['heal.life']], p1: [['shot']] });
    a.setHp(A1, 95).use(A2, 'heal.life', A1).end().pass(1); // +15 Flourish
    a.use(A1, 'strike.life', B1).end();
    expect(a.hp(B1)).toBe(75); // 20 + 5
  });

  it('Groundswell: 30 to the target; every other unit on both sides, minions included, heals 15 with Flourish', () => {
    const a = arena({ p0: [['smash.life'], ['summon.earth']], p1: [['shot'], ['shot']] });
    a.use(A2, 'summon.earth').end().pass(1);
    const s = minions(a, 0, 'seedling')[0]!;
    a.setHp(B2, 50).use(A1, 'smash.life', B1).end();
    expect(a.hp(B1)).toBeLessThanOrEqual(85);
    expect([a.hp(A2), maxHp(a, A2)]).toEqual([115, 115]); // ally at full Flourishes
    expect(a.hp(B2)).toBe(65); // the other enemy heals too
    expect([a.unit(s.id).hp, a.unit(s.id).maxHp]).toEqual([30, 30]); // the minion heals and Flourishes
  });

  it('Sapling Charge: 15 damage and a Seedling', () => {
    const a = arena({ p0: [['charge.life']], p1: [['shot']] });
    a.use(A1, 'charge.life', B1).end();
    expect([a.hp(B1), minions(a, 0, 'seedling').length]).toEqual([85, 1]);
  });

  it('Sapling Charge: the next hit aimed at the user lands on the Seedling instead, only once', () => {
    const a = arena({ p0: [['charge.life']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.life', B1).end();
    const s = minions(a, 0, 'seedling')[0]!;
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.unit(s.id).alive]).toEqual([100, false]);
    a.pass(1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Thornwall: Invisible; counters the first Harmful skill on the user, and only the first', () => {
    const a = arena({ p0: [['riposte.life']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.life').end();
    expect(a.has(A1, 'thornwall')).toBe(true);
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1 && e.inline?.id === 'thornwall')).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([100, 100, 85]);
  });

  it('Thornwall: a Seedling sprouts, and the countered enemy is Taunted by it for 1 turn', () => {
    const a = arena({ p0: [['riposte.life']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.life').end();
    a.use(B1, 'shot', A1).end();
    const s = minions(a, 0, 'seedling');
    expect(s).toHaveLength(1);
    expect([a.has(B1, 'taunt'), a.has(B2, 'taunt')]).toEqual([true, false]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B1, 'shot', s[0]!.id).use(B2, 'shot', A1).end();
    expect([a.unit(s[0]!.id).hp, a.hp(A1), a.has(B1, 'taunt')]).toEqual([0, 85, false]);
  });

  it('Thornwall: lasts 1 turn only', () => {
    const a = arena({ p0: [['riposte.life']], p1: [['shot']] });
    a.use(A1, 'riposte.life').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), minions(a, 0).length]).toEqual([85, 0]);
  });

  it('Thornwall: does not counter Helpful skills', () => {
    const a = arena({ p0: [['riposte.life'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'riposte.life').use(A2, 'heal', A1).end();
    expect([a.hp(A1), minions(a, 0).length]).toEqual([75, 0]);
  });

  it("Wild Growth: a Seedling at once, then another at the start of each of the user's turns for 3 turns", () => {
    const a = arena({ p0: [['rage.life']], p1: [['curse']] });
    a.use(A1, 'rage.life').end();
    // (Seedlings Bloom into Treants along the way; Treants still count as Seedlings.)
    expect(minions(a, 0).length).toBe(1);
    a.end();
    expect(minions(a, 0).length).toBe(2);
    a.pass(2);
    expect(minions(a, 0).length).toBe(3);
    a.pass(2);
    expect([minions(a, 0).length, a.has(A1, 'wild_growth_surge')]).toEqual([3, false]);
  });

  it('Wild Growth: it gives no Immune', () => {
    const a = arena({ p0: [['rage.life']], p1: [['curse']] });
    a.use(A1, 'rage.life').end();
    a.use(B1, 'curse', A1).end();
    expect([a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([false, true]);
  });

  it('Wild Growth: the user deals 5 more direct damage for each allied Seedling, up to 20 more', () => {
    const a = arena({ p0: [['rage.life', 'shot'], ['summon.earth']], p1: [['shot']] });
    a.use(A1, 'rage.life').end().pass(1);
    a.use(A1, 'shot', B1).end(); // 2 Seedlings
    expect(a.hp(B1)).toBe(75);
    a.pass(1).use(A2, 'summon.earth').use(A1, 'shot', B1).end(); // 3 of its own + 2 from Earth: capped
    expect(a.hp(B1)).toBe(75 - 15 - 20);
  });

  it('Ripening Seed: 5 damage to target enemy, and a seed planted in them for 3 turns', () => {
    const a = arena({ p0: [['shot.life']], p1: [['shot']] });
    a.use(A1, 'shot.life', B1).end();
    expect([a.hp(B1), a.has(B1, 'ripening_seed')]).toEqual([95, true]);
    a.pass(4);
    expect(a.has(B1, 'ripening_seed')).toBe(true);
    a.pass(1); // the end of their third turn
    expect(a.has(B1, 'ripening_seed')).toBe(false);
  });

  it("Ripening Seed: it ripens at the end of each of the user's turns, to 10 and then to 25", () => {
    const a = arena({ p0: [['shot.life']], p1: [['shot']] });
    a.use(A1, 'shot.life', B1).end();
    expect(a.stacks(B1, 'ripening_seed')).toBe(2); // 10
    a.end();
    expect(a.stacks(B1, 'ripening_seed')).toBe(2); // not on the enemy's turn
    a.end();
    expect(a.stacks(B1, 'ripening_seed')).toBe(3); // 25
    a.pass(2);
    expect(a.stacks(B1, 'ripening_seed')).toBe(3); // no riper than that
  });

  it('Ripening Seed: using it on them again harvests the seed first: it bursts for its ripeness, and the user heals half of what it dealt', () => {
    const a = arena({ p0: [['shot.life']], p1: [['shot']] });
    a.setHp(A1, 60).use(A1, 'shot.life', B1).end().pass(1);
    a.use(A1, 'shot.life', B1).end(); // ripe at 10: 10 + 5
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 65]);
    expect(a.stacks(B1, 'ripening_seed')).toBe(2); // a new seed, ripened once already
    const b = arena({ p0: [['shot.life']], p1: [['shot']] });
    b.setHp(A1, 60).use(A1, 'shot.life', B1).end().pass(3);
    b.use(A1, 'shot.life', B1).end(); // ripe at 25: 25 + 5
    expect([b.hp(B1), b.hp(A1)]).toEqual([65, 72]);
    const c = arena({ p0: [['shot.life']], p1: [['shot']] });
    c.give(B1, 'armor', { stacks: 2 }).setHp(A1, 60).use(A1, 'shot.life', B1).end().pass(3);
    c.use(A1, 'shot.life', B1).end(); // the burst deals 15 through the Armor: 7 back
    expect(c.hp(A1)).toBe(67);
  });

  it('Ripening Seed: the harvest can Flourish', () => {
    const a = arena({ p0: [['shot.life']], p1: [['shot']] });
    a.use(A1, 'shot.life', B1).end().pass(3).use(A1, 'shot.life', B1).end();
    expect([a.hp(A1), maxHp(a, A1)]).toEqual([112, 112]);
  });

  it('Ripening Seed: with no seed to harvest (cleansed, or gone), it only deals 5 and plants one', () => {
    const a = arena({ p0: [['shot.life']], p1: [['shot']] });
    a.setHp(A1, 60).use(A1, 'shot.life', B1).end().pass(5);
    a.use(A1, 'shot.life', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'ripening_seed')]).toEqual([90, 60, true]);
  });

  it('Ripening Seed: the user tends one seed at a time: planting one withers their seed in another enemy, with no burst', () => {
    const a = arena({ p0: [['shot.life']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 60).use(A1, 'shot.life', B1).end().pass(3); // B1's seed is ripe at 25
    a.use(A1, 'shot.life', B2).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([95, 95, 60]); // no burst, no heal
    expect([a.has(B1, 'ripening_seed'), a.has(B2, 'ripening_seed')]).toEqual([false, true]);
    a.pass(1).use(A1, 'shot.life', B1).end(); // back to B1: nothing to harvest, and B2's withers
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([90, 95, 60]);
    expect([a.has(B1, 'ripening_seed'), a.has(B2, 'ripening_seed')]).toEqual([true, false]);
  });

  it("Ripening Seed: another character's seed in another enemy doesn't wither", () => {
    const a = arena({ p0: [['shot.life'], ['shot.life']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.life', B1).use(A2, 'shot.life', B2).end();
    expect([a.has(B1, 'ripening_seed'), a.has(B2, 'ripening_seed')]).toEqual([true, true]);
  });

  it('Ripening Seed: it only targets enemies', () => {
    const a = arena({ p0: [['shot.life'], ['shot']], p1: [['shot']] });
    expect(a.reject(() => a.use(A1, 'shot.life', A2))).toBe('bad_target');
  });

  it('Heartwood Spear: Channel Growth at the end of each of the user\'s turns, then 50 damage in 2 turns', () => {
    const a = arena({ p0: [['snipe.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(1);
    const s = minions(a, 0, 'seedling')[0]!;
    a.use(A1, 'snipe.life', B1).end(); // turn 3
    expect(a.unit(s.id).maxHp).toBe(25);
    a.pass(1);
    expect(a.hp(B1)).toBe(100);
    a.pass(1); // turn 5: second Channel Growth
    expect(a.unit(s.id).maxHp).toBe(35);
    a.pass(1); // turn 6
    expect(a.hp(B1)).toBe(50);
    a.pass(2);
    expect(a.unit(s.id).maxHp).toBe(35); // no more growth once it has landed
  });

  it('Heartwood Spear: Stunning the user interrupts it, so it never lands', () => {
    const a = arena({ p0: [['snipe.life']], p1: [['stun']] });
    a.use(A1, 'snipe.life', B1).end().use(B1, 'stun', A1).end().pass(4);
    expect(a.hp(B1)).toBe(100);
  });

  it('Strangling Roots: Invisible; each skill the target uses gives 1 Weakness for 2 turns', () => {
    const a = arena({ p0: [['trap.life']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.life', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.stacks(B1, 'weakness'), a.stacks(B2, 'weakness')]).toEqual([1, 0]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'weakness')).toBe(2);
    expect(minions(a, 0, 'seedling')).toHaveLength(0);
  });

  it('Strangling Roots: the Weakness wears off after 2 turns', () => {
    const a = arena({ p0: [['trap.life']], p1: [['shot']] });
    a.use(A1, 'trap.life', B1).end().use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'weakness')).toBe(1);
    a.pass(4);
    expect(a.stacks(B1, 'weakness')).toBe(0);
  });

  it('Strangling Roots: the roots end after 2 turns', () => {
    const a = arena({ p0: [['trap.life']], p1: [['shot']] });
    a.use(A1, 'trap.life', B1).end().pass(4).use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'weakness')).toBe(0);
  });

  // A single cast lasts 2 turns, and the target acts once per turn, so it sees at most 2 skills; the
  // roots are renewed by a second trapper to reach a third tightening.
  it('Strangling Roots: at the 3rd tightening a Seedling sprouts for the user, not before', () => {
    const a = arena({ p0: [['trap.life'], ['trap.life']], p1: [['shot']] });
    a.use(A1, 'trap.life', B1).end().use(B1, 'shot', A1).end();
    a.use(A2, 'trap.life', B1).end().use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'weakness'), minions(a, 0).length]).toEqual([2, 0]);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 6: third tightening
    expect(minions(a, 0, 'seedling')).toHaveLength(1);
  });

  it('Take Root: Invulnerable for 1 turn and a Boulder', () => {
    const a = arena({ p0: [['maneuver.life']], p1: [['shot']] });
    a.use(A1, 'maneuver.life').end();
    expect([a.has(A1, 'invulnerable'), minions(a, 0, 'boulder').length]).toEqual([true, 1]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  it('Take Root: a Boulder still standing at the start of the user\'s next turn cracks into a Worldsprout', () => {
    const a = arena({ p0: [['maneuver.life']], p1: [['shot']] });
    a.use(A1, 'maneuver.life').end();
    expect(minions(a, 0, 'worldsprout')).toHaveLength(0);
    a.end(); // turn 3 starts
    expect([minions(a, 0, 'boulder').length, minions(a, 0, 'worldsprout').length]).toEqual([0, 1]);
  });

  it('Take Root: a Boulder destroyed before then gives no Worldsprout', () => {
    const a = arena({ p0: [['maneuver.life']], p1: [['shot']] });
    a.use(A1, 'maneuver.life').end();
    const b = minions(a, 0, 'boulder')[0]!;
    a.unit(b.id).hp = 5;
    a.use(B1, 'shot', b.id).end();
    expect(minions(a, 0)).toHaveLength(0);
  });

  it('Patient Acorn: a 5 HP Acorn that grows 10 max HP and heals 10 at the end of each of its owner\'s turns, without limit', () => {
    const a = arena({ p0: [['companion.life']], p1: [['shot']] });
    a.use(A1, 'companion.life').end();
    const ac = minions(a, 0, 'acorn')[0]!;
    const [m0, h0] = [a.unit(ac.id).maxHp, a.unit(ac.id).hp];
    expect(m0 === 5 || m0 === 15).toBe(true); // 5 HP, possibly already grown once at the end of turn 1
    a.end(); // enemy turn: no growth
    expect(a.unit(ac.id).maxHp).toBe(m0);
    a.end(); // own turn
    expect([a.unit(ac.id).maxHp, a.unit(ac.id).hp]).toEqual([m0 + 10, h0 + 10]);
    a.pass(20);
    expect(a.unit(ac.id).maxHp).toBe(m0 + 110); // way past any Flourish-style cap
  });

  it('Patient Acorn: the Acorn is not a Seedling (no Channel Growth, never Blooms)', () => {
    const a = arena({ p0: [['companion.life', 'shout.life'], ['heal.earth']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'companion.life').end();
    const ac = minions(a, 0, 'acorn')[0]!;
    const m = a.unit(ac.id).maxHp;
    a.end().use(A2, 'heal.earth', A2).end();
    expect(a.unit(ac.id).maxHp).toBe(m + 10); // its own growth only, not +20
    a.end().use(A1, 'shout.life').end().pass(6);
    // The Acorn stays an Acorn; the only Treant is the Seedling Call of the Grove created (no Seedling stood).
    expect([minions(a, 0, 'acorn').length, minions(a, 0, 'treant').length]).toEqual([1, 1]);
  });

  it('Crush (r): damage equal to half the Acorn\'s HP', () => {
    const a = arena({ p0: [['companion.life']], p1: [['shot']] });
    a.use(A1, 'companion.life').end().pass(1);
    const ac = minions(a, 0, 'acorn')[0]!;
    a.unit(ac.id).maxHp = 60;
    a.unit(ac.id).hp = 40;
    a.use(ac.id, 'acorn_crush', B1);
    expect(a.state.players[0].queue[0]?.cost).toMatchObject({ S: 0, A: 0, I: 0, W: 0, r: 1 });
    a.end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Growing Thorn: 15 damage, then at the end of each of the user\'s turns for 2 turns, 10 more and the user heals 5', () => {
    const a = arena({ p0: [['bolt.life']], p1: [['shot']] });
    a.setHp(A1, 80).use(A1, 'bolt.life', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'growing_thorn')]).toEqual([75, 85, true]);
    a.pass(2);
    expect([a.hp(B1), a.hp(A1)]).toEqual([65, 90]);
    a.pass(2);
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'growing_thorn')]).toEqual([65, 90, false]);
  });

  it('Growing Thorn: the user\'s heal can Flourish', () => {
    const a = arena({ p0: [['bolt.life']], p1: [['shot']] });
    a.use(A1, 'bolt.life', B1).end().pass(2);
    expect([a.hp(A1), maxHp(a, A1)]).toEqual([110, 110]);
  });

  it('Verdant Wave: 25 to all enemies; a Seedling for each enemy left below 50 HP', () => {
    const a = arena({ p0: [['blast.life']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 60).use(A1, 'blast.life').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([35, 75, 75]);
    expect(minions(a, 0, 'seedling')).toHaveLength(1);
  });

  it('Verdant Wave: at most 2 Seedlings', () => {
    const a = arena({ p0: [['blast.life']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 60).setHp(B2, 60).setHp(B3, 60).use(A1, 'blast.life').end();
    expect(minions(a, 0, 'seedling')).toHaveLength(2);
  });

  it('Verdant Wave: an enemy left at exactly 50 doesn\'t count', () => {
    const a = arena({ p0: [['blast.life']], p1: [['shot']] });
    a.setHp(B1, 75).use(A1, 'blast.life').end();
    expect([a.hp(B1), minions(a, 0).length]).toEqual([50, 0]);
  });

  it('Harvest: with no Seedling or Treant, target ally heals 10 and the user creates a Seedling', () => {
    const a = arena({ p0: [['consume.life'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'consume.life', A2).end();
    expect([a.hp(A2), minions(a, 0, 'seedling').length]).toEqual([60, 1]);
  });

  it('Harvest: with no Seedling, the 10 can still Flourish', () => {
    const a = arena({ p0: [['consume.life'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 95).use(A1, 'consume.life', A2).end();
    expect([a.hp(A2), maxHp(a, A2)]).toEqual([105, 105]);
  });

  it("Harvest: sacrifices the user's Seedling; the target ally heals 10 plus its remaining HP, which can Flourish", () => {
    const a = arena({ p0: [['consume.life', 'charge.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.life', B1).end().pass(1);
    const s = minions(a, 0, 'seedling')[0]!;
    a.unit(s.id).hp = 12;
    a.setHp(A2, 95).use(A1, 'consume.life', A2).end();
    expect([a.unit(s.id).alive, a.hp(A2), maxHp(a, A2)]).toEqual([false, 117, 117]);
    expect(minions(a, 0)).toHaveLength(0); // it had one, so no new Seedling
  });

  it('Harvest: a Treant works too, for its 40 HP', () => {
    const a = arena({ p0: [['consume.life', 'charge.life', 'shout.life'], ['shot']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'charge.life', B1).end().pass(1).use(A1, 'shout.life').end().pass(1);
    expect(minions(a, 0, 'treant')).toHaveLength(1);
    a.setHp(A2, 40).use(A1, 'consume.life', A2).end();
    expect([a.hp(A2), minions(a, 0).length]).toEqual([90, 0]);
  });

  it("Harvest: only the user's own Seedlings are sacrificed", () => {
    const a = arena({ p0: [['consume.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(1);
    a.setHp(A2, 50).use(A1, 'consume.life', A2).end();
    expect([a.hp(A2), minions(a, 0, 'seedling').length]).toEqual([60, 3]); // A2's two stay, plus a new one
  });

  it('Dryad: summons a 20 HP Dryad for 3 turns; it is not a Seedling', () => {
    const a = arena({ p0: [['summon.life']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.life').end();
    const d = minions(a, 0, 'dryad');
    expect([d.length, d[0]!.hp, minions(a, 0, 'seedling').length]).toEqual([1, 20, 0]);
    a.pass(4);
    expect([a.unit(d[0]!.id).alive, minions(a, 0, 'treant').length]).toEqual([true, 0]);
    a.pass(1);
    expect(a.unit(d[0]!.id).alive).toBe(false);
  });

  it('Dryad / Mend: target ally heals 15, which can Flourish', () => {
    const a = arena({ p0: [['summon.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.life').end().pass(1);
    const d = minions(a, 0, 'dryad')[0]!.id;
    a.setHp(A2, 50).use(d, 'dryad_mend', A2).end();
    expect(a.hp(A2)).toBe(65);
    a.setHp(A2, 95).pass(1).use(d, 'dryad_mend', A2).end();
    expect([a.hp(A2), maxHp(a, A2), a.hp(B1)]).toEqual([110, 110, 100]);
  });

  it('Tend the Grove: with no minion the user creates a Seedling; then every allied minion heals 15 at their turn ends, which can Flourish', () => {
    const a = arena({ p0: [['channel.life']], p1: [['shot']] });
    a.use(A1, 'channel.life').end();
    const s = minions(a, 0, 'seedling');
    expect(s).toHaveLength(1);
    a.pass(2); // turn 3 tick: the Seedling (at full) heals 15 and Flourishes
    expect([a.unit(s[0]!.id).hp, a.unit(s[0]!.id).maxHp]).toEqual([30, 30]);
    expect(minions(a, 0, 'seedling')).toHaveLength(1); // no second Seedling while one exists
  });

  it('Tend the Grove: Stunning the user ends the channel', () => {
    const a = arena({ p0: [['channel.life']], p1: [['stun']] });
    a.use(A1, 'channel.life').end().use(B1, 'stun', A1).end().pass(1);
    const s = minions(a, 0, 'seedling')[0]!;
    expect(a.unit(s.id).maxHp).toBe(15);
  });

  it('Splinter Spike: sacrifices a Seedling for 25 Piercing damage', () => {
    const a = arena({ p0: [['stab.life', 'charge.life']], p1: [['shot']] });
    a.use(A1, 'charge.life', B1).end().pass(1);
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'stab.life', B1).end();
    expect([a.hp(B1), minions(a, 0).length]).toEqual([60, 0]); // 85 − 25, Armor ignored
  });

  it('Splinter Spike: without a Seedling, 10 damage and the user creates a Seedling', () => {
    const a = arena({ p0: [['stab.life']], p1: [['shot']] });
    a.use(A1, 'stab.life', B1).end();
    expect([a.hp(B1), minions(a, 0, 'seedling').length]).toEqual([90, 1]);
  });

  it('Splinter Spike: the Seedling it made is sacrificed by the next use, for 25 Piercing', () => {
    const a = arena({ p0: [['stab.life']], p1: [['shot']] });
    a.use(A1, 'stab.life', B1).end().pass(1);
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'stab.life', B1).end();
    expect([a.hp(B1), minions(a, 0).length]).toEqual([65, 0]); // 90 − 25, Armor ignored
  });

  it('Splinter Spike: a Boulder is not a Seedling', () => {
    const a = arena({ p0: [['stab.life', 'charge.earth']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'stab.life', B1).end();
    expect([a.hp(B1), minions(a, 0, 'boulder').length, minions(a, 0, 'seedling').length]).toEqual([80, 1, 1]);
  });

  it('Taproot: 25 Piercing damage; no max HP moves from a target that isn\'t Stunned', () => {
    const a = arena({ p0: [['ravage.life']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.life', B1).end();
    expect([a.hp(B1), maxHp(a, B1), maxHp(a, A1)]).toEqual([75, 100, 100]);
  });

  it('Taproot: against a Stunned target, 10 of their max HP moves to the user', () => {
    const a = arena({ p0: [['ravage.life']], p1: [['shot']] });
    a.give(B1, 'stun', { duration: 4 }).use(A1, 'ravage.life', B1).end();
    expect([maxHp(a, B1), maxHp(a, A1)]).toEqual([90, 110]);
    expect(a.hp(B1)).toBeLessThanOrEqual(75);
  });

  it('Taproot: the moved max HP counts toward the user\'s Flourish limit', () => {
    const a = arena({ p0: [['ravage.life'], ['heal.life'], ['heal.life']], p1: [['shot']] });
    a.give(B1, 'stun', { duration: 4 }).use(A2, 'heal.life', A1).use(A3, 'heal.life', A1).use(A1, 'ravage.life', B1).end();
    expect(maxHp(a, A1)).toBe(130); // 40 overflow + 10 moved, capped at +30
  });

  it('Living Screen: Invisible; the target\'s Harmful skill lands on the user\'s minions instead', () => {
    const a = arena({ p0: [['mislead.life', 'charge.earth']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'mislead.life', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.source === A1 && e.bearer === B1)).toBe(false);
    const b = minions(a, 0, 'boulder')[0]!;
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.unit(b.id).hp]).toEqual([100, 30]);
    expect(minions(a, 0, 'boulder')).toHaveLength(1); // no extra Boulder when a minion took it
  });

  it('Living Screen: with no minion to take it, the skill is countered and the user creates a Boulder', () => {
    const a = arena({ p0: [['mislead.life']], p1: [['shot']] });
    a.use(A1, 'mislead.life', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), minions(a, 0, 'boulder').length]).toEqual([100, 1]);
  });

  it('Living Screen: other enemies and the target\'s Helpful skills are unaffected', () => {
    const a = arena({ p0: [['mislead.life']], p1: [['heal'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'mislead.life', B1).end().use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1), minions(a, 0).length]).toEqual([75, 85, 0]);
  });

  it('Living Screen: lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.life']], p1: [['shot']] });
    a.use(A1, 'mislead.life', B1).end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), minions(a, 0).length]).toEqual([85, 0]);
  });

  it('Overgrow: 10 damage; a Seedling sprouts and the target is Stunned for 2 turns', () => {
    const a = arena({ p0: [['stun.life']], p1: [['shot']] });
    a.use(A1, 'stun.life', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), minions(a, 0, 'seedling').length]).toEqual([90, true, 1]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTypeOf('string');
    a.pass(2);
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Overgrow: the Stun ends as soon as that Seedling dies', () => {
    const a = arena({ p0: [['stun.life']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.life', B1).end();
    const s = minions(a, 0, 'seedling')[0]!.id;
    a.use(B2, 'shot', s).end();
    expect([a.unit(s).alive, a.has(B1, 'stun')]).toEqual([false, false]);
  });

  it('Evergreen: at the start of the user\'s turn they heal 10, which can Flourish, and gain Swiftness above their starting max HP', () => {
    const a = arena({ p0: [['dance.life']], p1: [['shot']] });
    a.use(A1, 'dance.life').end().end(); // turn 3 starts
    expect([a.hp(A1), maxHp(a, A1), a.stacks(A1, 'swiftness')]).toEqual([110, 110, 1]);
  });

  it('Evergreen: no Swiftness while at or below starting max HP', () => {
    const a = arena({ p0: [['dance.life']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'dance.life').end().end();
    expect([a.hp(A1), a.stacks(A1, 'swiftness')]).toEqual([60, 0]);
  });

  it('Evergreen: ends after 3 turns', () => {
    const a = arena({ p0: [['dance.life']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'dance.life').end().pass(10);
    expect(a.hp(A1)).toBeLessThanOrEqual(40);
    expect(a.hp(A1)).toBeGreaterThanOrEqual(30);
  });

  it('Lifebloom: target ally heals 20, which can Flourish, and a Seedling appears when it does', () => {
    const a = arena({ p0: [['heal.life'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 95).use(A1, 'heal.life', A2).end();
    expect([a.hp(A2), maxHp(a, A2), minions(a, 0, 'seedling').length]).toEqual([115, 115, 1]);
  });

  it('Lifebloom: no Flourish, no Seedling', () => {
    const a = arena({ p0: [['heal.life'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 70).use(A1, 'heal.life', A2).end();
    expect([a.hp(A2), minions(a, 0).length]).toEqual([90, 0]);
  });

  it('Lifebloom: an ally already at the +30 limit doesn\'t Flourish, so no Seedling', () => {
    const a = arena({ p0: [['heal.life'], ['heal.life']], p1: [['shot']] });
    a.use(A1, 'heal.life', A2).use(A2, 'heal.life', A2).end().pass(3); // capped, 2 Seedlings
    expect(maxHp(a, A2)).toBe(130);
    const before = minions(a, 0).length;
    a.use(A1, 'heal.life', A2).end();
    expect(minions(a, 0).length).toBe(before);
  });

  it('Graft: 1 Might and +20 max HP, arriving filled, for 3 turns; it leaves when it ends', () => {
    const a = arena({ p0: [['bless.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.life', A2).end();
    expect([a.hp(A2), maxHp(a, A2), a.stacks(A2, 'might')]).toEqual([120, 120, 1]);
    a.pass(4);
    expect(maxHp(a, A2)).toBe(120);
    a.pass(2);
    expect([maxHp(a, A2), a.stacks(A2, 'might')]).toEqual([100, 0]);
    expect(a.hp(A2)).toBeLessThanOrEqual(100);
  });

  it('Graft: the extra max HP is not Flourish (Oakfist gains nothing)', () => {
    const a = arena({ p0: [['bless.life', 'strike.life']], p1: [['shot']] });
    a.use(A1, 'bless.life', A1).end().pass(1).use(A1, 'strike.life', B1).end();
    expect(a.hp(B1)).toBe(75); // 20 + 5 Might
  });

  it('Tangleweed: 1 Confusion for 2 turns', () => {
    const a = arena({ p0: [['curse.life']], p1: [['shot']] });
    a.use(A1, 'curse.life', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
    a.pass(4);
    expect(a.stacks(B1, 'confusion')).toBe(0);
  });

  it('Tangleweed: the target can\'t target the user\'s minions, but other enemies can', () => {
    const a = arena({ p0: [['curse.life', 'charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'curse.life', B1).end();
    const b = minions(a, 0, 'boulder')[0]!;
    expect(a.reject(() => a.use(B1, 'shot', b.id))).toBe('bad_target');
    a.use(B1, 'shot', A1).use(B2, 'shot', b.id).end();
    expect([a.hp(A1), a.unit(b.id).hp]).toEqual([85, 30]);
  });

  it('Tangleweed: area skills still hit the minions (simplified)', () => {
    const a = arena({ p0: [['curse.life', 'charge.earth']], p1: [['blast']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'curse.life', B1).end();
    const b = minions(a, 0, 'boulder')[0]!;
    a.use(B1, 'blast').end();
    expect(a.unit(b.id).hp).toBe(10);
  });

  it('Sunlit Glade: 20 damage; every ally (minions too) heals 5, which can Flourish; enemies don\'t', () => {
    const a = arena({ p0: [['smite.life'], ['charge.life']], p1: [['shot'], ['shot']] });
    a.use(A2, 'charge.life', B2).end().pass(1);
    const s = minions(a, 0, 'seedling')[0]!;
    a.setHp(A2, 50).use(A1, 'smite.life', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 85]);
    expect([maxHp(a, A1), a.hp(A2), maxHp(a, A2)]).toEqual([105, 55, 100]);
    expect(a.unit(s.id).maxHp).toBe(20);
  });

  it('Common Root: all allies heal 20 (no Flourish)', () => {
    const a = arena({ p0: [['prayer.life'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'prayer.life').end();
    expect([a.hp(A1), a.hp(A2), maxHp(a, A2)]).toEqual([70, 100, 100]);
  });

  it('Common Root: for 2 turns, damage to any unit on the user\'s side is split evenly among all of them', () => {
    const a = arena({ p0: [['prayer.life'], ['shot']], p1: [['strike']] });
    a.use(A1, 'prayer.life').end().use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([90, 90]);
  });

  it('Common Root: minions share the damage too', () => {
    const a = arena({ p0: [['prayer.life', 'charge.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'prayer.life').end();
    const b = minions(a, 0, 'boulder')[0]!;
    a.use(B1, 'shot', A1).end(); // 15 split three ways
    expect([a.hp(A1), a.hp(A2), a.unit(b.id).hp]).toEqual([95, 95, 40]);
  });

  it('Common Root: after 2 turns the damage is no longer shared', () => {
    const a = arena({ p0: [['prayer.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.life').end().pass(4).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 100]);
  });

  it('Whirling Vines: 10 to all enemies, 20 to minions; each enemy minion it kills becomes a Seedling for the user', () => {
    const a = arena({ p0: [['cleave.life']], p1: [['summon.earth'], ['shot']] });
    a.end().use(B1, 'summon.earth').end();
    const theirs = minions(a, 1, 'seedling');
    expect(theirs).toHaveLength(2);
    a.unit(theirs[1]!.id).maxHp = 50;
    a.unit(theirs[1]!.id).hp = 50; // survives
    a.use(A1, 'cleave.life').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    expect(a.unit(theirs[1]!.id).hp).toBe(30);
    expect(minions(a, 1)).toHaveLength(1);
    expect(minions(a, 0, 'seedling')).toHaveLength(1);
  });

  it('Call of the Grove: every allied Seedling Blooms now, and every allied minion heals to full', () => {
    const a = arena({ p0: [['shout.life', 'summon.earth'], ['charge.earth']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'summon.earth').use(A2, 'charge.earth', B1).end().pass(1);
    const b = minions(a, 0, 'boulder')[0]!;
    a.unit(b.id).hp = 10;
    a.use(A1, 'shout.life').end();
    expect(minions(a, 0, 'treant').map((t) => [t.hp, t.maxHp])).toEqual([[40, 40], [40, 40]]);
    expect(a.unit(b.id).hp).toBe(45);
  });

  it('Call of the Grove: a Seedling made by a non-Life ally Blooms too', () => {
    const a = arena({ p0: [['shout.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(1).use(A1, 'shout.life').end();
    expect(minions(a, 0, 'treant')).toHaveLength(2);
  });

  it('Call of the Grove: with no allied Seedling, the user creates one, and it Blooms at once', () => {
    const a = arena({ p0: [['shout.life']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'shout.life').end();
    expect([minions(a, 0).length, minions(a, 0, 'treant').map((t) => [t.hp, t.maxHp])]).toEqual([1, [[40, 40]]]);
  });

  it('Call of the Grove: with an allied Seedling already up, no new one is created', () => {
    const a = arena({ p0: [['shout.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(1).use(A1, 'shout.life').end();
    expect([minions(a, 0).length, minions(a, 0, 'treant').length]).toEqual([2, 2]); // the two Treants, nothing more
  });

  it('Call of the Grove: Treants don\'t count as Seedlings waiting to Bloom, so with only Treants out it creates one', () => {
    const a = arena({ p0: [['shout.life']], p1: [['shot']], passives: { p0c0: GROVE } });
    a.use(A1, 'shout.life').end().pass(7); // off cooldown, one Treant standing
    expect(minions(a, 0, 'treant')).toHaveLength(1);
    const t = minions(a, 0, 'treant')[0]!;
    a.unit(t.id).hp = 10;
    a.use(A1, 'shout.life').end();
    expect([minions(a, 0).length, minions(a, 0, 'treant').length, a.unit(t.id).hp]).toEqual([2, 2, 40]);
  });

  it('Call of the Grove: enemy Seedlings are untouched', () => {
    const a = arena({ p0: [['shout.life']], p1: [['summon.earth']], passives: { p0c0: GROVE } });
    a.end().use(B1, 'summon.earth').end().use(A1, 'shout.life').end();
    expect([minions(a, 1, 'seedling').length, minions(a, 1, 'treant').length]).toEqual([2, 0]);
  });

  it('Barkskin: 20 Shield for 2 turns; when it ends, what is left heals the user, which can Flourish', () => {
    const a = arena({ p0: [['withstand.life']], p1: [['shot']] });
    a.use(A1, 'withstand.life').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100); // 5 Shield left
    a.pass(1);
    expect(a.has(A1, 'barkskin')).toBe(true);
    a.pass(1);
    expect([a.has(A1, 'barkskin'), a.hp(A1), maxHp(a, A1)]).toEqual([false, 105, 105]);
  });

  it('Barkskin: untouched, it heals the full 20', () => {
    const a = arena({ p0: [['withstand.life']], p1: [['shot']] });
    a.setHp(A1, 70).use(A1, 'withstand.life').end().pass(3);
    expect([a.hp(A1), maxHp(a, A1)]).toEqual([90, 100]);
  });

  it('Barkskin: a broken Shield heals nothing', () => {
    const a = arena({ p0: [['withstand.life']], p1: [['smash']] });
    a.use(A1, 'withstand.life').end().use(B1, 'smash', A1).end().pass(2);
    expect([a.hp(A1), maxHp(a, A1)]).toEqual([95, 100]);
  });

  it('Warden Oak: with no minion the user Taunts the target for 2 turns', () => {
    const a = arena({ p0: [['taunt.life'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.life', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBeTypeOf('string');
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.pass(3).use(B1, 'shot', A2).end(); // turn 6: over
    expect(a.hp(A2)).toBe(85);
  });

  it('Warden Oak: other enemies aren\'t Taunted', () => {
    const a = arena({ p0: [['taunt.life'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.life', B1).end().use(B2, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Warden Oak: one of the user\'s minions does the Taunting when they have one', () => {
    const a = arena({ p0: [['taunt.life', 'charge.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'taunt.life', B1).end();
    const b = minions(a, 0, 'boulder')[0]!;
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTypeOf('string');
    a.use(B1, 'shot', b.id).end();
    expect([a.hp(A1), a.unit(b.id).hp]).toEqual([100, 30]);
  });

  it('Warden Oak: allied Seedlings that survive it Bloom when it ends, ahead of their own timer', () => {
    // The Seedlings' own Bloom is due at the end of turn 5; the Taunt ends at the end of turn 4.
    const a = arena({ p0: [['taunt.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').use(A1, 'taunt.life', B1).end().pass(2); // turns 2, 3
    expect(minions(a, 0, 'treant')).toHaveLength(0);
    a.pass(1); // turn 4 ends: the Taunt ends
    expect([minions(a, 0, 'seedling').length, minions(a, 0, 'treant').length]).toEqual([0, 2]);
  });

  it('Warden Oak: a Seedling killed during it does not Bloom', () => {
    const a = arena({ p0: [['taunt.life'], ['charge.life']], p1: [['strike']] });
    a.use(A2, 'charge.life', B1).use(A1, 'taunt.life', B1).end();
    const s = minions(a, 0, 'seedling')[0]!;
    a.use(B1, 'strike', s.id).end().pass(2);
    expect(minions(a, 0)).toHaveLength(0);
  });

  it('Ancient Treant: Immune and 1 Armor per allied minion for 3 turns; allied minions are Untargetable', () => {
    const a = arena({ p0: [['titan.life'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(1).use(A1, 'titan.life').end();
    expect([a.has(A1, 'immune'), a.stacks(A1, 'armor')]).toEqual([true, 2]);
    const s = minions(a, 0, 'seedling')[0]!;
    expect(a.reject(() => a.use(B1, 'shot', s.id))).toBe('bad_target');
    a.use(B1, 'shot', A1).end(); // turn 4: Armor 2 → 5 damage
    expect(a.hp(A1)).toBe(95);
    a.pass(5); // turns 5..9
    expect([a.has(A1, 'immune'), a.stacks(A1, 'armor')]).toEqual([false, 0]);
    a.use(B1, 'shot', s.id).end();
    expect(a.unit(s.id).hp).toBe(0);
  });

  it('Ancient Treant: with no minion, Immune but no Armor', () => {
    const a = arena({ p0: [['titan.life']], p1: [['shot']] });
    a.use(A1, 'titan.life').end();
    expect([a.has(A1, 'immune'), a.stacks(A1, 'armor')]).toEqual([true, 0]);
  });
});

describe('Life costs and cooldowns (Fusion Spec Kits table)', () => {
  const kit: [string, string, number][] = [
    ['strike.life', 'W', 0],
    ['smash.life', 'Sr', 2],
    ['charge.life', 'S', 2],
    ['riposte.life', 'r', 2],
    ['rage.life', 'SW', 4],
    ['shot.life', 'r', 0],
    ['snipe.life', 'Wr', 2],
    ['trap.life', 'A', 3],
    ['maneuver.life', 'r', 4],
    ['companion.life', 'I', 1],
    ['bolt.life', 'Ir', 1],
    ['blast.life', 'Irr', 2],
    ['consume.life', 'W', 2],
    ['summon.life', 'W', 1],
    ['channel.life', 'Ir', 3],
    ['stab.life', 'r', 0],
    ['ravage.life', 'Wr', 2],
    ['mislead.life', 'A', 2],
    ['stun.life', 'Ar', 3],
    ['dance.life', 'r', 2],
    ['heal.life', 'r', 1],
    ['bless.life', 'r', 2],
    ['curse.life', 'r', 2],
    ['smite.life', 'W', 1],
    ['prayer.life', 'Wrr', 2],
    ['cleave.life', 'W', 1],
    ['shout.life', 'S', 3],
    ['withstand.life', 'r', 3],
    ['taunt.life', 'W', 3],
    ['titan.life', 'WW', 4],
    ['treant_slam', 'nc', 0],
    ['acorn_crush', 'r', 0],
    ['dryad_mend', 'nc', 0],
  ];
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(kit)('%s costs %s, cooldown %i', (id, cost, cd) => {
    const def = content.skills[id]!;
    expect(def.cost).toEqual(parse(cost));
    expect(def.cooldown).toBe(cd);
  });

  it('tags match the descriptions: Invisible and Channeled where stated', () => {
    for (const id of ['riposte.life', 'trap.life', 'mislead.life']) expect(content.skills[id]!.tags).toContain('Invisible');
    for (const id of ['snipe.life', 'channel.life']) expect(content.skills[id]!.tags).toContain('Channeled');
  });
});
