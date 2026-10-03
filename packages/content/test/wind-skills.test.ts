// Scenarios for the Wind element (Rushing, Leaping, Immobile, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

describe('Wind statuses', () => {
  it('Rushing: grants Swiftness and Focus, re-granted each turn if missing', () => {
    const a = arena({ p0: [['charge.wind', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.wind').end();
    expect(['rushing', 'swiftness', 'focus'].map((s) => a.has(A1, s))).toEqual([true, true, true]);
    a.pass(1);
    a.use(A1, 'shot', B1); // Focus makes Shot free, then is used up
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
    a.end();
    expect([a.has(A1, 'rushing'), a.has(A1, 'focus')]).toEqual([true, false]);
    a.pass(1);
    expect(a.has(A1, 'focus')).toBe(true); // re-granted at turn start
  });

  it('Rushing: ends at the end of a turn in which the bearer used no skill', () => {
    const a = arena({ p0: [['charge.wind', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.wind').end().pass(1);
    expect(a.has(A1, 'rushing')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'rushing')).toBe(false);
  });

  it('Leap: Invulnerable for 1 turn and +5 on the next damaging skill only', () => {
    const a = arena({ p0: [['maneuver.wind', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.wind').end();
    expect([a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'leaping')]).toEqual([80, false]);
  });

  it('Immobile: characters with no mobility skills and no mobility buffs', () => {
    const a = arena({ p0: [['shot'], ['charge']], p1: [['shot']] });
    const imm = (id: string) => evaluateNamedCondition(content, a.state, 'immobile', id);
    expect([imm(A1), imm(A2)]).toEqual([true, false]);
    a.give(A1, 'swiftness');
    expect(imm(A1)).toBe(false);
  });
});

describe('Wind skills', () => {
  it('Leaping Strike: 25; while Leaping, +5 and a non-Strategic stun', () => {
    const a = arena({ p0: [['strike.wind']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.wind', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns')]).toEqual([75, false]);
    a.give(A1, 'leaping').pass(1).use(A1, 'strike.wind', B2).end();
    expect([a.hp(B2), a.has(B2, 'stun_ns')]).toEqual([70, true]);
  });

  it("Leaping lasts until the end of the Leaper's next turn: one chance to act with it", () => {
    const a = arena({ p0: [['smash.wind'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.wind', B1).end(); // Spiral Crash Leaps
    expect(a.has(A1, 'leaping')).toBe(true);
    a.pass(1); // the enemy's turn
    expect(a.has(A1, 'leaping')).toBe(true); // still there for the Leaper's next turn
    a.end(); // which passes without a damaging skill
    expect(a.has(A1, 'leaping')).toBe(false);
  });

  it('Spiral Crash: Leaps if not Leaping; if Leaping, also 10 to all enemies', () => {
    const a = arena({ p0: [['smash.wind']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.wind', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'leaping')]).toEqual([80, 100, true]);
    // Its cooldown outlasts its own Leap, so the second use needs Leaping from elsewhere.
    a.pass(5);
    expect(a.has(A1, 'leaping')).toBe(false);
    a.give(A1, 'leaping').use(A1, 'smash.wind', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'leaping')]).toEqual([40, 85, false]); // B1: 25 + 15 (the AoE hits it too); B2: 15 — all +5 from Leaping
  });

  it('Zephyr Blade: 5 Piercing; if countered, the counterer takes 25 Piercing', () => {
    const a = arena({ p0: [['riposte.wind']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'riposte.wind', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Chainbreaker: removes Debuffs, grants Immune, and is usable while Stunned', () => {
    const a = arena({ p0: [['rage.wind']], p1: [['shot']] });
    a.give(A1, 'stun', { source: B1 }).give(A1, 'weakness', { source: B1 }).give(A1, 'might');
    a.use(A1, 'rage.wind').end();
    expect(['stun', 'weakness', 'might', 'immune'].map((s) => a.has(A1, s))).toEqual([false, false, true, true]);
  });

  it('Air Bullet: 5 and the user Leaps; the next use, while Leaping, deals 10 more and spends the Leap', () => {
    const a = arena({ p0: [['shot.wind']], p1: [['shot']] });
    a.use(A1, 'shot.wind', B1).end();
    expect([a.hp(B1), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([95, true, true]);
    a.pass(1).use(A1, 'shot.wind', B1).end(); // no cooldown, so the Leap is still up
    expect([a.hp(B1), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([75, false, false]); // 5 + 10 + Leaping's 5
  });

  it('Elegant Sweep: 25 Piercing to every enemy a turn later', () => {
    const a = arena({ p0: [['snipe.wind']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.wind').end();
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
  });

  it('Float Noose: every skill used Isolates the user and deals 10 Piercing', () => {
    const a = arena({ p0: [['trap.wind']], p1: [['shot']] });
    a.use(A1, 'trap.wind', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.has(B1, 'isolated'), a.has(B1, 'float_noose')]).toEqual([90, true, true]);
  });

  it('Grand Eagle: 45 HP; Soar makes the Eagle and an ally Leap', () => {
    const a = arena({ p0: [['companion.wind'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.wind').end().pass(1);
    const eagle = a.state.units.find((u) => u.owner === 0 && u.defId === 'grand_eagle')!;
    expect(eagle.hp).toBe(45);
    a.use(eagle.id, 'eagle_soar', A2).end();
    expect([a.has(eagle.id, 'leaping'), a.has(A2, 'leaping')]).toEqual([true, true]);
  });

  it('Compressed Bolt: 15; stuns Immobile targets\' non-Strategic skills', () => {
    const a = arena({ p0: [['bolt.wind']], p1: [['shot'], ['charge']] });
    a.use(A1, 'bolt.wind', B1).end().pass(5).use(A1, 'bolt.wind', B2).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns'), a.has(B2, 'stun_ns')]).toEqual([85, false, false]);
    const b = arena({ p0: [['bolt.wind']], p1: [['shot']] });
    b.use(A1, 'bolt.wind', B1).end();
    expect(b.has(B1, 'stun_ns')).toBe(true);
  });

  it('Spiral Burst: 20 to all; the user begins Rushing if not Leaping', () => {
    const a = arena({ p0: [['blast.wind']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.wind').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'rushing')]).toEqual([80, 80, true]);
  });

  it('Spiral Burst: while Leaping, 10 more to all (plus Leaping\'s +5) and no Rushing', () => {
    const a = arena({ p0: [['blast.wind']], p1: [['shot'], ['shot']] });
    a.give(A1, 'leaping').use(A1, 'blast.wind').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'rushing')]).toEqual([65, 65, false]);
  });

  it('Sap Speed: strips Mobility buffs; Swiftness for the user if the target is then Immobile', () => {
    const a = arena({ p0: [['consume.wind']], p1: [['shot'], ['charge']] });
    a.give(B1, 'swiftness').give(B1, 'rushing').use(A1, 'consume.wind', B1).end();
    expect([a.hp(B1), a.has(B1, 'swiftness'), a.has(B1, 'rushing'), a.has(A1, 'swiftness')]).toEqual([
      95,
      false,
      false,
      true,
    ]);
    const b = arena({ p0: [['consume.wind']], p1: [['charge']] }); // has a mobility skill
    b.use(A1, 'consume.wind', B1).end();
    expect(b.has(A1, 'swiftness')).toBe(false);
  });

  it('Wind Sprites: two 10 HP minions; a countered Bother stuns the counterer', () => {
    const a = arena({ p0: [['summon.wind']], p1: [['riposte']] });
    a.use(A1, 'summon.wind').end();
    const sprites = a.state.units.filter((u) => u.owner === 0 && u.defId === 'wind_sprite');
    expect(sprites.map((s) => s.hp)).toEqual([10, 10]);
    a.use(B1, 'riposte').end();
    a.use(sprites[0]!.id, 'sprite_bother', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([100, true]);
  });

  it('Vortex: 10 to all per turn; extended once while Leaping or Rushing', () => {
    const a = arena({ p0: [['channel.wind']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.wind').end();
    const d = a.effects(A1).find((e) => e.defId.endsWith('vortex'))!.duration!;
    expect(a.hp(B1)).toBe(90);
    const b = arena({ p0: [['channel.wind']], p1: [['shot'], ['shot']] });
    b.give(A1, 'rushing').use(A1, 'channel.wind').end();
    expect(b.effects(A1).find((e) => e.defId.endsWith('vortex'))!.duration).toBe(d + 2);
  });

  it('Airknife: 10 and begins Rushing; 20 while Rushing', () => {
    const a = arena({ p0: [['stab.wind']], p1: [['shot']] });
    a.use(A1, 'stab.wind', B1).end();
    expect([a.hp(B1), a.has(A1, 'rushing')]).toEqual([90, true]);
    a.pass(1).use(A1, 'stab.wind', B1).end();
    expect([a.hp(B1), a.has(A1, 'rushing')]).toEqual([70, true]);
  });

  it('Sonic Thrust: 25 Piercing; the user is Stunned through their next turn unless Rushing', () => {
    const a = arena({ p0: [['ravage.wind']], p1: [['shot']] });
    a.use(A1, 'ravage.wind', B1).end().pass(1);
    expect([a.hp(B1), a.has(A1, 'stun')]).toEqual([75, true]);
    const b = arena({ p0: [['ravage.wind']], p1: [['shot']] });
    b.give(A1, 'rushing').use(A1, 'ravage.wind', B1).end();
    expect(b.has(A1, 'stun')).toBe(false);
  });

  it('Wind Step: a Harmful skill Marks its user and the caster begins Rushing', () => {
    const a = arena({ p0: [['mislead.wind']], p1: [['shot']] });
    a.use(A1, 'mislead.wind', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'mark'), a.has(A1, 'rushing')]).toEqual([85, true, true]);
  });

  it('Buffet: 10 and stuns Strategic skills', () => {
    const a = arena({ p0: [['stun.wind']], p1: [['shot', 'rage']] });
    a.use(A1, 'stun.wind', B1).end();
    expect(a.reject(() => a.use(B1, 'rage'))).toBe('cannot_act');
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 85]);
  });

  it('Top Speed: Might, Ghosted and Rushing', () => {
    const a = arena({ p0: [['dance.wind']], p1: [['shot']] });
    a.use(A1, 'dance.wind').end();
    expect(['might', 'ghosted', 'rushing'].map((s) => a.has(A1, s))).toEqual([true, true, true]);
  });

  it('Invigorating Breeze: 20 healing; Rushing if above 60 afterwards', () => {
    const a = arena({ p0: [['heal.wind'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp('p0c2', 30).use(A1, 'heal.wind', A2).end();
    expect([a.hp(A2), a.has(A2, 'rushing')]).toEqual([70, true]);
    a.pass(3).use(A1, 'heal.wind', 'p0c2').end();
    expect(a.has('p0c2', 'rushing')).toBe(false);
  });

  it('Swiftwind: 2 Swiftness', () => {
    const a = arena({ p0: [['bless.wind'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.wind', A2).end();
    expect(a.stacks(A2, 'swiftness')).toBe(2);
  });

  it('Headwind: strips Mobility buffs and gives Weakness', () => {
    const a = arena({ p0: [['curse.wind']], p1: [['shot']] });
    a.give(B1, 'leaping').use(A1, 'curse.wind', B1).end();
    expect([a.has(B1, 'leaping'), a.stacks(B1, 'weakness')]).toEqual([false, 1]);
  });

  it('Feathermark: allies that damage the target this turn Leap', () => {
    const a = arena({ p0: [['smite.wind'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.wind', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'leaping'), a.has(A2, 'leaping')]).toEqual([65, false, true]);
  });

  it('Uplifting Verse: heals allies 15, then every unit Leaps', () => {
    const a = arena({ p0: [['prayer.wind'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'prayer.wind').end();
    expect([a.hp(A2), a.has(A2, 'leaping'), a.has(B1, 'leaping'), a.has(B1, 'invulnerable')]).toEqual([65, true, true, true]);
  });

  it('Falling Slam: 10 to all; costs 1 less while Leaping or Rushing', () => {
    const a = arena({ p0: [['cleave.wind']], p1: [['shot']] });
    a.give(A1, 'rushing').use(A1, 'cleave.wind');
    expect(a.state.players[0].queue[0]?.cost).toMatchObject({ A: 1, r: 0 });
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Echoing Voice: every unit gains 1 Swiftness', () => {
    const a = arena({ p0: [['shout.wind'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.wind').end();
    expect([A1, A2, B1, B2].map((u) => a.stacks(u, 'swiftness'))).toEqual([1, 1, 1, 1]);
  });

  it('Slipstream: 15 Shield, 30 while Rushing', () => {
    const a = arena({ p0: [['withstand.wind']], p1: [['shot']] });
    a.give(A1, 'rushing').use(A1, 'withstand.wind').end();
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(30);
  });

  it('Piercing Cry: Taunt for 1 turn, 3 against Immobile targets', () => {
    const a = arena({ p0: [['taunt.wind']], p1: [['shot'], ['charge']] });
    a.use(A1, 'taunt.wind', B1).end().pass(7).use(A1, 'taunt.wind', B2).end();
    const d = (id: string) => a.effects(id).find((e) => e.defId === 'taunt')?.duration ?? 0;
    expect(d(B2)).toBeGreaterThan(0);
    const b = arena({ p0: [['taunt.wind']], p1: [['shot']] });
    b.use(A1, 'taunt.wind', B1).end();
    expect(b.effects(B1).find((e) => e.defId === 'taunt')!.duration).toBe(d(B2) + 4);
  });

  it('Djinnform: 15 Shield and Immune for 3 turns, then Leaps', () => {
    const a = arena({ p0: [['titan.wind']], p1: [['shot']] });
    a.use(A1, 'titan.wind').end();
    expect(['shield', 'immune', 'leaping', 'invulnerable'].map((s) => a.has(A1, s))).toEqual([true, true, true, true]);
  });
});
