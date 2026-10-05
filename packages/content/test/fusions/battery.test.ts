// Spec-driven scenarios for Battery (Lightning + Poison): Cells, Discharge, Corroded, Battery Core and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.36, and the design doc kit table (lightning-pairs.md).
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

function gained(events: readonly GameEvent[], player: 0 | 1): number {
  const e = [...events].reverse().find((x) => x.t === 'energyGained' && x.player === player);
  if (!e || e.t !== 'energyGained') throw new Error('no energyGained event');
  return Object.values(e.gained).reduce((x, y) => x + y, 0);
}

const total = (a: Arena, p: 0 | 1) => Object.values(a.state.players[p].energy).reduce((x, y) => x + y, 0);
const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId);
const shieldOf = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);

function parseCost(s: string): Cost {
  const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s === 'nc') return c;
  for (const ch of s) c[ch as keyof Cost] += 1;
  return c;
}

const kit: [string, string, number][] = [
  ['strike', 'r', 0], ['smash', 'SI', 2], ['charge', 'S', 2], ['riposte', 'W', 3], ['rage', 'Sr', 4],
  ['shot', 'r', 0], ['snipe', 'AI', 2], ['trap', 'r', 2], ['maneuver', 'r', 2], ['companion', 'W', 1],
  ['bolt', 'I', 1], ['blast', 'Wrr', 2], ['consume', 'r', 2], ['summon', 'I', 1], ['channel', 'r', 2],
  ['stab', 'r', 0], ['ravage', 'Ir', 1], ['mislead', 'W', 2], ['stun', 'S', 3], ['dance', 'AA', 4],
  ['heal', 'W', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'S', 1], ['prayer', 'WW', 2],
  ['cleave', 'W', 1], ['shout', 'Sr', 3], ['withstand', 'S', 3], ['taunt', 'r', 3], ['titan', 'Wr', 4],
];

describe('Battery kit table', () => {
  it.each(kit)('%s.battery costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.battery`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
    expect(s.element).toBe('Battery');
  });

  it('minion skills: Acid Jet and Arc Sting cost r', () => {
    expect(content.skills.bombardier_beetle_acid_jet!.cost).toEqual(parseCost('r'));
    expect(content.skills.voltaic_wasps_arc_sting!.cost).toEqual(parseCost('r'));
  });
});

