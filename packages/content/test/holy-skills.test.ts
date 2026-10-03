// Scenarios for the Holy element (Anointed, Condemned, Sanctify synergies, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';
const A3 = 'p0c2';

const debuffCount = (a: ReturnType<typeof arena>, id: string) =>
  a.stacks(id, 'weakness') + a.stacks(id, 'vulnerable') + a.stacks(id, 'confusion');

describe('Holy statuses', () => {
  it('Condemned: the next skill the bearer uses gives them a random debuff, then Condemn ends', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 });
    a.pass(1).use(B1, 'shot', A1).end();
    expect(debuffCount(a, B1)).toBe(1);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Ghosted: the bearer’s skills can target and hit Invulnerable enemies', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'ghosted').give(B1, 'invulnerable');
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });
});

describe('Holy skills', () => {
  it('Righteous Blow: 20; if Anointed, 30 and heal 10', () => {
    const a = arena({ p0: [['strike.holy']], p1: [['shot']] });
    a.use(A1, 'strike.holy', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass().setHp(A1, 50).give(A1, 'anointed').use(A1, 'strike.holy', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([50, 60]);
  });

  it('Divine Storm: 20 + 10 splash; heals 5 per target hit', () => {
    const a = arena({ p0: [['smash.holy']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'smash.holy', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A1)]).toEqual([80, 90, 90, 65]);
  });

  it("Zealous Rush: 15; the user's next Harmful skill Sanctifies its targets (after the hit)", () => {
    const a = arena({ p0: [['charge.holy', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.holy', B1).end();
    expect(a.has(B1, 'sanctify')).toBe(false); // not on the Rush itself
    a.pass().setHp(A1, 50).use(A1, 'shot', B1).end();
    expect(a.has(B1, 'sanctify')).toBe(true);
    expect(a.hp(A1)).toBe(50); // Sanctify arrived after the hit, so no heal
    expect(a.has(A1, 'zealous_rush')).toBe(false);
  });

  it('Retribution: enemy direct damage heals the user instead for 1 turn', () => {
    const a = arena({ p0: [['riposte.holy']], p1: [['shot']] });
    a.setHp(A1, 60).use(A1, 'riposte.holy').end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(75);
    expect(a.has(A1, 'retribution')).toBe(false);
  });

  it('Divine Fury: Anointed for 3 turns', () => {
    const a = arena({ p0: [['rage.holy']], p1: [['shot']] });
    a.use(A1, 'rage.holy').end();
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(5);
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Sunbeam: 15; consumes Anointed to heal 15', () => {
    const a = arena({ p0: [['shot.holy']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'anointed').use(A1, 'shot.holy', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(A1, 'anointed')]).toEqual([85, 65, false]);
  });

  it('Spear of Light: 50 at the end of the following turn, target hidden', () => {
    const a = arena({ p0: [['snipe.holy']], p1: [['shot']] });
    a.use(A1, 'snipe.holy', B1).end();
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1)?.targets).toEqual([]);
    a.end();
    expect(a.hp(B1)).toBe(50);
  });

  it('Decree: Condemned for 2 turns', () => {
    const a = arena({ p0: [['trap.holy']], p1: [['shot']] });
    a.use(A1, 'trap.holy', B1).end();
    expect(a.has(B1, 'condemned')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect(debuffCount(a, B1)).toBe(1);
  });

  it('Cloister: Immune; also Invulnerable when Anointed', () => {
    const a = arena({ p0: [['maneuver.holy'], ['maneuver.holy']], p1: [['shot']] });
    a.give(A2, 'anointed').use(A1, 'maneuver.holy').use(A2, 'maneuver.holy').end();
    expect([a.has(A1, 'immune'), a.has(A1, 'invulnerable'), a.has(A2, 'invulnerable')]).toEqual([true, false, true]);
  });

  it('Sacred Lion: Sanctified Roar hits all and Sanctifies; Claws deal +10 to Sanctified', () => {
    const a = arena({ p0: [['companion.holy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.holy').end().pass(1);
    const lion = a.state.units.find((u) => u.defId === 'sacred_lion')!;
    a.use(lion.id, 'lion_roar').end();
    expect([a.hp(B1), a.has(B1, 'sanctify'), a.has(B2, 'sanctify')]).toEqual([90, true, true]);
    a.pass(1).use(lion.id, 'lion_claws', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Rebuke: 20 and Sanctify for 1 turn', () => {
    const a = arena({ p0: [['bolt.holy']], p1: [['shot']] });
    a.use(A1, 'bolt.holy', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([80, true]);
  });

  it('Holy Nova: 25 Piercing to all; if Anointed, again at the start of the next turn', () => {
    const a = arena({ p0: [['blast.holy']], p1: [['shot'], ['shot']] });
    a.give(A1, 'anointed').give(B1, 'armor', { stacks: 5 }).use(A1, 'blast.holy').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
    a.end(); // turn 2 ends → turn 3 starts: the Nova strikes again
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 50]);
  });

  it('Ascension: 5; against a Sanctified target, the user is permanently Anointed', () => {
    const a = arena({ p0: [['consume.holy']], p1: [['shot']] });
    a.give(B1, 'sanctify').use(A1, 'consume.holy', B1).end();
    expect(a.hp(B1)).toBe(95);
    const anoint = a.effects(A1).find((e) => e.defId === 'anointed');
    expect(anoint?.duration).toBeNull();
  });

  it("Ascension: otherwise, the enemy is Sanctified for 1 turn and the user Anointed until the end of their next turn", () => {
    const a = arena({ p0: [['consume.holy'], ['shot']], p1: [['shot']] });
    a.use(A1, 'consume.holy', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify'), a.has(A1, 'anointed')]).toEqual([95, true, true]);
    expect(a.effects(A1).find((e) => e.defId === 'anointed')?.duration).not.toBeNull();
    a.pass(1); // the enemy's turn ends: the 1-turn Sanctify is gone
    expect([a.has(B1, 'sanctify'), a.has(A1, 'anointed')]).toEqual([false, true]);
    a.pass(1); // the user's next turn ends: so does the Anoint
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Ascension: a Sanctify from an ally earlier in the turn already counts', () => {
    const a = arena({ p0: [['consume.holy'], ['bolt.holy']], p1: [['shot']] });
    a.use(A2, 'bolt.holy', B1).use(A1, 'consume.holy', B1).end();
    expect(a.effects(A1).find((e) => e.defId === 'anointed')?.duration).toBeNull();
  });

  it('Divine Blessing: its Blessing from Above Anoints an ally, then it dies', () => {
    const a = arena({ p0: [['summon.holy'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.holy').end().pass(1);
    const bless = a.state.units.find((u) => u.defId === 'divine_blessing')!;
    a.use(bless.id, 'blessing_from_above', A2).end();
    expect([a.has(A2, 'anointed'), a.unit(bless.id).alive]).toEqual([true, false]);
  });

  it('Consecration: each user turn, 10 damage to a random un-Sanctified enemy and Sanctify them', () => {
    const a = arena({ p0: [['channel.holy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.holy').end();
    expect([a.has(B1, 'sanctify'), a.has(B2, 'sanctify')].filter(Boolean)).toHaveLength(1);
    a.pass(2);
    expect([a.has(B1, 'sanctify'), a.has(B2, 'sanctify')]).toEqual([true, true]);
    a.pass(2);
    expect(a.hp(B1) + a.hp(B2)).toBe(180); // nobody left un-Sanctified: no further damage
  });

  it('Piercing Light: 10; 20 against Condemned or Sanctified targets, or when Anointed', () => {
    const a = arena({ p0: [['stab.holy'], ['stab.holy'], ['stab.holy']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'condemned', { source: A1 }).give(A3, 'anointed');
    a.use(A1, 'stab.holy', B1).use(A2, 'stab.holy', B2).use(A3, 'stab.holy', B3).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 80, 80]);
  });

  it('Crusade: 20 Piercing; Condemns targets above 75 health', () => {
    const a = arena({ p0: [['ravage.holy'], ['ravage.holy']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 70).use(A1, 'ravage.holy', B1).use(A2, 'ravage.holy', B2).end();
    expect([a.has(B1, 'condemned'), a.has(B2, 'condemned')]).toEqual([true, false]);
  });

  it("Martyrdom: the target's next Harmful skill permanently Anoints its targets", () => {
    const a = arena({ p0: [['mislead.holy'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.holy', B1).end();
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85); // not a counter
    expect(a.effects(A2).find((e) => e.defId === 'anointed')?.duration).toBeNull();
  });

  it("Repentance: an enemy who isn't Condemned is Condemned for 1 turn, not Stunned", () => {
    const a = arena({ p0: [['stun.holy']], p1: [['shot']] });
    a.use(A1, 'stun.holy', B1).end();
    expect([a.has(B1, 'condemned'), a.has(B1, 'stun')]).toEqual([true, false]);
    a.use(B1, 'shot', A1).end();
    expect(debuffCount(a, B1)).toBe(1); // the Condemn resolved on their skill
  });

  it("Repentance: a 1-turn Condemn it applies runs out after the enemy's turn", () => {
    const a = arena({ p0: [['stun.holy']], p1: [['shot']] });
    a.use(A1, 'stun.holy', B1).end().pass(1);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Repentance: an already Condemned enemy is Stunned for 1 turn instead', () => {
    const a = arena({ p0: [['stun.holy']], p1: [['shot'], ['shot']] });
    a.give(B2, 'condemned', { source: A1 });
    a.use(A1, 'stun.holy', B2).end();
    expect(a.has(B2, 'stun')).toBe(true);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect(a.has(B2, 'stun')).toBe(false);
  });

  it("Angel's Grace: Invulnerable, Immune and Ghosted for 3 turns", () => {
    const a = arena({ p0: [['dance.holy', 'shot']], p1: [['maneuver']] });
    a.use(A1, 'dance.holy').end();
    expect(['invulnerable', 'immune', 'ghosted'].every((k) => a.has(A1, k))).toBe(true);
    a.use(B1, 'maneuver').end();
    a.use(A1, 'shot', B1).end(); // Ghosted: hits the Invulnerable enemy
    expect(a.hp(B1)).toBe(85);
  });

  it('Hand of Light: heals an ally 50', () => {
    const a = arena({ p0: [['heal.holy'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 30).use(A1, 'heal.holy', A2).end();
    expect(a.hp(A2)).toBe(80);
  });

  it("Holy Favor: an ally is Anointed until the end of their next turn", () => {
    const a = arena({ p0: [['bless.holy'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.holy', A2).end();
    expect(a.has(A2, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A2, 'anointed')).toBe(true); // through their next turn…
    a.pass(1);
    expect(a.has(A2, 'anointed')).toBe(false); // …and gone after it
  });

  it("Mark of Heresy: Condemned and Sanctified until the end of the user's next turn", () => {
    const a = arena({ p0: [['curse.holy']], p1: [['shot']] });
    a.use(A1, 'curse.holy', B1).end();
    expect([a.has(B1, 'condemned'), a.has(B1, 'sanctify')]).toEqual([true, true]);
  });

  it('Karmic Marking: 15; Sanctify for 2 turns if the user is Anointed', () => {
    const a = arena({ p0: [['smite.holy'], ['smite.holy']], p1: [['shot'], ['shot']] });
    a.give(A2, 'anointed').use(A1, 'smite.holy', B1).use(A2, 'smite.holy', B2).end();
    expect([a.has(B1, 'sanctify'), a.has(B2, 'sanctify')]).toEqual([false, true]);
  });

  it('Saving Grace: heal 10 and 10 Shield to allies; if Anointed, again at the start of the next 2 user turns', () => {
    const a = arena({ p0: [['prayer.holy'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A1, 'anointed').use(A1, 'prayer.holy').end();
    expect(a.hp(A2)).toBe(60);
    a.end(); // → turn 3 starts: repeat
    expect(a.hp(A2)).toBe(70);
    a.pass(2); // → turn 5 starts: repeat
    expect(a.hp(A2)).toBe(80);
    a.pass(2); // → turn 7: no more
    expect(a.hp(A2)).toBe(80);
  });

  it('Guardian Strike: 10 to the target and a random enemy; hitting a Sanctified one heals allies 5', () => {
    const a = arena({ p0: [['cleave.holy'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(B2, 'sanctify').use(A1, 'cleave.holy', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    expect(a.hp(A2)).toBe(55);
  });

  it('Excoriate: Sanctified enemies are Condemned for 1 turn, even Invulnerable ones; the others are Sanctified', () => {
    const a = arena({ p0: [['shout.holy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sanctify').give(B1, 'invulnerable');
    a.use(A1, 'shout.holy').end();
    expect([a.has(B1, 'condemned'), a.has(B2, 'condemned')]).toEqual([true, false]);
    expect(a.has(B2, 'sanctify')).toBe(true);
  });

  it('Excoriate: with no Sanctified enemies, every enemy is Sanctified for 1 turn', () => {
    const a = arena({ p0: [['shout.holy'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'invulnerable').use(A1, 'shout.holy').end();
    expect([a.has(B1, 'sanctify'), a.has(B2, 'sanctify'), a.has(B1, 'condemned')]).toEqual([true, true, false]);
    a.pass(1);
    expect([a.has(B1, 'sanctify'), a.has(B2, 'sanctify')]).toEqual([false, false]);
  });

  it('Shield of Faith: 20 Shield; Immune for 2 turns if Anointed', () => {
    const a = arena({ p0: [['withstand.holy'], ['withstand.holy']], p1: [['shot']] });
    a.give(A2, 'anointed').use(A1, 'withstand.holy').use(A2, 'withstand.holy').end();
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(20);
    expect([a.has(A1, 'immune'), a.has(A2, 'immune')]).toEqual([false, true]);
  });

  it('Gleam: Taunted and Condemned until the target uses a new Harmful skill', () => {
    const a = arena({ p0: [['taunt.holy'], ['shot']], p1: [['shot', 'heal']] });
    a.use(A1, 'taunt.holy', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'shot', A1).end();
    expect([a.has(B1, 'taunt'), a.has(B1, 'condemned')]).toEqual([false, false]);
  });

  it('Grand Crusader: 10 to all enemies and Sanctify for 1 turn; 2 Might and 2 Armor for 3 turns', () => {
    const a = arena({ p0: [['titan.holy'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(A2, 50).use(A1, 'titan.holy').use(A2, 'shot', B1).end();
    expect([a.hp(B2), a.hp(B3)]).toEqual([90, 90]);
    expect(a.hp(A2)).toBe(65); // the ally's hit on a Sanctified enemy heals them 15
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([2, 2]);
    a.pass(1);
    expect([B1, B2, B3].some((b) => a.has(b, 'sanctify'))).toBe(false);
    a.pass(3); // through the enemy's third turn…
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([2, 2]);
    a.pass(1); // …and gone after it
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([0, 0]);
  });
});
