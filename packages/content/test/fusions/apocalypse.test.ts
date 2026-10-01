// Spec tests for Apocalypse (Fire + Ice): Frostfire, Thermal Shock and all 30 variants.
// Sources: skill/status descriptions, glossary, docs/rules.md §21.11, fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const TS = ['thermal_shock'];
/**
 * Arena where every p0 character carries the Apocalypse passive. createMatch already gives it to
 * characters with an Apocalypse skill, so it's only added by hand to characters with none.
 */
function ap(p0: string[][], p1: string[][], extra: { hp?: number; seed?: number } = {}) {
  const passives: Record<string, string[]> = {};
  p0.forEach((skills, i) => {
    if (!skills.some((s) => s.endsWith('.apocalypse'))) passives[`p0c${i}`] = TS;
  });
  return arena({ p0, p1, passives, ...extra });
}

describe('Apocalypse: Thermal Shock (fusion passive)', () => {
  it('giving a Chilled enemy a Fire debuff Shocks them: 15 Piercing and Shattered', () => {
    const a = ap([['strike.fire']], [['shot']]);
    a.give(B1, 'chilled', { source: A1 }).use(A1, 'strike.fire', B1).end();
    // 25 hit + 15 Shock (+5 Ignite tick at the end of the turn)
    expect([a.hp(B1), a.has(B1, 'shattered')]).toEqual([100 - 25 - 15 - 5, true]);
  });

  it('the reverse: giving an Ignited enemy a Frost debuff Shocks them', () => {
    const a = ap([['strike.ice']], [['shot']]);
    a.give(B1, 'scorched', { source: A1 }).use(A1, 'strike.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered')]).toEqual([100 - 25 - 15, true]);
  });

  it('a character without the passive does not Shock', () => {
    const a = arena({ p0: [['strike.fire']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1 }).use(A1, 'strike.fire', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered')]).toEqual([100 - 25 - 5, false]);
  });

  it('the passive comes with any Apocalypse skill, once', () => {
    const a = arena({ p0: [['strike.apocalypse'], ['shot']], p1: [['shot']] });
    expect([a.stacks(A1, 'thermal_shock'), a.stacks(A2, 'thermal_shock')]).toEqual([1, 0]);
  });

  it("another (non-Apocalypse) ally's application does not Shock", () => {
    const a = arena({ p0: [['strike.apocalypse'], ['strike.fire']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1 }).use(A2, 'strike.fire', B1).end();
    expect(a.has(B1, 'shattered')).toBe(false);
  });

  it('a Debuff of the same kind does not Shock (Frost on Frost)', () => {
    const a = ap([['strike.ice']], [['shot']]);
    a.give(B1, 'chilled', { source: A1 }).use(A1, 'strike.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered')]).toEqual([75, false]);
  });

  it('once per unit per turn; it can Shock the same unit again on a later turn', () => {
    const a = ap([['strike.fire'], ['shot.ice', 'stab.ice']], [['shot']]);
    a.give(B1, 'chilled', { source: B1 });
    a.use(A1, 'strike.fire', B1).use(A2, 'shot.ice', B1).end();
    // 25 + Shock 15 + 20 (no second Shock) + Ignite tick 5
    expect(a.hp(B1)).toBe(100 - 25 - 15 - 20 - 5);
    a.pass(1);
    const before = a.hp(B1);
    a.use(A2, 'stab.ice', B1).end(); // a new Frost debuff on an Ignited enemy, next turn
    expect(before - a.hp(B1)).toBe(10 + 15 + 5);
  });

  it('the Shock is Piercing: Armor does not reduce it', () => {
    const a = ap([['strike.fire']], [['shot']]);
    a.give(B1, 'chilled', { source: B1 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'strike.fire', B1).end();
    expect(a.hp(B1)).toBe(100 - (25 - 15) - 15 - 5);
  });

  it('Shattered from a Shock lasts 1 turn', () => {
    const a = ap([['strike.fire']], [['shot']]);
    a.give(B1, 'chilled', { source: B1 }).use(A1, 'strike.fire', B1).end();
    expect(a.has(B1, 'shattered')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'shattered')).toBe(false);
  });
});

