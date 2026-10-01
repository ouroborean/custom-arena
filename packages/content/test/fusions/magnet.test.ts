// Spec-driven scenarios for Magnet (Lightning + Earth): Attract, Repel and all 30 skills.
// Sources: in-game descriptions, glossary, docs/rules.md §21.37, and the design doc kit table (lightning-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import type { Cost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, defId: string, owner?: 0 | 1) =>
  a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId && (owner === undefined || u.owner === owner));
const shieldOf = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);
const debuffs = (a: Arena, id: string) => a.effects(id).filter((e) => !e.inline && content.statuses[e.defId]?.kind === 'Debuff').map((e) => e.defId).sort();

function parseCost(s: string): Cost {
  const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s === 'nc') return c;
  for (const ch of s) c[ch as keyof Cost] += 1;
  return c;
}

const kit: [string, string, number][] = [
  ['strike', 'W', 0], ['smash', 'Sr', 2], ['charge', 'r', 2], ['riposte', 'r', 3], ['rage', 'SS', 4],
  ['shot', 'r', 0], ['snipe', 'Ar', 2], ['trap', 'r', 3], ['maneuver', 'r', 3], ['companion', 'I', 1],
  ['bolt', 'Ir', 1], ['blast', 'Irr', 2], ['consume', 'r', 2], ['summon', 'W', 1], ['channel', 'Sr', 3],
  ['stab', 'r', 0], ['ravage', 'Wr', 2], ['mislead', 'A', 2], ['stun', 'Ar', 3], ['dance', 'SI', 4],
  ['heal', 'r', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'W', 1], ['prayer', 'Srr', 2],
  ['cleave', 'W', 1], ['shout', 'S', 3], ['withstand', 'S', 3], ['taunt', 'r', 3], ['titan', 'IW', 4],
];

describe('Magnet kit table', () => {
  it.each(kit)('%s.magnet costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.magnet`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
    expect(s.element).toBe('Magnet');
  });

  it('minion skills: Magnetize r, Iron Fist nc, Grind r', () => {
    expect(content.skills.lodestone_golem_magnetize!.cost).toEqual(parseCost('r'));
    expect(content.skills.lodestone_golem_iron_fist!.cost).toEqual(parseCost('nc'));
    expect(content.skills.iron_filings_grind!.cost).toEqual(parseCost('r'));
  });
});

