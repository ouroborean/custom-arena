// Spec-driven scenarios for Storm (Lightning + Wind): Tempest, Eye of the Storm, Storm Heart and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.35, and the design doc kit table (lightning-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition, type Cost, type GameEvent } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

/** Sets the unit's Tempest to exactly `n` (without firing triggers). */
function setTempest(a: Arena, id: string, n: number): Arena {
  a.state.effects = a.state.effects.filter((e) => !(e.bearer === id && e.defId === 'tempest'));
  if (n > 0) a.give(id, 'tempest', { stacks: n });
  return a;
}

function gained(events: readonly GameEvent[], player: 0 | 1): number {
  const e = [...events].reverse().find((x) => x.t === 'energyGained' && x.player === player);
  if (!e || e.t !== 'energyGained') throw new Error('no energyGained event');
  return Object.values(e.gained).reduce((x, y) => x + y, 0);
}

// Timing note: a Storm skill raises Tempest as it is used (Storm Heart hears `used:Storm`), so the skill's own
// "per Tempest" counts already include that +1.

const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId);

function parseCost(s: string): Cost {
  const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s === 'nc') return c;
  for (const ch of s) c[ch as keyof Cost] += 1;
  return c;
}

const kit: [string, string, number][] = [
  ['strike', 'S', 0], ['smash', 'Ar', 2], ['charge', 'S', 2], ['riposte', 'r', 3], ['rage', 'Sr', 4],
  ['shot', 'r', 0], ['snipe', 'Ar', 2], ['trap', 'A', 3], ['maneuver', 'r', 2], ['companion', 'I', 1],
  ['bolt', 'I', 1], ['blast', 'Ar', 2], ['consume', 'r', 2], ['summon', 'r', 2], ['channel', 'SI', 3],
  ['stab', 'r', 0], ['ravage', 'A', 1], ['mislead', 'S', 2], ['stun', 'A', 2], ['dance', 'AA', 5],
  ['heal', 'A', 2], ['bless', 'S', 2], ['curse', 'I', 2], ['smite', 'Wr', 1], ['prayer', 'Wrr', 2],
  ['cleave', 'Ar', 1], ['shout', 'S', 3], ['withstand', 'r', 3], ['taunt', 'r', 3], ['titan', 'SW', 4],
];

describe('Storm kit table', () => {
  it.each(kit)('%s.storm costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.storm`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
    expect(s.element).toBe('Storm');
  });

  it('Storm Roc and Squall Cloud skills match their listed costs', () => {
    expect(content.skills.storm_roc_gale_wing!.cost).toEqual(parseCost('nc'));
    expect(content.skills.storm_roc_thunder_talon!.cost).toEqual(parseCost('r'));
    expect(content.skills.squall_cloud_rumble!.cost).toEqual(parseCost('nc'));
  });
});

describe('Tempest and Storm Heart', () => {
  it('each Storm skill the team uses gives every Storm character 1 Tempest', () => {
    const a = arena({ p0: [['stab.storm'], ['stab.storm']], p1: [['shot']]});
    a.use(A1, 'stab.storm', B1).end();
    expect([a.stacks(A1, 'tempest'), a.stacks(A2, 'tempest')]).toEqual([1, 1]);
  });

  it('two Storm skills in one turn give 2 Tempest', () => {
    const a = arena({ p0: [['stab.storm'], ['stab.storm']], p1: [['shot']]});
    a.use(A1, 'stab.storm', B1).use(A2, 'stab.storm', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });

  it('a non-Storm skill does not raise Tempest', () => {
    const a = arena({ p0: [['shot', 'stab.storm']], p1: [['shot']]});
    a.give(A1, 'tempest', { stacks: 2 });
    a.use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(1); // no gain, and it fell at the end of the turn
  });

  it('falls by 1 at the end of each of the character\'s turns with no Storm skill, but not on enemy turns', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['shot']]});
    a.give(A1, 'tempest', { stacks: 3 });
    a.end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
    a.end(); // enemy turn
    expect(a.stacks(A1, 'tempest')).toBe(2);
    a.end();
    expect(a.stacks(A1, 'tempest')).toBe(1);
  });

  it('does not fall in a turn the team used a Storm skill', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['shot']]});
    a.give(A1, 'tempest', { stacks: 2 });
    a.use(A1, 'stab.storm', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(3);
  });

  it('enemy Storm skills do not feed the team\'s Tempest', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['stab.storm']]});
    a.end().use(B1, 'stab.storm', A1).end();
    expect(a.stacks(A1, 'tempest')).toBe(0);
  });

  it('Storm skills used by the team\'s Storm minions count too', () => {
    const a = arena({ p0: [['companion.storm']], p1: [['shot']]});
    a.use(A1, 'companion.storm').end().pass(1);
    const roc = minions(a, 'storm_roc')[0]!;
    a.use(roc.id, 'storm_roc_gale_wing', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });

  it('caps at 5', () => {
    const a = arena({ p0: [['stab.storm'], ['stab.storm'], ['stab.storm']], p1: [['shot']]});
    a.give(A1, 'tempest', { stacks: 4 });
    a.use(A1, 'stab.storm', B1).use(A2, 'stab.storm', B1).use(A3, 'stab.storm', B1).end();
    expect(a.stacks(A1, 'tempest')).toBeLessThanOrEqual(5);
  });

  it('every character with a Storm skill carries Storm Heart; a team-mate without one gains no Tempest', () => {
    const a = arena({ p0: [['stab.storm'], ['shot']], p1: [['shot']] });
    expect([a.has(A1, 'storm_heart'), a.has(A2, 'storm_heart')]).toEqual([true, false]);
    a.use(A1, 'stab.storm', B1).end();
    expect([a.stacks(A1, 'tempest'), a.stacks(A2, 'tempest')]).toEqual([1, 0]);
  });
});

