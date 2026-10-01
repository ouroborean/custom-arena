// Spec-driven tests for the Winter fusion (Ice + Wind): Snowbound and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.22 (and Wind §18.1 for Rushing/Leaping/Immobile),
// and the "Winter — Ice + Wind" kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Durations: "for N turns" applied on the applier's own turn is 2N internal ticks (rules §8.1);
// applied on the opponent's turn it's 2N + 1.

import { describe, expect, it } from 'vitest';
import { viewFor, type Energy, type GameEvent } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

type Applied = Extract<GameEvent, { t: 'effectApplied' }>;

function appliedDur(a: Arena, bearer: string, defId: string): number | null | undefined {
  const evs = a.last.filter((e): e is Applied => e.t === 'effectApplied' && e.bearer === bearer && e.defId === defId);
  return evs[evs.length - 1]?.duration;
}

function setEnergy(a: Arena, player: 0 | 1, e: Partial<Energy>): void {
  a.state.players[player].energy = { S: 0, A: 0, I: 0, W: 0, ...e };
}

function minions(a: Arena, defId: string) {
  return a.state.units.filter((u) => u.defId === defId && u.alive);
}

const hidden = (a: Arena, bearer: string, from: 0 | 1) => !viewFor(content, a.state, from).effects.some((e) => e.bearer === bearer && e.source !== bearer);
const MOBILITY = ['swiftness', 'rushing', 'leaping'];

