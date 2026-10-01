// Spec-driven scenarios for Sanctuary (Earth + Holy): Sanctum, Wardstones and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.50, and the design kit (poison-earth-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
/** Sanctum level of a side: total `sanctum` stacks on its units. */
const sanctum = (a: Arena, side: 0 | 1 = 0) =>
  a.state.units.filter((u) => u.owner === side).reduce((n, u) => n + a.stacks(u.id, 'sanctum'), 0);
const debuffCount = (a: Arena, id: string) =>
  a.stacks(id, 'weakness') + a.stacks(id, 'vulnerable') + a.stacks(id, 'confusion');
const costLetters = (id: string) => {
  const c = content.skills[id]!.cost as unknown as Record<string, number>;
  return ['S', 'A', 'I', 'W', 'r'].map((k) => k.repeat(c[k] ?? 0)).join('') || 'nc';
};
const sortLetters = (s: string) => (s === 'nc' ? s : [...s].sort().join(''));

describe('Sanctuary: cost and cooldown match the design kit', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['W', 3], rage: ['AW', 4],
    shot: ['r', 1], snipe: ['Ar', 2], trap: ['W', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['I', 1], blast: ['IW', 2], consume: ['W', 2], summon: ['A', 1], channel: ['Ir', 3],
    stab: ['A', 0], ravage: ['Wr', 2], mislead: ['W', 2], stun: ['Ar', 3], dance: ['AA', 4],
    heal: ['r', 1], bless: ['W', 2], curse: ['A', 2], smite: ['W', 1], prayer: ['Wrr', 4],
    cleave: ['S', 1], shout: ['A', 3], withstand: ['r', 3], taunt: ['W', 3], titan: ['WW', 4],
  };
  it.each(Object.entries(kit))('%s.sanctuary', (arch, [cost, cd]) => {
    const id = `${arch}.sanctuary`;
    expect([sortLetters(costLetters(id)), content.skills[id]!.cooldown]).toEqual([sortLetters(cost), cd]);
  });

  it('minion skills: Stone Fist nc, Bless the Ground r, Carve r', () => {
    expect(['warden_stone_fist', 'warden_bless_the_ground', 'stonemason_carve'].map(costLetters)).toEqual(['nc', 'r', 'r']);
  });

  it('the Invisible skills are tagged Invisible', () => {
    for (const id of ['riposte.sanctuary', 'trap.sanctuary', 'mislead.sanctuary'])
      expect(content.skills[id]!.tags).toContain('Invisible');
  });
});