describe('Cells and Battery Core', () => {
  it('every character with a Battery skill carries Battery Core; others don\'t', () => {
    const a = arena({ p0: [['strike.battery'], ['shot']], p1: [['shot']] });
    expect([a.has(A1, 'battery_core'), a.has(A2, 'battery_core')]).toEqual([true, false]);
  });

  it('Battery Core: gaining Charge that reaches 3 also stores a Cell', () => {
    const a = arena({ p0: [['charge.lightning', 'strike.battery']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'charge.lightning', B1).end();
    expect([a.stacks(A1, 'charged'), a.stacks(A1, 'cell')]).toEqual([3, 1]);
  });

  it('Battery Core: Charge that stays below 3 stores nothing', () => {
    const a = arena({ p0: [['charge.lightning', 'strike.battery']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 1 }).use(A1, 'charge.lightning', B1).end();
    expect([a.stacks(A1, 'charged'), a.stacks(A1, 'cell')]).toEqual([2, 0]);
  });

  it('Battery Core: a character without it stores no Cell when Charge reaches 3', () => {
    const a = arena({ p0: [['charge.lightning']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'charge.lightning', B1).end();
    expect(a.stacks(A1, 'cell')).toBe(0);
  });

  it('Cells never decay', () => {
    const a = arena({ p0: [['strike.battery']], p1: [['shot']] });
    a.give(A1, 'cell', { stacks: 2 }).pass(8);
    expect(a.stacks(A1, 'cell')).toBe(2);
  });

  it('Cells cap at 5', () => {
    const a = arena({ p0: [['maneuver.battery']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 4, source: B1 }).give(A1, 'sapped', { stacks: 3, source: B1 });
    a.use(A1, 'maneuver.battery').end();
    expect(a.stacks(A1, 'cell')).toBe(5);
  });
});

describe('Corroded', () => {
  it('the bearer\'s Shield loses 10 at the end of each of the applier\'s turns, not the bearer\'s', () => {
    const a = arena({ p0: [['bolt.battery']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 40 }).use(A1, 'bolt.battery', B1).end();
    expect(shieldOf(a, B1)).toBe(10); // 40 − 20 (the hit) − 10 (end of the applier's turn)
    a.end();
    expect(shieldOf(a, B1)).toBe(10);
  });

  it('the bearer can\'t gain Armor', () => {
    const a = arena({ p0: [['bolt.battery']], p1: [['titan']] });
    a.use(A1, 'bolt.battery', B1).end().use(B1, 'titan').end();
    expect(a.stacks(B1, 'armor')).toBe(0);
    const b = arena({ p0: [['shot']], p1: [['titan']] });
    b.end().use(B1, 'titan').end();
    expect(b.stacks(B1, 'armor')).toBe(3);
  });

  it('wears off with its duration, and the Shield stops draining', () => {
    const a = arena({ p0: [['stab.battery']], p1: [['shot']] });
    a.use(A1, 'stab.battery', B1).end().pass(1); // 1 turn
    expect(a.has(B1, 'corroded')).toBe(false);
    a.give(B1, 'shield', { value: 20 }).end();
    expect(shieldOf(a, B1)).toBe(20);
  });
});

describe('Battery skills', () => {
  it('Galvanic Fang: 20; with no Cells, the user stores 1 and no Toxin', () => {
    const a = arena({ p0: [['strike.battery']], p1: [['shot']] });
    a.use(A1, 'strike.battery', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'cell'), a.stacks(B1, 'toxin')]).toEqual([80, 1, 0]);
  });

  it('Galvanic Fang: with Cells, the user spends 1 and the target gains 2 Toxin', () => {
    const a = arena({ p0: [['strike.battery']], p1: [['shot']] });
    a.give(A1, 'cell', { stacks: 2 }).use(A1, 'strike.battery', B1).end();
    expect([a.stacks(A1, 'cell'), a.stacks(B1, 'toxin')]).toEqual([1, 2]);
  });


  it('Toxic Circuit: 20 to the target; the next skill they use shorts out: 20 to each of their allies, Corroded for 2 turns', () => {
    const a = arena({ p0: [['smash.battery']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.battery', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 100, 100]); // nothing else until they act
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A1)]).toEqual([80, 80, 80, 85]);
    expect([a.has(B1, 'corroded'), a.has(B2, 'corroded'), a.has(B3, 'corroded')]).toEqual([false, true, true]);
    a.pass(3); // to the end of turn 5
    expect(a.has(B2, 'corroded')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'corroded')).toBe(false);
  });

  it('Toxic Circuit: only their next skill shorts out, and only within 1 turn', () => {
    const a = arena({ p0: [['smash.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.battery', B1).end().use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B2)).toBe(80); // the second skill doesn't
    const b = arena({ p0: [['smash.battery']], p1: [['shot'], ['shot']] });
    b.use(A1, 'smash.battery', B1).end().pass(2).use(B1, 'shot', A1).end(); // turn 4: the overload has passed
    expect(b.hp(B2)).toBe(100);
  });

  it('Jump Start: 15; the player gains 2 random energy now and generates 2 less next turn', () => {
    const a = arena({ p0: [['charge.battery'], ['shot'], ['shot']], p1: [['shot']], richEnergy: false });
    a.state.players[0].energy = { S: 3, A: 0, I: 0, W: 0 };
    a.use(A1, 'charge.battery', B1).end();
    expect([a.hp(B1), total(a, 0)]).toEqual([85, 3 - 1 + 2]);
    a.end();
    expect(gained(a.last, 0)).toBe(1); // 3 characters − 2
    a.end().end();
    expect(gained(a.last, 0)).toBe(3);
  });

  it('Jump Start: 15, and the player gains 2 random energy at once', () => {
    const a = arena({ p0: [['charge.battery'], ['shot'], ['shot']], p1: [['shot']], richEnergy: false });
    a.state.players[0].energy = { S: 3, A: 0, I: 0, W: 0 };
    a.use(A1, 'charge.battery', B1).end();
    expect([a.hp(B1), total(a, 0)]).toEqual([85, 3 - 1 + 2]);
  });

  it('Capacitor: counters only the first Harmful skill on the user', () => {
    const a = arena({ p0: [['riposte.battery']], p1: [['smash'], ['shot']] });
    a.use(A1, 'riposte.battery').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Capacitor: counters the next Harmful skill on the user and stores 1 Cell per energy it cost', () => {
    const a = arena({ p0: [['riposte.battery']], p1: [['smash'], ['shot']] });
    const smashCost = Object.values(content.skills.smash!.cost).reduce((x, y) => x + y, 0);
    a.use(A1, 'riposte.battery').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect([a.stacks(A1, 'cell'), a.hp(A1)]).toEqual([smashCost, 85]); // only the first is countered
  });

  it('Capacitor: Helpful skills aren\'t countered; it expires after 1 turn; it is Invisible', () => {
    expect(content.skills['riposte.battery']!.tags).toContain('Invisible');
    const a = arena({ p0: [['riposte.battery']], p1: [['heal']] });
    a.use(A1, 'riposte.battery').end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'cell')]).toEqual([75, 0]);
    const b = arena({ p0: [['riposte.battery']], p1: [['shot']] });
    b.use(A1, 'riposte.battery').end().pass(2).use(B1, 'shot', A1).end();
    expect(b.hp(A1)).toBe(85);
  });

  it('Thermal Runaway: 2 Might and Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.battery']], p1: [['curse']] });
    a.use(A1, 'rage.battery').end();
    expect([a.stacks(A1, 'might'), a.hp(A1)]).toEqual([2, 100]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(6);
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('Thermal Runaway: each skill used meanwhile gives 1 more Might and deals the user 10 Affliction', () => {
    const a = arena({ p0: [['rage.battery', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.battery').end().pass(1);
    a.give(A1, 'shield', { value: 50 }).use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'might'), a.hp(A1)]).toEqual([3, 90]); // Affliction ignores the Shield
  });

  it('Afterspark: 10 Piercing; strikes again at the start of the user\'s next turn if they gained Charge', () => {
    const a = arena({ p0: [['shot.battery']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'shot.battery', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.give(A1, 'stormborn').use(B1, 'shot', A1).end(); // Stormborn: Charge from the hit taken
    expect(a.hp(B1)).toBe(80);
  });

  it('Afterspark: no Charge gained means no second strike', () => {
    const a = arena({ p0: [['shot.battery']], p1: [['shot']] });
    a.use(A1, 'shot.battery', B1).end().end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Railgun: on the following turn, 30 Piercing, +10 per Cell, spending them', () => {
    const a = arena({ p0: [['snipe.battery']], p1: [['shot']] });
    a.give(A1, 'cell', { stacks: 2 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'snipe.battery', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.stacks(A1, 'cell')]).toEqual([50, 0]);
  });

  it('Railgun: if it kills, the Cells are stored again', () => {
    const a = arena({ p0: [['snipe.battery'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'cell', { stacks: 2 }).setHp(B1, 45);
    a.use(A1, 'snipe.battery', B1).end().end();
    expect([a.unit(B1).alive, a.stacks(A1, 'cell')]).toEqual([false, 2]);
  });

  it('Railgun: Channeled with a hidden target', () => {
    expect(content.skills['snipe.battery']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
  });

  it('Leaking Cell: the first Helpful skill the target uses deals them 15 Piercing and Corrodes every unit it affects', () => {
    const a = arena({ p0: [['trap.battery']], p1: [['heal'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'trap.battery', B1).end();
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect([a.hp(B1), a.has(B2, 'corroded')]).toEqual([85, true]);
    a.pass(3).setHp(B2, 50).use(B1, 'heal', B2).end();
    expect(a.hp(B1)).toBe(85); // only the first time
  });

  it('Leaking Cell: Harmful skills don\'t set it off; it is Invisible', () => {
    expect(content.skills['trap.battery']!.tags).toContain('Invisible');
    const a = arena({ p0: [['trap.battery']], p1: [['shot']] });
    a.use(A1, 'trap.battery', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.has(A1, 'corroded')]).toEqual([100, false]);
  });

  it('Electrolysis: Invulnerable for 1 turn; Toxin and Sapped turn into Cells, stack for stack', () => {
    const a = arena({ p0: [['maneuver.battery']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 2, source: B1 }).give(A1, 'sapped', { stacks: 1, source: B1 });
    a.use(A1, 'maneuver.battery').end();
    expect([a.has(A1, 'invulnerable'), a.stacks(A1, 'cell'), a.has(A1, 'toxin'), a.has(A1, 'sapped')]).toEqual([true, 3, false, false]);
  });

  it('Bombardier Beetle: a permanent 30 HP minion; enemies who damage it are Corroded for 2 turns', () => {
    const a = arena({ p0: [['companion.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.battery').end();
    const beetle = minions(a, 'bombardier_beetle')[0]!;
    expect(beetle.hp).toBe(30);
    a.use(B1, 'shot', beetle.id).end();
    expect([a.has(B1, 'corroded'), a.has(B2, 'corroded')]).toEqual([true, false]);
    a.pass(10);
    expect(minions(a, 'bombardier_beetle')).toHaveLength(1);
  });

  it('Bombardier Beetle: Acid Jet deals 10 Piercing, +10 if the target is Corroded', () => {
    const a = arena({ p0: [['companion.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.battery').end().pass(1);
    const beetle = minions(a, 'bombardier_beetle')[0]!;
    a.give(B1, 'armor', { stacks: 2 }).use(beetle.id, 'bombardier_beetle_acid_jet', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
    a.give(B2, 'corroded', { source: A1 }).use(beetle.id, 'bombardier_beetle_acid_jet', B2).end();
    expect(a.hp(B2)).toBe(80);
  });

  it('Battery Acid: 20 and Corroded for 2 turns; each Armor turns into 1 Toxin', () => {
    const a = arena({ p0: [['bolt.battery']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'bolt.battery', B1);
    a.end();
    expect([a.has(B1, 'corroded'), a.stacks(B1, 'armor'), a.stacks(B1, 'toxin')]).toEqual([true, 0, 2]);
    a.pass(2);
    expect(a.has(B1, 'corroded')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'corroded')).toBe(false);
  });

  it('Battery Acid: without Armor, no Toxin', () => {
    const a = arena({ p0: [['bolt.battery']], p1: [['shot']] });
    a.use(A1, 'bolt.battery', B1).end();
    expect([a.hp(B1), a.has(B1, 'toxin')]).toEqual([80, false]);
  });

  it('Full Discharge: 15 to all enemies, +10 each per Cell; the user is Sapped once per Cell spent', () => {
    const a = arena({ p0: [['blast.battery']], p1: [['shot'], ['shot']] });
    a.give(A1, 'cell', { stacks: 2 }).use(A1, 'blast.battery').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'cell'), a.stacks(A1, 'sapped')]).toEqual([65, 65, 0, 2]);
  });

  it('Full Discharge: with no Cells, 15 and no Sap', () => {
    const a = arena({ p0: [['blast.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.battery').end();
    expect([a.hp(B1), a.has(A1, 'sapped')]).toEqual([85, false]);
  });


  it('Leech Line: the target gains 2 Toxin; for 2 turns, at the end of the user\'s turns, the user heals 5 per Toxin on them and gains 1 Charge', () => {
    const a = arena({ p0: [['consume.battery']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.battery', B1).end();
    expect([a.stacks(B1, 'toxin'), a.hp(B1), a.hp(A1), a.stacks(A1, 'charged')]).toEqual([2, 90, 60, 1]);
    a.pass(1);
    expect([a.hp(A1), a.stacks(A1, 'charged')]).toEqual([60, 1]); // not on the enemy's turn
    a.pass(1);
    expect([a.hp(A1), a.stacks(A1, 'charged')]).toEqual([70, 2]);
    a.pass(2); // turn 5: over
    expect([a.hp(A1), a.stacks(A1, 'charged'), a.has(B1, 'leech_line')]).toEqual([70, 2, false]);
  });

  it('Leech Line: every Toxin on the target counts, not just its own', () => {
    const a = arena({ p0: [['consume.battery']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 3 });
    a.setHp(A1, 50).use(A1, 'consume.battery', B1).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Voltaic Wasps: a 15 HP swarm for 3 turns', () => {
    const a = arena({ p0: [['summon.battery']], p1: [['shot']] });
    a.use(A1, 'summon.battery').end();
    expect(minions(a, 'voltaic_wasps')[0]!.hp).toBe(15);
    a.pass(5);
    expect(minions(a, 'voltaic_wasps')).toHaveLength(0);
  });

  it('Voltaic Wasps: Arc Sting deals 5 Piercing and 1 Toxin to the target, then 5 Piercing to every other enemy with Toxin', () => {
    const a = arena({ p0: [['summon.battery']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'summon.battery').end().pass(1);
    const wasps = minions(a, 'voltaic_wasps')[0]!;
    a.give(B2, 'toxin', { source: B2 }).give(B1, 'armor', { stacks: 2 });
    a.use(wasps.id, 'voltaic_wasps_arc_sting', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([95 - 5, 95, 100]); // B1's new Toxin ticks at the end of the turn
    expect(a.stacks(B1, 'toxin')).toBe(1);
  });

  it('Acid Drizzle: 10 to all enemies and Corroded for 1 turn each tick; with no Shield or Armor, a 3rd tick, once', () => {
    const a = arena({ p0: [['channel.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.battery').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'corroded')]).toEqual([90, 90, true]);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
  });

  it('Acid Drizzle: no extra tick while an enemy has Shield or Armor', () => {
    const a = arena({ p0: [['channel.battery']], p1: [['shot'], ['shot']] });
    a.give(B2, 'shield', { value: 200 }).use(A1, 'channel.battery').end().pass(4);
    expect(a.hp(B1)).toBe(80);
  });

  it('Shock Prod: 10, then Corroded for 1 turn', () => {
    const a = arena({ p0: [['stab.battery']], p1: [['shot']] });
    a.use(A1, 'stab.battery', B1).end();
    expect([a.hp(B1), a.has(B1, 'corroded')]).toEqual([90, true]);
  });

  it('Shock Prod: 20 against a Corroded target', () => {
    const a = arena({ p0: [['stab.battery']], p1: [['shot']] });
    a.give(B1, 'corroded', { source: A1 }).use(A1, 'stab.battery', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Locked Relay: 25 Piercing and a Sap; while Sapped, 1 less energy each turn for 2 turns', () => {
    const a = arena({ p0: [['ravage.battery']], p1: [['shot'], ['shot'], ['shot']], richEnergy: false });
    a.state.players[0].energy = { S: 0, A: 0, I: 5, W: 5 };
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.battery', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped')]).toEqual([75, 1]);
    expect(gained(a.last, 1)).toBe(2);
    a.end().end();
    expect(gained(a.last, 1)).toBe(2);
    a.end().end();
    expect(gained(a.last, 1)).toBe(3);
  });

  it('Short to Ground: the target\'s Harmful skill is countered; they\'re Corroded and their Shield dissolves for 10 Affliction', () => {
    const a = arena({ p0: [['mislead.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.battery', B1).end();
    a.give(B1, 'shield', { value: 20 }).use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'corroded'), shieldOf(a, B1), a.hp(B1)]).toEqual([85, true, 0, 90]);
  });

  it('Short to Ground: with no Shield, no Affliction', () => {
    const a = arena({ p0: [['mislead.battery']], p1: [['shot']] });
    a.use(A1, 'mislead.battery', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'corroded')]).toEqual([100, 100, true]);
  });

  it('Short to Ground: Helpful skills are not countered; it is Invisible', () => {
    expect(content.skills['mislead.battery']!.tags).toContain('Invisible');
    const a = arena({ p0: [['mislead.battery']], p1: [['heal']] });
    a.use(A1, 'mislead.battery', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'corroded')]).toEqual([75, false]);
  });

  it('Paralysis: Stunned for 1 turn, and their Toxin deals its damage now as well', () => {
    const a = arena({ p0: [['stun.battery']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }); // B1's own-side Toxin ticks at the end of B's turns
    a.use(A1, 'stun.battery', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin'), a.has(B1, 'stun')]).toEqual([90, 2, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Paralysis: no Toxin, no damage', () => {
    const a = arena({ p0: [['stun.battery']], p1: [['shot']] });
    a.use(A1, 'stun.battery', B1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Voltaic Waltz: 1 Might and 2 Swiftness for 3 turns', () => {
    const a = arena({ p0: [['dance.battery']], p1: [['shot']] });
    a.use(A1, 'dance.battery').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([1, 2]);
    a.pass(6);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([0, 0]);
  });

  it('Voltaic Waltz: at the end of each of the user\'s turns, 1 Charge per enemy with Toxin', () => {
    const a = arena({ p0: [['dance.battery']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'toxin', { source: B1 }).give(B2, 'toxin', { source: B1 });
    a.use(A1, 'dance.battery').end();
    expect(a.stacks(A1, 'charged')).toBe(2);
    a.end();
    expect(a.stacks(A1, 'charged')).toBe(2); // not on the enemy's turn
  });

  it('Voltaic Waltz: no Toxin, no Charge', () => {
    const a = arena({ p0: [['dance.battery']], p1: [['shot']] });
    a.use(A1, 'dance.battery').end();
    expect(a.has(A1, 'charged')).toBe(false);
  });

  it('Recharge: the ally heals 20 and receives up to 3 of the user\'s Cells as Charge', () => {
    const a = arena({ p0: [['heal.battery'], ['shot']], p1: [['shot']] });
    a.give(A1, 'cell', { stacks: 4 }).setHp(A2, 50).use(A1, 'heal.battery', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'charged'), a.stacks(A1, 'cell')]).toEqual([70, 3, 1]);
  });

  it('Recharge: with fewer Cells, moves what there is', () => {
    const a = arena({ p0: [['heal.battery'], ['shot']], p1: [['shot']] });
    a.give(A1, 'cell', { stacks: 1 }).use(A1, 'heal.battery', A2).end();
    expect([a.stacks(A2, 'charged'), a.stacks(A1, 'cell')]).toEqual([1, 0]);
  });

  it('Adrenal Charge: 1 Might and 2 Renew; each time the ally is healed, 1 Charge', () => {
    const a = arena({ p0: [['bless.battery'], ['shot'], ['heal']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.battery', A2).end(); // Renew heals at the end of the turn
    expect([a.stacks(A2, 'might'), a.hp(A2) > 50, a.stacks(A2, 'charged')]).toEqual([1, true, 1]);
    a.pass(1).use(A3, 'heal', A2).end();
    expect(a.stacks(A2, 'charged')).toBeGreaterThanOrEqual(2);
  });

  it('Adrenal Charge: an ally without it gains no Charge from healing', () => {
    const a = arena({ p0: [['bless.battery'], ['shot'], ['heal']], p1: [['shot']] });
    a.use(A1, 'bless.battery', A2).end().pass(1);
    a.setHp(A3, 50).use(A3, 'heal', A3).end();
    expect(a.has(A3, 'charged')).toBe(false);
  });

  it('Low Battery: Confused for 2 turns, and Sapped counts toward Prey', () => {
    const a = arena({ p0: [['curse.battery']], p1: [['shot'], ['shot']] });
    const prey = (id: string) => evaluateNamedCondition(content, a.state, 'prey', id);
    a.give(B1, 'sapped', { stacks: 2, source: A1 }).give(B2, 'sapped', { stacks: 2, source: A1 });
    a.give(B2, 'confusion', { source: A1, duration: 4 });
    expect([prey(B1), prey(B2)]).toEqual([false, false]);
    a.use(A1, 'curse.battery', B1).end();
    expect([a.has(B1, 'confusion'), prey(B1), prey(B2)]).toEqual([true, true, false]);
    a.pass(4);
    expect([a.has(B1, 'confusion'), prey(B1)]).toEqual([false, false]);
  });

  it('Stripping Brand: 20 and Corroded for 2 turns; allies who damage them heal 20 if they have no Shield or Armor', () => {
    const a = arena({ p0: [['smite.battery'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.battery', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'corroded'), a.hp(A2)]).toEqual([65, true, 70]);
  });

  it('Stripping Brand: only 10 while they still have Shield', () => {
    const a = arena({ p0: [['smite.battery'], ['shot']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 100 }).setHp(A2, 50).use(A1, 'smite.battery', B1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(60);
  });

  it('Stripping Brand: the healing lasts 1 turn', () => {
    const a = arena({ p0: [['smite.battery'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.battery', B1).end().pass(1);
    a.setHp(A2, 50).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(50);
  });

  it('Shared Grid: all allies heal 15, then each ally\'s HP becomes the team average', () => {
    const a = arena({ p0: [['prayer.battery'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 25).setHp(A2, 45).setHp(A3, 65).setHp(B1, 30).use(A1, 'prayer.battery').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3), a.hp(B1)]).toEqual([60, 60, 60, 30]);
  });

  it('Shared Grid: never above max HP', () => {
    const a = arena({ p0: [['prayer.battery'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 95).use(A1, 'prayer.battery').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]);
  });

  it('Acid Arc: 20 and 15; the other enemy catches the target\'s Corrosion for 2 turns', () => {
    const a = arena({ p0: [['cleave.battery']], p1: [['shot'], ['shot']] });
    a.give(B1, 'corroded', { source: A1 }).use(A1, 'cleave.battery', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'corroded')]).toEqual([80, 85, true]);
    a.pass(2);
    expect(a.has(B2, 'corroded')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'corroded')).toBe(false);
  });

  it('Acid Arc: if the target had no Corrosion, both are Corroded for 1 turn', () => {
    const a = arena({ p0: [['cleave.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.battery', B1).end();
    expect([a.has(B1, 'corroded'), a.has(B2, 'corroded')]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(B1, 'corroded'), a.has(B2, 'corroded')]).toEqual([false, false]);
  });

  it('Overload Alarm: all enemies Intimidated for 2 turns; skills costing 3+ deal their user 15 Affliction', () => {
    const a = arena({ p0: [['shout.battery']], p1: [['blast.battery'], ['shot']] });
    a.use(A1, 'shout.battery').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.use(B1, 'blast.battery').use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Overload Alarm: wears off after 2 turns', () => {
    const a = arena({ p0: [['shout.battery']], p1: [['blast.battery']] });
    a.use(A1, 'shout.battery').end().pass(4);
    a.use(B1, 'blast.battery').end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Battery Pack: 30 Shield for 1 turn; what is left at the end becomes Cells, 1 per 10', () => {
    const a = arena({ p0: [['withstand.battery']], p1: [['shot']] });
    a.use(A1, 'withstand.battery').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'shield'), a.stacks(A1, 'cell')]).toEqual([100, false, 1]);
  });

  it('Battery Pack: untouched, it becomes 3 Cells', () => {
    const a = arena({ p0: [['withstand.battery']], p1: [['shot']] });
    a.use(A1, 'withstand.battery').end().end();
    expect(a.stacks(A1, 'cell')).toBe(3);
  });

  it('Etching Glare: Taunted and Corroded for 2 turns; the Shield the Corrosion strips goes to the user', () => {
    const a = arena({ p0: [['taunt.battery'], ['shot']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 30 }).use(A1, 'taunt.battery', B1).end();
    // Its own Corroded variant (rules §21.36) carries the Shield transfer.
    expect([a.has(B1, 'taunt'), a.has(B1, 'etching_glare'), shieldOf(a, B1), shieldOf(a, A1)]).toEqual([true, true, 20, 10]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBeTruthy();
    a.pass(4);
    expect([a.has(B1, 'taunt'), a.has(B1, 'etching_glare')]).toEqual([false, false]);
  });

  it('Etching Glare: its Corrosion counts as Corroded (Shock Prod deals 20) and blocks Armor', () => {
    const a = arena({ p0: [['taunt.battery', 'stab.battery']], p1: [['titan']] });
    a.use(A1, 'taunt.battery', B1).end().use(B1, 'titan').end();
    expect(a.stacks(B1, 'armor')).toBe(0);
    a.use(A1, 'stab.battery', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Living Battery: Immune for 3 turns, storing 1 Cell at the end of each of the user\'s turns', () => {
    const a = arena({ p0: [['titan.battery']], p1: [['shot'], ['curse']] });
    a.use(A1, 'titan.battery').end();
    expect([a.stacks(A1, 'cell'), a.has(A1, 'stormborn'), a.stacks(A1, 'armor')]).toEqual([1, false, 0]);
    a.use(B2, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(1);
    expect(a.stacks(A1, 'cell')).toBe(2);
    a.pass(2);
    expect([a.stacks(A1, 'cell'), a.has(A1, 'immune')]).toEqual([3, true]);
    a.pass(3);
    expect([a.stacks(A1, 'cell'), a.has(A1, 'immune')]).toEqual([3, false]);
  });

  it('Living Battery: meanwhile each Cell the user holds counts as 1 Armor', () => {
    const a = arena({ p0: [['titan.battery']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.battery').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90); // 1 Cell: 15 − 5
    const b = arena({ p0: [['titan.battery']], p1: [['shot'], ['shot']] });
    b.give(A1, 'cell', { stacks: 2 }).use(A1, 'titan.battery').end().use(B1, 'shot', A1).end();
    expect(b.hp(A1)).toBe(100); // 3 Cells: 15 − 15
    b.pass(5).use(B1, 'shot', A1).end(); // over: Cells are just Cells again
    expect(b.hp(A1)).toBe(85);
  });
});
