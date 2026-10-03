// Spec-driven scenarios for Grave (Earth + Unholy): Graves, Raise, Undead minions and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.51, and the design kit (poison-earth-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena, type ArenaOptions } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

/** A match where A1 is a Grave character (carries Gravekeeper). */
const grave = (o: ArenaOptions) => arena({ ...o, passives: { p0c0: ['grave_keeper'], ...o.passives } });
const graves = (a: Arena, id = A1) => a.unit(id).counters['c:graves'] ?? 0;
const setGraves = (a: Arena, n: number, id = A1) => {
  a.unit(id).counters['c:graves'] = n;
  return a;
};
const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const costLetters = (id: string) => {
  const c = content.skills[id]!.cost as unknown as Record<string, number>;
  return ['S', 'A', 'I', 'W', 'r'].map((k) => k.repeat(c[k] ?? 0)).join('') || 'nc';
};
const sortLetters = (s: string) => (s === 'nc' ? s : [...s].sort().join(''));

describe('Grave: cost and cooldown match the design kit', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['W', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['r', 3], rage: ['SS', 4],
    shot: ['r', 0], snipe: ['Sr', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['Ir', 1], blast: ['Irr', 2], consume: ['r', 2], summon: ['W', 1], channel: ['Sr', 3],
    stab: ['r', 0], ravage: ['Wr', 2], mislead: ['S', 2], stun: ['Ar', 4], dance: ['r', 0],
    heal: ['r', 1], bless: ['r', 2], curse: ['r', 2], smite: ['W', 1], prayer: ['Srr', 2],
    cleave: ['S', 1], shout: ['nc', 3], withstand: ['r', 3], taunt: ['W', 3], titan: ['SW', 4],
  };
  it.each(Object.entries(kit))('%s.grave', (arch, [cost, cd]) => {
    const id = `${arch}.grave`;
    expect([sortLetters(costLetters(id)), content.skills[id]!.cooldown]).toEqual([sortLetters(cost), cd]);
  });

  it('minion skills: Rattle Blade nc, Gnaw r (Ghoul) / nc (Gravedigger), Unearth r', () => {
    expect(['skeleton_rattle_blade', 'ghoul_gnaw', 'gravedigger_gnaw', 'gravedigger_unearth'].map(costLetters)).toEqual([
      'nc', 'r', 'nc', 'r',
    ]);
  });

  it('the Invisible skills are tagged Invisible', () => {
    for (const id of ['riposte.grave', 'trap.grave', 'mislead.grave']) expect(content.skills[id]!.tags).toContain('Invisible');
  });
});