describe('Winter keyword: Snowbound', () => {
  it('is a Debuff', () => {
    expect(content.statuses.snowbound?.kind).toBe('Debuff');
    const a = arena({ p0: [['curse.winter']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'curse.winter', B1).end();
    expect(a.has(B1, 'snowbound')).toBe(false);
  });

  it('strips Swiftness, Rushing and Leaping when gained', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).give(B1, 'rushing').give(B1, 'leaping').give(B1, 'might');
    a.use(A1, 'curse.winter', B1).end();
    expect(MOBILITY.map((k) => a.has(B1, k))).toEqual([false, false, false]);
    expect(a.has(B1, 'might')).toBe(true); // other Buffs stay
  });

  it('the bearer can’t gain new mobility buffs while it lasts', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['dance']] });
    a.use(A1, 'curse.winter', B1).end();
    a.use(B1, 'dance').end(); // base Dance gives 2 Swiftness
    expect([a.has(B1, 'swiftness'), a.has(B1, 'might')]).toEqual([false, true]);
  });

  it('mobility skills (Charge, Maneuver, Mislead, Dance) cost 1 more; others don’t', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['charge'], ['shot'], ['maneuver']] });
    a.use(A1, 'curse.winter', B1).end();
    a.use(B1, 'charge', A1).use(B2, 'shot', A1);
    const q = a.state.players[1].queue;
    expect([q[0]?.cost.S, q[0]?.cost.r]).toEqual([1, 1]);
    expect(q[1]?.cost.r).toBe(1);
  });

  it('the bearer counts as Immobile even with a mobility skill', () => {
    const a = arena({ p0: [['stab.winter'], ['curse.winter']], p1: [['charge']] });
    a.use(A1, 'stab.winter', B1).end().end();
    expect(a.hp(B1)).toBe(90); // has a Charge skill: not Immobile
    a.use(A2, 'curse.winter', B1).end().end();
    a.use(A1, 'stab.winter', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('counts as a Frost debuff for Winter skills (Shatterguard shatters it)', () => {
    const a = arena({ p0: [['riposte.winter'], ['curse.winter']], p1: [['shot']] });
    a.use(A1, 'riposte.winter').use(A2, 'curse.winter', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([85, false]);
  });
});

describe('Winter skills', () => {
  it('Bitter Blow: 20 damage; a moving target (Swiftness, Rushing or Leaping) is Snowbound for 2 turns', () => {
    for (const buff of MOBILITY) {
      const a = arena({ p0: [['strike.winter']], p1: [['shot']] });
      a.give(B1, buff).use(A1, 'strike.winter', B1).end();
      expect([buff, a.hp(B1), a.has(B1, 'snowbound'), a.has(B1, buff)]).toEqual([buff, 80, true, false]);
      expect(appliedDur(a, B1, 'snowbound')).toBe(4);
    }
  });

  it('Bitter Blow: a target that isn’t moving isn’t Snowbound', () => {
    const a = arena({ p0: [['strike.winter']], p1: [['shot']] });
    a.give(B1, 'might').use(A1, 'strike.winter', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([80, false]);
  });

  it('Snowslide: the user Leaps, then lands at the start of their next turn: 25 to the target, 15 to their allies', () => {
    const a = arena({ p0: [['smash.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.winter', B1).end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable'), a.hp(B1), a.hp(B2)]).toEqual([true, true, 100, 100]);
    a.end();
    // 25 and 15, each +5 from the user's own Leaping (rules §18.1)
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);
  });

  // SPEC: "if they're still Leaping, they land" reads as the landing ending the Leap, but Leaping (and its +5) stays for the next skill — should landing spend it?
  it.fails('Snowslide: landing ends the user’s Leaping', () => {
    const a = arena({ p0: [['smash.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.winter', B1).end().end();
    expect(a.has(A1, 'leaping')).toBe(false);
  });

  it('Snowslide: no landing if the user stopped Leaping', () => {
    const a = arena({ p0: [['smash.winter'], ['prayer.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.winter', B1).use(A2, 'prayer.winter').end(); // Snowed In strips the Leap
    expect(a.has(A1, 'leaping')).toBe(false);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
  });

  it('Ice Skate: free; the user begins Rushing, and their next damaging skill Snowbinds its targets for 1 turn', () => {
    const a = arena({ p0: [['charge.winter', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.winter').end();
    expect(a.has(A1, 'rushing')).toBe(true);
    a.end().use(A1, 'shot', B1).end();
    expect(a.has(B1, 'snowbound')).toBe(true);
    expect(appliedDur(a, B1, 'snowbound')).toBe(2);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.has(B1, 'snowbound')).toBe(false); // only the next one
  });

  it('Ice Skate: a Helpful skill doesn’t use up the Snowbind', () => {
    const a = arena({ p0: [['charge.winter', 'heal', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.winter').end().end().use(A1, 'heal', A1).end().end().use(A1, 'shot', B1).end();
    expect(a.has(B1, 'snowbound')).toBe(true);
  });

  it('Shatterguard: Invisible; counters the first Harmful skill; each Frost debuff on its user ends for 15 Piercing', () => {
    const a = arena({ p0: [['riposte.winter']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'riposte.winter').end();
    expect(hidden(a, A1, 1)).toBe(true);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'chilled'), a.has(B1, 'numb')]).toEqual([85, 70, false, false]);
  });

  it('Shatterguard: an attacker with no Frost debuffs is countered but takes nothing', () => {
    const a = arena({ p0: [['riposte.winter']], p1: [['shot']] });
    a.use(A1, 'riposte.winter').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 100]);
  });

  it('Heart of Winter: 1 Might and Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.winter']], p1: [['curse']] });
    a.use(A1, 'rage.winter').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([1, true, false]);
    a.pass(4);
    expect([a.has(A1, 'might'), a.has(A1, 'immune')]).toEqual([false, false]);
  });

  it('Heart of Winter: enemies who use a mobility skill are Snowbound for 2 turns; other skills don’t', () => {
    const a = arena({ p0: [['rage.winter']], p1: [['maneuver'], ['shot']] });
    a.use(A1, 'rage.winter').end();
    a.use(B1, 'maneuver').use(B2, 'shot', A1).end();
    expect([a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([true, false]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(5);
  });

  it('Snowball: 10, +5 per turn in a row; Snowbound for 1 turn from the third in a row', () => {
    const a = arena({ p0: [['shot.winter']], p1: [['shot']] });
    a.use(A1, 'shot.winter', B1).end().end();
    expect(a.hp(B1)).toBe(90);
    a.use(A1, 'shot.winter', B1).end().end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([75, false]);
    a.use(A1, 'shot.winter', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([55, true]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(2);
  });

  it('Snowball: skipping a turn resets the streak', () => {
    const a = arena({ p0: [['shot.winter']], p1: [['shot']] });
    a.use(A1, 'shot.winter', B1).end().end();
    a.pass(2); // no Snowball this turn
    a.use(A1, 'shot.winter', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Whiteout: every enemy is Snowbound until it lands; then 30 Piercing to the enemy team', () => {
    const a = arena({ p0: [['snipe.winter']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'snipe.winter').end();
    expect([a.hp(B1), a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([100, true, true]);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([70, 70, false, false]);
  });

  it('Snare of Frost: Invisible', () => {
    const a = arena({ p0: [['trap.winter']], p1: [['maneuver']] });
    a.use(A1, 'trap.winter', B1).end();
    expect(hidden(a, B1, 1)).toBe(true);
  });

  // BUG: text says a mobility skill (Charge/Maneuver/Mislead/Dance) is countered; Maneuver goes through untouched
  it.fails('Snare of Frost: a mobility skill from the target is countered: 15 Piercing and Snowbound for 2 turns', () => {
    const a = arena({ p0: [['trap.winter']], p1: [['maneuver']] });
    a.use(A1, 'trap.winter', B1).end().use(B1, 'maneuver').end();
    expect([a.has(B1, 'invulnerable'), a.hp(B1), a.has(B1, 'snowbound')]).toEqual([false, 85, true]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(5);
  });

  it('Snare of Frost: a Harmful mobility skill (Charge) is countered', () => {
    const a = arena({ p0: [['trap.winter']], p1: [['charge']] });
    a.use(A1, 'trap.winter', B1).end().use(B1, 'charge', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'snowbound')]).toEqual([100, 85, true]);
  });

  // BUG: text says only mobility skills set it off; a plain Shot is countered (15 Piercing + Snowbound)
  it.fails('Snare of Frost: non-mobility skills don’t set it off', () => {
    const a = arena({ p0: [['trap.winter']], p1: [['shot']] });
    a.use(A1, 'trap.winter', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'snowbound')]).toEqual([85, 100, false]);
  });

  it('Powder Leap: the user Leaps; the last enemy who damaged them is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['maneuver.winter']], p1: [['shot'], ['shot']] });
    a.pass(1).use(B1, 'shot', A1).end().end();
    a.use(B2, 'shot', A1).end();
    a.use(A1, 'maneuver.winter').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([true, true]);
    expect([a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([false, true]);
    expect(appliedDur(a, B2, 'snowbound')).toBe(2);
  });

  it('Powder Leap: nobody is Snowbound if no enemy has damaged the user', () => {
    const a = arena({ p0: [['maneuver.winter']], p1: [['shot']] });
    a.use(A1, 'maneuver.winter').end();
    expect([a.has(A1, 'leaping'), a.has(B1, 'snowbound')]).toEqual([true, false]);
  });

  it('Great Yeti: a permanent 80 HP Yeti; Yeti Maul (free) deals 30', () => {
    const a = arena({ p0: [['companion.winter']], p1: [['shot']] });
    a.use(A1, 'companion.winter').end();
    const y = minions(a, 'great_yeti')[0]!;
    expect(y.hp).toBe(80);
    a.end().use(y.id, 'great_yeti_maul', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Great Yeti: at the start of each of the user’s turns, their player pays 1 random energy to feed it', () => {
    const a = arena({ p0: [['companion.winter']], p1: [['shot']], richEnergy: false });
    a.use(A1, 'companion.winter').end();
    setEnergy(a, 0, { S: 3 });
    a.end(); // A's turn starts: +1 (one character), −1 for the Yeti
    const e = a.state.players[0].energy;
    expect(e.S + e.A + e.I + e.W).toBe(3);
    expect(minions(a, 'great_yeti')).toHaveLength(1);
  });

  it('Great Yeti: with no energy to pay, it leaves', () => {
    const a = arena({ p0: [['companion.winter']], p1: [['shot']], richEnergy: false });
    a.use(A1, 'companion.winter').end();
    setEnergy(a, 0, {});
    a.give(A1, 'sapped', { stacks: 3, source: B1 }); // generates nothing next turn
    a.end();
    expect(minions(a, 'great_yeti')).toHaveLength(0);
  });

  it('Frostwind Bolt: 20; a mobile target is Snowbound for 2 turns', () => {
    const a = arena({ p0: [['bolt.winter']], p1: [['charge', 'shot']] });
    a.use(A1, 'bolt.winter', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound'), a.has(B1, 'stun_ns')]).toEqual([80, true, false]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(4);
  });

  it('Frostwind Bolt: an Immobile target has their non-Strategic skills stunned for 1 turn instead', () => {
    const a = arena({ p0: [['bolt.winter']], p1: [['shot', 'curse']] });
    a.use(A1, 'bolt.winter', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([80, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true);
  });

  it('Polar Gale: 20 to all enemies; without Rushing or Leaping, no Snowbound', () => {
    const a = arena({ p0: [['blast.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.winter').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound')]).toEqual([80, 80, false]);
  });

  it('Polar Gale: while Rushing, the user stops and every enemy is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['blast.winter']], p1: [['shot'], ['shot']] });
    a.give(A1, 'rushing').use(A1, 'blast.winter').end();
    expect([a.has(A1, 'rushing'), a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([false, true, true]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(2);
  });

  it('Polar Gale: Rushing and Leaping both → Snowbound for 2 turns, and both stop', () => {
    const a = arena({ p0: [['blast.winter']], p1: [['shot'], ['shot']] });
    a.give(A1, 'rushing').give(A1, 'leaping').use(A1, 'blast.winter').end();
    expect([a.has(A1, 'rushing'), a.has(A1, 'leaping')]).toEqual([false, false]);
    expect(appliedDur(a, B2, 'snowbound')).toBe(4);
  });

  it('Steal Warmth: 5 damage, Snowbound for 1 turn; the user heals 10 and gains each mobility buff stripped', () => {
    const a = arena({ p0: [['consume.winter']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'swiftness').give(B1, 'rushing');
    a.use(A1, 'consume.winter', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'snowbound')]).toEqual([95, 60, true]);
    expect([a.has(A1, 'swiftness'), a.has(A1, 'rushing'), a.has(A1, 'leaping')]).toEqual([true, true, false]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(2);
  });

  it('Steal Warmth: nothing to strip, nothing gained', () => {
    const a = arena({ p0: [['consume.winter']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.winter', B1).end();
    expect([a.hp(A1), a.has(A1, 'swiftness'), a.has(A1, 'rushing')]).toEqual([60, false, false]);
  });

  it('Snow Sprites: 2 Sprites (10 HP) for 3 turns; Flurry deals 5 Piercing', () => {
    const a = arena({ p0: [['summon.winter']], p1: [['shot']] });
    a.use(A1, 'summon.winter').end();
    const s = minions(a, 'snow_sprite');
    expect(s.map((u) => u.hp)).toEqual([10, 10]);
    a.end();
    a.give(B1, 'armor', { stacks: 3 }).use(s[0]!.id, 'snow_sprite_flurry', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([95, false]);
    a.pass(4);
    expect(minions(a, 'snow_sprite')).toHaveLength(0);
  });

  it('Snow Sprites: a target hit by two Flurries in one turn is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['summon.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.winter').end().end();
    const [s1, s2] = minions(a, 'snow_sprite');
    a.use(s1!.id, 'snow_sprite_flurry', B1).use(s2!.id, 'snow_sprite_flurry', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([90, true]);
  });

  it('Snow Sprites: hits on two different targets don’t Snowbind', () => {
    const a = arena({ p0: [['summon.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.winter').end().end();
    const [s1, s2] = minions(a, 'snow_sprite');
    a.use(s1!.id, 'snow_sprite_flurry', B1).use(s2!.id, 'snow_sprite_flurry', B2).end();
    expect([a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([false, false]);
  });

  it('Long Winter: 10 to all enemies at the end of the user’s turns for up to 2 turns; a random one is Snowbound', () => {
    const a = arena({ p0: [['channel.winter']], p1: [['shot']] });
    a.use(A1, 'channel.winter').end();
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([90, true]);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
  });

  it('Long Winter: while it lasts, enemies’ Frost debuffs don’t wear off', () => {
    const a = arena({ p0: [['channel.winter']], p1: [['shot'], ['shot']] });
    a.give(B2, 'chilled', { source: A1, duration: 1 }).use(A1, 'channel.winter').end();
    expect(a.has(B2, 'chilled')).toBe(true);
    a.pass(2);
    expect(a.has(B2, 'chilled')).toBe(true);
  });

  it('Icicle Knife: 10, or 20 against an Immobile target', () => {
    const a = arena({ p0: [['stab.winter'], ['stab.winter']], p1: [['charge'], ['shot']] });
    a.use(A1, 'stab.winter', B1).use(A2, 'stab.winter', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound')]).toEqual([90, 80, false]);
  });

  it('Icicle Knife: while the user is Rushing, the target is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['stab.winter']], p1: [['charge']] });
    a.give(A1, 'rushing').use(A1, 'stab.winter', B1).end();
    expect(a.has(B1, 'snowbound')).toBe(true);
    expect(appliedDur(a, B1, 'snowbound')).toBe(2);
  });

  it('Frostbite Lunge: 25 Piercing; the user is Frostbitten for 1 turn and Frostborn for 2', () => {
    const a = arena({ p0: [['ravage.winter']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.winter', B1).end();
    expect([a.hp(B1), a.has(A1, 'frostbitten'), a.has(A1, 'frostborn')]).toEqual([75, true, true]);
    expect([appliedDur(a, A1, 'frostbitten'), appliedDur(a, A1, 'frostborn')]).toEqual([2, 4]);
  });

  it('Updraft Feint: Invisible; counters the target’s Harmful skill and the user Leaps', () => {
    const a = arena({ p0: [['mislead.winter']], p1: [['shot']] });
    a.use(A1, 'mislead.winter', B1).end();
    expect([hidden(a, B1, 1), a.has(A1, 'leaping')]).toEqual([true, false]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([100, true, true]);
  });

  it('Updraft Feint: Helpful skills go through, and the user doesn’t Leap', () => {
    const a = arena({ p0: [['mislead.winter']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.winter', B1).end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(A1, 'leaping')]).toEqual([75, false]);
  });

  it('Squall: 15 damage and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.winter']], p1: [['shot']] });
    a.use(A1, 'stun.winter', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([85, true]);
    expect(appliedDur(a, B1, 'stun')).toBe(2);
  });

  it('Squall: Swiftness can’t stop it; the target loses all Swiftness and it lasts 1 turn longer per stack', () => {
    const a = arena({ p0: [['stun.winter']], p1: [['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).use(A1, 'stun.winter', B1).end();
    expect([a.has(B1, 'stun'), a.has(B1, 'swiftness')]).toEqual([true, false]);
    a.end().end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // 2nd turn
    a.end().end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // 3rd turn
    a.end().end();
    a.use(B1, 'shot', A1).end();
  });

  it('Snow Dance: 1 Might, 2 Swiftness and Rushing for 3 turns', () => {
    const a = arena({ p0: [['dance.winter']], p1: [['shot']] });
    a.use(A1, 'dance.winter').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.has(A1, 'rushing')]).toEqual([1, 2, true]);
  });

  it('Snow Dance: whenever the user’s Swiftness stops a Stun, the Stun’s user is Snowbound for 2 turns', () => {
    const a = arena({ p0: [['dance.winter']], p1: [['stun'], ['shot']] });
    a.use(A1, 'dance.winter').end();
    a.use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.stacks(A1, 'swiftness'), a.has(B1, 'snowbound')]).toEqual([false, 1, true]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(5);
    expect(a.has(B2, 'snowbound')).toBe(false);
  });

  it('Thawing Wind: heals 20; meanwhile, damaging an enemy with a Frost debuff makes them begin Rushing', () => {
    const a = arena({ p0: [['heal.winter'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'chilled', { source: A1 });
    a.setHp(A2, 50).use(A1, 'heal.winter', A2).end();
    expect(a.hp(A2)).toBe(70);
    a.end().use(A2, 'shot', B2).end();
    expect(a.has(A2, 'rushing')).toBe(true);
  });

  it('Thawing Wind: damaging an enemy without a Frost debuff doesn’t', () => {
    const a = arena({ p0: [['heal.winter'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'chilled', { source: A1 });
    a.use(A1, 'heal.winter', A2).end().end().use(A2, 'shot', B1).end();
    expect(a.has(A2, 'rushing')).toBe(false);
  });

  it('Rime Mantle: Frostborn for 2 turns', () => {
    const a = arena({ p0: [['bless.winter'], ['shot.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.winter', A2).end();
    expect([a.has(A2, 'frostborn'), appliedDur(a, A2, 'frostborn')]).toEqual([true, 4]);
  });

  // BUG: text says Frost debuffs they apply while Frostborn last 1 turn longer; Icicle's 1-turn Chill and Snowbind's 2-turn Snowbound keep their normal durations
  it.fails('Rime Mantle: meanwhile Frost debuffs they apply last 1 turn longer', () => {
    const c = arena({ p0: [['bless.winter'], ['curse.winter']], p1: [['shot'], ['shot']] });
    c.use(A1, 'bless.winter', A2).end().end().use(A2, 'curse.winter', B2).end();
    expect(appliedDur(c, B2, 'snowbound')).toBe(6);
    const a = arena({ p0: [['bless.winter'], ['shot.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.winter', A2).end();
    a.end().use(A2, 'shot.ice', B1).end(); // Icicle: Chilled for 1 turn
    expect(appliedDur(a, B1, 'chilled')).toBe(4);
    const b = arena({ p0: [['shot'], ['shot.ice']], p1: [['shot']] }); // control
    b.use(A2, 'shot.ice', B1).end();
    expect(appliedDur(b, B1, 'chilled')).toBe(2);
  });

  it('Snowbind: Snowbound for 2 turns, and 1 Weakness per mobility buff stripped', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['shot']] });
    a.give(B1, 'swiftness').give(B1, 'leaping').use(A1, 'curse.winter', B1).end();
    expect([a.has(B1, 'snowbound'), a.stacks(B1, 'weakness')]).toEqual([true, 2]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(4);
    const b = arena({ p0: [['curse.winter']], p1: [['shot']] });
    b.use(A1, 'curse.winter', B1).end();
    expect(b.has(B1, 'weakness')).toBe(false);
  });

  it('Frostfeather: 20 damage; for 1 turn, allies who damage the target gain 1 Swiftness', () => {
    const a = arena({ p0: [['smite.winter'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.winter', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(A2, 'swiftness'), a.has(A3, 'swiftness'), a.has(B1, 'snowbound')]).toEqual([65, 1, false, false]);
  });

  it('Frostfeather: once two allies have, the target is Snowbound for 2 turns', () => {
    const a = arena({ p0: [['smite.winter'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.winter', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.stacks(A3, 'swiftness'), a.has(B1, 'snowbound')]).toEqual([1, true]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(4);
  });

  it('Snowed In: all allies heal 30 and gain 15 Shield for 1 turn; then every unit, the user included, is Snowbound', () => {
    const a = arena({ p0: [['prayer.winter'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).give(A2, 'swiftness').use(A1, 'prayer.winter').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([80, 80]);
    expect([A1, A2, B1, B2].map((u) => a.has(u, 'snowbound'))).toEqual([true, true, true, true]);
    expect(a.has(A2, 'swiftness')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(80); // Shield
    a.end().end();
    expect(a.has(A1, 'snowbound')).toBe(false);
  });

  it('Winter’s Descent: 25 to the target and 15 to another enemy; no Frostbite unless the user is Leaping', () => {
    const a = arena({ p0: [['cleave.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.winter', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'frostbitten'), a.has(B2, 'frostbitten')]).toEqual([75, 85, false, false]);
  });

  it('Winter’s Descent: while Leaping, both are Frostbitten for 1 turn', () => {
    const a = arena({ p0: [['cleave.winter']], p1: [['shot'], ['shot']] });
    a.give(A1, 'leaping').use(A1, 'cleave.winter', B1).end();
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'frostbitten')]).toEqual([true, true]);
    expect(appliedDur(a, B2, 'frostbitten')).toBe(2);
  });

  it('Howling Winds: mobile enemies are Snowbound for 2 turns; Immobile ones are Intimidated instead', () => {
    const a = arena({ p0: [['shout.winter']], p1: [['charge'], ['shot']] });
    a.use(A1, 'shout.winter').end();
    expect([a.has(B1, 'snowbound'), a.has(B1, 'intimidated'), a.has(B2, 'snowbound'), a.has(B2, 'intimidated')]).toEqual([true, false, false, true]);
    expect([appliedDur(a, B1, 'snowbound'), appliedDur(a, B2, 'intimidated')]).toEqual([4, 4]);
  });

  it('Howling Winds: a mobility buff alone makes an enemy mobile', () => {
    const a = arena({ p0: [['shout.winter']], p1: [['shot']] });
    a.give(B1, 'swiftness').use(A1, 'shout.winter').end();
    expect([a.has(B1, 'snowbound'), a.has(B1, 'intimidated')]).toEqual([true, false]);
  });

  it('Deepening Drift: 10 Shield for 3 turns, +10 at the start of each of the user’s turns', () => {
    const a = arena({ p0: [['withstand.winter', 'heal']], p1: [['smash']] });
    a.use(A1, 'withstand.winter').end().end(); // start of A's turn: +10
    a.use(A1, 'heal', A1).end(); // Helpful: doesn't melt it
    a.use(B1, 'smash', A1).end(); // 25 into 20 Shield
    expect(a.hp(A1)).toBe(95);
  });

  it('Deepening Drift: it all melts the moment the user uses a damaging skill', () => {
    const a = arena({ p0: [['withstand.winter', 'shot']], p1: [['shot']] });
    a.use(A1, 'withstand.winter').end().end();
    a.use(A1, 'shot', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Call of the Cold: Taunted for 2 turns; each Harmful skill they use on the user Snowbinds them for 1 turn', () => {
    const a = arena({ p0: [['taunt.winter'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.winter', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect(() => a.use(B1, 'shot', A2)).toThrow();
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'snowbound')).toBe(true);
    expect(appliedDur(a, B1, 'snowbound')).toBe(3);
  });

  it('Call of the Cold: Helpful skills don’t Snowbind', () => {
    const a = arena({ p0: [['taunt.winter']], p1: [['heal']] });
    a.use(A1, 'taunt.winter', B1).end().use(B1, 'heal', B1).end();
    expect(a.has(B1, 'snowbound')).toBe(false);
  });

  it('Dead of Winter: 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.winter']], p1: [['shot', 'curse']] });
    a.use(A1, 'titan.winter').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95);
    a.end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Dead of Winter: no unit in the battle can be healed, the user included', () => {
    const a = arena({ p0: [['titan.winter'], ['heal']], p1: [['heal']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(B1, 50);
    a.use(A1, 'titan.winter').use(A2, 'heal', A1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([50, 50]);
    a.pass(6);
    a.use(A2, 'heal', A2).end();
    expect(a.hp(A2)).toBe(75); // over after 3 turns
  });
});

describe('Winter costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    'strike.winter': ['S', 0],
    'smash.winter': ['Ar', 2],
    'charge.winter': ['nc', 1],
    'riposte.winter': ['r', 2],
    'rage.winter': ['I', 4],
    'shot.winter': ['r', 0],
    'snipe.winter': ['Ar', 2],
    'trap.winter': ['A', 3],
    'maneuver.winter': ['r', 3],
    'companion.winter': ['I', 1],
    'bolt.winter': ['I', 1],
    'blast.winter': ['Ar', 2],
    'consume.winter': ['r', 2],
    'summon.winter': ['r', 3],
    'channel.winter': ['II', 3],
    'stab.winter': ['r', 0],
    'ravage.winter': ['A', 1],
    'mislead.winter': ['I', 2],
    'stun.winter': ['A', 2],
    'dance.winter': ['AA', 5],
    'heal.winter': ['A', 1],
    'bless.winter': ['I', 2],
    'curse.winter': ['W', 2],
    'smite.winter': ['Wr', 1],
    'prayer.winter': ['Wr', 2],
    'cleave.winter': ['Ar', 1],
    'shout.winter': ['I', 2],
    'withstand.winter': ['r', 3],
    'taunt.winter': ['r', 3],
    'titan.winter': ['SW', 4],
    great_yeti_maul: ['nc', 0],
    snow_sprite_flurry: ['nc', 0],
  };
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(Object.entries(table))('%s costs %j', (id, [cost, cd]) => {
    const s = content.skills[id];
    expect(s).toBeDefined();
    expect({ ...s!.cost }).toEqual(parse(cost));
    expect(s!.cooldown ?? 0).toBe(cd);
  });
});
