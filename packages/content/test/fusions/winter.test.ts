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
    a.use(A2, 'curse.winter', B1).use(A1, 'stab.winter', B1).end();
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

  it('Snowslide: landing ends the user’s Leaping', () => {
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

  it('Ice Skate: the user gains 2 Swiftness for 2 turns', () => {
    const a = arena({ p0: [['charge.winter']], p1: [['shot']] });
    a.use(A1, 'charge.winter').end();
    expect([a.stacks(A1, 'swiftness'), appliedDur(a, A1, 'swiftness'), a.has(A1, 'rushing')]).toEqual([2, 4, false]);
  });

  it('Ice Skate: the next Harmful skill spends the Swiftness for 5 more damage per stack and Snowbinds what it damages for 1 turn', () => {
    const a = arena({ p0: [['charge.winter', 'blast']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.winter').end().end();
    a.use(A1, 'blast').end(); // base Blast: 35 to all, +10 each
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'swiftness')]).toEqual([55, 55, false]);
    expect([a.has(B1, 'snowbound'), a.has(B2, 'snowbound'), appliedDur(a, B1, 'snowbound')]).toEqual([true, true, 2]);
  });

  it('Ice Skate: a Stun the Swiftness stopped leaves fewer stacks to spend; only the next Harmful skill', () => {
    const a = arena({ p0: [['charge.winter', 'shot']], p1: [['stun']] });
    a.use(A1, 'charge.winter').end();
    a.use(B1, 'stun', A1).end(); // 1 Swiftness stops it; base Stun's 15 still lands
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    a.use(A1, 'shot', B1).end(); // base Shot 15, +5
    expect([a.hp(B1), a.has(B1, 'snowbound'), a.has(A1, 'swiftness'), a.has(A1, 'ice_skate')]).toEqual([80, true, false, false]);
    a.end();
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Ice Skate: Helpful skills don’t end the skate', () => {
    const a = arena({ p0: [['charge.winter', 'heal']], p1: [['shot']] });
    a.use(A1, 'charge.winter').end().end();
    a.use(A1, 'heal', A1).end();
    expect([a.has(A1, 'ice_skate'), a.stacks(A1, 'swiftness')]).toEqual([true, 2]);
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

  it('Whiteout: lands on the following turn: 60 Piercing split among the enemies who aren’t Immobile', () => {
    const a = arena({ p0: [['snipe.winter']], p1: [['charge'], ['charge'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'snipe.winter').end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([100, 100, 100]);
    a.end(); // B1 and B2 have a Charge (moving); p1c2 is Immobile
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([70, 70, 100]);
  });

  it('Whiteout: a lone moving enemy takes it all; Snowbound ones count as Immobile', () => {
    const a = arena({ p0: [['snipe.winter']], p1: [['charge'], ['charge'], ['shot']] });
    a.use(A1, 'snipe.winter').end();
    a.give(B2, 'snowbound', { source: A1 }).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([40, 100, 100]);
  });

  it('Whiteout: if every enemy is Immobile, it’s split among all of them', () => {
    const a = arena({ p0: [['snipe.winter']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'snipe.winter').end().end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([80, 80, 80]);
  });

  it('Whiteout: Channeled: Stunning the user before it lands stops it', () => {
    const a = arena({ p0: [['snipe.winter']], p1: [['stun'], ['shot']] });
    a.use(A1, 'snipe.winter').end();
    a.use(B1, 'stun', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
  });

  it('Snare of Frost: Invisible', () => {
    const a = arena({ p0: [['trap.winter']], p1: [['maneuver']] });
    a.use(A1, 'trap.winter', B1).end();
    expect(hidden(a, B1, 1)).toBe(true);
  });

  it('Snare of Frost: a mobility skill from the target is countered: 15 Piercing and Snowbound for 2 turns', () => {
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

  it('Snare of Frost: non-mobility skills don’t set it off', () => {
    const a = arena({ p0: [['trap.winter']], p1: [['shot']] });
    a.use(A1, 'trap.winter', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'snowbound')]).toEqual([85, 100, false]);
  });

  it('Powder Leap: the first enemy Harmful skill on the user: they Leap before it lands, and that enemy is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['maneuver.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.winter').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([false, false]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([100, true, true]);
    expect([a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([true, false]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(3); // applied on the enemy's turn
  });

  it('Powder Leap: only the first time; the spring is spent for every enemy', () => {
    const a = arena({ p0: [['maneuver.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.winter').end().use(B1, 'shot', A1).end();
    expect([a.has(B1, 'powder_leap'), a.has(B2, 'powder_leap')]).toEqual([false, false]);
  });

  it('Powder Leap: skills on the user’s allies don’t set it off; it lasts 2 turns', () => {
    const a = arena({ p0: [['maneuver.winter'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.winter').end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(A1, 'leaping'), a.has(B1, 'snowbound')]).toEqual([85, false, false]);
    a.end().use(B1, 'shot', A1).end(); // their 2nd turn: still ready
    expect([a.hp(A1), a.has(A1, 'leaping')]).toEqual([100, true]);
    const b = arena({ p0: [['maneuver.winter']], p1: [['shot']] });
    b.use(A1, 'maneuver.winter').end().pass(4).use(B1, 'shot', A1).end();
    expect([b.hp(A1), b.has(A1, 'leaping')]).toEqual([85, false]);
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

  it('Frostwind Bolt: 20 to the target; the gust carries on to a random other enemy: 10, Snowbound for 1 turn', () => {
    const a = arena({ p0: [['bolt.winter']], p1: [['shot'], ['shot']] });
    a.give(B2, 'swiftness').use(A1, 'bolt.winter', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound'), a.has(B2, 'snowbound'), a.has(B2, 'swiftness')]).toEqual([80, 90, false, true, false]);
    expect(appliedDur(a, B2, 'snowbound')).toBe(2);
  });

  it('Frostwind Bolt: the gust finds Immobile enemies too', () => {
    const a = arena({ p0: [['bolt.winter']], p1: [['charge'], ['shot']] });
    a.use(A1, 'bolt.winter', B1).end();
    expect([a.hp(B2), a.has(B2, 'snowbound')]).toEqual([90, true]);
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

  it('Steal Warmth: 5 damage; the user’s Frost debuffs (Snowbound included) move to the target; heals 10 + 10 per debuff', () => {
    const a = arena({ p0: [['consume.winter']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'chilled', { source: B1 }).give(A1, 'snowbound', { source: B1 }).give(A1, 'armor');
    a.use(A1, 'consume.winter', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 80]);
    expect([a.has(A1, 'chilled'), a.has(A1, 'snowbound'), a.has(A1, 'armor')]).toEqual([false, false, true]);
    expect([a.has(B1, 'chilled'), a.has(B1, 'snowbound')]).toEqual([true, true]);
  });

  it('Steal Warmth: with no chill to pass, the user just heals 10', () => {
    const a = arena({ p0: [['consume.winter']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.winter', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'snowbound')]).toEqual([95, 60, false]);
  });

  it('Snow Sprites: a Snow Sprite (20 HP) for 3 turns; Flurry (free) deals 5 Piercing to all enemies', () => {
    const a = arena({ p0: [['summon.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.winter').end();
    const s = minions(a, 'snow_sprite');
    expect(s.map((u) => u.hp)).toEqual([20]);
    a.end();
    a.give(B1, 'armor', { stacks: 3 }).use(s[0]!.id, 'snow_sprite_flurry').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound')]).toEqual([95, 95, false]);
    expect(content.skills.snow_sprite_flurry?.cost).toEqual({ S: 0, A: 0, I: 0, W: 0, r: 0 });
  });

  it('Snow Sprites: when its time runs out, it melts: every enemy is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['summon.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.winter').end();
    a.pass(4);
    expect([minions(a, 'snow_sprite').length, a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([1, false, false]);
    a.end();
    expect([minions(a, 'snow_sprite').length, a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([0, true, true]);
  });

  it('Snow Sprites: destroying it melts it too', () => {
    const a = arena({ p0: [['summon.winter']], p1: [['smash'], ['shot']] });
    a.use(A1, 'summon.winter').end();
    a.use(B1, 'smash', minions(a, 'snow_sprite')[0]!.id).end(); // 25 damage
    expect([minions(a, 'snow_sprite').length, a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([0, true, true]);
  });

  it('Long Winter: at the end of the user’s turns, 5, then 10, then 15 to all enemies; the third wave Snowbinds them for 2 turns', () => {
    const a = arena({ p0: [['channel.winter']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.winter').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound')]).toEqual([95, 95, false]);
    a.pass(2);
    expect([a.hp(B1), a.has(B1, 'snowbound')]).toEqual([85, false]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'snowbound'), a.has(B2, 'snowbound')]).toEqual([70, 70, true, true]);
    expect(appliedDur(a, B1, 'snowbound')).toBe(4);
    a.pass(2);
    expect(a.hp(B1)).toBe(70); // up to 3 turns
  });

  it('Long Winter: Channeled: using another skill ends it', () => {
    const a = arena({ p0: [['channel.winter', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.winter').end().end();
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80); // 5, then the Shot's 15; no 10-damage wave
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

  it('Snatching Gale: Invisible; the target’s Harmful skill is countered, and the gale holds it', () => {
    const a = arena({ p0: [['mislead.winter', 'shot']], p1: [['shot']] });
    a.use(A1, 'mislead.winter', B1).end();
    expect(hidden(a, B1, 1)).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(A1, 'snatched_skill')]).toEqual([100, 100, true]);
  });

  it('Snatching Gale: the user’s next Harmful skill unleashes it too, as their own, on that skill’s first target', () => {
    const a = arena({ p0: [['mislead.winter', 'shot']], p1: [['stun'], ['shot']] });
    a.use(A1, 'mislead.winter', B1).end();
    a.use(B1, 'stun', A1).end();
    expect([a.hp(A1), a.has(A1, 'stun')]).toEqual([100, false]);
    a.use(A1, 'shot', B2).end(); // Shot's 15, then the snatched Stun's 15 and Stun, on B2
    expect([a.hp(B2), a.has(B2, 'stun'), a.hp(B1), a.has(A1, 'snatched_skill')]).toEqual([70, true, 100, false]);
  });

  it('Snatching Gale: a snatched area skill hits the user’s enemies', () => {
    const a = arena({ p0: [['mislead.winter', 'shot'], ['shot']], p1: [['blast'], ['shot']] });
    a.use(A1, 'mislead.winter', B1).end();
    a.use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([50, 65, 100]);
  });

  it('Snatching Gale: held only until the end of the user’s next turn; unused by then, it’s lost', () => {
    const a = arena({ p0: [['mislead.winter', 'shot']], p1: [['stun'], ['shot']] });
    a.use(A1, 'mislead.winter', B1).end();
    a.use(B1, 'stun', A1).end();
    a.pass(1); // the user's next turn, without a Harmful skill
    expect(a.has(A1, 'snatched_skill')).toBe(false);
    a.pass(1).use(A1, 'shot', B2).end();
    expect([a.hp(B2), a.has(B2, 'stun')]).toEqual([85, false]);
  });

  it('Snatching Gale: only the first Harmful skill within 1 turn; Helpful skills don’t set it off', () => {
    const a = arena({ p0: [['mislead.winter']], p1: [['heal', 'shot']] });
    a.setHp(B1, 50).use(A1, 'mislead.winter', B1).end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(A1, 'snatched_skill')]).toEqual([75, false]);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 4: over
    expect(a.hp(A1)).toBe(85);
  });

  it('Squall: 15 damage and Snowbound for 2 turns; still Snowbound at the end of their next turn, they’re Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.winter']], p1: [['shot']] });
    a.use(A1, 'stun.winter', B1).end();
    expect([a.hp(B1), a.has(B1, 'snowbound'), a.has(B1, 'stun'), appliedDur(a, B1, 'snowbound')]).toEqual([85, true, false, 4]);
    a.use(B1, 'shot', A1).end(); // they still act this turn
    expect([a.hp(A1), a.has(B1, 'stun')]).toEqual([85, true]);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end().end();
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Squall: shaking off the Snowbound first means no Stun', () => {
    const a = arena({ p0: [['stun.winter']], p1: [['rage.wind']] });
    a.use(A1, 'stun.winter', B1).end();
    a.use(B1, 'rage.wind').end(); // Chainbreaker: removes their Debuffs
    expect([a.has(B1, 'snowbound'), a.has(B1, 'stun')]).toEqual([false, false]);
  });

  it('Squall: the Snowbound strips Swiftness, so it can’t stop the Stun', () => {
    const a = arena({ p0: [['stun.winter']], p1: [['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).use(A1, 'stun.winter', B1).end().end();
    expect([a.has(B1, 'stun'), a.has(B1, 'swiftness')]).toEqual([true, false]);
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

  it('Rime Mantle: meanwhile each enemy who damages them is Chilled for 1 turn', () => {
    const a = arena({ p0: [['bless.winter'], ['shot']], p1: [['shot'], ['heal']] });
    a.use(A1, 'bless.winter', A2).end();
    a.use(B1, 'shot', A2).use(B2, 'heal', B2).end();
    expect([a.hp(A2), a.has(B1, 'chilled'), a.has(B2, 'chilled')]).toEqual([85, true, false]);
    expect(appliedDur(a, B1, 'chilled')).toBe(3); // applied on the enemy's turn
  });

  it('Rime Mantle: a Chilled attacker’s Debuffs then can’t reach the Frostborn ally', () => {
    const a = arena({ p0: [['bless.winter'], ['shot']], p1: [['shot', 'curse']] });
    a.use(A1, 'bless.winter', A2).end();
    a.use(B1, 'shot', A2).end().end();
    expect(a.has(B1, 'chilled')).toBe(true);
    a.use(B1, 'curse', A2).end();
    expect(a.has(A2, 'confusion')).toBe(false);
  });

  it('Rime Mantle: wears off after 2 turns', () => {
    const a = arena({ p0: [['bless.winter'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.winter', A2).end().pass(4);
    a.use(B1, 'shot', A2).end();
    expect(a.has(B1, 'chilled')).toBe(false);
  });

  it('Snowbind: Snowbound for 1 turn; a target who uses no skill shakes it off', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['shot']] });
    a.use(A1, 'curse.winter', B1).end();
    expect([a.has(B1, 'snowbound'), appliedDur(a, B1, 'snowbound')]).toEqual([true, 2]);
    a.end();
    expect(a.has(B1, 'snowbound')).toBe(false);
  });

  it('Snowbind: each skill they use while it lasts adds 1 turn to it', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['shot']] });
    a.use(A1, 'curse.winter', B1).end();
    a.use(B1, 'shot', A1).end();
    a.end();
    expect(a.has(B1, 'snowbound')).toBe(true); // into their next turn
    a.end();
    expect(a.has(B1, 'snowbound')).toBe(false);
  });

  it('Snowbind: up to 3 times', () => {
    const a = arena({ p0: [['curse.winter']], p1: [['shot']] });
    a.use(A1, 'curse.winter', B1).end();
    for (let i = 0; i < 3; i++) a.use(B1, 'shot', A1).end().end(); // three extensions
    expect(a.has(B1, 'snowbound')).toBe(true);
    a.use(B1, 'shot', A1).end(); // a fourth adds nothing
    expect(a.has(B1, 'snowbound')).toBe(false);
  });

  it('Frostfeather: 20 damage; a single further hit doesn’t set the frost', () => {
    const a = arena({ p0: [['smite.winter'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.winter', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostbitten')]).toEqual([65, false]);
  });

  it('Frostfeather: the second time the user’s side damages them again, 10 Piercing and Frostbitten for 1 turn (not a Stun)', () => {
    const a = arena({ p0: [['smite.winter'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'smite.winter', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostbitten'), a.has(B1, 'stun')]).toEqual([100 - 10 - 5 - 5 - 10, true, false]);
    expect(appliedDur(a, B1, 'frostbitten')).toBe(2);
    a.use(B1, 'shot', A1).end(); // Shot isn't Strategic: they still act
    expect(a.hp(A1)).toBe(85);
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

  it('Winter’s Descent: 25 to the target; each other Immobile enemy takes 10; each one still moving takes 5 and is Snowbound for 1 turn', () => {
    const a = arena({ p0: [['cleave.winter']], p1: [['charge'], ['charge'], ['shot']] });
    a.use(A1, 'cleave.winter', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([75, 95, 90]);
    expect([a.has(B1, 'snowbound'), a.has(B2, 'snowbound'), a.has('p1c2', 'snowbound')]).toEqual([false, true, false]);
    expect(appliedDur(a, B2, 'snowbound')).toBe(2);
  });

  it('Winter’s Descent: a Snowbound enemy counts as Immobile', () => {
    const a = arena({ p0: [['cleave.winter']], p1: [['shot'], ['charge']] });
    a.give(B2, 'snowbound', { source: A1 }).use(A1, 'cleave.winter', B1).end();
    expect(a.hp(B2)).toBe(90);
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

  it('Call of the Cold: Snowbound for 1 turn, and Taunted by the user while Snowbound', () => {
    const a = arena({ p0: [['taunt.winter'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.winter', B1).end();
    expect([a.has(B1, 'snowbound'), appliedDur(a, B1, 'snowbound')]).toEqual([true, 2]);
    expect(() => a.use(B1, 'shot', A2)).toThrow();
    a.end().end(); // the Snowbound has worn off: so has the Taunt
    expect(a.has(B1, 'snowbound')).toBe(false);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Call of the Cold: the Taunt lasts as long as the Snowbound does, up to 3 turns', () => {
    const a = arena({ p0: [['taunt.winter'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.winter', B1).end();
    a.give(B1, 'snowbound', { source: A1 }); // kept Snowbound by other means
    a.end().end();
    expect(() => a.use(B1, 'shot', A2)).toThrow(); // 2nd turn
    a.end().end().end().end();
    a.use(B1, 'shot', A2).end(); // after 3 turns, free again
    expect(a.hp(A2)).toBe(85);
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
    'charge.winter': ['r', 1],
    'riposte.winter': ['r', 2],
    'rage.winter': ['I', 4],
    'shot.winter': ['r', 0],
    'snipe.winter': ['Ar', 2],
    'trap.winter': ['A', 3],
    'maneuver.winter': ['r', 3],
    'companion.winter': ['I', 1],
    'bolt.winter': ['Ir', 1],
    'blast.winter': ['Ar', 2],
    'consume.winter': ['r', 2],
    'summon.winter': ['r', 3],
    'channel.winter': ['II', 3],
    'stab.winter': ['r', 0],
    'ravage.winter': ['A', 1],
    'mislead.winter': ['Ir', 2],
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
