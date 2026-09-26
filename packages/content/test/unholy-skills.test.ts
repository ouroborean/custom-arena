// Scenarios for the Unholy element (Horrified, Immortal, Soul Fragments, Lifesteal, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

describe('Unholy statuses', () => {
  it('Horrified: can\'t gain Buffs, even from themselves', () => {
    const a = arena({ p0: [['shot']], p1: [['rage']] });
    a.give(B1, 'horrified', { source: A1 }).pass(1).use(B1, 'rage').end();
    expect(a.has(B1, 'might')).toBe(false);
  });

  it('Immortal: Health can\'t fall below 5', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'immortal').setHp(B1, 10).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.unit(B1).alive]).toEqual([5, true]);
  });

  it('Soul Fragment: +5 direct damage per stack', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Lifesteal: heals for Health removed (not Shield-absorbed damage)', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'lifesteal').setHp(A1, 50).give(B1, 'shield', { value: 10 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 55]);
  });
});

describe('Unholy skills', () => {
  it('Witchblade: 25, or 35 against a Horrified enemy', () => {
    const a = arena({ p0: [['strike.unholy']], p1: [['shot'], ['shot']] });
    a.give(B2, 'horrified', { source: A1 }).use(A1, 'strike.unholy', B1).end().pass(3);
    a.use(A1, 'strike.unholy', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 65]);
  });

  it('Soulcrusher: 40 and Horrifies the target\'s allies', () => {
    const a = arena({ p0: [['smash.unholy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.unholy', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([60, false, true]);
  });

  it('Wraithwalk: the next Harmful skill (not Wraithwalk itself) drains a Soul Fragment', () => {
    const a = arena({ p0: [['charge.unholy', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.unholy', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment'), a.has(A1, 'wraithwalk')]).toEqual([85, 0, true]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'soul_fragment'), a.has(A1, 'wraithwalk')]).toEqual([1, false]);
  });

  it('Spiteful Retort: counters Harmful skills and Horrifies the attacker', () => {
    const a = arena({ p0: [['riposte.unholy']], p1: [['shot']] });
    a.use(A1, 'riposte.unholy').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'horrified')]).toEqual([100, true]);
  });

  it('Undying Fury: 10 per consumed fragment to random enemies, then Immortal that long', () => {
    const a = arena({ p0: [['rage.unholy']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'rage.unholy').end();
    expect(200 - a.hp(B1) - a.hp(B2)).toBe(30); // fragments are gone before the hits: no Might
    expect([a.stacks(A1, 'soul_fragment'), a.has(A1, 'immortal')]).toEqual([0, true]);
    const b = arena({ p0: [['rage.unholy']], p1: [['shot']] });
    b.use(A1, 'rage.unholy').end();
    expect([b.hp(B1), b.has(A1, 'immortal')]).toEqual([100, false]);
  });

  it('Bone Shard: +5 per fragment (plus their Might)', () => {
    const a = arena({ p0: [['shot.unholy']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'shot.unholy', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Soul Lance: 40 a turn later; drains a fragment if the target ends below 50', () => {
    const a = arena({ p0: [['snipe.unholy']], p1: [['shot']] });
    a.setHp(B1, 80).use(A1, 'snipe.unholy', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([40, 1]);
    const b = arena({ p0: [['snipe.unholy']], p1: [['shot']] });
    b.use(A1, 'snipe.unholy', B1).end().pass(2);
    expect([b.hp(B1), b.stacks(A1, 'soul_fragment')]).toEqual([60, 0]);
  });

  it('Soul Shackle: the next skill Stuns its user and gives 2 Weakness; fires once', () => {
    const a = arena({ p0: [['trap.unholy']], p1: [['shot']] });
    a.use(A1, 'trap.unholy', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'stun'), a.stacks(B1, 'weakness'), a.has(B1, 'soul_shackle')]).toEqual([
      95, // the trap fires on use, so its Weakness already weakens the Shot
      true,
      2,
      false,
    ]);
  });

  it('Grave Step: invisible Immortal for 1 turn', () => {
    const a = arena({ p0: [['maneuver.unholy']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'maneuver.unholy').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(5);
  });

  it('Hellhound: 35 HP; Jaws of Hell channels 10 Affliction per turn', () => {
    const a = arena({ p0: [['companion.unholy']], p1: [['shot']] });
    a.use(A1, 'companion.unholy').end().pass(1);
    const dog = a.state.units.find((u) => u.owner === 0 && u.defId === 'hellhound')!;
    expect(dog.hp).toBe(35);
    a.give(B1, 'armor', { stacks: 3 }).use(dog.id, 'hellhound_jaws', B1).end();
    const after = a.hp(B1);
    expect(after).toBe(90);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
  });

  it('Fel Bolt: 25 and Horrified', () => {
    const a = arena({ p0: [['bolt.unholy']], p1: [['shot']] });
    a.use(A1, 'bolt.unholy', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([75, true]);
  });

  it('Soul Blast: 25 to all, +10 per fragment', () => {
    const a = arena({ p0: [['blast.unholy']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment').use(A1, 'blast.unholy').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 60]); // 25 + 10 + 5 Might
  });

  it('Drain Soul: 5 and a fragment; two against a Horrified target', () => {
    const a = arena({ p0: [['consume.unholy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'consume.unholy', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([95, 1]);
    a.give(B2, 'horrified', { source: A1 }).pass(5).use(A1, 'consume.unholy', B2).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(3);
  });

  it('Imp: 25 HP; Firebolt is 10 Affliction, Gleeful Torment Horrifies', () => {
    const a = arena({ p0: [['summon.unholy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.unholy').end().pass(1);
    const imp = a.state.units.find((u) => u.owner === 0 && u.defId === 'imp')!;
    expect(imp.hp).toBe(25);
    a.give(B1, 'armor', { stacks: 2 }).use(imp.id, 'imp_firebolt', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1).use(imp.id, 'imp_gleeful_torment', B2).end();
    expect(a.has(B2, 'horrified')).toBe(true);
  });

  it('Drain Life: 10 damage and 10 healing per turn; the mark ends with the channel', () => {
    const a = arena({ p0: [['channel.unholy', 'shot']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'channel.unholy', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'drained')]).toEqual([90, 60, true]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.has(A1, 'drain_life'), a.has(B1, 'drained')]).toEqual([false, false]);
  });

  it('Drain Life: a target that dies while drained (from any source) gives a fragment', () => {
    const a = arena({ p0: [['channel.unholy'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 30).use(A1, 'channel.unholy', B1).end(); // 20 left
    a.pass(1).use(A2, 'shot', B1).end(); // 5 left after the shot, then the tick kills
    expect(a.unit(B1).alive).toBe(false);
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Blighted Dagger: drains a fragment from targets at 70+ health', () => {
    const a = arena({ p0: [['stab.unholy']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 69).use(A1, 'stab.unholy', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([85, 1]);
    a.pass(1).use(A1, 'stab.unholy', B2).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Lay Waste: 35 Piercing; Horrifies a target that has Buffs', () => {
    const a = arena({ p0: [['ravage.unholy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.unholy', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([65, true]);
    a.pass(5).use(A1, 'ravage.unholy', B2).end();
    expect(a.has(B2, 'horrified')).toBe(false);
  });

  it('Mirage of Nightmares: counters Strategic skills (either kind) and empowers the caster', () => {
    const a = arena({ p0: [['mislead.unholy']], p1: [['rage', 'shot']] });
    a.use(A1, 'mislead.unholy', B1).end();
    a.use(B1, 'rage').end();
    expect(a.has(B1, 'might')).toBe(false);
    expect(['untargetable', 'might', 'swiftness'].map((s) => a.has(A1, s))).toEqual([true, true, true]);
    const b = arena({ p0: [['mislead.unholy']], p1: [['shot']] });
    b.use(A1, 'mislead.unholy', B1).end().use(B1, 'shot', A1).end();
    expect([b.hp(A1), b.has(A1, 'might')]).toEqual([85, false]);
  });

  it('Cripple: permanent Vulnerable, plus Weakness if Horrified', () => {
    const a = arena({ p0: [['stun.unholy']], p1: [['shot'], ['shot']] });
    a.give(B2, 'horrified', { source: A1 }).use(A1, 'stun.unholy', B1).end().pass(7);
    a.use(A1, 'stun.unholy', B2).end();
    expect([a.has(B1, 'vulnerable'), a.has(B1, 'weakness')]).toEqual([true, false]);
    expect([a.has(B2, 'vulnerable'), a.has(B2, 'weakness')]).toEqual([true, true]);
  });

  it('Grisly Spectacle: 15 Piercing, extends Horrify, and Confuses the user', () => {
    const a = arena({ p0: [['dance.unholy']], p1: [['shot'], ['shot']] });
    a.give(B2, 'horrified', { source: A1, duration: 1 }).give(B1, 'armor');
    a.use(A1, 'dance.unholy', B1).end();
    expect([a.hp(B1), a.has(B2, 'horrified'), a.stacks(A1, 'confusion')]).toEqual([85, true, 1]);
  });

  it('Consume Lesser: 15 to another ally, heals the user 20; can\'t target the user', () => {
    const a = arena({ p0: [['heal.unholy'], ['shot']], p1: [['shot']] });
    expect(a.reject(() => a.use(A1, 'heal.unholy', A1))).toBe('bad_target');
    a.setHp(A1, 50).use(A1, 'heal.unholy', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 85]);
  });

  it('Vampirism: ally gains Lifesteal', () => {
    const a = arena({ p0: [['bless.unholy'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.unholy', A2).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(65);
  });

  it('Cause Fear: Horrified only for the rest of this turn (combos with queued skills)', () => {
    const a = arena({ p0: [['curse.unholy'], ['strike.unholy']], p1: [['shot']] });
    a.use(A1, 'curse.unholy', B1).use(A2, 'strike.unholy', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([65, false]);
  });

  it('Soul Sickness: allies that damage the target this turn gain a fragment', () => {
    const a = arena({ p0: [['smite.unholy'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.unholy', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment')]).toEqual([65, 0, 1]);
  });

  it('Profane Chant: 20 to all enemies and 2 Weakness', () => {
    const a = arena({ p0: [['prayer.unholy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'prayer.unholy').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B2, 'weakness')]).toEqual([80, 80, 2]);
  });

  it('Oathbreaker Strike: 25 Piercing + 10 to the target, and 10 to the user\'s allies', () => {
    const a = arena({ p0: [['cleave.unholy'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.unholy', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([65, 100, 100, 90, 90]);
  });

  it('Soulshriek: 20; spending a fragment makes it 30 and Horrifies', () => {
    const a = arena({ p0: [['shout.unholy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.unholy', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([80, false]);
    a.give(A1, 'soul_fragment', { stacks: 2 }).pass(7).use(A1, 'shout.unholy', B2).end();
    expect([a.hp(B2), a.has(B2, 'horrified'), a.stacks(A1, 'soul_fragment')]).toEqual([65, true, 1]);
  });

  it('Misery: drains 10 from each other ally into 20 + drained Shield', () => {
    const a = arena({ p0: [['withstand.unholy'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'withstand.unholy').end();
    expect([a.hp(A2), a.hp(A3)]).toEqual([90, 90]);
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(40);
  });

  it('Unrelenting Horror: Taunt; Lifesteal for the user if the target is Horrified', () => {
    const a = arena({ p0: [['taunt.unholy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.unholy', B1).end();
    expect([a.has(B1, 'taunt'), a.has(A1, 'lifesteal')]).toEqual([true, false]);
    a.give(B2, 'horrified', { source: A1 }).pass(7).use(A1, 'taunt.unholy', B2).end();
    expect(a.has(A1, 'lifesteal')).toBe(true);
  });

  it('Soul Colossus: consumes fragments to heal 5 each, then 2 Armor and Immortal that long', () => {
    const a = arena({ p0: [['titan.unholy']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).setHp(A1, 50).use(A1, 'titan.unholy').end();
    expect([a.hp(A1), a.stacks(A1, 'armor'), a.has(A1, 'immortal'), a.stacks(A1, 'soul_fragment')]).toEqual([
      60,
      2,
      true,
      0,
    ]);
  });
});
