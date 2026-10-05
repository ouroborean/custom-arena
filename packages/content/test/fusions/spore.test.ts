// Spec tests for the Spore fusion (Poison + Earth): Spores, Mushrooms and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.46, and the kit table in poison-earth-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const spores = (a: Arena, id: string) => a.stacks(id, 'spores');

const parseCost = (c: string) => {
  const cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (c !== 'nc') for (const ch of c) cost[ch as keyof typeof cost] += 1;
  return cost;
};

describe('Spore: cost and cooldown match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike', 'W', 0], ['smash', 'Sr', 2], ['charge', 'S', 2], ['riposte', 'W', 2], ['rage', 'S', 4],
    ['shot', 'r', 1], ['snipe', 'Ar', 2], ['trap', 'W', 2], ['maneuver', 'r', 4], ['companion', 'I', 1],
    ['bolt', 'Ir', 1], ['blast', 'Irr', 2], ['consume', 'r', 2], ['summon', 'W', 1], ['channel', 'Wr', 3],
    ['stab', 'r', 0], ['ravage', 'Wr', 2], ['mislead', 'W', 2], ['stun', 'Ar', 3], ['dance', 'A', 2],
    ['heal', 'r', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'W', 1], ['prayer', 'Wr', 2],
    ['cleave', 'S', 1], ['shout', 'S', 3], ['withstand', 'W', 3], ['taunt', 'W', 3], ['titan', 'WW', 4],
  ];
  it.each(table)('%s.spore costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.spore`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
  });
  it('minion skills: Infecting Lash and Rancid Spit cost r', () => {
    expect(content.skills.sporeling_infecting_lash!.cost).toEqual(parseCost('r'));
    expect(content.skills.bloater_rancid_spit!.cost).toEqual(parseCost('r'));
  });
});

