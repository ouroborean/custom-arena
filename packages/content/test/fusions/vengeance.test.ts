// Spec-driven scenarios for Vengeance (Lightning + Holy): Vow, Wrath, Ledger of Wrongs and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.38, and the design doc kit table (lightning-pairs.md).
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

const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId);
const shieldOf = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);
const condemnDebuffs = (a: Arena, id: string) => a.stacks(id, 'weakness') + a.stacks(id, 'vulnerable') + a.stacks(id, 'confusion');

function parseCost(s: string): Cost {
  const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s === 'nc') return c;
  for (const ch of s) c[ch as keyof Cost] += 1;
  return c;
}

const kit: [string, string, number][] = [
  ['strike', 'S', 0], ['smash', 'Ar', 2], ['charge', 'S', 2], ['riposte', 'I', 3], ['rage', 'S', 4],
  ['shot', 'r', 0], ['snipe', 'Arr', 2], ['trap', 'r', 2], ['maneuver', 'r', 2], ['companion', 'SI', 4],
  ['bolt', 'I', 1], ['blast', 'IW', 2], ['consume', 'r', 2], ['summon', 'A', 1], ['channel', 'rr', 3],
  ['stab', 'r', 0], ['ravage', 'Ar', 2], ['mislead', 'A', 2], ['stun', 'AI', 2], ['dance', 'AS', 4],
  ['heal', 'A', 1], ['bless', 'r', 2], ['curse', 'S', 2], ['smite', 'W', 1], ['prayer', 'Wrr', 2],
  ['cleave', 'S', 1], ['shout', 'W', 3], ['withstand', 'S', 3], ['taunt', 'r', 3], ['titan', 'Ar', 4],
];

describe('Vengeance kit table', () => {
  it.each(kit)('%s.vengeance costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.vengeance`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
    expect(s.element).toBe('Vengeance');
  });

  it('minion skills: Righteous Strike W, Denounce r', () => {
    expect(content.skills.storm_griffin_righteous_strike!.cost).toEqual(parseCost('W'));
    expect(content.skills.herald_of_vengeance_denounce!.cost).toEqual(parseCost('r'));
  });
});

describe('Vow and Wrath', () => {
  it('Vow: each enemy skill that damages the bearer gives 1 Wrath', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'vow').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(2);
  });

  it('Vow: Wrath is capped at 3', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'vow').give(A1, 'wrath', { stacks: 2 }).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).use(B3, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(3);
  });

  it('Vow: ticking damage (not a skill) gives no Wrath, and neither does a hit without a Vow', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'vow').give(A1, 'toxin', { source: B1, stacks: 2 }).end().end();
    expect([a.hp(A1), a.has(A1, 'wrath')]).toEqual([90, false]);
    a.end().use(B1, 'shot', A2).end();
    expect(a.has(A2, 'wrath')).toBe(false);
  });

  it('Wrath: +10 direct damage per stack on the next damaging skill, then spent for 1 Charge per stack', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'wrath', { stacks: 2 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'wrath'), a.stacks(A1, 'charged')]).toEqual([65, false, 2]);
  });

  it('Wrath: applies to each target of a multi-target skill', () => {
    const a = arena({ p0: [['blast']], p1: [['shot'], ['shot']] });
    a.give(A1, 'wrath').use(A1, 'blast').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'wrath')]).toEqual([55, 55, false]);
  });

  it('Wrath: a Helpful skill doesn\'t spend it', () => {
    const a = arena({ p0: [['heal']], p1: [['shot']] });
    a.give(A1, 'wrath', { stacks: 2 }).use(A1, 'heal', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(2);
  });

  it('every character with a Vengeance skill carries Ledger of Wrongs; others don\'t', () => {
    const a = arena({ p0: [['strike.vengeance'], ['shot']], p1: [['shot']] });
    expect([a.has(A1, 'vengeance_ledger'), a.has(A2, 'vengeance_ledger')]).toEqual([true, false]);
  });
});

