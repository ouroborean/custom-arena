// Spec-driven scenarios for Ion (Lightning + Shadow): Suppressed, Blackout and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.40, and the design doc kit table (lightning-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Enemy minions come from base Companion (a Wolf: 30 HP, bites a random enemy for 10 at the end of its owner's turn).

import { describe, expect, it } from 'vitest';
import type { Cost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minions = (a: Arena, defId: string, owner?: 0 | 1) =>
  a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId && (owner === undefined || u.owner === owner));

/** B1 summons a Wolf on turn 2; returns at the start of turn 3 with A1 bitten once (90 HP). */
function enemyWolf(a: Arena): string {
  a.end().use(B1, 'companion').end();
  return minions(a, 'wolf', 1)[0]!.id;
}

function parseCost(s: string): Cost {
  const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s === 'nc') return c;
  for (const ch of s) c[ch as keyof Cost] += 1;
  return c;
}

const kit: [string, string, number][] = [
  ['strike', 'S', 1], ['smash', 'Sr', 2], ['charge', 'S', 3], ['riposte', 'A', 3], ['rage', 'SI', 4],
  ['shot', 'r', 0], ['snipe', 'Ar', 2], ['trap', 'r', 2], ['maneuver', 'r', 4], ['companion', 'I', 1],
  ['bolt', 'Ar', 1], ['blast', 'Irr', 2], ['consume', 'r', 2], ['summon', 'I', 1], ['channel', 'Sr', 3],
  ['stab', 'r', 0], ['ravage', 'Ar', 1], ['mislead', 'S', 2], ['stun', 'A', 3], ['dance', 'AA', 4],
  ['heal', 'W', 1], ['bless', 'r', 2], ['curse', 'A', 2], ['smite', 'W', 1], ['prayer', 'Wrr', 2],
  ['cleave', 'S', 1], ['shout', 'Sr', 3], ['withstand', 'A', 3], ['taunt', 'r', 3], ['titan', 'IW', 4],
];

describe('Ion kit table', () => {
  it.each(kit)('%s.ion costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.ion`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
    expect(s.element).toBe('Ion');
  });

  it('tags: Dark Current, Go Dark, Dark Hum and Scramble are Stealthy; Null Guard and Signal Jam are Invisible', () => {
    for (const id of ['charge.ion', 'maneuver.ion', 'channel.ion', 'shadow_drone_scramble']) expect(content.skills[id]!.tags).toContain('Stealthy');
    for (const id of ['riposte.ion', 'mislead.ion']) expect(content.skills[id]!.tags).toContain('Invisible');
    expect(content.skills['snipe.ion']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    expect(content.skills['channel.ion']!.tags).toContain('Channeled');
  });

  it('minion skills: Scramble r, Needle Arc r, Static Hiss r', () => {
    for (const id of ['shadow_drone_scramble', 'shadow_drone_needle_arc', 'jammer_static_hiss']) expect(content.skills[id]!.cost).toEqual(parseCost('r'));
  });
});

describe('Suppressed and Blackout', () => {
  it('Suppressed: the bearer\'s Might and Armor have no effect', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 2 }).give(B1, 'armor', { stacks: 2 }).give(B1, 'suppressed', { source: A1 });
    a.use(A1, 'shot', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([85, 85]);
  });

  it('Suppressed: the Buffs still tick down, and work again once it ends; Shield still absorbs', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 2 }).give(B1, 'suppressed', { source: A1, duration: 2 }).give(B1, 'shield', { value: 10 });
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(95);
    a.end().end();
    expect(a.has(B1, 'suppressed')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Blackout: the bearer\'s minions can\'t act and their effects pause', () => {
    const a = arena({ p0: [['charge.ion']], p1: [['shot', 'companion']] });
    const wolf = enemyWolf(a);
    a.use(A1, 'charge.ion', B1).end();
    expect([a.has(B1, 'blackout'), a.has(wolf, 'blacked_out')]).toEqual([true, true]);
    a.end();
    expect(a.hp(A1)).toBe(90); // the Wolf didn't bite
  });
});

