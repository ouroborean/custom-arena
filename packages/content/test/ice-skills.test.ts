// Scenarios for the Ice element (Frostbitten, Chilled, Numb, Frostborn, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

describe('Ice statuses', () => {
  it('Frostbitten: blocks Harmful Strategic skills only', () => {
    const a = arena({ p0: [['shot']], p1: [['curse', 'shot', 'heal']] });
    a.give(B1, 'frostbitten', { source: A1 });
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'curse', A1))).toBe('cannot_act');
    a.use(B1, 'shot', A1).end(); // non-Strategic is fine
    expect(a.hp(A1)).toBe(85);
    a.pass(1).use(B1, 'heal', B1).end(); // Helpful Strategic is fine
  });

  it('Chilled: skill costs cannot be reduced', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'focus').give(A1, 'chilled', { source: B1 });
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(1);
  });

  it('Numb: cannot apply Buffs, even to themselves', () => {
    const a = arena({ p0: [['rage']], p1: [['shot']] });
    a.give(A1, 'numb', { source: B1 }).use(A1, 'rage').end();
    expect(a.has(A1, 'might')).toBe(false);
  });

  it('Frostborn: immune to Debuffs from Numb/Chilled units; Frostbitten units cannot target or damage it', () => {
    const a = arena({ p0: [['shot']], p1: [['stun', 'shot']] });
    a.give(A1, 'frostborn');
    a.give(B1, 'chilled', { source: A1 });
    a.pass(1).use(B1, 'stun', A1).end();
    expect(a.has(A1, 'stun')).toBe(false); // Chilled source: Debuff blocked
    const b = arena({ p0: [['shot'], ['shot']], p1: [['shot'], ['blast']] });
    b.give(A1, 'frostborn').give(B1, 'frostbitten', { source: A1 }).give('p1c1', 'frostbitten', { source: A1 });
    b.pass(1);
    expect(b.reject(() => b.use(B1, 'shot', A1))).toBe('bad_target');
    b.use('p1c1', 'blast').end(); // AoE skips the Frostborn unit
    expect([b.hp(A1), b.hp(A2)]).toEqual([100, 65]);
  });
});

