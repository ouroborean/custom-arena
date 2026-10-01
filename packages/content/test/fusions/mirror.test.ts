// Spec-driven scenarios for the Mirror fusion (Water + Shadow): Reflect, Mimic and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.34, and the water-pairs design doc kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { parseCost } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minionsOf = (a: ReturnType<typeof arena>, defId: string, owner = 0) =>
  a.state.units.filter((u) => u.defId === defId && u.owner === owner);

describe('Mirror: cost, cooldown and tags', () => {
  // From the design doc kit table (water-pairs.md, ## Mirror — Water + Shadow).
  const table: [string, string, number][] = [
    ['strike.mirror', 'I', 0],
    ['smash.mirror', 'Sr', 2],
    ['charge.mirror', 'S', 3],
    ['riposte.mirror', 'A', 3],
    ['rage.mirror', 'SA', 4],
    ['shot.mirror', 'r', 0],
    ['snipe.mirror', 'Ar', 2],
    ['trap.mirror', 'r', 2],
    ['maneuver.mirror', 'r', 3],
    ['companion.mirror', 'I', 1],
    ['bolt.mirror', 'Ar', 1],
    ['blast.mirror', 'Irr', 2],
    ['consume.mirror', 'r', 4],
    ['summon.mirror', 'I', 1],
    ['channel.mirror', 'Ir', 3],
    ['stab.mirror', 'r', 0],
    ['ravage.mirror', 'Ar', 1],
    ['mislead.mirror', 'I', 2],
    ['stun.mirror', 'A', 2],
    ['dance.mirror', 'A', 3],
    ['heal.mirror', 'r', 1],
    ['bless.mirror', 'r', 2],
    ['curse.mirror', 'A', 2],
    ['smite.mirror', 'I', 1],
    ['prayer.mirror', 'Wrr', 2],
    ['cleave.mirror', 'Sr', 1],
    ['shout.mirror', 'Sr', 3],
    ['withstand.mirror', 'A', 3],
    ['taunt.mirror', 'r', 2],
    ['titan.mirror', 'IW', 4],
    // Minion skills, from the Companion / Summon rows.
    ['doppelganger_mimicry', 'r', 0],
    ['mirror_shade_glass_shard', 'nc', 0],
  ];
  it.each(table)('%s costs %s with cooldown %i', (id, cost, cd) => {
    const s = content.skills[id]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
  });

  it('all 30 Mirror skills exist', () => {
    const mine = Object.values(content.skills).filter((s) => s.element === 'Mirror' && s.archetype !== 'Minion');
    expect(mine.length).toBe(30);
  });

  it('tags promised by the text: Stealthy, Invisible, Channeled', () => {
    expect(content.skills['charge.mirror']!.tags).toContain('Stealthy');
    for (const id of ['riposte.mirror', 'trap.mirror', 'mislead.mirror']) expect(content.skills[id]!.tags).toContain('Invisible');
    for (const id of ['snipe.mirror', 'channel.mirror']) expect(content.skills[id]!.tags).toContain('Channeled');
  });

  it('the Mimic keyword is in the glossary', () => {
    expect(Object.values(content.glossary).some((e) => e.name === 'Mimic')).toBe(true);
  });
});

describe('Mirror: Reflect and Mimic keywords', () => {
  it('Reflect: the reflected skill applies its effects to its own user, not the reflector', () => {
    // Splintered Pane is a plain Reflect on the user.
    const a = arena({ p0: [['smash.mirror']], p1: [['stun']] });
    a.use(A1, 'smash.mirror', B1).end();
    a.use(B1, 'stun', A1).end();
    expect([a.hp(A1), a.has(A1, 'stun')]).toEqual([100, false]);
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([75 - 15, true]);
  });

  it("Reflect: Flow ignores it (Water's Flow ignores counters and reflects)", () => {
    const a = arena({ p0: [['smash.mirror']], p1: [['shot']] });
    a.use(A1, 'smash.mirror', B1).end();
    a.give(B1, 'flow').use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 75]);
  });

  it('Mimic: the copy is cast by the user as its user (a copied Strike gives the Mirror user the Might)', () => {
    // Return to Sender Mimics the target's last skill (a Strike) back at them.
    const a = arena({ p0: [['snipe.mirror']], p1: [['strike']] });
    a.pass(1).use(B1, 'strike', A1).end();
    a.use(A1, 'snipe.mirror', B1).end().pass(1);
    expect([a.hp(A1), a.hp(B1)]).toEqual([80, 80]);
    expect([a.stacks(A1, 'might'), a.stacks(B1, 'might')]).toEqual([1, 1]);
  });

  it('Mimic: the copy costs the user nothing extra', () => {
    const a = arena({ p0: [['snipe.mirror']], p1: [['smash']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'snipe.mirror', B1).end();
    const total = () => Object.values(a.state.players[0].energy).reduce((n, x) => n + x, 0);
    const before = total();
    // End the enemy's turn without the harness top-up: the Mimicked Smash (Sr) fires at its end.
    a.cmd(a.active, { t: 'endTurn' });
    expect(a.hp(B1)).toBe(75);
    const gained = a
      .log(a.last)
      .filter((l) => l.startsWith('Player 1 gains '))
      .reduce((n, l) => n + l.slice('Player 1 gains '.length).length, 0);
    expect(total()).toBe(before + gained);
  });
});

