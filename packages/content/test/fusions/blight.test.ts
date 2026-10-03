// Spec tests for the Blight fusion (Poison + Unholy): Withered, Festering and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.48, and the kit table in poison-earth-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const withered = (a: Arena, id: string) => a.stacks(id, 'withered');

const parseCost = (c: string) => {
  const cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (c !== 'nc') for (const ch of c) cost[ch as keyof typeof cost] += 1;
  return cost;
};

describe('Blight: cost and cooldown match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike', 'S', 0], ['smash', 'SS', 3], ['charge', 'S', 2], ['riposte', 'r', 3], ['rage', 'W', 4],
    ['shot', 'r', 1], ['snipe', 'Ar', 1], ['trap', 'S', 2], ['maneuver', 'r', 3], ['companion', 'I', 1],
    ['bolt', 'Ir', 1], ['blast', 'II', 2], ['consume', 'S', 2], ['summon', 'W', 1], ['channel', 'rr', 3],
    ['stab', 'r', 0], ['ravage', 'AS', 2], ['mislead', 'r', 3], ['stun', 'AW', 3], ['dance', 'A', 3],
    ['heal', 'W', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'Sr', 1], ['prayer', 'Wrr', 2],
    ['cleave', 'S', 1], ['shout', 'S', 3], ['withstand', 'r', 3], ['taunt', 'S', 4], ['titan', 'WW', 4],
  ];
  it.each(table)('%s.blight costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.blight`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
  });
  it('minion skills: Plague Bite (r), Scurry (nc), Rotbolt (r)', () => {
    expect(content.skills.rats_plague_bite!.cost).toEqual(parseCost('r'));
    expect(content.skills.rats_scurry!.cost).toEqual(parseCost('nc'));
    expect(content.skills.imp_rotbolt!.cost).toEqual(parseCost('r'));
  });
});

describe('Withered and Festering', () => {
  it('each stack lowers max HP by 5, and HP above the new max is lost', () => {
    const a = arena({ p0: [['curse.blight']], p1: [['shot']] });
    a.use(A1, 'curse.blight', B1).end();
    expect([withered(a, B1), a.unit(B1).maxHp, a.hp(B1)]).toEqual([1, 95, 95]);
  });

  it('stacks merge, up to 5', () => {
    const a = arena({ p0: [['strike.blight']], p1: [['shot']], hp: 200 });
    for (let i = 0; i < 6; i++) a.use(A1, 'strike.blight', B1).end().pass(1);
    expect(a.effects(B1).filter((e) => e.defId === 'withered')).toHaveLength(1);
    expect([withered(a, B1), a.unit(B1).maxHp]).toEqual([5, 175]);
  });

  it('lasts until cleansed; cleansing restores the max HP but not the HP lost', () => {
    const a = arena({ p0: [['curse.blight']], p1: [['maneuver.spore']] });
    a.use(A1, 'curse.blight', B1).end().pass(10);
    expect(withered(a, B1)).toBe(1);
    a.use(B1, 'maneuver.spore').end(); // Spore Molt sheds every Debuff
    expect([withered(a, B1), a.unit(B1).maxHp, a.hp(B1)]).toEqual([0, 100, 95]);
  });

  it("Festering: at the end of the applier's turn, a Withered unit with Toxin gains 1 Toxin", () => {
    const a = arena({ p0: [['curse.blight'], ['strike.poison']], p1: [['shot']] });
    a.use(A1, 'curse.blight', B1).use(A2, 'strike.poison', B1).end();
    expect(a.stacks(B1, 'toxin')).toBe(2);
    a.end(); // the bearer's own turn: nothing
    expect(a.stacks(B1, 'toxin')).toBe(2);
    a.end();
    expect(a.stacks(B1, 'toxin')).toBe(3);
  });

  it('Festering: no Toxin, no Toxin gained', () => {
    const a = arena({ p0: [['curse.blight']], p1: [['shot']] });
    a.use(A1, 'curse.blight', B1).end().pass(2);
    expect(a.has(B1, 'toxin')).toBe(false);
  });

  it('Festering: Toxin without Withered stays as it is', () => {
    const a = arena({ p0: [['strike.poison']], p1: [['shot']] });
    a.use(A1, 'strike.poison', B1).end().pass(2);
    expect(a.stacks(B1, 'toxin')).toBe(1);
  });
});

