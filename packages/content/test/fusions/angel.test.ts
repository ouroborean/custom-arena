// Spec-driven tests for the Angel fusion (Wind + Holy): Ward, Halo and all 30 variants.
// Sources: skill/status descriptions, docs/rules.md §21.43, and the wind-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const key = (e: { inline?: { id: string }; defId: string }) => (e.inline ? e.inline.id : e.defId);
const find = (a: Arena, id: string, k: string) => a.effects(id).find((e) => key(e) === k);
const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const seen = (a: Arena, p: 0 | 1, bearer: string, k: string) =>
  viewFor(content, a.state, p).effects.some((e) => e.bearer === bearer && key(e) === k);
const shieldOn = (a: Arena, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.countsAs?.includes('shield') || key(e) === 'shield')
    .reduce((n, e) => n + e.value, 0);

describe('Angel keywords', () => {
  it('Ward: the first Harmful single-target skill aimed at the Warded ally each turn goes to the Angel', () => {
    const a = arena({ p0: [['bless.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.angel', A2).end();
    expect(find(a, A2, 'warded')?.source).toBe(A1);
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 85]); // first redirected, second lands
  });

  it('Ward: it applies again on the next turn', () => {
    const a = arena({ p0: [['bless.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.angel', A2).end().use(B1, 'shot', A2).end().pass(1).use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 100]);
  });

  it('Ward: multi-target skills aren\'t redirected', () => {
    const a = arena({ p0: [['bless.angel'], ['shot']], p1: [['blast']] });
    a.use(A1, 'bless.angel', A2).end().use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([65, 65]);
  });

  it('Ward: no redirect if the Angel can\'t be targeted', () => {
    const a = arena({ p0: [['bless.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.angel', A2).end();
    a.give(A1, 'invulnerable', { duration: 2 }).use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 85]);
  });

  it('Halo: the first lethal hit leaves the bearer at 25 instead, and the Halo is spent', () => {
    const a = arena({ p0: [['shot']], p1: [['smash'], ['shot']] });
    a.give(A1, 'halo').setHp(A1, 10).pass(1).use(B1, 'smash', A1).end();
    expect([a.unit(A1).alive, a.hp(A1), a.has(A1, 'halo')]).toEqual([true, 25, false]);
    a.pass(1).setHp(A1, 10).use(B2, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  it('Halo: a non-lethal hit doesn\'t spend it', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'halo').setHp(A1, 50).pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'halo')]).toEqual([35, true]);
  });

  it('Halo: a hit leaving the bearer at exactly 1 also counts (simplified ruling)', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'halo').setHp(A1, 16).pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'halo')]).toEqual([25, false]);
  });
});