describe('Eye of the Storm', () => {
  it('reaching 5 Tempest outside a Storm skill (Charged Noose on the enemy turn) grants the Eye, held for the next Storm skill', () => {
    const a = arena({ p0: [['trap.storm', 'stab.storm']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'trap.storm', B1).end();
    setTempest(a, A1, 4);
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(A1, 'tempest'), a.has(A1, 'eye_of_the_storm')]).toEqual([5, true]);
    a.use(A1, 'stab.storm', B1).end();
    expect([a.hp(B2), a.hp(B3), a.has(A1, 'eye_of_the_storm')]).toEqual([85, 85, false]);
  });

  it('below 5 there is no Eye', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 2 });
    a.use(A1, 'stab.storm', B1).end();
    expect([a.has(A1, 'eye_of_the_storm'), a.hp(B2)]).toEqual([false, 100]);
  });

  // SPEC: "At 5, the Eye of the Storm: your NEXT Storm skill also hits…" — the Storm skill whose use brings
  // Tempest to 5 is empowered by the Eye at once (B2/B3 take 15) rather than holding it for the next one.
  it.fails('the Storm skill that brings Tempest to 5 is not itself empowered (the Eye is for the next one)', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 4 });
    a.use(A1, 'stab.storm', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.has(A1, 'eye_of_the_storm')]).toEqual([90, 100, 100, true]);
  });

  it('the next Storm skill also hits every enemy it did not target for 15 (not the target), and Tempest drops to 3', () => {
    const a = arena({ p0: [['stab.storm'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 5 }).give(A1, 'eye_of_the_storm');
    a.use(A1, 'stab.storm', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A2)]).toEqual([90, 85, 85, 100]);
    expect([a.has(A1, 'eye_of_the_storm'), a.stacks(A1, 'tempest')]).toEqual([false, 3]);
  });

  it('a non-Storm skill does not use up the Eye', () => {
    const a = arena({ p0: [['stab.storm', 'shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 5 }).give(A1, 'eye_of_the_storm');
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'eye_of_the_storm')]).toEqual([85, 100, true]);
  });

  it('Storm Warning never uses up the Eye', () => {
    const a = arena({ p0: [['shout.storm']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 5 }).give(A1, 'eye_of_the_storm');
    a.use(A1, 'shout.storm').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'eye_of_the_storm')]).toEqual([100, 100, true]);
  });
});

