// Scenarios for the Shadow element (Stealth, Stealthy, Blinded, Sleep, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { formatEvent, redactEvents } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

describe('Shadow statuses', () => {
  it('Stealth: enemies can\'t target the bearer; a non-Stealthy skill ends it after resolving', () => {
    const a = arena({ p0: [['bless.shadow', 'stab.shadow']], p1: [['shot']] });
    a.use(A1, 'bless.shadow', A1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(1).use(A1, 'stab.shadow', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([75, false]); // Backstab still saw the Stealth
  });

  it('Stealth: a Stealthy skill keeps it and extends it by 1 turn', () => {
    const a = arena({ p0: [['bless.shadow', 'cleave.shadow']], p1: [['shot']] });
    a.use(A1, 'bless.shadow', A1).end().pass(1);
    const before = a.effects(A1).find((e) => e.defId === 'stealth')!.duration!;
    a.use(A1, 'cleave.shadow').end();
    expect(a.effects(A1).find((e) => e.defId === 'stealth')!.duration).toBe(before + 2 - 1);
  });

  it('Stealth: 2 turns without acting', () => {
    const a = arena({ p0: [['bless.shadow']], p1: [['shot']] });
    a.use(A1, 'bless.shadow', A1).end().pass(2);
    expect(a.has(A1, 'stealth')).toBe(true); // through the enemy's second turn
    a.pass(1);
    expect(a.has(A1, 'stealth')).toBe(false);
  });

  it('R6: the opponent only sees that a Stealthed unit acted', () => {
    const a = arena({ p0: [['bless.shadow', 'cleave.shadow']], p1: [['shot']] });
    a.use(A1, 'bless.shadow', A1).end().pass(1).use(A1, 'cleave.shadow').end();
    const used = a.last.filter((e) => e.t === 'skillUsed');
    const theirs = redactEvents(used, 1);
    expect(theirs.map((e) => formatEvent(content, a.state.units, e))).toEqual(['A Stealthed unit acted']);
    expect(redactEvents(used, 0)[0]).toMatchObject({ skill: 'cleave.shadow' });
  });

  it('Blinded: the primary target is re-rolled among legal targets', () => {
    const hits = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']], seed });
      a.give(B1, 'blinded', { source: A1 }).pass(1).use(B1, 'shot', A1).end();
      for (const u of [A1, A2]) if (a.hp(u) < 100) hits.add(u);
    }
    expect([...hits].sort()).toEqual([A1, A2]);
  });

  it('Sleep: stuns, and ends when the bearer takes damage', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'sleep', { source: A1 }).pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.has(B1, 'sleep')).toBe(false);
  });
});