describe('Angel skills', () => {
  it('Wingstrike: 20, and the user Wards the ally with the least HP for 1 turn', () => {
    const a = arena({ p0: [['strike.angel'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).setHp(A3, 60).use(A1, 'strike.angel', B1).end();
    expect([a.hp(B1), find(a, A2, 'warded')?.source, a.has(A3, 'warded')]).toEqual([80, A1, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 50]);
    a.pass(1);
    expect(a.has(A2, 'warded')).toBe(false);
  });

  it('Heaven\'s Descent: 20 to the target and 10 to their allies; no kills, no Halo', () => {
    const a = arena({ p0: [['smash.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.angel', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'halo'), a.has(A2, 'halo')]).toEqual([80, 90, false, false]);
  });

  it('Heaven\'s Descent: each enemy killed gives a random ally a Halo', () => {
    const a = arena({ p0: [['smash.angel'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B2, 10).setHp('p1c2', 10).use(A1, 'smash.angel', B1).end();
    expect([a.unit(B2).alive, a.unit('p1c2').alive]).toEqual([false, false]);
    expect(a.stacks(A1, 'halo') + a.stacks(A2, 'halo')).toBeGreaterThanOrEqual(1);
    expect([A1, A2].filter((u) => a.has(u, 'halo')).length).toBeGreaterThanOrEqual(1);
  });

  it('Heaven\'s Descent: one kill gives exactly one ally a Halo', () => {
    const a = arena({ p0: [['smash.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 10).use(A1, 'smash.angel', B1).end();
    expect([A1, A2].filter((u) => a.has(u, 'halo'))).toHaveLength(1);
  });

  it('Swoop: Rushing, and Wards target ally for 1 turn; the first redirected hit is halved', () => {
    const a = arena({ p0: [['charge.angel'], ['shot']], p1: [['smash'], ['shot']] });
    a.use(A1, 'charge.angel', A2).end();
    expect([a.has(A1, 'rushing'), find(a, A2, 'warded')?.source]).toEqual([true, A1]);
    a.use(B1, 'smash', A2).end(); // 25 to the target → redirected and halved; 15 splash to the target's allies
    expect(100 - a.hp(A1)).toBeGreaterThanOrEqual(12);
    expect(100 - a.hp(A1)).toBeLessThanOrEqual(13);
  });

  it('Swoop: the Ward ends after 1 turn', () => {
    const a = arena({ p0: [['charge.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.angel', A2).end().pass(2).use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 85]);
  });

  it('Intercession: invisible; Wards every ally and counters a skill redirected to the user', () => {
    const a = arena({ p0: [['riposte.angel'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.angel').end();
    expect([seen(a, 0, A1, 'intercession'), seen(a, 1, A1, 'intercession')]).toEqual([true, false]);
    expect([a.has(A2, 'warded'), a.has(A3, 'warded')]).toEqual([true, true]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]);
  });

  it('Intercession: counters only the first; the next Harmful skill aimed at the user lands', () => {
    const a = arena({ p0: [['riposte.angel']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.angel').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Unbroken Wings: 1 Might, Immune and a Halo for 3 turns', () => {
    const a = arena({ p0: [['rage.angel', 'shot']], p1: [['curse']] });
    a.use(A1, 'rage.angel').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), a.has(A1, 'halo'), a.has(A1, 'confusion')]).toEqual([1, true, true, false]);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(4);
    expect([a.has(A1, 'immune'), a.has(A1, 'might')]).toEqual([false, false]);
  });

  it('Unbroken Wings: if the Halo saves them, +2 Might and the Rage lasts 2 turns longer', () => {
    const a = arena({ p0: [['rage.angel']], p1: [['shot']] });
    a.use(A1, 'rage.angel').end();
    const d = find(a, A1, 'unbroken_wings')?.duration ?? find(a, A1, 'immune')!.duration!;
    a.setHp(A1, 10).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'might')]).toEqual([25, 3]);
    a.pass(4); // the normal 3 turns are over
    expect([a.has(A1, 'immune'), a.stacks(A1, 'might')]).toEqual([true, 3]);
    a.pass(4);
    expect(a.has(A1, 'immune')).toBe(false);
    expect(d).toBeGreaterThan(0);
  });

  it('Quill of Light: 15; a Sanctify on the target then heals the damager\'s whole team', () => {
    const a = arena({ p0: [['shot.angel'], ['smite'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'shot.angel', B1).use(A2, 'smite', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 20 - 15);
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([65, 65, 65]);
  });

  it('Quill of Light: without it, a Sanctify heals only the damager', () => {
    const a = arena({ p0: [['shot'], ['smite'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'shot', B1).use(A2, 'smite', B1).use(A3, 'shot', B1).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([50, 50, 65]);
  });

  it('Descending Spear: 40 on the following turn; while aiming, every ally is Warded', () => {
    const a = arena({ p0: [['snipe.angel'], ['shot']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'snipe.angel', B1).end();
    expect([a.hp(B1), a.has(A2, 'warded')]).toEqual([100, true]);
    a.pass(1);
    expect([a.hp(B1), a.has(A2, 'warded')]).toEqual([60, false]);
  });

  it('Descending Spear: +10 for each hit redirected to the user meanwhile', () => {
    const a = arena({ p0: [['snipe.angel'], ['shot']], p1: [['withstand'], ['shot']] });
    a.use(A1, 'snipe.angel', B1).end().use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2), a.hp(B1)]).toEqual([85, 100, 50]);
  });

  it('Descending Spear: the target is hidden from the opponent', () => {
    const a = arena({ p0: [['snipe.angel']], p1: [['withstand']] });
    a.use(A1, 'snipe.angel', B1).end();
    expect(content.skills['snipe.angel']!.tags).toContain('HiddenTarget');
  });

  it('Watchful Eye: invisible; an ally who would die is saved at 25, and the attacker is Condemned', () => {
    const a = arena({ p0: [['trap.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.angel').end();
    expect([seen(a, 0, A2, 'watchful_eye'), seen(a, 1, A2, 'watchful_eye')]).toEqual([true, false]);
    a.setHp(A2, 10).use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, a.hp(A2), a.has(B1, 'condemned'), a.has(B2, 'condemned')]).toEqual([true, 25, true, false]);
  });

  it('Watchful Eye: a non-lethal hit doesn\'t spend it or Condemn', () => {
    const a = arena({ p0: [['trap.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'trap.angel').end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'condemned'), a.has(A2, 'watchful_eye')]).toEqual([85, false, true]);
  });

  it('Watchful Eye: lasts 2 turns', () => {
    const a = arena({ p0: [['trap.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'trap.angel').end().pass(4).setHp(A2, 10).use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
  });

  it('Take Flight: the user Leaps; at 40+ HP, no Halo', () => {
    const a = arena({ p0: [['maneuver.angel']], p1: [['shot']] });
    a.setHp(A1, 40).use(A1, 'maneuver.angel').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable'), a.has(A1, 'halo')]).toEqual([true, true, false]);
  });

  it('Take Flight: below 40 HP, also a Halo for 2 turns', () => {
    const a = arena({ p0: [['maneuver.angel']], p1: [['shot']] });
    a.setHp(A1, 39).use(A1, 'maneuver.angel').end();
    expect(a.has(A1, 'halo')).toBe(true);
    a.pass(2);
    expect(a.has(A1, 'halo')).toBe(true); // on through the enemy's 2nd turn
    a.pass(1);
    expect(a.has(A1, 'halo')).toBe(false);
  });

  it('Cherub: a permanent 35 HP minion', () => {
    const a = arena({ p0: [['companion.angel']], p1: [['shot']] });
    a.use(A1, 'companion.angel').end().pass(10);
    expect(minions(a, 0, 'cherub').map((u) => u.hp)).toEqual([35]);
  });

  it('Cherub Shelter: the Cherub Wards target ally for 1 turn', () => {
    const a = arena({ p0: [['companion.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.angel').end().pass(1);
    const cherub = minions(a, 0, 'cherub')[0]!;
    a.use(cherub.id, 'cherub_shelter', A2).end().use(B1, 'shot', A2).end();
    expect([a.hp(cherub.id), a.hp(A2)]).toEqual([20, 100]);
  });

  it('Cherub Holy Arrow: 15 and Sanctify for 1 turn', () => {
    const a = arena({ p0: [['companion.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.angel').end().pass(1);
    a.use(minions(a, 0, 'cherub')[0]!.id, 'cherub_holy_arrow', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([85, true]);
    a.pass(2);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Beam from Above: 25 and Marked for 1 turn; the last unit who damaged the target heals 25', () => {
    const a = arena({ p0: [['bolt.angel'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A2, 'shot', B1).use(A1, 'bolt.angel', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.hp(A2), a.hp(A1)]).toEqual([60, true, 75, 50]);
  });

  it('Endless Verdict: 20 Piercing to all enemies', () => {
    const a = arena({ p0: [['blast.angel']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'blast.angel').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Endless Verdict: for 2 turns, a Condemnation doesn\'t end when it triggers', () => {
    const a = arena({ p0: [['blast.angel']], p1: [['shot']], seed: 3 });
    a.give(B1, 'condemned', { source: A1 }).use(A1, 'blast.angel').end().use(B1, 'shot', A1).end();
    expect(a.has(B1, 'condemned')).toBe(true);
    const debuffs = () => ['weakness', 'vulnerable', 'confusion'].reduce((n, s) => n + a.stacks(B1, s), 0);
    expect(debuffs()).toBe(1);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(debuffs()).toBe(2);
  });

  it('Endless Verdict: without it, a Condemnation ends when it triggers', () => {
    const a = arena({ p0: [['blast']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 }).pass(1).use(B1, 'shot', A1).end();
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Endless Verdict: wears off after 2 turns', () => {
    const a = arena({ p0: [['blast.angel']], p1: [['shot']] });
    a.use(A1, 'blast.angel').end().pass(4);
    a.give(B1, 'condemned', { source: A1 }).use(B1, 'shot', A1).end();
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Grace Received: 5 damage healing the user; steals the target\'s Swiftness, healing 10 per stack', () => {
    const a = arena({ p0: [['consume.angel']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'swiftness', { stacks: 2 }).use(A1, 'consume.angel', B1).end();
    expect([a.hp(B1), a.hp(A1), a.stacks(B1, 'swiftness'), a.stacks(A1, 'swiftness')]).toEqual([95, 75, 0, 2]);
  });

  it('Grace Received: no Swiftness to take, just the 5 drain', () => {
    const a = arena({ p0: [['consume.angel']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.angel', B1).end();
    expect([a.hp(A1), a.stacks(A1, 'swiftness')]).toEqual([55, 0]);
  });

  it('Heavenly Host: two 10 HP Lesser Angels for 3 turns', () => {
    const a = arena({ p0: [['summon.angel']], p1: [['shot']] });
    a.use(A1, 'summon.angel').end();
    expect(minions(a, 0, 'lesser_angel').map((u) => u.hp)).toEqual([10, 10]);
    a.pass(5);
    expect(minions(a, 0, 'lesser_angel')).toHaveLength(0);
  });

  it('Heavenly Host: an ally who would die is saved at 25 and a Lesser Angel dies instead', () => {
    const a = arena({ p0: [['summon.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.angel').end().setHp(A2, 10).use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, a.hp(A2), minions(a, 0, 'lesser_angel').length]).toEqual([true, 25, 1]);
  });

  it('Heavenly Host: only the first time — a second lethal hit on that ally kills them', () => {
    const a = arena({ p0: [['summon.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.angel').end().setHp(A2, 10).use(B1, 'shot', A2).end();
    a.pass(1).setHp(A2, 10).use(B2, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
  });

  it('Lesser Angel Soothe: target ally heals 10', () => {
    const a = arena({ p0: [['summon.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.angel').end().pass(1).setHp(A2, 50);
    a.use(minions(a, 0, 'lesser_angel')[0]!.id, 'lesser_angel_soothe', A2).end();
    expect(a.hp(A2)).toBe(60);
  });

  it('Vigil: Wards the ally with the least HP; an enemy whose hit was redirected takes 15 at the end of the user\'s turn', () => {
    const a = arena({ p0: [['channel.angel'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).setHp(A3, 70).use(A1, 'channel.angel').end();
    expect([a.has(A2, 'warded'), a.has(A3, 'warded')]).toEqual([true, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 50]);
    a.end(); // the user's turn ends (Vigil continues: no other skill used)
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Vigil: lasts 3 turns', () => {
    const a = arena({ p0: [['channel.angel'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'channel.angel').end().pass(6);
    expect(a.has(A2, 'warded')).toBe(false);
  });

  it('Piercing Feather: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.angel']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.angel', B1).end().pass(1).use(A1, 'stab.angel', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Piercing Feather: an Anointed user spends it to Leap first: +5, and stays Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['stab.angel']], p1: [['shot']] });
    a.give(A1, 'anointed').use(A1, 'stab.angel', B1).end();
    expect([a.hp(B1), a.has(A1, 'anointed'), a.has(A1, 'invulnerable')]).toEqual([85, false, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Piercing Feather: the dive\'s Leaping is spent by the Feather\'s own hit', () => {
    const a = arena({ p0: [['stab.angel']], p1: [['shot']] });
    a.give(A1, 'anointed').use(A1, 'stab.angel', B1).end();
    expect(a.has(A1, 'leaping')).toBe(false);
  });

  it('Plummet: the user Leaps, then dives at the start of their next turn for 30 Piercing +5', () => {
    const a = arena({ p0: [['ravage.angel']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.angel', B1).end();
    expect([a.hp(B1), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([100, true, true]);
    a.pass(1);
    expect(a.hp(B1)).toBe(65);
  });

  it('Martyr\'s Wings: invisible; if the target uses a Harmful skill, the user gains a Halo first and Taunts them for 1 turn', () => {
    const a = arena({ p0: [['mislead.angel'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.angel', B1).end();
    expect([seen(a, 0, B1, 'martyrs_wings'), seen(a, 1, B1, 'martyrs_wings')]).toEqual([true, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.has(A1, 'halo'), find(a, B1, 'taunt')?.source, a.hp(A2)]).toEqual([true, A1, 85]); // no redirect
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // still Taunted on their next turn
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Martyr\'s Wings: Helpful skills don\'t trigger it, and other enemies are unaffected', () => {
    const a = arena({ p0: [['mislead.angel'], ['shot']], p1: [['withstand'], ['shot']] });
    a.use(A1, 'mislead.angel', B1).end().use(B1, 'withstand').use(B2, 'shot', A2).end();
    expect([a.has(A1, 'halo'), a.has(B1, 'taunt'), a.has(B2, 'taunt')]).toEqual([false, false, false]);
  });

  it('Glorious Light: Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.angel']], p1: [['shot']] });
    a.use(A1, 'stun.angel', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Glorious Light: the first ally to damage them heals 15 and is Anointed; the second gets nothing', () => {
    const a = arena({ p0: [['stun.angel'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 50).use(A1, 'stun.angel', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(A2), a.has(A2, 'anointed'), a.hp(A3), a.has(A3, 'anointed')]).toEqual([65, true, 50, false]);
  });

  it('Glorious Light: the Anointed lasts until the end of the ally\'s next turn', () => {
    const a = arena({ p0: [['stun.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'stun.angel', B1).use(A2, 'shot', B1).end().pass(1);
    expect(a.has(A2, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A2, 'anointed')).toBe(false);
  });

  it('Wings of Respite: 1 Might and 2 Swiftness for 4 turns', () => {
    const a = arena({ p0: [['dance.angel']], p1: [['shot']] });
    a.use(A1, 'dance.angel').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([1, 2]);
    a.pass(8);
    expect([a.has(A1, 'might'), a.has(A1, 'swiftness')]).toEqual([false, false]);
  });

  it('Wings of Respite: a Stun on an ally is shrugged off at the cost of 1 of the user\'s Swiftness', () => {
    const a = arena({ p0: [['dance.angel'], ['shot']], p1: [['stun'], ['stun']] });
    a.use(A1, 'dance.angel').end().use(B1, 'stun', A2).end();
    expect([a.has(A2, 'stun'), a.stacks(A1, 'swiftness'), a.hp(A2)]).toEqual([false, 1, 85]);
  });

  it('Wings of Respite: with no Swiftness left, the Stun lands', () => {
    const a = arena({ p0: [['dance.angel'], ['shot']], p1: [['stun'], ['stun'], ['stun']] });
    a.use(A1, 'dance.angel').end().use(B1, 'stun', A2).use(B2, 'stun', A2).use('p1c2', 'stun', A2).end();
    expect([a.has(A2, 'stun'), a.stacks(A1, 'swiftness')]).toEqual([true, 0]);
  });

  it('Lay on Hands: heals 20 and a Halo for 2 turns; unspent, it heals 20 more when it fades', () => {
    const a = arena({ p0: [['heal.angel'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.angel', A2).end();
    expect([a.hp(A2), a.has(A2, 'lay_on_hands') || a.has(A2, 'halo')]).toEqual([70, true]);
    a.pass(4);
    expect(a.hp(A2)).toBe(90);
  });

  it('Lay on Hands: if the Halo saves them, no extra heal when the time runs out', () => {
    const a = arena({ p0: [['heal.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal.angel', A2).end().setHp(A2, 10).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(25);
    a.pass(3);
    expect(a.hp(A2)).toBe(25);
  });

  it('Under My Wing: Wards target ally for 2 turns and gives them 1 Swiftness', () => {
    const a = arena({ p0: [['bless.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.angel', A2).end();
    expect([a.has(A2, 'warded'), a.stacks(A2, 'swiftness')]).toEqual([true, 1]);
    a.pass(2);
    expect(a.has(A2, 'warded')).toBe(true);
    a.pass(1);
    expect(a.has(A2, 'warded')).toBe(false);
  });

  it('Fallen Grace: strips mobility buffs; a mobility buff gained meanwhile Condemns instead', () => {
    const a = arena({ p0: [['curse.angel']], p1: [['charge.wind']] });
    a.give(B1, 'swiftness').give(B1, 'leaping').use(A1, 'curse.angel', B1).end();
    expect([a.has(B1, 'swiftness'), a.has(B1, 'leaping'), a.has(B1, 'condemned')]).toEqual([false, false, false]);
    a.use(B1, 'charge.wind').end();
    expect([a.has(B1, 'rushing'), a.has(B1, 'swiftness'), a.has(B1, 'condemned')]).toEqual([false, false, true]);
  });

  it('Fallen Grace: after 2 turns, mobility buffs stick again', () => {
    const a = arena({ p0: [['curse.angel']], p1: [['charge.wind']] });
    a.use(A1, 'curse.angel', B1).end().pass(4).use(B1, 'charge.wind').end();
    expect([a.has(B1, 'rushing'), a.has(B1, 'condemned')]).toEqual([true, false]);
  });

  it('Heavenly Mark: 20; allies who damage the target are Warded by the user for 1 turn', () => {
    const a = arena({ p0: [['smite.angel'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.angel', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), find(a, A2, 'warded')?.source, a.has(A3, 'warded')]).toEqual([65, A1, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 100]);
  });

  it('Mercy Unbounded: every living unit, enemies included, gains 3 Renew and 2 Armor', () => {
    const a = arena({ p0: [['prayer.angel'], ['shot']], p1: [['shot'], ['shot']] });
    for (const u of [A1, A2, B1, B2]) a.setHp(u, 50);
    a.use(A1, 'prayer.angel').end();
    // Renew ticks at the end of the applier's turn: 3 stacks heal 15, then 1 stack is lost
    for (const u of [A1, A2, B1, B2]) expect([a.hp(u), a.stacks(u, 'renew'), a.stacks(u, 'armor')]).toEqual([65, 2, 2]);
  });

  it('Mercy Unbounded: the Armor lasts 3 turns', () => {
    const a = arena({ p0: [['prayer.angel']], p1: [['shot']] });
    a.use(A1, 'prayer.angel').end().pass(6);
    expect(a.has(A1, 'armor')).toBe(false);
  });

  it('Sweeping Wings: 20 to the target, 15 to another enemy, and the least-HP ally Leaps', () => {
    const a = arena({ p0: [['cleave.angel'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 70).setHp(A3, 40).use(A1, 'cleave.angel', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 85]);
    expect([a.has(A3, 'leaping'), a.has(A2, 'leaping'), a.has(A1, 'leaping')]).toEqual([true, false, false]);
  });

  it('Last Trumpet: all enemies Intimidated for 2 turns; only allies below 30 HP gain a 1-turn Halo', () => {
    const a = arena({ p0: [['shout.angel'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 29).setHp(A3, 30).use(A1, 'shout.angel').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    expect([a.has(A2, 'halo'), a.has(A3, 'halo'), a.has(A1, 'halo')]).toEqual([true, false, false]);
    a.pass(2);
    expect(a.has(A2, 'halo')).toBe(false);
  });

  it('Spread Wings: 25 Shield and every ally Warded for 1 turn', () => {
    const a = arena({ p0: [['withstand.angel'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'withstand.angel').end();
    expect([find(a, A1, 'spread_wings')?.value, a.has(A2, 'warded'), a.has(A3, 'warded')]).toEqual([25, true, true]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]); // redirected into the Shield
  });

  it('Spread Wings: the Shield left when it ends is split among the allies', () => {
    const a = arena({ p0: [['withstand.angel'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'withstand.angel').end().use(B1, 'shot', A2).end();
    // 10 left on the user
    expect(shieldOn(a, A2) + shieldOn(a, A3)).toBe(10);
    expect(shieldOn(a, A2)).toBe(shieldOn(a, A3));
  });

  it('Radiant Challenge: Taunts for 2 turns, and the user has a Halo while it lasts', () => {
    const a = arena({ p0: [['taunt.angel'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.angel', B1).end();
    expect([find(a, B1, 'taunt')?.source, a.has(A1, 'halo')]).toEqual([A1, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(3);
    expect([a.has(B1, 'taunt'), a.has(A1, 'halo')]).toEqual([false, false]);
  });

  it('Seraphic Form: 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.angel']], p1: [['curse']] });
    a.use(A1, 'titan.angel').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([2, true, false]);
    a.pass(5);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Seraphic Form: a single-target Helpful skill affects every ally', () => {
    const a = arena({ p0: [['titan.angel', 'heal'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'titan.angel').end().pass(1).setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'heal', A2).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([75, 75, 75]);
  });

  it('Seraphic Form: meanwhile, the user can\'t use Harmful skills', () => {
    const a = arena({ p0: [['titan.angel', 'shot']], p1: [['shot']] });
    a.use(A1, 'titan.angel').end().pass(1);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
  });
});

describe('Angel costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Sr', 2], charge: ['nc', 1], riposte: ['A', 3], rage: ['A', 4],
    shot: ['r', 0], snipe: ['Arr', 2], trap: ['r', 2], maneuver: ['r', 3], companion: ['AI', 4],
    bolt: ['I', 1], blast: ['Ar', 2], consume: ['r', 2], summon: ['I', 1], channel: ['A', 3],
    stab: ['A', 0], ravage: ['A', 1], mislead: ['A', 2], stun: ['r', 1], dance: ['AW', 5],
    heal: ['Wr', 2], bless: ['A', 2], curse: ['A', 2], smite: ['Wr', 1], prayer: ['W', 2],
    cleave: ['S', 1], shout: ['A', 3], withstand: ['r', 3], taunt: ['W', 3], titan: ['WA', 4],
  };
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(Object.entries(kit))('%s.angel matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.angel`]!;
    expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
  });
});
