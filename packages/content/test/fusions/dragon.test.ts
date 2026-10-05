// Spec-driven tests for the Dragon fusion (Fire + Fire), written from the in-game descriptions,
// docs/rules.md §21.1 and the "Pure fusions" design doc. Units: A1..A3 = p0c0..p0c2 (player 1, odd
// turns), B1..B3 = p1c0..p1c2. Ignite / Dragonfire burn at the end of their applier's turn.

import { describe, expect, it } from 'vitest';
import { effectDefinition, parseCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';
const HEART = { p0c0: ['wyrm_heart'] };

const channeling = (a: Arena, id: string) => a.effects(id).some((e) => effectDefinition(content, e)?.interruptible);
const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.defId === defId && u.alive);
const lastGain = (a: Arena, player: 0 | 1) => {
  const ev = a.events.filter((e) => e.t === 'energyGained' && e.player === player).at(-1);
  return ev && ev.t === 'energyGained' ? ev.gained.S + ev.gained.A + ev.gained.I + ev.gained.W : NaN;
};

describe('Dragon keywords', () => {
  it('Dragonfire: counts as Ignite and burns for 10 Affliction at the end of its applier\'s turn', () => {
    const a = arena({ p0: [['shot.dragon']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'shot.dragon', B1).end();
    // Shot's 10 is absorbed by the Shield; the burn is Affliction and goes through.
    expect([a.has(B1, 'dragonfire'), a.has(B1, 'ignite'), a.hp(B1)]).toEqual([true, true, 90]);
    a.pass(1); // B1's turn: no burn
    expect(a.hp(B1)).toBe(90);
    a.pass(1); // A1's turn: burns again
    expect(a.hp(B1)).toBe(80);
  });

  it('Dragonfire: applied to an Ignited unit it upgrades the Ignite (one 10 burn, not 5 + 10)', () => {
    const a = arena({ p0: [['strike.fire'], ['curse.dragon']], p1: [['shot']] });
    a.use(A1, 'strike.fire', B1).end(); // 25 + Ignite tick 5
    expect(a.hp(B1)).toBe(70);
    a.pass(1).use(A2, 'curse.dragon', B1).end(); // Slag on an Ignited target: Dragonfire, no damage
    expect(a.has(B1, 'dragonfire')).toBe(true);
    expect(a.stacks(B1, 'ignite')).toBe(1);
    expect(a.hp(B1)).toBe(70 - 10);
  });

  it('Hoard (Wyrm\'s Heart): each burn of an Ignite the character applied gives them 1 Hoard', () => {
    const a = arena({ p0: [['strike.fire']], p1: [['shot']], passives: HEART });
    a.use(A1, 'strike.fire', B1).end();
    expect(a.stacks(A1, 'hoard')).toBe(1);
    a.pass(2);
    expect(a.stacks(A1, 'hoard')).toBe(2);
  });

  it('Hoard: without Wyrm\'s Heart, burns give no Hoard', () => {
    const a = arena({ p0: [['strike.fire']], p1: [['shot']] });
    a.use(A1, 'strike.fire', B1).end();
    expect(a.stacks(A1, 'hoard')).toBe(0);
  });

  it('Hoard: every 2 Hoard gives 1 Armor (Normal damage only)', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot', 'ravage'], ['shot']] });
    a.give(A1, 'hoard', { stacks: 3 }).give(A2, 'hoard', { stacks: 1 });
    a.pass(1).use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([90, 85]); // 3 Hoard → 1 Armor; 1 Hoard → none
    a.pass(1).use(B1, 'ravage', A1).end(); // Piercing ignores Armor
    expect(a.hp(A1)).toBe(65);
  });

  it('Hoard: max 6', () => {
    const a = arena({ p0: [['consume.dragon']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'hoard', { stacks: 5 });
    for (const b of [B1, B2, B3]) a.give(b, 'ignite', { source: b });
    a.use(A1, 'consume.dragon', B1).end();
    expect(a.stacks(A1, 'hoard')).toBe(6);
  });

  it('Breath: spends all Hoard for 5 more damage per Hoard to each target', () => {
    const a = arena({ p0: [['blast.dragon']], p1: [['shot'], ['shot']] });
    a.give(A1, 'hoard', { stacks: 3 }).use(A1, 'blast.dragon').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'hoard')]).toEqual([100 - 35, 100 - 35, 0]);
  });
});

