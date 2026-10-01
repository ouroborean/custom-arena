// Spec-driven scenarios for Faerie (Wind + Poison): the Charmed keyword, all 30 skills and both minions.
// Sources: skill/status descriptions, docs/rules.md §21.41, and the wind-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2 (player 2, even turns).

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

/** True if the unit carries an effect that is, or counts as, `key` (named or inline). */
function is(a: Arena, id: string, key: string): boolean {
  return a.effects(id).some((e) => {
    const def = e.inline ?? content.statuses[e.defId];
    return e.defId === key || def?.id === key || (def?.countsAs ?? []).includes(key);
  });
}
const charmed = (a: Arena, id: string) => is(a, id, 'charmed');
const prey = (a: Arena, id: string) => evaluateNamedCondition(content, a.state, 'prey', id);

/** Queues a skill if the engine allows it; returns false when the queue is rejected. */
function tryUse(a: Arena, actor: string, skill: string, target?: string): boolean {
  try {
    a.use(actor, skill, target);
    return true;
  } catch {
    return false;
  }
}

function minions(a: Arena, defId: string) {
  return a.state.units.filter((u) => u.defId === defId);
}

// ---------------------------------------------------------------------------------------------
describe('Faerie keyword: Charmed', () => {
  it('a Charmed unit\'s single-target skill lands on a random other unit, friend or foe', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const a = arena({ seed, p0: [['shot']], p1: [['shot'], ['shot']] });
      a.give(B1, 'charmed', { source: A1, duration: 2 });
      a.pass(1).use(B1, 'shot', A1).end();
      // Exactly 15 damage lands, on exactly one of the other two units; never on the user.
      expect(a.hp(B1)).toBe(100);
      expect(a.hp(A1) + a.hp(B2)).toBe(185);
      outcomes.add(a.hp(A1) < 100 ? 'foe' : 'friend');
    }
    expect([...outcomes].sort()).toEqual(['foe', 'friend']);
  });

  it('Charmed doesn\'t affect AoE skills', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['blast']] });
    a.give(B1, 'charmed', { source: A1, duration: 2 });
    a.pass(1).use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2), a.hp(B1)]).toEqual([65, 65, 100]);
  });

  it('an un-Charmed unit\'s skill goes where it was aimed', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = arena({ seed, p0: [['shot']], p1: [['shot'], ['shot']] });
      a.pass(1).use(B1, 'shot', A1).end();
      expect([a.hp(A1), a.hp(B2)]).toEqual([85, 100]);
    }
  });

  it('Charmed is a Debuff: Immune blocks it', () => {
    const a = arena({ p0: [['curse.faerie']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'curse.faerie', B1).end();
    expect(charmed(a, B1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('Faerie skills', () => {
  it('Thorned Kiss: 20 damage and 1 Toxin; no Charm if that doesn\'t make them Prey', () => {
    const a = arena({ p0: [['strike.faerie']], p1: [['shot']] });
    a.use(A1, 'strike.faerie', B1).end();
    expect(a.stacks(B1, 'toxin')).toBe(1);
    expect(a.hp(B1)).toBe(75); // 20 + the Toxin tick (5) at the end of the applier's turn
    expect(charmed(a, B1)).toBe(false);
  });

  it('Thorned Kiss: if the Toxin makes them Prey, they\'re Charmed for 1 turn', () => {
    const a = arena({ p0: [['strike.faerie']], p1: [['shot']] });
    a.give(B1, 'confusion', { stacks: 2, source: A1 }); // 2 stacks: not Prey yet
    expect(prey(a, B1)).toBe(false);
    a.use(A1, 'strike.faerie', B1).end();
    expect([prey(a, B1), charmed(a, B1)]).toEqual([true, true]);
    a.pass(1); // the enemy's turn passes
    expect(charmed(a, B1)).toBe(false);
  });

  it('Fairy Ring: 20 to the target and 10 to their allies', () => {
    const a = arena({ p0: [['smash.faerie']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.faerie', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 90, 90]);
    expect([charmed(a, B1), charmed(a, B2), charmed(a, B3)]).toEqual([false, false, false]);
  });

  it('Fairy Ring: each one hit with a mobility buff loses them all and is Charmed for 1 turn', () => {
    const a = arena({ p0: [['smash.faerie']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).give(B2, 'rushing').give(B2, 'leaping');
    a.use(A1, 'smash.faerie', B1).end();
    expect(['swiftness', 'rushing', 'leaping'].map((s) => a.has(B1, s) || a.has(B2, s))).toEqual([false, false, false]);
    expect([charmed(a, B1), charmed(a, B2), charmed(a, B3)]).toEqual([true, true, false]);
  });

  it('Thistledown Hop: 15 damage, then the user Leaps; the Hop doesn\'t spend that Leap', () => {
    const a = arena({ p0: [['charge.faerie', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.faerie', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([true, true]);
    expect(a.cooldown(A1, 'charge.faerie')).toBeGreaterThan(0);
    a.pass(1).use(A1, 'shot', B1).end(); // the next damaging skill gets +5 and ends the Leap
    expect([a.hp(B1), a.has(A1, 'leaping')]).toEqual([65, false]);
  });

  it('Prank: the first Harmful skill on the user is countered; a random ally of its user takes 15, and its user is Charmed', () => {
    const a = arena({ p0: [['riposte.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.faerie').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    // Only the first is countered: B1's shot hits B2 for 15 instead; B2's own shot lands normally.
    expect([a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([85, 100, 85]);
    expect([charmed(a, B1), charmed(a, B2)]).toEqual([true, false]);
  });

  it('Prank: Helpful skills aren\'t countered, and it lasts only 1 turn', () => {
    const a = arena({ p0: [['riposte.faerie']], p1: [['heal'], ['shot']] });
    a.use(A1, 'riposte.faerie').end();
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect([a.hp(B2), charmed(a, B1)]).toEqual([75, false]);
    a.pass(1).use(B2, 'shot', A1).end(); // a turn later: no counter left
    expect(a.hp(A1)).toBe(85);
  });

  it('Wild Hunt: for 3 turns, Immune and 1 Might', () => {
    const a = arena({ p0: [['rage.faerie', 'shot']], p1: [['curse']] });
    a.use(A1, 'rage.faerie').end();
    expect([a.has(A1, 'immune'), a.stacks(A1, 'might')]).toEqual([true, 1]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80); // 15 + 5 Might
    a.pass(4);
    expect([a.has(A1, 'immune'), a.stacks(A1, 'might')]).toEqual([false, 0]);
  });

  it('Wild Hunt: an enemy hit while Leaping is marked Prey for 2 turns; hits without a Leap mark nothing', () => {
    const a = arena({ p0: [['rage.faerie', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.faerie').end().pass(1);
    a.use(A1, 'shot', B2).end(); // not Leaping
    expect(prey(a, B2)).toBe(false);
    a.pass(1).give(A1, 'leaping').use(A1, 'shot', B1).end();
    expect([prey(a, B1), prey(a, B2)]).toEqual([true, false]);
    a.pass(2); // into the enemy's 2nd turn
    expect(prey(a, B1)).toBe(true);
    a.pass(1);
    expect(prey(a, B1)).toBe(false);
  });

  it('Pixie Dust: 10 damage and 1 Confusion', () => {
    const a = arena({ p0: [['shot.faerie']], p1: [['shot']] });
    a.use(A1, 'shot.faerie', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'confusion'), charmed(a, B1)]).toEqual([90, 1, false]);
  });

  it('Pixie Dust: if they already had Confusion, they\'re Charmed for 1 turn instead (no new Confusion)', () => {
    const a = arena({ p0: [['shot.faerie']], p1: [['shot']] });
    a.give(B1, 'confusion', { source: A1 }).use(A1, 'shot.faerie', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'confusion'), charmed(a, B1)]).toEqual([90, 1, true]);
    a.pass(1);
    expect(charmed(a, B1)).toBe(false);
  });

  it('Elfshot: 30 Affliction damage on the following turn, through Shield and Armor', () => {
    const a = arena({ p0: [['snipe.faerie']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'snipe.faerie', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
  });

  it('Elfshot: veers to another enemy with more Toxin; ties stay on the target', () => {
    const a = arena({ p0: [['snipe.faerie']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 1, source: B3 }).give(B2, 'toxin', { stacks: 2, source: B3 });
    a.give(B3, 'toxin', { stacks: 1, source: B3 });
    a.use(A1, 'snipe.faerie', B1).end().pass(2);
    // Toxin given from B3's side ticks on the enemy turn: B1 -5, B2 -10, B3 -5 so far.
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([95, 60, 95]);
    const b = arena({ p0: [['snipe.faerie']], p1: [['shot'], ['shot']] });
    b.give(B1, 'toxin', { stacks: 2, source: B2 }).give(B2, 'toxin', { stacks: 2, source: B2 });
    b.use(A1, 'snipe.faerie', B1).end().pass(2);
    expect([b.hp(B1), b.hp(B2)]).toEqual([60, 90]);
  });

  it('Elfshot: Uncounterable', () => {
    const a = arena({ p0: [['snipe.faerie']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'snipe.faerie', B1).end().pass(2);
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 70]);
  });

  it('Toadstool Circle: each Helpful skill the target uses gives them 1 Toxin and a 1-turn Charm', () => {
    const a = arena({ p0: [['trap.faerie']], p1: [['heal', 'shot'], ['shot']] });
    a.use(A1, 'trap.faerie', B1).end();
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(75); // the Charm comes after the Helpful skill
    expect([a.stacks(B1, 'toxin'), charmed(a, B1)]).toEqual([1, true]);
  });

  it('Toadstool Circle: Harmful skills don\'t trigger it, and it ends after 2 turns', () => {
    const a = arena({ p0: [['trap.faerie']], p1: [['heal', 'shot'], ['shot']] });
    a.use(A1, 'trap.faerie', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'toxin'), charmed(a, B1)]).toEqual([0, false]);
    a.pass(3); // to the enemy's 3rd turn: the trap is gone
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect([a.stacks(B1, 'toxin'), charmed(a, B1)]).toEqual([0, false]);
  });

  it('Petal Step: the user Leaps; the Leap adds 5 per Toxin on the target instead of 5', () => {
    const a = arena({ p0: [['maneuver.faerie', 'shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 3, source: B2 });
    a.use(A1, 'maneuver.faerie').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([true, true]);
    a.pass(1);
    const before = a.hp(B1);
    a.use(A1, 'shot', B1).end();
    expect(before - a.hp(B1)).toBe(30); // 15 + 3 × 5
    expect(a.has(A1, 'leaping')).toBe(false);
  });

  it('Petal Step: against a target with no Toxin the Leap adds nothing', () => {
    const a = arena({ p0: [['maneuver.faerie', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.faerie').end().pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Pixie: summons a permanent 25 HP Pixie; Befuddle Charms for 1 turn', () => {
    const a = arena({ p0: [['companion.faerie']], p1: [['shot']] });
    a.use(A1, 'companion.faerie').end();
    const [pixie] = minions(a, 'pixie');
    expect([pixie?.hp, pixie?.owner]).toEqual([25, 0]);
    a.pass(1).use(pixie!.id, 'pixie_befuddle', B1).end();
    expect(charmed(a, B1)).toBe(true);
    a.pass(1);
    expect(charmed(a, B1)).toBe(false);
    a.pass(10);
    expect(a.unit(pixie!.id).alive).toBe(true);
  });

  it('Pixie: Befuddle Charms a Prey target for 2 turns', () => {
    const a = arena({ p0: [['companion.faerie']], p1: [['shot']] });
    a.setHp(B1, 15); // below 20 HP: Prey
    a.use(A1, 'companion.faerie').end().pass(1);
    const [pixie] = minions(a, 'pixie');
    a.use(pixie!.id, 'pixie_befuddle', B1).end().pass(2);
    expect(charmed(a, B1)).toBe(true);
    a.pass(1);
    expect(charmed(a, B1)).toBe(false);
  });

  it('Pixie: Untargetable by enemies while any enemy is Charmed, targetable otherwise', () => {
    const a = arena({ p0: [['companion.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.faerie').end();
    const [pixie] = minions(a, 'pixie');
    a.use(B1, 'shot', pixie!.id).end(); // no one Charmed: the Pixie can be hit
    expect(a.hp(pixie!.id)).toBe(10);
    a.pass(1).give(B2, 'charmed', { source: A1, duration: 2 });
    expect(a.reject(() => a.use(B1, 'shot', pixie!.id))).toBe('bad_target');
  });

  it('Wisp Bolt: 20 damage and Marked for 1 turn', () => {
    const a = arena({ p0: [['bolt.faerie'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.faerie', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([80, true]);
  });

  it('Wisp Bolt: while it lasts, each turn the user starts Rushing, an ally gains 1 Swiftness and 1 Focus', () => {
    const a = arena({ p0: [['bolt.faerie', 'shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'rushing').use(A1, 'bolt.faerie', B1).end().pass(1);
    expect([a.stacks(A2, 'swiftness'), a.stacks(A2, 'focus')]).toEqual([1, 1]);
  });

  it('Wisp Bolt: no gift for allies when the user isn\'t Rushing', () => {
    const a = arena({ p0: [['bolt.faerie', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.faerie', B1).end().pass(1);
    expect([a.stacks(A2, 'swiftness'), a.stacks(A2, 'focus')]).toEqual([0, 0]);
  });

  it('Dust Storm: 15 to all enemies; each is Charmed until their next skill', () => {
    const a = arena({ p0: [['blast.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.faerie').end();
    expect([a.hp(B1), a.hp(B2), charmed(a, B1), charmed(a, B2)]).toEqual([85, 85, true, true]);
  });

  it('Dust Storm: a Charmed enemy\'s next skill picks at random, and that use ends their Charm', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const a = arena({ seed, p0: [['blast.faerie'], ['shot']], p1: [['shot']] });
      a.use(A1, 'blast.faerie').end().use(B1, 'shot', A1).end();
      expect(a.hp(A1) + a.hp(A2)).toBe(185); // 15 lands on exactly one of the two
      outcomes.add(a.hp(A1) < 100 ? 'aimed' : 'other');
      expect(charmed(a, B1)).toBe(false);
    }
    expect(outcomes.size).toBe(2);
  });

  it('Dust Storm: an enemy who uses no skill stays Charmed until they do', () => {
    const a = arena({ p0: [['blast.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.faerie').end().pass(2);
    expect(charmed(a, B2)).toBe(true);
  });

  it('Changeling\'s Bargain: 5 damage healing the user; a Debuff moves to them and a Buff moves to the user', () => {
    const a = arena({ p0: [['consume.faerie']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).give(A1, 'confusion', { source: B1 }).give(B1, 'swiftness');
    a.give(B2, 'might');
    a.use(A1, 'consume.faerie', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([55, 95]);
    expect([a.has(A1, 'confusion'), a.has(B1, 'confusion')]).toEqual([false, true]);
    expect([a.has(B1, 'swiftness'), a.has(A1, 'swiftness')]).toEqual([false, true]);
    expect(a.has(B2, 'might')).toBe(true); // other enemies are unaffected
  });

  it('Changeling\'s Bargain: with nothing to swap, it\'s just the drain', () => {
    const a = arena({ p0: [['consume.faerie']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.faerie', B1).end();
    expect([a.hp(A1), a.hp(B1), a.effects(A1).length, a.effects(B1).length]).toEqual([55, 95, 0, 0]);
  });

  it('Sprite Swarm: 2 Sprites with 10 HP for 3 turns; Pinch deals 5 Piercing', () => {
    const a = arena({ p0: [['summon.faerie']], p1: [['shot']] });
    a.use(A1, 'summon.faerie').end();
    const sprites = minions(a, 'sprite');
    expect(sprites.map((s) => [s.hp, s.owner])).toEqual([
      [10, 0],
      [10, 0],
    ]);
    a.give(B1, 'armor', { stacks: 3 }).pass(1).use(sprites[0]!.id, 'sprite_pinch', B1).end();
    expect(a.hp(B1)).toBe(95);
    a.pass(3);
    expect(minions(a, 'sprite').filter((s) => s.alive)).toHaveLength(0);
  });

  it('Sprite Swarm: an enemy who damages a Sprite is Charmed for 1 turn; others aren\'t', () => {
    const a = arena({ p0: [['summon.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.faerie').end();
    const [sprite] = minions(a, 'sprite');
    a.use(B1, 'shot', sprite!.id).use(B2, 'shot', A1).end();
    expect([charmed(a, B1), charmed(a, B2)]).toEqual([true, false]);
  });

  it('Midsummer Revel: each of the user\'s turns, a random enemy is Charmed, and Charmed enemies take 10 Affliction', () => {
    const a = arena({ p0: [['channel.faerie']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 });
    a.use(A1, 'channel.faerie').end();
    expect([a.hp(B1), charmed(a, B1)]).toEqual([90, true]);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
    a.pass(2); // 3 turns only
    expect(a.hp(B1)).toBe(70);
  });

  it('Midsummer Revel: only Charmed enemies take damage', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = arena({ seed, p0: [['channel.faerie']], p1: [['shot'], ['shot']] });
      a.use(A1, 'channel.faerie').end();
      expect([charmed(a, B1), charmed(a, B2)].filter(Boolean)).toHaveLength(1);
      expect(a.hp(B1) + a.hp(B2)).toBe(190);
    }
  });

  it('Midsummer Revel: Channeled — using another skill ends it', () => {
    const a = arena({ p0: [['channel.faerie', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.faerie').end().pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75); // first tick 10, then the shot 15; no second tick
  });

  it('Nettle Prick: 10 Piercing; until the user\'s next turn the target\'s Toxin also ticks at the start of their turn', () => {
    const a = arena({ p0: [['stab.faerie']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'stab.faerie', B1).end(); // 10 Piercing + 10 Toxin tick, then 10 more at the start of B's turn
    expect(a.hp(B1)).toBe(70);
    a.pass(1);
    expect(a.hp(B1)).toBe(70);
    a.pass(1); // the normal tick at the end of the user's turn
    expect(a.hp(B1)).toBe(60);
    a.pass(1); // the extra tick is gone
    expect(a.hp(B1)).toBe(60);
  });

  it('Nettle Prick: without Toxin it\'s just 10 Piercing', () => {
    const a = arena({ p0: [['stab.faerie']], p1: [['shot']] });
    a.use(A1, 'stab.faerie', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
  });

  it('Wasp Dive: spends all Swiftness for +10 per stack on 25 Piercing', () => {
    const a = arena({ p0: [['ravage.faerie']], p1: [['shot'], ['shot']] });
    a.give(A1, 'swiftness', { stacks: 2 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'ravage.faerie', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'swiftness')]).toEqual([55, 0]);
    a.pass(3).use(A1, 'ravage.faerie', B2).end();
    expect(a.hp(B2)).toBe(75);
  });

  it('Fae Wager: a Harmful skill from the target is countered; the user gains 1 Swiftness and 1 Focus', () => {
    const a = arena({ p0: [['mislead.faerie']], p1: [['shot']] });
    a.use(A1, 'mislead.faerie', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus'), charmed(a, A1)]).toEqual([100, 1, 1, false]);
  });

  it('Fae Wager: if the target uses no Harmful skill, the user is Charmed for 1 turn', () => {
    const a = arena({ p0: [['mislead.faerie']], p1: [['heal'], ['shot']] });
    a.use(A1, 'mislead.faerie', B1).end();
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(75); // Helpful skills aren't countered
    expect([charmed(a, A1), a.stacks(A1, 'swiftness')]).toEqual([true, 0]);
  });

  it('Enchanted Slumber: Asleep for 3 turns; damage doesn\'t wake them', () => {
    const a = arena({ p0: [['stun.faerie', 'shot']], p1: [['shot']] });
    a.use(A1, 'stun.faerie', B1).end();
    expect(is(a, B1, 'sleep')).toBe(true);
    if (tryUse(a, B1, 'shot', A1)) a.end();
    else a.end();
    expect(a.hp(A1)).toBe(100);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), is(a, B1, 'sleep')]).toEqual([85, true]);
  });

  it('Enchanted Slumber: without hits it lasts through the 3rd enemy turn; each hit cuts a turn', () => {
    const a = arena({ p0: [['stun.faerie', 'shot']], p1: [['shot']] });
    a.use(A1, 'stun.faerie', B1).end().pass(4);
    expect(is(a, B1, 'sleep')).toBe(true); // B's 3rd turn
    expect(tryUse(a, B1, 'shot', A1)).toBe(false);
    a.pass(1);
    expect(is(a, B1, 'sleep')).toBe(false);

    const b = arena({ p0: [['stun.faerie', 'shot']], p1: [['shot']] });
    b.use(A1, 'stun.faerie', B1).end().pass(1).use(A1, 'shot', B1).end().pass(2);
    expect(is(b, B1, 'sleep')).toBe(false); // one hit: only 2 enemy turns of Sleep
    b.use(B1, 'shot', A1).end();
    expect(b.hp(A1)).toBe(85);
  });

  it('Enchanted Slumber: counts as Sleep, so Swiftness negates it', () => {
    const a = arena({ p0: [['stun.faerie']], p1: [['shot']] });
    a.give(B1, 'swiftness').use(A1, 'stun.faerie', B1).end();
    expect([is(a, B1, 'sleep'), a.has(B1, 'swiftness')]).toEqual([false, false]);
  });

  it('Fey Reel: for 3 turns, 2 Might, 2 Swiftness, 1 Focus, and the user is Charmed', () => {
    const a = arena({ p0: [['dance.faerie']], p1: [['shot']] });
    a.use(A1, 'dance.faerie').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus'), charmed(a, A1)]).toEqual([
      2, 2, 1, true,
    ]);
    a.pass(6);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), charmed(a, A1)]).toEqual([0, 0, false]);
  });

  it('Fairy Tonic: an ally heals 20 and loses all Toxin, and isn\'t Charmed', () => {
    const a = arena({ p0: [['heal.faerie'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'toxin', { stacks: 3, source: B1 });
    a.use(A1, 'heal.faerie', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'toxin'), charmed(a, A2)]).toEqual([70, 0, false]);
  });

  it('Fairy Tonic: an enemy heals 20 and is Charmed for 1 turn, keeping their Toxin', () => {
    const a = arena({ p0: [['heal.faerie']], p1: [['shot']] });
    a.setHp(B1, 50).give(B1, 'toxin', { stacks: 2, source: B1 });
    a.use(A1, 'heal.faerie', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin'), charmed(a, B1)]).toEqual([70, 2, true]);
  });

  it('Fairy Wings: 2 Swiftness; a Stun it shrugs off Charms its source for 1 turn', () => {
    const a = arena({ p0: [['shot'], ['bless.faerie']], p1: [['stun'], ['stun']] });
    a.use(A2, 'bless.faerie', A1).end();
    expect(a.stacks(A1, 'swiftness')).toBe(2);
    a.use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.stacks(A1, 'swiftness'), charmed(a, B1), charmed(a, B2)]).toEqual([
      false,
      1,
      true,
      false,
    ]);
  });

  it('Fairy Wings: plain Swiftness (without the blessing) shrugs off a Stun but Charms no one', () => {
    const a = arena({ p0: [['shot']], p1: [['stun']] });
    a.give(A1, 'swiftness').pass(1).use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), charmed(a, B1)]).toEqual([false, false]);
  });

  it('Enthrall: Charmed for 2 turns', () => {
    const a = arena({ p0: [['curse.faerie']], p1: [['shot']] });
    a.use(A1, 'curse.faerie', B1).end().pass(2);
    expect(charmed(a, B1)).toBe(true);
    a.pass(2);
    expect(charmed(a, B1)).toBe(false);
  });

  it('Enthrall: an ally the Charmed enemy damages is Charmed too; a foe they hit isn\'t', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const a = arena({ seed, p0: [['curse.faerie']], p1: [['shot'], ['shot']] });
      a.use(A1, 'curse.faerie', B1).end().use(B1, 'shot', A1).end();
      if (a.hp(B2) < 100) {
        seen.add('ally');
        expect(charmed(a, B2)).toBe(true);
      } else {
        seen.add('foe');
        expect([a.hp(A1), charmed(a, B2), charmed(a, A1)]).toEqual([85, false, false]);
      }
    }
    expect([...seen].sort()).toEqual(['ally', 'foe']);
  });

  // SPEC: the description says only allies who used a Helpful skill on the target since the user's last turn are
  // Charmed; ruling 21.41 simplifies it to every enemy who acted in the last round. Tested per the ruling.
  it('Fey Mark: 20 damage; for 1 turn, an ally who uses a Helpful skill on the target is Charmed', () => {
    const a = arena({ p0: [['smite.faerie']], p1: [['shot'], ['heal'], ['shot']] });
    a.use(A1, 'smite.faerie', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B2, 'heal', B1).use(B3, 'shot', A1).end();
    expect([charmed(a, B1), charmed(a, B2), charmed(a, B3)]).toEqual([false, true, false]);
  });

  it('Fey Mark: Helpful skills on others, or after it ends, Charm no one', () => {
    const a = arena({ p0: [['smite.faerie']], p1: [['shot'], ['heal'], ['shot']] });
    a.use(A1, 'smite.faerie', B1).end();
    a.use(B2, 'heal', B3).end();
    expect(charmed(a, B2)).toBe(false);
    const b = arena({ p0: [['smite.faerie']], p1: [['shot'], ['heal'], ['shot']] });
    b.use(A1, 'smite.faerie', B1).end().pass(2).use(B2, 'heal', B1).end(); // turn 4: the mark ended with turn 2
    expect(charmed(b, B2)).toBe(false);
  });

  it('Fairy Song: all allies heal 20 and lose their Toxin; each stack goes to a random enemy', () => {
    const a = arena({ p0: [['prayer.faerie'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50);
    a.give(A1, 'toxin', { stacks: 2, source: B1 }).give(A2, 'toxin', { stacks: 1, source: B1 });
    a.use(A1, 'prayer.faerie').end();
    expect([a.hp(A1), a.hp(A2), a.stacks(A1, 'toxin'), a.stacks(A2, 'toxin')]).toEqual([70, 70, 0, 0]);
    expect(a.stacks(B1, 'toxin')).toBe(3);
  });

  it('Fairy Song: the moved stacks split over the enemies, 3 in total', () => {
    const a = arena({ p0: [['prayer.faerie']], p1: [['shot'], ['shot']] });
    a.give(A1, 'toxin', { stacks: 3, source: B1 });
    a.use(A1, 'prayer.faerie').end();
    expect(a.stacks(B1, 'toxin') + a.stacks(B2, 'toxin')).toBe(3);
  });

  it('Bewildering Petals: 20 to the target and 15 to one random other enemy', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = arena({ seed, p0: [['cleave.faerie']], p1: [['shot'], ['shot'], ['shot']] });
      a.use(A1, 'cleave.faerie', B1).end();
      expect(a.hp(B1)).toBe(80);
      expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 85]);
    }
  });

  it('Bewildering Petals: the target is Charmed for 1 turn, and their picks land only on their own allies', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = arena({ seed, p0: [['cleave.faerie']], p1: [['shot'], ['shot']] });
      a.use(A1, 'cleave.faerie', B1).end();
      expect(charmed(a, B1)).toBe(true);
      a.use(B1, 'shot', A1).end();
      expect([a.hp(A1), a.hp(B2)]).toEqual([100, 70]); // 15 from the cleave, 15 from B1's shot
    }
  });

  it('Fae Laughter: all enemies are Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.faerie']], p1: [['shot'], ['bolt']] });
    a.use(A1, 'shout.faerie').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.use(B2, 'bolt', A1).end();
    expect(a.cooldown(B2, 'bolt')).toBe(2); // CD 1 → 1 + 1 Intimidated, after this turn's tick
  });

  it('Fae Laughter: all enemies are Charmed until the first of them resolves a skill', () => {
    const a = arena({ p0: [['shout.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.faerie').end();
    expect([charmed(a, B1), charmed(a, B2)]).toEqual([true, true]);
    a.use(B1, 'shot', A1).end();
    expect([charmed(a, B1), charmed(a, B2)]).toEqual([false, false]);
  });

  it('Gossamer Veil: when it\'s broken, an enemy who hit it earlier is Charmed; one who never hit it isn\'t', () => {
    const a = arena({ p0: [['withstand.faerie']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'withstand.faerie').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // 15 absorbed, then 5 absorbed + 10 through
    expect(a.hp(A1)).toBe(90);
    expect([charmed(a, B1), charmed(a, B3)]).toEqual([true, false]);
  });

  it('Gossamer Veil: 20 Shield for 1 turn; when it expires, the enemy who hit it is Charmed, others aren\'t', () => {
    const a = arena({ p0: [['withstand.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.faerie').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), charmed(a, B1), charmed(a, B2)]).toEqual([100, true, false]);
    a.pass(1).use(B2, 'shot', A1).end(); // the Shield lasted 1 turn
    expect(a.hp(A1)).toBe(85);
  });

  it('Gossamer Veil: the enemy whose hit breaks it is Charmed too', () => {
    const a = arena({ p0: [['withstand.faerie']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'withstand.faerie').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // 15 absorbed, then 5 absorbed + 10 through
    expect(a.hp(A1)).toBe(90);
    expect([charmed(a, B1), charmed(a, B2), charmed(a, B3)]).toEqual([true, true, false]);
  });

  it('Gossamer Veil: if it expires unhit, no one is Charmed (no fallback)', () => {
    const a = arena({ p0: [['withstand.faerie', 'shot']], p1: [['shot']] });
    a.use(A1, 'withstand.faerie').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(charmed(a, B1)).toBe(false);
  });

  it('Fickle Heart: the target is Taunted by an ally of theirs for 1 turn, so they can\'t aim at the user\'s side', () => {
    const a = arena({ p0: [['taunt.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.faerie', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B2, 'shot', A1).end(); // the other enemy is unaffected
    expect(a.hp(A1)).toBe(85);
    a.pass(1).use(B1, 'shot', A1).end(); // 1 turn only
    expect(a.hp(A1)).toBe(70);
  });

  it('Fickle Heart: 2 turns against Prey', () => {
    const a = arena({ p0: [['taunt.faerie']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 15).use(A1, 'taunt.faerie', B1).end().pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Fickle Heart: the Taunted enemy\'s attack can be aimed at the taunting ally', () => {
    const a = arena({ p0: [['taunt.faerie']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.faerie', B1).end();
    a.use(B1, 'shot', B2).end();
    expect(a.hp(B2)).toBe(85);
  });

  it('Faerie Queen: 3 turns of 2 Armor and Immune', () => {
    const a = arena({ p0: [['titan.faerie']], p1: [['shot'], ['curse']] });
    a.use(A1, 'titan.faerie').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([2, true]);
    a.use(B2, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(4);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('Faerie Queen: an enemy who aims a single-target skill at the user is Charmed afterwards; AoE users aren\'t', () => {
    const a = arena({ p0: [['titan.faerie']], p1: [['shot'], ['blast']] });
    a.use(A1, 'titan.faerie').end();
    a.use(B1, 'shot', A1).use(B2, 'blast').end();
    expect(a.hp(A1)).toBe(100 - 5 - 25); // Armor 2 = −10 on each hit
    expect([charmed(a, B1), charmed(a, B2)]).toEqual([true, false]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('Faerie costs and cooldowns (kit table)', () => {
  const kit: [string, string, number][] = [
    ['strike', 'S', 0],
    ['smash', 'Ar', 2],
    ['charge', 'S', 1],
    ['riposte', 'r', 3],
    ['rage', 'W', 4],
    ['shot', 'r', 1],
    ['snipe', 'Ar', 2],
    ['trap', 'I', 3],
    ['maneuver', 'r', 3],
    ['companion', 'W', 1],
    ['bolt', 'I', 1],
    ['blast', 'Ar', 2],
    ['consume', 'r', 2],
    ['summon', 'W', 2],
    ['channel', 'II', 3],
    ['stab', 'r', 0],
    ['ravage', 'A', 1],
    ['mislead', 'A', 1],
    ['stun', 'W', 3],
    ['dance', 'AA', 4],
    ['heal', 'A', 1],
    ['bless', 'W', 2],
    ['curse', 'r', 2],
    ['smite', 'Wr', 1],
    ['prayer', 'Wrr', 2],
    ['cleave', 'Ar', 1],
    ['shout', 'W', 3],
    ['withstand', 'W', 2],
    ['taunt', 'r', 3],
    ['titan', 'SW', 4],
  ];
  const letters = (c: { S: number; A: number; I: number; W: number; r: number }) =>
    (['S', 'A', 'I', 'W', 'r'] as const).map((k) => k.repeat(c[k])).join('');

  it.each(kit)('%s.faerie costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.faerie`]!;
    expect([letters(s.cost), s.cooldown]).toEqual([cost, cd]);
  });

  it('minion skills: Befuddle costs A, Pinch costs nothing', () => {
    expect(content.skills.pixie_befuddle!.cost).toEqual({ S: 0, A: 1, I: 0, W: 0, r: 0 });
    expect(content.skills.sprite_pinch!.cost).toEqual({ S: 0, A: 0, I: 0, W: 0, r: 0 });
  });
});