describe('Mirror skills', () => {
  it('Silvered Blade: 20 damage, and no Might for the user', () => {
    const a = arena({ p0: [['strike.mirror']], p1: [['shot']] });
    a.use(A1, 'strike.mirror', B1).end();
    expect([a.hp(B1), a.has(A1, 'might')]).toEqual([80, false]);
  });

  it("Silvered Blade: a Blinded target's next Harmful skill is Reflected back at them", () => {
    const a = arena({ p0: [['strike.mirror']], p1: [['shot']] });
    a.give(B1, 'blinded', { source: A1 }).use(A1, 'strike.mirror', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 65]);
  });

  it('Silvered Blade: only the next Harmful skill is Reflected', () => {
    const a = arena({ p0: [['strike.mirror']], p1: [['shot']] });
    a.give(B1, 'blinded', { source: A1 }).use(A1, 'strike.mirror', B1).end();
    a.use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 65]);
  });

  it('Silvered Blade: an un-Blinded target is not Reflected', () => {
    const a = arena({ p0: [['strike.mirror']], p1: [['shot']] });
    a.use(A1, 'strike.mirror', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 80]);
  });

  it('Splintered Pane: 25 to the target and 15 to their allies', () => {
    const a = arena({ p0: [['smash.mirror']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.mirror', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([75, 85, 85]);
  });

  it('Splintered Pane: only the first Harmful skill aimed at the user is Reflected; allies are not covered', () => {
    const a = arena({ p0: [['smash.mirror'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.mirror', B1).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).use('p1c2', 'shot', A2).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([75 - 15, 85, 85, 85]);
  });

  it("Splintered Pane: the Reflect is gone by the user's next turn", () => {
    const a = arena({ p0: [['smash.mirror']], p1: [['shot']] });
    a.use(A1, 'smash.mirror', B1).end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 75]);
  });

  it('Stillwater Step: 15 damage, and it is Stealthy (keeps the Stealth)', () => {
    const a = arena({ p0: [['charge.mirror']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'charge.mirror', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([85, true]);
  });

  it("Stillwater Step: the user's Helpful skills don't break Stealth for 2 turns, Harmful ones still do", () => {
    const a = arena({ p0: [['charge.mirror', 'heal', 'shot']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'charge.mirror', B1).end().pass(1);
    a.use(A1, 'heal', A1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.has(A1, 'stealth')).toBe(false);
  });

  it('Stillwater Step: without it, a Helpful skill breaks Stealth', () => {
    const a = arena({ p0: [['heal']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'heal', A1).end();
    expect(a.has(A1, 'stealth')).toBe(false);
  });

  it("Looking Glass: Debuffs an enemy gives the user land on the sender instead; the damage still lands", () => {
    const a = arena({ p0: [['riposte.mirror']], p1: [['stun']] });
    a.use(A1, 'riposte.mirror').end();
    a.use(B1, 'stun', A1).end();
    expect([a.hp(A1), a.has(A1, 'stun'), a.has(B1, 'stun')]).toEqual([85, false, true]);
  });

  it('Looking Glass: it covers every Debuff for the turn, not just the first', () => {
    const a = arena({ p0: [['riposte.mirror']], p1: [['curse'], ['stun']] });
    a.use(A1, 'riposte.mirror').end();
    a.use(B1, 'curse', A1).use(B2, 'stun', A1).end();
    expect([a.has(A1, 'confusion'), a.has(A1, 'stun')]).toEqual([false, false]);
    expect([a.has(B1, 'confusion'), a.has(B2, 'stun')]).toEqual([true, true]);
  });

  it('Looking Glass: Invisible, and after 1 turn Debuffs stick again', () => {
    const a = arena({ p0: [['riposte.mirror']], p1: [['curse']] });
    a.use(A1, 'riposte.mirror').end().pass(2);
    a.use(B1, 'curse', A1).end();
    expect([a.has(A1, 'confusion'), a.has(B1, 'confusion')]).toEqual([true, false]);
  });

  it('Contrary Fury: +1 Might, and each Weakness counts as Might (+10 direct per Weakness)', () => {
    const a = arena({ p0: [['rage.mirror', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.mirror').end().pass(1);
    expect(a.has(A1, 'might')).toBe(true);
    a.give(A1, 'weakness').use(A1, 'shot', B1).end();
    // 15 + 5 (Might) − 5 (Weakness) + 10 (flipped Weakness) = 25.
    expect(a.hp(B1)).toBe(75);
  });

  it('Contrary Fury: each Vulnerable counts as Armor (−10 Normal damage taken per Vulnerable)', () => {
    const a = arena({ p0: [['rage.mirror']], p1: [['shot']] });
    a.use(A1, 'rage.mirror').end();
    a.give(A1, 'vulnerable').use(B1, 'shot', A1).end();
    // 15 + 5 (Vulnerable) − 10 (flipped) = 10.
    expect(a.hp(A1)).toBe(90);
  });

  it('Contrary Fury: without it, Weakness and Vulnerable work normally', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'weakness').give(A1, 'vulnerable').use(A1, 'shot', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 80]);
  });

  it('Contrary Fury: it lasts 3 turns', () => {
    const a = arena({ p0: [['rage.mirror', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.mirror').end().pass(4);
    expect(a.has(A1, 'contrary_fury')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'might')).toBe(false);
    expect(a.has(A1, 'contrary_fury')).toBe(false);
    a.give(A1, 'weakness').use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Hairline Crack: 10 damage; the first single hit of 30+ lands a second time', () => {
    const a = arena({ p0: [['shot.mirror'], ['strike']], p1: [['shot']] });
    a.give(A2, 'might', { stacks: 2 });
    a.use(A1, 'shot.mirror', B1).use(A2, 'strike', B1).end();
    expect(a.hp(B1)).toBe(90 - 30 - 30);
  });

  it('Hairline Crack: only the first such hit, and hits under 30 neither trigger nor spend it', () => {
    const a = arena({ p0: [['shot.mirror'], ['shot'], ['strike']], p1: [['shot']] });
    a.give(A3, 'might', { stacks: 2 });
    a.use(A1, 'shot.mirror', B1).use(A2, 'shot', B1).end().pass(1);
    expect(a.hp(B1)).toBe(75);
    a.use(A3, 'strike', B1).end();
    expect(a.hp(B1)).toBe(75 - 60);
    a.setHp(B1, 100).pass(1).use(A3, 'strike', B1).end();
    expect(a.hp(B1)).toBe(100 - 35);
  });

  it('Return to Sender: the following turn, the user Mimics the target\'s last skill back at them', () => {
    const a = arena({ p0: [['snipe.mirror']], p1: [['smash']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'snipe.mirror', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1);
    expect(a.hp(B1)).toBe(75);
  });

  it("Return to Sender: it Mimics the last skill used by the end of the following turn", () => {
    const a = arena({ p0: [['snipe.mirror']], p1: [['shot', 'smash']] });
    a.pass(1).use(B1, 'shot', A1).end();
    a.use(A1, 'snipe.mirror', B1).end();
    a.use(B1, 'smash', A1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Return to Sender: a copied ally-target skill lands on its caster', () => {
    const a = arena({ p0: [['snipe.mirror']], p1: [['heal']] });
    a.setHp(A1, 50).setHp(B1, 50).pass(1).use(B1, 'heal', B1).end();
    a.use(A1, 'snipe.mirror', B1).end().pass(1);
    expect([a.hp(A1), a.hp(B1)]).toEqual([75, 75]);
  });

  it('Return to Sender: Channeled — stunning the user stops it', () => {
    const a = arena({ p0: [['snipe.mirror']], p1: [['shot'], ['stun']] });
    a.pass(1).use(B1, 'shot', A1).end();
    a.use(A1, 'snipe.mirror', B1).end();
    a.use(B2, 'stun', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Return to Sender: nothing happens if the target never used a skill', () => {
    const a = arena({ p0: [['snipe.mirror']], p1: [['shot']] });
    a.use(A1, 'snipe.mirror', B1).end().pass(1);
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 100]);
  });

  it("False Reflection: the target's first Helpful skill lands on the user's side instead", () => {
    const a = arena({ p0: [['trap.mirror']], p1: [['heal']] });
    a.setHp(A1, 50).setHp(B1, 50).use(A1, 'trap.mirror', B1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([50, 75]);
  });

  it('False Reflection: the turned Helpful skill does not reach its own side', () => {
    const a = arena({ p0: [['trap.mirror']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.mirror', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(50);
  });

  // BUG: same as above — the countered Helpful skill is not recast on the user's side.
  it.fails('False Reflection: only the first Helpful skill, and Harmful skills are untouched', () => {
    const a = arena({ p0: [['trap.mirror']], p1: [['heal', 'shot']] });
    a.setHp(A1, 50).setHp(B1, 50).use(A1, 'trap.mirror', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(35);
    a.pass(1).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([50, 60]);
    a.pass(1).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(50); // heal is on cooldown 1, so this is the turn after
  });

  it('False Reflection: it lasts 2 turns', () => {
    const a = arena({ p0: [['trap.mirror']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.mirror', B1).end().pass(4);
    a.use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Through the Glass: the user is Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.mirror').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Through the Glass: the first Harmful skill aimed at an ally is Reflected, the second is not', () => {
    const a = arena({ p0: [['maneuver.mirror'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.mirror').end();
    a.use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect([a.hp(A2), a.hp(B1), a.hp(A3), a.hp(B2)]).toEqual([100, 85, 85, 100]);
  });

  it('Through the Glass: it ends after 1 turn', () => {
    const a = arena({ p0: [['maneuver.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.mirror').end().pass(2);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([85, 100]);
  });

  it('Doppelganger: summons a permanent 30 HP Doppelganger', () => {
    const a = arena({ p0: [['companion.mirror']], p1: [['shot']] });
    a.use(A1, 'companion.mirror').end();
    const d = minionsOf(a, 'doppelganger');
    expect(d.length).toBe(1);
    expect([d[0]!.hp, d[0]!.alive]).toEqual([30, true]);
    a.pass(12);
    expect(a.unit(d[0]!.id).alive).toBe(true);
  });

  it('Doppelganger / Mimicry: uses a copy of the last skill its summoner used', () => {
    const a = arena({ p0: [['companion.mirror', 'smash']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.mirror').end().pass(1);
    const d = minionsOf(a, 'doppelganger')[0]!.id;
    a.use(A1, 'smash', B1).use(d, 'doppelganger_mimicry').end();
    // Smash twice: 25 + 15 each, the copy on a target of its choosing.
    expect(a.hp(B1) + a.hp(B2)).toBe(200 - 40 - 40);
  });

  it('Glintbolt: 25 damage and a Mark for 1 turn', () => {
    const a = arena({ p0: [['bolt.mirror']], p1: [['shot']] });
    a.use(A1, 'bolt.mirror', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([75, true]);
    a.pass(2);
    expect(a.has(B1, 'mark')).toBe(false);
  });

  it("Glintbolt: when the Mark is spent, allies' cooldowns drop by 1", () => {
    const run = (spend: boolean) => {
      const a = arena({ p0: [['bolt.mirror'], ['shot'], ['smash']], p1: [['shot'], ['shot']] });
      a.use(A3, 'smash', B2).end().pass(1);
      a.use(A1, 'bolt.mirror', B1);
      if (spend) a.use(A2, 'shot', B1);
      a.end();
      return [a.hp(B1), a.cooldown(A3, 'smash')];
    };
    // Smash put B1 at 85, Glintbolt at 60; the Shot spends the Mark for +10.
    expect(run(false)).toEqual([60, 1]);
    expect(run(true)).toEqual([60 - 25, 0]);
  });

  it('Dark Tide: 20 to all enemies, then the user Mimics the last skill a random enemy used', () => {
    const a = arena({ p0: [['blast.mirror']], p1: [['shot']] });
    a.pass(1).use(B1, 'shot', A1).end();
    a.use(A1, 'blast.mirror').end();
    expect(a.hp(B1)).toBe(100 - 20 - 15);
  });

  it('Dark Tide: with two enemies, the Mimic copies exactly one of their last skills', () => {
    const a = arena({ p0: [['blast.mirror']], p1: [['shot'], ['shot']], seed: 7 });
    a.pass(1).use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    a.use(A1, 'blast.mirror').end();
    expect(a.hp(B1) + a.hp(B2)).toBe(200 - 40 - 15);
  });

  it('Dark Tide: no Mimic if no enemy has used a skill', () => {
    const a = arena({ p0: [['blast.mirror']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.mirror').end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([80, 80, 100]);
  });

  it('Changing Places: 5 damage, then the user and target trade HP totals', () => {
    const a = arena({ p0: [['consume.mirror']], p1: [['shot']] });
    a.setHp(A1, 30).use(A1, 'consume.mirror', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([95, 30]);
  });

  it('Changing Places: each side is capped at its own max HP', () => {
    const a = arena({ p0: [['consume.mirror']], p1: [['summon.mirror']] });
    a.pass(1).use(B1, 'summon.mirror').end();
    const shade = minionsOf(a, 'mirror_shade', 1)[0]!.id;
    a.setHp(A1, 60).use(A1, 'consume.mirror', shade).end();
    expect([a.hp(A1), a.hp(shade)]).toEqual([15, 20]);
  });

  it('Changing Places: the swap ignores healing and damage modifiers', () => {
    const a = arena({ p0: [['consume.mirror']], p1: [['shot']] });
    a.setHp(A1, 40).give(A1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 50 });
    a.use(A1, 'consume.mirror', B1).end();
    // The 5 hits the Shield; then the HP totals are traded exactly.
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 40]);
  });

  it('Mirror Shade: summons a 20 HP Shade for 3 turns', () => {
    const a = arena({ p0: [['summon.mirror']], p1: [['shot']] });
    a.use(A1, 'summon.mirror').end();
    const s = minionsOf(a, 'mirror_shade')[0]!;
    expect(s.hp).toBe(20);
    a.pass(4);
    expect(a.unit(s.id).alive).toBe(true);
    a.pass(1);
    expect(a.unit(s.id).alive).toBe(false);
  });

  it('Mirror Shade / Glass Shard: 10 damage to target enemy', () => {
    const a = arena({ p0: [['summon.mirror']], p1: [['shot']] });
    a.use(A1, 'summon.mirror').end().pass(1);
    const s = minionsOf(a, 'mirror_shade')[0]!.id;
    a.use(s, 'glass_shard' in content.skills ? 'glass_shard' : 'mirror_shade_glass_shard', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Mirror Shade: when killed, the killing skill is turned back on its user', () => {
    const a = arena({ p0: [['summon.mirror']], p1: [['smash']] });
    a.use(A1, 'summon.mirror').end();
    const s = minionsOf(a, 'mirror_shade')[0]!.id;
    a.setHp(s, 10).use(B1, 'smash', s).end();
    expect(a.unit(s).alive).toBe(false);
    expect(a.hp(B1)).toBe(75);
  });

  it('Mirror Shade: a hit that does not kill it is not turned back', () => {
    const a = arena({ p0: [['summon.mirror']], p1: [['shot']] });
    a.use(A1, 'summon.mirror').end();
    const s = minionsOf(a, 'mirror_shade')[0]!.id;
    a.use(B1, 'shot', s).end();
    expect([a.hp(s), a.hp(B1)]).toEqual([5, 100]);
  });

  it("Hall of Mirrors: 10 to all enemies at the end of each of the user's turns, up to 3 turns", () => {
    const a = arena({ p0: [['channel.mirror']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.mirror').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(4);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
    a.pass(4);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });

  it('Hall of Mirrors: while it channels, every enemy Harmful skill aimed at the user is Reflected', () => {
    const a = arena({ p0: [['channel.mirror'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.mirror').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(B1), a.hp(A2), a.hp(B2)]).toEqual([100, 75, 85, 90]);
  });

  it('Hall of Mirrors: using another skill ends the channel, and the Reflect with it', () => {
    const a = arena({ p0: [['channel.mirror', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.mirror').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75); // the earlier tick and the Shot, no new tick
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 75]);
  });

  it('Glass Shiv: 10 damage, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.mirror']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.mirror', B1).end().pass(1);
    a.use(A1, 'stab.mirror', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Glass Shiv: Confusion shatters — it ends, and they take 10 Affliction per stack', () => {
    const a = arena({ p0: [['stab.mirror']], p1: [['shot']] });
    a.give(B1, 'confusion', { stacks: 2, source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'stab.mirror', B1).end();
    // 10 − 10 Armor = 0 from the stab; 20 Affliction ignores Armor.
    expect([a.hp(B1), a.has(B1, 'confusion')]).toEqual([80, false]);
  });

  it('Foiled Ambush: 25 Piercing (ignores Armor)', () => {
    const a = arena({ p0: [['ravage.mirror']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.mirror', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Foiled Ambush: doubled against Confused or Blinded targets', () => {
    const a = arena({ p0: [['ravage.mirror']], p1: [['shot']] });
    a.give(B1, 'confusion', { source: A1 }).use(A1, 'ravage.mirror', B1).end();
    const b = arena({ p0: [['ravage.mirror']], p1: [['shot']] });
    b.give(B1, 'blinded', { source: A1 }).use(A1, 'ravage.mirror', B1).end();
    expect([a.hp(B1), b.hp(B1)]).toEqual([50, 50]);
  });

  it("Stolen Shape: the target's Harmful skill is countered", () => {
    const a = arena({ p0: [['mislead.mirror']], p1: [['smash']] });
    a.use(A1, 'mislead.mirror', B1).end();
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it("Stolen Shape: the target's Harmful skill is countered and the user Mimics it", () => {
    const a = arena({ p0: [['mislead.mirror']], p1: [['smash']] });
    a.use(A1, 'mislead.mirror', B1).end();
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 75]);
  });

  it('Stolen Shape: Helpful skills are not countered, and it lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.mirror']], p1: [['heal', 'shot']] });
    a.setHp(B1, 50).use(A1, 'mislead.mirror', B1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 100]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 75]);
  });

  it('Stolen Shape: other enemies are not affected', () => {
    const a = arena({ p0: [['mislead.mirror']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.mirror', B1).end();
    a.use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Hypnotic Ripple: 10 damage and Asleep for 2 turns', () => {
    const a = arena({ p0: [['stun.mirror']], p1: [['shot']] });
    a.use(A1, 'stun.mirror', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([90, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.has(B1, 'sleep')).toBe(false);
  });

  it('Hypnotic Ripple: when the Sleep is broken early, a random ally of the sleeper falls Asleep', () => {
    const a = arena({ p0: [['stun.mirror'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.mirror', B1).use(A2, 'shot', B1).end();
    expect([a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([false, true]);
  });

  it('Hypnotic Ripple: a Sleep that runs its course does not spread', () => {
    const a = arena({ p0: [['stun.mirror']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.mirror', B1).end().pass(4);
    expect([a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([false, false]);
  });

  it("Dance of Reflections: 1 Swiftness at the start of each of the user's turns for 3 turns", () => {
    const a = arena({ p0: [['dance.mirror']], p1: [['shot']] });
    a.use(A1, 'dance.mirror').end();
    expect(a.stacks(A1, 'swiftness')).toBe(0); // not on the casting turn
    a.pass(1); // start of turn 3
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    a.pass(2); // start of turn 5
    expect(a.stacks(A1, 'swiftness')).toBeGreaterThanOrEqual(1);
    a.pass(2); // start of turn 7: the Dance is over
    expect([a.has(A1, 'dance_of_reflections'), a.stacks(A1, 'swiftness')]).toEqual([false, 0]);
  });

  it('Dance of Reflections: the Swiftness stops a Stun', () => {
    const a = arena({ p0: [['dance.mirror']], p1: [['stun']] });
    a.use(A1, 'dance.mirror').end().pass(2);
    a.use(B1, 'stun', A1).end();
    expect([a.hp(A1), a.has(A1, 'stun')]).toEqual([85, false]);
  });

  it('Dance of Reflections: when Swiftness stops a Stun, the user Mimics the stunner\'s last skill', () => {
    const a = arena({ p0: [['dance.mirror']], p1: [['stun']] });
    a.use(A1, 'dance.mirror').end().pass(2);
    a.use(B1, 'stun', A1).end();
    expect([a.hp(A1), a.has(A1, 'stun')]).toEqual([85, false]);
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([85, true]);
  });

  it('Dance of Reflections: a stun that lands (no Swiftness) is not Mimicked', () => {
    const a = arena({ p0: [['dance.mirror']], p1: [['stun']] });
    a.use(A1, 'dance.mirror').end();
    a.use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.hp(B1)]).toEqual([true, 100]);
  });

  it('Mirrored Mending: target ally heals 20', () => {
    const a = arena({ p0: [['heal.mirror'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.mirror', A2).end();
    expect(a.hp(A2)).toBe(70);
  });

  it("Mirrored Mending: the enemy's next Helpful skill is taken away from them", () => {
    const a = arena({ p0: [['heal.mirror'], ['shot']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'heal.mirror', A2).end();
    a.use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(50);
  });

  it("Mirrored Mending: the next Helpful skill an enemy uses lands on that ally instead", () => {
    const a = arena({ p0: [['heal.mirror'], ['shot']], p1: [['shot'], ['heal']] });
    a.setHp(A2, 50).setHp(B1, 50).use(A1, 'heal.mirror', A2).end();
    a.use(B2, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([50, 95]);
  });

  // SPEC: "The next Helpful skill an enemy uses" has no time limit, but the watch expires after 1 turn (a Helpful skill on the enemy's second turn is not turned). Also hit by the recast BUG above.
  it.fails('Mirrored Mending: only the next one, and Harmful skills are untouched', () => {
    const a = arena({ p0: [['heal.mirror'], ['shot']], p1: [['shot', 'heal']] });
    a.setHp(A2, 50).setHp(B1, 50).use(A1, 'heal.mirror', A2).end();
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(55);
    a.pass(1).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([50, 80]);
    a.pass(3).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Silvered Veil: target ally gains Stealth and Flow; Flow ignores counters', () => {
    const a = arena({ p0: [['bless.mirror'], ['shot']], p1: [['riposte']] });
    a.use(A1, 'bless.mirror', A2).end();
    expect([a.has(A2, 'stealth'), a.has(A2, 'flow')]).toEqual([true, true]);
    a.use(B1, 'riposte').end();
    a.use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([85, 100]);
  });

  it("Silvered Veil: while Flow lasts, the ally's skills are Stealthy and keep the Stealth", () => {
    const a = arena({ p0: [['bless.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.mirror', A2).end().pass(1);
    a.use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(A2, 'stealth')]).toEqual([85, true]);
  });

  it('Silvered Veil: Flow lasts 2 turns; after it, skills break Stealth again', () => {
    const a = arena({ p0: [['bless.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.mirror', A2).end().pass(3);
    expect(a.has(A2, 'flow')).toBe(false);
    a.give(A2, 'stealth').use(A2, 'shot', B1).end();
    expect(a.has(A2, 'stealth')).toBe(false);
  });

  it('Maddening Glass: Blinded for 2 turns and 1 Confusion', () => {
    const a = arena({ p0: [['curse.mirror']], p1: [['shot']] });
    a.use(A1, 'curse.mirror', B1).end();
    expect([a.has(B1, 'blinded'), a.stacks(B1, 'confusion')]).toEqual([true, 1]);
    a.pass(4);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Maddening Glass: each skill used while Blinded gives 1 more Confusion; none once the Blind is gone', () => {
    const a = arena({ p0: [['curse.mirror']], p1: [['shot']] });
    a.use(A1, 'curse.mirror', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'confusion')).toBe(2);
    a.pass(3); // turn 6: the 2-turn Blind ended with turn 4
    expect(a.has(B1, 'blinded')).toBe(false);
    const before = a.stacks(B1, 'confusion');
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'confusion')).toBe(before);
  });

  it('Brand in the Glass: 15 damage; the first ally to damage them makes the user Mimic their last skill', () => {
    const a = arena({ p0: [['smite.mirror'], ['shot']], p1: [['smash']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'smite.mirror', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15 - 25);
  });

  it('Brand in the Glass: only the first time', () => {
    const a = arena({ p0: [['smite.mirror'], ['shot'], ['shot']], p1: [['smash']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'smite.mirror', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15 - 25 - 15);
  });

  it('Brand in the Glass: it lasts 2 turns', () => {
    const a = arena({ p0: [['smite.mirror'], ['shot']], p1: [['smash']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'smite.mirror', B1).end().pass(3);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15);
  });

  it('Reflecting Pool: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.mirror'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.mirror').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
  });

  it('Reflecting Pool: an undamaged turn ends in Stealth (including the casting turn)', () => {
    const a = arena({ p0: [['prayer.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.mirror').end();
    expect([a.has(A1, 'stealth'), a.has(A2, 'stealth')]).toEqual([true, true]);
  });

  it("Reflecting Pool: an ally damaged since their side's last turn gets no Stealth at the end of the next one; an untouched ally does", () => {
    // Reading of "each ally who takes no damage in a turn gains Stealth at its end": checked at the end of the
    // allies' own turns, over the round since the last check (enemy hits included).
    const a = arena({ p0: [['prayer.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.mirror').end();
    a.state.effects = a.state.effects.filter((e) => e.defId !== 'stealth');
    a.use(B1, 'shot', A1).end().pass(1);
    expect([a.has(A1, 'stealth'), a.has(A2, 'stealth')]).toEqual([false, true]);
  });

  it('Reflecting Pool: it ends after 2 turns', () => {
    const a = arena({ p0: [['prayer.mirror'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.mirror').end().pass(4);
    expect(a.has(A1, 'reflecting_pool')).toBe(false);
    a.state.effects = a.state.effects.filter((e) => e.defId !== 'stealth');
    a.pass(2);
    expect(a.has(A2, 'stealth')).toBe(false);
  });

  it('Rippling Shards: 25 to the target and 15 to a random other enemy', () => {
    const a = arena({ p0: [['cleave.mirror']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.mirror', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Rippling Shards: each ally with Renew gives up 1 stack to add 5 to both hits', () => {
    const a = arena({ p0: [['cleave.mirror'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    // Renew applied by an enemy-side source so its own tick doesn't run on this turn.
    a.give(A2, 'renew', { stacks: 2, source: B1 }).give(A3, 'renew', { stacks: 1, source: B1 });
    a.use(A1, 'cleave.mirror', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 75]);
    expect([a.stacks(A2, 'renew'), a.stacks(A3, 'renew')]).toEqual([1, 0]);
  });

  it('Inverted Echo: all enemies are Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.mirror']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.mirror').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.pass(4);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it("Inverted Echo: enemy cooldowns are mirrored — ready skills go on cooldown for 1 turn, cooling ones become ready", () => {
    const a = arena({ p0: [['shout.mirror']], p1: [['smash', 'shot']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'shout.mirror').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('on_cooldown');
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(50);
    a.pass(1);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(35);
  });

  it('Silvered Guard: 25 Shield for 2 turns', () => {
    const a = arena({ p0: [['withstand.mirror']], p1: [['shot']] });
    a.use(A1, 'withstand.mirror').end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(3);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Silvered Guard: an enemy who breaks it has their skill Mimicked back', () => {
    const a = arena({ p0: [['withstand.mirror']], p1: [['blast'], ['shot']] });
    a.use(A1, 'withstand.mirror').end();
    a.use(B1, 'blast').end();
    expect(a.hp(A1)).toBe(90);
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 65]);
  });

  it('Silvered Guard: the Mimic copies the breaking skill, not the breaker\'s earlier one', () => {
    const a = arena({ p0: [['withstand.mirror']], p1: [['blast', 'shot'], ['shot']] });
    a.use(A1, 'withstand.mirror').end();
    a.use(B1, 'shot', A1).end().pass(1);
    a.use(B1, 'blast').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 65]);
  });

  it('Silvered Guard: a hit that does not break it is not Mimicked', () => {
    const a = arena({ p0: [['withstand.mirror']], p1: [['shot']] });
    a.use(A1, 'withstand.mirror').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 100]);
  });

  it('Mocking Reflection: creates a 5 HP Reflection and Taunts the target to it for 1 turn', () => {
    const a = arena({ p0: [['taunt.mirror']], p1: [['shot']] });
    a.use(A1, 'taunt.mirror', B1).end();
    const r = minionsOf(a, 'mirror_reflection');
    expect(r.length).toBe(1);
    expect(r[0]!.hp).toBe(5);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it("Mocking Reflection: the Taunted enemy's Harmful skill is Mimicked back at them", () => {
    const a = arena({ p0: [['taunt.mirror']], p1: [['shot']] });
    a.use(A1, 'taunt.mirror', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    const r = minionsOf(a, 'mirror_reflection')[0]!.id;
    a.use(B1, 'shot', r).end();
    expect([a.hp(A1), a.unit(r).alive, a.hp(B1)]).toEqual([100, false, 85]);
  });

  it('Mocking Reflection: Helpful skills are not Mimicked, and other enemies are not involved', () => {
    const a = arena({ p0: [['taunt.mirror']], p1: [['heal'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'taunt.mirror', B1).end();
    a.use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([75, 100, 85]);
  });

  it("Mirror of the Faceless: 2 Armor and copies of the target's Buffs, and it opens by Mimicking their last skill", () => {
    const a = arena({ p0: [['titan.mirror']], p1: [['shot']] });
    a.pass(1).use(B1, 'shot', A1).end();
    a.give(B1, 'might', { stacks: 2 }).give(B1, 'focus');
    a.use(A1, 'titan.mirror', B1).end();
    expect(a.stacks(A1, 'armor')).toBe(2);
    expect([a.stacks(A1, 'might'), a.has(A1, 'focus')]).toEqual([2, true]);
    // The Mimicked Shot is the user's, so the copied Might applies when it lands after the copy.
    expect(a.hp(B1)).toBeLessThan(100);
    expect([a.stacks(B1, 'might'), a.has(B1, 'focus')]).toEqual([2, true]);
  });

  it('Mirror of the Faceless: the 2 Armor reduces Normal damage, and lasts 3 turns', () => {
    const a = arena({ p0: [['titan.mirror']], p1: [['shot']] });
    a.use(A1, 'titan.mirror', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95);
    a.pass(4);
    expect(a.stacks(A1, 'armor')).toBe(0);
  });

  it('Mirror of the Faceless: Debuffs on the target are not copied', () => {
    const a = arena({ p0: [['titan.mirror']], p1: [['shot']] });
    a.give(B1, 'weakness', { source: A1 }).use(A1, 'titan.mirror', B1).end();
    expect(a.has(A1, 'weakness')).toBe(false);
  });
});
