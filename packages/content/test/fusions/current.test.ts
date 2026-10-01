// Spec-driven scenarios for Current (Water + Lightning): Soaked, conduct, the Conductor passive and all
// 30 variants. Sources: in-game descriptions, docs/rules.md §21.28, and the kit table in water-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor, type Cost, type GameEvent } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

/** Every Current character carries the Conductor passive. */
const COND = { p0c0: ['current_conductor'], p0c1: ['current_conductor'], p0c2: ['current_conductor'] };
const three = (s: string[] = ['shot']) => [s, ['shot'], ['shot']];

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

const soak = (a: Arena, ...ids: string[]) => {
  for (const id of ids) a.give(id, 'soaked', { source: A1 });
  return a;
};

function gained(events: readonly GameEvent[], player: 0 | 1): number {
  const e = [...events].reverse().find((x) => x.t === 'energyGained' && x.player === player);
  if (!e || e.t !== 'energyGained') throw new Error('no energyGained event');
  return Object.values(e.gained).reduce((x, y) => x + y, 0);
}

/** How many effects on `bearer` the opponent (player 2) can see. */
const seenByB = (a: Arena, bearer: string) =>
  viewFor(content, a.state, 1).effects.filter((e) => e.bearer === bearer).length;

describe('Current keywords', () => {
  it('Soaked is a Debuff that Immune blocks', () => {
    expect(content.statuses.soaked?.kind).toBe('Debuff');
    const a = arena({ p0: [['shot.current']], p1: three(), passives: COND });
    a.give(B1, 'immune').use(A1, 'shot.current', B1).end();
    expect(a.has(B1, 'soaked')).toBe(false);
  });

  it('Conductor: Current skills deal 5 more to Soaked units', () => {
    const a = arena({ p0: [['shot.current']], p1: three(), passives: COND });
    soak(a, B1).use(A1, 'shot.current', B1).end();
    expect(a.hp(B1)).toBe(85); // 10 + 5
  });

  it('Conductor: no bonus against units that are not Soaked', () => {
    const a = arena({ p0: [['shot.current']], p1: three(), passives: COND });
    a.use(A1, 'shot.current', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Conductor: non-Current skills get no bonus against Soaked units', () => {
    const a = arena({ p0: [['shot']], p1: three(), passives: COND });
    soak(a, B1, B2).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]); // no +5 and no conduct
  });

  it('conduct: a single-target Current hit on a Soaked unit hits every other Soaked unit on that side for the same amount', () => {
    const a = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    soak(a, B1, B2).use(A1, 'strike.current', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 100]);
  });

  it('conduct: a hit on an un-Soaked target does not conduct', () => {
    const a = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    soak(a, B2, B3).use(A1, 'strike.current', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 100, 100]);
  });

  it('conduct: skills that already hit everyone do not conduct', () => {
    const a = arena({ p0: [['blast.current']], p1: three(), passives: COND });
    soak(a, B1, B2, B3).use(A1, 'blast.current').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 80, 80]); // 15 + 5 each, nothing conducted
  });

  it('conduct: the conducted damage is indirect, so it does not conduct again', () => {
    const a = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    soak(a, B1, B2, B3).use(A1, 'strike.current', B1).end();
    // Each of B2 and B3 takes the 25 exactly once, not once per other Soaked unit.
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 75]);
  });

  it('Soaked "for 2 turns" lasts through the enemy\'s next 2 turns and then ends', () => {
    const a = arena({ p0: [['shot.current']], p1: three(), passives: COND });
    a.use(A1, 'shot.current', B1).end().pass(2);
    expect(a.has(B1, 'soaked')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'soaked')).toBe(false);
  });

  it('Soaked is unique: re-Soaking does not stack', () => {
    const a = arena({ p0: [['shot.current']], p1: three(), passives: COND });
    a.use(A1, 'shot.current', B1).end().pass(1).use(A1, 'shot.current', B1).end();
    expect(a.stacks(B1, 'soaked')).toBe(1);
  });
});