describe('Apocalypse: Frostfire', () => {
  it('ticks 5 Affliction at the end of its applier’s turn, and does not stack', () => {
    const a = ap([['stab.apocalypse'], ['shot.apocalypse']], [['shot']]);
    a.give(B1, 'might'); // a Buff, so Sleetspark doesn't Numb
    a.use(A1, 'stab.apocalypse', B1).use(A2, 'shot.apocalypse', B1).end();
    expect(a.stacks(B1, 'frostfire')).toBe(1);
    expect(a.hp(B1)).toBe(100 - 10 - 15 - 5);
    a.pass(1); // the enemy's turn: no tick
    expect(a.hp(B1)).toBe(70);
    a.pass(1);
    expect(a.hp(B1)).toBe(65);
  });

  it('on its own it does not Shock', () => {
    const a = ap([['stab.apocalypse']], [['shot']]);
    a.use(A1, 'stab.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered'), a.has(B1, 'frostfire')]).toEqual([85, false, true]);
  });

  it('a Fire or Frost debuff gained after Frostfire does Shock', () => {
    const a = ap([['stab.apocalypse', 'stab.ice']], [['shot']]);
    a.use(A1, 'stab.apocalypse', B1).end().pass(1);
    const before = a.hp(B1);
    a.use(A1, 'stab.ice', B1).end();
    expect([before - a.hp(B1), a.has(B1, 'shattered')]).toEqual([10 + 15 + 5, true]);
  });

  it('gaining Frostfire while carrying a Frost debuff Shocks (it counts as a Fire debuff)', () => {
    const a = ap([['stab.apocalypse']], [['shot']]);
    a.give(B1, 'frostbitten', { source: B1 }).use(A1, 'stab.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered')]).toEqual([100 - 10 - 15 - 5, true]);
  });

  it('counts as an Ignite: Ignite checks see it (Bolt of Fire Explodes)', () => {
    const a = arena({ p0: [['bolt.fire']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostfire', { source: B1 }).use(A1, 'bolt.fire', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100 - 20 - 10, 90]);
  });

  it('counts as Chilled: the bearer’s skill costs cannot be reduced', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostfire', { source: A1 }).give(B1, 'focus').give(B2, 'focus');
    a.pass(1).use(B1, 'shot', A1).use(B2, 'shot', A1);
    const q = a.state.players[1].queue;
    expect([q[0]?.cost.r, q[1]?.cost.r]).toEqual([1, 0]);
  });

  it('runs Fire’s burn aftermath: a Flameborn applier heals for its tick', () => {
    const a = ap([['stab.apocalypse']], [['shot']]);
    a.setHp(A1, 50).give(A1, 'flameborn').use(A1, 'stab.apocalypse', B1).end();
    expect(a.hp(A1)).toBe(55);
  });
});