describe('Graves', () => {
  it('+1 whenever an enemy character dies', () => {
    const a = grave({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 10).use(A1, 'shot', B2).end();
    expect(graves(a)).toBe(1);
  });

  it('+1 whenever an allied unit or any minion dies, on either side', () => {
    const a = grave({ p0: [['shot'], ['shot'], ['charge.earth']], p1: [['shot', 'charge.earth'], ['shot']] });
    a.use(A3, 'charge.earth', B1).end().use(B1, 'charge.earth', A1).end();
    const mine = minions(a, 0, 'boulder')[0]!;
    const theirs = minions(a, 1, 'boulder')[0]!;
    a.setHp(mine.id, 5).setHp(theirs.id, 5).setHp(A2, 5);
    a.use(A1, 'shot', theirs.id).end().use(B1, 'shot', mine.id).use(B2, 'shot', A2).end();
    expect(graves(a)).toBe(3);
  });

  it('only Grave characters count Graves; each keeps their own count', () => {
    const a = grave({ p0: [['shot'], ['shot'], ['shot']], p1: [['shot'], ['shot']], passives: { p0c1: ['grave_keeper'] } });
    a.setHp(B2, 10).use(A3, 'shot', B2).end();
    expect([graves(a, A1), graves(a, A2), graves(a, A3)]).toEqual([1, 1, 0]);
  });

  it('caps at 6', () => {
    const a = grave({ p0: [['shot']], p1: [['shot'], ['shot']] });
    setGraves(a, 6).setHp(B2, 10).use(A1, 'shot', B2).end();
    expect(graves(a)).toBe(6);
  });
});

describe('Raise and the Undead', () => {
  it('a Skeleton has 20 HP and Rattle Blade (free) deals 10', () => {
    const a = grave({ p0: [['summon.grave']], p1: [['shot']] });
    setGraves(a, 1).use(A1, 'summon.grave').end().pass(1);
    const s = minions(a, 0, 'skeleton')[0]!;
    expect(s.hp).toBe(20);
    a.use(s.id, 'skeleton_rattle_blade', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('a Skeleton that dies leaves a Grave like any other unit', () => {
    const a = grave({ p0: [['summon.grave']], p1: [['shot']] });
    setGraves(a, 1).use(A1, 'summon.grave').end();
    const s = minions(a, 0, 'skeleton')[0]!;
    expect(graves(a)).toBe(0);
    a.setHp(s.id, 5).use(B1, 'shot', s.id).end();
    expect(graves(a)).toBe(1);
  });
});

describe('Grave skills', () => {
  it("Gravedigger's Spade: with a Grave, spends it for 30", () => {
    const a = grave({ p0: [['strike.grave']], p1: [['shot']] });
    setGraves(a, 2).use(A1, 'strike.grave', B1).end();
    expect([a.hp(B1), graves(a)]).toEqual([70, 1]);
  });

  it("Gravedigger's Spade: with none, 20 and digs 1 Grave", () => {
    const a = grave({ p0: [['strike.grave']], p1: [['shot']] });
    a.use(A1, 'strike.grave', B1).end();
    expect([a.hp(B1), graves(a)]).toEqual([80, 1]);
  });

  it('Split the Earth: 25 / 15; no Boulder, no Soul Fragments', () => {
    const a = grave({ p0: [['smash.grave']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.grave', B1).end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'soul_fragment')]).toEqual([75, 85, 0]);
  });

  it('Split the Earth: with a Boulder, one is ground in and a Soul Fragment is drained from each enemy hit', () => {
    const a = grave({ p0: [['smash.grave', 'charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.earth', B2).end().pass(1);
    a.use(A1, 'smash.grave', B1).end();
    expect([minions(a, 0, 'boulder').length, a.stacks(A1, 'soul_fragment')]).toEqual([0, 2]);
  });

  it('Split the Earth: only one Boulder is used', () => {
    const a = grave({ p0: [['smash.grave'], ['charge.earth'], ['charge.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).use(A3, 'charge.earth', B1).end().pass(1);
    a.use(A1, 'smash.grave', B1).end();
    expect(minions(a, 0, 'boulder').length).toBe(1);
  });

  it('Tomb Rush: 15; spends up to 2 Graves, and the next skill costs 1 less per Grave', () => {
    const a = grave({ p0: [['charge.grave', 'blast.grave']], p1: [['shot']] });
    setGraves(a, 3).use(A1, 'charge.grave', B1).end();
    expect([a.hp(B1), graves(a)]).toEqual([85, 1]);
    a.pass(1).use(A1, 'blast.grave');
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0); // Irr − 2
  });

  it('Tomb Rush: 1 Grave, 1 less', () => {
    const a = grave({ p0: [['charge.grave', 'blast.grave']], p1: [['shot']] });
    setGraves(a, 1).use(A1, 'charge.grave', B1).end().pass(1).use(A1, 'blast.grave');
    expect([graves(a), a.state.players[0].queue[0]?.cost.r]).toEqual([0, 1]);
  });

  it('Tomb Rush: no Graves, no discount', () => {
    const a = grave({ p0: [['charge.grave', 'blast.grave']], p1: [['shot']] });
    a.use(A1, 'charge.grave', B1).end().pass(1).use(A1, 'blast.grave');
    expect(a.state.players[0].queue[0]?.cost.r).toBe(2);
  });

  it('Tomb Rush: the discount is spent on the next skill only', () => {
    const a = grave({ p0: [['charge.grave', 'blast.grave', 'smash']], p1: [['shot']] });
    setGraves(a, 2).use(A1, 'charge.grave', B1).end().pass(1).use(A1, 'smash', B1).end().pass(1).use(A1, 'blast.grave');
    expect(a.state.players[0].queue[0]?.cost.r).toBe(2);
  });

  it('Grasping Hands: hidden; counters the first Harmful skill; a Skeleton claws up (no Grave) and Taunts the attacker', () => {
    const a = grave({ p0: [['riposte.grave']], p1: [['shot'], ['shot']] });
    setGraves(a, 2).use(A1, 'riposte.grave').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1 && e.defId !== 'grave_keeper')).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    const s = minions(a, 0, 'skeleton');
    expect([s.length, graves(a), a.hp(A1)]).toEqual([1, 2, 85]); // the 2nd shot got through
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(s[0]!.id);
    expect(a.has(B2, 'taunt')).toBe(false);
  });

  it('Grasping Hands: the Taunt lasts 1 turn', () => {
    const a = grave({ p0: [['riposte.grave']], p1: [['shot']] });
    a.use(A1, 'riposte.grave').end().use(B1, 'shot', A1).end().pass(1);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Call the Dead: spends up to 2 Graves for as many Skeletons; Immune', () => {
    const a = grave({ p0: [['rage.grave']], p1: [['curse']] });
    setGraves(a, 3).use(A1, 'rage.grave').end();
    expect([minions(a, 0, 'skeleton').length, graves(a)]).toEqual([2, 1]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Call the Dead: 1 Might whenever one of their minions dies, for 3 turns', () => {
    const a = grave({ p0: [['rage.grave', 'shot']], p1: [['shot']] });
    setGraves(a, 2).use(A1, 'rage.grave').end();
    const [s1, s2] = minions(a, 0, 'skeleton');
    a.setHp(s1!.id, 5).use(B1, 'shot', s1!.id).end();
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80); // 15 + 1 Might
    a.pass(4).setHp(s2!.id, 5).use(B1, 'shot', s2!.id).end(); // turn 8: Call the Dead is over
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBeGreaterThanOrEqual(60); // no 2nd Might (the 1st may end with the Rage)
  });

  it('Call the Dead: an enemy minion dying gives no Might', () => {
    const a = grave({ p0: [['rage.grave', 'shot']], p1: [['shot', 'charge.earth']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    const b = minions(a, 1, 'boulder')[0]!;
    a.use(A1, 'rage.grave').end().pass(1).setHp(b.id, 5).use(A1, 'shot', b.id).end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85); // no Might
  });

  it('Barrow Stone: 15; with no Grave, no Boulder', () => {
    const a = grave({ p0: [['shot.grave']], p1: [['shot']] });
    a.use(A1, 'shot.grave', B1).end();
    expect([a.hp(B1), minions(a, 0, 'boulder').length, graves(a)]).toEqual([85, 0, 0]);
  });

  it('Barrow Stone: spends 1 Grave, if the user has one, for a Boulder', () => {
    const a = grave({ p0: [['shot.grave']], p1: [['shot']] });
    setGraves(a, 3).use(A1, 'shot.grave', B1).end();
    expect([a.hp(B1), minions(a, 0, 'boulder').length, graves(a)]).toEqual([85, 1, 2]);
    expect(minions(a, 0, 'boulder')[0]!.hp).toBe(45);
  });

  it('Barrow Stone: its Boulder feeds Split the Earth', () => {
    const a = grave({ p0: [['shot.grave', 'smash.grave']], p1: [['shot'], ['shot']] });
    setGraves(a, 1).use(A1, 'shot.grave', B1).end().pass(1).use(A1, 'smash.grave', B1).end();
    expect([minions(a, 0, 'boulder').length, a.stacks(A1, 'soul_fragment')]).toEqual([0, 2]);
  });

  it('Grave Burrower: 55 two turns later', () => {
    const a = grave({ p0: [['snipe.grave']], p1: [['shot']] });
    a.use(A1, 'snipe.grave', B1).end().pass(2);
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect(a.hp(B1)).toBe(45);
  });

  it('Grave Burrower: a death before then makes it burst out at once', () => {
    const a = grave({ p0: [['snipe.grave'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.grave', B1).end();
    a.setHp(B2, 5).pass(1).use(A2, 'shot', B2).end();
    expect(a.hp(B1)).toBe(45);
    a.pass(4);
    expect(a.hp(B1)).toBe(45); // and only once
  });

  it('Open Grave: if the target kills, they are Stunned and the fallen rises as a Skeleton for the user, no Grave spent', () => {
    const a = grave({ p0: [['trap.grave'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.grave', B1).end();
    a.setHp(A2, 5).use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, minions(a, 0, 'skeleton').length, graves(a)]).toEqual([false, 1, 1]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Open Grave: another enemy\'s kill doesn\'t set it off', () => {
    const a = grave({ p0: [['trap.grave'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.grave', B1).end();
    a.setHp(A2, 5).use(B2, 'shot', A2).end().pass(1);
    expect(minions(a, 0, 'skeleton').length).toBe(0);
    a.use(B1, 'shot', A1).end();
  });

  it('Open Grave: expires after 2 turns', () => {
    const a = grave({ p0: [['trap.grave'], ['shot']], p1: [['shot']] });
    a.use(A1, 'trap.grave', B1).end().pass(4);
    a.setHp(A2, 5).use(B1, 'shot', A2).end();
    expect(minions(a, 0, 'skeleton').length).toBe(0);
  });

  it('Bury Yourself: Invulnerable for 1 turn; then spends up to 2 Graves for 15 Shield each', () => {
    const a = grave({ p0: [['maneuver.grave']], p1: [['smash']] });
    setGraves(a, 3).use(A1, 'maneuver.grave').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect(a.reject(() => a.use(B1, 'smash', A1))).toBe('bad_target');
    a.pass(2);
    expect([a.has(A1, 'invulnerable'), graves(a)]).toEqual([false, 1]);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(100); // 30 Shield ate the 25
  });

  it('Bury Yourself: with no Graves, no Shield', () => {
    const a = grave({ p0: [['maneuver.grave']], p1: [['smash']] });
    a.use(A1, 'maneuver.grave').end().pass(2).use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Ghoul Gravedigger: 40 HP, permanent; Gnaw 10 and heals 10', () => {
    const a = grave({ p0: [['companion.grave']], p1: [['shot']] });
    a.use(A1, 'companion.grave').end().pass(1);
    const g = minions(a, 0, 'ghoul_gravedigger')[0]!;
    expect(g.hp).toBe(40);
    a.setHp(g.id, 20).use(g.id, 'gravedigger_gnaw', B1).end();
    expect([a.hp(B1), a.hp(g.id)]).toEqual([90, 30]);
    a.pass(10);
    expect(a.unit(g.id).alive).toBe(true);
  });

  it("Ghoul Gravedigger: Unearth spends 2 of its creator's Graves for a Skeleton; with fewer, digs 1", () => {
    const a = grave({ p0: [['companion.grave']], p1: [['shot']] });
    a.use(A1, 'companion.grave').end().pass(1);
    const g = minions(a, 0, 'ghoul_gravedigger')[0]!;
    setGraves(a, 1).use(g.id, 'gravedigger_unearth').end().pass(1);
    expect([graves(a), minions(a, 0, 'skeleton').length]).toEqual([2, 0]);
    setGraves(a, 3).use(g.id, 'gravedigger_unearth').end();
    expect([graves(a), minions(a, 0, 'skeleton').length]).toEqual([1, 1]);
  });

  it('Deathbolt: +10 per Soul Fragment spent, up to 3', () => {
    const a = grave({ p0: [['bolt.grave']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'bolt.grave', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([60, 0]);
  });

  it('Deathbolt: spends at most 3', () => {
    const a = grave({ p0: [['bolt.grave']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 5 }).use(A1, 'bolt.grave', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
    expect(a.hp(B1)).toBe(100 - 50 - 10); // 2 kept fragments still add their +5 each
  });

  it('Deathbolt: no fragments, 20', () => {
    const a = grave({ p0: [['bolt.grave']], p1: [['shot']] });
    a.use(A1, 'bolt.grave', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Deathbolt: a kill returns the spent fragments, plus 1', () => {
    const a = grave({ p0: [['bolt.grave']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).setHp(B1, 30).use(A1, 'bolt.grave', B1).end();
    expect([a.unit(B1).alive, a.stacks(A1, 'soul_fragment')]).toEqual([false, 3]);
  });

  it('Uprising: spends up to 2 Graves for Skeletons that burst out for 15 each; then 20 to all', () => {
    const a = grave({ p0: [['blast.grave']], p1: [['shot'], ['shot']] });
    setGraves(a, 3).use(A1, 'blast.grave').end();
    expect([minions(a, 0, 'skeleton').length, graves(a)]).toEqual([2, 1]);
    expect(200 - a.hp(B1) - a.hp(B2)).toBe(30 + 40);
    expect(Math.min(a.hp(B1), a.hp(B2))).toBeLessThanOrEqual(80);
  });

  it('Uprising: no Graves, just 20 to all', () => {
    const a = grave({ p0: [['blast.grave']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.grave').end();
    expect([a.hp(B1), a.hp(B2), minions(a, 0, 'skeleton').length]).toEqual([80, 80, 0]);
  });

  it('Marrow Draught: with no allied minion, a Skeleton claws up first (no Grave spent) and is drained', () => {
    const a = grave({ p0: [['consume.grave']], p1: [['shot']] });
    setGraves(a, 2).setHp(A1, 50).use(A1, 'consume.grave').end();
    const s = minions(a, 0, 'skeleton');
    expect([s.length, s[0]?.hp, a.hp(A1), graves(a), a.hp(B1)]).toEqual([1, 10, 60, 2, 100]);
  });

  it('Marrow Draught: drains 10 from every minion on both sides; the user heals the total', () => {
    const a = grave({ p0: [['consume.grave', 'summon.grave']], p1: [['shot', 'charge.earth']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    setGraves(a, 1).use(A1, 'summon.grave').end().pass(1);
    a.setHp(A1, 50).use(A1, 'consume.grave').end();
    expect([a.hp(A1), minions(a, 0, 'skeleton').length, minions(a, 0, 'skeleton')[0]?.hp, minions(a, 1, 'boulder')[0]?.hp]).toEqual([70, 1, 10, 35]);
  });

  it('Marrow Draught: an enemy minion alone doesn\'t stop the Skeleton (only allied ones do)', () => {
    const a = grave({ p0: [['consume.grave']], p1: [['shot', 'charge.earth']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    a.setHp(A1, 50).use(A1, 'consume.grave').end();
    expect([minions(a, 0, 'skeleton').length, a.hp(A1)]).toEqual([1, 70]);
  });

  it('Marrow Draught: a minion that dies leaves a Grave; only the HP it had is healed', () => {
    const a = grave({ p0: [['consume.grave', 'summon.grave']], p1: [['shot']] });
    setGraves(a, 1).use(A1, 'summon.grave').end().pass(1);
    const s = minions(a, 0, 'skeleton')[0]!;
    a.setHp(s.id, 5).setHp(A1, 50).use(A1, 'consume.grave').end();
    expect([a.unit(s.id).alive, graves(a), a.hp(A1)]).toEqual([false, 1, 55]);
  });

  it('Raise Skeletons: spends up to 2 Graves for as many Skeletons', () => {
    const a = grave({ p0: [['summon.grave']], p1: [['shot']] });
    setGraves(a, 5).use(A1, 'summon.grave').end();
    expect([minions(a, 0, 'skeleton').length, graves(a)]).toEqual([2, 3]);
  });

  it('Raise Skeletons: with no Graves, digs 1 instead', () => {
    const a = grave({ p0: [['summon.grave']], p1: [['shot']] });
    a.use(A1, 'summon.grave').end();
    expect([minions(a, 0, 'skeleton').length, graves(a)]).toEqual([0, 1]);
  });

  it('Necropolis: 10 to all enemies at the end of each of the user\'s turns, 3 times', () => {
    const a = grave({ p0: [['channel.grave']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.grave').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(7);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });

  it('Necropolis: any unit or minion that dies meanwhile rises for the user as a Skeleton', () => {
    const a = grave({ p0: [['channel.grave'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 5).use(A1, 'channel.grave').end();
    expect(minions(a, 0, 'skeleton').length).toBe(1);
    a.setHp(A2, 5).use(B1, 'shot', A2).end();
    expect(minions(a, 0, 'skeleton').length).toBe(2);
  });

  it('Necropolis: deaths after it ends raise nothing', () => {
    const a = grave({ p0: [['channel.grave'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.grave').end().pass(7);
    a.setHp(B2, 5).use(A2, 'shot', B2).end();
    expect(minions(a, 0, 'skeleton').length).toBe(0);
  });

  it('Last Rites: 10, or 20 at or below 60 HP', () => {
    const a = grave({ p0: [['stab.grave']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.grave', B1).end().pass(1).use(A1, 'stab.grave', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Last Rites: left at 15 or less, the user spends 2 Graves to kill them', () => {
    const a = grave({ p0: [['stab.grave']], p1: [['shot'], ['shot']] });
    setGraves(a, 2).setHp(B1, 35).use(A1, 'stab.grave', B1).end();
    expect([a.unit(B1).alive, graves(a)]).toEqual([false, 1]); // 2 spent, then 1 for the death
  });

  it('Last Rites: no execution without 2 Graves, or above 15 HP', () => {
    const a = grave({ p0: [['stab.grave']], p1: [['shot'], ['shot']] });
    setGraves(a, 1).setHp(B1, 35).use(A1, 'stab.grave', B1).end();
    expect([a.hp(B1), graves(a)]).toEqual([15, 1]);
    const b = grave({ p0: [['stab.grave']], p1: [['shot'], ['shot']] });
    setGraves(b, 2).setHp(B1, 40).use(A1, 'stab.grave', B1).end();
    expect([b.hp(B1), graves(b)]).toEqual([20, 2]);
  });

  it('Deathless Drill: 25 Piercing', () => {
    const a = grave({ p0: [['ravage.grave']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.grave', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 100]);
  });

  it('Deathless Drill: while Immortal, it costs the user 20 HP and deals 20 more', () => {
    const a = grave({ p0: [['ravage.grave']], p1: [['shot']] });
    a.give(A1, 'immortal').use(A1, 'ravage.grave', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([55, 80]);
  });

  it("Premature Burial: hidden; the target's Harmful skill is countered", () => {
    const a = grave({ p0: [['mislead.grave']], p1: [['smash']] });
    a.use(A1, 'mislead.grave', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it("Premature Burial: the countered skill's cooldown rises by 3", () => {
    const a = grave({ p0: [['mislead.grave']], p1: [['smash']] });
    a.use(A1, 'mislead.grave', B1).end().use(B1, 'smash', A1).end();
    const ctrl = grave({ p0: [['shot']], p1: [['smash']] });
    ctrl.pass(1).use(B1, 'smash', A1).end();
    expect(a.cooldown(B1, 'smash')).toBe(ctrl.cooldown(B1, 'smash') + 3);
  });

  it('Premature Burial: a Helpful skill isn\'t countered', () => {
    const a = grave({ p0: [['mislead.grave']], p1: [['heal']] });
    a.use(A1, 'mislead.grave', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Buried Alive: Stunned 1 turn, +1 per Grave spent, up to 2', () => {
    const a = grave({ p0: [['stun.grave']], p1: [['shot']] });
    setGraves(a, 3).use(A1, 'stun.grave', B1).end();
    expect(graves(a)).toBe(1);
    for (let i = 0; i < 3; i++) {
      expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
      a.pass(2);
    }
    a.use(B1, 'shot', A1).end();
  });

  it('Buried Alive: with no Graves, 1 turn', () => {
    const a = grave({ p0: [['stun.grave']], p1: [['shot']] });
    a.use(A1, 'stun.grave', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2).use(B1, 'shot', A1).end();
  });

  it('Graveside Vigil: 5 Shield per Grave', () => {
    const a = grave({ p0: [['dance.grave']], p1: [['smash']] });
    setGraves(a, 3).use(A1, 'dance.grave').end().use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it('Graveside Vigil: up to 25', () => {
    const a = grave({ p0: [['dance.grave']], p1: [['strike']] });
    setGraves(a, 6).use(A1, 'dance.grave').end();
    a.give(B1, 'might', { stacks: 2 }).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(95); // 30 − 25
  });

  it('Graveside Vigil: used again while its Shield holds, digs 1 Grave first', () => {
    const a = grave({ p0: [['dance.grave']], p1: [['shot']] });
    setGraves(a, 3).use(A1, 'dance.grave').end().pass(1).use(A1, 'dance.grave').end();
    expect(graves(a)).toBe(4);
  });

  it('Feast of the Fallen: spends 1 Grave to heal 30', () => {
    const a = grave({ p0: [['heal.grave'], ['shot']], p1: [['shot']] });
    setGraves(a, 2).setHp(A2, 40).use(A1, 'heal.grave', A2).end();
    expect([a.hp(A2), graves(a)]).toEqual([70, 1]);
  });

  it('Feast of the Fallen: with no Grave, heals 10', () => {
    const a = grave({ p0: [['heal.grave'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).use(A1, 'heal.grave', A2).end();
    expect([a.hp(A2), graves(a)]).toEqual([50, 0]);
  });

  it('Epitaph: 1 Might for 3 turns', () => {
    const a = grave({ p0: [['bless.grave'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.grave', A2).end().pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(5).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Epitaph: if they die meanwhile, each of their allies gains a copy of every Buff they had', () => {
    const a = grave({ p0: [['bless.grave'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A2, 'armor', { stacks: 2 }).use(A1, 'bless.grave', A2).end();
    a.setHp(A2, 5).use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
    for (const u of [A1, A3]) expect([a.stacks(u, 'might'), a.stacks(u, 'armor')]).toEqual([1, 2]);
    expect(a.stacks(B1, 'might')).toBe(0);
  });

  it('Bitter Soil: Confused for 2 turns', () => {
    const a = grave({ p0: [['curse.grave']], p1: [['shot']] });
    a.use(A1, 'curse.grave', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
    a.pass(4);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Bitter Soil: each Helpful skill they use while Horrified sprouts a Seedling for the user', () => {
    const a = grave({ p0: [['curse.grave']], p1: [['heal']] });
    a.use(A1, 'curse.grave', B1).end();
    a.give(B1, 'horrified', { source: A1, duration: 4 }).use(B1, 'heal', B1).end();
    expect(minions(a, 0, 'seedling').length).toBe(1);
  });

  it('Bitter Soil: no Horrified, or a Harmful skill, sprouts nothing', () => {
    const a = grave({ p0: [['curse.grave']], p1: [['heal', 'shot']] });
    a.use(A1, 'curse.grave', B1).end().use(B1, 'heal', B1).end().pass(1);
    a.give(B1, 'horrified', { source: A1, duration: 4 }).use(B1, 'shot', A1).end();
    expect(minions(a, 0, 'seedling').length).toBe(0);
  });

  it('Grave Marker: 20; for 2 turns, each heal on them drains a Soul Fragment for the user', () => {
    const a = grave({ p0: [['smite.grave']], p1: [['heal'], ['heal']] });
    a.use(A1, 'smite.grave', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.setHp(B1, 20).use(B1, 'heal', B1).use(B2, 'heal', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
  });

  it('Grave Marker: wears off after 2 turns', () => {
    const a = grave({ p0: [['smite.grave']], p1: [['heal']] });
    a.use(A1, 'smite.grave', B1).end().pass(4).use(B1, 'heal', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
  });

  it('Requiem: all allies heal 20 and gain 10 Shield', () => {
    const a = grave({ p0: [['prayer.grave'], ['shot']], p1: [['smash']] });
    a.setHp(A2, 40).use(A1, 'prayer.grave').end();
    expect(a.hp(A2)).toBe(60);
    a.use(B1, 'smash', A2).end();
    expect(a.hp(A2)).toBe(45); // 25 − 10 Shield
  });

  it("Requiem: heals 10 more per unit or minion that died since the user's last turn", () => {
    const a = grave({ p0: [['prayer.grave', 'summon.grave'], ['shot']], p1: [['shot'], ['shot']] });
    setGraves(a, 2).use(A1, 'summon.grave').end();
    const [s1, s2] = minions(a, 0, 'skeleton');
    a.setHp(s1!.id, 5).setHp(s2!.id, 5).use(B1, 'shot', s1!.id).use(B2, 'shot', s2!.id).end();
    a.setHp(A2, 20).use(A1, 'prayer.grave').end();
    expect(a.hp(A2)).toBe(20 + 20 + 20);
  });

  it("Reaper's Row: 20 and 15 to a random other enemy; then every minion on both sides takes 15", () => {
    const a = grave({ p0: [['cleave.grave', 'summon.grave']], p1: [['shot', 'charge.earth'], ['shot']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    setGraves(a, 1).use(A1, 'summon.grave').end().pass(1);
    a.use(A1, 'cleave.grave', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 85]);
    expect([minions(a, 0, 'skeleton')[0]?.hp, minions(a, 1, 'boulder')[0]?.hp]).toEqual([5, 30]);
  });

  it('Tolling Bell: everyone except the user is Intimidated for 2 turns', () => {
    const a = grave({ p0: [['shout.grave'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.grave').end();
    expect([A1, A2, B1, B2].map((u) => a.has(u, 'intimidated'))).toEqual([false, true, true, true]);
    a.pass(4);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Wall of Bones: 25 Shield for 2 turns', () => {
    const a = grave({ p0: [['withstand.grave']], p1: [['strike']] });
    a.use(A1, 'withstand.grave').end().use(B1, 'strike', A1).end();
    expect([a.hp(A1), minions(a, 0, 'skeleton').length]).toEqual([100, 0]);
    a.pass(1).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(80); // 5 left on turn 4; the 2nd strike is 25 (20 + 1 Might)
  });

  it('Wall of Bones: when it breaks, a Skeleton rises, spending no Grave', () => {
    const a = grave({ p0: [['withstand.grave']], p1: [['smash'], ['shot']] });
    setGraves(a, 2).use(A1, 'withstand.grave').end().use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect([minions(a, 0, 'skeleton').length, graves(a)]).toEqual([1, 2]);
  });

  it('Wall of Bones: if it runs out unbroken, no Skeleton', () => {
    const a = grave({ p0: [['withstand.grave']], p1: [['shot']] });
    a.use(A1, 'withstand.grave').end().pass(5);
    expect(minions(a, 0, 'skeleton').length).toBe(0);
  });

  it('Grudge Beyond the Grave: Taunts target enemy for 2 turns', () => {
    const a = grave({ p0: [['taunt.grave'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.grave', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(4);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Grudge Beyond the Grave: if the user dies, they rise as a Ghoul (30 HP) and the Taunt carries on to it', () => {
    const a = grave({ p0: [['taunt.grave'], ['shot']], p1: [['shot'], ['shot']] });
    setGraves(a, 0).use(A1, 'taunt.grave', B1).end();
    a.setHp(A1, 5).use(B1, 'shot', A1).end();
    const g = minions(a, 0, 'ghoul');
    expect([a.unit(A1).alive, g.length, g[0]?.hp]).toEqual([false, 1, 30]);
    expect(a.effects(B1).some((e) => e.defId === 'taunt' && e.source === g[0]!.id)).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // must hit the Ghoul
    a.use(B1, 'shot', g[0]!.id).end();
  });

  it('Grudge Beyond the Grave: no Ghoul if the user survives', () => {
    const a = grave({ p0: [['taunt.grave'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.grave', B1).end().use(B1, 'shot', A1).end();
    expect(minions(a, 0, 'ghoul').length).toBe(0);
  });

  it('Ghoul: Gnaw deals 10 and the Ghoul heals 10', () => {
    const a = grave({ p0: [['taunt.grave'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.grave', B1).end().setHp(A1, 5).use(B1, 'shot', A1).end();
    const g = minions(a, 0, 'ghoul')[0]!;
    a.setHp(g.id, 10).use(g.id, 'ghoul_gnaw', B1).end();
    expect([a.hp(B1), a.hp(g.id)]).toEqual([90, 20]);
  });

  it('Lord of the Grave: 2 Armor and Immune for 3 turns', () => {
    const a = grave({ p0: [['titan.grave']], p1: [['strike', 'curse']] });
    a.use(A1, 'titan.grave').end().use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(90);
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Lord of the Grave: their minions are Immortal', () => {
    const a = grave({ p0: [['titan.grave', 'summon.grave']], p1: [['strike']] });
    setGraves(a, 1).use(A1, 'summon.grave').end().pass(1).use(A1, 'titan.grave').end();
    const s = minions(a, 0, 'skeleton')[0]!;
    a.use(B1, 'strike', s.id).end();
    expect([a.unit(s.id).alive, a.hp(s.id)]).toEqual([true, 5]);
  });
});