describe('Storm skills', () => {
  it('Squall Strike: 15, +5 per Tempest (its own use counts)', () => {
    const a = arena({ p0: [['strike.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.storm', B1).end();
    expect(a.hp(B1)).toBe(80); // 1 Tempest
    a.pass(1);
    setTempest(a, A1, 1).use(A1, 'strike.storm', B2).end();
    expect(a.hp(B2)).toBe(75); // 2 Tempest
  });

  it('Squall Strike: the Tempest bonus caps at +15', () => {
    const a = arena({ p0: [['strike.storm']], p1: [['shot']] });
    a.give(A1, 'tempest', { stacks: 3 }).use(A1, 'strike.storm', B1).end(); // 4 Tempest
    expect(a.hp(B1)).toBe(70);
  });

  it('Downburst: 25 to the target and 10 to their allies, not to the user\'s side', () => {
    const a = arena({ p0: [['smash.storm'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.storm', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A2)]).toEqual([75, 90, 90, 100]);
  });

  it('Downburst: the user gains 1 Swiftness at the start of their next turn (not at once)', () => {
    const a = arena({ p0: [['smash.storm']], p1: [['shot']] });
    a.use(A1, 'smash.storm', B1).end();
    expect(a.has(A1, 'swiftness')).toBe(false);
    a.pass(1);
    expect(a.stacks(A1, 'swiftness')).toBe(1);
  });

  // SPEC: "For 2 turns, the user gains 1 Swiftness at the start of each of their turns" — under the "for N
  // turns" convention the window (through the end of turn 4) holds only one of the user's turn starts, so
  // only 1 Swiftness is ever granted; the plural reads like 2 (the user's next 2 turns).
  it.fails('Downburst: 1 Swiftness at the start of each of the user\'s next 2 turns, then no more', () => {
    const a = arena({ p0: [['smash.storm']], p1: [['shot']] });
    const dropSwift = () => (a.state.effects = a.state.effects.filter((e) => !(e.bearer === A1 && e.defId === 'swiftness')));
    a.use(A1, 'smash.storm', B1).end();
    expect(a.has(A1, 'swiftness')).toBe(false);
    a.pass(1);
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    dropSwift();
    a.pass(2);
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    dropSwift();
    a.pass(2);
    expect(a.has(A1, 'swiftness')).toBe(false);
  });

  it('Ride the Wind: 10 damage and the user begins Rushing', () => {
    const a = arena({ p0: [['charge.storm']], p1: [['shot']] });
    a.use(A1, 'charge.storm', B1).end();
    expect([a.hp(B1), a.has(A1, 'rushing')]).toEqual([90, true]);
  });

  it('Ride the Wind: each turn the user starts Rushing they gain 1 Charge', () => {
    const a = arena({ p0: [['charge.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.storm', B1).end();
    const c0 = a.stacks(A1, 'charged');
    a.pass(1);
    expect(a.stacks(A1, 'charged')).toBe(c0 + 1);
    a.use(A1, 'shot', B1).end().pass(1); // keeps Rushing
    expect(a.stacks(A1, 'charged')).toBe(c0 + 2);
  });

  it('Ride the Wind: no Charge at the start of a turn the user is not Rushing', () => {
    const a = arena({ p0: [['charge.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.storm', B1).end().pass(1);
    const c = a.stacks(A1, 'charged');
    a.end(); // no skill: Rushing ends
    expect(a.has(A1, 'rushing')).toBe(false);
    a.pass(1);
    expect(a.stacks(A1, 'charged')).toBe(c);
  });

  it('Grounded Arc: counters the first Harmful skill on the user and Saps its user once per energy it cost', () => {
    const a = arena({ p0: [['riposte.storm']], p1: [['smash'], ['shot']] });
    const smashCost = Object.values(content.skills.smash!.cost).reduce((x, y) => x + y, 0);
    a.use(A1, 'riposte.storm').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(B1, 'sapped')).toBe(Math.min(3, smashCost));
    expect(a.hp(A1)).toBe(85);
  });

  it('Grounded Arc: only the first Harmful skill is countered', () => {
    const a = arena({ p0: [['riposte.storm']], p1: [['smash'], ['shot']] });
    a.use(A1, 'riposte.storm').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B2, 'sapped')]).toEqual([85, false]);
  });

  it('Grounded Arc: Helpful skills are not countered (the next Harmful one is)', () => {
    const a = arena({ p0: [['riposte.storm']], p1: [['heal'], ['shot']] });
    a.use(A1, 'riposte.storm').end();
    a.setHp(B1, 50).use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 100]);
  });

  it('Grounded Arc: lasts 1 turn and is Invisible', () => {
    expect(content.skills['riposte.storm']!.tags).toContain('Invisible');
    const a = arena({ p0: [['riposte.storm']], p1: [['shot']] });
    a.use(A1, 'riposte.storm').end().pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Gathering Storm: Stormborn and 1 Might for 3 turns', () => {
    const a = arena({ p0: [['rage.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.storm').end();
    expect([a.has(A1, 'stormborn'), a.stacks(A1, 'might')]).toEqual([true, 1]);
    a.pass(6);
    expect([a.has(A1, 'stormborn'), a.stacks(A1, 'might')]).toEqual([false, 0]);
  });

  it('Gathering Storm: Charge filling to 3 raises Tempest by 1; Charge below 3 does not', () => {
    const a = arena({ p0: [['rage.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.storm').end().pass(1);
    setTempest(a, A1, 0).give(A1, 'charged', { stacks: 1 });
    a.use(A1, 'shot', B1).end(); // Stormborn: 2 Charge
    setTempest(a, A1, 0);
    expect(a.stacks(A1, 'charged')).toBe(2);
    a.use(B1, 'shot', A1).end(); // Stormborn: 3 Charge
    expect(a.stacks(A1, 'tempest')).toBe(1);
  });

  it('Shared Static: 15, then each time an ally takes damage before the user\'s next turn, the user gains 1 Charge', () => {
    const a = arena({ p0: [['shot.storm'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.storm', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect(a.stacks(A1, 'charged')).toBe(2);
  });

  it('Shared Static: stops at the start of the user\'s next turn', () => {
    const a = arena({ p0: [['shot.storm'], ['shot']], p1: [['shot']] });
    a.use(A1, 'shot.storm', B1).end().end().end();
    a.use(B1, 'shot', A2).end();
    expect(a.stacks(A1, 'charged')).toBe(0);
  });

  it('Stormfront: on the following turn, 15 Piercing to all enemies +5 per Tempest, spending it all', () => {
    const a = arena({ p0: [['snipe.storm']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'snipe.storm').end(); // 2 Tempest
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'tempest')]).toEqual([75, 75, 0]);
  });

  it('Stormfront: is Channeled; a Stun before it fires stops it', () => {
    expect(content.skills['snipe.storm']!.tags).toContain('Channeled');
    const b = arena({ p0: [['snipe.storm']], p1: [['stun']] });
    b.use(A1, 'snipe.storm').end().use(B1, 'stun', A1).end();
    expect(b.hp(B1)).toBe(100);
  });

  it('Charged Noose: each skill the target uses gives the user 1 Tempest, then 5 Piercing per Tempest', () => {
    const a = arena({ p0: [['trap.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.storm', B1).end();
    setTempest(a, A1, 0);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.stacks(A1, 'tempest'), a.hp(B1), a.hp(B2)]).toEqual([1, 95, 100]);
    a.pass(1);
    setTempest(a, A1, 2);
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(A1, 'tempest'), a.hp(B1)]).toEqual([3, 80]);
  });

  it('Charged Noose: the Piercing ignores Armor', () => {
    const a = arena({ p0: [['trap.storm']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'trap.storm', B1).end();
    setTempest(a, A1, 2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Charged Noose: lasts 3 turns, is Invisible', () => {
    expect(content.skills['trap.storm']!.tags).toContain('Invisible');
    const a = arena({ p0: [['trap.storm']], p1: [['shot']] });
    a.use(A1, 'trap.storm', B1).end().pass(6);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Lightning Leap: the user Leaps and gains Conduit; the landing blow steals the target\'s Charge, then Conduit ends', () => {
    const a = arena({ p0: [['maneuver.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.storm').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable'), a.has(A1, 'conduit')]).toEqual([true, true, true]);
    a.give(B1, 'charged', { stacks: 2 }).pass(1);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'charged'), a.stacks(A1, 'charged')]).toEqual([80, 0, 2]);
    expect([a.has(A1, 'leaping'), a.has(A1, 'conduit')]).toEqual([false, false]);
  });

  it('Storm Roc: a permanent 40 HP minion whose Gale Wing deals 5', () => {
    const a = arena({ p0: [['companion.storm']], p1: [['shot']] });
    a.use(A1, 'companion.storm').end();
    const roc = minions(a, 'storm_roc')[0]!;
    expect([roc.hp, roc.owner]).toEqual([40, 0]);
    a.pass(1).use(roc.id, 'storm_roc_gale_wing', B1).end();
    expect(a.hp(B1)).toBe(95);
    a.pass(10);
    expect(minions(a, 'storm_roc')).toHaveLength(1);
  });

  it('Storm Roc: Thunder Talon is usable only at 3+ Tempest, dealing 20 and Sapping', () => {
    const a = arena({ p0: [['companion.storm']], p1: [['shot']] });
    a.use(A1, 'companion.storm').end().pass(1);
    const roc = minions(a, 'storm_roc')[0]!;
    setTempest(a, A1, 2);
    expect(a.reject(() => a.use(roc.id, 'storm_roc_thunder_talon', B1))).toBeTruthy();
    setTempest(a, A1, 3);
    a.use(roc.id, 'storm_roc_thunder_talon', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped')]).toEqual([80, 1]);
  });

  it('Stormbolt: 20 and a Sap on the target, no arcs at under 2 Tempest', () => {
    const a = arena({ p0: [['bolt.storm']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'bolt.storm', B1).end(); // 1 Tempest
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.hp(B2), a.hp(B3)]).toEqual([80, 1, 100, 100]);
  });

  it('Stormbolt: arcs to 1 other enemy per 2 Tempest for 10 each, without Sapping them', () => {
    const a = arena({ p0: [['bolt.storm']], p1: [['shot'], ['shot'], ['shot']], seed: 3 });
    a.give(A1, 'tempest', { stacks: 2 }).use(A1, 'bolt.storm', B1).end(); // 3 Tempest: 1 arc
    expect(a.hp(B1)).toBe(80);
    expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 90].sort());
    expect([a.has(B2, 'sapped'), a.has(B3, 'sapped')]).toEqual([false, false]);
    const b = arena({ p0: [['bolt.storm']], p1: [['shot'], ['shot'], ['shot']] });
    b.give(A1, 'tempest', { stacks: 3 }).use(A1, 'bolt.storm', B1).end(); // 4 Tempest: 2 arcs
    expect([b.hp(B1), b.hp(B2), b.hp(B3)]).toEqual([80, 90, 90]);
  });

  it('Supercell: 25 to all enemies, Tempest falls by 1, and each ally gains 1 Charge', () => {
    const a = arena({ p0: [['blast.storm'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 2 }).use(A1, 'blast.storm').end(); // 3, then falls by 1
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'tempest')]).toEqual([75, 75, 2]);
    expect([a.stacks(A1, 'charged'), a.stacks(A2, 'charged'), a.stacks(A3, 'charged')]).toEqual([1, 1, 1]);
    expect(a.has(B1, 'charged')).toBe(false);
  });

  it('Calm Before the Storm: 5 damage; Tempest falls by up to 2, healing the damage plus 10 per point', () => {
    const a = arena({ p0: [['consume.storm']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'tempest', { stacks: 2 }).use(A1, 'consume.storm', B1).end(); // 3 → 1
    expect([a.hp(B1), a.stacks(A1, 'tempest'), a.hp(A1)]).toEqual([95, 1, 75]);
  });

  it('Calm Before the Storm: with only 1 Tempest it falls by 1 (heal 5 + 10)', () => {
    const a = arena({ p0: [['consume.storm']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.storm', B1).end(); // its own use makes 1
    expect([a.stacks(A1, 'tempest'), a.hp(A1)]).toEqual([0, 65]);
  });

  it('Brewing Squall: a 20 HP Squall Cloud whose Rumble deals 5', () => {
    const a = arena({ p0: [['summon.storm']], p1: [['shot']] });
    a.use(A1, 'summon.storm').end();
    const cloud = minions(a, 'squall_cloud')[0]!;
    expect(cloud.hp).toBe(20);
    a.pass(1).use(cloud.id, 'squall_cloud_rumble', B1).end();
    expect(a.hp(B1)).toBe(95);
  });

  it('Brewing Squall: expires after 3 turns and breaks for 5 per Tempest on all enemies', () => {
    const a = arena({ p0: [['summon.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.storm').end().pass(4);
    expect(minions(a, 'squall_cloud')).toHaveLength(1);
    expect(a.hp(B1)).toBe(100);
    setTempest(a, A1, 2).pass(1);
    expect(minions(a, 'squall_cloud')).toHaveLength(0);
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([90, 90, 100]);
  });

  it('Hurricane: each of the user\'s turns, 10 to all enemies +5 per Tempest, for up to 4 turns', () => {
    const a = arena({ p0: [['channel.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.storm').end(); // 1 Tempest at the tick
    expect(a.hp(B1)).toBe(85);
    for (let i = 0; i < 3; i++) {
      a.end();
      setTempest(a, A1, 0).end();
    }
    expect([a.hp(B1), a.hp(B2)]).toEqual([55, 55]);
    a.end();
    setTempest(a, A1, 0).end(); // no 5th tick
    expect(a.hp(B1)).toBe(55);
  });

  it('Hurricane: each tick raises Tempest by 1', () => {
    const a = arena({ p0: [['channel.storm']], p1: [['shot']] });
    a.use(A1, 'channel.storm').end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });

  it('Hurricane: ends early once Tempest reaches 5', () => {
    const a = arena({ p0: [['channel.storm'], ['stab.storm']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 2 }).use(A1, 'channel.storm').end(); // tick at 3 → 25, Tempest 4
    expect(a.hp(B1)).toBe(75);
    a.end();
    setTempest(a, A1, 3).use(A2, 'stab.storm', B2).end(); // the ally's Storm skill: 4; tick → 30, Tempest 5: it ends
    expect(a.hp(B1)).toBe(45);
    a.end();
    setTempest(a, A1, 0).end();
    expect(a.hp(B1)).toBe(45);
  });

  it('Pinning Knife: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.storm', B1).end().pass(1).use(A1, 'stab.storm', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Pinning Knife: the target counts as Immobile until the end of the user\'s next turn', () => {
    const a = arena({ p0: [['stab.storm']], p1: [['charge']] });
    const imm = () => evaluateNamedCondition(content, a.state, 'immobile', B1);
    expect(imm()).toBe(false);
    a.use(A1, 'stab.storm', B1).end();
    expect(imm()).toBe(true);
    a.end();
    expect(imm()).toBe(true);
    a.end();
    expect(imm()).toBe(false);
  });

  it('Summit Strike: 25 Piercing to the enemy with the most HP, +15 if Stunned', () => {
    const a = arena({ p0: [['ravage.storm']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 50).setHp(B3, 70).give(B2, 'armor', { stacks: 3 });
    a.use(A1, 'ravage.storm').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([50, 75, 70]);
    a.give(B2, 'stun').pass(3);
    a.use(A1, 'ravage.storm').end();
    expect(a.hp(B2)).toBe(35);
  });

  it('Summit Strike: Bypasses Invulnerable', () => {
    const a = arena({ p0: [['ravage.storm']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).give(B1, 'invulnerable');
    a.use(A1, 'ravage.storm').end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Summit Strike: cannot reach a Stealthed enemy, so it hits the next-healthiest', () => {
    const a = arena({ p0: [['ravage.storm']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).give(B1, 'stealth');
    a.use(A1, 'ravage.storm').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 25]);
  });

  it('False Front: counters the target\'s Harmful skill and Saps them at least once; other enemies are unaffected', () => {
    const a = arena({ p0: [['mislead.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.storm', B1).end(); // 1 Tempest
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'sapped'), a.has(B2, 'sapped')]).toEqual([85, 1, false]);
  });

  it('False Front: Saps once per 2 Tempest', () => {
    const a = arena({ p0: [['mislead.storm']], p1: [['shot']] });
    a.give(A1, 'tempest', { stacks: 3 }).use(A1, 'mislead.storm', B1).end(); // 4 Tempest
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'sapped')]).toEqual([100, 2]);
  });

  it('False Front: Helpful skills are not countered, and it is Invisible', () => {
    expect(content.skills['mislead.storm']!.tags).toContain('Invisible');
    const a = arena({ p0: [['mislead.storm']], p1: [['heal']] });
    a.use(A1, 'mislead.storm', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'sapped')]).toEqual([75, false]);
  });

  it('Static Buildup: 15 damage; one skill used during the Static means a 1-turn Stun when it ends', () => {
    const a = arena({ p0: [['stun.storm']], p1: [['shot']] });
    a.use(A1, 'stun.storm', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.use(B1, 'shot', A1).end().end();
    expect(a.has(B1, 'stun')).toBe(false);
    a.end(); // the Static ends at the end of the enemy's 2nd turn
    expect(a.has(B1, 'stun')).toBe(true);
    a.end(); // B1's turn
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70);
  });

  it('Static Buildup: two skills used mean a 2-turn Stun', () => {
    const a = arena({ p0: [['stun.storm']], p1: [['shot']] });
    a.use(A1, 'stun.storm', B1).end();
    a.use(B1, 'shot', A1).end().end().use(B1, 'shot', A1).end();
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(55);
  });

  it('Static Buildup: no skills used, no Stun', () => {
    const a = arena({ p0: [['stun.storm']], p1: [['shot']] });
    a.use(A1, 'stun.storm', B1).end().pass(4);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Storm Rider: 1 Might and Rushing; while Rushing, the user\'s skills count as Storm skills', () => {
    const a = arena({ p0: [['dance.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.storm').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'rushing'), a.stacks(A1, 'tempest')]).toEqual([1, true, 1]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });

  it('Storm Rider: once Rushing ends, non-Storm skills don\'t count', () => {
    const a = arena({ p0: [['dance.storm', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.storm').end().pass(3); // a turn with no skill: Rushing ends
    expect(a.has(A1, 'rushing')).toBe(false);
    setTempest(a, A1, 2).use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(1);
  });

  it('Mending Arc: 25 to the target, 15 to the other ally with the least HP, 5 to the rest', () => {
    const a = arena({ p0: [['heal.storm'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 40).setHp(A3, 60).use(A1, 'heal.storm', A1).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([75, 55, 65]);
  });

  it('Mending Arc: enemies are not healed', () => {
    const a = arena({ p0: [['heal.storm'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).setHp(B1, 40).use(A1, 'heal.storm', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([65, 40]);
  });

  it('Tailwind: the ally gains 1 Swiftness, and their skills count as Storm skills', () => {
    const a = arena({ p0: [['bless.storm'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.storm', A2).end();
    expect([a.stacks(A2, 'swiftness'), a.stacks(A1, 'tempest')]).toEqual([1, 1]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });

  it('Tailwind: after 2 turns, the ally\'s skills no longer count', () => {
    const a = arena({ p0: [['bless.storm'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.storm', A2).end().pass(5);
    setTempest(a, A1, 3).use(A2, 'shot', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });

  it('Crosswind: the target loses all Charge; Charge they would gain feeds the user\'s Tempest instead', () => {
    const a = arena({ p0: [['curse.storm']], p1: [['charge.lightning']] });
    a.give(B1, 'charged', { stacks: 2 }).use(A1, 'curse.storm', B1).end();
    expect([a.stacks(B1, 'charged'), a.stacks(A1, 'tempest')]).toEqual([0, 1]); // 1 from its own use
    a.use(B1, 'charge.lightning', A1).end();
    expect([a.stacks(B1, 'charged'), a.stacks(A1, 'tempest')]).toEqual([0, 2]);
  });

  it('Crosswind: after 2 turns, the target keeps its Charge again', () => {
    const a = arena({ p0: [['curse.storm']], p1: [['charge.lightning']] });
    a.use(A1, 'curse.storm', B1).end().pass(4);
    setTempest(a, A1, 0);
    a.use(B1, 'charge.lightning', A1).end();
    expect([a.stacks(B1, 'charged'), a.stacks(A1, 'tempest')]).toEqual([1, 0]);
  });

  it('Rod of the Storm: 20 damage; for 1 turn each ally hit on the target raises Tempest by 1', () => {
    const a = arena({ p0: [['smite.storm'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smite.storm', B1).use(A2, 'shot', B1).use(A3, 'shot', B2).end();
    expect([a.hp(B1), a.stacks(A1, 'tempest')]).toEqual([65, 2]); // 1 from its own use, 1 from A2's hit (not A3's)
  });

  it('Rod of the Storm: wears off after its turn', () => {
    const a = arena({ p0: [['smite.storm'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.storm', B1).end().pass(1);
    setTempest(a, A1, 1).use(A2, 'shot', B1).end();
    expect(a.stacks(A1, 'tempest')).toBe(0); // no rise; it fell by 1
  });

  it('Song of the Storm: all allies heal 20 and gain 10 Shield for 1 turn', () => {
    const a = arena({ p0: [['prayer.storm'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.storm').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(65);
    a.pass(1);
    expect(a.has(A1, 'shield')).toBe(false);
  });

  it('Song of the Storm: for 2 turns the team\'s Tempest doesn\'t fall, then it does', () => {
    const a = arena({ p0: [['prayer.storm']], p1: [['shot']] });
    a.give(A1, 'tempest', { stacks: 3 }).use(A1, 'prayer.storm').end();
    expect(a.stacks(A1, 'tempest')).toBe(4);
    a.pass(2);
    expect(a.stacks(A1, 'tempest')).toBe(4);
    a.pass(2);
    expect(a.stacks(A1, 'tempest')).toBe(3);
  });

  it('Shearing Gale: 25 to the target and 15 to a random other enemy', () => {
    const a = arena({ p0: [['cleave.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.storm', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Shearing Gale: while Leaping, both hits gain the Leap\'s bonus', () => {
    const a = arena({ p0: [['cleave.storm']], p1: [['shot'], ['shot']] });
    a.give(A1, 'leaping').use(A1, 'cleave.storm', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);
  });

  it('Storm Warning: all enemies are Intimidated for 2 turns; below 5 Tempest, no Sap', () => {
    const a = arena({ p0: [['shout.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.storm').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.has(B1, 'sapped')]).toEqual([true, true, false]);
    a.pass(4);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Storm Warning: at 5 Tempest it also Saps every enemy', () => {
    const a = arena({ p0: [['shout.storm']], p1: [['shot'], ['shot']] });
    a.give(A1, 'tempest', { stacks: 5 }).use(A1, 'shout.storm').end();
    expect([a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped')]).toEqual([1, 1]);
  });

  it('Storm Cellar: every ally gains 20 Shield for 1 turn; the user gains 3 Sapped', () => {
    const a = arena({ p0: [['withstand.storm'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.storm').end();
    expect([a.stacks(A1, 'sapped'), a.has(A2, 'sapped')]).toEqual([3, false]);
    a.use(B1, 'shot', A2).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]);
    a.pass(1);
    expect(a.has(A2, 'shield')).toBe(false);
  });

  it('Storm Cellar: the user\'s 3 Sapped costs the team 1 energy next turn', () => {
    const a = arena({ p0: [['withstand.storm'], ['shot'], ['shot']], p1: [['shot']], richEnergy: false });
    a.state.players[0].energy = { S: 5, A: 5, I: 5, W: 5 };
    a.use(A1, 'withstand.storm').end().end();
    expect(gained(a.last, 0)).toBe(2);
  });

  it('Static Lure: Taunts the target for 2 turns', () => {
    const a = arena({ p0: [['taunt.storm'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.storm', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBeTruthy();
    a.use(B1, 'shot', A1).end().pass(4);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Static Lure: while Taunted and Sapped, the target generates 1 less energy every turn', () => {
    const a = arena({ p0: [['taunt.storm']], p1: [['shot'], ['shot'], ['shot']], richEnergy: false });
    a.state.players[0].energy = { S: 5, A: 5, I: 5, W: 5 };
    a.use(A1, 'taunt.storm', B1).give(B1, 'sapped', { source: A1 }).end();
    expect(gained(a.last, 1)).toBe(2);
    a.end().end();
    expect(gained(a.last, 1)).toBe(2);
  });

  it('Static Lure: Taunted but not Sapped means normal energy', () => {
    const a = arena({ p0: [['taunt.storm']], p1: [['shot'], ['shot'], ['shot']], richEnergy: false });
    a.state.players[0].energy = { S: 5, A: 5, I: 5, W: 5 };
    a.use(A1, 'taunt.storm', B1).end();
    expect(gained(a.last, 1)).toBe(3);
  });

  it('Djinn of the Tempest: Immune and 1 Armor per 2 Tempest', () => {
    const a = arena({ p0: [['titan.storm']], p1: [['shot'], ['curse']] });
    a.give(A1, 'tempest', { stacks: 3 }).use(A1, 'titan.storm').end(); // 4 Tempest: 2 Armor
    a.use(B1, 'shot', A1).use(B2, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion')]).toEqual([95, false]);
  });

  it('Djinn of the Tempest: Armor is rechecked as each hit lands', () => {
    const a = arena({ p0: [['titan.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.storm').end(); // 1 Tempest: no Armor
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.end();
    setTempest(a, A1, 4).use(B1, 'shot', A1).end(); // 2 Armor
    expect(a.hp(A1)).toBe(80);
  });

  it('Djinn of the Tempest: Tempest rises by 1 at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['titan.storm']], p1: [['shot']] });
    a.use(A1, 'titan.storm').end();
    expect(a.stacks(A1, 'tempest')).toBe(1);
    a.pass(1);
    expect(a.stacks(A1, 'tempest')).toBe(2);
    a.end(); // falls by 1: no Storm skill this turn
    expect(a.stacks(A1, 'tempest')).toBe(1);
    a.end();
    expect(a.stacks(A1, 'tempest')).toBe(2);
  });
});