describe('Apocalypse skills', () => {
  it('Tempering Blow: 20 and Frostbitten for 1 turn on a target with no Frost debuff', () => {
    const a = ap([['strike.apocalypse']], [['shot']]);
    a.use(A1, 'strike.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostbitten'), a.has(B1, 'ignite')]).toEqual([80, true, false]);
    a.pass(1);
    expect(a.has(B1, 'frostbitten')).toBe(false);
  });

  it('Tempering Blow: a target with a Frost debuff is Ignited instead, which Shocks them', () => {
    const a = ap([['strike.apocalypse']], [['shot']]);
    a.give(B1, 'numb', { source: B1 }).use(A1, 'strike.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite'), a.has(B1, 'frostbitten'), a.has(B1, 'shattered')]).toEqual([
      100 - 20 - 15 - 5,
      true,
      false,
      true,
    ]);
  });

  it('Worldbreaker: 25 + 10 splash and Frostfire; no Shock means allies are not Shocked', () => {
    const a = ap([['smash.apocalypse']], [['shot'], ['shot']]);
    a.give(B2, 'scorched', { source: B2 }).use(A1, 'smash.apocalypse', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'frostfire'), a.has(B2, 'shattered')]).toEqual([70, 90, true, false]);
  });

  it('Worldbreaker: if the Frostfire Shocks the target, its allies with a Fire or Frost debuff are Shocked too', () => {
    const a = ap([['smash.apocalypse']], [['shot'], ['shot'], ['shot']]);
    a.give(B1, 'chilled', { source: B1 }).give(B2, 'scorched', { source: B2 });
    a.use(A1, 'smash.apocalypse', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([100 - 25 - 15 - 5, 100 - 10 - 15, 90]);
    expect([B1, B2, B3].map((u) => a.has(u, 'shattered'))).toEqual([true, true, false]);
  });

  it('Coldsnap Dash: 15 and 1 Focus for the next skill', () => {
    const a = ap([['charge.apocalypse', 'shot']], [['shot']]);
    a.use(A1, 'charge.apocalypse', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'focus')]).toEqual([85, 1]);
    a.pass(1).use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
    a.end();
    expect(a.has(A1, 'focus')).toBe(false);
  });

  // BUG: the crack rider ("Coldsnap") expires at the end of the enemy's turn while the Focus stays, so the
  // user's next skill (always on a later turn) never cracks the Ignite.
  it.fails('Coldsnap Dash: the next skill hitting a Chilled, Ignited enemy cracks the Ignite (10 extra Affliction)', () => {
    const a = ap([['charge.apocalypse', 'shot']], [['shot'], ['shot']]);
    a.give(B1, 'chilled', { source: B1 }).give(B1, 'ignite', { source: B1 }); // ticks on B's turns
    a.use(A1, 'charge.apocalypse', B2).end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 5 - 15 - 10);
  });

  it('Coldsnap Dash: an Ignited enemy that is not Chilled is not cracked', () => {
    const b = ap([['charge.apocalypse', 'shot']], [['shot'], ['shot']]);
    b.give(B2, 'ignite', { source: B2 }).use(A1, 'charge.apocalypse', B1).end().pass(1);
    b.use(A1, 'shot', B2).end();
    expect(b.hp(B2)).toBe(100 - 5 - 15);
  });

  it('Twin Spines: counters every Harmful skill on the user; the attacker gains Frostfire', () => {
    const a = ap([['riposte.apocalypse']], [['shot'], ['shot']]);
    a.use(A1, 'riposte.apocalypse').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'frostfire'), a.has(B2, 'frostfire')]).toEqual([100, true, true]);
  });

  it('Twin Spines: is Invisible to the enemy', () => {
    const a = ap([['riposte.apocalypse']], [['shot']]);
    a.use(A1, 'riposte.apocalypse').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1 && e.defId !== 'thermal_shock')).toBe(false);
  });

  it('Twin Spines: the countered attacker is Thermal Shocked the next time they use a skill', () => {
    const a = ap([['riposte.apocalypse']], [['shot']]);
    a.use(A1, 'riposte.apocalypse').end();
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'shattered')).toBe(false);
    a.pass(1); // Frostfire ticks at the end of A1's turn
    const before = a.hp(B1);
    a.use(B1, 'shot', A1).end();
    expect([before - a.hp(B1), a.hp(A1)]).toEqual([15, 85]);
    expect(a.has(B1, 'shattered')).toBe(true);
  });

  it('Ragnarok: 3 Might on the first and third turns, 3 Armor and Immune on the second and fourth', () => {
    const a = ap([['rage.apocalypse']], [['shot']]);
    const st = () => [a.stacks(A1, 'might'), a.stacks(A1, 'armor'), a.has(A1, 'immune')];
    a.use(A1, 'rage.apocalypse').end();
    expect(st()).toEqual([3, 0, false]); // first turn (the cast), through the enemy's turn
    a.end();
    expect(st()).toEqual([0, 3, true]); // second
    a.pass(2);
    expect(st()).toEqual([3, 0, false]); // third
    a.pass(2);
    expect(st()).toEqual([0, 3, true]); // fourth
    a.pass(2);
    expect(st()).toEqual([0, 0, false]); // over
  });

  it('Sleetspark: 15 and Frostfire; with no Buffs also Numbed for 1 turn, Shocking them', () => {
    const a = ap([['shot.apocalypse']], [['shot']]);
    a.use(A1, 'shot.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostfire'), a.has(B1, 'numb'), a.has(B1, 'shattered')]).toEqual([
      100 - 15 - 15 - 5,
      true,
      true,
      true,
    ]);
    a.pass(1);
    expect(a.has(B1, 'numb')).toBe(false);
  });

  it('Sleetspark: a target with a Buff is not Numbed or Shocked', () => {
    const a = ap([['shot.apocalypse']], [['shot']]);
    a.give(B1, 'might').use(A1, 'shot.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'numb'), a.has(B1, 'shattered')]).toEqual([80, false, false]);
  });

  it('Comet of Ruin: 45 on the following turn, target hidden', () => {
    const a = ap([['snipe.apocalypse']], [['shot']]);
    a.use(A1, 'snipe.apocalypse', B1).end();
    expect(a.hp(B1)).toBe(100);
    expect(
      viewFor(content, a.state, 1)
        .effects.filter((e) => e.bearer === A1)
        .every((e) => e.targets.length === 0),
    ).toBe(true);
    a.end();
    expect(a.hp(B1)).toBe(55);
  });

  it('Comet of Ruin: if the target gains a Fire or Frost debuff first, it lands at once and Shocks', () => {
    const a = arena({ p0: [['snipe.apocalypse'], ['stab.ice']], p1: [['shot']] });
    a.use(A1, 'snipe.apocalypse', B1).use(A2, 'stab.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered')]).toEqual([100 - 10 - 45 - 15, true]);
    a.end();
    expect(a.hp(B1)).toBe(30); // it doesn't land a second time
  });

  it('Cracking Floe: the first fall to 50 HP or less deals 20 Piercing and Stuns for 1 turn', () => {
    const a = ap([['trap.apocalypse'], ['shot']], [['shot']]);
    a.use(A1, 'trap.apocalypse', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85); // still above 50: nothing
    a.pass(1).setHp(B1, 60).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([45 - 20, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(10); // only the first time
  });

  it('Cracking Floe: Invisible, and it lasts 3 turns', () => {
    const a = ap([['trap.apocalypse'], ['shot']], [['shot']]);
    a.use(A1, 'trap.apocalypse', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.pass(5).setHp(B1, 60).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([45, false]);
  });

  it('Steamstep: Invulnerable for 1 turn, then 1 more turn Invulnerable only to enemies with a Fire debuff', () => {
    const a = ap([['maneuver.apocalypse']], [['shot'], ['shot']]);
    a.give(B1, 'scorched', { source: A1 });
    a.use(A1, 'maneuver.apocalypse').end();
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70);
  });

  it('Rimeflame Salamander: 35 HP, permanent, and gives a random enemy Frostfire at the end of each of your turns', () => {
    const a = ap([['companion.apocalypse']], [['shot']]);
    a.use(A1, 'companion.apocalypse').end().pass(2);
    const sal = a.state.units.find((u) => u.owner === 0 && u.defId === 'rimeflame_salamander')!;
    expect([sal.hp, sal.alive]).toEqual([35, true]);
    expect(a.has(B1, 'frostfire')).toBe(true);
    a.pass(10);
    expect(a.unit(sal.id).alive).toBe(true);
  });

  it('Rimeflame Salamander: its Frostfire on an enemy with a Frost debuff Shocks them', () => {
    const a = ap([['companion.apocalypse']], [['shot']]);
    a.give(B1, 'frostbitten', { source: B1 }).use(A1, 'companion.apocalypse').end().pass(2);
    expect(a.has(B1, 'frostfire')).toBe(true);
    expect(a.log().some((l) => /Shatter/i.test(l))).toBe(true);
  });

  it('Rimeflame Salamander: when it dies, every enemy with Frostfire is Thermal Shocked', () => {
    const a = ap([['companion.apocalypse']], [['shot'], ['shot']]);
    a.use(A1, 'companion.apocalypse').end().pass(2);
    const sal = a.state.units.find((u) => u.owner === 0 && u.defId === 'rimeflame_salamander')!;
    const had = [B1, B2].map((u) => a.has(u, 'frostfire'));
    expect(had.filter(Boolean).length).toBe(1);
    a.setHp(sal.id, 5);
    const before = [a.hp(B1), a.hp(B2)];
    a.use(B1, 'shot', sal.id).end();
    expect(a.unit(sal.id).alive).toBe(false);
    expect([B1, B2].map((u) => a.has(u, 'shattered'))).toEqual(had);
    expect([before[0]! - a.hp(B1), before[1]! - a.hp(B2)]).toEqual(had.map((h) => (h ? 15 : 0)));
  });

  it('Paradox Bolt: 20 and Frostfire; no Shock on a fresh target', () => {
    const a = ap([['bolt.apocalypse']], [['shot']]);
    a.use(A1, 'bolt.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostfire'), a.has(B1, 'shattered')]).toEqual([75, true, false]);
  });

  it('Paradox Bolt: a target already Shocked this turn is Shocked again', () => {
    const a = ap([['shot.apocalypse'], ['bolt.apocalypse']], [['shot']]);
    a.use(A1, 'shot.apocalypse', B1).use(A2, 'bolt.apocalypse', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15 - 20 - 15 - 5);
  });

  it('Fimbulfire: 20 to all; each Ignite turns into Frostfire, Shocking its bearer', () => {
    const a = ap([['blast.apocalypse']], [['shot'], ['shot']]);
    a.give(B1, 'ignite', { source: B1 }).use(A1, 'blast.apocalypse').end();
    expect([a.has(B1, 'ignite'), a.has(B1, 'frostfire'), a.has(B1, 'shattered')]).toEqual([false, true, true]);
    expect([a.has(B2, 'frostfire'), a.has(B2, 'shattered')]).toEqual([false, false]);
    expect(a.hp(B2)).toBe(80);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 20 - 15);
  });

  it('Equilibrium: 10 and heals the user as much', () => {
    const a = ap([['consume.apocalypse']], [['shot']]);
    a.setHp(A1, 50).give(B1, 'ignite', { source: B1 }).use(A1, 'consume.apocalypse', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'shattered')]).toEqual([90, 60, false]);
  });

  it('Equilibrium: with both a Fire and a Frost debuff (Frostfire counts), Shocks them and heals 20 more', () => {
    const a = ap([['consume.apocalypse']], [['shot'], ['shot']]);
    a.setHp(A1, 50).give(B1, 'frostfire', { source: B1 }).use(A1, 'consume.apocalypse', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'shattered')]).toEqual([75, 80, true]);
    const b = ap([['consume.apocalypse']], [['shot']]);
    b.setHp(A1, 50).give(B1, 'scorched', { source: B1 }).give(B1, 'numb', { source: B1 });
    b.use(A1, 'consume.apocalypse', B1).end();
    expect([b.hp(B1), b.hp(A1)]).toEqual([75, 80]);
  });

  it('Twilight Jotunn: 60 HP; 25 to a random enemy at the end of each of your turns', () => {
    const a = ap([['summon.apocalypse']], [['shot']]);
    a.use(A1, 'summon.apocalypse').end().pass(1);
    const j = a.state.units.find((u) => u.owner === 0 && u.defId === 'twilight_jotunn')!;
    expect(j.hp).toBe(60);
    const before = a.hp(B1);
    a.pass(2);
    expect(before - a.hp(B1)).toBe(25);
  });

  it('Twilight Jotunn: the user is Stunned while it stands, through Swiftness; free once it dies', () => {
    const a = ap([['summon.apocalypse', 'shot']], [['shot']]);
    a.give(A1, 'swiftness').use(A1, 'summon.apocalypse').end().pass(1);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    const j = a.state.units.find((u) => u.owner === 0 && u.defId === 'twilight_jotunn')!;
    a.end().setHp(j.id, 5).use(B1, 'shot', j.id).end();
    expect(a.unit(j.id).alive).toBe(false);
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue).toHaveLength(1);
  });

  it('Twilight Jotunn: lasts 3 turns, and the user acts again after', () => {
    const a = ap([['summon.apocalypse', 'shot']], [['shot']], { hp: 500 });
    a.use(A1, 'summon.apocalypse').end().pass(5);
    expect(a.state.units.some((u) => u.owner === 0 && u.defId === 'twilight_jotunn' && u.alive)).toBe(false);
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue).toHaveLength(1);
  });

  it("Seasons' End: 10 to all each turn; Ignites, then Chills (Shocking), then every Ignited enemy Explodes", () => {
    const a = ap([['channel.apocalypse']], [['shot'], ['shot']], { hp: 200 });
    a.use(A1, 'channel.apocalypse').end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.has(B1, 'chilled')]).toEqual([true, true, false]);
    a.pass(2);
    expect([a.has(B1, 'chilled'), a.has(B2, 'chilled'), a.has(B1, 'shattered'), a.has(B2, 'shattered')]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    a.pass(1);
    expect(a.has(B1, 'chilled')).toBe(false); // Chill lasted 1 turn
    const before = [a.hp(B1), a.hp(B2)];
    a.pass(1);
    // third tick: 10 + two Explosions (10 each) + Ignite tick 5
    expect([before[0]! - a.hp(B1), before[1]! - a.hp(B2)]).toEqual([35, 35]);
    const mid = [a.hp(B1), a.hp(B2)];
    a.pass(2);
    expect([mid[0]! - a.hp(B1), mid[1]! - a.hp(B2)]).toEqual([5, 5]); // channel over: only the Ignite
  });

  it('Twin Needle: 10 and Frostfire', () => {
    const a = ap([['stab.apocalypse']], [['shot']]);
    a.use(A1, 'stab.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostfire')]).toEqual([85, true]);
  });

  it('Twin Needle: at or below 60 HP, 20 and the Frostfire ticks at once', () => {
    const a = ap([['stab.apocalypse']], [['shot']]);
    a.setHp(B1, 60).use(A1, 'stab.apocalypse', B1).end();
    expect(a.hp(B1)).toBe(60 - 20 - 5 - 5);
  });

  it('Twofold Ruin: 20 Affliction +10 per Fire or Frost debuff, then those are removed', () => {
    const a = ap([['ravage.apocalypse']], [['shot']]);
    a.give(B1, 'ignite', { source: B1 }).give(B1, 'chilled', { source: B1 }).give(B1, 'numb', { source: B1 });
    a.give(B1, 'weakness', { source: B1 }).give(B1, 'shield', { value: 50 });
    a.use(A1, 'ravage.apocalypse', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 30);
    expect(['ignite', 'chilled', 'numb', 'weakness'].map((s) => a.has(B1, s))).toEqual([false, false, false, true]);
    const b = ap([['ravage.apocalypse']], [['shot']]);
    b.use(A1, 'ravage.apocalypse', B1).end();
    expect(b.hp(B1)).toBe(80);
  });

  it('Shimmering Air: a Harmful skill is countered and its user gains Frostfire', () => {
    const a = ap([['mislead.apocalypse'], ['shot']], [['shot']]);
    a.use(A1, 'mislead.apocalypse', B1).end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'frostfire'), a.has(B1, 'scorched')]).toEqual([100, true, false]);
  });

  it('Shimmering Air: a Helpful skill goes through but Scorches and Numbs its user for 1 turn', () => {
    const a = ap([['mislead.apocalypse']], [['heal']]);
    a.setHp(B1, 50).use(A1, 'mislead.apocalypse', B1).end().use(B1, 'heal', B1).end();
    // the heal (25, halved by Scorched to 15) still lands; the 15 lost is the Shock (next test)
    expect([a.hp(B1), a.has(B1, 'scorched'), a.has(B1, 'numb'), a.has(B1, 'frostfire')]).toEqual([
      50 - 15 + 15,
      true,
      true,
      false,
    ]);
    a.pass(2);
    expect([a.has(B1, 'scorched'), a.has(B1, 'numb')]).toEqual([false, false]);
  });

  it('Shimmering Air: Scorched + Numb meet on the same enemy, so the Apocalypse passive Shocks', () => {
    const a = ap([['mislead.apocalypse']], [['heal']]);
    a.use(A1, 'mislead.apocalypse', B1).end().use(B1, 'heal', B1).end();
    expect(a.has(B1, 'shattered')).toBe(true);
  });

  it('Shimmering Air: lasts 1 turn and is Invisible', () => {
    const a = ap([['mislead.apocalypse'], ['shot']], [['shot']]);
    a.use(A1, 'mislead.apocalypse', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.pass(2).use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'frostfire')]).toEqual([85, false]);
  });

  it('Hoarfire Hold: 15, Frostfire and a 1-turn Stun; the Frostfire is then consumed to Stun 1 more turn', () => {
    const a = ap([['stun.apocalypse']], [['shot']]);
    a.use(A1, 'stun.apocalypse', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    expect(a.has(B1, 'frostfire')).toBe(false);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Hoarfire Hold: no extra Stun if the Frostfire is gone when the Stun ends', () => {
    const a = ap([['stun.apocalypse'], ['ravage.apocalypse']], [['shot']]);
    a.use(A1, 'stun.apocalypse', B1).use(A2, 'ravage.apocalypse', B1).end().end().end();
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('White Flame Waltz: 1 Swiftness and 1 Focus; Explodes at the end of turns the user dealt damage', () => {
    const a = ap([['dance.apocalypse', 'shot', 'heal']], [['shot'], ['shot']]);
    a.use(A1, 'dance.apocalypse').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus'), a.hp(B1), a.hp(B2)]).toEqual([1, 1, 100, 100]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 90]);
  });

  it('White Flame Waltz: no Explosion on a turn the user used only a non-damaging skill', () => {
    const a = ap([['dance.apocalypse', 'heal']], [['shot'], ['shot']]);
    a.use(A1, 'dance.apocalypse').end().pass(1).use(A1, 'heal', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
  });

  // BUG: once the user has dealt damage, they Explode at the end of every later turn too, even with no damage dealt.
  it.fails('White Flame Waltz: a later turn without damage does not Explode', () => {
    const a = ap([['dance.apocalypse', 'shot', 'heal']], [['shot'], ['shot']]);
    a.use(A1, 'dance.apocalypse').end().pass(1).use(A1, 'shot', B1).end();
    a.pass(1).use(A1, 'heal', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 90]);
  });

  it('White Flame Waltz: lasts 3 turns', () => {
    const a = ap([['dance.apocalypse', 'shot']], [['shot'], ['shot']]);
    a.use(A1, 'dance.apocalypse').end().pass(5);
    expect([a.has(A1, 'swiftness'), a.has(A1, 'focus')]).toEqual([false, false]);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Frozen Remedy: the ally heals 35 at the end of the enemy’s next turn', () => {
    const a = ap([['heal.apocalypse'], ['shot']], [['shot']]);
    a.setHp(A2, 40).use(A1, 'heal.apocalypse', A2).end();
    expect(a.hp(A2)).toBe(40);
    a.end();
    expect(a.hp(A2)).toBe(75);
    a.pass(2);
    expect(a.hp(A2)).toBe(75);
  });

  it('Frozen Remedy: a lethal hit is survived and the heal lands at once (floor of 1, then +35), only once', () => {
    const a = ap([['heal.apocalypse'], ['shot']], [['strike']]);
    a.setHp(A2, 10).use(A1, 'heal.apocalypse', A2).end();
    a.use(B1, 'strike', A2).end();
    expect([a.unit(A2).alive, a.hp(A2)]).toEqual([true, 36]);
  });

  it('Tempered: 1 Might for 3 turns, and +10 direct damage against Shattered enemies', () => {
    const a = ap([['bless.apocalypse'], ['shot']], [['shot'], ['shot']]);
    a.give(B1, 'shattered', { source: A1 });
    a.use(A1, 'bless.apocalypse', A2).use(A2, 'shot', B1).end();
    expect([a.stacks(A2, 'might'), a.hp(B1)]).toEqual([1, 100 - 15 - 5 - 10]);
    a.pass(1).use(A2, 'shot', B2).end();
    expect(a.hp(B2)).toBe(80);
    a.pass(5);
    expect(a.has(A2, 'might')).toBe(false);
  });

  it('Heat Death: Frostfire, then 1 Confusion per Fire or Frost debuff (Frostfire included)', () => {
    const a = ap([['curse.apocalypse']], [['shot'], ['shot']]);
    a.use(A1, 'curse.apocalypse', B1).end();
    expect([a.has(B1, 'frostfire'), a.stacks(B1, 'confusion')]).toEqual([true, 1]);
    const b = ap([['curse.apocalypse']], [['shot']]);
    b.give(B1, 'scorched', { source: B1 }).use(A1, 'curse.apocalypse', B1).end();
    expect(b.stacks(B1, 'confusion')).toBe(2);
  });

  it('Heat Death: at most 3 Confusion, lasting 2 turns', () => {
    const a = ap([['curse.apocalypse']], [['shot']]);
    for (const s of ['scorched', 'numb', 'frostbitten', 'ignite']) a.give(B1, s, { source: B1 });
    a.use(A1, 'curse.apocalypse', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(3);
    a.pass(4);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Rimebrand: 15 and Sanctify for 1 turn', () => {
    const a = ap([['smite.apocalypse']], [['shot']]);
    a.use(A1, 'smite.apocalypse', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([85, true]);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Rimebrand: for 2 turns, each Explosion that hits the target Frostbites it for 1 turn', () => {
    const a = ap([['smite.apocalypse'], ['dance.fire']], [['shot'], ['shot']]);
    a.use(A1, 'smite.apocalypse', B1).use(A2, 'dance.fire').end();
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'frostbitten')]).toEqual([true, false]);
    expect(a.hp(B2)).toBe(90);
  });

  it('Fimbul Vigil: allies heal 20 and gain 10 Shield', () => {
    const a = ap([['prayer.apocalypse'], ['shot']], [['shot']]);
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.apocalypse').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
    expect(a.effects(A2).find((e) => e.defId === 'shield')?.value).toBe(10);
  });

  it("Fimbul Vigil: for 2 turns, Chilled enemies' skills cost 1 more random energy (others don't)", () => {
    const a = ap([['prayer.apocalypse']], [['shot'], ['shot']]);
    a.give(B1, 'chilled', { source: B1 }).use(A1, 'prayer.apocalypse').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1);
    const q = a.state.players[1].queue;
    expect([q[0]?.cost.r, q[1]?.cost.r]).toEqual([2, 1]);
  });

  it("Split Horizon: 20 + 15 to a random other enemy, who gains copies of the target's Fire and Frost debuffs", () => {
    const a = ap([['cleave.apocalypse']], [['shot'], ['shot']]);
    a.give(B1, 'scorched', { source: B1 }).give(B1, 'chilled', { source: B1 }).give(B1, 'weakness', { source: B1 });
    a.use(A1, 'cleave.apocalypse', B1).end();
    // the copied Fire + Frost debuffs meet on B2, so the user's passive Shocks it (15)
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'shattered')]).toEqual([80, 100 - 15 - 15, true]);
    expect(['scorched', 'chilled', 'weakness'].map((s) => a.has(B2, s))).toEqual([true, true, false]);
    expect(['scorched', 'chilled'].map((s) => a.has(B1, s))).toEqual([true, true]); // copies, not moved
  });

  it("Long Night's Toll: all enemies Intimidated for 2 turns, and one random enemy gains Frostfire", () => {
    const a = ap([['shout.apocalypse']], [['shot'], ['shot'], ['shot']]);
    a.use(A1, 'shout.apocalypse').end();
    expect([B1, B2, B3].every((u) => a.has(u, 'intimidated'))).toBe(true);
    expect([B1, B2, B3].filter((u) => a.has(u, 'frostfire'))).toHaveLength(1);
    a.pass(4);
    expect([B1, B2, B3].some((u) => a.has(u, 'intimidated'))).toBe(false);
  });

  it("Long Night's Toll: enemies with Frostfire are Intimidated twice over (+1 more cooldown)", () => {
    const a = ap([['shout.apocalypse']], [['shot'], ['shot']]);
    a.use(A1, 'shout.apocalypse').end();
    const ff = a.has(B1, 'frostfire') ? B1 : B2;
    const other = ff === B1 ? B2 : B1;
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.cooldown(other, 'shot'), a.cooldown(ff, 'shot')]).toEqual([1, 2]);
  });

  it('Heart of the Glacier: 25 Shield for 2 turns and Frostborn while any of it remains', () => {
    const a = ap([['withstand.apocalypse']], [['shot'], ['smash']]);
    a.use(A1, 'withstand.apocalypse').end();
    expect([a.effects(A1).find((e) => e.inline?.shield)?.value, a.has(A1, 'frostborn')]).toEqual([25, true]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'frostborn')]).toEqual([100, true]);
    a.end().use(B2, 'smash', A1).end();
    expect(a.has(A1, 'frostborn')).toBe(false);
  });

  it('Heart of the Glacier: Frostborn ends when the Shield expires', () => {
    const a = ap([['withstand.apocalypse']], [['shot']]);
    a.use(A1, 'withstand.apocalypse').end().pass(1);
    expect(a.has(A1, 'frostborn')).toBe(true);
    a.pass(3);
    expect([a.effects(A1).some((e) => e.inline?.shield), a.has(A1, 'frostborn')]).toEqual([false, false]);
  });

  it('Circle of Extremes: Taunts for 2 turns and pulls every Fire and Frost debuff off their allies onto them', () => {
    const a = ap([['taunt.apocalypse'], ['shot']], [['shot'], ['shot']]);
    a.give(B2, 'scorched', { source: B2 }).give(B2, 'numb', { source: B2 }).give(B2, 'weakness', { source: B2 });
    a.use(A1, 'taunt.apocalypse', B1).end();
    expect(['scorched', 'numb'].map((s) => a.has(B1, s))).toEqual([true, true]);
    expect(['scorched', 'numb', 'weakness'].map((s) => a.has(B2, s))).toEqual([false, false, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // can only target the taunter
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.pass(3);
    a.use(B1, 'shot', A2); // Taunt over after 2 turns
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Twilight Colossus: 3 Armor and Immune for 3 turns; enemies who damage the user gain Frostfire', () => {
    const a = ap([['titan.apocalypse']], [['strike'], ['curse']]);
    a.use(A1, 'titan.apocalypse').end();
    a.use(B1, 'strike', A1).use(B2, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion'), a.has(B1, 'frostfire'), a.has(B2, 'frostfire')]).toEqual([
      95,
      false,
      true,
      false,
    ]);
    a.pass(6);
    expect([a.has(A1, 'armor'), a.has(A1, 'immune')]).toEqual([false, false]);
  });
});