describe('Ion skills', () => {
  it('Power Cut: 20; until their next skill resolves, they can\'t apply Buffs', () => {
    const a = arena({ p0: [['strike.ion']], p1: [['strike']] });
    a.use(A1, 'strike.ion', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B1, 'strike', A1).end();
    expect(a.has(B1, 'might')).toBe(false);
    a.end().use(B1, 'strike', A1).end();
    expect(a.stacks(B1, 'might')).toBe(1);
  });

  it('Surge from the Dark: allies pass the user their Charge; 20 and 10, +5 to each hit per Charge passed', () => {
    const a = arena({ p0: [['smash.ion'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'charged', { stacks: 1 }).give(A3, 'charged', { stacks: 1 });
    a.use(A1, 'smash.ion', B1).end();
    expect([a.stacks(A1, 'charged'), a.has(A2, 'charged'), a.hp(B1), a.hp(B2)]).toEqual([2, false, 70, 80]);
  });

  it('Surge from the Dark: no Charge passed, 20 and 10', () => {
    const a = arena({ p0: [['smash.ion'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ion', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it('Dark Current: 10, Blackout until the user\'s next turn, and the user gains 1 Focus', () => {
    const a = arena({ p0: [['charge.ion']], p1: [['shot']] });
    a.use(A1, 'charge.ion', B1).end();
    expect([a.hp(B1), a.has(B1, 'blackout'), a.stacks(A1, 'focus')]).toEqual([90, true, 1]);
    a.end();
    expect(a.has(B1, 'blackout')).toBe(false);
  });

  it('Null Guard: counters the first Harmful skill; its user is Suppressed 1 turn per Buff (here 2)', () => {
    const a = arena({ p0: [['riposte.ion']], p1: [['shot'], ['shot']] });
    a.give(B1, 'might').give(B1, 'armor');
    a.use(A1, 'riposte.ion').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'suppressed')]).toEqual([85, true]);
    a.pass(2);
    expect(a.has(B1, 'suppressed')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'suppressed')).toBe(false);
  });

  it('Null Guard: one Buff, 1 turn; capped at 3', () => {
    const a = arena({ p0: [['riposte.ion']], p1: [['shot']] });
    a.give(B1, 'might').use(A1, 'riposte.ion').end().use(B1, 'shot', A1).end();
    expect(a.has(B1, 'suppressed')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'suppressed')).toBe(false);
    const b = arena({ p0: [['riposte.ion']], p1: [['shot']] });
    b.give(B1, 'might').give(B1, 'armor').give(B1, 'focus').give(B1, 'swiftness').give(B1, 'ghosted');
    b.use(A1, 'riposte.ion').end().use(B1, 'shot', A1).end().pass(6);
    expect(b.has(B1, 'suppressed')).toBe(false);
  });

  it('Static Fury: 2 Might for 3 turns; each enemy the user damages is Suppressed until the user\'s next turn', () => {
    const a = arena({ p0: [['rage.ion', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.ion').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    a.pass(1).give(B1, 'might', { stacks: 2 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'suppressed'), a.has(B2, 'suppressed')]).toEqual([75, true, false]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'suppressed')]).toEqual([85, false]);
  });

  it('Seeker Spark: 15 to the target', () => {
    const a = arena({ p0: [['shot.ion']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.ion', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Seeker Spark: if there are Stealthed enemies, the target is spared and their Stealth ends', () => {
    const a = arena({ p0: [['shot.ion']], p1: [['shot'], ['shot']] });
    a.give(B2, 'stealth').use(A1, 'shot.ion', B1).end();
    expect([a.hp(B1), a.has(B2, 'stealth')]).toEqual([100, false]);
  });

  it('Seeker Spark: if there are Stealthed enemies, it hits them instead (Bypassing) and ends their Stealth', () => {
    const a = arena({ p0: [['shot.ion']], p1: [['shot'], ['shot']] });
    a.give(B2, 'stealth').give(B2, 'invulnerable').use(A1, 'shot.ion', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'stealth')]).toEqual([100, 85, false]);
  });

  it('Ion Cannon: on the following turn, 40 damage and Suppressed for 1 turn', () => {
    const a = arena({ p0: [['snipe.ion']], p1: [['shot']] });
    a.give(B1, 'armor').give(B1, 'might', { stacks: 2 });
    a.use(A1, 'snipe.ion', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.has(B1, 'suppressed')]).toEqual([60, true]);
  });

  it('EMP Mine: the first time the target summons a minion, 15 damage and Blackout for 3 turns', () => {
    const a = arena({ p0: [['trap.ion']], p1: [['shot', 'companion']] });
    a.use(A1, 'trap.ion', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
    a.end().use(B1, 'companion').end();
    expect([a.hp(B1), a.has(B1, 'blackout')]).toEqual([85, true]);
    expect(a.hp(A1)).toBe(85); // the new Wolf was blacked out at once
  });

  it('EMP Mine: starting a channel sets it off too', () => {
    const a = arena({ p0: [['trap.ion']], p1: [['channel']] });
    a.use(A1, 'trap.ion', B1).end().use(B1, 'channel').end();
    expect([a.hp(B1) <= 85, a.has(B1, 'blackout')]).toEqual([true, true]);
  });

  it('Go Dark: the user becomes Invulnerable for 2 turns', () => {
    const a = arena({ p0: [['maneuver.ion']], p1: [['shot']] });
    a.use(A1, 'maneuver.ion').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'ghosted')]).toEqual([true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Go Dark: meanwhile the user can\'t use Harmful skills; Helpful ones are fine', () => {
    const a = arena({ p0: [['maneuver.ion', 'shot', 'heal']], p1: [['shot']] });
    a.use(A1, 'maneuver.ion').end().pass(1);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBeTruthy();
    a.setHp(A1, 50).use(A1, 'heal', A1).end();
    expect(a.hp(A1)).toBe(75);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Shadow Drone: a permanent, Stealthed 20 HP minion; Scramble Suppresses for 1 turn and keeps Stealth', () => {
    const a = arena({ p0: [['companion.ion']], p1: [['shot']] });
    a.use(A1, 'companion.ion').end();
    const d = minions(a, 'shadow_drone')[0]!;
    expect([d.hp, a.has(d.id, 'stealth')]).toEqual([20, true]);
    expect(a.reject(() => a.use(B1, 'shot', d.id))).toBeTruthy();
    a.end().use(d.id, 'shadow_drone_scramble', B1).end();
    expect([a.has(B1, 'suppressed'), a.has(d.id, 'stealth')]).toEqual([true, true]);
  });

  it('Shadow Drone: Needle Arc deals 15 Piercing and ends the Drone\'s Stealth', () => {
    const a = arena({ p0: [['companion.ion']], p1: [['shot']] });
    a.use(A1, 'companion.ion').end().pass(1);
    const d = minions(a, 'shadow_drone')[0]!;
    a.give(B1, 'armor', { stacks: 2 }).use(d.id, 'shadow_drone_needle_arc', B1).end();
    expect([a.hp(B1), a.has(d.id, 'stealth')]).toEqual([85, false]);
    a.pass(10);
    expect(minions(a, 'shadow_drone')).toHaveLength(1);
  });

  it('Blackspark: 20 and Blackout for 2 turns; +15 if they have a minion', () => {
    const a = arena({ p0: [['bolt.ion']], p1: [['shot', 'companion'], ['shot']] });
    a.use(A1, 'bolt.ion', B2).end();
    expect([a.hp(B2), a.has(B2, 'blackout')]).toEqual([80, true]);
    a.pass(3);
    expect(a.has(B2, 'blackout')).toBe(false);
    a.end().use(B1, 'companion').end().use(A1, 'bolt.ion', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Blackspark: +15 if they are channeling', () => {
    const a = arena({ p0: [['bolt.ion']], p1: [['channel']] });
    a.end().use(B1, 'channel').end();
    const before = a.hp(B1);
    a.use(A1, 'bolt.ion', B1).end();
    expect(before - a.hp(B1)).toBe(35);
  });

  it('EMP: 20 to all; each Suppressed for 1 turn, +1 per Charge the user spends (all of it)', () => {
    const a = arena({ p0: [['blast.ion']], p1: [['shot'], ['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'blast.ion').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'suppressed'), a.has(A1, 'charged')]).toEqual([80, 80, true, false]);
    a.pass(4);
    expect(a.has(B1, 'suppressed')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'suppressed')).toBe(false);
  });

  it('EMP: without Charge, 1 turn', () => {
    const a = arena({ p0: [['blast.ion']], p1: [['shot']] });
    a.use(A1, 'blast.ion').end().pass(2);
    expect(a.has(B1, 'suppressed')).toBe(false);
  });

  it('Grid Drain: 5 to the target and 10 to each of their minions (blacked out 1 turn); the user heals it all', () => {
    const a = arena({ p0: [['consume.ion']], p1: [['shot', 'companion'], ['shot']] });
    const wolf = enemyWolf(a);
    a.setHp(A1, 50).use(A1, 'consume.ion', B1).end();
    expect([a.hp(B1), a.hp(wolf), a.has(wolf, 'blacked_out'), a.hp(A1)]).toEqual([95, 20, true, 65]);
    a.end();
    expect(a.hp(A1)).toBe(65); // no bite
  });

  it('Jammer: a 15 HP minion for 3 turns; while it stands, every enemy has Blackout', () => {
    const a = arena({ p0: [['summon.ion']], p1: [['shot', 'companion'], ['shot']] });
    const wolf = enemyWolf(a);
    a.use(A1, 'summon.ion').end();
    const j = minions(a, 'jammer')[0]!;
    expect([j.hp, a.has(B1, 'blackout'), a.has(B2, 'blackout'), a.has(wolf, 'blackout')]).toEqual([15, true, true, true]);
    a.end();
    expect(a.hp(A1)).toBe(90);
  });

  it('Jammer: Static Hiss deals 10; when it falls, the Blackout ends', () => {
    const a = arena({ p0: [['summon.ion']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.ion').end();
    const j = minions(a, 'jammer')[0]!;
    a.use(B1, 'shot', j.id).end();
    expect([a.unit(j.id).alive, a.has(B1, 'blackout'), a.has(B2, 'blackout')]).toEqual([false, false, false]);
    const b = arena({ p0: [['summon.ion']], p1: [['shot']] });
    b.use(A1, 'summon.ion').end().end();
    b.use(minions(b, 'jammer')[0]!.id, 'jammer_static_hiss', B1).end();
    expect(b.hp(B1)).toBe(90);
  });

  it('Dark Hum: 10 to all enemies each of the user\'s turns, up to 3', () => {
    const a = arena({ p0: [['channel.ion']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.ion').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(4);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
  });

  it('Dark Hum: +10 for each time the user\'s Charge has turned into energy since it began', () => {
    const a = arena({ p0: [['channel.ion']], p1: [['shot']] });
    a.use(A1, 'channel.ion').give(A1, 'charged', { stacks: 3 }).end();
    expect(a.hp(B1)).toBe(90);
    a.end().end(); // the Charge converts at the start of turn 3
    expect(a.hp(B1)).toBe(70);
  });

  it('Circuit Breaker: 10 damage, even at or below 60 HP', () => {
    const a = arena({ p0: [['stab.ion']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.ion', B2).end();
    expect(a.hp(B2)).toBe(50);
  });

  it('Circuit Breaker: one of the target\'s Buffs ends at random, and then the user gains 1 Charge', () => {
    const a = arena({ p0: [['stab.ion']], p1: [['shot'], ['shot']] });
    a.give(B1, 'might');
    a.use(A1, 'stab.ion', B1).end();
    expect([a.has(B1, 'might'), a.stacks(A1, 'charged')]).toEqual([false, 1]);
    a.pass(1).use(A1, 'stab.ion', B2).end(); // no Buff to end: no Charge
    expect(a.stacks(A1, 'charged')).toBe(1);
  });

  it('Arc Ambush: 25 Piercing; against an awake target, no Sap', () => {
    const a = arena({ p0: [['ravage.ion']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.ion', B1).end();
    expect([a.hp(B1), a.has(B1, 'sapped')]).toEqual([75, false]);
  });

  it('Arc Ambush: a Sleeping target stays Asleep and is Sapped twice instead', () => {
    const a = arena({ p0: [['ravage.ion']], p1: [['shot']] });
    a.give(B1, 'sleep', { source: A1, duration: 4 }).use(A1, 'ravage.ion', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep'), a.stacks(B1, 'sapped')]).toEqual([75, true, 2]);
  });

  it('Signal Jam: the target\'s Harmful skill is countered, and all their minions are blacked out for 2 turns', () => {
    const a = arena({ p0: [['mislead.ion']], p1: [['shot', 'companion'], ['shot']] });
    const wolf = enemyWolf(a);
    a.use(A1, 'mislead.ion', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(wolf, 'blacked_out')]).toEqual([90, true]);
  });

  it('Signal Jam: Helpful skills aren\'t countered', () => {
    const a = arena({ p0: [['mislead.ion']], p1: [['heal']] });
    a.use(A1, 'mislead.ion', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Shutdown: the target is Stunned and Suppressed for 2 turns', () => {
    const a = arena({ p0: [['stun.ion']], p1: [['shot']] });
    a.use(A1, 'stun.ion', B1).end();
    expect([a.has(B1, 'stun'), a.has(B1, 'suppressed'), a.has(B1, 'sleep')]).toEqual([true, true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect([a.has(B1, 'stun'), a.has(B1, 'suppressed')]).toEqual([false, false]);
  });

  it('Shutdown: the user powers down: no skills on their next turn, and Swiftness doesn\'t help (it isn\'t a Stun)', () => {
    const a = arena({ p0: [['stun.ion', 'shot']], p1: [['shot']] });
    a.give(A1, 'swiftness', { stacks: 2 });
    a.use(A1, 'stun.ion', B1).end().pass(1);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    expect([a.stacks(A1, 'swiftness'), a.has(A1, 'stun')]).toEqual([2, false]);
    a.pass(2).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Ghost in the Machine: 2 Swiftness; a random enemy with Buffs is Suppressed for 2 turns and the user copies their Buffs', () => {
    const a = arena({ p0: [['dance.ion']], p1: [['shot'], ['shot']] });
    a.give(B2, 'might', { stacks: 2 });
    a.use(A1, 'dance.ion').end();
    expect([a.stacks(A1, 'swiftness'), a.has(B2, 'suppressed'), a.has(B1, 'suppressed'), a.stacks(A1, 'might'), a.stacks(B2, 'might')]).toEqual([2, true, false, 2, 2]);
  });

  it('Ghost in the Machine: no enemy with Buffs, no Suppression', () => {
    const a = arena({ p0: [['dance.ion']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.ion').end();
    expect([a.has(B1, 'suppressed'), a.has(B2, 'suppressed')]).toEqual([false, false]);
  });

  it('Hard Reboot: nothing at once; when the ally comes back online at the end of the enemy\'s next turn, they heal 30', () => {
    const a = arena({ p0: [['heal.ion'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).use(A1, 'heal.ion', A2).end();
    expect([a.hp(A2), a.has(A2, 'hard_reboot')]).toEqual([40, true]);
    a.pass(1);
    expect([a.hp(A2), a.has(A2, 'hard_reboot')]).toEqual([70, false]);
  });

  it('Hard Reboot: costs W, cooldown 1', () => {
    expect([content.skills['heal.ion']?.cost, content.skills['heal.ion']?.cooldown]).toEqual([parseCost('W'), 1]);
  });

  it('Hard Reboot: meanwhile the ally\'s Debuffs have no effect and don\'t tick', () => {
    const a = arena({ p0: [['heal.ion'], ['shot']], p1: [['shot']] });
    a.give(A2, 'ignite', { source: B1 }).give(A2, 'vulnerable', { source: B1, stacks: 2, duration: 10 });
    a.setHp(A2, 50).use(A1, 'heal.ion', A2).end().use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(50 - 15 + 30); // no Vulnerable bonus, no Ignite tick; then back online
    a.pass(1).use(B1, 'shot', A2).end(); // turn 4: everything is back on
    expect(a.hp(A2)).toBeLessThan(65 - 25);
  });

  it('Hard Reboot: no cleanse — a Stun the ally carries still stops them on their own turn', () => {
    const a = arena({ p0: [['heal.ion'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stun', { source: B1, duration: 10 }).use(A1, 'heal.ion', A2).end().pass(1);
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('cannot_act');
  });

  it('Hard Reboot: meanwhile the ally\'s Buffs have no effect either', () => {
    const a = arena({ p0: [['heal.ion'], ['shot']], p1: [['shot']] });
    a.give(A2, 'armor', { stacks: 2 }).setHp(A2, 50);
    a.use(A1, 'heal.ion', A2).end().use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(50 - 15 + 30); // Armor switched off
    a.pass(1).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(65 - 5); // the Armor is back
  });

  it('Dead Zone: for 2 turns, each enemy who uses a skill on the ally is Suppressed for 1 turn, and the ally gains 1 Charge', () => {
    const a = arena({ p0: [['bless.ion'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.ion', A2).end().use(B1, 'shot', A2).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'suppressed'), a.has(B2, 'suppressed'), a.stacks(A2, 'charged'), a.has(A2, 'stealth')]).toEqual([true, false, 1, false]);
    a.pass(2);
    expect(a.has(B1, 'suppressed')).toBe(false);
    a.pass(1).use(B2, 'shot', A2).end();
    expect(a.has(B2, 'suppressed')).toBe(false); // turn 6: over
    expect(a.stacks(A2, 'charged')).toBe(1);
  });

  it('Signal Loss: Confused for 2 turns, and their skills can\'t target their own allies', () => {
    const a = arena({ p0: [['curse.ion']], p1: [['heal'], ['shot']] });
    a.use(A1, 'curse.ion', B1).end();
    expect(a.has(B1, 'confusion')).toBe(true);
    expect(a.reject(() => a.use(B1, 'heal', B2))).toBeTruthy();
    a.pass(4);
    expect(a.has(B1, 'confusion')).toBe(false);
    a.use(B1, 'heal', B2).end();
  });

  it('Null Brand: 15 and Suppressed for 1 turn; allies who damage them gain 1 Charge per Buff the target has', () => {
    const a = arena({ p0: [['smite.ion'], ['shot']], p1: [['shot']] });
    a.give(B1, 'might').give(B1, 'armor');
    a.use(A1, 'smite.ion', B1).use(A2, 'shot', B1).end();
    // 15 − 5 (Armor, before the Suppression lands), then the ally's 15 with the Armor suppressed
    expect([a.hp(B1), a.has(B1, 'suppressed'), a.stacks(A2, 'charged')]).toEqual([75, true, 2]);
  });

  it('Lights Out: all allies heal 20; every enemy has Blackout for 2 turns', () => {
    const a = arena({ p0: [['prayer.ion'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).use(A1, 'prayer.ion').end();
    expect([a.hp(A2), a.has(B1, 'blackout'), a.has(B2, 'blackout')]).toEqual([70, true, true]);
  });

  it('Lights Out: allies heal 10 more per enemy minion or channel it pauses', () => {
    const a = arena({ p0: [['prayer.ion'], ['shot']], p1: [['shot', 'companion'], ['shot']] });
    enemyWolf(a);
    a.setHp(A2, 50).use(A1, 'prayer.ion').end();
    expect(a.hp(A2)).toBe(80);
  });

  it('Pulse Wave: 20 to the target and 15 to another enemy with Buffs, who is Suppressed for 1 turn', () => {
    const a = arena({ p0: [['cleave.ion']], p1: [['shot'], ['shot'], ['shot']] });
    a.give('p1c2', 'might');
    a.use(A1, 'cleave.ion', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2'), a.has('p1c2', 'suppressed'), a.has(B1, 'suppressed')]).toEqual([80, 100, 85, true, false]);
  });

  it('Pulse Wave: any other enemy if none has Buffs', () => {
    const a = arena({ p0: [['cleave.ion']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.ion', B1).end();
    expect([a.hp(B2), a.has(B2, 'suppressed')]).toEqual([85, true]);
  });

  it('Jammed Frequency: all enemies Intimidated for 2 turns, and their skills go 1 turn further onto cooldown', () => {
    const a = arena({ p0: [['shout.ion']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.ion').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('on_cooldown');
  });

  it('Faraday Cage: 25 Shield for 1 turn; while it holds, Sapped gained becomes Charge', () => {
    const a = arena({ p0: [['withstand.ion']], p1: [['bolt.lightning']] });
    a.use(A1, 'withstand.ion').end().use(B1, 'bolt.lightning', A1).end();
    expect([a.hp(A1), a.has(A1, 'sapped'), a.stacks(A1, 'charged')]).toEqual([100, false, 1]);
  });

  it('Faraday Cage: once the Shield is gone, Sapped lands normally', () => {
    const a = arena({ p0: [['withstand.ion']], p1: [['bolt.lightning']] });
    a.use(A1, 'withstand.ion').end().end().end().use(B1, 'bolt.lightning', A1).end();
    expect(a.stacks(A1, 'sapped')).toBe(1);
  });

  it('Open Channel: the target is Taunted by the user, up to 3 turns while the user uses no Harmful skill', () => {
    const a = arena({ p0: [['taunt.ion'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.ion', B1).end();
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(A1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(4);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // turn 6: still on
    a.pass(2).use(B1, 'shot', A2).end(); // turn 8: over
    expect(a.hp(A2)).toBe(85);
  });

  it('Open Channel: the user\'s next Harmful skill ends the Taunt; a Helpful one doesn\'t', () => {
    const a = arena({ p0: [['taunt.ion', 'heal', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.ion', B1).end().pass(1).use(A1, 'heal', A2).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'taunt'), a.has(A1, 'open_channel')]).toEqual([false, false]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Open Channel: only this Taunt ends with it; a Taunt from someone else stays', () => {
    const a = arena({ p0: [['taunt.ion', 'shot'], ['taunt']], p1: [['shot']] });
    a.use(A1, 'taunt.ion', B1).end().pass(1).use(A2, 'taunt', B1).use(A1, 'shot', B1).end();
    expect(a.effects(B1).filter((e) => e.defId === 'taunt').map((e) => e.source)).toEqual([A2]);
  });

  it('Open Channel: each time the Taunted enemy damages the user, the user gains 1 Charge', () => {
    const a = arena({ p0: [['taunt.ion'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.ion', B1).end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'charged')).toBe(1); // B2 isn't on the channel
  });

  it('Open Channel: costs r, cooldown 3', () => {
    expect([content.skills['taunt.ion']?.cost, content.skills['taunt.ion']?.cooldown]).toEqual([parseCost('r'), 3]);
  });

  it('Null Colossus: 3 Armor for 3 turns; every other unit\'s Buffs are Suppressed, allies included', () => {
    const a = arena({ p0: [['titan.ion'], ['shot']], p1: [['shot']] });
    a.give(A2, 'might', { stacks: 2 }).give(B1, 'might', { stacks: 2 });
    a.use(A1, 'titan.ion').use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });
});