describe('Shadow skills', () => {
  it('Black Axe: 25; a kill grants Stealth', () => {
    const a = arena({ p0: [['strike.shadow']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.shadow', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([75, false]);
    a.setHp(B2, 20).pass(1).use(A1, 'strike.shadow', B2).end();
    expect([a.unit(B2).alive, a.has(A1, 'stealth')]).toEqual([false, true]);
  });

  it('Shadow Crash: spends every allied Stealth for +10 per hit each', () => {
    const a = arena({ p0: [['smash.shadow'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stealth').give(A2, 'stealth').use(A1, 'smash.shadow', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A2, 'stealth')]).toEqual([70, 75, false]);
  });

  it('Long Shadow: Stealthy, and the next skill is Stealthy too', () => {
    const a = arena({ p0: [['charge.shadow', 'shot']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'charge.shadow', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth'), a.has(A1, 'long_shadow')]).toEqual([90, true, true]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.has(A1, 'stealth'), a.has(A1, 'long_shadow')]).toEqual([true, false]);
  });

  it('Mirage Blade: counters the first Harmful skill and grants Focus', () => {
    const a = arena({ p0: [['riposte.shadow']], p1: [['shot']] });
    a.use(A1, 'riposte.shadow').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'focus'), a.has(A1, 'mirage_blade')]).toEqual([100, true, false]);
  });

  it('Night of Knives: Might and Swiftness, Stealthy', () => {
    const a = arena({ p0: [['rage.shadow']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'rage.shadow').end();
    expect(['might', 'swiftness', 'stealth'].map((s) => a.has(A1, s))).toEqual([true, true, true]);
  });

  it('Shadow Spine: 5 Piercing, +1 hit each for Blinded, Isolated and Sleeping', () => {
    const a = arena({ p0: [['shot.shadow']], p1: [['shot']] });
    a.give(B1, 'blinded', { source: A1 }).give(B1, 'isolated', { source: A1 }).give(B1, 'sleep', { source: A1 });
    a.use(A1, 'shot.shadow', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([80, false]);
  });

  it('Dream Seeker: 35 a turn later, through Invulnerable, without waking', () => {
    const a = arena({ p0: [['snipe.shadow']], p1: [['shot']] });
    a.use(A1, 'snipe.shadow', B1).end();
    a.give(B1, 'invulnerable').give(B1, 'sleep', { source: A1 }).end().pass(1);
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([65, true]);
  });

  it('Dream Chains: a target that uses no skill takes 15 Affliction and falls Asleep', () => {
    const a = arena({ p0: [['trap.shadow']], p1: [['shot']] });
    a.use(A1, 'trap.shadow', B1).end().pass(1);
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([85, true]);
    const b = arena({ p0: [['trap.shadow']], p1: [['shot']] });
    b.use(A1, 'trap.shadow', B1).end().use(B1, 'shot', A1).end();
    expect([b.hp(B1), b.has(B1, 'sleep')]).toEqual([100, false]);
  });

  it('Shadowstep: Ghosted, Stealthy', () => {
    const a = arena({ p0: [['maneuver.shadow']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'maneuver.shadow').end();
    expect([a.has(A1, 'ghosted'), a.has(A1, 'stealth')]).toEqual([true, true]);
  });

  it('Spirit Raven: 30 HP; Fel Swoop heals it, Blackwing Taunts to the Raven', () => {
    const a = arena({ p0: [['companion.shadow']], p1: [['shot']] });
    a.use(A1, 'companion.shadow').end().pass(1);
    const raven = a.state.units.find((u) => u.owner === 0 && u.defId === 'spirit_raven')!;
    expect(raven.hp).toBe(30);
    a.unit(raven.id).hp = 15;
    a.use(raven.id, 'raven_fel_swoop', B1).end();
    expect([a.hp(B1), a.hp(raven.id)]).toEqual([90, 25]);
    a.pass(1).use(raven.id, 'raven_blackwing', B1).end();
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(raven.id);
  });

  it('Blackbolt: 20 and Blinded', () => {
    const a = arena({ p0: [['bolt.shadow']], p1: [['shot']] });
    a.use(A1, 'bolt.shadow', B1).end();
    expect([a.hp(B1), a.has(B1, 'blinded')]).toEqual([80, true]);
  });

  it('Wave of Darkness: 25 to all and Confusion', () => {
    const a = arena({ p0: [['blast.shadow']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.shadow').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B2, 'confusion')]).toEqual([75, 75, 1]);
  });

  it('Drink Darkness: 5 Affliction to all; Blinded enemies lose it and take 10 more', () => {
    const a = arena({ p0: [['consume.shadow']], p1: [['shot'], ['shot']] });
    a.give(B2, 'blinded', { source: A1 }).use(A1, 'consume.shadow').end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'blinded')]).toEqual([95, 85, false]);
  });

  it('Call Shade: 15 HP for 3 turns; Shadow Choke is 5 Affliction and Blind', () => {
    const a = arena({ p0: [['summon.shadow']], p1: [['shot']] });
    a.use(A1, 'summon.shadow').end().pass(1);
    const shade = a.state.units.find((u) => u.owner === 0 && u.defId === 'shade')!;
    expect(shade.hp).toBe(15);
    a.use(shade.id, 'shade_shadow_choke', B1).end();
    expect([a.hp(B1), a.has(B1, 'blinded')]).toEqual([95, true]);
  });

  it('Nightsong: 10 per turn; if it completes, all enemies fall Asleep', () => {
    const a = arena({ p0: [['channel.shadow']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.shadow').end().pass(5);
    expect([a.hp(B1), a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([70, true, true]);
  });

  it('Backstab: 10, or 25 from Stealth or against a Blinded target', () => {
    const a = arena({ p0: [['stab.shadow']], p1: [['shot'], ['shot']] });
    a.give(B2, 'blinded', { source: A1 }).use(A1, 'stab.shadow', B1).end().pass(1);
    a.use(A1, 'stab.shadow', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 75]);
  });

  it('Ambush: 20 Piercing, doubled from Stealth', () => {
    const a = arena({ p0: [['ravage.shadow']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'ravage.shadow', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([60, false]);
  });

  it('Illusory Lure: counters Harmful skills and Isolates the user', () => {
    const a = arena({ p0: [['mislead.shadow']], p1: [['shot']] });
    a.use(A1, 'mislead.shadow', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'isolated')]).toEqual([100, true]);
  });

  it('Sap: 10 and Sleep', () => {
    const a = arena({ p0: [['stun.shadow']], p1: [['shot']] });
    a.use(A1, 'stun.shadow', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([90, true]);
  });

  it('Hall of Phantoms: Stealth; from Stealth also Ghosted, Immune and Focus', () => {
    const a = arena({ p0: [['dance.shadow']], p1: [['shot']] });
    a.use(A1, 'dance.shadow').end();
    expect([a.has(A1, 'stealth'), a.has(A1, 'ghosted')]).toEqual([true, false]);
    a.give(A1, 'stealth').pass(3).use(A1, 'dance.shadow').end();
    expect(['stealth', 'ghosted', 'immune', 'focus'].map((s) => a.has(A1, s))).toEqual([true, true, true, true]);
  });

  it('Touch of Slumber: heals an ally 20 and puts them to Sleep', () => {
    const a = arena({ p0: [['heal.shadow'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.shadow', A2).end();
    expect([a.hp(A2), a.has(A2, 'sleep')]).toEqual([70, true]);
  });

  it('Blinding Powder: Blinded for 3 turns', () => {
    const a = arena({ p0: [['curse.shadow']], p1: [['shot']] });
    a.use(A1, 'curse.shadow', B1).end().pass(4);
    expect(a.has(B1, 'blinded')).toBe(true);
  });

  it('Shadowbrand: 10 and Sanctify; no cooldown when used from Stealth', () => {
    const a = arena({ p0: [['smite.shadow']], p1: [['shot']] });
    a.use(A1, 'smite.shadow', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify'), a.cooldown(A1, 'smite.shadow')]).toEqual([90, true, 1]);
    const b = arena({ p0: [['smite.shadow']], p1: [['shot']] });
    b.give(A1, 'stealth').use(A1, 'smite.shadow', B1).end();
    expect(b.cooldown(A1, 'smite.shadow')).toBe(0);
  });

  it('Nightfall: all allies gain Stealth and heal 20', () => {
    const a = arena({ p0: [['prayer.shadow'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'prayer.shadow').end();
    expect([a.hp(A2), a.has(A1, 'stealth'), a.has(A2, 'stealth'), a.has(A3, 'stealth')]).toEqual([70, true, true, true]);
  });

  it('Hunter\'s Howl: Blinds all enemies; already-Blinded ones are Intimidated instead', () => {
    const a = arena({ p0: [['shout.shadow']], p1: [['shot'], ['shot']] });
    a.give(B2, 'blinded', { source: A1 }).use(A1, 'shout.shadow').end();
    expect([a.has(B1, 'blinded'), a.has(B2, 'intimidated'), a.has(B1, 'intimidated')]).toEqual([true, true, false]);
  });

  it('Veiled Guard: permanent Armor; Stealth at 3+ Armor', () => {
    const a = arena({ p0: [['withstand.shadow']], p1: [['shot']] });
    a.use(A1, 'withstand.shadow').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'stealth')]).toEqual([1, false]);
    a.give(A1, 'armor').pass(3).use(A1, 'withstand.shadow').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'stealth')]).toEqual([3, true]);
  });

  it('Shadow Mockery: a 5 HP minion that the target is Taunted to', () => {
    const a = arena({ p0: [['taunt.shadow']], p1: [['shot']] });
    a.use(A1, 'taunt.shadow', B1).end();
    const mock = a.state.units.find((u) => u.owner === 0 && u.defId === 'shadow_mockery')!;
    expect(mock.hp).toBe(5);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B1, 'shot', mock.id).end();
    expect(a.unit(mock.id).alive).toBe(false);
  });

  it('Faceless One: Armor; all enemies Taunted by the user and Isolated', () => {
    const a = arena({ p0: [['titan.shadow'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.shadow').end();
    expect([a.stacks(A1, 'armor'), a.has(B1, 'taunt'), a.has(B2, 'isolated')]).toEqual([1, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });
});