describe('Blight skills', () => {
  it('Rotblade: 20 and 1 Withered', () => {
    const a = arena({ p0: [['strike.blight']], p1: [['shot']] });
    a.use(A1, 'strike.blight', B1).end();
    expect([a.hp(B1), withered(a, B1), a.has(A1, 'soul_fragment')]).toEqual([80, 1, false]);
  });

  it('Rotblade: reaching 3 Withered, the user drains a Soul Fragment', () => {
    const a = arena({ p0: [['strike.blight']], p1: [['shot']] });
    a.give(B1, 'withered', { stacks: 2, source: A1 });
    a.use(A1, 'strike.blight', B1).end();
    expect([withered(a, B1), a.stacks(A1, 'soul_fragment')]).toEqual([3, 1]);
  });

  it("Plaguecrusher: 40; allies with Toxin gain 1 Withered, the rest gain 1 Toxin", () => {
    const a = arena({ p0: [['smash.blight']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'toxin', { source: B1 });
    a.use(A1, 'smash.blight', B1).end();
    expect([a.hp(B1), withered(a, B1), a.has(B1, 'toxin')]).toEqual([60, 0, false]);
    expect([withered(a, B2), a.stacks(B2, 'toxin')]).toEqual([1, 2]); // its Toxin then Festers at the turn's end
    expect([withered(a, B3), a.stacks(B3, 'toxin')]).toEqual([0, 1]);
  });

  it('Dread Lunge: 15; the next skill treats the target as Horrified', () => {
    const a = arena({ p0: [['charge.blight', 'strike.unholy']], p1: [['rage']] });
    a.use(A1, 'charge.blight', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.use(B1, 'rage').end();
    expect(a.has(B1, 'might')).toBe(true); // not really Horrified: Buffs still land
    a.use(A1, 'strike.unholy', B1).end();
    expect(a.hp(B1)).toBe(50); // Witchblade's +10 against Horrified
    a.pass(3).use(A1, 'strike.unholy', B1).end(); // only the next skill
    expect(a.hp(B1)).toBe(25);
  });

  it('Festering Spite: counters the first Harmful skill; its user gains 2 Withered', () => {
    const a = arena({ p0: [['riposte.blight']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.blight').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), withered(a, B1), a.unit(B1).maxHp, withered(a, B2)]).toEqual([85, 2, 90, 0]);
  });

  it('Rot Frenzy: the user gains 2 Withered, then 1 Might per Withered and Immortal for 3 turns', () => {
    const a = arena({ p0: [['rage.blight']], p1: [['strike']] });
    a.give(A1, 'withered', { stacks: 1, source: B1 });
    a.use(A1, 'rage.blight').end();
    expect([withered(a, A1), a.stacks(A1, 'might'), a.has(A1, 'immortal')]).toEqual([3, 3, true]);
    a.setHp(A1, 10).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(5);
    a.pass(4);
    expect([a.has(A1, 'might'), a.has(A1, 'immortal'), withered(a, A1)]).toEqual([false, false, 3]);
  });

  it('Dread Spittle: 15 and 1 Toxin; for 2 turns no Buffs while they have 2+ Toxin', () => {
    const a = arena({ p0: [['shot.blight']], p1: [['bless']] });
    a.give(B1, 'toxin', { stacks: 1, source: B1 });
    a.use(A1, 'shot.blight', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin'), a.has(B1, 'horrified')]).toEqual([80, 2, false]); // 15 + its Toxin's tick
    a.use(B1, 'bless', B1).end();
    expect(a.has(B1, 'might')).toBe(false);
  });

  it('Dread Spittle: with only its own 1 Toxin, Buffs land', () => {
    const a = arena({ p0: [['shot.blight']], p1: [['bless']] });
    a.use(A1, 'shot.blight', B1).end().use(B1, 'bless', B1).end();
    expect([a.stacks(B1, 'toxin'), a.has(B1, 'might')]).toEqual([1, true]);
  });

  it('Dread Spittle: its own second use brings them to 2 Toxin, and the Buffs stop', () => {
    const a = arena({ p0: [['shot.blight']], p1: [['bless']] });
    a.use(A1, 'shot.blight', B1).end().pass(3);
    a.use(A1, 'shot.blight', B1).end().use(B1, 'bless', B1).end();
    expect([a.stacks(B1, 'toxin'), a.has(B1, 'might')]).toEqual([2, false]);
  });

  it('Rotspear: on the following turn, 25 Affliction +10 per Withered', () => {
    const a = arena({ p0: [['snipe.blight'], ['curse.blight']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 });
    a.use(A2, 'curse.blight', B1).use(A1, 'snipe.blight', B1).end();
    expect(a.hp(B1)).toBe(95);
    a.end();
    expect(a.hp(B1)).toBe(60); // 95 max − 35 Affliction through the Shield
    expect(content.skills['snipe.blight']!.tags).toContain('Uncounterable');
  });

  it('Rotten Remedy: the first heal is undone and gives 1 Withered per 10 it would have healed', () => {
    const a = arena({ p0: [['trap.blight']], p1: [['heal']] });
    a.use(A1, 'trap.blight', B1).end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), withered(a, B1)]).toEqual([50, 2]);
    a.pass(3).use(B1, 'heal', B1).end(); // only the first
    expect(a.hp(B1)).toBe(75);
  });

  it('Seep Away: Invulnerable; at the start of their next turn the Toxin they applied ticks once more', () => {
    const a = arena({ p0: [['maneuver.blight'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: A1 }).give(B2, 'toxin', { stacks: 2, source: A2 });
    a.use(A1, 'maneuver.blight').end();
    expect([a.has(A1, 'invulnerable'), a.hp(B1), a.hp(B2)]).toEqual([true, 90, 90]);
    a.end(); // turn 3 starts: the extra tick
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);
  });

  it('Plague Rats: a permanent 25 HP swarm; Plague Bite 5 Piercing and 1 Withered; Scurry 5 Piercing to each Withered enemy', () => {
    const a = arena({ p0: [['companion.blight']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.blight').end().pass(7);
    const rats = minions(a, 0, 'plague_rats')[0]!;
    expect(rats.hp).toBe(25);
    a.give(B1, 'armor', { stacks: 3 }).use(rats.id, 'rats_plague_bite', B1).end().pass(1);
    expect([a.hp(B1), withered(a, B1)]).toEqual([95, 1]);
    a.use(rats.id, 'rats_scurry').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 100]);
  });

  it('Plague Bolt: 20, 1 Withered and Horrified for 1 turn', () => {
    const a = arena({ p0: [['bolt.blight']], p1: [['bless']] });
    a.use(A1, 'bolt.blight', B1).end();
    expect([a.hp(B1), withered(a, B1), a.has(B1, 'horrified')]).toEqual([80, 1, true]);
    a.use(B1, 'bless', B1).end();
    expect(a.has(B1, 'might')).toBe(false);
  });

  it("Plague Bolt: while Horrified, the Withered can't be cleansed", () => {
    const a = arena({ p0: [['bolt.blight']], p1: [['maneuver.spore']] });
    a.use(A1, 'bolt.blight', B1).end().use(B1, 'maneuver.spore').end();
    expect(withered(a, B1)).toBe(1);
  });

  it('Leveling Plague: 15 Affliction to the lowest enemy; the others take the HP gap, up to 35', () => {
    const a = arena({ p0: [['blast.blight']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 50).setHp(B2, 70).give(B3, 'shield', { value: 50 });
    a.use(A1, 'blast.blight').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([35, 50, 65]);
  });

  it('Drink the Plague: 5 lifesteal; the user drinks their Toxin, 1 Soul Fragment per 3 stacks', () => {
    const a = arena({ p0: [['consume.blight']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'toxin', { stacks: 4, source: B1 });
    a.use(A1, 'consume.blight', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(A1, 'toxin'), a.stacks(A1, 'soul_fragment')]).toEqual([95, 55, false, 1]);
  });

  it('Drink the Plague: at most 2 Soul Fragments', () => {
    const a = arena({ p0: [['consume.blight']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 9, source: B1 });
    a.use(A1, 'consume.blight', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
  });

  it("Drink the Plague: the target's Toxin isn't touched", () => {
    const a = arena({ p0: [['consume.blight']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 3, source: B1 });
    a.use(A1, 'consume.blight', B1).end();
    expect([a.stacks(B1, 'toxin'), a.has(A1, 'soul_fragment')]).toEqual([3, false]);
  });

  it('Plague Imp: 25 HP; Rotbolt deals 10 Affliction and 1 Toxin', () => {
    const a = arena({ p0: [['summon.blight']], p1: [['shot']] });
    a.use(A1, 'summon.blight').end().pass(1);
    const imp = minions(a, 0, 'plague_imp')[0]!;
    expect(imp.hp).toBe(25);
    a.give(B1, 'shield', { value: 50 }).use(imp.id, 'imp_rotbolt', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([85, 1]); // 10 + the Toxin's tick
  });

  it('Plague Imp: when it dies, each enemy it damaged gains 1 Withered', () => {
    const a = arena({ p0: [['summon.blight']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.blight').end().pass(1);
    const imp = minions(a, 0, 'plague_imp')[0]!;
    a.use(imp.id, 'imp_rotbolt', B1).end();
    a.use(B2, 'shot', imp.id).use(B1, 'shot', imp.id).end();
    expect(a.unit(imp.id).alive).toBe(false);
    expect([withered(a, B1), withered(a, B2)]).toEqual([1, 0]);
  });

  it('Plague Imp: lasts 3 turns', () => {
    const a = arena({ p0: [['summon.blight']], p1: [['shot']] });
    a.use(A1, 'summon.blight').end().pass(4);
    expect(minions(a, 0, 'plague_imp')).toHaveLength(1);
    a.pass(2);
    expect(minions(a, 0, 'plague_imp')).toHaveLength(0);
  });

  it("Long Decay: 10 Affliction to all enemies at the end of the user's turns, for 2 turns", () => {
    const a = arena({ p0: [['channel.blight']], p1: [['shot'], ['shot']] });
    a.give(B1, 'shield', { value: 50 });
    a.use(A1, 'channel.blight').end().pass(6);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Long Decay: +1 turn per Withered enemy when used', () => {
    const a = arena({ p0: [['channel.blight']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'withered', { source: A1 }).give(B2, 'withered', { stacks: 3, source: A1 });
    a.use(A1, 'channel.blight').end().pass(10);
    expect(a.hp(B3)).toBe(60); // 2 + 2 Withered enemies = 4 ticks
  });

  it('Rusted Knife: 10 and 1 Withered above 60 HP; 20 and no Withered at or below 60', () => {
    const a = arena({ p0: [['stab.blight']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.blight', B1).end().pass(1).use(A1, 'stab.blight', B2).end();
    expect([a.hp(B1), withered(a, B1), a.hp(B2), withered(a, B2)]).toEqual([90, 1, 40, 0]);
  });

  it('Flay: 30 Piercing; each Buff is torn off and becomes 1 Withered', () => {
    const a = arena({ p0: [['ravage.blight']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B1, 'might');
    a.use(A1, 'ravage.blight', B1).end();
    expect([a.hp(B1), a.has(B1, 'armor'), a.has(B1, 'might'), withered(a, B1)]).toEqual([70, false, false, 2]);
  });

  it('Flay: no Buffs, no Withered', () => {
    const a = arena({ p0: [['ravage.blight']], p1: [['shot']] });
    a.use(A1, 'ravage.blight', B1).end();
    expect([a.hp(B1), withered(a, B1)]).toEqual([70, 0]);
  });

  it('Tainted Offering: a Helpful skill is countered; each unit it would have helped gains 1 Withered', () => {
    const a = arena({ p0: [['mislead.blight']], p1: [['heal'], ['shot']] });
    a.use(A1, 'mislead.blight', B1).end();
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect([a.hp(B2), withered(a, B2), withered(a, B1)]).toEqual([50, 1, 0]);
  });

  it("Tainted Offering: Harmful skills aren't countered", () => {
    const a = arena({ p0: [['mislead.blight']], p1: [['shot']] });
    a.use(A1, 'mislead.blight', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), withered(a, A1)]).toEqual([85, 0]);
  });

  it('Crippling Rot: 10, Stun for 1 turn and 1 Withered; then Toxin grows by 1 per Withered', () => {
    const a = arena({ p0: [['stun.blight']], p1: [['shot']] });
    a.give(B1, 'withered', { source: A1 }).give(B1, 'toxin', { source: B1 });
    a.use(A1, 'stun.blight', B1).end();
    expect(withered(a, B1)).toBe(2);
    expect(a.stacks(B1, 'toxin')).toBe(1 + 2 + 1); // +2 for 2 Withered, +1 Festering at turn end
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it("Rot Waltz: 1 Swiftness and 1 Focus; each skill's first enemy target gains 1 Withered", () => {
    const a = arena({ p0: [['dance.blight', 'shot', 'heal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.blight').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    a.pass(1).use(A1, 'shot', B2).end();
    expect([withered(a, B1), withered(a, B2)]).toEqual([0, 1]);
    a.pass(1).use(A1, 'heal', A1).end();
    expect(withered(a, A1)).toBe(0);
    a.pass(1).use(A1, 'shot', B2).end(); // over after 3 turns
    expect(withered(a, B2)).toBe(1);
  });

  it('Feast on Fear: heals 15, +10 per Horrified enemy', () => {
    const a = arena({ p0: [['heal.blight'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'horrified', { source: A1 }).give(B2, 'horrified', { source: A1 });
    a.setHp(A2, 50).use(A1, 'heal.blight', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it("Vulture's Blessing: 1 Might; the ally's skills execute Prey left at 15 HP or less", () => {
    const a = arena({ p0: [['bless.blight'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 35);
    a.use(A1, 'bless.blight', A2).use(A2, 'shot', B1).end();
    expect(a.stacks(A2, 'might')).toBe(1);
    expect(a.unit(B1).alive).toBe(false);
  });

  it("Vulture's Blessing: Prey left above 15 HP is spared", () => {
    const a = arena({ p0: [['bless.blight'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 40).give(B1, 'weakness', { stacks: 3, source: A1 });
    a.use(A1, 'bless.blight', A2).use(A2, 'shot', B1).end();
    expect([a.unit(B1).alive, a.hp(B1)]).toEqual([true, 20]);
  });

  it("Vulture's Blessing: the user's own skills don't execute", () => {
    const a = arena({ p0: [['bless.blight', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.blight', A2).end().pass(1);
    a.setHp(B1, 25).use(A1, 'shot', B1).end();
    expect([a.unit(B1).alive, a.hp(B1)]).toEqual([true, 10]);
  });

  it('Touch of Decay: 1 Withered and Confused for 3 turns', () => {
    const a = arena({ p0: [['curse.blight']], p1: [['shot']] });
    a.use(A1, 'curse.blight', B1).end().pass(4);
    expect([withered(a, B1), a.has(B1, 'confusion')]).toEqual([1, true]);
    a.pass(1);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it("Mark of Decay: 20; for 1 turn each ally who damages them ticks their Toxin and heals that much", () => {
    const a = arena({ p0: [['smite.blight'], ['shot']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: B1 });
    a.setHp(A2, 50).use(A1, 'smite.blight', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([55, 60]);
  });

  it('Mark of Decay: no Toxin, no extra tick or healing', () => {
    const a = arena({ p0: [['smite.blight'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.blight', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([65, 50]);
  });

  it('Communion of Rot: each enemy loses 15 HP; allies heal twice the total, split evenly', () => {
    const a = arena({ p0: [['prayer.blight'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'shield', { value: 50 });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.blight').end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([85, 85, 80, 80]);
  });

  it('Scything Rot: 20 and 10 to another enemy, who gains as much Withered as the first has (max 2)', () => {
    const a = arena({ p0: [['cleave.blight']], p1: [['shot'], ['shot']] });
    a.give(B1, 'withered', { stacks: 3, source: A1 });
    a.use(A1, 'cleave.blight', B1).end();
    expect([a.hp(B1), a.hp(B2), withered(a, B2)]).toEqual([80, 90, 2]);
  });

  it('Scything Rot: a first target without Withered passes none', () => {
    const a = arena({ p0: [['cleave.blight']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.blight', B1).end();
    expect(withered(a, B2)).toBe(0);
  });

  it('Plague Hymn: Intimidated for 2 turns; their Helpful skills deal 10 Affliction to each target', () => {
    const a = arena({ p0: [['shout.blight']], p1: [['heal'], ['shot']] });
    a.use(A1, 'shout.blight').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.setHp(B2, 50).use(B1, 'heal', B2).use(B2, 'shot', A1).end();
    expect([a.hp(B2), a.hp(B1), a.hp(A1)]).toEqual([65, 100, 85]);
  });

  it('Bone Carapace: 20 Shield; whoever breaks it has a Soul Fragment drained', () => {
    const a = arena({ p0: [['withstand.blight']], p1: [['strike']] });
    a.use(A1, 'withstand.blight').end().use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'soul_fragment')]).toEqual([100, 1]);
  });

  it('Bone Carapace: a hit that breaks through it also drains a Soul Fragment', () => {
    const a = arena({ p0: [['withstand.blight']], p1: [['strike']] });
    a.give(B1, 'might', { stacks: 2 });
    a.use(A1, 'withstand.blight').end().use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'soul_fragment')]).toEqual([90, 1]);
  });

  it("Bone Carapace: a hit that doesn't break it drains nothing", () => {
    const a = arena({ p0: [['withstand.blight']], p1: [['shot']] });
    a.use(A1, 'withstand.blight').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'soul_fragment')]).toEqual([100, false]);
  });

  it("Carrion Stench: all enemies Taunted by the user; until the user's next turn, hits on the user deal 10 less and they can't be healed", () => {
    const a = arena({ p0: [['taunt.blight', 'shot'], ['heal']], p1: [['heal'], ['shot']] });
    a.setHp(A1, 50).setHp(B1, 50);
    a.use(A1, 'taunt.blight').use(A2, 'heal', A1).end();
    expect(a.hp(A1)).toBe(50); // no healing
    expect(a.reject(() => a.use(B2, 'shot', A2))).toBe('bad_target');
    a.use(B2, 'shot', A1).use(B1, 'heal', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([45, 75]);
    a.pass(1).use(B2, 'shot', A1).end(); // over
    expect(a.hp(A1)).toBe(30);
  });

  it('Plague Lord: 2 Armor, Immune, and +5 max HP per Withered stack on enemies, healing as it rises', () => {
    const a = arena({ p0: [['titan.blight']], p1: [['shot'], ['shot']] });
    a.give(B1, 'withered', { stacks: 2, source: A1 }).give(B2, 'withered', { source: A1 });
    a.use(A1, 'titan.blight').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.unit(A1).maxHp, a.hp(A1)]).toEqual([2, true, 115, 115]);
    a.pass(5);
    expect([a.has(A1, 'armor'), a.unit(A1).maxHp]).toEqual([false, 100]);
  });
});