describe('Spores and Mushrooms', () => {
  it('Spores from one side merge into a single stack count on the bearer', () => {
    const a = arena({ p0: [['curse.spore'], ['strike.spore']], p1: [['shot']] });
    a.use(A1, 'curse.spore', B1).end();
    const s = a.effects(B1).filter((e) => e.defId === 'spores');
    expect(s).toHaveLength(1);
    expect(s[0]!.stacks).toBe(2);
  });

  it('at 3 Spores a 15 HP Mushroom (a Seedling) sprouts for the applier, and the bearer loses the 3', () => {
    const a = arena({ p0: [['curse.spore'], ['strike.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'curse.spore', B1).end();
    const shrooms = minions(a, 0, 'mushroom');
    expect(shrooms).toHaveLength(1);
    expect(shrooms[0]!.maxHp).toBe(15);
    expect(shrooms[0]!.summonedBy).toBe(A1);
    expect(content.minions.mushroom!.tags).toContain('seedling');
    expect(minions(a, 1)).toHaveLength(0);
    // The 3 are gone; the only Spore left on the lone enemy is the Mushroom's own Puff at the end of the turn.
    expect(spores(a, B1)).toBe(1);
  });

  it('at 2 Spores nothing sprouts', () => {
    const a = arena({ p0: [['curse.spore']], p1: [['shot']] });
    a.use(A1, 'curse.spore', B1).end();
    expect([minions(a, 0, 'mushroom').length, spores(a, B1)]).toEqual([0, 2]);
  });

  it("at the end of the applier's turn, a bearer with 2+ Spores passes 1 to an ally", () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'spores', { stacks: 2, source: A1 }).end();
    expect([spores(a, B1), spores(a, B2)]).toEqual([1, 1]);
  });

  it('a bearer with only 1 Spore passes nothing', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 }).end();
    expect([spores(a, B1), spores(a, B2)]).toEqual([1, 0]);
  });

  it("Spores don't pass at the end of the bearer's own turn", () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.end();
    a.give(B1, 'spores', { stacks: 2, source: A1 }).end(); // p1's turn ends
    expect([spores(a, B1), spores(a, B2)]).toEqual([2, 0]);
    a.end(); // the applier's turn ends
    expect([spores(a, B1), spores(a, B2)]).toEqual([1, 1]);
  });

  it("Mushroom: Puffs at the end of its side's turns (from the sprouting turn), giving an enemy 1 Spore", () => {
    const a = arena({ p0: [['curse.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'curse.spore', B1).end();
    expect(spores(a, B1)).toBe(1); // Puffed on the turn it sprouted
    a.end(); // the enemy's turn: no Puff
    expect(spores(a, B1)).toBe(1);
    a.end();
    expect(spores(a, B1)).toBe(2);
  });

  it("Mushroom's Puff Spores count as its summoner's (they sprout for the summoner)", () => {
    const a = arena({ p0: [['curse.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'curse.spore', B1).end();
    expect(a.effects(B1).find((e) => e.defId === 'spores')?.sourceOwner).toBe(0);
  });

  it("Mushroom: its Channel Earth gives its summoner 1 Might and 1 Armor", () => {
    const a = arena({ p0: [['curse.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'curse.spore', B1).end().pass(1);
    a.use(minions(a, 0, 'mushroom')[0]!.id, 'seedling_channel_earth').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
  });
});

describe('Spore skills', () => {
  it('Moldering Fist: 20 and 1 Spore; no Might or Armor when nothing sprouts', () => {
    const a = arena({ p0: [['strike.spore']], p1: [['shot']] });
    a.use(A1, 'strike.spore', B1).end();
    expect([a.hp(B1), spores(a, B1), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([80, 1, 0, 0]);
  });

  it('Moldering Fist: if a Mushroom sprouts from the target, the user gains 1 Might and 1 Armor for good', () => {
    const a = arena({ p0: [['strike.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 2, source: A1 });
    a.use(A1, 'strike.spore', B1).end();
    expect([a.hp(B1), minions(a, 0, 'mushroom').length]).toEqual([80, 1]);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
    a.pass(8);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
  });

  it("Puffball Stomp: 25; the target's Spores move to each of their allies", () => {
    const a = arena({ p0: [['smash.spore']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'smash.spore', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 100, 100]);
    expect([spores(a, B1), spores(a, B2), spores(a, B3)]).toEqual([0, 1, 1]);
  });

  it('Puffball Stomp: without Spores on the target, the allies gain none', () => {
    const a = arena({ p0: [['smash.spore']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.spore', B1).end();
    expect([a.hp(B1), spores(a, B1), spores(a, B2)]).toEqual([75, 0, 0]);
  });

  it("Spore Trail: 10 and 1 Spore; through the user's next turn, enemies their skills damage gain 1 Spore", () => {
    const a = arena({ p0: [['charge.spore', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.spore', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([90, 1]); // its own hit doesn't double up
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([75, 2]);
    a.pass(1).use(A1, 'shot', B1).end(); // the trail is gone
    expect([a.hp(B1), spores(a, B1)]).toEqual([60, 2]);
  });

  it('Bursting Cap: counters the first Harmful skill; its user gains 1 Spore per target', () => {
    const a = arena({ p0: [['riposte.spore'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.spore').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // only the first was countered
    expect([spores(a, B1), spores(a, B2)]).toEqual([1, 0]);
  });

  it('Bursting Cap: an AoE skill with 2 targets gives its user 2 Spores', () => {
    const a = arena({ p0: [['riposte.spore'], ['shot']], p1: [['blast']] });
    a.use(A1, 'riposte.spore').end().use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2), spores(a, B1)]).toEqual([100, 100, 2]);
  });

  it("Bursting Cap: doesn't counter Helpful skills", () => {
    const a = arena({ p0: [['riposte.spore']], p1: [['heal']] });
    a.use(A1, 'riposte.spore').end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([75, 0]);
  });

  it('Amanita Frenzy: Blinded, 3 Might and Immune, all for 3 turns', () => {
    const a = arena({ p0: [['rage.spore', 'strike']], p1: [['curse']] });
    a.use(A1, 'rage.spore').end();
    expect([a.has(A1, 'blinded'), a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([true, 3, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false); // Immune
    a.pass(3);
    expect([a.has(A1, 'blinded'), a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([true, 3, true]);
    a.pass(1);
    expect([a.has(A1, 'blinded'), a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([false, 0, false]);
  });

  it('Amanita Frenzy: hits very hard, but single-target skills land on a random enemy', () => {
    const hit = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['rage.spore', 'shot']], p1: [['shot'], ['shot']], seed });
      a.use(A1, 'rage.spore').end().pass(1).use(A1, 'shot', B1).end();
      const damaged = [B1, B2].filter((u) => a.hp(u) < 100);
      expect(damaged).toHaveLength(1);
      expect(a.hp(damaged[0]!)).toBe(70); // 15 + 3 Might
      hit.add(damaged[0]!);
    }
    expect([...hit].sort()).toEqual([B1, B2]);
  });

  it('Fester Pod: 10 Piercing and 1 Spore', () => {
    const a = arena({ p0: [['shot.spore']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'shot.spore', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([90, 1]); // Piercing: Armor doesn't reduce it
  });

  it('Fester Pod: 2 Spores if they already had Spores', () => {
    const a = arena({ p0: [['shot.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'shot.spore', B1).end();
    expect(minions(a, 0, 'mushroom')).toHaveLength(1); // 1 + 2 reached 3: a Mushroom sprouted
  });

  it('Fester Pod: its own second use finds the first Spore and sprouts a Mushroom', () => {
    const a = arena({ p0: [['shot.spore']], p1: [['shot']] });
    a.use(A1, 'shot.spore', B1).end().pass(3);
    expect(spores(a, B1)).toBe(1);
    a.use(A1, 'shot.spore', B1).end();
    expect(minions(a, 0, 'mushroom')).toHaveLength(1);
    expect(a.hp(B1)).toBe(80);
  });

  it("Root Rot: in 2 turns, 50 to the target and 15 to each of their allies with Spores", () => {
    const a = arena({ p0: [['snipe.spore']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'snipe.spore', B1).end();
    a.pass(2);
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([100, 100, 100]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([50, 85, 100]);
  });

  it('Root Rot: Channeled, so a Stun on the user stops it', () => {
    const a = arena({ p0: [['snipe.spore']], p1: [['stun']] });
    a.use(A1, 'snipe.spore', B1).end().use(B1, 'stun', A1).end().pass(3);
    expect(a.hp(B1)).toBe(100);
  });

  it('Tainted Hands: each Helpful skill the target uses gives them and every ally it affects 1 Spore', () => {
    const a = arena({ p0: [['trap.spore']], p1: [['heal'], ['shot'], ['shot']] });
    a.use(A1, 'trap.spore', B1).end();
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect([spores(a, B1), spores(a, B2), spores(a, B3)]).toEqual([1, 1, 0]);
  });

  it("Tainted Hands: Harmful skills don't set it off", () => {
    const a = arena({ p0: [['trap.spore']], p1: [['shot', 'heal'], ['shot']] });
    a.use(A1, 'trap.spore', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(spores(a, B1)).toBe(0);
  });

  it('Tainted Hands: fires every time for 3 turns, then stops', () => {
    const a = arena({ p0: [['trap.spore']], p1: [['prayer']] });
    a.use(A1, 'trap.spore', B1).end();
    a.use(B1, 'prayer').end();
    expect(spores(a, B1)).toBe(1);
    a.pass(5); // turns 3–7; Prayer's cooldown covers B's turns 4 and 6
    a.use(B1, 'prayer').end(); // turn 8: the trap ran out after turn 6
    expect(spores(a, B1)).toBe(1);
  });

  it('Spore Molt: Invulnerable; sheds every Debuff, one Spore on a random enemy per Debuff effect', () => {
    const a = arena({ p0: [['maneuver.spore']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 3, source: B1 }).give(A1, 'weakness', { source: B1 });
    a.use(A1, 'maneuver.spore').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'toxin'), a.has(A1, 'weakness')]).toEqual([true, false, false]);
    expect(spores(a, B1)).toBe(2);
  });

  it('Spore Molt: no Debuffs, no Spores', () => {
    const a = arena({ p0: [['maneuver.spore']], p1: [['shot']] });
    a.use(A1, 'maneuver.spore').end();
    expect(spores(a, B1)).toBe(0);
  });

  it('Sporeling: a permanent 40 HP Seedling; Infecting Lash deals 10 and gives 1 Spore', () => {
    const a = arena({ p0: [['companion.spore']], p1: [['shot']] });
    a.use(A1, 'companion.spore').end().pass(7);
    const [s] = minions(a, 0, 'sporeling');
    expect(s?.hp).toBe(40);
    expect(content.minions.sporeling!.tags).toContain('seedling');
    a.use(s!.id, 'sporeling_infecting_lash', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([90, 1]);
  });

  it('Sporeling: +10 max HP and heals 10 whenever a Mushroom sprouts for its side', () => {
    const a = arena({ p0: [['companion.spore'], ['curse.spore']], p1: [['shot']] });
    a.use(A1, 'companion.spore').end().pass(1);
    const s = minions(a, 0, 'sporeling')[0]!;
    a.unit(s.id).hp = 20;
    a.give(B1, 'spores', { stacks: 1, source: A2 });
    a.use(A2, 'curse.spore', B1).end(); // sprouts for A2 — still its side
    expect([a.unit(s.id).maxHp, a.unit(s.id).hp]).toEqual([50, 30]);
  });

  it("Sporeling: doesn't grow when a Mushroom sprouts for the other side", () => {
    const a = arena({ p0: [['companion.spore']], p1: [['curse.spore']] });
    a.use(A1, 'companion.spore').end();
    a.give(A1, 'spores', { stacks: 1, source: B1 });
    a.use(B1, 'curse.spore', A1).end();
    expect(minions(a, 1, 'mushroom')).toHaveLength(1);
    expect(minions(a, 0, 'sporeling')[0]!.maxHp).toBe(40);
  });

  it('Binding Hypha: 20; for 2 turns, direct damage to either bound enemy gives the other 1 Spore', () => {
    const a = arena({ p0: [['bolt.spore'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.spore', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), spores(a, B1), spores(a, B2), a.has(B1, 'mark')]).toEqual([65, 0, 1, false]); // the bolt's own hit comes first
    a.pass(1).use(A2, 'shot', B2).end();
    expect([spores(a, B1), spores(a, B2)]).toEqual([1, 1]);
  });

  it('Binding Hypha: the bond lasts 2 turns', () => {
    const a = arena({ p0: [['bolt.spore'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.spore', B1).end().pass(1).use(A2, 'shot', B1).end(); // the user's next turn: still bound
    expect(spores(a, B2)).toBe(1);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(spores(a, B2)).toBe(1);
  });

  it('Binding Hypha: with no allies to bind, just the 20', () => {
    const a = arena({ p0: [['bolt.spore'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.spore', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([65, 0]);
  });

  it('Sporestorm: each allied Seedling Puffs a Spore onto an enemy, then 25 to all enemies', () => {
    const a = arena({ p0: [['blast.spore', 'summon.earth']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'blast.spore').end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([75, 2]);
  });

  it('Sporestorm: with no Seedlings, just the damage', () => {
    const a = arena({ p0: [['blast.spore']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.spore').end();
    expect([a.hp(B1), a.hp(B2), spores(a, B1) + spores(a, B2)]).toEqual([75, 75, 0]);
  });

  it('Decompose: 5 lifesteal; a target with Spores loses them and the user heals 10 per Spore', () => {
    const a = arena({ p0: [['consume.spore']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'spores', { stacks: 2, source: A1 });
    a.use(A1, 'consume.spore', B1).end();
    expect([a.hp(B1), spores(a, B1), a.hp(A1)]).toEqual([95, 0, 75]);
  });

  it('Decompose: a target without Spores gains 2 instead, and the user heals only the 5', () => {
    const a = arena({ p0: [['consume.spore']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.spore', B1).end();
    expect([a.hp(B1), a.hp(A1), spores(a, B1)]).toEqual([95, 55, 2]);
  });

  it('Decompose: it heals the damage actually dealt, so Armor shrinks the lifesteal', () => {
    const a = arena({ p0: [['consume.spore']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'armor', { stacks: 1 }).give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'consume.spore', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([100, 60]); // 0 dealt + 10 for the Spore
  });

  it('Decompose: its own next use cashes in the Spores it planted', () => {
    const a = arena({ p0: [['consume.spore']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.spore', B1).end().pass(5);
    a.use(A1, 'consume.spore', B1).end();
    expect([a.hp(A1), spores(a, B1)]).toEqual([80, 0]); // 55, then 5 + 2 × 10
  });

  it('Bloater: 20 HP; Rancid Spit deals 10', () => {
    const a = arena({ p0: [['summon.spore']], p1: [['shot']] });
    a.use(A1, 'summon.spore').end().pass(1);
    const [b] = minions(a, 0, 'bloater');
    expect(b?.hp).toBe(20);
    a.use(b!.id, 'bloater_rancid_spit', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([90, 0]);
  });

  it('Bloater: when it dies, every enemy gains 1 Spore', () => {
    const a = arena({ p0: [['summon.spore']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.spore').end();
    const b = minions(a, 0, 'bloater')[0]!;
    a.use(B1, 'shot', b.id).use(B2, 'shot', b.id).end();
    expect(a.unit(b.id).alive).toBe(false);
    expect([spores(a, B1), spores(a, B2)]).toEqual([1, 1]);
  });

  it('Bloater: lasts 3 turns', () => {
    const a = arena({ p0: [['summon.spore']], p1: [['shot']] });
    a.use(A1, 'summon.spore').end().pass(4);
    expect(minions(a, 0, 'bloater')).toHaveLength(1);
    a.pass(2);
    expect(minions(a, 0, 'bloater')).toHaveLength(0);
  });

  it("Mycelial Network: at the end of each of the user's turns, each enemy with Spores gains 1", () => {
    const a = arena({ p0: [['channel.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'channel.spore').end();
    expect(spores(a, B1)).toBe(2);
    a.pass(1);
    expect(spores(a, B1)).toBe(2); // not on the enemy's turn
    a.pass(1); // reaches 3: a Mushroom sprouts
    expect(minions(a, 0, 'mushroom')).toHaveLength(1);
  });

  it('Mycelial Network: only enemies with Spores gain one while any has some', () => {
    const a = arena({ p0: [['channel.spore']], p1: [['shot'], ['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'channel.spore').end();
    expect(spores(a, B1) + spores(a, B2)).toBe(2); // B1's 1 more (it may pass one on), no extra
  });

  it('Mycelial Network: if no enemy has Spores, a random enemy gains 1, and the network grows from there', () => {
    const a = arena({ p0: [['channel.spore']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.spore').end();
    expect(spores(a, B1) + spores(a, B2)).toBe(1);
    a.pass(2);
    expect(spores(a, B1) + spores(a, B2)).toBe(2);
  });

  it("Mycelial Network: lasts 4 of the user's turns", () => {
    const a = arena({ p0: [['channel.spore']], p1: [['shot']] });
    const reset = () => {
      a.state.effects = a.state.effects.filter((e) => !(e.bearer === B1 && e.defId === 'spores'));
      a.give(B1, 'spores', { stacks: 1, source: A1 });
    };
    reset();
    a.use(A1, 'channel.spore').end();
    const grown = [spores(a, B1)];
    for (let i = 0; i < 4; i++) {
      a.pass(1);
      reset();
      a.pass(1);
      grown.push(spores(a, B1));
    }
    expect(grown).toEqual([2, 2, 2, 2, 1]);
  });

  it('Thorn of Rot: 1 Armor rots into 1 Vulnerable, then 10 Piercing (+5 from the Vulnerable) and 1 Spore', () => {
    const a = arena({ p0: [['stab.spore']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'stab.spore', B1).end();
    expect([a.stacks(B1, 'armor'), a.stacks(B1, 'vulnerable'), a.hp(B1), spores(a, B1)]).toEqual([1, 1, 85, 1]);
  });

  it('Thorn of Rot: 15 if they already had Spores', () => {
    const a = arena({ p0: [['stab.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'stab.spore', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([85, 2]);
  });

  it('Thorn of Rot: its own Spore makes the next thorn hit for 15', () => {
    const a = arena({ p0: [['stab.spore']], p1: [['shot']] });
    a.use(A1, 'stab.spore', B1).end().pass(1);
    a.use(A1, 'stab.spore', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Thorn of Rot: no Armor, no Vulnerable', () => {
    const a = arena({ p0: [['stab.spore']], p1: [['shot']] });
    a.use(A1, 'stab.spore', B1).end();
    expect([a.has(B1, 'vulnerable'), a.hp(B1)]).toEqual([false, 90]);
  });

  it('Rot Drill: 25 Piercing; a target with Spores loses them and the user gains 1 Might and 1 Armor for 3 turns', () => {
    const a = arena({ p0: [['ravage.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 2, source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.spore', B1).end();
    expect([a.hp(B1), spores(a, B1), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([75, 0, 1, 1]);
    a.pass(4);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
    a.pass(1);
    expect([a.has(A1, 'might'), a.has(A1, 'armor')]).toEqual([false, false]);
  });

  it('Rot Drill: a target without Spores gains 2, and the user gains nothing', () => {
    const a = arena({ p0: [['ravage.spore']], p1: [['shot']] });
    a.use(A1, 'ravage.spore', B1).end();
    expect([a.hp(B1), spores(a, B1), a.stacks(A1, 'might')]).toEqual([75, 2, 0]);
  });

  it('Rot Drill: its own next use drills out the Spores it planted', () => {
    const a = arena({ p0: [['ravage.spore']], p1: [['shot']] });
    a.use(A1, 'ravage.spore', B1).end().pass(5);
    a.use(A1, 'ravage.spore', B1).end();
    expect([spores(a, B1), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([0, 1, 1]);
  });

  it('Soft Ground: a Harmful skill is countered; without Spores, the user gains 2 Spores', () => {
    const a = arena({ p0: [['mislead.spore']], p1: [['shot']] });
    a.use(A1, 'mislead.spore', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), spores(a, B1), a.has(B1, 'stun')]).toEqual([100, 2, false]);
  });

  it('Soft Ground: with Spores, the countered user is Stunned for 1 turn instead', () => {
    const a = arena({ p0: [['mislead.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'mislead.spore', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), spores(a, B1)]).toEqual([100, 1]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it("Soft Ground: Helpful skills aren't countered", () => {
    const a = arena({ p0: [['mislead.spore']], p1: [['heal']] });
    a.use(A1, 'mislead.spore', B1).end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), spores(a, B1)]).toEqual([75, 0]);
  });

  it('Fungal Shroud: Stun for 1 turn and 1 Spore', () => {
    const a = arena({ p0: [['stun.spore']], p1: [['shot']] });
    a.use(A1, 'stun.spore', B1).end();
    expect(spores(a, B1)).toBe(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect(minions(a, 0, 'mushroom')).toHaveLength(0); // only 1 Spore when it ended
  });

  it('Fungal Shroud: with 2+ Spores when the Stun ends, a Mushroom sprouts', () => {
    const a = arena({ p0: [['stun.spore']], p1: [['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'stun.spore', B1).end();
    expect(minions(a, 0, 'mushroom')).toHaveLength(0);
    a.end();
    expect(minions(a, 0, 'mushroom')).toHaveLength(1);
  });

  it('Rooted Rhythm: 1 Swiftness and 1 Focus for 3 turns', () => {
    const a = arena({ p0: [['dance.spore']], p1: [['shot']] });
    a.use(A1, 'dance.spore').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    a.pass(4);
    expect(a.has(A1, 'focus')).toBe(true);
    a.pass(1);
    expect([a.has(A1, 'swiftness'), a.has(A1, 'focus')]).toEqual([false, false]);
  });

  it("Rooted Rhythm: a damaged minion heals 5 and the user gains 1 Armor for 1 turn", () => {
    const a = arena({ p0: [['dance.spore', 'companion.spore']], p1: [['shot']] });
    a.use(A1, 'companion.spore').end().pass(1).use(A1, 'dance.spore').end();
    const s = minions(a, 0, 'sporeling')[0]!;
    a.use(B1, 'shot', s.id).end();
    expect([a.hp(s.id), a.stacks(A1, 'armor')]).toEqual([30, 1]);
    a.pass(2);
    expect(a.has(A1, 'armor')).toBe(false);
  });

  it('Rooted Rhythm: when the user takes damage, they heal 5 and gain 1 Armor for 1 turn', () => {
    const a = arena({ p0: [['dance.spore']], p1: [['shot']] });
    a.use(A1, 'dance.spore').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'armor')]).toEqual([90, 1]);
    a.pass(2);
    expect(a.has(A1, 'armor')).toBe(false);
  });

  it('Rooted Rhythm: minions summoned after it are not covered (ruling)', () => {
    const a = arena({ p0: [['dance.spore'], ['companion.spore']], p1: [['shot']] });
    a.use(A1, 'dance.spore').use(A2, 'companion.spore').end();
    const s = minions(a, 0, 'sporeling')[0]!;
    a.use(B1, 'shot', s.id).end();
    expect([a.hp(s.id), a.has(A1, 'armor')]).toEqual([25, false]);
  });

  it('Compost Bed: heals 20', () => {
    const a = arena({ p0: [['heal.spore'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.spore', A2).end();
    expect([a.hp(A2), spores(a, B1)]).toEqual([70, 0]); // no Debuff to rot, no Spore
  });

  it('Compost Bed: 1 random Debuff on the ally rots away into 1 Spore on a random enemy', () => {
    const a = arena({ p0: [['heal.spore'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'weakness', { source: B1 }).give(A2, 'vulnerable', { source: B1 });
    a.setHp(A2, 50).use(A1, 'heal.spore', A2).end();
    expect(a.hp(A2)).toBe(70);
    expect(a.stacks(A2, 'weakness') + a.stacks(A2, 'vulnerable')).toBe(1);
    expect(spores(a, B1) + spores(a, B2)).toBe(1);
  });

  it('Mycorrhizal Bond: the ally and the user each gain 1 Might for 3 turns', () => {
    const a = arena({ p0: [['bless.spore'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.spore', A2).end();
    expect([a.stacks(A1, 'might'), a.stacks(A2, 'might'), a.stacks(A3, 'might')]).toEqual([1, 1, 0]);
    a.pass(4);
    expect([a.has(A1, 'might'), a.has(A2, 'might')]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(A1, 'might'), a.has(A2, 'might')]).toEqual([false, false]);
  });

  it('Mycorrhizal Bond: whenever an enemy damages one of them, the other gains 1 Armor for 1 turn', () => {
    const a = arena({ p0: [['bless.spore'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.spore', A2).end().use(B1, 'shot', A2).end();
    expect([a.stacks(A1, 'armor'), a.stacks(A2, 'armor')]).toEqual([1, 0]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(A2, 'armor')).toBe(1);
    a.pass(2);
    expect([a.has(A1, 'armor'), a.has(A2, 'armor')]).toEqual([false, false]);
  });

  it('Mycorrhizal Bond: hits on a third ally warn no one', () => {
    const a = arena({ p0: [['bless.spore'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.spore', A2).end().use(B1, 'shot', A3).end();
    expect([a.has(A1, 'armor'), a.has(A2, 'armor'), a.has(A3, 'armor')]).toEqual([false, false, false]);
  });

  it('Infest: 2 Spores; for 2 turns, every enemy carrying Spores pays 1 more for their skills', () => {
    const a = arena({ p0: [['curse.spore']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'curse.spore', B1).end(); // B1 passes 1 of its 2 to an ally
    const [got, not] = spores(a, B2) === 1 ? [B2, B3] : [B3, B2];
    expect([spores(a, B1), spores(a, got), spores(a, not)]).toEqual([1, 1, 0]);
    a.use(B1, 'shot', A1).use(got, 'shot', A1).use(not, 'shot', A1);
    expect(a.state.players[1].queue.map((q) => q.cost.r)).toEqual([2, 2, 1]);
  });

  it('Infest: no Confusion, and the tax ends after 2 turns', () => {
    const a = arena({ p0: [['curse.spore']], p1: [['shot']] });
    a.use(A1, 'curse.spore', B1).end();
    expect(a.has(B1, 'confusion')).toBe(false);
    a.pass(4).use(B1, 'shot', A1);
    expect([spores(a, B1), a.state.players[1].queue[0]?.cost.r]).toEqual([2, 1]);
  });

  it('Cordyceps Brand: 20; for 2 turns half the healing they receive goes to an ally of the user', () => {
    const a = arena({ p0: [['smite.spore']], p1: [['prayer']] });
    a.setHp(A1, 50).use(A1, 'smite.spore', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B1, 'prayer').end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 65]);
  });

  it('Cordyceps Brand: wears off after 2 turns', () => {
    const a = arena({ p0: [['smite.spore']], p1: [['prayer']] });
    a.setHp(A1, 50).use(A1, 'smite.spore', B1).end().pass(4);
    a.setHp(B1, 50).use(B1, 'prayer').end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 50]);
  });

  it('Fruiting Psalm: all allies heal 30 and gain 2 Spores', () => {
    const a = arena({ p0: [['prayer.spore']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'prayer.spore').end();
    expect([a.hp(A1), spores(a, A1)]).toEqual([80, 2]);
  });

  it("Fruiting Psalm: Mushrooms that sprout from the user's allies are the user's", () => {
    const a = arena({ p0: [['prayer.spore'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.spore').end(); // each ally passes 1 at the end of the turn: one reaches 3
    expect(minions(a, 0, 'mushroom')).toHaveLength(1);
    expect(minions(a, 1, 'mushroom')).toHaveLength(0);
  });

  it('Spore Whirl: 20 to the target, 10 and 1 more Spore to another enemy with Spores', () => {
    const a = arena({ p0: [['cleave.spore']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B3, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'cleave.spore', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 100, 90]);
    // B3 reached 2; at the end of the turn it passes 1 on, so the enemy team holds 2 in all.
    expect(spores(a, B1) + spores(a, B2) + spores(a, B3)).toBe(2);
    expect(spores(a, B3)).toBe(1);
  });

  it('Spore Whirl: no other enemy with Spores, no second hit', () => {
    const a = arena({ p0: [['cleave.spore']], p1: [['shot'], ['shot']] });
    a.give(B1, 'spores', { stacks: 1, source: A1 });
    a.use(A1, 'cleave.spore', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
  });

  it('Carrion Bloom: creates a Mushroom; with no other Seedling, every enemy gains 1 Spore', () => {
    const a = arena({ p0: [['shout.spore']], p1: [['shot']] });
    a.use(A1, 'shout.spore').end();
    expect([minions(a, 0, 'mushroom').length, spores(a, B1), a.has(B1, 'intimidated')]).toEqual([1, 2, false]); // 1, then the new Mushroom's Puff
    const b = arena({ p0: [['shout.spore']], p1: [['shot'], ['shot']] });
    b.use(A1, 'shout.spore').end();
    expect(spores(b, B1) + spores(b, B2)).toBe(3);
  });

  it('Carrion Bloom: 1 Spore per Seedling on the user\'s side, Mushrooms included, up to 2', () => {
    const a = arena({ p0: [['shout.spore', 'companion.spore'], ['companion.spore']], p1: [['shot']] });
    a.use(A1, 'companion.spore').use(A2, 'companion.spore').end().end(); // 2 Sporelings
    a.use(A1, 'shout.spore').end();
    // capped at 2 (not 3): 2, then the Puff makes 3 and a Mushroom sprouts, leaving none
    expect([spores(a, B1), minions(a, 0, 'mushroom').length]).toEqual([0, 2]);
  });

  it('Humus Wall: 20 Shield; at the end of each of the user\'s later turns it rots by 10 and a random enemy gains 1 Spore', () => {
    const a = arena({ p0: [['withstand.spore']], p1: [['shot']] });
    const wall = () => a.effects(A1).find((e) => e.defId === 'humus_wall')?.value ?? 0;
    a.use(A1, 'withstand.spore').end();
    expect([wall(), spores(a, B1)]).toEqual([20, 0]);
    a.pass(2);
    expect([wall(), spores(a, B1)]).toEqual([10, 1]);
    a.pass(2);
    expect([wall(), spores(a, B1)]).toEqual([0, 2]); // gone
    a.pass(2);
    expect(spores(a, B1)).toBe(2);
  });

  it('Humus Wall: it absorbs hits as it rots; once broken, it seeds nothing more', () => {
    const a = arena({ p0: [['withstand.spore']], p1: [['shot']] });
    a.use(A1, 'withstand.spore').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.end(); // 5 left: it rots away, seeding 1 Spore
    expect(spores(a, B1)).toBe(1);
    a.use(B1, 'shot', A1).end().end();
    expect([a.hp(A1), spores(a, B1)]).toEqual([85, 1]);
  });

  it('Stinkhorn: creates a Mushroom; the target is Taunted by it and gains 1 Spore each time they damage it', () => {
    const a = arena({ p0: [['taunt.spore']], p1: [['shot.shadow']] });
    a.use(A1, 'taunt.spore', B1).end();
    const m = minions(a, 0, 'mushroom')[0]!;
    expect(m).toBeDefined();
    const before = spores(a, B1);
    expect(a.reject(() => a.use(B1, 'shot.shadow', A1))).toBe('bad_target');
    a.use(B1, 'shot.shadow', m.id).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.hp(m.id)).toBeLessThan(15); // the Mushroom took the hit
    expect(spores(a, B1)).toBe(before + 1);
  });

  it("Stinkhorn: no Spore for a turn in which they don't damage the Mushroom", () => {
    const a = arena({ p0: [['taunt.spore'], ['shot']], p1: [['heal']] });
    a.use(A1, 'taunt.spore', B1).end();
    const before = spores(a, B1);
    a.use(B1, 'heal', B1).end();
    expect(spores(a, B1)).toBe(before);
  });

  it('Stinkhorn: the Taunt lasts 2 turns', () => {
    const a = arena({ p0: [['taunt.spore']], p1: [['stab']] });
    a.use(A1, 'taunt.spore', B1).end().pass(4);
    a.use(B1, 'stab', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it('Fungal Colossus: the user is Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.spore']], p1: [['curse']] });
    a.use(A1, 'titan.spore').end();
    expect(a.has(A1, 'immune')).toBe(true);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(5);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Fungal Colossus: for 3 turns, a Mushroom sprouts for the user at the end of each of their turns', () => {
    const a = arena({ p0: [['titan.spore']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'titan.spore').end(); // (Immune: the Puffs' Spores don't land)
    expect(minions(a, 0, 'mushroom')).toHaveLength(1);
    a.pass(2);
    expect(minions(a, 0, 'mushroom')).toHaveLength(2);
    a.pass(2);
    expect(minions(a, 0, 'mushroom')).toHaveLength(3);
    a.pass(2);
    expect(minions(a, 0, 'mushroom')).toHaveLength(3);
  });

  it('Fungal Colossus: meanwhile, 1 Armor for each Mushroom on the user\'s side; Piercing ignores it', () => {
    const a = arena({ p0: [['titan.spore']], p1: [['shot', 'ravage']] });
    a.give(B1, 'immune').use(A1, 'titan.spore').end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90); // 1 Mushroom
    a.end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // 2 Mushrooms
    a.end().use(B1, 'ravage', A1).end();
    expect(a.hp(A1)).toBe(60);
    a.end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(45); // over: no more Armor
    expect(a.has(A1, 'immune')).toBe(false);
  });
});
