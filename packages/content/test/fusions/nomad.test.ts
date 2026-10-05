// Spec-driven tests for the Nomad fusion (Wind + Earth): Trek and all 30 variants.
// Sources: skill/status descriptions, docs/rules.md §21.42, and the wind-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition, viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const TREK = { p0c0: ['nomad_trek'] };

const trek = (a: Arena, id = A1) => a.stacks(id, 'trek');
const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const mobility = (a: Arena, id: string) => ['swiftness', 'rushing', 'leaping'].reduce((n, s) => n + a.stacks(id, s), 0);
const energyTotal = (a: Arena, p: 0 | 1) => Object.values(a.state.players[p].energy).reduce((n, v) => n + v, 0);
// Whether player p's view shows an effect (by status id or inline id) on a unit.
const seen = (a: Arena, p: 0 | 1, bearer: string, key: string) =>
  viewFor(content, a.state, p).effects.some((e) => e.bearer === bearer && (e.inline ? e.inline.id : e.defId) === key);

describe('Nomad keyword: Trek', () => {
  it('Trek: +1 at the end of each turn with a different skill than last time, up to 3', () => {
    const a = arena({ p0: [['shot', 'stab', 'smash', 'cleave']], p1: [['withstand']], passives: TREK });
    const seen: number[] = [];
    for (const s of ['shot', 'stab', 'smash', 'cleave']) {
      a.use(A1, s, B1).end();
      seen.push(trek(a));
      a.pass(1);
    }
    expect(seen).toEqual([1, 2, 3, 3]);
  });

  it('Trek: repeating the same skill resets it to 0', () => {
    const a = arena({ p0: [['shot', 'stab']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'stab', B1).end().pass(1);
    expect(trek(a)).toBe(2);
    a.use(A1, 'stab', B1).end();
    expect(trek(a)).toBe(0);
  });

  it('Trek: a turn with no skill resets it to 0', () => {
    const a = arena({ p0: [['shot', 'stab']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'stab', B1).end();
    expect(trek(a)).toBe(2);
    a.pass(2);
    expect(trek(a)).toBe(0);
  });

  it('Trek: it is the bearer\'s own — an ally acting doesn\'t move it, and the enemy\'s turn doesn\'t either', () => {
    const a = arena({ p0: [['shot', 'stab'], ['shot', 'stab']], p1: [['shot', 'stab']], passives: TREK });
    a.use(A1, 'shot', B1).end();
    expect(trek(a)).toBe(1);
    a.use(B1, 'shot', A1).end();
    expect(trek(a)).toBe(1); // enemy turn: unchanged
    a.use(A1, 'stab', B1).use(A2, 'shot', B1).end();
    expect([trek(a), trek(a, A2)]).toEqual([2, 0]); // A2 has no Wanderer passive
  });

  it('Trek is a Neutral status with max 3', () => {
    expect([content.statuses.trek?.kind, content.statuses.trek?.maxStacks]).toEqual(['Neutral', 3]);
  });
});

describe('Nomad skills', () => {
  it('Wayfarer\'s Blow: 15 damage with no Trek', () => {
    const a = arena({ p0: [['strike.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'strike.nomad', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Wayfarer\'s Blow: spends all Trek for +10 per Trek spent', () => {
    const a = arena({ p0: [['strike.nomad']], p1: [['shot']], passives: TREK });
    a.give(A1, 'trek', { stacks: 3 }).use(A1, 'strike.nomad', B1).end();
    expect(a.hp(B1)).toBe(55); // 15 + 30
    expect(trek(a)).toBeLessThan(2); // spent (the turn's own rise may add 1 back)
  });

  it('Dune Crash: 20 to the target and 10 to their allies; below 3 Trek, nobody is buried', () => {
    const a = arena({ p0: [['smash.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.give(B1, 'swiftness').give(A1, 'trek', { stacks: 2 }).use(A1, 'smash.nomad', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'isolated'), a.has(B1, 'swiftness')]).toEqual([80, 90, false, true]);
  });

  it('Dune Crash: at 3 Trek, everyone hit loses mobility buffs and is Isolated for 1 turn', () => {
    const a = arena({ p0: [['smash.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.give(B1, 'swiftness').give(B2, 'leaping').give(A1, 'trek', { stacks: 3 }).use(A1, 'smash.nomad', B1).end();
    expect([mobility(a, B1), mobility(a, B2), a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([0, 0, true, true]);
    a.pass(2);
    expect([a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([false, false]);
  });

  it('Break Camp: the user begins Rushing; with no Boulder or Seedling, no bonus Trek', () => {
    const a = arena({ p0: [['charge.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'charge.nomad').end();
    expect([a.has(A1, 'rushing'), trek(a)]).toEqual([true, 1]); // just the turn's own rise
  });

  it('Break Camp: with Boulders, exactly one is removed and the user gains 2 Trek', () => {
    const a = arena({ p0: [['charge.nomad'], ['charge.earth'], ['charge.earth']], p1: [['shot'], ['shot']], passives: TREK });
    a.use(A2, 'charge.earth', B1).use('p0c2', 'charge.earth', B2).end().pass(1);
    expect(minions(a, 0, 'boulder')).toHaveLength(2);
    a.use(A1, 'charge.nomad').end();
    expect([minions(a, 0, 'boulder').length, trek(a), a.has(A1, 'rushing')]).toEqual([1, 3, true]); // 2 + the turn's rise
  });

  it('Break Camp: a Seedling can be packed up too', () => {
    const a = arena({ p0: [['charge.nomad'], ['summon.earth']], p1: [['shot']], passives: TREK });
    a.use(A2, 'summon.earth').end().pass(1);
    expect(minions(a, 0, 'seedling')).toHaveLength(2);
    a.use(A1, 'charge.nomad').end();
    expect([minions(a, 0, 'seedling').length, trek(a)]).toEqual([1, 3]);
  });

  it('Stone and Sand: invisible; counters the first Harmful skill and Taunts its user toward a new Boulder', () => {
    const a = arena({ p0: [['riposte.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.use(A1, 'riposte.nomad').end();
    expect([seen(a, 0, A1, 'stone_and_sand'), seen(a, 1, A1, 'stone_and_sand')]).toEqual([true, false]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    const boulders = minions(a, 0, 'boulder');
    expect(a.hp(A1)).toBe(85); // only B2's shot landed
    expect(boulders).toHaveLength(1);
    const taunt = a.effects(B1).find((e) => e.defId === 'taunt');
    expect(taunt?.source).toBe(boulders[0]!.id);
    expect(a.has(B2, 'taunt')).toBe(false);
  });

  it('Stone and Sand: the Taunt lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'riposte.nomad').end().use(B1, 'shot', A1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Stone and Sand: lasts 1 turn — a Harmful skill after it ends lands', () => {
    const a = arena({ p0: [['riposte.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'riposte.nomad').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), minions(a, 0, 'boulder').length]).toEqual([85, 0]);
  });

  it('Wanderlust: Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.nomad']], p1: [['curse']], passives: TREK });
    a.use(A1, 'rage.nomad').end().use(B1, 'curse', A1).end();
    expect([a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([true, false]);
    a.pass(5);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Wanderlust: each Trek rise gives 1 Might (+5) until the Trek resets', () => {
    const a = arena({ p0: [['rage.nomad', 'shot', 'stab']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'rage.nomad').end().pass(1); // Trek 1 → 1 Might
    a.use(A1, 'shot', B1).end().pass(1); // 15 + 5; Trek 2 → 2 Might
    expect(a.hp(B1)).toBe(80);
    a.use(A1, 'stab', B1).end().pass(1); // 10 + 10; Trek 3
    expect(a.hp(B1)).toBe(60);
    a.pass(2); // no skill: Trek resets, Might gone
    expect(trek(a)).toBe(0);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(45); // back to plain 15
  });

  it('Wanderlust: no Might from Trek rises without it', () => {
    const a = arena({ p0: [['rage.nomad', 'shot', 'stab']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'stab', B1).end();
    expect([trek(a), a.hp(B1)]).toEqual([2, 75]);
  });

  it('Sling Stone: never used before, it hits for the full 10 + 15', () => {
    const a = arena({ p0: [['shot.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot.nomad', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Sling Stone: used on back-to-back turns, just 10', () => {
    const a = arena({ p0: [['shot.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot.nomad', B1).end().pass(1).use(A1, 'shot.nomad', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 10);
  });

  it('Sling Stone: +5 for each of the user\'s turns since they last used it', () => {
    const a = arena({ p0: [['shot.nomad', 'stab']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot.nomad', B1).end().pass(1).use(A1, 'stab', B1).end().pass(1); // one turn in between
    a.use(A1, 'shot.nomad', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 10 - 15);
    a.pass(5).use(A1, 'shot.nomad', B1).end(); // two turns in between
    expect(a.hp(B1)).toBe(50 - 20);
  });

  it('Sling Stone: the wind-up stops at +15', () => {
    const a = arena({ p0: [['shot.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot.nomad', B1).end().pass(9).use(A1, 'shot.nomad', B1).end(); // four turns in between
    expect(a.hp(B1)).toBe(100 - 25 - 25);
  });

  it('Haboob: nothing on the turn of use; on the following turn, gusts of 20, 25 then 30 Piercing, never the same enemy twice in a row', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const a = arena({ p0: [['snipe.nomad']], p1: [['withstand'], ['withstand']], passives: TREK, seed });
      a.give(B1, 'armor', { stacks: 2 }).give(B2, 'armor', { stacks: 2 }).use(A1, 'snipe.nomad').end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
      a.pass(1);
      // Two enemies: the 1st and 3rd gusts hit one (20 + 30), the 2nd hits the other (25). Piercing ignores Armor.
      expect([a.hp(B1), a.hp(B2)].sort((x, y) => x - y)).toEqual([50, 75]);
      a.pass(4);
      expect([a.hp(B1), a.hp(B2)].sort((x, y) => x - y)).toEqual([50, 75]); // only once
    }
  });

  it('Haboob: across three enemies it deals 75 in all, and no enemy takes two gusts in a row', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const a = arena({ p0: [['snipe.nomad']], p1: [['withstand'], ['withstand'], ['withstand']], passives: TREK, seed });
      a.use(A1, 'snipe.nomad').end().pass(1);
      const lost = [B1, B2, 'p1c2'].map((id) => 100 - a.hp(id)).sort((x, y) => x - y);
      expect(lost.reduce((n, x) => n + x, 0)).toBe(75);
      // Possible splits: 20/25/30 (three enemies) or 0/25/50 (1st and 3rd on one) — never 45 or 55 on one enemy.
      expect([[20, 25, 30], [0, 25, 50]]).toContainEqual(lost);
    }
  });

  it('Haboob: with only one enemy left to reach, it strikes once for 20 and dies out', () => {
    const a = arena({ p0: [['snipe.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'snipe.nomad').end().pass(1);
    expect(a.hp(B1)).toBe(80);
    expect(a.has(B1, 'haboob_trail')).toBe(false); // nothing left behind
  });

  it('Haboob: the user\'s own side is never hit', () => {
    const a = arena({ p0: [['snipe.nomad'], ['withstand']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'snipe.nomad').end().pass(1);
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]);
  });

  it('Haboob: Channeled — stunning the user before it lands stops it', () => {
    const a = arena({ p0: [['snipe.nomad', 'withstand'], ['withstand']], p1: [['stun'], ['withstand']], passives: TREK });
    a.use(A1, 'snipe.nomad').end().use(B1, 'stun', A1).end().pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
  });

  it('Sinking Sands: stays hidden from the enemy until it is sprung', () => {
    const a = arena({ p0: [['trap.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'trap.nomad', B1).end();
    expect([seen(a, 0, B1, 'sinking_sands'), seen(a, 1, B1, 'sinking_sands')]).toEqual([true, false]);
  });

  it('Sinking Sands: the same skill on two of their turns in a row sinks them at the end of the user\'s next turn: 25 damage and Stunned for 1 turn', () => {
    const a = arena({ p0: [['trap.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    a.use(A1, 'trap.nomad', B1).end().use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100); // not yet
    a.pass(1);
    expect([a.hp(B1), a.has(B1, 'sinking_sands')]).toEqual([75, false]);
    expect(a.reject(() => a.use(B1, 'withstand'))).toBe('cannot_act');
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Sinking Sands: the skill they used on their turn before it was set counts', () => {
    const a = arena({ p0: [['trap.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    a.pass(1).use(B1, 'shot', A1).end();
    a.use(A1, 'trap.nomad', B1).end().use(B1, 'shot', A1).end().pass(1);
    expect(a.hp(B1)).toBe(75);
  });

  it('Sinking Sands: switching skills, or an idle turn in between, never sinks them', () => {
    const a = arena({ p0: [['trap.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    a.use(A1, 'trap.nomad', B1).end().use(B1, 'shot', A1).end().pass(1).use(B1, 'withstand').end();
    a.pass(1).use(B1, 'shot', A1).end().pass(1);
    expect(a.hp(B1)).toBe(100);
    const b = arena({ p0: [['trap.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    b.use(A1, 'trap.nomad', B1).end().use(B1, 'shot', A1).end().pass(3).use(B1, 'shot', A1).end().pass(1);
    expect(b.hp(B1)).toBe(100);
  });

  it('Sinking Sands: lasts 3 turns — a repeat on its 3rd turn still sinks them, after that nothing', () => {
    const a = arena({ p0: [['trap.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    a.use(A1, 'trap.nomad', B1).end().use(B1, 'withstand').end().pass(1).use(B1, 'shot', A1).end();
    a.pass(1).use(B1, 'shot', A1).end().pass(1);
    expect(a.hp(B1)).toBe(75);
    const b = arena({ p0: [['trap.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    b.use(A1, 'trap.nomad', B1).end().pass(6).use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end().pass(1);
    expect([b.hp(B1), b.has(B1, 'sinking_sands')]).toEqual([100, false]);
  });

  it('Dune Leap: the other ally with the least HP Leaps (Invulnerable, +5 on their next hit); the user doesn\'t', () => {
    const a = arena({ p0: [['maneuver.nomad'], ['shot'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A2, 60).setHp('p0c2', 80).use(A1, 'maneuver.nomad').end();
    expect([a.has(A2, 'leaping'), a.has(A2, 'invulnerable')]).toEqual([true, true]);
    expect([a.has('p0c2', 'leaping'), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([false, false, false]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 20);
  });

  it('Dune Leap: boosting an ally raises the user\'s Trek by 1 (on top of the turn\'s own rise)', () => {
    const a = arena({ p0: [['maneuver.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'maneuver.nomad').end();
    expect(trek(a)).toBe(2);
  });

  it('Dune Leap: with no other ally to boost, the user Leaps instead and gains no extra Trek', () => {
    const a = arena({ p0: [['maneuver.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'maneuver.nomad').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable'), trek(a)]).toEqual([true, true, 1]);
  });

  it('Pack Camel: a 50 HP minion; while it stands, an idle turn doesn\'t reset Trek', () => {
    const a = arena({ p0: [['companion.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'companion.nomad').end().pass(1);
    const camel = minions(a, 0, 'pack_camel')[0]!;
    expect(camel.hp).toBe(50);
    a.use(A1, 'shot', B1).end();
    expect(trek(a)).toBe(2);
    a.pass(2);
    expect(trek(a)).toBe(2);
    a.pass(2);
    expect(trek(a)).toBe(2);
  });

  it('Pack Camel: once it\'s dead, an idle turn resets Trek again', () => {
    const a = arena({ p0: [['companion.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'companion.nomad').end();
    const camel = minions(a, 0, 'pack_camel')[0]!;
    a.setHp(camel.id, 10).use(B1, 'shot', camel.id).end();
    expect(a.unit(camel.id).alive).toBe(false);
    a.pass(1);
    expect(trek(a)).toBe(0);
  });

  it('Pack Camel Kick: 15 damage', () => {
    const a = arena({ p0: [['companion.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'companion.nomad').end().pass(1);
    a.use(minions(a, 0, 'pack_camel')[0]!.id, 'pack_camel_kick', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Tent Stake: 20 damage; the target loses all mobility buffs and is Immobile', () => {
    const a = arena({ p0: [['bolt.nomad']], p1: [['shot', 'maneuver']], passives: TREK });
    a.give(B1, 'swiftness').give(B1, 'rushing').give(B1, 'leaping').use(A1, 'bolt.nomad', B1).end();
    expect([a.hp(B1), mobility(a, B1)]).toEqual([80, 0]);
    expect(evaluateNamedCondition(content, a.state, 'immobile', B1)).toBe(true);
  });

  it('Tent Stake: for 2 turns the target can\'t gain mobility buffs; then it ends', () => {
    const a = arena({ p0: [['bolt.nomad']], p1: [['shot', 'maneuver'], ['bless.wind']], passives: TREK });
    a.use(A1, 'bolt.nomad', B1).end().use(B2, 'bless.wind', B1).end();
    expect([a.stacks(B1, 'swiftness'), evaluateNamedCondition(content, a.state, 'immobile', B1)]).toEqual([0, true]);
    a.pass(2);
    expect([a.has(B1, 'tent_stake'), evaluateNamedCondition(content, a.state, 'immobile', B1)]).toEqual([false, false]);
  });

  it('Dust Devil: 20 to all enemies; each loses only 1 mobility buff; +1 Trek per buff removed', () => {
    const a = arena({ p0: [['blast.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.give(B1, 'swiftness').give(B1, 'leaping').use(A1, 'blast.nomad').end();
    expect([a.hp(B1), a.hp(B2), mobility(a, B1)]).toEqual([80, 80, 1]);
    expect(trek(a)).toBe(2); // 1 removed + the turn's rise
  });

  it('Dust Devil: 2 buffs removed (one per enemy) give 2 Trek', () => {
    const a = arena({ p0: [['blast.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.give(B1, 'swiftness').give(B2, 'rushing').use(A1, 'blast.nomad').end();
    expect([mobility(a, B1), mobility(a, B2), trek(a)]).toEqual([0, 0, 3]);
  });

  it('Road Toll: 10 damage; the target\'s first skill before the user\'s next turn costs 1 more random energy', () => {
    const a = arena({ p0: [['consume.nomad']], p1: [['withstand', 'shot']], passives: TREK });
    a.use(A1, 'consume.nomad', B1).end();
    expect([a.hp(B1), a.has(B1, 'road_toll')]).toEqual([90, true]);
    const before = energyTotal(a, 1);
    a.use(B1, 'withstand').end();
    expect(before - energyTotal(a, 1)).toBe(2); // r + 1
  });

  it('Road Toll: the user heals 20 when the toll is paid, once', () => {
    const a = arena({ p0: [['consume.nomad']], p1: [['withstand', 'shot']], passives: TREK });
    a.setHp(A1, 50).use(A1, 'consume.nomad', B1).end().use(B1, 'withstand').end();
    expect([a.hp(A1), a.has(B1, 'road_toll')]).toEqual([70, false]);
    a.pass(1);
    const before = energyTotal(a, 1);
    a.use(B1, 'shot', A1).end();
    expect([before - energyTotal(a, 1), a.hp(A1)]).toEqual([1, 55]); // full price, no heal
  });

  it('Road Toll: if they use no skill before the user\'s next turn, it lapses unpaid', () => {
    const a = arena({ p0: [['consume.nomad']], p1: [['withstand']], passives: TREK });
    a.setHp(A1, 50).use(A1, 'consume.nomad', B1).end().pass(1);
    expect([a.has(B1, 'road_toll'), a.hp(A1)]).toEqual([false, 50]);
  });

  it('Pack Mule: a 25 HP minion that lasts 3 turns', () => {
    const a = arena({ p0: [['summon.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'summon.nomad').end();
    const mule = minions(a, 0, 'pack_mule')[0]!;
    expect(mule.hp).toBe(25);
    a.pass(4);
    expect(a.unit(mule.id).alive).toBe(true);
    a.pass(1); // gone at the end of the enemy's third turn
    expect(a.unit(mule.id).alive).toBe(false);
  });

  it('Pack Mule: stores 1 unspent energy at the end of each owner turn, and returns it all when it leaves', () => {
    const a = arena({ p0: [['summon.nomad']], p1: [['withstand']], passives: TREK, richEnergy: false });
    a.state.players[0].energy = { S: 0, A: 0, I: 0, W: 6 } as never;
    a.use(A1, 'summon.nomad').end();
    const mule = minions(a, 0, 'pack_mule')[0]!;
    const seen = [energyTotal(a, 0)]; // 6 − 1 (cost) − 1 stored
    for (let i = 0; i < 5; i++) seen.push(a.pass(1) && energyTotal(a, 0));
    // our turns start with +1 (one character); each of our turn ends stores 1 (3 in all); the Mule leaves at
    // the end of the enemy's 3rd turn and gives all 3 back, before our next +1
    expect(seen).toEqual([4, 5, 4, 5, 4, 8]);
    expect(a.unit(mule.id).alive).toBe(false);
  });

  it('Pack Mule: killed early, it still returns what it stored (ruling)', () => {
    const a = arena({ p0: [['summon.nomad']], p1: [['shot']], passives: TREK, richEnergy: false });
    a.state.players[0].energy = { S: 0, A: 0, I: 0, W: 6 } as never;
    a.use(A1, 'summon.nomad').end();
    expect(energyTotal(a, 0)).toBe(4);
    const mule = minions(a, 0, 'pack_mule')[0]!;
    a.state.players[1].energy = { S: 5, A: 5, I: 5, W: 5 } as never;
    a.setHp(mule.id, 10).use(B1, 'shot', mule.id).end();
    expect(a.unit(mule.id).alive).toBe(false);
    expect(energyTotal(a, 0)).toBe(5 + 1); // 4 + 1 returned + 1 turn-start gain
  });

  it('The Long Road: 10 to all enemies at the end of the user\'s turn', () => {
    const a = arena({ p0: [['channel.nomad']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'channel.nomad').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
  });

  it('The Long Road: continues while the user\'s Trek keeps rising, up to 4 turns', () => {
    const a = arena({ p0: [['channel.nomad', 'withstand', 'maneuver', 'rage', 'stab']], p1: [['withstand'], ['withstand']], passives: TREK });
    const seen: number[] = [];
    a.use(A1, 'channel.nomad').end();
    seen.push(a.hp(B2));
    for (const s of ['withstand', 'maneuver', 'rage', 'stab']) {
      a.pass(1).use(A1, s, s === 'stab' ? B1 : undefined).end();
      seen.push(a.hp(B2));
    }
    expect(seen).toEqual([90, 80, 70, 60, 60]);
  });

  it('The Long Road: ends after a turn in which the user\'s Trek didn\'t rise', () => {
    const a = arena({ p0: [['channel.nomad']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'channel.nomad').end().pass(2); // idle turn: it still ticks at that turn's end, then ends
    expect(a.hp(B2)).toBe(80);
    a.pass(4);
    expect(a.hp(B2)).toBe(80);
  });

  it('Traveler\'s Knife: 10, then 15 if used again on the user\'s next turn, then 20, and no more', () => {
    const a = arena({ p0: [['stab.nomad']], p1: [['withstand']], passives: TREK });
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const hp = a.hp(B1);
      a.use(A1, 'stab.nomad', B1).end().pass(1);
      seen.push(hp - a.hp(B1));
    }
    expect(seen).toEqual([10, 15, 20, 20]);
  });

  it('Traveler\'s Knife: a turn without it starts over at 10; Trek and low HP don\'t matter', () => {
    const a = arena({ p0: [['stab.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'stab.nomad', B1).end().pass(1).use(A1, 'stab.nomad', B1).end().pass(1);
    a.use(A1, 'shot', B1).end().pass(1);
    a.setHp(B1, 50).give(A1, 'trek', { stacks: 3 }).use(A1, 'stab.nomad', B1).end();
    expect(a.hp(B1)).toBe(40);
    const b = arena({ p0: [['stab.nomad']], p1: [['withstand']], passives: TREK });
    b.use(A1, 'stab.nomad', B1).end().pass(3).use(A1, 'stab.nomad', B1).end();
    expect(b.hp(B1)).toBe(80); // 10 + 10: an idle turn broke the streak
  });

  it('Traveler\'s Knife: digging in breaks the user\'s stride — repeating it resets Trek', () => {
    const a = arena({ p0: [['stab.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'stab.nomad', B1).end().pass(1);
    expect(trek(a)).toBe(2);
    a.use(A1, 'stab.nomad', B1).end();
    expect(trek(a)).toBe(0);
  });

  it('Scour: gives up every mobility buff, then 25 Piercing +10 per buff given up', () => {
    const a = arena({ p0: [['ravage.nomad']], p1: [['shot']], passives: TREK });
    a.give(A1, 'swiftness').give(A1, 'leaping').give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.nomad', B1).end();
    expect([a.hp(B1), mobility(a, A1)]).toEqual([55, 0]);
  });

  it('Scour: no buffs, plain 25 Piercing', () => {
    const a = arena({ p0: [['ravage.nomad']], p1: [['shot']], passives: TREK });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.nomad', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Mirage: invisible; the enemy\'s Harmful skills alternate countered / lands / countered', () => {
    const a = arena({ p0: [['mislead.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'mislead.nomad', B1).end();
    expect([seen(a, 0, B1, 'mirage'), seen(a, 1, B1, 'mirage')]).toEqual([true, false]);
    const hp: number[] = [];
    for (let i = 0; i < 3; i++) {
      a.use(B1, 'shot', A1).end();
      hp.push(a.hp(A1));
      a.pass(1);
    }
    expect(hp).toEqual([100, 85, 85]);
  });

  it('Mirage: Helpful skills don\'t advance the flicker', () => {
    const a = arena({ p0: [['mislead.nomad']], p1: [['shot', 'withstand']], passives: TREK });
    a.use(A1, 'mislead.nomad', B1).end().use(B1, 'withstand').end().pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Mirage: ends after 4 turns', () => {
    const a = arena({ p0: [['mislead.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'mislead.nomad', B1).end().pass(8).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Grit in the Eyes: 10 damage and Stunned for 2 turns', () => {
    const a = arena({ p0: [['stun.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'stun.nomad', B1).end();
    expect(a.hp(B1)).toBe(90);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.has(B1, 'grit_in_the_eyes')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Grit in the Eyes: a 3-turn cooldown, so it can\'t be chained into a lock', () => {
    const a = arena({ p0: [['stun.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'stun.nomad', B1).end();
    expect(a.cooldown(A1, 'stun.nomad')).toBe(3);
  });


  it('Grit in the Eyes: it washes out as soon as an enemy damages the user', () => {
    const a = arena({ p0: [['stun.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.use(A1, 'stun.nomad', B1).end().use(B2, 'shot', A1).end();
    expect(a.has(B1, 'grit_in_the_eyes')).toBe(false);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70);
  });

  it('Endless Journey: for 3 turns, idle turns and repeats don\'t reset Trek (it can still rise)', () => {
    const a = arena({ p0: [['dance.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'dance.nomad').end();
    expect(trek(a)).toBe(2);
    a.pass(2); // idle turn
    expect(trek(a)).toBe(2);
    const b = arena({ p0: [['dance.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    b.use(A1, 'dance.nomad').end().pass(1).use(A1, 'shot', B1).end(); // a different skill: rises
    expect(trek(b)).toBe(2);
    b.pass(1).use(A1, 'shot', B1).end(); // a repeat, still within the 3 turns
    expect([b.has(A1, 'endless_journey'), trek(b)]).toEqual([true, 2]);
  });

  it('Endless Journey: after 3 turns, resets work again', () => {
    const a = arena({ p0: [['dance.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'dance.nomad').end().pass(6);
    expect(a.has(A1, 'endless_journey')).toBe(false);
    a.pass(2);
    expect(trek(a)).toBe(0);
  });

  it('Endless Journey: at 3 Trek, skills cost 1 less; below 3, full price', () => {
    const a = arena({ p0: [['dance.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'dance.nomad').end().pass(1);
    expect(trek(a)).toBe(1);
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(1);
    const b = arena({ p0: [['dance.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    b.give(A1, 'trek', { stacks: 2 }).use(A1, 'dance.nomad').end().pass(1);
    expect(trek(b)).toBe(3);
    b.use(A1, 'shot', B1);
    expect(b.state.players[0].queue[0]?.cost.r).toBe(0);
  });

  it('Waterskin: 15 at once, then 10 at the end of each of the ally\'s next 2 turns in which they use a skill', () => {
    const a = arena({ p0: [['heal.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A2, 50).use(A1, 'heal.nomad', A2).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(65); // the turn it's given doesn't count
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(75);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(85);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(85); // over after 2 turns
  });

  it('Waterskin: a turn in which the ally uses no skill gives nothing (and still counts)', () => {
    const a = arena({ p0: [['heal.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A2, 50).use(A1, 'heal.nomad', A2).end().pass(2);
    expect(a.hp(A2)).toBe(65);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(75);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(75);
  });

  it('Cairn Blessing: 1 Might for 3 turns; each mobility skill used meanwhile makes a Boulder for the user', () => {
    const a = arena({ p0: [['bless.nomad'], ['maneuver', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'bless.nomad', A2).use(A2, 'shot', B1).end();
    expect([a.stacks(A2, 'might'), a.hp(B1), minions(a, 0, 'boulder').length]).toEqual([1, 80, 0]); // a non-mobility skill: no Boulder
    a.pass(1).use(A2, 'maneuver').end();
    const boulders = minions(a, 0, 'boulder');
    expect(boulders).toHaveLength(1);
    expect(boulders[0]!.summonedBy).toBe(A1);
    a.pass(6);
    expect(a.has(A2, 'might')).toBe(false);
  });

  it('Dust in the Wind: 1 Confusion for 2 turns without a Boulder; no Leap', () => {
    const a = arena({ p0: [['curse.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'curse.nomad', B1).end();
    expect([a.stacks(B1, 'confusion'), a.has(A1, 'leaping')]).toEqual([1, false]);
    a.pass(4);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Dust in the Wind: with an allied Boulder, it crumbles: +1 Confusion and the user Leaps', () => {
    const a = arena({ p0: [['curse.nomad'], ['charge.earth']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A2, 'charge.earth', B2).end().pass(1);
    expect(minions(a, 0, 'boulder')).toHaveLength(1);
    a.use(A1, 'curse.nomad', B1).end();
    expect([a.stacks(B1, 'confusion'), a.has(A1, 'leaping'), minions(a, 0, 'boulder').length]).toEqual([2, true, 0]);
  });

  it('Waymarker: 20; allies who damage the target heal 10', () => {
    const a = arena({ p0: [['smite.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A2, 50).use(A1, 'smite.nomad', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([65, 60]);
  });

  it('Waymarker: ends when the user\'s Trek resets', () => {
    const a = arena({ p0: [['smite.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A2, 50).use(A1, 'smite.nomad', B1).end().pass(1);
    a.use(A2, 'shot', B1).end(); // A1 idle this turn: Trek resets at the end, but A2's hit came first
    expect(a.hp(A2)).toBe(60);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(60);
    expect(a.has(B1, 'waymarker')).toBe(false);
  });

  it('Waymarker: enemies of the user who damage the target don\'t heal', () => {
    const a = arena({ p0: [['smite.nomad']], p1: [['withstand'], ['shot']], passives: TREK });
    a.setHp(B2, 50).use(A1, 'smite.nomad', B1).end();
    expect(a.hp(B2)).toBe(50);
  });

  it('Campfire Song: all allies heal 15 and gain 10 Shield for 1 turn; with no Trek, no bonus', () => {
    const a = arena({ p0: [['prayer.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.nomad').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([65, 65]);
    expect(a.effects(A2).find((e) => e.defId === 'shield')?.value).toBe(10);
    a.pass(2);
    expect(a.has(A2, 'shield')).toBe(false);
  });

  it('Campfire Song: the Trek resets and allies heal 10 more per Trek it had', () => {
    const a = arena({ p0: [['prayer.nomad'], ['shot']], p1: [['withstand']], passives: TREK });
    a.setHp(A1, 30).setHp(A2, 30).give(A1, 'trek', { stacks: 2 }).use(A1, 'prayer.nomad').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([65, 65]); // 15 + 20
    expect(trek(a)).toBeLessThan(2);
  });

  it('Sweeping Sands: 20 to the target, and a random other enemy is buried — no damage to them yet', () => {
    const a = arena({ p0: [['cleave.nomad']], p1: [['withstand'], ['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'cleave.nomad', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([80, 100, 100]);
    expect(a.has(B1, 'buried_in_sand')).toBe(false);
    expect([a.has(B2, 'buried_in_sand'), a.has('p1c2', 'buried_in_sand')].filter(Boolean)).toHaveLength(1);
  });

  it('Sweeping Sands: the next time the user\'s Trek resets, the sand collapses on the buried enemy for 30', () => {
    const a = arena({ p0: [['cleave.nomad', 'shot']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'cleave.nomad', B1).end(); // Trek rises: no collapse
    expect([a.hp(B2), trek(a)]).toEqual([100, 1]);
    a.pass(1).use(A1, 'shot', B1).end(); // a different skill: Trek rises again, still buried
    expect([a.hp(B2), a.has(B2, 'buried_in_sand')]).toEqual([100, true]);
    a.pass(1).use(A1, 'shot', B1).end(); // the same skill again: Trek resets, and the sand falls
    expect([trek(a), a.hp(B2), a.has(B2, 'buried_in_sand')]).toEqual([0, 70, false]);
  });

  it('Sweeping Sands: a turn with no skill resets the Trek too, and collapses the sand', () => {
    const a = arena({ p0: [['cleave.nomad']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'cleave.nomad', B1).end().pass(2);
    expect(a.hp(B2)).toBe(70);
  });

  it('Sweeping Sands: if the Trek never resets within 3 turns, the sand never falls', () => {
    const a = arena({ p0: [['cleave.nomad', 'shot', 'stab', 'strike']], p1: [['withstand'], ['withstand']], passives: TREK });
    a.use(A1, 'cleave.nomad', B1).end();
    for (const s of ['shot', 'stab', 'strike']) a.pass(1).use(A1, s, B1).end();
    expect(a.has(B2, 'buried_in_sand')).toBe(false);
    a.pass(1).end(); // a reset now finds no sand
    expect(a.hp(B2)).toBe(100);
  });

  it('Call of the Caravan: for 2 turns, every enemy deals 10 less direct damage to a target with Trek', () => {
    const a = arena({ p0: [['shout.nomad', 'shot'], ['withstand']], p1: [['shot'], ['shot']], passives: TREK });
    a.use(A1, 'shout.nomad').end(); // the user's Trek rises to 1
    expect([a.has(B1, 'caravan_dust'), a.has(B2, 'caravan_dust')]).toEqual([true, true]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    // A1 is on the move (Trek), A2 isn't.
    expect([a.hp(A1), a.hp(A2)]).toEqual([100 - 5, 100 - 15]);
    a.use(A1, 'shot', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95 - 5); // still in the dust on their 2nd turn
    a.end(); // the user's 3rd turn
    a.give(A1, 'trek').use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90 - 15); // the dust has settled
  });

  it('Call of the Caravan: a mobility buff or anyone else\'s Trek counts as on the move too', () => {
    const a = arena({ p0: [['shout.nomad'], ['withstand'], ['withstand']], p1: [['shot'], ['shot']], passives: TREK });
    a.give(A2, 'swiftness').give('p0c2', 'trek').use(A1, 'shout.nomad').end();
    a.use(B1, 'shot', A2).use(B2, 'shot', 'p0c2').end();
    expect([a.hp(A2), a.hp('p0c2')]).toEqual([95, 95]);
  });

  it('Call of the Caravan: once the user\'s Trek resets, they\'re no longer spared', () => {
    const a = arena({ p0: [['shout.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'shout.nomad').end().pass(1).pass(1); // an idle turn resets the Trek
    expect(trek(a)).toBe(0);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Rolling Dune: 15 Shield when the user\'s Trek doesn\'t rise', () => {
    const a = arena({ p0: [['withstand.nomad']], p1: [['withstand']], passives: TREK });
    // As if the user had used this same slot on their last turn: a repeat, so the Trek resets instead.
    Object.assign(a.unit(A1).counters, { 'c:trek_prev_slot': 0, 'c:trek_started': 1 });
    a.use(A1, 'withstand.nomad').end();
    expect([trek(a), a.effects(A1).find((e) => e.defId === 'rolling_dune')?.value]).toEqual([0, 15]);
  });

  it('Rolling Dune: it grows by 10 each time the user\'s Trek rises', () => {
    const shield = (a: Arena) => a.effects(A1).find((e) => e.defId === 'rolling_dune')?.value ?? 0;
    const a = arena({ p0: [['withstand.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'withstand.nomad').end(); // Trek rises at the turn's end
    expect(shield(a)).toBe(25);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(shield(a)).toBe(35);
  });

  it('Rolling Dune: no growth when the Trek resets; it lasts 2 turns', () => {
    const shield = (a: Arena) => a.effects(A1).find((e) => e.defId === 'rolling_dune')?.value ?? 0;
    const a = arena({ p0: [['withstand.nomad', 'shot']], p1: [['shot']], passives: TREK });
    a.use(A1, 'withstand.nomad').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), shield(a)]).toEqual([100, 10]); // 25 − 15
    a.pass(1); // idle: Trek resets
    expect(shield(a)).toBe(10);
    a.pass(1);
    expect(a.has(A1, 'rolling_dune')).toBe(false);
  });

  it('Challenge in the Sand: Taunts the target to the user for up to 2 turns', () => {
    const a = arena({ p0: [['taunt.nomad'], ['shot']], p1: [['shot', 'withstand']], passives: TREK });
    a.use(A1, 'taunt.nomad', B1).end();
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(A1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'withstand').end().pass(1);
    expect(a.has(B1, 'taunt')).toBe(true); // still on during the enemy's 2nd turn
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Challenge in the Sand: the first time the target damages the user, the Taunt ends and the user Leaps', () => {
    const a = arena({ p0: [['taunt.nomad']], p1: [['shot']], passives: TREK });
    a.use(A1, 'taunt.nomad', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'taunt'), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([85, false, true, true]);
  });

  it('Challenge in the Sand: another enemy\'s hit doesn\'t end it', () => {
    const a = arena({ p0: [['taunt.nomad']], p1: [['shot'], ['shot']], passives: TREK });
    a.use(A1, 'taunt.nomad', B1).end().use(B2, 'shot', A1).end();
    expect([a.has(B1, 'taunt'), a.has(A1, 'leaping')]).toEqual([true, false]);
  });

  it('Colossus of the Dunes: 3 Armor and Immune; loses mobility buffs', () => {
    const a = arena({ p0: [['titan.nomad']], p1: [['curse']], passives: TREK });
    a.give(A1, 'swiftness').give(A1, 'rushing').use(A1, 'titan.nomad').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), mobility(a, A1)]).toEqual([3, true, 0]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Colossus of the Dunes: Trek is frozen — neither rises nor resets', () => {
    const a = arena({ p0: [['titan.nomad', 'shot']], p1: [['withstand']], passives: TREK });
    a.give(A1, 'trek', { stacks: 2 }).use(A1, 'titan.nomad').end();
    expect(trek(a)).toBe(2);
    a.pass(2);
    expect(trek(a)).toBe(2);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(trek(a)).toBe(2);
  });

  it('Colossus of the Dunes: Immobile and can\'t gain mobility buffs', () => {
    const a = arena({ p0: [['titan.nomad', 'maneuver'], ['bless.wind']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'titan.nomad').end();
    expect(evaluateNamedCondition(content, a.state, 'immobile', A1)).toBe(true);
    a.pass(1).use(A2, 'bless.wind', A1).end();
    expect(a.stacks(A1, 'swiftness')).toBe(0);
  });

  it('Colossus of the Dunes: lasts 3 turns', () => {
    const a = arena({ p0: [['titan.nomad']], p1: [['withstand']], passives: TREK });
    a.use(A1, 'titan.nomad').end().pass(6);
    expect([a.has(A1, 'immune'), a.has(A1, 'armor')]).toEqual([false, false]);
  });
});

describe('Nomad costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Ar', 2], charge: ['nc', 1], riposte: ['r', 2], rage: ['W', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['I', 3], maneuver: ['r', 3], companion: ['W', 1],
    bolt: ['I', 1], blast: ['Ar', 2], consume: ['r', 2], summon: ['W', 1], channel: ['Ir', 3],
    stab: ['r', 0], ravage: ['Ar', 1], mislead: ['A', 2], stun: ['A', 3], dance: ['AW', 4],
    heal: ['A', 1], bless: ['W', 2], curse: ['W', 2], smite: ['W', 1], prayer: ['Wrr', 2],
    cleave: ['Ar', 1], shout: ['W', 3], withstand: ['r', 3], taunt: ['r', 3], titan: ['SW', 4],
  };
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(Object.entries(kit))('%s.nomad matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.nomad`]!;
    expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
  });
});