describe('Attract and Repel', () => {
  it('Repel keeps the Debuff\'s remaining duration', () => {
    const a = arena({ p0: [['curse.magnet']], p1: [['shot']] });
    a.give(A1, 'weakness', { source: B1, duration: 3 });
    a.use(A1, 'curse.magnet', B1).end();
    const w = a.effects(B1).find((e) => e.defId === 'weakness');
    expect(w?.duration).toBe(2); // 3, less the end of this turn
    expect(a.has(A1, 'weakness')).toBe(false);
  });

  it('Attract moves Shield by amount, as a new Shield on the user', () => {
    const a = arena({ p0: [['stun.magnet']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 25 }).use(A1, 'stun.magnet', B1).end();
    expect([shieldOf(a, B1), shieldOf(a, A1)]).toEqual([0, 25]);
  });
});

describe('Magnet skills', () => {
  it('Lodestone Fist: 20; if the target has more Might, Attracts half the difference (rounded down)', () => {
    const a = arena({ p0: [['strike.magnet']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 4 }).use(A1, 'strike.magnet', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'might'), a.stacks(B1, 'might')]).toEqual([80, 2, 2]);
  });

  it('Lodestone Fist: an odd difference rounds down; the Attracted Might lasts 2 turns', () => {
    const a = arena({ p0: [['strike.magnet']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 3 }).use(A1, 'strike.magnet', B1).end();
    expect([a.stacks(A1, 'might'), a.stacks(B1, 'might')]).toEqual([1, 2]);
    a.pass(4);
    expect(a.stacks(A1, 'might')).toBe(0);
  });

  it('Lodestone Fist: no Attract when the target has no more Might than the user', () => {
    const a = arena({ p0: [['strike.magnet']], p1: [['shot']] });
    a.give(A1, 'might', { stacks: 2 }).give(B1, 'might', { stacks: 2 }).use(A1, 'strike.magnet', B1).end();
    expect([a.stacks(A1, 'might'), a.stacks(B1, 'might')]).toEqual([2, 2]);
  });

  it('Iron Quake: 25 and 10; the user Repels one of their Debuffs onto each enemy hit', () => {
    const a = arena({ p0: [['smash.magnet']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'isolated', { source: B1 });
    a.use(A1, 'smash.magnet', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 90]);
    expect(debuffs(a, A1)).toEqual([]);
    expect([debuffs(a, B1).length, debuffs(a, B2).length]).toEqual([1, 1]);
  });

  it('Iron Quake: with one Debuff, only one enemy receives it', () => {
    const a = arena({ p0: [['smash.magnet']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 }).use(A1, 'smash.magnet', B1).end();
    expect(debuffs(a, B1).length + debuffs(a, B2).length).toBe(1);
  });

  it('Reel In: 10; Might, Shield, Armor or Charge the target gains is Attracted to the user', () => {
    const a = arena({ p0: [['charge.magnet']], p1: [['strike']] });
    a.use(A1, 'charge.magnet', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.use(B1, 'strike', A1).end();
    expect([a.stacks(B1, 'might'), a.stacks(A1, 'might')]).toEqual([0, 1]);
  });

  it('Reel In: Shield gained is Attracted too', () => {
    const a = arena({ p0: [['charge.magnet']], p1: [['withstand']] });
    a.use(A1, 'charge.magnet', B1).end().use(B1, 'withstand').end();
    expect([shieldOf(a, B1), shieldOf(a, A1)]).toEqual([0, 25]);
  });

  it('Reel In: ends after the user\'s next turn', () => {
    const a = arena({ p0: [['charge.magnet']], p1: [['strike']] });
    a.use(A1, 'charge.magnet', B1).end().pass(2);
    a.use(B1, 'strike', A1).end();
    expect([a.stacks(B1, 'might'), a.stacks(A1, 'might')]).toEqual([1, 0]);
  });

  it('Repulsor Ward: Reflects the first Harmful skill and Repels one Debuff onto its user', () => {
    const a = arena({ p0: [['riposte.magnet']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 });
    a.use(A1, 'riposte.magnet').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.has(B1, 'confusion'), a.has(A1, 'confusion')]).toEqual([85, true, false]);
    expect(a.hp(A1)).toBe(85); // only the first
  });

  it('Repulsor Ward: Helpful skills pass; it is Invisible', () => {
    expect(content.skills['riposte.magnet']!.tags).toContain('Invisible');
    const a = arena({ p0: [['riposte.magnet']], p1: [['heal'], ['shot']] });
    a.use(A1, 'riposte.magnet').end();
    a.setHp(B1, 50).use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([75, 85, 100]);
  });

  it('Repelling Fury: 2 Might for 3 turns; each turn start, all Debuffs go to the enemy who last damaged the user', () => {
    const a = arena({ p0: [['rage.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.magnet').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'isolated', { source: B1 });
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(debuffs(a, A1)).toEqual([]);
    expect(debuffs(a, B2)).toEqual(['confusion', 'isolated']);
    expect(debuffs(a, B1)).toEqual([]);
    a.pass(6);
    expect(a.stacks(A1, 'might')).toBe(0);
  });

  it('Magnetic Launch: 15, or 30 if an allied Boulder sheds 15 HP', () => {
    const a = arena({ p0: [['shot.magnet'], ['charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.magnet', B1).use(A2, 'charge.earth', B2).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(A1, 'shot.magnet', B1).end();
    expect([a.hp(B1), minions(a, 'boulder', 0)[0]!.hp]).toEqual([55, 30]);
  });

  it('Mass Driver: creates a Boulder now, and the launched Boulder is used up on the following turn', () => {
    const a = arena({ p0: [['snipe.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.magnet', B1).end();
    expect([minions(a, 'boulder', 0).length, a.hp(B1)]).toEqual([1, 100]);
    a.end();
    expect([a.hp(B1) < 100, a.hp(B2), minions(a, 'boulder', 0).length]).toEqual([true, 100, 0]);
  });

  // BUG: "20 damage plus its remaining HP" (20 + 45 = 65) — the launch deals 120.
  it.fails('Mass Driver: creates a Boulder; on the following turn a Boulder is launched for 20 + its HP', () => {
    const a = arena({ p0: [['snipe.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.magnet', B1).end();
    expect([minions(a, 'boulder', 0).length, a.hp(B1)]).toEqual([1, 100]);
    a.end();
    expect([a.hp(B1), a.hp(B2), minions(a, 'boulder', 0).length]).toEqual([35, 100, 0]);
  });

  it('Mass Driver: Channeled with a hidden target', () => {
    expect(content.skills['snipe.magnet']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
  });

  it('Polarized Trap: the target\'s first Harmful skill costs them 15 and their Armor and Shield', () => {
    const a = arena({ p0: [['trap.magnet']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 1 }).give(B1, 'shield', { value: 20 });
    a.use(A1, 'trap.magnet', B1).end().use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'armor'), shieldOf(a, B1), a.stacks(A1, 'armor')]).toEqual([0, 0, 1]);
    expect(a.hp(A1)).toBe(100); // the Attracted Armor and Shield soak the trapped Shot
  });

  it('Polarized Trap: 15 damage, once; Helpful skills don\'t trigger it; Invisible', () => {
    expect(content.skills['trap.magnet']!.tags).toContain('Invisible');
    const a = arena({ p0: [['trap.magnet']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap.magnet', B1).end().use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Maglev: Invulnerable for 1 turn, and all Debuffs are Repelled onto a random enemy', () => {
    const a = arena({ p0: [['maneuver.magnet']], p1: [['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'weakness', { source: B1 });
    a.use(A1, 'maneuver.magnet').end();
    expect([a.has(A1, 'invulnerable'), debuffs(a, A1), debuffs(a, B1)]).toEqual([true, [], ['confusion', 'weakness']]);
  });

  it('Lodestone Golem: a permanent 50 HP minion; Iron Fist deals 10', () => {
    const a = arena({ p0: [['companion.magnet']], p1: [['shot']] });
    a.use(A1, 'companion.magnet').end();
    const g = minions(a, 'lodestone_golem')[0]!;
    expect(g.hp).toBe(50);
    a.pass(1).use(g.id, 'lodestone_golem_iron_fist', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(10);
    expect(minions(a, 'lodestone_golem')).toHaveLength(1);
  });

  it('Lodestone Golem: Magnetize Attracts 1 Armor, or 10 Shield, from the target to the Golem', () => {
    const a = arena({ p0: [['companion.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.magnet').end().pass(1);
    const g = minions(a, 'lodestone_golem')[0]!;
    a.give(B1, 'armor', { stacks: 2 }).use(g.id, 'lodestone_golem_magnetize', B1).end();
    expect([a.stacks(B1, 'armor'), a.stacks(g.id, 'armor')]).toEqual([1, 1]);
    a.pass(1).give(B2, 'shield', { value: 30 }).use(g.id, 'lodestone_golem_magnetize', B2).end();
    expect([shieldOf(a, B2), shieldOf(a, g.id)]).toEqual([20, 10]);
  });

  it('Polarity Bolt: Repels up to 2 Debuffs onto the target first, +10 damage per Debuff moved', () => {
    const a = arena({ p0: [['bolt.magnet']], p1: [['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'isolated', { source: B1 }).give(A1, 'intimidated', { source: B1 });
    a.use(A1, 'bolt.magnet', B1).end();
    expect([a.hp(B1), debuffs(a, A1).length, debuffs(a, B1).length]).toEqual([60, 1, 2]);
  });

  it('Polarity Bolt: no Debuffs, plain 20', () => {
    const a = arena({ p0: [['bolt.magnet']], p1: [['shot']] });
    a.use(A1, 'bolt.magnet', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Magnetic Storm: 25 to all; all the user\'s Charge is spent and each enemy is Sapped once per Charge', () => {
    const a = arena({ p0: [['blast.magnet']], p1: [['shot'], ['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'blast.magnet').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'charged'), a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped')]).toEqual([75, 75, 0, 2, 2]);
  });

  it('Magnetic Storm: no Charge, no Sap', () => {
    const a = arena({ p0: [['blast.magnet']], p1: [['shot']] });
    a.use(A1, 'blast.magnet').end();
    expect(a.has(B1, 'sapped')).toBe(false);
  });

  it('Ferrous Harvest: 5 Piercing to each enemy with Armor or Shield; the user heals 10 per one hit', () => {
    const a = arena({ p0: [['consume.magnet']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 1 }).give(B2, 'shield', { value: 20 }).setHp(A1, 50);
    a.use(A1, 'consume.magnet').end();
    expect([a.hp(B1), shieldOf(a, B2), a.hp(B3), a.hp(A1)]).toEqual([95, 15, 100, 70]);
  });

  it('Ferrous Harvest: enemy minions with Armor or Shield count too', () => {
    const a = arena({ p0: [['consume.magnet']], p1: [['companion.magnet']] });
    a.end().use(B1, 'companion.magnet').end();
    const g = minions(a, 'lodestone_golem', 1)[0]!;
    a.give(g.id, 'armor', { stacks: 1 }).setHp(A1, 50).use(A1, 'consume.magnet').end();
    expect([a.hp(g.id), a.hp(B1), a.hp(A1)]).toEqual([45, 100, 60]);
  });

  it('Clinging Filings: a 20 HP swarm for 3 turns; Grind deals 10 Piercing to the enemy it clings to', () => {
    const a = arena({ p0: [['summon.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.magnet', B2).end().pass(1);
    const f = minions(a, 'iron_filings')[0]!;
    expect(f.hp).toBe(20);
    a.give(B2, 'armor', { stacks: 2 });
    const target = content.skills.iron_filings_grind!.target;
    a.use(f.id, 'iron_filings_grind', target === 'enemy' ? B1 : undefined).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 90]);
    a.pass(3);
    expect(minions(a, 'iron_filings')).toHaveLength(0);
  });

  it('Electromagnet: each of the user\'s turns, 10 to all enemies, for up to 3 turns', () => {
    const a = arena({ p0: [['channel.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.magnet').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(4);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
  });

  it('Electromagnet: each tick Attracts 10 Shield from each enemy', () => {
    const a = arena({ p0: [['channel.magnet']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 30 }).use(A1, 'channel.magnet').end();
    expect([shieldOf(a, B1), shieldOf(a, A1), a.hp(B1)]).toEqual([10, 10, 100]);
  });

  it('Electromagnet: ends early if an enemy damages the user', () => {
    const a = arena({ p0: [['channel.magnet']], p1: [['shot']] });
    a.use(A1, 'channel.magnet').end().use(B1, 'shot', A1).end().end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Grounding Pin: 10, or 20 at or below 60 HP; then all Sapped is spent for 10 per stack', () => {
    const a = arena({ p0: [['stab.magnet']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sapped', { stacks: 2, source: A1 }).use(A1, 'stab.magnet', B1).end();
    expect([a.hp(B1), a.has(B1, 'sapped')]).toEqual([70, false]);
    a.setHp(B2, 60).pass(1).use(A1, 'stab.magnet', B2).end();
    expect(a.hp(B2)).toBe(40);
  });

  it('Rail Drill: Attracts all the target\'s Armor first, then 25 Piercing +10 per Armor taken', () => {
    const a = arena({ p0: [['ravage.magnet']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.magnet', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'armor'), a.stacks(A1, 'armor')]).toEqual([55, 0, 2]);
  });

  it('Rail Drill: no Armor, plain 25 Piercing', () => {
    const a = arena({ p0: [['ravage.magnet']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 10 }).use(A1, 'ravage.magnet', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Pole Reversal: counters the target\'s Harmful skill; the user takes their Armor, Might, Charge and Shield', () => {
    const a = arena({ p0: [['mislead.magnet']], p1: [['shot']] });
    a.use(A1, 'mislead.magnet', B1).end();
    a.give(B1, 'armor').give(B1, 'might', { stacks: 2 }).give(B1, 'charged', { stacks: 2 }).give(B1, 'shield', { value: 20 });
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect([a.stacks(A1, 'armor'), a.stacks(A1, 'might'), a.stacks(A1, 'charged'), shieldOf(a, A1)]).toEqual([1, 2, 2, 20]);
    expect([a.has(B1, 'armor'), a.has(B1, 'might'), a.has(B1, 'charged'), shieldOf(a, B1)]).toEqual([false, false, false, 0]);
  });

  it('Pole Reversal: Helpful skills aren\'t countered; Invisible', () => {
    expect(content.skills['mislead.magnet']!.tags).toContain('Invisible');
    const a = arena({ p0: [['mislead.magnet']], p1: [['heal']] });
    a.use(A1, 'mislead.magnet', B1).end().give(B1, 'might').setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'might')]).toEqual([75, true]);
  });

  it('Clamp: Stunned for 1 turn; the user Attracts their Armor and Shield (and keeps them)', () => {
    const a = arena({ p0: [['stun.magnet']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B1, 'shield', { value: 20 }).use(A1, 'stun.magnet', B1).end();
    expect([a.has(B1, 'stun'), a.stacks(A1, 'armor'), shieldOf(a, A1), a.stacks(B1, 'armor')]).toEqual([true, 2, 20, 0]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect([a.has(B1, 'stun'), a.stacks(A1, 'armor')]).toEqual([false, 2]);
  });

  it('Static Quarry: 1 Swiftness and Stormborn for 4 turns', () => {
    const a = arena({ p0: [['dance.magnet']], p1: [['shot']] });
    a.use(A1, 'dance.magnet').end();
    expect([a.stacks(A1, 'swiftness'), a.has(A1, 'stormborn')]).toEqual([1, true]);
    a.pass(8);
    expect(a.has(A1, 'stormborn')).toBe(false);
  });

  it('Static Quarry: reaching 3 Charge creates a Boulder; below 3, nothing', () => {
    const a = arena({ p0: [['dance.magnet']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.magnet').end();
    a.give(A1, 'charged', { stacks: 1 }).use(B1, 'shot', A1).end();
    expect(minions(a, 'boulder', 0)).toHaveLength(0);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(minions(a, 'boulder', 0)).toHaveLength(1);
  });

  it('Draw Out: the ally heals 15 and Repels one Debuff onto a random enemy', () => {
    const a = arena({ p0: [['heal.magnet'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'confusion', { source: B1 }).give(A2, 'weakness', { source: B1 });
    a.use(A1, 'heal.magnet', A2).end();
    expect([a.hp(A2), debuffs(a, A2).length, debuffs(a, B1).length]).toEqual([65, 1, 1]);
  });

  it('Polarized Plating: 1 Armor; the first Debuff put on the ally each turn is Repelled onto a random enemy', () => {
    const a = arena({ p0: [['bless.magnet'], ['shot']], p1: [['curse'], ['curse']] });
    a.use(A1, 'bless.magnet', A2).end();
    expect(a.stacks(A2, 'armor')).toBe(1);
    a.use(B1, 'curse', A2).use(B2, 'curse', A2).end();
    expect(a.stacks(A2, 'confusion')).toBe(1);
    expect(a.stacks(B1, 'confusion') + a.stacks(B2, 'confusion')).toBe(1);
  });

  it('Polarized Plating: wears off after 3 turns', () => {
    const a = arena({ p0: [['bless.magnet'], ['shot']], p1: [['curse']] });
    a.use(A1, 'bless.magnet', A2).end().pass(6);
    expect(a.has(A2, 'armor')).toBe(false);
    a.use(B1, 'curse', A2).end();
    expect([a.has(A2, 'confusion'), a.has(B1, 'confusion')]).toEqual([true, false]);
  });

  it('Offload: the user Repels one of their Debuffs onto the target', () => {
    const a = arena({ p0: [['curse.magnet']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'isolated', { source: B1 });
    a.use(A1, 'curse.magnet', B1).end();
    expect([debuffs(a, A1).length, debuffs(a, B1).length, debuffs(a, B2).length]).toEqual([1, 1, 0]);
  });

  // BUG: "Each ally Repels one Debuff onto target enemy" — only the user's own Debuff moves; other allies keep theirs.
  it.fails('Offload: each ally Repels one Debuff onto the target', () => {
    const a = arena({ p0: [['curse.magnet'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A2, 'weakness', { source: B1 }).give(A2, 'isolated', { source: B1 });
    a.use(A1, 'curse.magnet', B1).end();
    expect([debuffs(a, A1).length, debuffs(a, A2).length, debuffs(a, B1).length, debuffs(a, B2).length]).toEqual([0, 1, 2, 0]);
  });

  it('True North: 20, and the target is Vulnerable until the user\'s next turn', () => {
    const a = arena({ p0: [['smite.magnet'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.magnet', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'vulnerable')]).toEqual([60, true]);
    a.pass(1);
    expect(a.has(B1, 'vulnerable')).toBe(false);
  });

  it('Shared Field: Attracts every enemy\'s Shield and splits it evenly among the allies; then all allies heal 20', () => {
    const a = arena({ p0: [['prayer.magnet'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'shield', { value: 30 }).give(B2, 'shield', { value: 30 }).setHp(A1, 50).setHp(A2, 90);
    a.use(A1, 'prayer.magnet').end();
    expect([shieldOf(a, B1), shieldOf(a, B2)]).toEqual([0, 0]);
    expect([shieldOf(a, A1), shieldOf(a, A2), shieldOf(a, A3)]).toEqual([20, 20, 20]);
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 100]);
  });

  it('Grounding Whirl: 20 and 15; until the user\'s next turn, 1 Charge each time an ally takes damage', () => {
    const a = arena({ p0: [['cleave.magnet'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.magnet', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 85]);
    a.use(B1, 'shot', A2).end();
    expect(a.stacks(A1, 'charged')).toBe(1);
    a.end().use(B1, 'shot', A2).end();
    expect(a.stacks(A1, 'charged')).toBe(1);
  });

  it('Lodestone Hum: all enemies Intimidated for 2 turns; Sapped once per allied Boulder', () => {
    const a = arena({ p0: [['shout.magnet'], ['charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.magnet').end();
    expect([a.has(B1, 'intimidated'), a.has(B1, 'sapped')]).toEqual([true, false]);
    const b = arena({ p0: [['shout.magnet'], ['charge.earth']], p1: [['shot'], ['shot']] });
    b.use(A2, 'charge.earth', B1).end().pass(1).use(A1, 'shout.magnet').end();
    expect([b.stacks(B1, 'sapped'), b.stacks(B2, 'sapped')]).toEqual([1, 1]);
  });

  it('Rebound Plate: 20 Shield for 1 turn; when it ends, one Debuff is Repelled onto each enemy who damaged the user', () => {
    const a = arena({ p0: [['withstand.magnet']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'isolated', { source: B1 });
    a.use(A1, 'withstand.magnet').end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1);
    expect([a.has(A1, 'shield'), debuffs(a, A1).length, debuffs(a, B1).length, debuffs(a, B2).length]).toEqual([false, 1, 1, 0]);
  });

  it('Opposite Poles: Taunts the target for 2 turns, and the user\'s Harmful skills can target only them', () => {
    const a = arena({ p0: [['taunt.magnet', 'shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.magnet', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBeTruthy();
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B2))).toBeTruthy();
    a.use(A2, 'shot', B2).use(A1, 'shot', B1).end(); // allies are not restricted
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it('Iron Colossus: creates a Boulder and absorbs every allied Boulder for 1 Armor per 15 HP, and Immune', () => {
    const a = arena({ p0: [['titan.magnet'], ['charge.earth']], p1: [['shot'], ['curse']] });
    a.use(A2, 'charge.earth', B1).end().pass(1);
    a.use(A1, 'titan.magnet').end(); // two 45 HP Boulders → 6 Armor
    expect([a.stacks(A1, 'armor'), minions(a, 'boulder', 0).length]).toEqual([6, 0]);
    a.use(B2, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Iron Colossus: when it ends, the Armor falls away as one Boulder with 10 HP per stack', () => {
    const a = arena({ p0: [['titan.magnet']], p1: [['shot']] });
    a.use(A1, 'titan.magnet').end();
    expect(a.stacks(A1, 'armor')).toBe(3);
    a.pass(6);
    const bs = minions(a, 'boulder', 0);
    expect([a.stacks(A1, 'armor'), bs.length, bs[0]?.hp]).toEqual([0, 1, 30]);
  });
});
