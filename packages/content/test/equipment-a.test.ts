// Type A equipment passives (docs/equipment.md). A passive is a permanent status on its wearer,
// given here directly with the harness; in a real match the loadout resolver adds it.

import { describe, expect, it } from 'vitest';
import { arena, type Arena } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const energy = (a: Arena, p: 0 | 1) => Object.values(a.state.players[p].energy).reduce((x, y) => x + y, 0);
const minion = (a: Arena, owner: 0 | 1) => a.state.units.find((u) => u.alive && u.owner === owner && u.kind === 'minion')!;

describe('Type A passives', () => {
  it('Wind Katana: Strikes +5, plus 5 per energy of cost', () => {
    const a = arena({ p0: [['strike']], p1: [['shot']] });
    a.give(A1, 'eq_wind_katana').use(A1, 'strike', B1).end();
    expect(a.hp(B1)).toBe(70); // 20 + 5 + 5×1
  });

  it('Magma Hammer: Smash +10 to every target, and +1 random cost', () => {
    const a = arena({ p0: [['smash']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_magma_hammer').use(A1, 'smash', B1);
    expect(a.state.players[0].queue[0]!.cost).toMatchObject({ S: 1, r: 2 });
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 75]);
  });

  it('Water Spear: Charge +5; then all costs are random for a turn', () => {
    const a = arena({ p0: [['charge', 'strike']], p1: [['shot']] });
    a.give(A1, 'eq_water_spear').use(A1, 'charge', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(1).use(A1, 'strike', B1);
    expect(a.state.players[0].queue[0]!.cost).toMatchObject({ S: 0, r: 0 }); // Charge's Focus paid the r
  });

  it('Poison Rapier: the first Riposte counter resets its cooldown, once per match', () => {
    const a = arena({ p0: [['riposte']], p1: [['shot']] });
    a.give(A1, 'eq_poison_rapier').use(A1, 'riposte').end().use(B1, 'shot', A1).end();
    expect(a.cooldown(A1, 'riposte')).toBe(0);
    a.use(A1, 'riposte').end().use(B1, 'shot', A1).end();
    expect(a.cooldown(A1, 'riposte')).toBeGreaterThan(0);
  });

  it('Unholy Cleaver: Rage gives 10 Shield per 20 missing Health', () => {
    const a = arena({ p0: [['rage']], p1: [['shot']] });
    a.give(A1, 'eq_unholy_cleaver').setHp(A1, 50).use(A1, 'rage').end();
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(20);
  });

  it('Ice Kunai: each Shot on the same target hits 5 harder', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_ice_kunai').use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 20);
  });

  it('Shadow Arbalest: Snipes are visible, Bypass, and ignore counters', () => {
    const a = arena({ p0: [['snipe']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.give(A1, 'eq_shadow_arbalest').use(A1, 'snipe', B1).end();
    const used = a.last.find((e) => e.t === 'skillUsed');
    expect(used && 'secretFrom' in used ? used.secretFrom : undefined).toBeUndefined();
    expect(a.last.some((e) => e.t === 'skillCountered')).toBe(false);
  });

  it('Vine Whip: a Trap that expires untriggered takes 1 off Trap cooldowns', () => {
    const run = (whip: boolean) => {
      const a = arena({ p0: [['trap']], p1: [['shot']] });
      if (whip) a.give(A1, 'eq_vine_whip');
      a.use(A1, 'trap', B1).end().pass(5);
      return a.cooldown(A1, 'trap');
    };
    expect(run(true)).toBe(Math.max(0, run(false) - 1));
  });

  it('Lightsaber Dirk: a self Maneuver can be cast on an ally, with +1 cooldown', () => {
    const a = arena({ p0: [['maneuver'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_lightsaber_dirk').use(A1, 'maneuver', A2).end();
    expect([a.has(A2, 'invulnerable'), a.has(A1, 'invulnerable')]).toEqual([true, false]);
    expect(a.cooldown(A1, 'maneuver')).toBe(4); // 3 + 1 (+1 on use, −1 at end of turn)
  });

  it('Ice Claw: Companion minions pay everything with random energy', () => {
    const a = arena({ p0: [['companion']], p1: [['shot']] });
    a.give(A1, 'eq_ice_claw').use(A1, 'companion').end();
    expect(a.has(minion(a, 0).id, 'ice_claw_gen')).toBe(true);
  });

  it('Fire Sceptre: Bolts get double Might', () => {
    const a = arena({ p0: [['bolt']], p1: [['shot']] });
    a.give(A1, 'eq_fire_sceptre').give(A1, 'might', { stacks: 2 }).use(A1, 'bolt', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 10 - 10);
  });

  it('Holy Book: Blasts +10 per dead enemy character', () => {
    const a = arena({ p0: [['blast']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_holy_book');
    a.unit(B2).alive = false;
    a.use(A1, 'blast').end();
    expect(a.hp(B1)).toBe(55);
  });

  it('Twisted Wand: Consume an allied Summon minion to heal 10 and gain 10 Shield', () => {
    const a = arena({ p0: [['summon', 'consume']], p1: [['shot']] });
    a.give(A1, 'eq_twisted_wand').use(A1, 'summon').end().pass(1);
    const fam = minion(a, 0);
    a.setHp(A1, 50).use(A1, 'consume', fam.id).end();
    expect([a.unit(fam.id).alive, a.hp(A1), a.effects(A1).find((e) => e.defId === 'shield')?.value]).toEqual([false, 60, 10]);
  });

  it('Sacrificial Dagger: healing you also heals your Summon minions', () => {
    const a = arena({ p0: [['summon'], ['heal']], p1: [['shot']] });
    a.give(A1, 'eq_sacrificial_dagger').use(A1, 'summon').end().pass(1);
    const fam = minion(a, 0);
    a.unit(fam.id).hp = 1;
    a.setHp(A1, 90).use(A2, 'heal', A1).end();
    expect(a.hp(fam.id)).toBe(11); // A1 healed 10 (capped at 100)
  });

  it('Holy Censer: 10 Shield at the end of each turn you channel', () => {
    const a = arena({ p0: [['channel']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_holy_censer').use(A1, 'channel').end();
    expect(a.effects(A1).filter((e) => e.defId === 'shield').map((e) => e.value)).toEqual([10]);
  });

  it('Scything Claw: a Stab bonus cuts all cooldowns by 1', () => {
    const run = (claw: boolean) => {
      const a = arena({ p0: [['stab', 'smash']], p1: [['shot']] });
      if (claw) a.give(A1, 'eq_scything_claw');
      a.use(A1, 'smash', B1).end().pass(1);
      a.setHp(B1, 50).use(A1, 'stab', B1).end();
      return a.cooldown(A1, 'smash');
    };
    expect(run(true)).toBe(run(false) - 1);
  });

  it('Lightning Dagger: Ravage +5 per ally that acted before it this turn', () => {
    const a = arena({ p0: [['ravage'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_lightning_dagger');
    a.use(A2, 'shot', B2).use(A3, 'shot', B2).use(A1, 'ravage', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 10);
  });

  it('Mist Fan: when your Mislead goes off, your skills Bypass', () => {
    const a = arena({ p0: [['mislead']], p1: [['shot']] });
    a.give(A1, 'eq_mist_fan').use(A1, 'mislead', B1).end().use(B1, 'shot', A1).end();
    expect(a.has(A1, 'ghosted')).toBe(true);
  });

  it('Sun Baton: your Stuns also Shatter, for as long', () => {
    const a = arena({ p0: [['stun']], p1: [['shot']] });
    a.give(A1, 'eq_sun_baton').use(A1, 'stun', B1).end();
    const stun = a.effects(B1).find((e) => e.defId === 'stun')!;
    expect(a.effects(B1).find((e) => e.defId === 'shattered')?.duration).toBe(stun.duration);
  });

  it('Hoop Blade: using a skill cuts other Dance cooldowns by 1', () => {
    const run = (hoop: boolean) => {
      const a = arena({ p0: [['dance', 'shot']], p1: [['shot']] });
      if (hoop) a.give(A1, 'eq_hoop_blade');
      a.use(A1, 'dance').end().pass(1).use(A1, 'shot', B1).end();
      return a.cooldown(A1, 'dance');
    };
    expect(run(true)).toBe(run(false) - 1);
  });

  it('Wind Charm Stick: healed allies heal 5 more at the start of your next 2 turns', () => {
    const a = arena({ p0: [['heal'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_wind_charm_stick').setHp(A2, 50).use(A1, 'heal', A2).end();
    expect(a.hp(A2)).toBe(75);
    a.pass(1);
    expect(a.hp(A2)).toBe(80);
    a.pass(2);
    expect(a.hp(A2)).toBe(85);
    a.pass(2);
    expect(a.hp(A2)).toBe(85);
  });

  it('Anointment Mace: Blessed allies are Immune for a turn', () => {
    const a = arena({ p0: [['bless'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_anointment_mace').use(A1, 'bless', A2).end();
    expect(a.has(A2, 'immune')).toBe(true);
  });

  it('Brimstone Lash: an enemy with your Curse on it dies → 1 random energy', () => {
    const a = arena({ p0: [['curse'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_brimstone_lash').setHp(B1, 10);
    const before = energy(a, 0);
    a.use(A1, 'curse', B1).use(A2, 'shot', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    expect(energy(a, 0)).toBe(before - 2 + 1);
  });

  it('Book of Shadows: Smite costs 1 less and deals no damage', () => {
    const a = arena({ p0: [['smite']], p1: [['shot']] });
    a.give(A1, 'eq_book_of_shadows').use(A1, 'smite', B1);
    expect(a.state.players[0].queue[0]!.cost).toMatchObject({ W: 1, r: 0 });
    a.end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([100, true]);
  });

  it('Book of the Damned: +1 Prayer cooldown; allies left at full Health are Blessed', () => {
    const a = arena({ p0: [['prayer'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_book_of_the_damned').setHp(A3, 50).use(A1, 'prayer').end();
    expect([a.has(A2, 'might'), a.has(A3, 'might')]).toEqual([true, false]);
    expect(a.cooldown(A1, 'prayer')).toBe(3);
  });

  it('Paladin Axe: Cleave splashes 5 Piercing on every enemy it missed', () => {
    const a = arena({ p0: [['cleave']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'eq_paladin_axe').use(A1, 'cleave', B1).end();
    const hps = [a.hp(B1), a.hp(B2), a.hp('p1c2')].sort((x, y) => x - y);
    expect(hps).toEqual([75, 85, 95]); // target, the random second hit, and the splash
  });

  it('Lightning Banner: enemies under your Shout give you 10 Shield per skill', () => {
    const a = arena({ p0: [['shout']], p1: [['shot']] });
    a.give(A1, 'eq_lightning_banner').use(A1, 'shout').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95); // the 10 Shield (granted as B1 acted) soaked part of the Shot
  });

  it('Wind Shield: attackers take 10 Piercing while your Withstand is up', () => {
    const a = arena({ p0: [['withstand']], p1: [['shot']] });
    a.give(A1, 'eq_wind_shield').use(A1, 'withstand').end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it("Ice Hammer: your Taunts are permanent, and you can't Taunt again while one is up", () => {
    const a = arena({ p0: [['taunt']], p1: [['shot']] });
    a.give(A1, 'eq_ice_hammer').use(A1, 'taunt', B1).end();
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.duration).toBeNull();
    a.pass(7);
    expect(a.reject(() => a.use(A1, 'taunt', B1))).toBe('cannot_act');
  });

  it('Chemtech Sword: heals 10 when your Titan expires (20 at 40 Health or less)', () => {
    const a = arena({ p0: [['titan']], p1: [['shot']] });
    a.give(A1, 'eq_chemtech_sword').setHp(A1, 60).use(A1, 'titan').end().pass(5);
    expect(a.hp(A1)).toBe(70);
  });
});