describe('Vengeance skills', () => {
  it('Avenging Blow: 20 and doesn\'t spend Wrath', () => {
    const a = arena({ p0: [['strike.vengeance']], p1: [['shot']] });
    a.use(A1, 'strike.vengeance', B1).end();
    expect([a.hp(B1), a.has(A1, 'wrath')]).toEqual([80, false]);
    a.give(A1, 'wrath', { stacks: 2 }).pass(1).use(A1, 'strike.vengeance', B1).end();
    expect(a.stacks(A1, 'wrath')).toBe(2);
  });

  it('Avenging Blow: against the last enemy who damaged the user, +1 Wrath; not against another', () => {
    const a = arena({ p0: [['strike.vengeance']], p1: [['shot'], ['shot']] });
    a.end().use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // B2 hit last
    a.use(A1, 'strike.vengeance', B1).end();
    expect(a.has(A1, 'wrath')).toBe(false);
    a.pass(1).use(A1, 'strike.vengeance', B2).end();
    expect(a.stacks(A1, 'wrath')).toBe(1);
  });

  it('Heaven\'s Rebuke: 25 to the target and 10 to their allies', () => {
    const a = arena({ p0: [['smash.vengeance'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.vengeance', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A2)]).toEqual([75, 90, 90, 100]);
  });

  it('Heaven\'s Rebuke: a hit enemy whose Condemnation triggers gets a second random Debuff', () => {
    const a = arena({ p0: [['smash.vengeance']], p1: [['shot'], ['shot']] });
    a.give(B1, 'condemned', { source: A1 }).give(B2, 'condemned', { source: A1 });
    a.use(A1, 'smash.vengeance', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 90]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([condemnDebuffs(a, B1), condemnDebuffs(a, B2)]).toEqual([2, 2]);
  });

  it('Heaven\'s Rebuke: without it, Condemnation gives one Debuff', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 }).end().use(B1, 'shot', A1).end();
    expect(condemnDebuffs(a, B1)).toBe(1);
  });

  it('Oath Rush: 15 and 1 Focus for the next skill, +1 per Wrath spent on it', () => {
    const a = arena({ p0: [['charge.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.vengeance', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'focus')]).toEqual([85, 1]);
    const b = arena({ p0: [['charge.vengeance']], p1: [['shot']] });
    b.give(A1, 'wrath', { stacks: 2 }).use(A1, 'charge.vengeance', B1).end();
    expect([b.hp(B1), b.stacks(A1, 'focus'), b.has(A1, 'wrath')]).toEqual([65, 3, false]);
  });

  it('Hallowed Feedback: counters the next Harmful skill and the user gains 1 Charge', () => {
    const a = arena({ p0: [['riposte.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.vengeance').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'charged'), a.has(A1, 'anointed')]).toEqual([85, 1, false]);
  });

  it('Hallowed Feedback: if that fills Charge, it is spent to Anoint the user for 2 turns instead', () => {
    const a = arena({ p0: [['riposte.vengeance']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'riposte.vengeance').end().use(B1, 'shot', A1).end();
    expect([a.has(A1, 'charged'), a.has(A1, 'anointed')]).toEqual([false, true]);
    a.pass(4);
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Hallowed Feedback: Invisible; Helpful skills pass', () => {
    expect(content.skills['riposte.vengeance']!.tags).toContain('Invisible');
    const a = arena({ p0: [['riposte.vengeance']], p1: [['heal']] });
    a.use(A1, 'riposte.vengeance').end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(A1, 'charged')]).toEqual([75, false]);
  });

  it('Sworn Vengeance: a Vow for 3 turns, and the user\'s damage doesn\'t spend Wrath meanwhile', () => {
    const a = arena({ p0: [['rage.vengeance', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.vengeance').end().use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(1);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'wrath')]).toEqual([75, 1]);
  });

  it('Sworn Vengeance: when it ends, all Wrath is spent for Charge', () => {
    const a = arena({ p0: [['rage.vengeance']], p1: [['shot']] });
    a.use(A1, 'rage.vengeance').end().use(B1, 'shot', A1).end().end().use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(2);
    a.pass(2);
    expect([a.has(A1, 'vow'), a.has(A1, 'wrath'), a.stacks(A1, 'charged')]).toEqual([false, false, 2]);
  });

  it('Answering Spark: 10, and the target is Sanctified; the user gains 1 Charge each time that Sanctify heals', () => {
    const a = arena({ p0: [['shot.vengeance'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 50).use(A1, 'shot.vengeance', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2), a.hp(A3), a.stacks(A1, 'charged')]).toEqual([60, 65, 65, 2]);
  });

  it('Answering Spark: the Sanctify ends at the user\'s next turn', () => {
    const a = arena({ p0: [['shot.vengeance'], ['shot']], p1: [['shot']] });
    a.use(A1, 'shot.vengeance', B1).end().end();
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Spear of Reprisal: 40 on the following turn', () => {
    const a = arena({ p0: [['snipe.vengeance']], p1: [['shot']] });
    a.use(A1, 'snipe.vengeance', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Spear of Reprisal: if the target hits one of the user’s allies first, it strikes at once as 60 Piercing, and only then', () => {
    const a = arena({ p0: [['snipe.vengeance'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'snipe.vengeance', B1).end();
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([85, 40]); // no 40 on top at the turn's end
  });

  it('Spear of Reprisal: the user counts as an ally', () => {
    const a = arena({ p0: [['snipe.vengeance']], p1: [['shot']] });
    a.use(A1, 'snipe.vengeance', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(40);
  });

  it('Spear of Reprisal: another enemy’s hit doesn’t set it off', () => {
    const a = arena({ p0: [['snipe.vengeance'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.vengeance', B1).end().use(B2, 'shot', A2).end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Spear of Reprisal: Channeled with a hidden target; a Stun on the user stops it', () => {
    expect(content.skills['snipe.vengeance']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    const a = arena({ p0: [['snipe.vengeance'], ['shot']], p1: [['stun.poison', 'shot']] });
    a.use(A1, 'snipe.vengeance', B1).end().use(B1, 'stun.poison', A1).end(); // a Stun that deals no damage
    expect(a.hp(B1)).toBe(100);
  });

  it('Warrant: the target\'s first Harmful skill gives every ally of the user a Vow before it lands', () => {
    const a = arena({ p0: [['trap.vengeance'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'trap.vengeance', B1).end().use(B1, 'shot', A2).end();
    expect([a.stacks(A2, 'wrath'), a.has(A3, 'vow'), a.has(A1, 'vow')]).toEqual([1, true, true]);
    a.pass(2);
    expect(a.has(A2, 'vow')).toBe(false); // 1 turn
  });

  it('Warrant: only the first time; Helpful skills don\'t trigger it; Invisible', () => {
    expect(content.skills['trap.vengeance']!.tags).toContain('Invisible');
    const a = arena({ p0: [['trap.vengeance'], ['shot']], p1: [['heal', 'shot']] });
    a.use(A1, 'trap.vengeance', B1).end().use(B1, 'heal', B1).end();
    expect(a.has(A2, 'vow')).toBe(false);
  });

  it('Vigilant Step: Invulnerable for 1 turn; 1 Wrath each time an enemy damages an ally meanwhile', () => {
    const a = arena({ p0: [['maneuver.vengeance'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.vengeance').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    a.use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect(a.stacks(A1, 'wrath')).toBe(2);
  });

  it('Storm Griffin: a permanent 45 HP minion under a Vow; Righteous Strike deals 15 and Sanctifies for 1 turn', () => {
    const a = arena({ p0: [['companion.vengeance'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.vengeance').end();
    const g = minions(a, 'storm_griffin')[0]!;
    expect([g.hp, a.has(g.id, 'vow')]).toEqual([45, true]);
    a.use(B1, 'shot', g.id).end();
    expect(a.stacks(g.id, 'wrath')).toBe(1);
    a.setHp(A2, 50).use(g.id, 'storm_griffin_righteous_strike', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1) <= 100 - 25 - 15, a.hp(A2)]).toEqual([true, 65]);
    a.pass(10);
    expect([minions(a, 'storm_griffin').length, a.has(g.id, 'vow')]).toEqual([1, true]);
  });

  it('Rebuking Bolt: 20 and Marked for 1 turn; no Wrath, no stun', () => {
    const a = arena({ p0: [['bolt.vengeance'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.vengeance', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.has(B1, 'stun_ns')]).toEqual([80, true, false]);
  });

  it('Rebuking Bolt: if Wrath adds to it, the target\'s non-Strategic skills are stunned for 1 turn', () => {
    const a = arena({ p0: [['bolt.vengeance']], p1: [['shot', 'heal']] });
    a.give(A1, 'wrath').use(A1, 'bolt.vengeance', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns')]).toEqual([70, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'heal', B1).end();
  });

  it('Found Wanting: 10 to all, plus as much again as each dealt the user since their last turn', () => {
    const a = arena({ p0: [['blast.vengeance']], p1: [['shot'], ['shot']] });
    a.end().use(B1, 'shot', A1).end();
    a.use(A1, 'blast.vengeance').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 90]);
  });

  it('Found Wanting: the extra is capped at 40', () => {
    const a = arena({ p0: [['blast.vengeance']], p1: [['blast'], ['blast']] });
    a.end().use(B1, 'blast').use(B2, 'blast').end(); // 35 each to the user
    a.use(A1, 'blast.vengeance').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([55, 55]);
    const b = arena({ p0: [['blast.vengeance']], p1: [['smash'], ['smash']] });
    b.end().give(B1, 'might', { stacks: 6 }).use(B1, 'smash', A1).end(); // 55 to the user
    b.use(A1, 'blast.vengeance').end();
    expect(b.hp(B1)).toBe(50);
  });

  it('Found Wanting: damage from before the user\'s last turn is forgotten', () => {
    const a = arena({ p0: [['blast.vengeance']], p1: [['shot']] });
    a.end().use(B1, 'shot', A1).end().end().end();
    a.use(A1, 'blast.vengeance').end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Siphon Grace: 5 damage and the user heals 10; Wrath goes to healing, 15 per stack, not damage', () => {
    const a = arena({ p0: [['consume.vengeance']], p1: [['shot']] });
    a.setHp(A1, 40).use(A1, 'consume.vengeance', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 50]);
    const b = arena({ p0: [['consume.vengeance']], p1: [['shot']] });
    b.setHp(A1, 40).give(A1, 'wrath', { stacks: 2 }).use(A1, 'consume.vengeance', B1).end();
    expect([b.hp(B1), b.hp(A1), b.has(A1, 'wrath')]).toEqual([95, 80, false]);
  });

  it('Herald of Vengeance: a 20 HP minion with a Vow for 3 turns; Denounce deals 10', () => {
    const a = arena({ p0: [['summon.vengeance']], p1: [['shot']] });
    a.use(A1, 'summon.vengeance').end();
    const h = minions(a, 'herald_of_vengeance')[0]!;
    expect([h.hp, a.has(h.id, 'vow')]).toEqual([20, true]);
    a.pass(1).use(h.id, 'herald_of_vengeance_denounce', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Herald of Vengeance: when it expires, the user gains its Wrath', () => {
    const a = arena({ p0: [['summon.vengeance']], p1: [['shot']] });
    a.use(A1, 'summon.vengeance').end();
    const h = minions(a, 'herald_of_vengeance')[0]!;
    a.use(B1, 'shot', h.id).end().pass(4);
    expect([minions(a, 'herald_of_vengeance').length, a.stacks(A1, 'wrath')]).toEqual([0, 1]);
  });

  it('Herald of Vengeance: when it dies, the user gains its Wrath', () => {
    const a = arena({ p0: [['summon.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.vengeance').end();
    const h = minions(a, 'herald_of_vengeance')[0]!;
    a.use(B1, 'shot', h.id).use(B2, 'shot', h.id).end();
    expect([a.unit(h.id).alive, a.stacks(A1, 'wrath')]).toEqual([false, 1]); // the killing hit's Wrath dies with it
  });

  it('Vigil of Wrath: each of the user\'s turns, 5 to all enemies, for up to 3 turns', () => {
    const a = arena({ p0: [['channel.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.vengeance').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 95]);
    a.pass(4);
    expect(a.hp(B1)).toBe(85);
    a.pass(2);
    expect(a.hp(B1)).toBe(85);
  });

  it('Vigil of Wrath: the user has a Vow while channeling, and Wrath adds to (and is spent by) the ticks', () => {
    const a = arena({ p0: [['channel.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.vengeance').end();
    expect(a.has(A1, 'vow')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(1);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'wrath')]).toEqual([80, 80, false]);
  });

  it('Point of Reckoning: 10 damage; a target left above 60 HP gives no Wrath', () => {
    const a = arena({ p0: [['stab.vengeance']], p1: [['shot']] });
    a.setHp(B1, 71).use(A1, 'stab.vengeance', B1).end();
    expect([a.hp(B1), a.has(A1, 'wrath')]).toEqual([61, false]);
  });

  it('Point of Reckoning: left at or below 60 HP, the user gains 1 Wrath at the end of the turn', () => {
    const a = arena({ p0: [['stab.vengeance']], p1: [['shot']] });
    a.setHp(B1, 70).use(A1, 'stab.vengeance', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'wrath')]).toEqual([60, 1]);
  });

  it('Point of Reckoning: the next one spends that Wrath (10 more, 1 Charge) and banks another', () => {
    const a = arena({ p0: [['stab.vengeance']], p1: [['shot']] });
    a.setHp(B1, 70).use(A1, 'stab.vengeance', B1).end().end();
    a.use(A1, 'stab.vengeance', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged'), a.stacks(A1, 'wrath')]).toEqual([40, 1, 1]);
  });

  it('Clemency: 45 Piercing; if the target uses no Harmful skill on their next turn, they heal 25', () => {
    const a = arena({ p0: [['ravage.vengeance']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.vengeance', B1).end();
    expect(a.hp(B1)).toBe(55);
    a.end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Clemency: a Harmful skill forfeits the heal', () => {
    const a = arena({ p0: [['ravage.vengeance']], p1: [['shot']] });
    a.use(A1, 'ravage.vengeance', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(55);
  });

  it('Swift Reprisal: counters the target\'s Harmful skill and deals them 15 at once, with Wrath adding', () => {
    const a = arena({ p0: [['mislead.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.vengeance', B1).end().give(A1, 'wrath');
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.has(A1, 'wrath'), a.hp(A1), a.hp(B2)]).toEqual([75, false, 85, 100]);
  });

  it('Swift Reprisal: Helpful skills aren\'t countered; Invisible', () => {
    expect(content.skills['mislead.vengeance']!.tags).toContain('Invisible');
    const a = arena({ p0: [['mislead.vengeance']], p1: [['heal']] });
    a.use(A1, 'mislead.vengeance', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Chastening Shock: 15 and Condemned; when the Condemnation triggers, they\'re also Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.vengeance']], p1: [['shot']] });
    a.use(A1, 'stun.vengeance', B1).end();
    expect([a.hp(B1), a.has(B1, 'condemned'), a.has(B1, 'stun')]).toEqual([85, true, false]);
    a.use(B1, 'shot', A1).end();
    expect([a.has(B1, 'condemned'), condemnDebuffs(a, B1), a.has(B1, 'stun')]).toEqual([false, 1, true]);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Heaven\'s Tempest: 1 Might, 2 Swiftness and a Vow for 3 turns', () => {
    const a = arena({ p0: [['dance.vengeance']], p1: [['shot']] });
    a.use(A1, 'dance.vengeance').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.has(A1, 'vow')]).toEqual([1, 2, true]);
    a.pass(6);
    expect(a.has(A1, 'vow')).toBe(false);
  });

  it('Heaven\'s Tempest: reaching 3 Wrath makes the user Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['dance.vengeance']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.vengeance').give(A1, 'wrath', { stacks: 1 }).end();
    a.use(B1, 'shot', A1).end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.stacks(A1, 'wrath'), a.has(A1, 'invulnerable')]).toEqual([3, true]);
  });

  it('Spark of Mercy: the ally heals 20; when their Charge turns into energy in the next 2 turns, they heal 10', () => {
    const a = arena({ p0: [['heal.vengeance'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'charged', { stacks: 3 }).use(A1, 'heal.vengeance', A2).end();
    expect(a.hp(A2)).toBe(70);
    a.end();
    expect([a.has(A2, 'charged'), a.hp(A2)]).toEqual([false, 80]);
  });

  it('Spark of Mercy: no Charge conversion, no extra heal', () => {
    const a = arena({ p0: [['heal.vengeance'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.vengeance', A2).end().end();
    expect(a.hp(A2)).toBe(70);
  });

  it('Oathbond: when an enemy damages either the ally or the user, both gain 1 Wrath', () => {
    const a = arena({ p0: [['bless.vengeance'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.vengeance', A2).end().use(B1, 'shot', A2).use(B2, 'shot', A1).end();
    expect([a.stacks(A1, 'wrath'), a.stacks(A2, 'wrath'), a.has(A3, 'wrath')]).toEqual([2, 2, false]);
  });

  it('Oathbond: lasts 3 turns', () => {
    const a = arena({ p0: [['bless.vengeance'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.vengeance', A2).end().pass(6);
    a.use(B1, 'shot', A2).end();
    expect([a.has(A1, 'wrath'), a.has(A2, 'wrath')]).toEqual([false, false]);
  });

  it('Karmic Debt: the target is Confused for 2 turns', () => {
    const a = arena({ p0: [['curse.vengeance']], p1: [['shot']] });
    a.use(A1, 'curse.vengeance', B1).end();
    expect(a.has(B1, 'confusion')).toBe(true);
    a.pass(3);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Karmic Debt: Confused for 2 turns; each time they deal damage, they take half back as Affliction', () => {
    const a = arena({ p0: [['curse.vengeance']], p1: [['strike']] });
    a.use(A1, 'curse.vengeance', B1).end();
    expect(a.has(B1, 'confusion')).toBe(true);
    a.give(B1, 'shield', { value: 50 }).use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([80, 90]);
    a.pass(3);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Karmic Spark: 20 damage, and the target is Sapped once', () => {
    const a = arena({ p0: [['smite.vengeance']], p1: [['shot']] });
    a.use(A1, 'smite.vengeance', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.has(B1, 'sanctify')]).toEqual([80, 1, false]);
  });

  it('Karmic Spark: for 2 turns, each time they hit one of the user’s allies, they’re Sapped again', () => {
    const a = arena({ p0: [['smite.vengeance'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.vengeance', B1).end().use(B1, 'shot', A2).end();
    expect(a.stacks(B1, 'sapped')).toBe(2);
    a.end().use(B1, 'shot', A1).end(); // their second turn: the third Sap
    expect(a.stacks(B1, 'sapped')).toBe(3);
  });

  it('Karmic Spark: after 2 turns, hits don’t Sap', () => {
    const a = arena({ p0: [['smite.vengeance'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.vengeance', B1).end().pass(4).use(B1, 'shot', A2).end();
    expect([a.stacks(B1, 'sapped'), a.has(B1, 'karmic_spark')]).toEqual([1, false]);
  });

  it('Gathering Oath: all allies heal 20 and gain 10 Shield for 1 turn; every ally\'s Charge moves to the user', () => {
    const a = arena({ p0: [['prayer.vengeance'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'charged', { stacks: 1 }).give(A3, 'charged', { stacks: 1 });
    a.use(A1, 'prayer.vengeance').end();
    expect([a.hp(A2), shieldOf(a, A2), a.stacks(A1, 'charged'), a.has(A2, 'charged'), a.has(A3, 'charged')]).toEqual([70, 10, 2, false, false]);
    a.pass(1);
    expect(a.has(A2, 'shield')).toBe(false);
  });

  it('Arc of Justice: 20 to the target and every Condemned enemy, whose Condemnation triggers now', () => {
    const a = arena({ p0: [['cleave.vengeance']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'condemned', { source: A1 });
    a.use(A1, 'cleave.vengeance', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 80, 100]);
    expect([a.has(B2, 'condemned'), condemnDebuffs(a, B2), condemnDebuffs(a, B1)]).toEqual([false, 1, 0]);
  });

  it('Arc of Justice: with no Condemned enemy, a random other enemy is hit instead', () => {
    const a = arena({ p0: [['cleave.vengeance']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.vengeance', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 80].sort());
  });

  it('Call for Vengeance: every ally takes a Vow for 2 turns; an enemy who gives one Wrath is Intimidated for 1 turn', () => {
    const a = arena({ p0: [['shout.vengeance'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.vengeance').end();
    expect([a.has(A1, 'vow'), a.has(A2, 'vow'), a.has(A3, 'vow')]).toEqual([true, true, true]);
    a.use(B1, 'shot', A2).end();
    expect([a.stacks(A2, 'wrath'), a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([1, true, false]);
    a.pass(3);
    expect(a.has(A2, 'vow')).toBe(false);
  });

  it('Shield of Retribution: 25 Shield for 1 turn; if it breaks, 3 Wrath', () => {
    const a = arena({ p0: [['withstand.vengeance']], p1: [['strike'], ['shot']] });
    a.use(A1, 'withstand.vengeance').end().use(B1, 'strike', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'wrath')]).toEqual([90, 3]);
  });

  it('Shield of Retribution: no break, no Wrath', () => {
    const a = arena({ p0: [['withstand.vengeance']], p1: [['shot']] });
    a.use(A1, 'withstand.vengeance').end().use(B1, 'shot', A1).end().end();
    expect(a.has(A1, 'wrath')).toBe(false);
  });

  it('Come and Face Me: Taunted for 2 turns; each hit from that enemy gives the user 2 Wrath; others give 1 (the Vow)', () => {
    const a = arena({ p0: [['taunt.vengeance'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.vengeance', B1).end();
    expect([a.has(B1, 'taunt'), a.has(A1, 'vow')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBeTruthy();
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(2);
    a.give(A1, 'shield', { value: 50 }).end().use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'wrath')).toBe(3);
  });

  it('Avenger: 2 Armor, Immune and a Vow; enemies who damage the user are Sanctified, so allies who answer heal 15', () => {
    const a = arena({ p0: [['titan.vengeance'], ['shot']], p1: [['shot'], ['curse']] });
    a.use(A1, 'titan.vengeance').end();
    a.use(B1, 'shot', A1).use(B2, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion'), a.stacks(A1, 'wrath'), a.has(B1, 'sanctify'), a.has(B2, 'sanctify')]).toEqual([95, false, 1, true, false]);
    a.setHp(A2, 50).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(65);
  });
});
