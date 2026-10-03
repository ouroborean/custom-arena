// Spec tests for Plasma (Fire + Lightning): Heat, Melt Down, Vent and all 30 variants.
// Sources: skill/status descriptions, glossary, docs/rules.md §21.13, fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// The Plasma Core passive comes with any Plasma skill (createMatch gives it). Heat adds +5 per stack to the
// bearer's Plasma skills, and a Vent skill vents first, so its own bonus counts the Heat it vented (§21.13).

import { describe, expect, it } from 'vitest';
import { viewFor, type GameEvent } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type A = ReturnType<typeof arena>;
const heat = (a: A, id = A1) => a.stacks(id, 'heat');
const shieldOf = (a: A, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.shield).reduce((n, e) => n + e.value, 0);
const totalCost = (c: unknown) => Object.values((c ?? {}) as Record<string, number>).reduce((n, v) => n + v, 0);
function gained(events: readonly GameEvent[], player: 0 | 1): number {
  const e = [...events].reverse().find((x) => x.t === 'energyGained' && x.player === player);
  if (!e || e.t !== 'energyGained') throw new Error('no energyGained event');
  return Object.values(e.gained).reduce((x, y) => x + y, 0);
}

describe('Plasma: Heat and Plasma Core', () => {
  it('the passive comes with a Plasma skill, once, and not without one', () => {
    const a = arena({ p0: [['strike.plasma'], ['shot']], p1: [['shot']] });
    expect([a.stacks(A1, 'plasma_core'), a.stacks(A2, 'plasma_core')]).toEqual([1, 0]);
  });

  it('Plasma skills deal 5 more damage per Heat', () => {
    const a = arena({ p0: [['strike.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 2 }).use(A1, 'strike.plasma', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 10);
  });

  it("Heat doesn't boost non-Plasma skills", () => {
    const a = arena({ p0: [['strike.plasma', 'shot']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 2 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('gaining Charge gives 1 Heat (a Plasma character only)', () => {
    const a = arena({ p0: [['shot.plasma'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stormborn').use(A1, 'shot.plasma', B1).use(A2, 'shot', B1).end();
    // Arc Spark's Ignite tick gives A1 a Charge; A2's Stormborn gives A2 one
    expect([a.stacks(A1, 'charged'), heat(a)]).toEqual([1, 1]);
    expect([a.stacks(A2, 'charged'), heat(a, A2)]).toEqual([1, 0]);
  });

  it('Heat caps at 5', () => {
    const a = arena({ p0: [['rage.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 4 }).use(A1, 'rage.plasma').end(); // +2, and no Melt Down during Critical Mass
    expect(heat(a)).toBe(5);
  });

  it("Heat can't be cleansed (Neutral)", () => {
    const a = arena({ p0: [['strike.plasma']], p1: [['curse.alchemy']] });
    a.give(A1, 'heat', { stacks: 3 }).pass(1).use(B1, 'curse.alchemy', A1).end();
    expect(heat(a)).toBe(3);
  });

  it('Melt Down: at the end of their own turn with 5 Heat: 20 Affliction to them, 20 + 1 Sapped to every enemy, Heat to 0', () => {
    const a = arena({ p0: [['strike.plasma'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'heat', { stacks: 5 }).end();
    expect([a.hp(A1), a.hp(A2), a.hp(B1), a.hp(B2)]).toEqual([80, 100, 80, 80]);
    expect([a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped'), heat(a)]).toEqual([1, 1, 0]);
  });

  it("Melt Down: not at the end of the enemy's turn, and not below 5 Heat", () => {
    const a = arena({ p0: [['strike.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 4 }).end();
    expect([a.hp(A1), heat(a)]).toEqual([100, 4]);
    a.give(A1, 'heat', { stacks: 1 }).end(); // 5 Heat during the enemy's turn
    expect([a.hp(A1), a.hp(B1), heat(a)]).toEqual([100, 100, 5]);
    a.end();
    expect([a.hp(A1), a.hp(B1), heat(a)]).toEqual([80, 80, 0]);
  });
});

describe('Plasma skills', () => {
  it('Searing Jolt: 20 and +1 Heat (the Heat lands after the hit)', () => {
    const a = arena({ p0: [['strike.plasma']], p1: [['shot']] });
    a.use(A1, 'strike.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([80, 1]);
    a.pass(1).use(A1, 'strike.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([80 - 25, 2]);
  });

  it('Searing Jolt: with 4 or more Heat, Vents instead for 5 more damage per Heat removed', () => {
    const a = arena({ p0: [['strike.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 4 }).use(A1, 'strike.plasma', B1).end();
    // 20, +20 for the Heat (counted as it vents), +20 from the Vent
    expect([a.hp(B1), heat(a)]).toEqual([100 - 60, 0]);
  });

  it('Coronal Slam: 25 + 15 to their allies; Ignites on every enemy it hits deal double', () => {
    const a = arena({ p0: [['smash.plasma']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: A1 }).give(B2, 'ignite', { source: A1 });
    a.use(A1, 'smash.plasma', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([100 - 25 - 10, 100 - 15 - 10, 85]);
    a.pass(1);
    const before = a.hp(B1);
    a.pass(1);
    expect(before - a.hp(B1)).toBe(10); // still doubled on later ticks
  });

  it('Coronal Slam: no Ignite, nothing extra', () => {
    const a = arena({ p0: [['smash.plasma']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.plasma', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Spark Rush: 15 (+5 per Heat); +2 Heat, then Vent: the next skill costs 1 less per 2 Heat removed', () => {
    const a = arena({ p0: [['charge.plasma', 'channel.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 4 }).use(A1, 'charge.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([100 - 15 - 20, 0]);
    a.pass(1).use(A1, 'channel.plasma');
    expect(totalCost(a.state.players[0].queue[0]?.cost)).toBe(0);
  });

  it('Spark Rush: with no Heat, its own 2 Heat still makes the next skill cost 1 less', () => {
    const a = arena({ p0: [['charge.plasma', 'channel.plasma']], p1: [['shot']] });
    a.use(A1, 'charge.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([85, 0]);
    a.pass(1).use(A1, 'channel.plasma');
    expect(totalCost(a.state.players[0].queue[0]?.cost)).toBe(1);
  });

  it('Discharge Ward: counters only the next Harmful skill; Vent: 10 Affliction per Heat and Ignite to its user', () => {
    const a = arena({ p0: [['riposte.plasma']], p1: [['shot'], ['shot']] });
    a.give(A1, 'heat', { stacks: 2 }).use(A1, 'riposte.plasma').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1 && e.defId !== 'plasma_core' && e.defId !== 'heat')).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'ignite'), a.has(B2, 'ignite'), heat(a)]).toEqual([85, 80, true, false, 0]);
  });

  it('Critical Mass: +2 Heat, Stormborn and Flameborn for 3 turns', () => {
    const a = arena({ p0: [['rage.plasma']], p1: [['shot']] });
    a.use(A1, 'rage.plasma').end();
    expect([heat(a), a.has(A1, 'stormborn'), a.has(A1, 'flameborn')]).toEqual([2, true, true]);
    a.pass(5);
    expect([a.has(A1, 'stormborn'), a.has(A1, 'flameborn')]).toEqual([false, false]);
  });

  it("Critical Mass: no Melt Down while it lasts; at 5 Heat when it ends, they Melt Down then", () => {
    const a = arena({ p0: [['rage.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 3 }).use(A1, 'rage.plasma').end();
    expect([heat(a), a.hp(B1), a.hp(A1)]).toEqual([5, 100, 100]);
    a.pass(4);
    expect([heat(a), a.hp(B1)]).toEqual([5, 100]);
    a.pass(1); // the end of the enemy's 3rd turn: Critical Mass ends
    expect([heat(a), a.hp(B1), a.hp(A1)]).toEqual([0, 80, 80]);
  });

  it('Arc Spark: 15 and Ignite; each tick of that Ignite gives the user 1 Charge', () => {
    const a = arena({ p0: [['shot.plasma']], p1: [['shot']] });
    a.use(A1, 'shot.plasma', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite'), a.stacks(A1, 'charged')]).toEqual([80, true, 1]);
    a.pass(2);
    expect(a.stacks(A1, 'charged')).toBe(2);
  });

  it('Coilgun: fires when 3 turns pass, 30 Piercing +15 per turn held; hidden target', () => {
    const a = arena({ p0: [['snipe.plasma']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 4 }).use(A1, 'snipe.plasma', B1).end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === A1).every((e) => e.targets.length === 0)).toBe(true);
    expect(a.hp(B1)).toBe(100);
    a.pass(6);
    expect(a.hp(B1)).toBe(100 - 30 - 45);
  });

  it('Coilgun: using another skill releases it early, for less', () => {
    const a = arena({ p0: [['snipe.plasma', 'shot']], p1: [['shot']] });
    a.use(A1, 'snipe.plasma', B1).end().pass(1);
    a.use(A1, 'shot', B1).end();
    const dealt = 100 - a.hp(B1) - 15;
    expect(dealt).toBeGreaterThanOrEqual(30);
    expect(dealt).toBeLessThan(75);
    expect(dealt % 15).toBe(0);
    a.pass(6);
    expect(100 - a.hp(B1) - 15).toBe(dealt); // fires once
  });

  it('Thermite Seal: the first heal Scorches for 2 turns and the target Explodes', () => {
    const a = arena({ p0: [['trap.plasma']], p1: [['heal'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'trap.plasma', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'scorched')]).toEqual([50 + 25 - 10, 90, true]);
    a.pass(4);
    expect(a.has(B1, 'scorched')).toBe(false);
  });

  it('Thermite Seal: only the first heal', () => {
    const a = arena({ p0: [['trap.plasma']], p1: [['heal'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'trap.plasma', B1).end().use(B1, 'heal', B1).end().pass(3);
    a.use(B1, 'heal', B1).end();
    expect(a.hp(B2)).toBe(90);
  });

  it('Heat Sink: Invulnerable for 1 turn; Vent: 10 Shield per Heat removed', () => {
    const a = arena({ p0: [['maneuver.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 3 }).use(A1, 'maneuver.plasma').end();
    expect([a.has(A1, 'invulnerable'), shieldOf(a, A1), heat(a)]).toEqual([true, 30, 0]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  it('Ball Lightning: 25 HP, permanent; each of your turns 10 to a random enemy and 1 Heat for the summoner', () => {
    const a = arena({ p0: [['companion.plasma']], p1: [['shot']] });
    a.use(A1, 'companion.plasma').end().pass(1);
    const ball = a.state.units.find((u) => u.owner === 0 && u.defId === 'ball_lightning')!;
    expect(ball.hp).toBe(25);
    const [hp0, h0] = [a.hp(B1), heat(a)];
    a.pass(2);
    expect([hp0 - a.hp(B1), heat(a) - h0]).toEqual([10, 1]);
  });

  it('Ball Lightning: Detonate (r) kills it for 20 to all enemies and Saps them', () => {
    const a = arena({ p0: [['companion.plasma']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.plasma').end().pass(1);
    const ball = a.state.units.find((u) => u.owner === 0 && u.defId === 'ball_lightning')!;
    const before = [a.hp(B1), a.hp(B2)];
    a.use(ball.id, 'ball_lightning_detonate').end();
    expect(a.unit(ball.id).alive).toBe(false);
    expect([before[0]! - a.hp(B1), before[1]! - a.hp(B2)]).toEqual([20, 20]);
    expect([a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped')]).toEqual([1, 1]);
  });

  it('Superheated Bolt: 20 and Ignite, +1 Heat', () => {
    const a = arena({ p0: [['bolt.plasma']], p1: [['shot']] });
    a.use(A1, 'bolt.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([100 - 20 - 5, 1]);
  });

  it('Superheated Bolt: the Ignite deals 5 more per Heat the user had when applied', () => {
    const a = arena({ p0: [['bolt.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 2 }).use(A1, 'bolt.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([100 - 30 - 15, 3]);
    a.pass(1);
    const before = a.hp(B1);
    a.pass(1);
    expect(before - a.hp(B1)).toBe(15); // fixed at application, not the current 3 Heat
  });

  it('Overload Burst: 20 to all, then the user Melts Down at the end of the turn whatever their Heat', () => {
    const a = arena({ p0: [['blast.plasma']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.plasma').end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.stacks(B1, 'sapped')]).toEqual([60, 60, 80, 1]);
    const b = arena({ p0: [['blast.plasma']], p1: [['shot']] });
    b.give(A1, 'heat', { stacks: 2 }).use(A1, 'blast.plasma').end();
    expect([b.hp(B1), heat(b)]).toEqual([100 - 30 - 20, 0]);
  });

  it('Coolant Draw: 10 and Sap; Vent: the user heals 10 per Heat removed', () => {
    const a = arena({ p0: [['consume.plasma']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'heat', { stacks: 2 }).use(A1, 'consume.plasma', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.hp(A1), heat(a)]).toEqual([100 - 20, 1, 70, 0]);
  });

  it('Coolant Draw: with no Heat to remove, the user gains 2 Heat instead (and heals nothing)', () => {
    const a = arena({ p0: [['consume.plasma']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.plasma', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.hp(A1), heat(a)]).toEqual([90, 1, 50, 2]);
  });

  it('Coolant Draw: the next Draw vents the Heat the first one drew in', () => {
    const a = arena({ p0: [['consume.plasma']], p1: [['shot']] });
    a.use(A1, 'consume.plasma', B1).end().pass(5).setHp(A1, 50);
    a.use(A1, 'consume.plasma', B1).end();
    expect([a.hp(B1), a.hp(A1), heat(a)]).toEqual([90 - 20, 70, 0]);
  });

  it('Jumper Sparks: two 10 HP Sparks for 3 turns; each turn each deals 10 and gives an ally Charge', () => {
    const a = arena({ p0: [['summon.plasma']], p1: [['shot']] }, );
    a.use(A1, 'summon.plasma').end().pass(1);
    const sparks = a.state.units.filter((u) => u.owner === 0 && u.defId === 'jumper_spark');
    expect(sparks.map((s) => s.hp)).toEqual([10, 10]);
    const before = a.hp(B1);
    a.pass(2);
    expect(before - a.hp(B1)).toBe(20);
    expect(a.log().some((l) => /A1 gains Charge/.test(l))).toBe(true);
    a.pass(4);
    expect(a.state.units.filter((u) => u.owner === 0 && u.defId === 'jumper_spark' && u.alive)).toHaveLength(0);
  });

  it('Arc Furnace: each turn, 10 to all and an Ignite on a random enemy, which ticks at once; the user gains 1 Charge', () => {
    const a = arena({ p0: [['channel.plasma']], p1: [['shot']] });
    a.use(A1, 'channel.plasma').end();
    expect([a.hp(B1), a.has(B1, 'ignite'), a.stacks(A1, 'charged'), heat(a)]).toEqual([100 - 10 - 5, true, 1, 1]);
  });

  it("Arc Furnace: every enemy's Ignite ticks at once", () => {
    const a = arena({ p0: [['channel.plasma']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B1 }).give(B2, 'ignite', { source: B2 });
    a.use(A1, 'channel.plasma').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it('Arc Furnace: lasts 3 turns, its Charge heating each next turn up', () => {
    const a = arena({ p0: [['channel.plasma']], p1: [['shot']] });
    a.use(A1, 'channel.plasma').end().pass(4);
    // 10+5 · 15+5+5 (1 Heat, the Ignite's own tick) · 20+5+5 (2 Heat)
    expect([a.hp(B1), heat(a)]).toEqual([100 - 15 - 25 - 30, 3]);
    a.pass(2);
    expect(a.hp(B1)).toBe(30 - 5); // just the Ignite's own tick
  });

  it('Hot Wire: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.plasma'], ['stab.plasma']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).setHp(B1, 61).use(A1, 'stab.plasma', B1).use(A2, 'stab.plasma', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([51, 40]);
  });

  it('Hot Wire: Vent raises the threshold by 10 per Heat removed', () => {
    const a = arena({ p0: [['stab.plasma']], p1: [['shot']] });
    a.setHp(B1, 80).give(A1, 'heat', { stacks: 2 }).use(A1, 'stab.plasma', B1).end();
    expect([a.hp(B1), heat(a)]).toEqual([80 - 20 - 10, 0]);
  });

  it('Plasma Cutter: 20 Piercing +10 per Charge spent (all of it); each Charge becomes 1 Heat', () => {
    const a = arena({ p0: [['ravage.plasma']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 3 }).give(B1, 'armor', { stacks: 4 });
    a.use(A1, 'ravage.plasma', B1).end();
    expect([a.hp(B1), a.has(A1, 'charged'), heat(a)]).toEqual([100 - 50, false, 3]);
    const b = arena({ p0: [['ravage.plasma']], p1: [['shot']] });
    b.use(A1, 'ravage.plasma', B1).end();
    expect([b.hp(B1), heat(b)]).toEqual([80, 0]);
  });

  it('Heat Shimmer: a Harmful skill is countered and its user Ignited', () => {
    const a = arena({ p0: [['mislead.plasma'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.plasma', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'ignite')]).toEqual([100, true]);
  });

  it('Heat Shimmer: for 2 turns that Ignite also ticks at the start of their own turns', () => {
    const a = arena({ p0: [['mislead.plasma'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.plasma', B1).end().use(B1, 'shot', A2).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(4); // ends of turns 3 and 5 (5 each) + starts of turns 4 and 6 (5 each)
    expect(a.hp(B1)).toBe(80);
    a.pass(2); // the extra tick is over: only the normal one
    expect(a.hp(B1)).toBe(75);
  });

  it('Short Circuit: 15 and stuns non-Strategic skills for 1 turn', () => {
    const a = arena({ p0: [['stun.plasma']], p1: [['shot', 'curse'], ['shot']] });
    a.use(A1, 'stun.plasma', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns'), a.has(B2, 'stun_ns')]).toEqual([85, true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'curse', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Short Circuit: Vent: per 2 Heat removed, a random other enemy is stunned the same way', () => {
    const a = arena({ p0: [['stun.plasma']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'heat', { stacks: 3 }).use(A1, 'stun.plasma', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15);
    expect([B2, B3].filter((u) => a.has(u, 'stun_ns'))).toHaveLength(1);
    expect(heat(a)).toBe(0);
  });

  it("Star Core: 1 Might and Stormborn for 3 turns; can't be Stunned with 3+ Heat", () => {
    const a = arena({ p0: [['dance.plasma']], p1: [['stun']] });
    a.give(A1, 'heat', { stacks: 3 }).use(A1, 'dance.plasma').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'stormborn')]).toEqual([1, true]);
    a.use(B1, 'stun', A1).end();
    expect(a.has(A1, 'stun')).toBe(false);
    a.pass(4);
    expect([a.has(A1, 'might'), a.has(A1, 'stormborn')]).toEqual([false, false]);
  });

  it('Star Core: below 3 Heat the user can be Stunned', () => {
    const a = arena({ p0: [['dance.plasma']], p1: [['stun']] });
    a.use(A1, 'dance.plasma').end().use(B1, 'stun', A1).end();
    expect(a.has(A1, 'stun')).toBe(true);
  });

  it('Cauterizing Shock: heals 20; Vent: the ally gains 1 Charge per 2 Heat removed', () => {
    const a = arena({ p0: [['heal.plasma'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A1, 'heat', { stacks: 4 }).use(A1, 'heal.plasma', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'charged'), heat(a)]).toEqual([70, 2, 0]);
  });

  it("Supercharge: the ally's Charge fills to 3 and they gain 1 Might for 3 turns", () => {
    const a = arena({ p0: [['bless.plasma'], ['shot']], p1: [['shot']] });
    a.give(A2, 'charged').use(A1, 'bless.plasma', A2).end();
    expect([a.stacks(A2, 'charged'), a.stacks(A2, 'might')]).toEqual([3, 1]);
    a.pass(5);
    expect(a.has(A2, 'might')).toBe(false);
  });

  it("Supercharge: for those 3 turns they can't gain Charge, and can again after", () => {
    const a = arena({ p0: [['bless.plasma'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stormborn').use(A1, 'bless.plasma', A2).end().end(); // the 3 Charge turns into energy
    expect(a.has(A2, 'charged')).toBe(false);
    a.use(A2, 'shot', B1).end();
    expect(a.has(A2, 'charged')).toBe(false);
    a.pass(5).use(A2, 'shot', B1).end();
    expect(a.stacks(A2, 'charged')).toBe(1);
  });

  it('Brownout: Sapped and Confused for 2 turns', () => {
    const a = arena({ p0: [['curse.plasma']], p1: [['shot']] });
    a.use(A1, 'curse.plasma', B1).end();
    expect([a.stacks(B1, 'sapped'), a.stacks(B1, 'confusion')]).toEqual([1, 1]);
    a.pass(4);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Brownout: while Confused, they generate 1 less energy each turn', () => {
    const a = arena({ p0: [['curse.plasma']], p1: [['shot'], ['shot']], richEnergy: false });
    a.use(A1, 'curse.plasma', B1).end();
    expect(gained(a.last, 1)).toBe(1);
    a.pass(2);
    expect(gained(a.last, 1)).toBe(1);
    a.pass(4);
    expect(gained(a.last, 1)).toBe(2);
  });

  it('Quench Brand: 20 and Sanctify for 1 turn; Vent: the Sanctify heals 5 more per Heat removed', () => {
    const a = arena({ p0: [['smite.plasma'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A1, 'heat', { stacks: 2 }).use(A1, 'smite.plasma', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2), heat(a)]).toEqual([100 - 30 - 15, 50 + 15 + 10, 0]);
  });

  it('Quench Brand: plain Sanctify without Heat', () => {
    const a = arena({ p0: [['smite.plasma'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.plasma', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([65, 65]);
    a.pass(1).use(A2, 'shot', B1).end(); // the Sanctify lasted 1 turn
    expect(a.hp(A2)).toBe(65);
  });

  it('Heat Exchange: allies heal 15 and gain 10 Shield for 1 turn', () => {
    const a = arena({ p0: [['prayer.plasma'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.plasma').end();
    expect([a.hp(A1), a.hp(A2), shieldOf(a, A2)]).toEqual([65, 65, 10]);
    a.pass(1);
    expect(shieldOf(a, A2)).toBe(0);
  });

  it("Heat Exchange: a Melt Down before the user's next turn heals every ally 20 and spares the user", () => {
    const a = arena({ p0: [['prayer.plasma'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).give(A1, 'heat', { stacks: 5 }).use(A1, 'prayer.plasma').end();
    expect([a.hp(A1), a.hp(A2), a.hp(B1), heat(a)]).toEqual([85, 85, 80, 0]);
  });

  it('Breaker Arc: 20 + 15; breaks channels and blocks new ones until the user’s next turn', () => {
    const a = arena({ p0: [['cleave.plasma'], ['shot']], p1: [['channel'], ['channel']], hp: 200 });
    a.pass(1).use(B1, 'channel').end(); // ticks 10 on A's side at the end of each B turn
    expect(a.hp(A2)).toBe(190);
    a.use(A1, 'cleave.plasma', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([180, 185]);
    expect(a.reject(() => a.use(B2, 'channel'))).toBe('cannot_act');
    a.end();
    expect(a.hp(A2)).toBe(190); // B1's channel is broken
    a.end();
    a.use(B2, 'channel');
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Grid Collapse: enemies Intimidated for 2 turns; every minion on both sides Stunned for 2 turns', () => {
    const a = arena({ p0: [['shout.plasma'], ['companion']], p1: [['companion'], ['shot']] });
    a.use(A2, 'companion').end().use(B1, 'companion').end();
    a.use(A1, 'shout.plasma').end();
    const wolves = a.state.units.filter((u) => u.defId === 'wolf');
    expect(wolves).toHaveLength(2);
    expect(wolves.map((w) => a.has(w.id, 'stun'))).toEqual([true, true]);
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.has(A2, 'intimidated'), a.has(B1, 'stun')]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    a.pass(4);
    expect(wolves.map((w) => a.has(w.id, 'stun'))).toEqual([false, false]);
  });

  it('Overcharged Barrier: 50 Shield for 1 turn; the next skill costs 2 more energy', () => {
    const a = arena({ p0: [['withstand.plasma', 'shot']], p1: [['shot']] });
    a.use(A1, 'withstand.plasma').end();
    expect(shieldOf(a, A1)).toBe(50);
    a.end();
    expect(shieldOf(a, A1)).toBe(0);
    a.use(A1, 'shot', B1);
    expect(totalCost(a.state.players[0].queue[0]?.cost)).toBe(3);
    a.end().pass(1).use(A1, 'shot', B1);
    expect(totalCost(a.state.players[0].queue[0]?.cost)).toBe(1); // only the next skill
  });

  it('Flare Beacon: Taunts for 1 turn without Heat', () => {
    const a = arena({ p0: [['taunt.plasma'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.plasma', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end().end();
    a.use(B1, 'shot', A2);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Flare Beacon: Vent: 1 more turn of Taunt, and 1 Sapped per 2 Heat removed', () => {
    const a = arena({ p0: [['taunt.plasma'], ['shot']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 4 }).use(A1, 'taunt.plasma', B1).end();
    expect([a.stacks(B1, 'sapped'), heat(a)]).toEqual([2, 0]);
    a.end().end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });

  it('Reactor Core: +2 Heat; Immune and 1 Armor per Heat, checked as each hit lands, for 3 turns', () => {
    const a = arena({ p0: [['titan.plasma']], p1: [['strike'], ['curse']] });
    a.use(A1, 'titan.plasma').end();
    expect(heat(a)).toBe(2);
    a.use(B1, 'strike', A1).use(B2, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion')]).toEqual([90, false]); // 20 - 10
    a.give(A1, 'heat', { stacks: 1 }).pass(1).use(B1, 'strike', A1).end(); // 3 Heat now
    expect(a.hp(A1)).toBe(90 - (25 - 15)); // Strike's Might makes it 25; 3 Armor now
    a.pass(3);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Reactor Core: the Heat rises to at most 4', () => {
    const a = arena({ p0: [['titan.plasma']], p1: [['shot']] });
    a.give(A1, 'heat', { stacks: 3 }).use(A1, 'titan.plasma').end();
    expect(heat(a)).toBe(4);
    const b = arena({ p0: [['titan.plasma']], p1: [['shot']] });
    b.give(A1, 'heat', { stacks: 4 }).use(A1, 'titan.plasma').end();
    expect([heat(b), b.hp(A1)]).toEqual([4, 100]); // no Melt Down
  });
});

describe('Plasma costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['r', 0],
    smash: ['SS', 2],
    charge: ['r', 2],
    riposte: ['S', 3],
    rage: ['Sr', 4],
    shot: ['I', 0],
    snipe: ['AS', 2],
    trap: ['r', 2],
    maneuver: ['r', 2],
    companion: ['S', 1],
    bolt: ['I', 1],
    blast: ['Srr', 2],
    consume: ['r', 2],
    summon: ['I', 1],
    channel: ['rr', 3],
    stab: ['r', 0],
    ravage: ['Ir', 1],
    mislead: ['Sr', 2],
    stun: ['AA', 2],
    dance: ['SA', 5],
    heal: ['I', 1],
    bless: ['W', 2],
    curse: ['r', 2],
    smite: ['W', 1],
    prayer: ['SS', 2],
    cleave: ['S', 1],
    shout: ['S', 3],
    withstand: ['S', 3],
    taunt: ['r', 3],
    titan: ['Wr', 4],
  };
  const norm = (c: unknown) => {
    if (typeof c === 'string') return c.split('').sort().join('');
    return Object.entries((c ?? {}) as Record<string, number>)
      .flatMap(([k, n]) => Array<string>(n).fill(k))
      .sort()
      .join('');
  };
  it.each(Object.entries(kit))('%s.plasma matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.plasma`]!;
    expect([norm(s.cost), s.cooldown]).toEqual([norm(cost), cd]);
  });
});