describe('Dragon skills', () => {
  it('Wyrmclaw: 20, plus 5 per 2 Hoard; Hoard isn\'t spent', () => {
    const a = arena({ p0: [['strike.dragon']], p1: [['shot']] });
    a.give(A1, 'hoard', { stacks: 5 }).use(A1, 'strike.dragon', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'hoard')]).toEqual([70, 5]);
    const b = arena({ p0: [['strike.dragon']], p1: [['shot']] });
    b.give(A1, 'hoard', { stacks: 1 }).use(A1, 'strike.dragon', B1).end();
    expect(b.hp(B1)).toBe(80);
  });

  it("Tail Sweep: 30 to the target only; each of their allies loses a random Buff, 1 Hoard per Buff taken", () => {
    const a = arena({ p0: [['smash.dragon']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'might').give(B2, 'might').use(A1, 'smash.dragon', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([70, 100, 100]);
    expect([a.has(B1, 'might'), a.has(B2, 'might'), a.stacks(A1, 'hoard')]).toEqual([true, false, 1]);
  });

  it('Tail Sweep: one Buff from each ally, picked at random; none to take, no Hoard', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ seed, p0: [['smash.dragon']], p1: [['shot'], ['shot'], ['shot']] });
      a.give(B2, 'might').give(B2, 'shield', { value: 20 }).give(B3, 'focus');
      a.use(A1, 'smash.dragon', B1).end();
      expect([a.has(B2, 'might'), a.has(B2, 'shield')].filter(Boolean).length).toBe(1);
      expect([a.has(B3, 'focus'), a.stacks(A1, 'hoard')]).toEqual([false, 2]);
    }
    const b = arena({ p0: [['smash.dragon']], p1: [['shot'], ['shot']] });
    b.give(B2, 'weakness').use(A1, 'smash.dragon', B1).end();
    expect([b.has(B2, 'weakness'), b.has(A1, 'hoard')]).toEqual([true, false]);
  });

  it('Dragon\'s Descent: 15, Ignites the target, and 1 Focus for the next skill', () => {
    const a = arena({ p0: [['charge.dragon', 'strike']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.dragon', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite'), a.has(B1, 'dragonfire'), a.stacks(A1, 'focus')]).toEqual([80, true, false, 1]);
  });

  it('Dragon\'s Descent: the next skill gives Dragonfire to each Ignited enemy it damages, only that one', () => {
    const a = arena({ p0: [['charge.dragon', 'smash']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'charge.dragon', B1).end().pass(1);
    a.use(A1, 'smash', B2).end(); // hits B2 (not Ignited) and its allies B1 (Ignited) and B3
    expect([a.has(B1, 'dragonfire'), a.has(B2, 'dragonfire'), a.has(B3, 'dragonfire')]).toEqual([true, false, false]);
    expect([a.has(A1, 'focus'), a.has(A1, 'dragons_descent')]).toEqual([false, false]);
  });

  it('Dragon\'s Descent: a skill that doesn\'t damage the Ignited enemy gives no Dragonfire', () => {
    const a = arena({ p0: [['charge.dragon', 'shot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'ignite', { source: B2 });
    a.use(A1, 'charge.dragon', B1).end().pass(1);
    a.use(A1, 'shot', B2).end(); // B2 was Ignited by someone else: still upgraded
    expect([a.has(B1, 'dragonfire'), a.has(B2, 'dragonfire')]).toEqual([false, true]);
  });

  it('Dragon\'s Toll: counters every Harmful skill used on the user for 1 turn', () => {
    const a = arena({ p0: [['riposte.dragon']], p1: [['smash'], ['shot']] });
    a.use(A1, 'riposte.dragon').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Dragon\'s Toll: 1 Hoard per energy each countered skill cost', () => {
    const a = arena({ p0: [['riposte.dragon']], p1: [['smash'], ['shot']] });
    a.use(A1, 'riposte.dragon').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end(); // Sr (2) + r (1)
    expect(a.stacks(A1, 'hoard')).toBe(3);
  });

  it('Dragon\'s Toll: lasts 1 turn only; Helpful skills aren\'t countered', () => {
    const a = arena({ p0: [['riposte.dragon']], p1: [['shot', 'heal']] });
    a.use(A1, 'riposte.dragon').end();
    a.use(B1, 'heal', B1).end();
    expect(a.stacks(A1, 'hoard')).toBe(0);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'hoard')]).toEqual([85, 0]);
  });

  it('Wyrm\'s Wrath: 2 Might, and 1 Hoard each time an enemy damages the user', () => {
    const a = arena({ p0: [['rage.dragon', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.dragon').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'hoard')).toBe(2);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Ember Spit: 10 and Dragonfire if not Ignited; 25 if Ignited', () => {
    const a = arena({ p0: [['shot.dragon']], p1: [['shot'], ['shot']] });
    a.give(B2, 'ignite', { source: B2 });
    a.use(A1, 'shot.dragon', B1).end();
    expect(a.hp(B1)).toBe(100 - 10 - 10); // 10 + the Dragonfire burn
    expect(a.has(B1, 'dragonfire')).toBe(true);
    a.pass(3).use(A1, 'shot.dragon', B2).end();
    expect(a.has(B2, 'dragonfire')).toBe(false);
    expect(a.hp(B2)).toBe(100 - 5 - 5 - 25); // two of B2's own ticks, then 25
  });

  it('Skyfall Breath: Untargetable until it lands; 35 plus Breath on the following turn', () => {
    const a = arena({ p0: [['snipe.dragon']], p1: [['shot'], ['shot']] });
    a.give(A1, 'hoard', { stacks: 2 }).use(A1, 'snipe.dragon', B1).end();
    expect(a.hp(B1)).toBe(100);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect([a.hp(B1), a.stacks(A1, 'hoard')]).toEqual([100 - 35 - 10, 0]);
    a.pass(1).use(B2, 'shot', A1).end(); // landed: targetable again
    expect(a.hp(A1)).toBe(85);
  });

  it('Gilded Bait: the first time the target gains a Buff they gain Dragonfire; it fires once', () => {
    const a = arena({ p0: [['trap.dragon']], p1: [['withstand', 'bless']] });
    a.use(A1, 'trap.dragon', B1).end();
    a.use(B1, 'withstand').end();
    expect(a.has(B1, 'dragonfire')).toBe(true);
    a.pass(1).use(B1, 'bless', B1).end();
    expect(a.has(B1, 'might')).toBe(true); // later Buffs stay
  });

  it('Gilded Bait: the target loses the first Buff they gain', () => {
    const a = arena({ p0: [['trap.dragon']], p1: [['withstand']] });
    a.use(A1, 'trap.dragon', B1).end();
    a.use(B1, 'withstand').end();
    expect(a.has(B1, 'shield')).toBe(false);
  });

  it('Gilded Bait: lasts 2 turns', () => {
    const a = arena({ p0: [['trap.dragon']], p1: [['withstand']] });
    a.use(A1, 'trap.dragon', B1).end().pass(4);
    a.use(B1, 'withstand').end();
    expect([a.has(B1, 'shield'), a.has(B1, 'dragonfire')]).toEqual([true, false]);
  });

  it('Burning Wake: Invulnerable for 1 turn; the user\'s Ignites also burn at the start of the bearer\'s turn', () => {
    const a = arena({ p0: [['maneuver.dragon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: A1 }).give(B2, 'ignite', { source: B2 });
    a.use(A1, 'maneuver.dragon').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    expect(a.hp(B1)).toBe(90); // end-of-turn tick + start-of-turn burn
    expect(a.hp(B2)).toBe(100); // not the user's Ignite
    a.end().end(); // Burning Wake is over
    const before = a.hp(B1);
    a.end();
    expect(a.hp(B1)).toBe(before); // no start-of-turn burn anymore
  });

  it('Drake: 40 HP; 1 Hoard for the user at the end of each turn while an enemy is Ignited', () => {
    const a = arena({ p0: [['companion.dragon']], p1: [['shot']] });
    a.use(A1, 'companion.dragon').end();
    const [drake] = minions(a, 'drake');
    expect(drake?.hp).toBe(40);
    expect(a.stacks(A1, 'hoard')).toBe(0);
    a.give(B1, 'ignite', { source: B1 }).pass(2);
    expect(a.stacks(A1, 'hoard')).toBe(1);
  });

  it('Drake Claw: 15 and Scorched for 1 turn', () => {
    const a = arena({ p0: [['companion.dragon']], p1: [['shot']] });
    a.use(A1, 'companion.dragon').end().pass(1);
    a.use(minions(a, 'drake')[0]!.id, 'drake_claw', B1).end();
    expect([a.hp(B1), a.has(B1, 'scorched')]).toEqual([85, true]);
    a.pass(2);
    expect(a.has(B1, 'scorched')).toBe(false);
  });

  it('Wyrmbolt: 20; an Ignited target\'s Ignite burns twice right away', () => {
    const a = arena({ p0: [['bolt.dragon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B2 });
    a.use(A1, 'bolt.dragon', B1);
    a.end();
    expect(a.hp(B1)).toBe(100 - 20 - 5 - 5);
    a.pass(3).use(A1, 'bolt.dragon', B2).end();
    expect(a.hp(B2)).toBe(80); // not Ignited: just 20
  });

  it('Wyrmbolt: each extra burn counts for Hoard', () => {
    const a = arena({ p0: [['bolt.dragon']], p1: [['shot']], passives: HEART });
    a.give(B1, 'ignite', { source: A1 }).use(A1, 'bolt.dragon', B1).end();
    expect(a.stacks(A1, 'hoard')).toBe(3); // two burns now + the end-of-turn burn
  });

  it('Great Breath: 20 to all plus Breath; Ignited enemies take 10 more', () => {
    const a = arena({ p0: [['blast.dragon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B1 }).give(A1, 'hoard', { stacks: 2 });
    a.use(A1, 'blast.dragon').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'hoard')]).toEqual([60, 70, 0]);
  });

  it('Devour Embers: every enemy Ignite ends, the user heals 10 and gains 1 Hoard for each; then 5 and Ignite on the target', () => {
    const a = arena({ p0: [['consume.dragon']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(A1, 50).give(B1, 'ignite', { source: B1 }).give(B2, 'ignite', { source: B2 });
    a.use(A1, 'consume.dragon', B3).end();
    expect(a.hp(A1)).toBe(70);
    expect(a.stacks(A1, 'hoard')).toBe(2 + 1); // 1 more from the new Ignite's first burn (Wyrm's Heart)
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.has(B3, 'ignite')]).toEqual([false, false, true]);
    expect(a.hp(B3)).toBe(100 - 5 - 5); // the 5 hit, then its new Ignite burns at the end of the user's turn
  });

  it('Devour Embers: with no Ignites, it Ignites the target; the next use devours that Ignite', () => {
    const a = arena({ p0: [['consume.dragon']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.dragon', B1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'ignite')]).toEqual([50, 90, true]); // 5, then the burn
    a.pass(5); // the Ignite burns on turns 3 and 5 too: 3 Hoard by now (Wyrm's Heart)
    expect(a.stacks(A1, 'hoard')).toBe(3);
    a.use(A1, 'consume.dragon', B2).end();
    expect(a.hp(A1)).toBe(60);
    expect(a.stacks(A1, 'hoard')).toBe(3 + 1 + 1); // devoured 1, then B2's new Ignite burned
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([false, true]);
  });

  it('Devour Embers: a Dragonfire goes out with its Ignite', () => {
    const a = arena({ p0: [['shot.dragon'], ['consume.dragon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.dragon', B1).end().pass(1);
    a.use(A2, 'consume.dragon', B2).end();
    const hp = a.hp(B1);
    a.pass(2);
    expect(a.hp(B1)).toBe(hp);
  });

  it('Dragon Egg: 30 HP; hatches into a permanent 30 HP Wyrmling after 3 turns', () => {
    const a = arena({ p0: [['summon.dragon']], p1: [['shot']] });
    a.use(A1, 'summon.dragon').end();
    expect(minions(a, 'dragon_egg').map((u) => u.hp)).toEqual([30]);
    a.pass(4);
    expect(minions(a, 'wyrmling')).toHaveLength(0);
    a.pass(1);
    expect(minions(a, 'dragon_egg')).toHaveLength(0);
    expect(minions(a, 'wyrmling').map((u) => u.hp)).toEqual([30]);
    a.pass(10);
    expect(minions(a, 'wyrmling')).toHaveLength(1);
  });

  it('Dragon Egg: a dead egg doesn\'t hatch', () => {
    const a = arena({ p0: [['summon.dragon']], p1: [['smash']] });
    a.use(A1, 'summon.dragon').end();
    const egg = minions(a, 'dragon_egg')[0]!;
    a.setHp(egg.id, 5).use(B1, 'smash', egg.id).end().pass(6);
    expect(minions(a, 'wyrmling')).toHaveLength(0);
  });

  it('Wyrmling Bite: 15 and Ignite', () => {
    const a = arena({ p0: [['summon.dragon']], p1: [['shot']] });
    a.use(A1, 'summon.dragon').end().pass(5);
    a.use(minions(a, 'wyrmling')[0]!.id, 'wyrmling_bite', B1).end();
    expect(a.has(B1, 'ignite')).toBe(true);
    expect(a.hp(B1)).toBe(100 - 15 - 5);
  });

  it('Wyrmfire Torrent: 10 to all each turn, 15 to those with Dragonfire; then a random enemy without it gains it', () => {
    const a = arena({ p0: [['channel.dragon']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'channel.dragon').end();
    // First tick: nobody had Dragonfire, so 10 each; then one gains it.
    const fired = [B1, B2].filter((b) => a.has(b, 'dragonfire'));
    expect(fired).toHaveLength(1);
    const other = fired[0] === B1 ? B2 : B1;
    expect(a.hp(other)).toBe(190);
    a.pass(1);
    const before = [a.hp(fired[0]!), a.hp(other)];
    a.end(); // second tick: 15 to the one with Dragonfire, 10 to the other; then the other gains it
    expect(before[1]! - a.hp(other)).toBe(10); // its new Dragonfire first burns next turn
    expect(before[0]! - a.hp(fired[0]!)).toBe(15 + 10); // the tick and its Dragonfire burn
    expect(a.has(other, 'dragonfire')).toBe(true);
  });

  it('Wyrmfire Torrent: lasts 3 turns', () => {
    const a = arena({ p0: [['channel.dragon']], p1: [['shot']], hp: 300 });
    a.use(A1, 'channel.dragon').end().pass(5); // ticks on turns 1, 3 and 5
    expect(channeling(a, A1)).toBe(false);
  });

  it('Fang: 5 now, and a fang sinks into the target; no Hoard yet', () => {
    const a = arena({ p0: [['stab.dragon']], p1: [['shot']] });
    a.use(A1, 'stab.dragon', B1).end();
    expect([a.hp(B1), a.has(B1, 'fang'), a.has(A1, 'hoard')]).toEqual([95, true, false]);
  });

  it("Fang: the user's next Fang on them tears it out for 25 and 1 Hoard; the one after bites again", () => {
    const a = arena({ p0: [['stab.dragon']], p1: [['shot']], hp: 200 });
    a.use(A1, 'stab.dragon', B1).end().pass(1);
    a.use(A1, 'stab.dragon', B1).end();
    expect([a.hp(B1), a.has(B1, 'fang'), a.stacks(A1, 'hoard')]).toEqual([200 - 5 - 25, false, 1]);
    a.pass(1).use(A1, 'stab.dragon', B1).end();
    expect([a.hp(B1), a.has(B1, 'fang')]).toEqual([165, true]);
  });

  it('Fang: the fang stays 2 turns; after that the next Fang just bites', () => {
    const a = arena({ p0: [['stab.dragon']], p1: [['shot']], hp: 200 });
    a.use(A1, 'stab.dragon', B1).end().pass(2);
    expect(a.has(B1, 'fang')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'fang')).toBe(false);
    a.use(A1, 'stab.dragon', B1).end();
    expect([a.hp(B1), a.has(A1, 'hoard')]).toEqual([190, false]);
  });

  it("Fang: only the user's own fang is torn out; another target just gets bitten", () => {
    const a = arena({ p0: [['stab.dragon'], ['stab.dragon']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'stab.dragon', B1).end().pass(1);
    a.use(A2, 'stab.dragon', B1).use(A1, 'stab.dragon', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'hoard'), a.has(A2, 'hoard')]).toEqual([190, 195, false, false]);
  });

  it('Molten Maw: 25 Piercing, 15 more if Scorched', () => {
    const a = arena({ p0: [['ravage.dragon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B2, 'scorched');
    a.use(A1, 'ravage.dragon', B1).end();
    expect(a.hp(B1)).toBe(75);
    a.pass(3).use(A1, 'ravage.dragon', B2).end();
    expect(a.hp(B2)).toBe(60);
  });

  it('Molten Maw: for 2 turns, each time the target\'s Ignite deals damage they\'re Scorched for 1 turn', () => {
    const a = arena({ p0: [['ravage.dragon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: A1 });
    a.use(A1, 'ravage.dragon', B1);
    a.end();
    expect(a.has(B1, 'scorched')).toBe(true);
    const b = arena({ p0: [['ravage.dragon']], p1: [['shot']] });
    b.use(A1, 'ravage.dragon', B1).end();
    expect(b.has(B1, 'scorched')).toBe(false); // no Ignite, no Scorch
  });

  it('Covetous Eye: counters the first enemy skill costing 3+, robs 1 energy from its user\'s player', () => {
    const a = arena({ p0: [['mislead.dragon']], p1: [['snipe'], ['shot']] });
    a.use(A1, 'mislead.dragon').end();
    a.use(B2, 'shot', A1).use(B1, 'snipe', A1).end();
    expect(a.hp(A1)).toBe(85); // Shot (1 energy) went through
    expect(channeling(a, B1)).toBe(false); // Snipe (3 energy) was countered
    expect(lastGain(a, 0)).toBe(1 + 1); // one character, plus the stolen energy
    a.end();
    expect(lastGain(a, 1)).toBe(2 - 1);
    a.end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Dragonfear: the target falls Asleep for 2 turns; no damage', () => {
    const a = arena({ p0: [['stun.dragon']], p1: [['shot']] });
    a.use(A1, 'stun.dragon', B1).end();
    expect(a.hp(B1)).toBe(100);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().pass(1);
    expect(() => a.use(B1, 'shot', A1)).not.toThrow();
  });

  it('Dragonfear: whatever wakes them makes them Explode (10 Affliction to their team), once', () => {
    const a = arena({ p0: [['stun.dragon'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(A2, 'flameborn').use(A1, 'stun.dragon', B1).end().pass(1);
    a.use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100 - 15 - 10, 90]);
    expect(a.hp(A2)).toBe(60); // Flameborn allies heal 10 on the user's side's Explosion
    expect(() => a.use(B1, 'shot', A1)).not.toThrow(); // awake
    a.end().use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 90]); // no second Explosion
  });

  it('Dragonfear: if nothing wakes them, no Explosion', () => {
    const a = arena({ p0: [['stun.dragon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.dragon', B1).end().pass(4);
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
  });

  it('Warming Wings: Swiftness and Focus; the user\'s Ignite burns heal the ally with the least HP as much', () => {
    const a = arena({ p0: [['dance.dragon'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(B1, 'ignite', { source: A1 }).give(B2, 'ignite', { source: A2 });
    a.use(A1, 'dance.dragon').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    expect(a.hp(A2)).toBe(55); // only A1's Ignite counts
  });

  it('Hearthfire: 15, plus 10 per Hoard spent, up to 3', () => {
    const a = arena({ p0: [['heal.dragon'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 30).give(A1, 'hoard', { stacks: 5 }).use(A1, 'heal.dragon', A2).end();
    expect([a.hp(A2), a.stacks(A1, 'hoard')]).toEqual([75, 2]);
    const b = arena({ p0: [['heal.dragon']], p1: [['shot']] });
    b.setHp(A1, 30).give(A1, 'hoard', { stacks: 1 }).use(A1, 'heal.dragon', A1).end();
    expect([b.hp(A1), b.stacks(A1, 'hoard')]).toEqual([55, 0]);
  });

  it('Dragonblood: for 2 turns the ally\'s damaging skills Ignite, or give Dragonfire if already Ignited', () => {
    const a = arena({ p0: [['bless.dragon'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.dragon', A2).use(A2, 'shot', B1).end();
    expect(a.has(B1, 'ignite')).toBe(true);
    expect(a.effects(B1).find((e) => e.defId === 'ignite')?.source).toBe(A2);
    expect(a.has(B1, 'dragonfire')).toBe(false);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.has(B1, 'dragonfire')).toBe(true);
    a.pass(3).use(A2, 'shot', B2).end(); // over
    expect(a.has(B2, 'ignite')).toBe(false);
  });

  it('Slag: loses Armor and Shield, 1 Vulnerable for 2 turns, Dragonfire', () => {
    const a = arena({ p0: [['curse.dragon']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B1, 'shield', { value: 20 });
    a.use(A1, 'curse.dragon', B1).end();
    expect([a.has(B1, 'armor'), a.has(B1, 'shield'), a.stacks(B1, 'vulnerable'), a.has(B1, 'dragonfire')]).toEqual([
      false,
      false,
      1,
      true,
    ]);
    a.pass(3);
    expect(a.has(B1, 'vulnerable')).toBe(false);
  });

  it('Pyre Brand: 20 and Scorched for 1 turn; when it ends, the target Explodes if still Ignited', () => {
    const a = arena({ p0: [['smite.dragon'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: A2 });
    a.use(A1, 'smite.dragon', B1).end();
    expect([a.hp(B1), a.has(B1, 'scorched')]).toEqual([75, true]);
    a.end(); // Scorch ends: Explosion, 10 to every enemy of the user
    expect([a.has(B1, 'scorched'), a.hp(B1), a.hp(B2)]).toEqual([false, 65, 90]);
  });

  it('Pyre Brand: no Explosion if the target isn\'t Ignited', () => {
    const a = arena({ p0: [['smite.dragon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smite.dragon', B1).end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
  });

  it('Dragon\'s Slumber: all allies heal 20 and gain 10 Shield; the user Sleeps and heals allies 20 each turn', () => {
    const a = arena({ p0: [['prayer.dragon', 'shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 20).setHp(A2, 10).use(A1, 'prayer.dragon').end();
    expect(a.effects(A2).find((e) => e.defId === 'shield')?.value).toBe(10);
    expect(a.has(A1, 'sleep')).toBe(true);
    const after1 = a.hp(A2);
    expect(after1).toBeGreaterThanOrEqual(30);
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    a.end();
    expect(a.hp(A2)).toBe(after1 + 20);
  });

  it('Dragon\'s Slumber: waking ends the healing', () => {
    const a = arena({ p0: [['prayer.dragon'], ['shot']], p1: [['smash']] });
    a.setHp(A2, 10).use(A1, 'prayer.dragon').end();
    a.use(B1, 'smash', A1).end(); // 25 through 10 Shield wakes the user
    expect(a.has(A1, 'sleep')).toBe(false);
    const hp = a.hp(A2);
    a.end();
    expect(a.hp(A2)).toBe(hp);
  });

  it('Wildfire Wing: 15 to the target, who gains Dragonfire, and the fire spreads at once: a random other enemy is Ignited (and burns as the user’s turn ends)', () => {
    const a = arena({ p0: [['cleave.dragon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.dragon', B1).end();
    expect([a.has(B1, 'dragonfire'), a.has(B2, 'ignite')]).toEqual([true, true]);
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 95]); // 15 + Dragonfire 10; the spread Ignite already burned for 5
    expect(a.has(B2, 'dragonfire')).toBe(false); // no second spread as this turn ends
  });

  it('Wildfire Wing: an enemy already Ignited gains Dragonfire from the spread instead', () => {
    const a = arena({ p0: [['cleave.dragon']], p1: [['shot'], ['shot']] });
    a.give(B2, 'ignite', { source: A1 }).use(A1, 'cleave.dragon', B1).end();
    expect([a.has(B2, 'ignite'), a.has(B2, 'dragonfire'), a.hp(B2)]).toEqual([true, true, 90]); // burns for 10
  });

  it('Wildfire Wing: the spread never lands on the target, and Ignites it gives are the user’s, permanent like any Ignite', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['cleave.dragon']], p1: [['shot'], ['shot'], ['shot']], seed });
      a.use(A1, 'cleave.dragon', B2).end();
      const lit = [B1, B3].filter((b) => a.has(b, 'ignite'));
      expect(lit.length).toBe(1);
      const ig = a.effects(lit[0]!).find((e) => e.defId === 'ignite')!;
      expect([ig.source, ig.duration]).toEqual([A1, null]);
    }
  });

  it('Wildfire Wing: it spreads once more at the end of the user’s next turn (an Ignited enemy gains Dragonfire), then no more', () => {
    const a = arena({ p0: [['cleave.dragon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.dragon', B1).end().pass(1).end();
    expect([a.hp(B1), a.has(B2, 'dragonfire')]).toEqual([65, true]);
    expect(a.has(B1, 'wildfire_wing')).toBe(false);
  });

  it('Wildfire Wing: once the target’s Dragonfire is gone, it doesn’t spread again', () => {
    const a = arena({ p0: [['cleave.dragon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.dragon', B1).end();
    a.state.effects = a.state.effects.filter((e) => !(e.bearer === B1 && (e.defId === 'dragonfire' || e.defId === 'ignite')));
    a.pass(1).end();
    expect([a.has(B2, 'ignite'), a.has(B2, 'dragonfire')]).toEqual([true, false]);
  });

  it('Wildfire Wing: with no other enemy, nothing spreads', () => {
    const a = arena({ p0: [['cleave.dragon']], p1: [['shot']] });
    a.use(A1, 'cleave.dragon', B1).end().pass(1).end();
    expect([a.hp(B1), a.has(B1, 'dragonfire')]).toEqual([65, true]);
  });

  it('Terrible Roar: all enemies Intimidated for 2 turns; healing one Ignites them', () => {
    const a = arena({ p0: [['shout.dragon']], p1: [['heal'], ['shot']] });
    a.use(A1, 'shout.dragon').end();
    expect([a.stacks(B1, 'intimidated'), a.stacks(B2, 'intimidated')]).toEqual([1, 1]);
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, false]);
  });

  it('Terrible Roar: healing after it ends doesn\'t Ignite', () => {
    const a = arena({ p0: [['shout.dragon']], p1: [['heal']] });
    a.use(A1, 'shout.dragon').end().pass(4);
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.has(B1, 'ignite')).toBe(false);
  });

  it('Furnace Hide: a random enemy gains Dragonfire, banked: it doesn’t burn, and as the user’s turn ends they gain 15 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.dragon']], p1: [['shot']] });
    a.use(A1, 'withstand.dragon').end();
    expect([a.has(B1, 'dragonfire'), a.has(B1, 'ignite'), a.hp(B1), a.stacks(A1, 'hoard')]).toEqual([true, true, 100, 0]);
    expect(a.effects(A1).filter((e) => e.defId === 'shield').map((e) => e.value)).toEqual([15]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Furnace Hide: it stokes again at the end of the user’s next turn; after its 2 turns the banked fire goes out (Dragonfire and Ignite)', () => {
    const a = arena({ p0: [['withstand.dragon']], p1: [['shot']] });
    a.use(A1, 'withstand.dragon').end().pass(1);
    const shields = () => a.effects(A1).filter((e) => e.defId === 'shield').length;
    expect(shields()).toBe(0); // the first 15 lasted 1 turn
    a.end();
    expect([shields(), a.hp(B1), a.has(B1, 'dragonfire')]).toEqual([1, 100, true]);
    a.pass(1);
    expect([a.has(B1, 'banked_fire'), a.has(B1, 'dragonfire'), a.has(B1, 'ignite')]).toEqual([false, false, false]);
    a.pass(1);
    expect([shields(), a.hp(B1)]).toEqual([0, 100]);
  });

  it('Furnace Hide: once that enemy’s Dragonfire is gone, no more Shield', () => {
    const a = arena({ p0: [['withstand.dragon']], p1: [['shot']] });
    a.use(A1, 'withstand.dragon').end().pass(1);
    a.state.effects = a.state.effects.filter((e) => !(e.bearer === B1 && (e.defId === 'dragonfire' || e.defId === 'ignite')));
    a.end();
    expect(a.effects(A1).some((e) => e.defId === 'shield')).toBe(false);
  });

  it('Furnace Hide: a Dragonfire the enemy already had is banked too, and goes out with it', () => {
    const a = arena({ p0: [['withstand.dragon'], ['shot.dragon']], p1: [['shot']] });
    a.use(A2, 'shot.dragon', B1).end(); // 10 + Dragonfire burning 10
    expect(a.hp(B1)).toBe(80);
    a.pass(1).use(A1, 'withstand.dragon').end();
    expect([a.hp(B1), a.effects(A1).some((e) => e.defId === 'shield')]).toEqual([80, true]);
    a.pass(3);
    expect([a.has(B1, 'dragonfire'), a.hp(B1)]).toEqual([false, 80]);
  });

  it('Wyrm\'s Domain: Taunt for 2 turns; another enemy using a Harmful skill on the user\'s allies takes 10', () => {
    const a = arena({ p0: [['taunt.dragon'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.dragon', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.use(B2, 'shot', A2).use(B1, 'shot', A1).end();
    expect([a.hp(B2), a.hp(B1)]).toEqual([90, 100]); // the Taunted enemy isn't punished
  });

  it('Elder Wyrm: 3 Hoard; for 3 turns, Immune and every Hoard gives 1 Armor', () => {
    const a = arena({ p0: [['titan.dragon']], p1: [['shot', 'curse']] });
    a.use(A1, 'titan.dragon').end();
    expect([a.stacks(A1, 'hoard'), a.has(A1, 'immune')]).toEqual([3, true]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100); // 3 Armor
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(3); // over: back to 1 Armor per 2 Hoard
    a.use(B1, 'shot', A1).end();
    expect([a.has(A1, 'immune'), a.hp(A1)]).toEqual([false, 90]);
  });
});

const KIT: [string, string, number][] = [
  ['strike', 'S', 0], ['smash', 'Sr', 2], ['charge', 'S', 2], ['riposte', 'r', 3], ['rage', 'SS', 4],
  ['shot', 'r', 1], ['trap', 'r', 2], ['maneuver', 'A', 3], ['companion', 'I', 1],
  ['bolt', 'Ir', 1], ['blast', 'SI', 2], ['consume', 'r', 2], ['summon', 'S', 1], ['channel', 'SI', 3],
  ['stab', 'r', 0], ['ravage', 'Ar', 1], ['mislead', 'A', 2], ['stun', 'S', 2], ['dance', 'Sr', 4],
  ['heal', 'r', 2], ['bless', 'S', 2], ['curse', 'S', 2], ['smite', 'W', 1], ['prayer', 'WS', 3],
  ['cleave', 'S', 1], ['shout', 'r', 3], ['withstand', 'r', 3], ['taunt', 'S', 3], ['titan', 'SW', 4],
];

describe('Dragon costs and cooldowns (design doc kit table)', () => {
  it.each(KIT)('%s.dragon costs %s, cooldown %i', (base, cost, cd) => {
    const s = content.skills[`${base}.dragon`]!;
    expect([s.cost, s.cooldown]).toEqual([parseCost(cost), cd]);
  });

  it('snipe.dragon costs Sr, cooldown 2', () => {
    const s = content.skills['snipe.dragon']!;
    expect([s.cost, s.cooldown]).toEqual([parseCost('Sr'), 2]);
  });
});
