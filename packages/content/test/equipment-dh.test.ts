// Type H (accessory) and D (elemental weapon) equipment passives (docs/equipment.md).

import { describe, expect, it } from 'vitest';
import { arena, type Arena } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minions = (a: Arena, owner: 0 | 1) => a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion');
const shieldOn = (a: Arena, id: string) =>
  a.effects(id).filter((e) => ['shield', 'tempest_shield'].includes(e.inline ? e.inline.id : e.defId)).reduce((n, e) => n + e.value, 0);
const durationOf = (a: Arena, id: string, key: string) => a.effects(id).find((e) => e.defId === key)?.duration;

describe('Type H passives', () => {
  it('Crown of Flames: Shout, Curse and Taunt also deal 10 Affliction to a random enemy', () => {
    const a = arena({ p0: [['shout']], p1: [['shot']] });
    a.give(A1, 'eq_crown_of_flames').use(A1, 'shout').end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Flame Whip: an allied death resets Trap, Riposte and Mislead', () => {
    const a = arena({ p0: [['trap'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_flame_whip').use(A1, 'trap', B1).end();
    expect(a.cooldown(A1, 'trap')).toBeGreaterThan(0);
    a.setHp(A2, 5).use(B1, 'shot', A2).end();
    expect(a.cooldown(A1, 'trap')).toBe(0);
  });

  it('Frozen Gauntlets: Cleave, Withstand and Blast add 10 to your Shields', () => {
    const a = arena({ p0: [['withstand']], p1: [['shot']] });
    a.give(A1, 'eq_frozen_gauntlets').use(A1, 'withstand').end();
    expect(shieldOn(a, A1)).toBe(35);
  });

  it('Glacial Pendant: heal when your Stun runs out (10 at 40 Health or less)', () => {
    const a = arena({ p0: [['stun']], p1: [['shot']] });
    a.give(A1, 'eq_glacial_pendant').setHp(A1, 30).use(A1, 'stun', B1).end().pass(1);
    expect(a.hp(A1)).toBe(40);
  });

  it('Winged Sandals: once per turn, damage takes 1 off a Charge, Dance or Maneuver cooldown', () => {
    const a = arena({ p0: [['charge']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_winged_sandals').use(A1, 'charge', B1).end();
    const before = a.cooldown(A1, 'charge');
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.cooldown(A1, 'charge')).toBe(before - 1);
  });

  it('Rocfeather Cloak: Strike and Cleave +5 per Swiftness', () => {
    const a = arena({ p0: [['strike']], p1: [['shot']] });
    a.give(A1, 'eq_rocfeather_cloak').give(A1, 'swiftness', { stacks: 2 }).use(A1, 'strike', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Electroblade: Strike, Bolt and Charge also deal 5 Piercing to two random enemies', () => {
    const a = arena({ p0: [['strike']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_electroblade').use(A1, 'strike', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 95]);
  });

  it('Cybernetic Enhancements: Dance, Titan and Rage add Might, Armor and Swiftness', () => {
    const a = arena({ p0: [['rage']], p1: [['shot']] });
    a.give(A1, 'eq_cybernetic_enhancements').use(A1, 'rage').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor'), a.stacks(A1, 'swiftness')]).toEqual([3, 1, 1]);
  });

  it('Chalice of Life: Focus each turn while channeling, Confusion when it ends', () => {
    const a = arena({ p0: [['channel']], p1: [['shot']] });
    a.give(A1, 'eq_chalice_of_life').use(A1, 'channel').end().pass(1);
    expect(a.stacks(A1, 'focus')).toBe(1);
    a.pass(2);
    expect([a.has(A1, 'channel'), a.stacks(A1, 'focus'), a.stacks(A1, 'confusion')]).toEqual([false, 0, 1]);
  });

  it('Trident of the Deep: Bless, Heal and Withstand give 1 Renew', () => {
    const a = arena({ p0: [['withstand']], p1: [['shot']] });
    a.give(A1, 'eq_trident_of_the_deep').setHp(A1, 50).use(A1, 'withstand').end();
    expect(a.hp(A1)).toBe(55); // the Renew ticked once
  });

  it('Crown of the Caller: Buffs your Companion gains are copied to you', () => {
    const a = arena({ p0: [['companion'], ['bless']], p1: [['shot']] });
    a.give(A1, 'eq_crown_of_the_caller').use(A1, 'companion').end().pass(1);
    a.use(A2, 'bless', minions(a, 0)[0]!.id).end();
    expect(a.stacks(A1, 'might')).toBe(1);
  });

  it("Earthcaller's Hammer: Stun and Smash remove a random Buff from the primary target", () => {
    const a = arena({ p0: [['stun']], p1: [['shot']] });
    a.give(A1, 'eq_earthcallers_hammer').give(B1, 'might').use(A1, 'stun', B1).end();
    expect(a.has(B1, 'might')).toBe(false);
  });

  it('Lotus Essence: Ravage and Consume extend non-Stun Debuffs by a turn', () => {
    const a = arena({ p0: [['ravage']], p1: [['shot']] });
    a.give(A1, 'eq_lotus_essence').give(B1, 'weakness', { duration: 3 }).give(B1, 'stun', { duration: 3 });
    a.use(A1, 'ravage', B1).end();
    expect([durationOf(a, B1, 'weakness'), durationOf(a, B1, 'stun')]).toEqual([4, 2]);
  });

  it('Cryptid Dagger: Stab and Strike +5 against Prey', () => {
    const a = arena({ p0: [['stab']], p1: [['shot']] });
    a.give(A1, 'eq_cryptid_dagger').give(B1, 'prey').use(A1, 'stab', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Cloak of Night: Mislead, Riposte and Maneuver cooldowns −1, never below 1', () => {
    const a = arena({ p0: [['riposte']], p1: [['shot']] });
    a.give(A1, 'eq_cloak_of_night').use(A1, 'riposte').end();
    expect(a.cooldown(A1, 'riposte')).toBe(2); // 3 − 1, +1 on use, −1 at the end of the turn
    const b = arena({ p0: [['riposte']], p1: [['shot']] });
    b.give(A1, 'eq_cloak_of_night').give(A1, 'eq_cloak_of_night').give(A1, 'eq_cloak_of_night').use(A1, 'riposte').end();
    expect(b.cooldown(A1, 'riposte')).toBe(1); // floored at 1
  });

  it('Wightblades: Stab and Shot −5, but Bypass and uncounterable', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte']] });
    a.give(A1, 'eq_wightblades').pass(1).use(B1, 'riposte').end();
    a.give(B1, 'invulnerable').use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 100]);
  });

  it('Revered Crown: allies you heal get 5 Shield; allies you Shield heal 5', () => {
    const a = arena({ p0: [['prayer'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_revered_crown').setHp(A2, 50).use(A1, 'prayer').end();
    expect([a.hp(A2), shieldOn(a, A2), shieldOn(a, A1)]).toEqual([85, 15, 10]);
  });

  it('Penance Lash: effects from Bolt and Smite last a turn longer', () => {
    const a = arena({ p0: [['bolt']], p1: [['shot']] });
    a.give(A1, 'eq_penance_lash').use(A1, 'bolt', B1).end();
    expect(durationOf(a, B1, 'mark')).toBe(3); // 2 + 2, −1 at the end of the turn
  });

  it('Helm of the Damned: Bless and Curse give you Might or Armor for as long as their effect', () => {
    const a = arena({ p0: [['bless'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_helm_of_the_damned').use(A1, 'bless', A2).end();
    expect(a.stacks(A1, 'might') + a.stacks(A1, 'armor')).toBe(1);
    a.pass(6);
    expect(a.stacks(A1, 'might') + a.stacks(A1, 'armor')).toBe(0);
  });

  it('The Black Blade: Ravage and Charge steal a random non-elemental Buff', () => {
    const a = arena({ p0: [['ravage']], p1: [['shot']] });
    a.give(A1, 'eq_the_black_blade').give(B1, 'might').give(B1, 'frostborn').use(A1, 'ravage', B1).end();
    expect([a.stacks(A1, 'might'), a.has(B1, 'might'), a.has(B1, 'frostborn')]).toEqual([1, false, true]);
  });
});

describe('Type D passives', () => {
  it('Emblem of the Inferno: your Ignites stack twice', () => {
    const run = (emblem: boolean) => {
      const a = arena({ p0: [['strike.fire']], p1: [['shot']] });
      if (emblem) a.give(A1, 'eq_emblem_of_the_inferno');
      a.use(A1, 'strike.fire', B1).end().pass(1).use(A1, 'strike.fire', B1).end();
      const tick = a.last.filter((e) => e.t === 'damage' && e.type === 'Affliction').at(-1);
      return [a.stacks(B1, 'ignite'), tick && 'amount' in tick ? tick.amount : 0];
    };
    expect(run(true)).toEqual([2, 10]);
    expect(run(false)).toEqual([1, 5]);
  });

  it('Emblem of the Arc Furnace: +5 effect damage against Shattered enemies', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_arc_furnace').give(B1, 'shattered').give(B1, 'ignite', { source: A1 }).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Emblem of the Hellfire: damaging an ally gives you a random Buff', () => {
    const a = arena({ p0: [['heal.poison'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_hellfire').setHp(A2, 50).use(A1, 'heal.poison', A2).end(); // Toxin ticks on A2
    expect(a.effects(A1).filter((e) => ['might', 'armor', 'swiftness', 'focus'].includes(e.defId)).length).toBeGreaterThan(0);
  });

  it('Emblem of the Glacier: double Armor while Frostborn', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_glacier').give(A1, 'frostborn').give(A1, 'armor').pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95);
  });

  it('Emblem of the Permafrost: allies start with 10 Shield; minions arrive with 5', () => {
    const a = arena({ p0: [['companion'], ['shot']], p1: [['shot']], passives: { [A1]: ['eq_emblem_of_the_permafrost'] } });
    expect([shieldOn(a, A1), shieldOn(a, A2)]).toEqual([10, 10]);
    a.use(A1, 'companion').end();
    expect(shieldOn(a, minions(a, 0)[0]!.id)).toBe(5);
  });

  it('Emblem of the Frostflame: gaining Shield deals 5 Affliction to all enemies', () => {
    const a = arena({ p0: [['withstand']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_emblem_of_the_frostflame').use(A1, 'withstand').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 95]);
  });

  it('Emblem of the Gale: +1 Might each turn while Rushing, lost when Rush ends', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_gale').give(A1, 'rushing').use(A1, 'shot', B1).end().pass(1);
    expect(a.stacks(A1, 'might')).toBe(1);
    a.use(A1, 'shot', B1).end().pass(1);
    expect(a.stacks(A1, 'might')).toBe(2);
    a.end(); // no skill: Rush ends
    expect([a.has(A1, 'rushing'), a.stacks(A1, 'might')]).toEqual([false, 0]);
  });

  it('Emblem of the Miasma: +10 against each enemy until it damages you', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_miasma').use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
    a.use(B1, 'shot', A1).end().use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Emblem of the Monsoon: heal 10 when your Swiftness stops a Stun', () => {
    const a = arena({ p0: [['shot']], p1: [['stun']] });
    a.give(A1, 'eq_emblem_of_the_monsoon').give(A1, 'swiftness').setHp(A1, 50).pass(1).use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.hp(A1)]).toEqual([false, 45]); // 15 damage, then the heal
  });

  it('Emblem of the Tempest: Charge turning into energy gives a refreshing 15 Shield', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_tempest').give(A1, 'charged', { stacks: 3 }).pass(2);
    expect([a.has(A1, 'charged'), shieldOn(a, A1)]).toEqual([false, 15]);
  });

  it('Emblem of the Blackout: enemies becoming Invulnerable take 10', () => {
    const a = arena({ p0: [['shot']], p1: [['maneuver']] });
    a.give(A1, 'eq_emblem_of_the_blackout').pass(1).use(B1, 'maneuver').end();
    expect([a.has(B1, 'invulnerable'), a.hp(B1)]).toEqual([true, 90]);
  });

  it('Emblem of the Aurora: a random Buff at the start of each of your turns', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_aurora').pass(2);
    const pool = ['might', 'armor', 'swiftness', 'focus', 'stormborn', 'frostborn'];
    expect(a.effects(A1).filter((e) => pool.includes(e.defId))).toHaveLength(1);
  });

  it('Emblem of the Tide: Flow ignoring a counter gives Swiftness (Focus if you have some)', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte']] });
    a.give(A1, 'eq_emblem_of_the_tide').give(A1, 'flow').pass(1).use(B1, 'riposte').end().use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1), a.stacks(A1, 'swiftness')]).toEqual([85, 100, 1]);
  });

  it('Emblem of the Abyss: countering an enemy deals 10 Piercing to them', () => {
    const a = arena({ p0: [['riposte']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_abyss').use(A1, 'riposte').end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 10);
  });

  it('Emblem of the Bloodtide: heal 5 on using a damaging skill', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_bloodtide').setHp(A1, 50).use(A1, 'shot', B1).end();
    expect(a.hp(A1)).toBe(55);
  });

  it('Emblem of the Mountain: heal 5 when an allied Seedling Channels Earth', () => {
    const a = arena({ p0: [['summon.earth']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_mountain').setHp(A1, 50).use(A1, 'summon.earth').end().pass(1);
    a.use(minions(a, 0)[0]!.id, 'seedling_channel_earth').end();
    expect(a.hp(A1)).toBe(55);
  });

  it('Emblem of the Sanctuary: heal 10 each turn until you use a Harmful skill', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_sanctuary').setHp(A1, 50).pass(2);
    expect(a.hp(A1)).toBe(60);
    a.use(A1, 'shot', B1).end().pass(1);
    expect(a.hp(A1)).toBe(60);
  });

  it('Emblem of the Magma: double damage to the first minion each turn', () => {
    const a = arena({ p0: [['blast']], p1: [['companion'], ['companion']] });
    a.give(A1, 'eq_emblem_of_the_magma').pass(1).use(B1, 'companion').use(B2, 'companion').end();
    const wolves = minions(a, 1);
    for (const w of wolves) a.setHp(w.id, 100);
    a.use(A1, 'blast').end();
    expect(wolves.map((w) => a.hp(w.id))).toEqual([30, 65]);
  });

  it('Emblem of the Serpent: once per turn, Might for dealing damage or Armor for taking it', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_serpent').use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'might')).toBe(1);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'armor')).toBe(1);
  });

  it('Emblem of the Neurotoxin: leftover energy gives a random allied character Might', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_neurotoxin').end();
    expect(a.stacks(A1, 'might')).toBe(1);
  });

  it('Emblem of the Bog: allied minions deal 5 Affliction to a random enemy when they die', () => {
    const a = arena({ p0: [['companion']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_bog').use(A1, 'companion').end(); // the Wolf bites B1 for 10
    const wolf = minions(a, 0)[0]!.id;
    a.setHp(wolf, 5).use(B1, 'shot', wolf).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Emblem of the Void: an idle turn extends Invulnerable once', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_void').give(A1, 'invulnerable', { duration: 3 }).end();
    expect(durationOf(a, A1, 'invulnerable')).toBe(4); // 3 + 2, −1
    a.pass(2);
    expect(durationOf(a, A1, 'invulnerable')).toBe(2); // not again
  });

  it('Emblem of the Phantom: +10 Piercing when you damage an Invulnerable enemy', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_phantom').give(A1, 'ghosted').give(B1, 'invulnerable').use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Emblem of the Eclipse: your Marks going off apply 1 Weakness', () => {
    const a = arena({ p0: [['bolt'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_eclipse').use(A1, 'bolt', B1).use(A2, 'shot', B1).end();
    expect([a.has(B1, 'mark'), a.stacks(B1, 'weakness')]).toEqual([false, 1]);
  });

  it('Emblem of the Sun: damaging a Sanctified enemy gives permanent Might', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_sun').give(B1, 'sanctify').use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'might')).toBe(1);
  });

  it('Emblem of the Seraph: the first Stun makes you Invulnerable (once per match)', () => {
    const a = arena({ p0: [['shot']], p1: [['stun']] });
    a.give(A1, 'eq_emblem_of_the_seraph').pass(1).use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.has(A1, 'invulnerable')]).toEqual([true, true]);
  });

  it('Emblem of the Font: Anointing an ally cleanses their Debuffs', () => {
    const a = arena({ p0: [['bless.holy'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_font').give(A2, 'weakness').give(A2, 'confusion').use(A1, 'bless.holy', A2).end();
    expect([a.has(A2, 'anointed'), a.has(A2, 'weakness'), a.has(A2, 'confusion')]).toEqual([true, false, false]);
  });

  it('Emblem of the Grave: an allied character dying gives Might and heals 10', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_grave').setHp(A1, 50).setHp(A2, 5).pass(1).use(B1, 'shot', A2).end();
    expect([a.stacks(A1, 'might'), a.hp(A1)]).toEqual([1, 60]);
  });

  it('Emblem of the Plague: stacking Debuffs you give or get are permanent', () => {
    const a = arena({ p0: [['curse']], p1: [['curse']] });
    a.give(A1, 'eq_emblem_of_the_plague').use(A1, 'curse', B1).end().use(B1, 'curse', A1).end();
    expect([durationOf(a, B1, 'confusion'), durationOf(a, A1, 'confusion')]).toEqual([null, null]);
  });

  it('Emblem of the Lich: Harmful skills give you and your minions 5 Shield', () => {
    const a = arena({ p0: [['companion', 'shot']], p1: [['shot']] });
    a.give(A1, 'eq_emblem_of_the_lich').use(A1, 'companion').end().pass(1).use(A1, 'shot', B1).end();
    expect([shieldOn(a, A1), shieldOn(a, minions(a, 0)[0]!.id)]).toEqual([5, 5]);
  });
});
