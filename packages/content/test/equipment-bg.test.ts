// Type B (two-handed) and G (class armor) equipment passives (docs/equipment.md). Passives are
// given directly with the harness, or through `passives` when they act at the start of battle.

import { describe, expect, it } from 'vitest';
import { arena, type Arena } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minion = (a: Arena, owner: 0 | 1) => a.state.units.find((u) => u.alive && u.owner === owner && u.kind === 'minion')!;
const queuedCost = (a: Arena) => a.state.players[a.active].queue.at(-1)!.cost;
const drop = (a: Arena, key: string) => {
  a.state.effects = a.state.effects.filter((e) => e.defId !== key);
};

describe('Type B passives', () => {
  it('Soldier Spear: after a Charge, the next Riposte is free', () => {
    const a = arena({ p0: [['charge', 'riposte']], p1: [['shot']] });
    a.give(A1, 'eq_soldier_spear').use(A1, 'charge', B1).end().pass(1);
    drop(a, 'focus'); // Charge's own Focus would pay the r too
    a.use(A1, 'riposte');
    expect(queuedCost(a)).toMatchObject({ r: 0 });
    a.end();
    expect(a.has(A1, 'soldier_spear_ready')).toBe(false);
  });

  it('Soldier Greataxe: the first enemy to damage you during Rage eats your Charge', () => {
    const a = arena({ p0: [['rage', 'charge']], p1: [['shot']] });
    a.give(A1, 'eq_soldier_greataxe').use(A1, 'rage').end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100 - 25); // Charge 15 + Rage's 2 Might
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(75); // only the first
  });

  it('Kusurigama: Stunning an enemy gives 1 Swiftness', () => {
    const a = arena({ p0: [['stun']], p1: [['shot']] });
    a.give(A1, 'eq_kusurigama').use(A1, 'stun', B1).end();
    expect(a.stacks(A1, 'swiftness')).toBe(1);
  });

  it('Dual Blackjacks: a Mislead counter resets Stun', () => {
    const a = arena({ p0: [['stun', 'mislead']], p1: [['shot']] });
    a.give(A1, 'eq_dual_blackjacks').use(A1, 'stun', B1).end().pass(1).use(A1, 'mislead', B1).end();
    expect(a.cooldown(A1, 'stun')).toBeGreaterThan(0);
    a.use(B1, 'shot', A1).end();
    expect(a.cooldown(A1, 'stun')).toBe(0);
  });

  it('Ancient Longbow: after a Maneuver, Snipes hit at once', () => {
    const run = (bow: boolean) => {
      const a = arena({ p0: [['maneuver', 'snipe']], p1: [['shot']] });
      if (bow) a.give(A1, 'eq_ancient_longbow');
      a.use(A1, 'maneuver').end().pass(1).use(A1, 'snipe', B1).end();
      return a.hp(B1);
    };
    expect([run(true), run(false)]).toEqual([50, 100]);
  });

  it("Tracker's Whistle: a self Maneuver is also used by each Companion", () => {
    const a = arena({ p0: [['companion', 'maneuver']], p1: [['shot']] });
    a.give(A1, 'eq_trackers_whistle').use(A1, 'companion').end().pass(1).use(A1, 'maneuver').end();
    expect([a.has(A1, 'invulnerable'), a.has(minion(a, 0).id, 'invulnerable')]).toEqual([true, true]);
  });

  it('Warlock Staff: Consume keeps channels running', () => {
    const run = (staff: boolean) => {
      const a = arena({ p0: [['channel', 'consume']], p1: [['shot']] });
      if (staff) a.give(A1, 'eq_warlock_staff');
      a.use(A1, 'channel').end().pass(1).use(A1, 'consume', B1).end();
      return a.has(A1, 'channel');
    };
    expect([run(true), run(false)]).toEqual([true, false]);
  });

  it("Summoner's Scrollstaff: starting a channel makes Summon minions' skills free", () => {
    const a = arena({ p0: [['summon.unholy', 'channel']], p1: [['shot']] });
    a.give(A1, 'eq_summoners_scrollstaff').use(A1, 'summon.unholy').end().pass(1).use(A1, 'channel').end().pass(1);
    a.use(minion(a, 0).id, 'imp_firebolt', B1);
    expect(queuedCost(a)).toMatchObject({ r: 0 });
  });

  it('Staff and Shield: Withstand below 40 Health also Blesses you', () => {
    const run = (hp: number) => {
      const a = arena({ p0: [['withstand', 'bless']], p1: [['shot']] });
      a.give(A1, 'eq_staff_and_shield').setHp(A1, hp).use(A1, 'withstand').end();
      return a.stacks(A1, 'might');
    };
    expect([run(30), run(40)]).toEqual([1, 0]);
  });

  it('High Priest Staff: Prayer spreads your Bless to every ally without it', () => {
    const a = arena({ p0: [['bless', 'prayer'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_high_priest_staff').use(A1, 'bless', A2).end().pass(1).use(A1, 'prayer').end();
    expect([a.stacks(A1, 'might'), a.stacks(A2, 'might'), a.stacks(A3, 'might')]).toEqual([1, 1, 1]);
  });

  it('Dual Claws: Rage costs 1 more and also casts Companion', () => {
    const a = arena({ p0: [['rage', 'companion']], p1: [['shot']] });
    a.give(A1, 'eq_dual_claws').use(A1, 'rage');
    expect(queuedCost(a)).toMatchObject({ S: 2, r: 1 });
    a.end();
    expect(minion(a, 0)?.defId).toBe('wolf');
  });

  it('Tree Club: during Titan, Companions have +20 Health, Might and Armor', () => {
    const a = arena({ p0: [['companion', 'titan']], p1: [['shot']] });
    a.give(A1, 'eq_tree_club').use(A1, 'companion').end().pass(1).use(A1, 'titan').end();
    const wolf = minion(a, 0).id;
    expect([a.unit(wolf).maxHp, a.hp(wolf), a.has(wolf, 'tree_club_growth')]).toEqual([50, 50, true]);
    a.use(B1, 'shot', wolf).end();
    expect(a.hp(wolf)).toBe(40); // 15 − 5 Armor
    a.pass(6); // Titan runs out
    expect([a.unit(wolf).maxHp, a.hp(wolf), a.has(wolf, 'tree_club_growth')]).toEqual([30, 30, false]);
  });

  it('Spear and Shield: an unbroken Withstand doubles the next Charge', () => {
    const run = (broken: boolean) => {
      const a = arena({ p0: [['withstand', 'charge']], p1: [['shot'], ['shot']] });
      a.give(A1, 'eq_spear_and_shield').use(A1, 'withstand').end();
      if (broken) a.use(B1, 'shot', A1).use(B2, 'shot', A1); // 30 breaks the 25 Shield
      a.end().use(A1, 'charge', B1).end();
      return a.hp(B1);
    };
    expect([run(false), run(true)]).toEqual([70, 85]);
  });

  it('Sword and Shield: Taunted enemies are Weakened while Taunted; Might during Withstand', () => {
    const a = arena({ p0: [['taunt', 'strike']], p1: [['shot']] });
    a.give(A1, 'eq_sword_and_shield').use(A1, 'taunt', B1).end();
    expect(a.stacks(B1, 'weakness')).toBe(1);
    a.pass(3);
    expect([a.has(B1, 'taunt'), a.has(B1, 'weakness')]).toEqual([false, false]);

    const b = arena({ p0: [['withstand.ice', 'strike']], p1: [['shot']] });
    b.give(A1, 'eq_sword_and_shield').use(A1, 'withstand.ice').end().pass(1).use(A1, 'strike', B1).end();
    expect(b.hp(B1)).toBe(75); // 20 + 5
  });

  it('Dagger and Orb: a Consume kill makes the next Curse free', () => {
    const a = arena({ p0: [['consume', 'curse']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_dagger_and_orb').setHp(B1, 5).use(A1, 'consume', B1).end().pass(1);
    expect(a.unit(B1).alive).toBe(false);
    a.use(A1, 'curse', B2);
    expect(queuedCost(a)).toMatchObject({ r: 0 });
  });

  it('Cultist Scythe: Consume adds 10 unmodified Affliction on a Stunned target', () => {
    const run = (stunned: boolean) => {
      const a = arena({ p0: [['consume']], p1: [['shot']] });
      a.give(A1, 'eq_cultist_scythe').give(A1, 'might', { stacks: 2 });
      if (stunned) a.give(B1, 'stun');
      a.use(A1, 'consume', B1).end();
      return a.hp(B1);
    };
    expect([run(true), run(false)]).toEqual([100 - 15 - 10, 100 - 15]);
  });

  it('Staff and Beads: a broken Withstand Shield makes Prayer 1 specific cheaper', () => {
    const a = arena({ p0: [['withstand', 'prayer']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_staff_and_beads').use(A1, 'withstand').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    a.use(A1, 'prayer');
    expect(queuedCost(a)).toMatchObject({ W: 0, r: 2 });
  });

  it('Dual Tonfa: Withstand gives Swiftness; Armor while Dance lasts', () => {
    const a = arena({ p0: [['withstand', 'dance']], p1: [['shot']] });
    a.give(A1, 'eq_dual_tonfa').use(A1, 'withstand').end();
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    a.pass(1).use(A1, 'dance').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90); // 15 − 5
  });

  it('Mace and Greatshield: start with 2 Armor and 1 Weakness', () => {
    const a = arena({ p0: [['strike']], p1: [['shot']], passives: { [A1]: ['eq_mace_and_greatshield'] } });
    expect([a.stacks(A1, 'armor'), a.stacks(A1, 'weakness')]).toEqual([2, 1]);
  });

  it("Paladin's Greatsword: Might for buffing an ally (once each), Armor for buffing yourself (up to 2)", () => {
    const a = arena({ p0: [['bless', 'titan'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_paladins_greatsword').use(A1, 'bless', A2).end();
    expect(a.stacks(A1, 'might')).toBe(1); // Bless gives two Buffs; one Might
    a.pass(1).use(A1, 'titan').end();
    expect(a.stacks(A1, 'armor')).toBe(3 + 2); // Titan's 3, plus 1 per self Buff (Armor, Immune)
  });
});

describe('Type G passives', () => {
  it('Barbarian Greatclub: hitting every living enemy adds 5 Piercing to all', () => {
    const a = arena({ p0: [['smash']], p1: [['shot'], ['shot']] });
    a.give(A1, 'eq_barbarian_greatclub').use(A1, 'smash', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);

    const b = arena({ p0: [['strike']], p1: [['shot'], ['shot']] });
    b.give(A1, 'eq_barbarian_greatclub').use(A1, 'strike', B1).end();
    expect([b.hp(B1), b.hp(B2)]).toEqual([80, 100]);
  });

  it('Helmet of the Ancestors: once per turn, a 30+ hit is lowered by 10', () => {
    const a = arena({ p0: [['shot']], p1: [['blast'], ['blast']] });
    a.give(A1, 'eq_helmet_of_the_ancestors').pass(1).use(B1, 'blast').use(B2, 'blast').end();
    expect(a.hp(A1)).toBe(100 - 25 - 35);
  });

  it('Shadowrune Bolas: a Stun stopped by Swiftness Confuses instead', () => {
    const a = arena({ p0: [['stun']], p1: [['shot']] });
    a.give(A1, 'eq_shadowrune_bolas').give(B1, 'swiftness').use(A1, 'stun', B1).end();
    expect([a.has(B1, 'stun'), a.has(B1, 'swiftness')]).toEqual([false, false]);
    expect(a.effects(B1).find((e) => e.defId === 'confusion')?.duration).toBe(1); // as long as the Stun would have
  });

  it('Mask of Many Faces: Shield whenever a skill is countered (10 for enemy skills, 5 for allied ones)', () => {
    const a = arena({ p0: [['riposte'], ['shot']], p1: [['shot']] });
    a.give(A2, 'eq_mask_of_many_faces').use(A1, 'riposte').end().use(B1, 'shot', A1).end();
    expect(a.effects(A2).find((e) => e.defId === 'shield')?.value).toBe(10);

    const b = arena({ p0: [['shot'], ['shot']], p1: [['riposte']] });
    b.give(A2, 'eq_mask_of_many_faces').pass(1).use(B1, 'riposte').end().use(A1, 'shot', B1).end();
    expect(b.effects(A2).find((e) => e.defId === 'shield')?.value).toBe(5);
  });

  it('Boomerang Blade: after a Trap goes off, your skills Bypass against its victim', () => {
    const a = arena({ p0: [['trap', 'shot']], p1: [['shot']] });
    a.give(A1, 'eq_boomerang_blade').use(A1, 'trap', B1).end().use(B1, 'shot', A1).end();
    a.give(B1, 'invulnerable').use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15); // Trap, then a Shot through Invulnerable
  });

  it('Ricochet Rifle: a countered Harmful skill deals 10 to a random enemy', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte']] });
    a.give(A1, 'eq_ricochet_rifle').pass(1).use(B1, 'riposte').end().use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 85]);
  });

  it('Explosive Relic: a 2+ energy skill gives Focus until the end of your next turn', () => {
    const a = arena({ p0: [['smash', 'shot']], p1: [['shot']] });
    a.give(A1, 'eq_explosive_relic').use(A1, 'smash', B1).end().pass(1).use(A1, 'shot', B1);
    expect(queuedCost(a)).toMatchObject({ r: 0 });
  });

  it("High Wizard's Hat: Stunned while channeling → Immune", () => {
    const a = arena({ p0: [['channel']], p1: [['stun']] });
    a.give(A1, 'eq_high_wizards_hat').use(A1, 'channel').end().use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.has(A1, 'immune')]).toEqual([true, true]);
  });

  it('Hand of Blessing: the first Buff you give an ally each turn is copied to you', () => {
    const a = arena({ p0: [['bless'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_hand_of_blessing').use(A1, 'bless', A2).end();
    expect([a.stacks(A1, 'might'), a.stacks(A2, 'might')]).toEqual([1, 1]);
  });

  it('Robe of the Song: at 60 Health or less, Helpful skills ignore Stuns', () => {
    const a = arena({ p0: [['heal', 'strike'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_robe_of_the_song').give(A1, 'stun').setHp(A1, 50);
    expect(a.reject(() => a.use(A1, 'strike', B1))).toBe('cannot_act');
    a.use(A1, 'heal', A2);
    a.setHp(A1, 70);
    expect(a.reject(() => a.cmd(0, { t: 'unqueue', index: 0 }).use(A1, 'heal', A2))).toBe('cannot_act');
  });

  it('Totem of the Fallen: Might when an enemy kills your minion', () => {
    const a = arena({ p0: [['companion']], p1: [['shot']] });
    a.give(A1, 'eq_totem_of_the_fallen').use(A1, 'companion').end();
    const wolf = minion(a, 0).id;
    a.setHp(wolf, 5).use(B1, 'shot', wolf).end();
    expect(a.stacks(A1, 'might')).toBe(1);
  });

  it('Cloak of Ancient Leaves: Might and Vulnerable at 80+ Health', () => {
    const a = arena({ p0: [['strike']], p1: [['shot']] });
    a.give(A1, 'eq_cloak_of_ancient_leaves').use(A1, 'strike', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 80]);
  });

  it('Banner of Glory: Shout removes a random Debuff from each ally', () => {
    const a = arena({ p0: [['shout'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_banner_of_glory').give(A1, 'weakness').give(A2, 'weakness').give(A2, 'vulnerable');
    a.use(A1, 'shout').end();
    expect([a.has(A1, 'weakness'), a.stacks(A2, 'weakness') + a.stacks(A2, 'vulnerable')]).toEqual([false, 1]);
  });

  it("Knight's Buckler: countering weakens and exposes the skill's user", () => {
    const a = arena({ p0: [['riposte']], p1: [['shot']] });
    a.give(A1, 'eq_knights_buckler').use(A1, 'riposte').end().use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable')]).toEqual([1, 1]);
  });

  it('Rod of Domination: damage goes to a minion; double damage without one', () => {
    const a = arena({ p0: [['companion']], p1: [['shot']] });
    a.give(A1, 'eq_rod_of_domination').pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70);
    a.use(A1, 'companion').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(minion(a, 0).id)]).toEqual([70, 15]);
  });

  it('Blood Chalice: minions at 10 Health or less die, and you gain a random Buff', () => {
    const a = arena({ p0: [['shot']], p1: [['companion']] });
    a.give(A1, 'eq_blood_chalice').pass(1).use(B1, 'companion').end();
    const wolf = minion(a, 1).id;
    a.setHp(wolf, 20).use(A1, 'shot', wolf).end();
    expect(a.unit(wolf).alive).toBe(false);
    expect(a.effects(A1).filter((e) => ['might', 'armor', 'swiftness'].includes(e.defId))).toHaveLength(1);
  });

  it('Visor of the Restful Spirit: 2 Might for the turn if you took no damage', () => {
    const a = arena({ p0: [['strike']], p1: [['shot']] });
    a.give(A1, 'eq_visor_of_the_restful_spirit').pass(2);
    expect(a.stacks(A1, 'might')).toBe(2);
    a.use(A1, 'strike', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(70);
    expect(a.stacks(A1, 'might')).toBe(1); // just Strike's own
  });

  it('Footwraps of the Long Path: after a Harmful skill, Helpful skills ignore Stuns', () => {
    const a = arena({ p0: [['strike', 'bless'], ['shot']], p1: [['stun']] });
    a.give(A1, 'eq_footwraps_of_the_long_path').use(A1, 'strike', B1).end().use(B1, 'stun', A1).end();
    expect(a.reject(() => a.use(A1, 'strike', B1))).toBe('cannot_act');
    a.use(A1, 'bless', A2);
  });

  it('Hand of Healing: no self-Heals, but healing an ally heals you 10', () => {
    const a = arena({ p0: [['heal'], ['shot']], p1: [['shot']] });
    a.give(A1, 'eq_hand_of_healing').setHp(A1, 50).setHp(A2, 50);
    expect(a.reject(() => a.use(A1, 'heal', A1))).toBe('bad_target');
    a.use(A1, 'heal', A2).end();
    expect([a.hp(A2), a.hp(A1)]).toEqual([75, 60]);
  });

  it('Golden Plate: 1 Armor per 35 missing Health', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'eq_golden_plate').setHp(A1, 30).pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(25); // 70 missing → 2 Armor
  });
});