describe('Sanctum', () => {
  it('raising it gives level 1; at the end of the side\'s turn every ally heals 5 per level', () => {
    const a = arena({ p0: [['companion.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.sanctuary').end().pass(1);
    const warden = minions(a, 0, 'temple_warden')[0]!;
    a.setHp(A2, 50).use(warden.id, 'warden_bless_the_ground').end();
    expect(sanctum(a)).toBe(1);
    expect(a.hp(A2)).toBe(55);
  });

  it('each level gives every ally 1 Armor (5 less Normal damage) through the enemy turn', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['strike'], ['shot.sanctuary']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).end();
    a.use(B1, 'strike', A2).end();
    expect(a.hp(A2)).toBe(90); // 20 − 10
  });

  it('Armor from the Sanctum doesn\'t reduce Piercing damage', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['ravage']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).end();
    a.use(B1, 'ravage', A2).end();
    expect(a.hp(A2)).toBe(75);
  });

  it('it is capped at level 3', () => {
    const a = arena({ p0: [['titan.sanctuary']], p1: [['shot']] });
    a.give(A1, 'sanctum', { stacks: 3, duration: 6 }).use(A1, 'titan.sanctuary').end();
    expect(sanctum(a)).toBe(3);
  });

  it('at level 3 allies can\'t be Stunned', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['stun']] });
    a.give(A1, 'sanctum', { stacks: 3, duration: 6 }).end();
    a.use(B1, 'stun', A2).end();
    expect(a.hp(A2)).toBe(100 - 15 + 15); // 15 − 15 Armor = 0, then heals back
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85); // A2 could act
  });

  it('below level 3 allies can still be Stunned', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['stun']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).end();
    a.use(B1, 'stun', A2).end();
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('cannot_act');
  });

  it('it lasts 3 turns when no Wardstone stands', () => {
    // Stone Rebuke + an ally's hit raise it on turn 1, with no Wardstone on the board.
    const a = arena({ p0: [['bolt.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.sanctuary', B1).use(A2, 'shot', B1).end();
    expect(sanctum(a)).toBe(1);
    a.pass(4);
    expect(sanctum(a)).toBe(1); // through the enemy's 3rd turn… still up at the end of turn 5
    a.pass(2);
    expect(sanctum(a)).toBe(0);
  });

  it('while an allied Wardstone stands, it doesn\'t run out', () => {
    const a = arena({ p0: [['bolt.sanctuary'], ['shot'], ['taunt.sanctuary']], p1: [['shot']] });
    a.use(A3, 'taunt.sanctuary', B1).use(A1, 'bolt.sanctuary', B1).use(A2, 'shot', B1).end();
    expect([sanctum(a), minions(a, 0, 'wardstone').length]).toEqual([1, 1]);
    a.pass(9);
    expect(sanctum(a)).toBe(1);
  });

  it('raising it again refreshes its 3 turns (and the level rises)', () => {
    const a = arena({ p0: [['bolt.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.sanctuary', B1).use(A2, 'shot', B1).end().pass(3);
    a.use(A1, 'bolt.sanctuary', B1).use(A2, 'shot', B1).end();
    expect(sanctum(a)).toBe(2);
    a.pass(4);
    expect(sanctum(a)).toBe(2); // the first raise alone would have ended after turn 6
    a.pass(1);
    expect(sanctum(a)).toBe(0);
  });

  it('it belongs to its side: the enemy side gets no Armor or healing from it', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.setHp(B1, 50).give(A1, 'sanctum', { stacks: 2, duration: 6 }).end();
    expect(a.hp(B1)).toBe(50);
  });
});

describe('Wardstone', () => {
  it('is a 45 HP minion that counts as a Boulder', () => {
    const a = arena({ p0: [['taunt.sanctuary', 'strike.sanctuary']], p1: [['shot']] });
    a.use(A1, 'taunt.sanctuary', B1).end();
    const w = minions(a, 0, 'wardstone')[0]!;
    expect(w.hp).toBe(45);
    a.pass(1).use(A1, 'strike.sanctuary', B1).end(); // Toppled Idol looks for a Boulder
    expect([a.unit(w.id).alive, a.hp(B1)]).toEqual([false, 65]);
  });
});

describe('Sanctuary skills', () => {
  it('Toppled Idol: 20; an allied Boulder topples: it dies, +15 and Condemned', () => {
    const a = arena({ p0: [['strike.sanctuary'], ['charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.sanctuary', B1).end();
    expect([a.hp(B1), a.has(B1, 'condemned')]).toEqual([80, false]);
    a.pass(1).use(A2, 'charge.earth', B2).end().pass(1);
    expect(minions(a, 0, 'boulder').length).toBe(1);
    a.use(A1, 'strike.sanctuary', B1).end();
    expect([a.hp(B1), a.has(B1, 'condemned'), minions(a, 0, 'boulder').length]).toEqual([45, true, 0]);
  });

  it('Toppled Idol: only one Boulder topples', () => {
    const a = arena({ p0: [['strike.sanctuary'], ['charge.earth'], ['charge.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).use(A3, 'charge.earth', B1).end().pass(1);
    a.use(A1, 'strike.sanctuary', B1).end();
    expect([minions(a, 0, 'boulder').length, a.hp(B1)]).toEqual([1, 100 - 20 - 35]);
  });

  it('Cracking Foundation: 25 / 15 with no Boulder', () => {
    const a = arena({ p0: [['smash.sanctuary']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.sanctuary', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Cracking Foundation: each allied Boulder loses 15 HP and adds 5 to every hit', () => {
    const a = arena({ p0: [['smash.sanctuary'], ['charge.earth'], ['charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A2, 'charge.earth', B1).use(A3, 'charge.earth', B1).end().pass(1);
    a.use(A1, 'smash.sanctuary', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80 - 35, 100 - 25]);
    expect(minions(a, 0, 'boulder').map((u) => u.hp)).toEqual([30, 30]);
  });

  it('Pilgrim\'s Stride: 15; with a Shielded ally the user is Anointed until the end of their next turn', () => {
    const a = arena({ p0: [['charge.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.sanctuary', B1).end();
    expect([a.hp(B1), a.has(A1, 'anointed')]).toEqual([85, false]);
    const b = arena({ p0: [['charge.sanctuary'], ['shot']], p1: [['shot']] });
    b.give(A2, 'shield', { value: 10 }).use(A1, 'charge.sanctuary', B1).end();
    expect(b.has(A1, 'anointed')).toBe(true);
    b.pass(1);
    expect(b.has(A1, 'anointed')).toBe(true);
    b.pass(1);
    expect(b.has(A1, 'anointed')).toBe(false);
  });

  it('Pilgrim\'s Stride: an enemy\'s Shield doesn\'t count', () => {
    const a = arena({ p0: [['charge.sanctuary'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'shield', { value: 10 }).use(A1, 'charge.sanctuary', B1).end();
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Sheltering Stone: hidden; counters only the first Harmful skill on the user, 10 Piercing to its user', () => {
    const a = arena({ p0: [['riposte.sanctuary']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.sanctuary').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([90, 100, 85]);
  });

  it('Sheltering Stone: below Sanctum 3, allies aren\'t covered', () => {
    const a = arena({ p0: [['riposte.sanctuary'], ['shot']], p1: [['shot']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).use(A1, 'riposte.sanctuary').end();
    a.use(B1, 'shot', A2).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([100, 95]); // not countered: 15 − 2 Armor
  });

  it('Sheltering Stone: at Sanctum 3, it counters the first Harmful skill on each ally', () => {
    const a = arena({ p0: [['riposte.sanctuary'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'sanctum', { stacks: 3, duration: 6 }).use(A1, 'riposte.sanctuary').end();
    const a2 = a.hp(A2);
    a.use(B1, 'shot', A2).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([90, 90, a2]);
  });

  it('Temple Within: ends the Sanctum; Immune and 1 Might and 1 Armor per level', () => {
    const a = arena({ p0: [['rage.sanctuary', 'shot']], p1: [['strike', 'curse']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).use(A1, 'rage.sanctuary').end();
    expect(sanctum(a)).toBe(0);
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(90); // 20 − 2 Armor
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75); // 15 + 2 Might
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false); // Immune
  });

  it('Temple Within: with no Sanctum, still 1 Might and 1 Armor', () => {
    const a = arena({ p0: [['rage.sanctuary', 'shot']], p1: [['strike']] });
    a.use(A1, 'rage.sanctuary').end().use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Temple Within: lasts 3 turns', () => {
    const a = arena({ p0: [['rage.sanctuary', 'shot']], p1: [['strike']] });
    a.use(A1, 'rage.sanctuary').end().pass(5);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'immune')]).toEqual([85, false]);
  });

  it('Sprouting Stone: 15, and one allied Seedling grows into a Worldsprout', () => {
    const a = arena({ p0: [['shot.sanctuary'], ['summon.earth']], p1: [['shot']] });
    a.use(A2, 'summon.earth').end().pass(1).use(A1, 'shot.sanctuary', B1).end();
    expect([a.hp(B1), minions(a, 0, 'seedling').length, minions(a, 0, 'worldsprout').length]).toEqual([85, 1, 1]);
  });

  it('Sprouting Stone: no Seedling, no Worldsprout', () => {
    const a = arena({ p0: [['shot.sanctuary']], p1: [['shot']] });
    a.use(A1, 'shot.sanctuary', B1).end();
    expect([a.hp(B1), minions(a, 0, 'worldsprout').length]).toEqual([85, 0]);
  });

  it('Obelisk: a Wardstone now; 70 two turns later while a Wardstone stands', () => {
    const a = arena({ p0: [['snipe.sanctuary']], p1: [['shot']] });
    a.use(A1, 'snipe.sanctuary', B1).end();
    expect(minions(a, 0, 'wardstone').length).toBe(1);
    a.pass(2);
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect(a.hp(B1)).toBe(30);
  });

  it('Obelisk: 50 if no Wardstone still stands', () => {
    const a = arena({ p0: [['snipe.sanctuary']], p1: [['shot']] });
    a.use(A1, 'snipe.sanctuary', B1).end();
    const w = minions(a, 0, 'wardstone')[0]!;
    a.setHp(w.id, 10).use(B1, 'shot', w.id).end().pass(3);
    expect([a.unit(w.id).alive, a.hp(B1)]).toEqual([false, 50]);
  });

  it('Sacred Boundary: the first time the enemy damages an ally, 15 to them and Sanctum +1; only once', () => {
    const a = arena({ p0: [['trap.sanctuary'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.sanctuary', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false);
    a.use(B2, 'shot', A2).end(); // another enemy: no trigger
    expect([a.hp(B2), sanctum(a)]).toEqual([100, 0]);
    a.pass(1).use(B1, 'shot', A2).end();
    expect([a.hp(B1), sanctum(a)]).toEqual([85, 1]);
    a.pass(1).use(B1, 'shot', A2).end();
    expect([a.hp(B1), sanctum(a)]).toEqual([85, 1]);
  });

  it('Sacred Boundary: expires after 3 turns', () => {
    const a = arena({ p0: [['trap.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'trap.sanctuary', B1).end().pass(6);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(B1), sanctum(a)]).toEqual([100, 0]);
  });

  it('Take Sanctuary: the user alone is Invulnerable below Sanctum 3', () => {
    const a = arena({ p0: [['maneuver.sanctuary'], ['shot']], p1: [['shot']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).use(A1, 'maneuver.sanctuary').end();
    expect([a.has(A1, 'invulnerable'), a.has(A2, 'invulnerable'), sanctum(a)]).toEqual([true, false, 2]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Take Sanctuary: at Sanctum 3 it drops to 1 and every ally is Invulnerable', () => {
    const a = arena({ p0: [['maneuver.sanctuary'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'sanctum', { stacks: 3, duration: 6 }).use(A1, 'maneuver.sanctuary').end();
    expect([A1, A2, A3].map((u) => a.has(u, 'invulnerable'))).toEqual([true, true, true]);
    expect(sanctum(a)).toBe(1);
    a.pass(2);
    expect(a.has(A2, 'invulnerable')).toBe(false); // 1 turn
  });

  it('Temple Warden: 50 HP, permanent; Stone Fist 10; Bless the Ground raises the Sanctum', () => {
    const a = arena({ p0: [['companion.sanctuary']], p1: [['shot']] });
    a.use(A1, 'companion.sanctuary').end().pass(1);
    const w = minions(a, 0, 'temple_warden')[0]!;
    expect(w.hp).toBe(50);
    a.use(w.id, 'warden_stone_fist', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
    a.use(w.id, 'warden_bless_the_ground').end();
    expect(sanctum(a)).toBe(1);
    a.pass(10);
    expect(a.unit(w.id).alive).toBe(true);
  });

  it('Temple Warden: counts as a Wardstone (Penance in Stone counts it)', () => {
    const a = arena({ p0: [['companion.sanctuary', 'stun.sanctuary']], p1: [['shot']] });
    a.use(A1, 'companion.sanctuary').end().pass(1).use(A1, 'stun.sanctuary', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // 2 turns
    a.pass(2);
    a.use(B1, 'shot', A1).end();
  });

  it('Stone Rebuke: 20 and Sanctify; only the first ally to damage them raises the Sanctum', () => {
    const a = arena({ p0: [['bolt.sanctuary'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bolt.sanctuary', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), sanctum(a)]).toEqual([50, 1]);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(65); // Sanctify healed the damager 15
  });

  it('Stone Rebuke: the Sanctify lasts 1 turn', () => {
    const a = arena({ p0: [['bolt.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.sanctuary', B1).end();
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
    a.use(A2, 'shot', B1).end();
    expect(sanctum(a)).toBe(0);
  });

  it('Tremor of Faith: 20 Piercing to all, +10 per Sanctum level; then the Sanctum drops by 1', () => {
    const a = arena({ p0: [['blast.sanctuary']], p1: [['shot'], ['shot']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'blast.sanctuary').end();
    expect([a.hp(B1), a.hp(B2), sanctum(a)]).toEqual([60, 60, 1]);
  });

  it('Tremor of Faith: 20 with no Sanctum', () => {
    const a = arena({ p0: [['blast.sanctuary']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.sanctuary').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Holy Harvest: 5, healing the user for it; no Wardstone if not Sanctified', () => {
    const a = arena({ p0: [['consume.sanctuary']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.sanctuary', B1).end();
    expect([a.hp(B1), a.hp(A1), minions(a, 0, 'wardstone').length]).toEqual([95, 55, 0]);
  });

  it('Holy Harvest: against a Sanctified enemy the user creates a Wardstone', () => {
    const a = arena({ p0: [['consume.sanctuary']], p1: [['shot']] });
    a.give(B1, 'sanctify', { source: A1, duration: 2 }).use(A1, 'consume.sanctuary', B1).end();
    expect(minions(a, 0, 'wardstone').length).toBe(1);
  });

  it('Stonemason: 20 HP for 3 turns; Carve makes a Boulder below Sanctum 2', () => {
    const a = arena({ p0: [['summon.sanctuary']], p1: [['shot']] });
    a.use(A1, 'summon.sanctuary').end().pass(1);
    const m = minions(a, 0, 'stonemason')[0]!;
    expect(m.hp).toBe(20);
    a.use(m.id, 'stonemason_carve').end();
    expect([minions(a, 0, 'boulder').length, minions(a, 0, 'wardstone').length]).toEqual([1, 0]);
    a.pass(4);
    expect(a.unit(m.id).alive).toBe(false);
  });

  it('Stonemason: Carve makes a Wardstone at Sanctum 2 or more', () => {
    const a = arena({ p0: [['summon.sanctuary']], p1: [['shot']] });
    a.use(A1, 'summon.sanctuary').end().pass(1);
    a.give(A1, 'sanctum', { stacks: 2, duration: 6 });
    a.use(minions(a, 0, 'stonemason')[0]!.id, 'stonemason_carve').end();
    expect([minions(a, 0, 'boulder').length, minions(a, 0, 'wardstone').length]).toEqual([0, 1]);
  });

  it('Build the Sanctuary: the Sanctum rises by 1 at the end of each of the user\'s turns, 3 times', () => {
    const a = arena({ p0: [['channel.sanctuary']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.sanctuary').end();
    expect(sanctum(a)).toBe(1);
    a.pass(2);
    expect(sanctum(a)).toBe(2);
    a.pass(2);
    expect([sanctum(a), a.hp(B1)]).toEqual([3, 100]);
  });

  it('Build the Sanctuary: already at 3, all enemies take 10 instead', () => {
    const a = arena({ p0: [['channel.sanctuary']], p1: [['shot'], ['shot']] });
    a.give(A1, 'sanctum', { stacks: 3, duration: 20 }).use(A1, 'channel.sanctuary').end();
    expect([sanctum(a), a.hp(B1), a.hp(B2)]).toEqual([3, 90, 90]);
    a.pass(6);
    expect(a.hp(B1)).toBe(70); // 3 ticks in all
  });

  it('Penitent\'s Awl: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.sanctuary']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.sanctuary', B1).end().pass(1).use(A1, 'stab.sanctuary', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Penitent\'s Awl: their Condemned resolves now (a random debuff, and it ends)', () => {
    const a = arena({ p0: [['stab.sanctuary']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 }).use(A1, 'stab.sanctuary', B1).end();
    expect([debuffCount(a, B1), a.has(B1, 'condemned')]).toEqual([1, false]);
    const b = arena({ p0: [['stab.sanctuary']], p1: [['shot']] });
    b.use(A1, 'stab.sanctuary', B1).end();
    expect(debuffCount(b, B1)).toBe(0);
  });

  it('Ramstone Drill: 25 Piercing +5 per Armor; then the user loses 1 Armor', () => {
    const a = arena({ p0: [['ravage.sanctuary']], p1: [['shot']] });
    a.give(A1, 'armor', { stacks: 2 }).give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.sanctuary', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'armor')]).toEqual([65, 1]);
  });

  it('Ramstone Drill: 25 with no Armor', () => {
    const a = arena({ p0: [['ravage.sanctuary']], p1: [['shot']] });
    a.use(A1, 'ravage.sanctuary', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Right of Asylum: the first Harmful skill on each of the user\'s other allies is countered', () => {
    const a = arena({ p0: [['mislead.sanctuary'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'mislead.sanctuary').end();
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).use(B3, 'shot', A3).end();
    expect([a.hp(A2), a.hp(A3)]).toEqual([85, 100]);
  });

  it('Right of Asylum: doesn\'t protect the user', () => {
    const a = arena({ p0: [['mislead.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.sanctuary').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Right of Asylum: lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.sanctuary').end().pass(2).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Penance in Stone: 1 turn with no Wardstone', () => {
    const a = arena({ p0: [['stun.sanctuary']], p1: [['shot']] });
    a.use(A1, 'stun.sanctuary', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Penance in Stone: +1 turn per Wardstone, up to 3 turns in all', () => {
    const a = arena({
      p0: [['stun.sanctuary', 'snipe.sanctuary'], ['charge.earth', 'shout.sanctuary'], ['taunt.sanctuary']],
      p1: [['shot'], ['shot']],
      hp: 300,
    });
    a.use(A1, 'snipe.sanctuary', B2).use(A2, 'charge.earth', B2).use(A3, 'taunt.sanctuary', B2).end().pass(1);
    a.use(A2, 'shout.sanctuary').use(A1, 'stun.sanctuary', B1).end(); // the Boulder becomes a 3rd Wardstone first
    expect(minions(a, 0, 'wardstone').length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
      a.pass(2);
    }
    a.use(B1, 'shot', A1).end(); // free on their 4th turn: capped at 3
  });

  it('Stately Measure: at the start of each of the user\'s turns, 1 Might, 1 Armor, 1 Focus', () => {
    const a = arena({ p0: [['dance.sanctuary', 'shot']], p1: [['strike']] });
    a.use(A1, 'dance.sanctuary').end().pass(1);
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0); // Focus
    a.end();
    expect(a.hp(B1)).toBe(80); // 15 + 1 Might
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(100 - 15); // 1 Armor
  });

  it('Stately Measure: it builds up each turn, then ends after 4 turns', () => {
    const a = arena({ p0: [['dance.sanctuary', 'shot']], p1: [['strike']] });
    a.use(A1, 'dance.sanctuary').end().pass(5);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(70); // 15 + 3 Might (turns 3, 5, 7)
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(55); // turn 9: the Dance and all it gave are gone
  });

  it('Stately Measure: it all ends if the user uses a mobility skill', () => {
    const a = arena({ p0: [['dance.sanctuary', 'charge', 'shot']], p1: [['strike']] });
    a.use(A1, 'dance.sanctuary').end().pass(3);
    a.use(A1, 'charge', B1).end(); // a Charge is a mobility skill
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(80); // no Armor left
    const before = a.hp(B1);
    a.use(A1, 'shot', B1).end();
    expect(before - a.hp(B1)).toBe(15); // no Might left
  });

  it("Stately Measure: a non-mobility skill doesn't end it", () => {
    const a = arena({ p0: [['dance.sanctuary', 'shot']], p1: [['strike']] });
    a.use(A1, 'dance.sanctuary').end().pass(1).use(A1, 'shot', B1).end();
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 25); // 2 Might by turn 5
  });

  it('Day of Rest: 20 now, and 30 more at the end of their next turn if they use no Harmful skill', () => {
    const a = arena({ p0: [['heal.sanctuary'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 30).use(A1, 'heal.sanctuary', A2).end();
    expect(a.hp(A2)).toBe(50);
    a.pass(2);
    expect(a.hp(A2)).toBe(80);
  });

  it('Day of Rest: a Harmful skill on their next turn forfeits the 30', () => {
    const a = arena({ p0: [['heal.sanctuary'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 30).use(A1, 'heal.sanctuary', A2).end().pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(50);
  });

  it('Stone Vow: 1 Might for 3 turns', () => {
    const a = arena({ p0: [['bless.sanctuary'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.sanctuary', A2).end().pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(5).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Stone Vow: while an allied Wardstone stands, it takes half the damage the ally would', () => {
    const a = arena({ p0: [['bless.sanctuary'], ['shot'], ['taunt.sanctuary']], p1: [['strike'], ['shot']] });
    a.use(A3, 'taunt.sanctuary', B2).use(A1, 'bless.sanctuary', A2).end();
    const w = minions(a, 0, 'wardstone')[0]!;
    a.use(B1, 'strike', A2).end();
    expect([a.hp(A2), a.hp(w.id)]).toEqual([90, 35]);
  });

  it('Stone Vow: with no Wardstone, the ally takes the full hit', () => {
    const a = arena({ p0: [['bless.sanctuary'], ['shot']], p1: [['strike']] });
    a.use(A1, 'bless.sanctuary', A2).end().use(B1, 'strike', A2).end();
    expect(a.hp(A2)).toBe(80);
  });

  it('Excommunicate: Sanctum −1; Isolated for 3 turns and Condemned', () => {
    const a = arena({ p0: [['curse.sanctuary']], p1: [['shot'], ['heal']] });
    a.give(A1, 'sanctum', { stacks: 2, duration: 10 }).use(A1, 'curse.sanctuary', B1).end();
    expect([sanctum(a), a.has(B1, 'isolated'), a.has(B1, 'condemned')]).toEqual([1, true, true]);
    expect(a.reject(() => a.use(B2, 'heal', B1))).toBe('bad_target');
    a.pass(6);
    expect(a.has(B1, 'isolated')).toBe(false);
  });

  it('Firstfruits Brand: 20 and Sanctify for 1 turn; each heal from it triggers Channel Growth for the user\'s Seedlings', () => {
    const a = arena({ p0: [['smite.sanctuary', 'summon.earth'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1);
    a.use(A1, 'smite.sanctuary', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(50);
    expect(minions(a, 0, 'seedling').map((u) => u.maxHp)).toEqual([35, 35]); // two heals, +10 each
  });

  it('Firstfruits Brand: no heal, no growth', () => {
    const a = arena({ p0: [['smite.sanctuary', 'summon.earth']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'smite.sanctuary', B1).end().pass(2);
    expect(minions(a, 0, 'seedling').map((u) => u.maxHp)).toEqual([15, 15]);
  });

  it('Cornerstone Psalm: all allies gain 10 max HP and heal 15', () => {
    const a = arena({ p0: [['prayer.sanctuary'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'prayer.sanctuary').end();
    expect([a.unit(A1).maxHp, a.hp(A1), a.unit(A2).maxHp, a.hp(A2)]).toEqual([110, 110, 110, 65]);
    a.pass(10);
    expect(a.unit(A2).maxHp).toBe(110); // for the rest of the match
  });

  it('Shieldbearer\'s Sweep: 20 and 10 to a random other enemy', () => {
    const a = arena({ p0: [['cleave.sanctuary']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.sanctuary', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it('Shieldbearer\'s Sweep: for 2 turns, Sanctify on either one also gives its damager 15 Shield', () => {
    const a = arena({ p0: [['cleave.sanctuary'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.sanctuary', B1).end().pass(1);
    a.give(B2, 'sanctify', { source: A1, duration: 2 }).setHp(A2, 50).use(A2, 'shot', B2).end();
    expect(a.hp(A2)).toBe(65); // Sanctify still heals
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(65); // the 15 Shield soaked the 15
  });

  it('Shieldbearer\'s Sweep: a Sanctified enemy it didn\'t hit gives no Shield', () => {
    const a = arena({ p0: [['cleave.sanctuary'], ['shot']], p1: [['shot'], ['shot'], ['shot']], seed: 3 });
    a.use(A1, 'cleave.sanctuary', B1).end();
    const missed = [B2, B3].find((u) => a.hp(u) === 100)!;
    a.pass(1).give(missed, 'sanctify', { source: A1, duration: 2 }).use(A2, 'shot', missed).end();
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Call to the Faithful: every allied Boulder becomes a Wardstone; enemies Intimidated', () => {
    const a = arena({ p0: [['shout.sanctuary'], ['charge.earth'], ['charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A2, 'charge.earth', B1).use(A3, 'charge.earth', B1).end().pass(1);
    a.use(A1, 'shout.sanctuary').end();
    expect([minions(a, 0, 'boulder').length, minions(a, 0, 'wardstone').length]).toEqual([0, 2]);
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
  });

  it('Rampart of Faith: 20 Shield, +10 per allied Boulder and Wardstone, each of which loses 10 HP', () => {
    const a = arena({ p0: [['withstand.sanctuary'], ['charge.earth'], ['taunt.sanctuary']], p1: [['strike'], ['smash']] });
    a.use(A2, 'charge.earth', B1).use(A3, 'taunt.sanctuary', B1).end().pass(1);
    a.use(A1, 'withstand.sanctuary').end();
    expect(minions(a, 0).map((u) => u.hp).sort()).toEqual([35, 35]);
    // 40 Shield: B1 is Taunted to the Wardstone, so B2's Smash (25) hits A1, then nothing gets through
    a.use(B2, 'smash', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Rampart of Faith: 20 Shield alone', () => {
    const a = arena({ p0: [['withstand.sanctuary']], p1: [['smash']] });
    a.use(A1, 'withstand.sanctuary').end().use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(95);
  });

  it('Unceasing Challenge: a Wardstone; the enemy is Taunted by it for 2 turns and Condemned each hit', () => {
    const a = arena({ p0: [['taunt.sanctuary']], p1: [['shot']] });
    a.use(A1, 'taunt.sanctuary', B1).end();
    const w = minions(a, 0, 'wardstone')[0]!;
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    expect(a.has(B1, 'condemned')).toBe(false);
    a.use(B1, 'shot', w.id).end();
    expect([a.hp(w.id), a.has(B1, 'condemned')]).toEqual([30, true]);
    a.pass(3);
    expect(a.has(B1, 'taunt')).toBe(false); // 2 turns
  });

  it('Living Temple: Sanctum +1 and Immune', () => {
    const a = arena({ p0: [['titan.sanctuary']], p1: [['curse']] });
    a.use(A1, 'titan.sanctuary').end();
    expect(sanctum(a)).toBe(1);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it("Living Temple: while the user counts as a Wardstone, the Sanctum doesn't run out", () => {
    const a = arena({ p0: [['titan.sanctuary']], p1: [['shot']] });
    a.use(A1, 'titan.sanctuary').end().pass(6);
    expect(sanctum(a)).toBe(1); // 3-turn Sanctum outlived thanks to the Living Temple
  });

  it('Living Temple: Penance in Stone counts the user as a Wardstone', () => {
    const a = arena({ p0: [['titan.sanctuary', 'stun.sanctuary']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.sanctuary').end().pass(1).use(A1, 'stun.sanctuary', B2).end().pass(2);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act'); // still Stunned on their 2nd turn
  });

  it('Living Temple: 2 Armor (plus the Sanctum\'s 1)', () => {
    const a = arena({ p0: [['titan.sanctuary']], p1: [['strike']] });
    a.use(A1, 'titan.sanctuary').end().use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(95); // 20 − 3 Armor
  });
});