describe('Current skills', () => {
  it('Shock Palm: 20, then Soaked for 2 turns (the Soak comes after the hit)', () => {
    const a = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    a.use(A1, 'strike.current', B1).end();
    expect([a.hp(B1), a.has(B1, 'soaked'), a.stacks(A1, 'charged')]).toEqual([80, true, 0]);
  });

  it('Shock Palm: +1 Charge for each other enemy the hit conducts to', () => {
    const a = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    soak(a, B1, B2, B3).use(A1, 'strike.current', B1).end();
    expect(a.stacks(A1, 'charged')).toBe(2);
    const b = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    soak(b, B1, B3).use(A1, 'strike.current', B1).end();
    expect(b.stacks(A1, 'charged')).toBe(1);
  });

  it('Breakdown Surge: 25 / 15; each enemy with Shield or Armor takes 10 Affliction at the start of the user\'s next turn', () => {
    const a = arena({ p0: [['smash.current']], p1: three(), passives: COND });
    a.give(B2, 'armor', { stacks: 1 }).give(B3, 'shield', { value: 5 });
    a.use(A1, 'smash.current', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 90, 90]); // armor −5; shield soaks 5
    a.end(); // B's turn ends; A's turn starts
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 80, 80]);
    a.end().end();
    expect([a.hp(B2), a.hp(B3)]).toEqual([80, 80]); // only once
  });

  it('Rip Current: 15, 1 Focus, and the next skill Soaks its target before it hits', () => {
    const a = arena({ p0: [['charge.current', 'strike.current']], p1: three(), passives: COND });
    a.use(A1, 'charge.current', B1).end();
    expect([a.hp(B1), a.has(A1, 'focus'), a.has(B1, 'soaked')]).toEqual([85, true, false]);
    a.pass(1).use(A1, 'strike.current', B2).end();
    expect([a.hp(B2), a.has(B2, 'soaked')]).toEqual([75, true]); // Soaked first, so 20 + 5
  });

  it('Rip Current: only the next skill Soaks first', () => {
    const a = arena({ p0: [['charge.current', 'shot'], ['shot']], p1: three(), passives: COND });
    a.use(A1, 'charge.current', B1).end().pass(1);
    a.use(A1, 'shot', B2).end().pass(1);
    a.use(A1, 'shot', B3).end();
    expect([a.has(B2, 'soaked'), a.has(B3, 'soaked')]).toEqual([true, false]);
  });

  it('Still Water: counters every Harmful skill used on the user; its user is Soaked, then takes 15 which conducts', () => {
    const a = arena({ p0: [['riposte.current']], p1: three(), passives: COND });
    const seen = seenByB(a, A1);
    a.use(A1, 'riposte.current').end();
    expect(seenByB(a, A1)).toBe(seen); // Invisible
    soak(a, B3);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect([a.has(B1, 'soaked'), a.hp(B1), a.hp(B3), a.hp(B2)]).toEqual([true, 85, 85, 100]);
  });

  it('Still Water: counters more than one Harmful skill in its turn', () => {
    const a = arena({ p0: [['riposte.current']], p1: three(), passives: COND });
    a.use(A1, 'riposte.current').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect([a.has(B1, 'soaked'), a.has(B2, 'soaked')]).toEqual([true, true]);
  });

  it('Still Water: ends after 1 turn', () => {
    const a = arena({ p0: [['riposte.current']], p1: three(), passives: COND });
    a.use(A1, 'riposte.current').end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Galvanic Fury: 1 Might and Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.current']], p1: three(), passives: COND });
    a.use(A1, 'rage.current').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([1, true]);
    a.pass(6);
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('Galvanic Fury: the user\'s single-target hits also strike other Sapped enemies for the same amount', () => {
    const a = arena({ p0: [['rage.current', 'shot']], p1: three(), passives: COND });
    a.give(B2, 'sapped', { source: A1 });
    a.use(A1, 'rage.current').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 80, 100]); // 15 + 5 Might; B3 isn't Sapped
  });

  it('Spark Spray: 10 and Soaked; without Charge no other enemy is Soaked', () => {
    const a = arena({ p0: [['shot.current']], p1: three(), passives: COND });
    a.use(A1, 'shot.current', B1).end();
    expect([a.hp(B1), a.has(B1, 'soaked'), a.has(B2, 'soaked'), a.has(B3, 'soaked')]).toEqual([90, true, false, false]);
  });

  it('Spark Spray: if Charged, spends 1 Charge to Soak a random other enemy too', () => {
    const a = arena({ p0: [['shot.current']], p1: [['shot'], ['shot']], passives: COND });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'shot.current', B1).end();
    expect([a.has(B1, 'soaked'), a.has(B2, 'soaked'), a.stacks(A1, 'charged')]).toEqual([true, true, 1]);
  });

  it('Conductor\'s Lance: 40 on the following turn; conducts if Soaked, +1 Charge per other Soaked enemy, and their Soak stays', () => {
    const a = arena({ p0: [['snipe.current']], p1: three(), passives: COND });
    soak(a, B1, B2).use(A1, 'snipe.current', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([55, 55, 100]);
    expect([a.stacks(A1, 'charged'), a.has(B2, 'soaked')]).toEqual([1, true]);
  });

  it('Conductor\'s Lance: on an un-Soaked target it deals a plain 40', () => {
    const a = arena({ p0: [['snipe.current']], p1: three(), passives: COND });
    soak(a, B2).use(A1, 'snipe.current', B1).end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 100]);
  });

  // BUG: "they and every Soaked enemy take 15 ... each one hit is Sapped": the un-Soaked target is hit twice
  // (30 damage) and gains 2 Sapped.
  it.fails('Live Wire: the first Harmful skill the target uses hits them and every Soaked enemy for 15 and Saps each', () => {
    const a = arena({ p0: [['trap.current']], p1: three(), passives: COND });
    soak(a, B2);
    const seen = seenByB(a, B1);
    a.use(A1, 'trap.current', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([85, 85, 100]);
    expect([a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped'), a.stacks(B3, 'sapped')]).toEqual([1, 1, 0]);
  });

  it('Live Wire: fires only once, and not on Helpful skills', () => {
    const a = arena({ p0: [['trap.current']], p1: [['shot', 'heal'], ['shot'], ['shot']], passives: COND });
    a.use(A1, 'trap.current', B1).end();
    a.use(B1, 'heal', B2).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1).use(B1, 'shot', A1).end();
    const after = a.hp(B1);
    expect(after).toBeLessThan(100);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(after);
  });

  it('Submerge: Invulnerable for 1 turn; when it ends, each Soaked enemy takes 10 per Charge spent', () => {
    const a = arena({ p0: [['maneuver.current']], p1: three(), passives: COND });
    a.give(A1, 'charged', { stacks: 2 });
    soak(a, B1, B3).use(A1, 'maneuver.current').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.stacks(A1, 'charged')]).toEqual([80, 100, 80, 0]);
  });

  it('Submerge: with no Charge nobody takes damage', () => {
    const a = arena({ p0: [['maneuver.current']], p1: three(), passives: COND });
    soak(a, B1).use(A1, 'maneuver.current').end().end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Electric Eel: a permanent 30 HP Eel; Eel Shock deals 10 and Soaks', () => {
    const a = arena({ p0: [['companion.current']], p1: three(), passives: COND });
    a.use(A1, 'companion.current').end();
    const eel = minions(a, 0, 'electric_eel')[0]!;
    expect(eel.hp).toBe(30);
    a.pass(1).use(eel.id, 'electric_eel_shock', B1).end();
    expect([a.hp(B1), a.has(B1, 'soaked')]).toEqual([90, true]);
    a.pass(20);
    expect(a.unit(eel.id).alive).toBe(true);
  });

  it('Electric Eel: Static Coil gives the ally 1 Charge per Soaked enemy', () => {
    const a = arena({ p0: [['companion.current'], ['shot']], p1: three(), passives: COND });
    a.use(A1, 'companion.current').end().pass(1);
    const eel = minions(a, 0, 'electric_eel')[0]!;
    soak(a, B1, B3).use(eel.id, 'electric_eel_static_coil', A2).end();
    expect(a.stacks(A2, 'charged')).toBe(2);
  });

  it('Electric Eel: Static Coil gives at most 3 Charge', () => {
    const a = arena({ p0: [['companion.current'], ['shot']], p1: three(), passives: COND });
    a.use(A1, 'companion.current').end().pass(1);
    const eel = minions(a, 0, 'electric_eel')[0]!;
    soak(a, B1, B2, B3);
    a.give(B1, 'soaked', { source: A1 });
    a.use(eel.id, 'electric_eel_static_coil', A2).end();
    expect(a.stacks(A2, 'charged')).toBe(3);
  });

  it('Galvanic Bolt: Soaks the target, then 20 (+5), and every enemy it conducts to is Sapped', () => {
    const a = arena({ p0: [['bolt.current']], p1: three(), passives: COND });
    soak(a, B2).use(A1, 'bolt.current', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 100]);
    expect([a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped'), a.stacks(B3, 'sapped')]).toEqual([0, 1, 0]);
  });

  it('Deluge of Sparks: 15 to all, who are Soaked; the user\'s next skill costs 1 less', () => {
    const a = arena({ p0: [['blast.current', 'smash.current', 'consume.current']], p1: three(), passives: COND });
    a.use(A1, 'blast.current').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([85, 85, 85]);
    expect([B1, B2, B3].every((b) => a.has(b, 'soaked'))).toBe(true);
    a.pass(1).use(A1, 'smash.current', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
    a.end().pass(1).use(A1, 'consume.current', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(1); // only the next skill
  });

  it('Ebb Siphon: 5 damage, and the user heals 10 per Sapped on the target', () => {
    const a = arena({ p0: [['consume.current']], p1: three(), passives: COND });
    a.setHp(A1, 50).give(B1, 'sapped', { stacks: 2, source: A1 }).use(A1, 'consume.current', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 70]);
  });

  it('Ebb Siphon: no Sapped, no healing; the healing is capped at 30', () => {
    const a = arena({ p0: [['consume.current']], p1: three(), passives: COND });
    a.setHp(A1, 50).use(A1, 'consume.current', B1).end();
    expect(a.hp(A1)).toBe(50);
    const b = arena({ p0: [['consume.current']], p1: three(), passives: COND });
    b.setHp(A1, 20).give(B1, 'sapped', { stacks: 3, source: A1 });
    b.give(B1, 'sapped', { stacks: 1, source: A1 });
    b.use(A1, 'consume.current', B1).end();
    expect(b.hp(A1)).toBe(50);
  });

  it('Galvanic Elemental: 20 HP for 3 turns; Static Lash deals 10, Soaks, and can\'t be countered', () => {
    const a = arena({ p0: [['summon.current']], p1: [['riposte'], ['shot'], ['shot']], passives: COND });
    a.use(A1, 'summon.current').end();
    const el = minions(a, 0, 'galvanic_elemental')[0]!;
    expect(el.hp).toBe(20);
    a.use(B1, 'riposte').end();
    a.use(el.id, 'galvanic_elemental_static_lash', B1).end();
    expect([a.hp(B1), a.has(B1, 'soaked'), a.unit(el.id).hp]).toEqual([90, true, 20]);
  });

  it('Galvanic Elemental: leaves after 3 turns', () => {
    const a = arena({ p0: [['summon.current']], p1: three(), passives: COND });
    a.use(A1, 'summon.current').end().pass(4);
    expect(minions(a, 0, 'galvanic_elemental')).toHaveLength(1);
    a.pass(2);
    expect(minions(a, 0, 'galvanic_elemental')).toHaveLength(0);
  });

  it('Galvanic Elemental: when it dies, every Soaked enemy takes 15', () => {
    const a = arena({ p0: [['summon.current']], p1: three(), passives: COND });
    a.use(A1, 'summon.current').end();
    const el = minions(a, 0, 'galvanic_elemental')[0]!;
    a.setHp(el.id, 5);
    soak(a, B2, B3).use(B1, 'shot', el.id).end();
    expect(a.unit(el.id).alive).toBe(false);
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([100, 85, 85]);
  });

  it('Electric Rain: each of the user\'s turns, Soaks a random enemy, then 10 to a random Soaked enemy', () => {
    const a = arena({ p0: [['channel.current']], p1: [['shot']], passives: COND });
    a.use(A1, 'channel.current').end();
    expect([a.has(B1, 'soaked'), a.hp(B1)]).toEqual([true, 90]);
  });

  it('Electric Rain: the tick conducts to every other Soaked enemy', () => {
    const a = arena({ p0: [['channel.current']], p1: [['shot'], ['shot']], passives: COND });
    soak(a, B1, B2).use(A1, 'channel.current').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
  });

  it('Electric Rain: lasts up to 4 of the user\'s turns', () => {
    const a = arena({ p0: [['channel.current']], p1: [['shot']], passives: COND });
    a.use(A1, 'channel.current').end().pass(7);
    expect(a.hp(B1)).toBe(60);
    a.pass(2);
    expect(a.hp(B1)).toBe(60);
  });

  it('Static Shiv: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.current']], p1: three(), passives: COND });
    a.use(A1, 'stab.current', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
    a.setHp(B1, 60).use(A1, 'stab.current', B1).end();
    expect(a.hp(B1)).toBe(40);
  });

  it('Static Shiv: for 1 turn, +1 Charge each time an enemy skill targets the user', () => {
    const a = arena({ p0: [['stab.current']], p1: three(), passives: COND });
    a.use(A1, 'stab.current', B1).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'charged')).toBe(2);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'charged')).toBe(2); // expired
  });

  it('Riptide Pike: 25 Piercing; spends up to 3 Renew, each cutting the user\'s other cooldowns by 1', () => {
    const a = arena({ p0: [['ravage.current', 'titan.current']], p1: three(), passives: COND });
    a.use(A1, 'titan.current').end().pass(1);
    const cd = a.cooldown(A1, 'titan.current');
    a.give(B1, 'armor', { stacks: 2 }).give(A1, 'renew', { stacks: 2, source: B1 });
    a.use(A1, 'ravage.current', B1).end();
    expect(a.hp(B1)).toBe(75); // Armor doesn't reduce Piercing
    expect(a.stacks(A1, 'renew')).toBe(0);
    expect(a.cooldown(A1, 'titan.current')).toBe(cd - 2 - 1); // −2 from Renew, −1 end of turn
    expect(a.cooldown(A1, 'ravage.current')).toBe(1);
    const b = arena({ p0: [['ravage.current', 'titan.current']], p1: three(), passives: COND });
    b.use(A1, 'titan.current').end().pass(1).use(A1, 'ravage.current', B1).end();
    expect(b.cooldown(A1, 'titan.current')).toBe(cd - 1); // no Renew, no cut
  });

  it('Riptide Pike: spends at most 3 Renew', () => {
    const a = arena({ p0: [['ravage.current', 'dance']], p1: three(), passives: COND });
    a.use(A1, 'dance').end().pass(1);
    const cd = a.cooldown(A1, 'dance');
    a.give(A1, 'renew', { stacks: 5, source: B1 }).use(A1, 'ravage.current', B1).end();
    expect(a.stacks(A1, 'renew')).toBe(2);
    expect(a.cooldown(A1, 'dance')).toBe(cd - 3 - 1);
  });

  it('Grounding: counters the target\'s Harmful skill and turns each Confusion into 1 Sapped', () => {
    const a = arena({ p0: [['mislead.current']], p1: three(), passives: COND });
    a.give(B1, 'confusion', { stacks: 2, source: A1 });
    const seen = seenByB(a, B1);
    a.use(A1, 'mislead.current', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'confusion'), a.stacks(B1, 'sapped')]).toEqual([100, 0, 2]);
  });

  it('Grounding: Helpful skills are not countered', () => {
    const a = arena({ p0: [['mislead.current']], p1: [['heal'], ['shot'], ['shot']], passives: COND });
    a.setHp(B2, 50).give(B1, 'confusion', { stacks: 1, source: A1 }).use(A1, 'mislead.current', B1).end();
    a.use(B1, 'heal', B2).end();
    expect([a.hp(B2), a.stacks(B1, 'sapped')]).toEqual([75, 0]);
  });

  it('Electric Undertow: 15 and a Stun; every other Soaked enemy has their non-Strategic skills stunned', () => {
    const a = arena({ p0: [['stun.current']], p1: [['shot', 'curse'], ['shot', 'curse'], ['shot']], passives: COND });
    soak(a, B2).use(A1, 'stun.current', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), a.has(B2, 'stun_ns'), a.has(B3, 'stun_ns')]).toEqual([85, true, true, false]);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
    a.use(B2, 'curse', A1).end(); // Strategic skills still work
    expect(a.has(A1, 'confusion')).toBe(true);
  });

  it('River of Lightning: Stormborn and 1 Swiftness for 4 turns', () => {
    const a = arena({ p0: [['dance.current']], p1: three(), passives: COND });
    a.use(A1, 'dance.current').end();
    expect([a.has(A1, 'stormborn'), a.stacks(A1, 'swiftness')]).toEqual([true, 1]);
    a.pass(8);
    expect([a.has(A1, 'stormborn'), a.stacks(A1, 'swiftness')]).toEqual([false, 0]);
  });

  it('River of Lightning: each Charge the user gains brings 2 Renew', () => {
    const a = arena({ p0: [['dance.current']], p1: three(), passives: COND });
    a.use(A1, 'dance.current').end();
    a.use(B1, 'shot', A1).end(); // Stormborn: +1 Charge on being hit
    expect([a.stacks(A1, 'charged'), a.stacks(A1, 'renew')]).toEqual([1, 2]);
  });

  it('Still Spring: heals 20 and 2 Renew, which ticks for 10 on each of the 2 turns', () => {
    const a = arena({ p0: [['heal.current'], ['shot']], p1: three(), passives: COND });
    a.setHp(A2, 40).use(A1, 'heal.current', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([70, 2]); // 20 + 2×5, no stack lost
    a.pass(2);
    expect(a.hp(A2)).toBe(80);
  });

  // BUG: "for 2 turns, their Renew heals without losing stacks": after the 2nd protected tick only 1 Renew is
  // left (the added-back stack is a separate instance, and both instances lose a stack on that tick).
  it.fails('Still Spring: still 2 Renew after both protected turns, then it decays normally', () => {
    const a = arena({ p0: [['heal.current'], ['shot']], p1: three(), passives: COND });
    a.setHp(A2, 40).use(A1, 'heal.current', A2).end().pass(2);
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([80, 2]);
    a.pass(2);
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([90, 1]);
  });

  it('Overflow: for 3 turns the ally\'s single-target skills deal 5 more to Soaked enemies and conduct', () => {
    const a = arena({ p0: [['bless.current'], ['shot']], p1: three(), passives: COND });
    soak(a, B1, B2).use(A1, 'bless.current', A2).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 80, 100]);
  });

  it('Overflow: an ally without it gets no bonus and no conduct', () => {
    const a = arena({ p0: [['bless.current'], ['shot'], ['shot']], p1: three(), passives: COND });
    soak(a, B1, B2).use(A1, 'bless.current', A2).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Overflow: wears off after 3 turns', () => {
    const a = arena({ p0: [['bless.current'], ['shot']], p1: three(), passives: COND });
    a.use(A1, 'bless.current', A2).end().pass(5);
    soak(a, B1, B2).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Waterlogged: Soaked and 1 Confusion; each conducted hit that reaches them adds 1 more, up to 3', () => {
    const a = arena({
      p0: [['strike.current'], ['curse.current', 'strike.current'], ['bolt.current']],
      p1: three(),
      passives: COND,
    });
    soak(a, B1);
    a.use(A2, 'curse.current', B2).end();
    expect([a.has(B2, 'soaked'), a.stacks(B2, 'confusion')]).toEqual([true, 1]);
    a.pass(1).use(A1, 'strike.current', B1).use(A3, 'bolt.current', B1).end();
    expect(a.stacks(B2, 'confusion')).toBe(3);
  });

  it('Waterlogged: at most 3 Confusion', () => {
    const a = arena({
      p0: [['strike.current'], ['curse.current', 'strike.current'], ['bolt.current']],
      p1: three(),
      passives: COND,
    });
    soak(a, B1);
    a.use(A2, 'curse.current', B2).end().pass(1);
    a.use(A1, 'strike.current', B1).use(A2, 'strike.current', B1).use(A3, 'bolt.current', B1).end();
    expect(a.stacks(B2, 'confusion')).toBe(3); // three conducted hits on top of the first 1, capped
  });

  it('Waterlogged: conducted hits on Soaked enemies that aren\'t Waterlogged give no Confusion', () => {
    const a = arena({ p0: [['strike.current']], p1: three(), passives: COND });
    soak(a, B1, B2).use(A1, 'strike.current', B1).end();
    expect(a.stacks(B2, 'confusion')).toBe(0);
  });

  it('Closed Circuit: 20; for 1 turn, each time an ally damages the target, every ally heals 10', () => {
    const a = arena({ p0: [['smite.current'], ['shot'], ['shot']], p1: three(), passives: COND });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'smite.current', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(50);
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([70, 70, 70]);
  });

  it('Closed Circuit: its own hit doesn\'t trigger the healing, and it ends after 1 turn', () => {
    const a = arena({ p0: [['smite.current'], ['shot']], p1: three(), passives: COND });
    a.setHp(A1, 50).use(A1, 'smite.current', B1).end();
    expect(a.hp(A1)).toBe(50);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A1)).toBe(50);
  });

  it('Swelling Current: all allies heal 10, then 20 and 30 at the start of the user\'s next 2 turns', () => {
    const a = arena({ p0: [['prayer.current'], ['shot']], p1: three(), passives: COND });
    a.setHp(A1, 30).setHp(A2, 30).use(A1, 'prayer.current').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([40, 40]);
    a.end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([60, 60]);
    a.pass(2);
    expect([a.hp(A1), a.hp(A2)]).toEqual([90, 90]);
    a.setHp(A2, 50).pass(2);
    expect(a.hp(A2)).toBe(50); // only 2 repeats
  });

  it('Swelling Current: stops once the user takes damage', () => {
    const a = arena({ p0: [['prayer.current'], ['shot']], p1: three(), passives: COND });
    a.setHp(A1, 30).setHp(A2, 30).use(A1, 'prayer.current').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([25, 40]);
  });

  it('Arc Lash: 25 to the target and 15 (+5) to another Soaked enemy; both are Soaked', () => {
    const a = arena({ p0: [['cleave.current']], p1: three(), passives: COND });
    soak(a, B3).use(A1, 'cleave.current', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 100, 80]);
    expect([a.has(B1, 'soaked'), a.has(B3, 'soaked')]).toEqual([true, true]);
  });

  it('Arc Lash: with no other Soaked enemy, the 15 goes to a random other enemy', () => {
    const a = arena({ p0: [['cleave.current']], p1: three(), passives: COND });
    a.use(A1, 'cleave.current', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 85]);
  });

  it('Arc Lash: its Soak lasts 1 turn', () => {
    const a = arena({ p0: [['cleave.current']], p1: [['shot']], passives: COND });
    a.use(A1, 'cleave.current', B1).end();
    expect(a.has(B1, 'soaked')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'soaked')).toBe(false);
  });

  it('Sounding Call: all enemies Soaked and Intimidated for 1 turn per Sapped (at least 1)', () => {
    const a = arena({ p0: [['shout.current']], p1: three(), passives: COND });
    a.give(B1, 'sapped', { stacks: 2, source: A1 }).use(A1, 'shout.current').end();
    expect([B1, B2, B3].map((b) => a.has(b, 'soaked'))).toEqual([true, true, true]);
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, false]);
    a.pass(2);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Bubble Cage: 25 Shield for 1 turn; when it ends, 1 Charge per 10 Shield left', () => {
    const a = arena({ p0: [['withstand.current']], p1: three(), passives: COND });
    a.use(A1, 'withstand.current').end().end();
    expect(a.stacks(A1, 'charged')).toBe(2);
    const b = arena({ p0: [['withstand.current']], p1: three(), passives: COND });
    b.use(A1, 'withstand.current').end().use(B1, 'shot', A1).end();
    expect([b.hp(A1), b.stacks(A1, 'charged')]).toEqual([100, 1]);
  });

  it('Backwash Lure: Taunts for 2 turns; each time the user is healed, the Taunted enemy takes as much', () => {
    const a = arena({ p0: [['taunt.current'], ['heal']], p1: three(), passives: COND });
    a.setHp(A1, 50).use(A1, 'taunt.current', B1).use(A2, 'heal', A1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect([a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([75, 75, 100]);
  });

  it('Backwash Lure: healing other allies does nothing', () => {
    const a = arena({ p0: [['taunt.current'], ['heal']], p1: three(), passives: COND });
    a.setHp(A2, 50).use(A1, 'taunt.current', B1).use(A2, 'heal', A2).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Dynamo Form: 2 Armor and Immune for 3 turns, +1 energy each turn, 15 Affliction at the end of each', () => {
    const a = arena({ p0: [['titan.current'], ['shot'], ['shot']], p1: three(), passives: COND, richEnergy: false });
    a.state.players[0].energy = { S: 1, A: 0, I: 0, W: 1 };
    a.use(A1, 'titan.current').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.hp(A1)]).toEqual([2, true, 85]);
    a.end();
    expect(gained(a.last, 0)).toBe(4); // 3 characters + 1
    a.pass(6);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.hp(A1)]).toEqual([0, false, 55]);
    expect(gained(a.last, 0)).toBe(3); // the extra energy has stopped
  });
});