describe('Ice skills', () => {
  it('Glacial Hammer: 25 and Frostbitten for 2 turns', () => {
    const a = arena({ p0: [['strike.ice']], p1: [['shot']] });
    a.use(A1, 'strike.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostbitten')]).toEqual([75, true]);
  });

  it('Foot of the Mountain: 10 to all enemies and Chilled for 2 turns', () => {
    const a = arena({ p0: [['smash.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ice').end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'chilled')]).toEqual([90, 90, true]);
  });

  it('Avalanche: 15 and Numb for 2 turns', () => {
    const a = arena({ p0: [['charge.ice']], p1: [['shot']] });
    a.use(A1, 'charge.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'numb')]).toEqual([85, true]);
  });

  it('Frost Spines: counters and grants Frostborn for 3 turns', () => {
    const a = arena({ p0: [['riposte.ice']], p1: [['shot']] });
    a.use(A1, 'riposte.ice').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'frostborn')]).toEqual([100, true]);
  });

  it('Absolute Zero: every character with Swiftness (either side) loses it and is Stunned', () => {
    const a = arena({ p0: [['rage.ice'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).give(A2, 'swiftness');
    a.use(A1, 'rage.ice').end();
    expect([a.has(B1, 'swiftness'), a.has(B1, 'stun'), a.has(A2, 'stun'), a.has(B2, 'stun')]).toEqual([false, true, true, false]);
  });

  it('Icicle: 20 and Chilled for 1 turn', () => {
    const a = arena({ p0: [['shot.ice']], p1: [['shot']] });
    a.use(A1, 'shot.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'chilled')]).toEqual([80, true]);
  });

  it('Comet Shard: 50 Piercing on the following turn, or instantly against a Chilled target', () => {
    const a = arena({ p0: [['snipe.ice']], p1: [['shot']] });
    a.use(A1, 'snipe.ice', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(50);
    const b = arena({ p0: [['snipe.ice']], p1: [['shot']] });
    b.give(B1, 'chilled', { source: A1 }).use(A1, 'snipe.ice', B1).end();
    expect(b.hp(B1)).toBe(50);
  });

  it('Frost Snare: the next Harmful skill Stuns the target for 2 turns', () => {
    const a = arena({ p0: [['trap.ice']], p1: [['shot']] });
    a.use(A1, 'trap.ice', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // still Stunned on their next turn
  });

  it('Glissade: Stunned, Invulnerable and Immune until the end of the user’s next turn', () => {
    const a = arena({ p0: [['maneuver.ice', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.ice').end();
    expect(['stun', 'invulnerable', 'immune'].every((k) => a.has(A1, k))).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
  });

  it('Ice Bear: Frostfang deals 25 and Chills', () => {
    const a = arena({ p0: [['companion.ice']], p1: [['shot']] });
    a.use(A1, 'companion.ice').end().pass(1);
    const bear = a.state.units.find((u) => u.defId === 'ice_bear')!;
    a.use(bear.id, 'ice_bear_frostfang', B1).end();
    expect([a.hp(B1), a.has(B1, 'chilled')]).toEqual([75, true]);
  });

  it('Icelance: 15 and Numb; 25 against targets with no Buffs', () => {
    const a = arena({ p0: [['bolt.ice'], ['bolt.ice']], p1: [['shot'], ['shot']] });
    a.give(B2, 'might').use(A1, 'bolt.ice', B1).use(A2, 'bolt.ice', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'numb')]).toEqual([75, 85, true]);
  });

  it('Glacial Burst: 30 to all enemies, 40 to those without Buffs', () => {
    const a = arena({ p0: [['blast.ice']], p1: [['shot'], ['shot']] });
    a.give(B2, 'might').use(A1, 'blast.ice').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 70]);
  });

  it('Siphon Frost: 10; Frostborn for 2 turns if the target has 2+ Frost debuffs', () => {
    const a = arena({ p0: [['consume.ice'], ['consume.ice']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B2, 'chilled', { source: A1 });
    a.use(A1, 'consume.ice', B1).use(A2, 'consume.ice', B2).end();
    expect([a.has(A1, 'frostborn'), a.has(A2, 'frostborn')]).toEqual([true, false]);
  });

  it('Icy Familiar: Chilling Touch (15, Chilled) and Frosty Breath (Chilled)', () => {
    const a = arena({ p0: [['summon.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.ice').end().pass(1);
    const fam = a.state.units.find((u) => u.defId === 'icy_familiar')!;
    a.use(fam.id, 'icy_familiar_touch', B1).end();
    expect([a.hp(B1), a.has(B1, 'chilled')]).toEqual([85, true]);
    a.pass(1).use(fam.id, 'icy_familiar_breath', B2).end();
    expect(a.has(B2, 'chilled')).toBe(true);
  });

  it('Blizzard: 10 and Frostbitten to the target each user turn; all enemies while Frostborn', () => {
    const a = arena({ p0: [['channel.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.ice', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'frostbitten')]).toEqual([90, 100, true]);
    a.give(A1, 'frostborn').pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it("Piercing Cold: 10 and Frostbitten until the end of the user's next turn", () => {
    const a = arena({ p0: [['stab.ice']], p1: [['shot']] });
    a.use(A1, 'stab.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostbitten')]).toEqual([90, true]);
    a.pass(1);
    expect(a.has(B1, 'frostbitten')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'frostbitten')).toBe(false);
  });

  it('Shardstorm: 25 Piercing to each Frostbitten enemy; 35 while Frostborn', () => {
    const a = arena({ p0: [['ravage.ice']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).use(A1, 'ravage.ice').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 100]);
    a.pass(5).give(A1, 'frostborn').use(A1, 'ravage.ice').end(); // CD 2
    expect(a.hp(B1)).toBe(40);
  });

  it('Iceform: Frostborn for 1 turn', () => {
    const a = arena({ p0: [['mislead.ice']], p1: [['shot']] });
    a.use(A1, 'mislead.ice').end();
    expect(a.has(A1, 'frostborn')).toBe(true);
  });

  it('Flash Freeze: Frostbitten for 2 turns', () => {
    const a = arena({ p0: [['stun.ice']], p1: [['shot']] });
    a.use(A1, 'stun.ice', B1).end();
    expect(a.has(B1, 'frostbitten')).toBe(true);
  });

  it('Boreal Dance: 10 per Frost debuff on each enemy', () => {
    const a = arena({ p0: [['dance.ice']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 });
    a.use(A1, 'dance.ice').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
  });

  it('Freeze Wound: heal 10 and 2 Armor for 1 turn', () => {
    const a = arena({ p0: [['heal.ice'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.ice', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'armor')]).toEqual([60, 2]);
  });

  it('Boreal Aegis: an ally is Frostborn until the end of their next turn', () => {
    const a = arena({ p0: [['bless.ice'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.ice', A2).end();
    expect(a.has(A2, 'frostborn')).toBe(true);
  });

  it('Hypothermia: Frostbitten, Chilled and Numb for 2 turns', () => {
    const a = arena({ p0: [['curse.ice']], p1: [['shot']] });
    a.use(A1, 'curse.ice', B1).end();
    expect(['frostbitten', 'chilled', 'numb'].every((k) => a.has(B1, k))).toBe(true);
  });

  it('Chilling Grasp: 20 and Numb for 1 turn', () => {
    const a = arena({ p0: [['smite.ice']], p1: [['shot']] });
    a.use(A1, 'smite.ice', B1).end();
    expect([a.hp(B1), a.has(B1, 'numb')]).toEqual([80, true]);
  });

  it('Northern Solace: heal 10, 30 Shield and 2 Armor for 1 turn', () => {
    const a = arena({ p0: [['prayer.ice'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'prayer.ice').end();
    expect([a.hp(A2), a.effects(A2).find((e) => e.defId === 'shield')?.value, a.stacks(A2, 'armor')]).toEqual([60, 30, 2]);
  });

  it('Glacial Sweep: 25; hits a second random enemy if the target has a Frost debuff', () => {
    const a = arena({ p0: [['cleave.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.ice', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 100]);
    a.pass(3).give(B1, 'numb', { source: A1 }).use(A1, 'cleave.ice', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 75]);
  });

  it("Arctic Roar: the enemy team is Frostbitten until the end of the user's next turn", () => {
    const a = arena({ p0: [['shout.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.ice').end();
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'frostbitten')]).toEqual([true, true]);
  });

  it('Permafrost: 20 Shield for 2 turns; 35 while Frostborn', () => {
    const a = arena({ p0: [['withstand.ice'], ['withstand.ice']], p1: [['shot']] });
    a.give(A2, 'frostborn').use(A1, 'withstand.ice').use(A2, 'withstand.ice').end();
    const shield = (id: string) => a.effects(id).find((e) => e.defId === 'shield')?.value;
    expect([shield(A1), shield(A2)]).toEqual([20, 35]);
  });

  it('Cold Shoulder: Frostbitten and Taunted for 1 turn', () => {
    const a = arena({ p0: [['taunt.ice'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.ice', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    expect(a.has(B1, 'frostbitten')).toBe(true);
  });

  it('Frost Giant: 1 turn of Frostborn per 15 missing health (none if under 15 missing)', () => {
    const a = arena({ p0: [['titan.ice'], ['titan.ice']], p1: [['shot']] });
    a.setHp(A1, 55).setHp(A2, 90);
    a.use(A1, 'titan.ice').use(A2, 'titan.ice').end();
    expect(a.effects(A1).find((e) => e.defId === 'frostborn')?.duration).toBe(5); // 3 enemy turns = 6, minus this turn's countdown
    expect(a.has(A2, 'frostborn')).toBe(false);
  });
});