describe('Apocalypse costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0],
    smash: ['Sr', 2],
    charge: ['S', 2],
    riposte: ['I', 3],
    rage: ['SS', 4],
    shot: ['r', 1],
    snipe: ['AIr', 2],
    trap: ['I', 3],
    maneuver: ['S', 3],
    companion: ['I', 1],
    bolt: ['Ir', 1],
    blast: ['SI', 2],
    consume: ['r', 2],
    summon: ['Sr', 2],
    channel: ['II', 3],
    stab: ['r', 0],
    ravage: ['Ar', 1],
    mislead: ['I', 2],
    stun: ['AS', 3],
    dance: ['AS', 4],
    heal: ['W', 1],
    bless: ['S', 2],
    curse: ['IW', 3],
    smite: ['W', 1],
    prayer: ['SI', 3],
    cleave: ['S', 1],
    shout: ['r', 3],
    withstand: ['r', 3],
    taunt: ['S', 3],
    titan: ['IW', 4],
  };
  const norm = (c: unknown) => {
    if (typeof c === 'string') return c.split('').sort().join('');
    const o = (c ?? {}) as Record<string, number>;
    return Object.entries(o)
      .flatMap(([k, n]) => Array<string>(n).fill(k))
      .sort()
      .join('');
  };
  it.each(Object.entries(kit))('%s.apocalypse matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.apocalypse`]!;
    expect([norm(s.cost), s.cooldown]).toEqual([norm(cost), cd]);
  });
});