describe('Current cost and cooldown (kit table)', () => {
  const table: Record<string, [string, number]> = {
    strike: ['I', 0], smash: ['Sr', 2], charge: ['r', 2], riposte: ['r', 3], rage: ['SS', 4],
    shot: ['r', 0], snipe: ['Ir', 2], trap: ['r', 2], maneuver: ['I', 3], companion: ['A', 1],
    bolt: ['I', 1], blast: ['II', 2], consume: ['r', 2], summon: ['S', 1], channel: ['rr', 3],
    stab: ['r', 0], ravage: ['Ir', 1], mislead: ['A', 2], stun: ['S', 2], dance: ['Ar', 5],
    heal: ['I', 1], bless: ['r', 2], curse: ['r', 2], smite: ['W', 1], prayer: ['Wrr', 2],
    cleave: ['I', 1], shout: ['I', 2], withstand: ['S', 3], taunt: ['r', 3], titan: ['WS', 4],
  };
  const parse = (s: string): Cost => {
    const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof Cost] += 1;
    return c;
  };
  for (const [arch, [cost, cd]] of Object.entries(table)) {
    it(`${arch}.current costs ${cost}, cooldown ${cd}`, () => {
      const s = content.skills[`${arch}.current`]!;
      expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
    });
  }
});
