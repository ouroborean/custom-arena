// Spec tests for the Antidote fusion (Poison + Holy): Inoculated, Purge and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.47, and the kit table in poison-earth-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition, viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const isPrey = (a: Arena, id: string) => evaluateNamedCondition(content, a.state, 'prey', id);
const debuffs = (a: Arena, id: string) =>
  a.effects(id).filter((e) => (e.inline ? e.inline.kind : content.statuses[e.defId]?.kind) === 'Debuff');

const parseCost = (c: string) => {
  const cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (c !== 'nc') for (const ch of c) cost[ch as keyof typeof cost] += 1;
  return cost;
};

describe('Antidote: cost and cooldown match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike', 'S', 0], ['smash', 'Wr', 2], ['charge', 'S', 2], ['riposte', 'W', 3], ['rage', 'A', 4],
    ['shot', 'r', 0], ['snipe', 'Arr', 3], ['trap', 'r', 2], ['maneuver', 'r', 3], ['companion', 'IW', 4],
    ['bolt', 'Ir', 1], ['blast', 'IW', 2], ['consume', 'r', 2], ['summon', 'A', 2], ['channel', 'rr', 3],
    ['stab', 'A', 0], ['ravage', 'Wr', 1], ['mislead', 'W', 2], ['stun', 'A', 3], ['dance', 'AA', 4],
    ['heal', 'W', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'W', 1], ['prayer', 'WA', 3],
    ['cleave', 'S', 1], ['shout', 'W', 3], ['withstand', 'r', 3], ['taunt', 'A', 3], ['titan', 'W', 3],
  ];
  it.each(table)('%s.antidote costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.antidote`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
  });
  it('minion skills: Cure (W), Serpent\'s Kiss (r), Milk Venom (r)', () => {
    expect(content.skills.serpent_cure!.cost).toEqual(parseCost('W'));
    expect(content.skills.serpent_kiss!.cost).toEqual(parseCost('r'));
    expect(content.skills.apothecary_milk_venom!.cost).toEqual(parseCost('r'));
  });
});

describe('Inoculated', () => {
  it('stops the next Debuff and makes the bearer immune to it for 3 turns; then it is spent', () => {
    const a = arena({ p0: [['heal.antidote']], p1: [['curse', 'strike.poison']] });
    a.use(A1, 'heal.antidote', A1).end();
    expect(a.has(A1, 'inoculated')).toBe(true);
    a.use(B1, 'curse', A1).end();
    expect([a.has(A1, 'confusion'), a.has(A1, 'inoculated'), a.has(A1, 'immunity')]).toEqual([false, false, true]);
    a.pass(1).use(B1, 'strike.poison', A1).end(); // a different Debuff lands: Inoculated is spent
    expect(a.has(A1, 'toxin')).toBe(true);
  });

  it('the Immunity blocks that Debuff for 3 turns, then it can land again', () => {
    const a = arena({ p0: [['heal.antidote']], p1: [['curse'], ['curse']] });
    a.use(A1, 'heal.antidote', A1).end();
    a.use(B1, 'curse', A1).end(); // stopped on turn 2: Immunity for 3 turns
    a.pass(3).use(B2, 'curse', A1).end(); // turn 6
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(3).use(B1, 'curse', A1).end(); // turn 10
    expect(a.has(A1, 'confusion')).toBe(true);
  });

  it('a merging Debuff is stopped whole (all its stacks)', () => {
    const a = arena({ p0: [['heal.antidote']], p1: [['asp_constrict']] });
    a.use(A1, 'heal.antidote', A1).end().use(B1, 'asp_constrict', A1).end();
    expect([a.stacks(A1, 'weakness'), a.stacks(A1, 'vulnerable'), a.has(A1, 'immunity')]).toEqual([0, 2, true]);
  });

  it("doesn't react to Buffs", () => {
    const a = arena({ p0: [['heal.antidote'], ['bless']], p1: [['shot']] });
    a.use(A1, 'heal.antidote', A2).use(A2, 'bless', A2).end();
    expect([a.has(A2, 'inoculated'), a.has(A2, 'might')]).toEqual([true, true]);
  });
});

describe('Purge', () => {
  it('Cleansing Blow: 20, then the user Purges a Debuff onto the target: 10 Affliction per stack', () => {
    const a = arena({ p0: [['strike.antidote']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 2, source: B1 }).give(B1, 'shield', { value: 40 });
    a.use(A1, 'strike.antidote', B1).end();
    // 20 absorbed by the Shield; the Purge's 20 is Affliction and goes through it.
    expect([a.has(A1, 'toxin'), a.hp(B1)]).toEqual([false, 80]);
  });

  it("Cleansing Blow: only one of the user's Debuffs is Purged", () => {
    const a = arena({ p0: [['strike.antidote']], p1: [['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'sanctify', { source: B1 });
    a.use(A1, 'strike.antidote', B1).end();
    expect([debuffs(a, A1).length, a.hp(B1)]).toEqual([1, 70]);
  });

  it('Cleansing Blow: without Debuffs, just the 20', () => {
    const a = arena({ p0: [['strike.antidote']], p1: [['shot']] });
    a.use(A1, 'strike.antidote', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it("Purge damage isn't direct: it doesn't spend a Mark", () => {
    const a = arena({ p0: [['strike.antidote'], ['bolt']], p1: [['shot']] });
    a.give(A1, 'confusion', { source: B1 });
    a.use(A2, 'bolt', B1).end().pass(1);
    a.give(B1, 'mark', { source: A2, duration: 5 });
    a.use(A1, 'strike.antidote', B1).end();
    // 25 (Bolt) + 20 + 10 Mark (spent by the Strike's direct hit) + 10 Purge
    expect(a.hp(B1)).toBe(35);
  });
});

describe('Antidote skills', () => {
  it("Shared Absolution: 25 / 10; a Sanctified one's direct hits heal every ally of the damager", () => {
    const a = arena({ p0: [['smash.antidote'], ['smite'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'smash.antidote', B1).use(A2, 'smite', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([40, 90]);
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([65, 65, 65]);
  });

  it("Shared Absolution: ends at the user's next turn; Sanctify then heals only the damager", () => {
    const a = arena({ p0: [['smash.antidote', 'shot'], ['smite'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smash.antidote', B1).end().pass(1);
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A2, 'smite', B1).use(A3, 'shot', B1).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([50, 50, 65]);
  });

  it("Quickened Venom: 15; until the end of their next turn, their Toxin also ticks when they use a skill", () => {
    const a = arena({ p0: [['charge.antidote'], ['shot']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: A2 });
    a.use(A1, 'charge.antidote', B1).end();
    expect(a.hp(B1)).toBe(75); // 15 + the usual tick
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(65);
    a.end(); // usual tick
    expect(a.hp(B1)).toBe(55);
    a.use(B1, 'shot', A1).end(); // over
    expect(a.hp(B1)).toBe(55);
  });

  it('Acquired Tolerance: counters the first Harmful skill, then the user is Inoculated', () => {
    const a = arena({ p0: [['riposte.antidote']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.antidote').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    expect(a.has(A1, 'inoculated')).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'inoculated')]).toEqual([85, true]);
  });

  it("Acquired Tolerance: Helpful skills aren't countered", () => {
    const a = arena({ p0: [['riposte.antidote']], p1: [['heal']] });
    a.use(A1, 'riposte.antidote').end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(A1, 'inoculated')]).toEqual([75, false]);
  });

  it('Immune Response: 2 Might; for 3 turns the Debuffs have no effect', () => {
    const a = arena({ p0: [['rage.antidote', 'strike']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 2, source: B1 }).give(A1, 'weakness', { stacks: 2, source: B1 });
    a.use(A1, 'rage.antidote').end().end();
    expect([a.stacks(A1, 'might'), a.hp(A1)]).toEqual([2, 100]); // the Toxin didn't tick
    a.use(A1, 'strike', B1).end();
    expect(a.hp(B1)).toBe(70); // 20 + 2 Might, Weakness ignored
  });

  it('Immune Response: when it ends, all the Debuffs are Purged onto enemies (10 per stack)', () => {
    const a = arena({ p0: [['rage.antidote']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 2, source: B1 }).give(A1, 'weakness', { stacks: 2, source: B1 });
    a.use(A1, 'rage.antidote').end().pass(4);
    expect([a.hp(B1), a.has(A1, 'toxin')]).toEqual([100, true]);
    a.pass(1); // turn 6 ends: over
    expect([a.hp(B1), debuffs(a, A1).length, a.has(A1, 'might')]).toEqual([60, 0, false]);
  });

  it("Remedy Dart: 15, and the user's most wounded ally is Inoculated", () => {
    const a = arena({ p0: [['shot.antidote'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 80);
    a.use(A1, 'shot.antidote', B1).end();
    expect([a.hp(B1), a.has(A1, 'inoculated'), a.has(A2, 'inoculated'), a.has(A3, 'inoculated')]).toEqual([
      85,
      false,
      true,
      false,
    ]);
  });

  it('Long Diagnosis: in 3 turns, 20 +15 per Debuff the target gained meanwhile', () => {
    const a = arena({ p0: [['snipe.antidote'], ['trap.holy'], ['curse']], p1: [['shot']] });
    a.use(A1, 'snipe.antidote', B1).end().pass(1);
    a.use(A2, 'trap.holy', B1).use(A3, 'curse', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(5);
    expect(a.hp(B1)).toBe(50);
  });

  it('Long Diagnosis: with no Debuffs gained, just 20', () => {
    const a = arena({ p0: [['snipe.antidote']], p1: [['shot']] });
    a.use(A1, 'snipe.antidote', B1).end().pass(6);
    expect(a.hp(B1)).toBe(80);
  });

  it('Long Diagnosis: the bonus is at most 60', () => {
    const a = arena({
      p0: [['snipe.antidote'], ['trap.holy', 'curse.unholy'], ['curse', 'shout']],
      p1: [['shot']],
    });
    a.use(A1, 'snipe.antidote', B1).end().pass(1);
    a.use(A2, 'trap.holy', B1).use(A3, 'curse', B1).end().pass(1);
    a.use(A2, 'curse.unholy', B1).use(A3, 'shout').end().pass(3);
    // 4+ Debuffs gained (Condemned, Confusion, Horrified, Intimidated): 20 + 60
    expect(a.hp(B1)).toBe(20);
  });

  it('Countervenom: the first Debuff the target gives an ally of the user is Purged back onto them', () => {
    const a = arena({ p0: [['trap.antidote'], ['shot']], p1: [['strike.poison']] });
    a.use(A1, 'trap.antidote', B1).end();
    a.use(B1, 'strike.poison', A2).end();
    expect([a.hp(A2), a.has(A2, 'toxin'), a.hp(B1)]).toEqual([80, false, 90]);
    a.pass(1).use(B1, 'strike.poison', A2).end(); // only the first time
    expect([a.has(A2, 'toxin'), a.hp(B1)]).toEqual([true, 90]);
  });

  it("Countervenom: Debuffs from other enemies don't set it off", () => {
    const a = arena({ p0: [['trap.antidote'], ['shot']], p1: [['shot'], ['strike.poison']] });
    a.use(A1, 'trap.antidote', B1).end();
    a.use(B2, 'strike.poison', A2).end();
    expect([a.has(A2, 'toxin'), a.hp(B1), a.hp(B2)]).toEqual([true, 100, 100]);
  });

  it('Quarantine: Invulnerable; enemies who use a Harmful skill on the user meanwhile are Prey for 2 turns', () => {
    const a = arena({ p0: [['maneuver.antidote'], ['shot']], p1: [['ravage.poison'], ['shot']] });
    a.use(A1, 'maneuver.antidote').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('bad_target');
    a.use(B1, 'ravage.poison', A1).use(B2, 'shot', A2).end(); // Envenom Bypasses
    expect([isPrey(a, B1), isPrey(a, B2)]).toEqual([true, false]);
    a.pass(4); // applied on the enemy's turn: through their second turn
    expect(isPrey(a, B1)).toBe(false);
  });

  it("Asclepian Serpent: a permanent 40 HP minion; Serpent's Kiss deals 5 Piercing and 1 Toxin", () => {
    const a = arena({ p0: [['companion.antidote']], p1: [['shot']] });
    a.use(A1, 'companion.antidote').end().pass(7);
    const s = minions(a, 0, 'asclepian_serpent')[0]!;
    expect(s.hp).toBe(40);
    a.give(B1, 'armor', { stacks: 3 }).use(s.id, 'serpent_kiss', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([95 - 5, 1]); // the Toxin ticks at the end of the turn
  });

  it('Asclepian Serpent: Cure Purges one Debuff from target ally onto a random enemy', () => {
    const a = arena({ p0: [['companion.antidote'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.antidote').end().pass(1);
    const s = minions(a, 0, 'asclepian_serpent')[0]!;
    a.give(A2, 'weakness', { stacks: 2, source: B1 }).give(A2, 'sanctify', { source: B1 });
    a.use(s.id, 'serpent_cure', A2).end();
    expect(debuffs(a, A2).length).toBe(1);
    expect(a.hp(B1)).toBeLessThan(100);
  });

  it("Neutralize: 25 and a 1-turn Mark; until the end of their next turn the target's Buffs do nothing", () => {
    const a = arena({ p0: [['bolt.antidote'], ['shot']], p1: [['strike']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B1, 'might', { stacks: 2 });
    a.use(A1, 'bolt.antidote', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(60); // Bolt 25 − 10 Armor (lands before the neutralizing), then 15 + 10 Mark with Armor ignored
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(80); // Might ignored
    a.pass(1).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(80 - 20 - 15); // Might back (2 + the Strike's own)
  });

  it('Holy Wash: 15 to all enemies; then each ally Purges 1 Debuff, and each Purge hits every enemy', () => {
    const a = arena({ p0: [['blast.antidote'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A2, 'sanctify', { source: B1 });
    a.use(A1, 'blast.antidote').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 65]);
    expect([debuffs(a, A1).length, debuffs(a, A2).length]).toEqual([0, 0]);
  });

  it('Draw the Venom: 5 lifesteal; a random ally with Toxin Purges all of it onto the target', () => {
    const a = arena({ p0: [['consume.antidote'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).give(A2, 'toxin', { stacks: 3, source: B1 });
    a.use(A1, 'consume.antidote', B1).end();
    expect([a.hp(B1), a.has(A2, 'toxin'), a.hp(A1)]).toEqual([65, false, 55]);
  });

  it('Draw the Venom: no allied Toxin, just the 5', () => {
    const a = arena({ p0: [['consume.antidote'], ['shot']], p1: [['shot']] });
    a.give(A2, 'weakness', { source: B1 });
    a.use(A1, 'consume.antidote', B1).end();
    expect([a.hp(B1), a.has(A2, 'weakness')]).toEqual([95, true]);
  });

  it('Apothecary: 15 HP for 3 turns; Milk Venom deals 10 and, against Toxin, Inoculates a random ally', () => {
    const a = arena({ p0: [['summon.antidote']], p1: [['shot']] });
    a.use(A1, 'summon.antidote').end().pass(1);
    const ap = minions(a, 0, 'apothecary')[0]!;
    expect(ap.hp).toBe(15);
    a.use(ap.id, 'apothecary_milk_venom', B1).end();
    expect(a.hp(B1)).toBe(90);
    expect([A1, ap.id].filter((u) => a.has(u, 'inoculated'))).toHaveLength(0);
    a.give(B1, 'toxin', { source: B1 }).pass(1).use(ap.id, 'apothecary_milk_venom', B1).end();
    expect([A1, ap.id].filter((u) => a.has(u, 'inoculated'))).toHaveLength(1);
  });

  it('Apothecary: gone after 3 turns', () => {
    const a = arena({ p0: [['summon.antidote']], p1: [['shot']] });
    a.use(A1, 'summon.antidote').end().pass(4);
    expect(minions(a, 0, 'apothecary')).toHaveLength(1);
    a.pass(2);
    expect(minions(a, 0, 'apothecary')).toHaveLength(0);
  });

  it("Long Treatment: each of the user's turns for 3 turns, 10 to all enemies and an ally with Debuffs loses 1 and is Inoculated", () => {
    const a = arena({ p0: [['channel.antidote'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'weakness', { source: B1 });
    a.use(A1, 'channel.antidote').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    expect([a.has(A2, 'weakness'), a.has(A2, 'inoculated'), a.has(A1, 'inoculated')]).toEqual([false, true, false]);
    a.pass(4);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
  });

  it('Find the Wound: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.antidote']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.antidote', B1).end().pass(1).use(A1, 'stab.antidote', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Find the Wound: for 2 turns, being at or below 60 HP makes them Prey', () => {
    const a = arena({ p0: [['stab.antidote']], p1: [['shot']] });
    a.use(A1, 'stab.antidote', B1).end();
    expect(isPrey(a, B1)).toBe(false);
    a.setHp(B1, 60);
    expect(isPrey(a, B1)).toBe(true);
    a.pass(3);
    expect(isPrey(a, B1)).toBe(false);
  });

  it('Tempered Blade: 25 Piercing and the user becomes Inoculated; next time it spends that for 15 more', () => {
    const a = arena({ p0: [['ravage.antidote']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.antidote', B1).end();
    expect([a.hp(B1), a.has(A1, 'inoculated')]).toEqual([75, true]);
    a.pass(3).use(A1, 'ravage.antidote', B1).end();
    expect([a.hp(B1), a.has(A1, 'inoculated')]).toEqual([35, false]);
  });

  it('False Symptom: a Harmful skill is countered, and each of its targets Purges 1 Debuff onto its user', () => {
    const a = arena({ p0: [['mislead.antidote']], p1: [['shot']] });
    a.give(A1, 'weakness', { source: B1 });
    a.use(A1, 'mislead.antidote', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'weakness'), a.hp(B1)]).toEqual([100, false, 90]);
  });

  it("False Symptom: Helpful skills aren't countered", () => {
    const a = arena({ p0: [['mislead.antidote']], p1: [['heal']] });
    a.use(A1, 'mislead.antidote', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Twilight Sleep: the target and the user are Asleep and untouchable for 2 turns', () => {
    const a = arena({ p0: [['stun.antidote', 'shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.antidote', B1).end();
    expect([a.has(A1, 'sleep'), a.has(B1, 'sleep')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('cannot_act');
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B2))).toBe('cannot_act');
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('bad_target');
    a.end().pass(2);
    expect([a.has(A1, 'sleep'), a.has(B1, 'sleep')]).toEqual([false, false]);
  });

  it('Clean Bill of Health: 1 Might, 2 Swiftness and 1 Focus for 3 turns', () => {
    const a = arena({ p0: [['dance.antidote']], p1: [['shot']] });
    a.use(A1, 'dance.antidote').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 2, 1]);
    a.pass(5);
    expect([a.has(A1, 'might'), a.has(A1, 'focus')]).toEqual([false, false]);
  });

  it('Clean Bill of Health: with no Debuffs, the cooldowns drop by 1 more at the end of the turn', () => {
    const clean = arena({ p0: [['dance.antidote']], p1: [['shot']] });
    clean.use(A1, 'dance.antidote').end();
    const dirty = arena({ p0: [['dance.antidote']], p1: [['shot']] });
    dirty.give(A1, 'sanctify', { source: B1 }).use(A1, 'dance.antidote').end();
    expect(clean.cooldown(A1, 'dance.antidote')).toBe(dirty.cooldown(A1, 'dance.antidote') - 1);
  });

  it('Antivenom: heals 25 and Inoculates; a Debuff it stops costs its source 10 Affliction', () => {
    const a = arena({ p0: [['heal.antidote'], ['shot']], p1: [['curse']] });
    a.setHp(A2, 50).use(A1, 'heal.antidote', A2).end();
    expect([a.hp(A2), a.has(A2, 'inoculated')]).toEqual([75, true]);
    a.give(B1, 'shield', { value: 50 }).use(B1, 'curse', A2).end();
    expect([a.has(A2, 'confusion'), a.hp(B1)]).toEqual([false, 90]);
  });

  it("Antivenom: an Inoculation from elsewhere doesn't hurt the source", () => {
    const a = arena({ p0: [['ravage.antidote']], p1: [['curse']] });
    a.use(A1, 'ravage.antidote', B1).end().use(B1, 'curse', A1).end();
    expect([a.has(A1, 'confusion'), a.hp(B1)]).toEqual([false, 75]);
  });

  it('Vaccinate: 1 Toxin; for 3 turns immune to further Toxin, with 1 Might and 1 Renew', () => {
    const a = arena({ p0: [['bless.antidote'], ['shot']], p1: [['strike.poison', 'curse']] });
    a.use(A1, 'bless.antidote', A2).end();
    expect([a.stacks(A2, 'toxin'), a.stacks(A2, 'might')]).toEqual([1, 1]);
    expect(a.log(a.last).some((l) => l.startsWith('A2 gains Renew'))).toBe(true); // a 1-stack Renew is spent by its first tick
    a.use(B1, 'strike.poison', A2).end();
    expect(a.stacks(A2, 'toxin')).toBe(1);
    a.pass(1).use(B1, 'curse', A2).end(); // other Debuffs still land
    expect(a.has(A2, 'confusion')).toBe(true);
  });

  it('Crisis of Conscience: Confused for 2 turns and Condemned', () => {
    const a = arena({ p0: [['curse.antidote']], p1: [['shot']] });
    a.use(A1, 'curse.antidote', B1).end();
    expect([a.has(B1, 'confusion'), a.has(B1, 'condemned')]).toEqual([true, true]);
  });

  it('Crisis of Conscience: while Confused, Condemned returns after each skill; after that it is spent normally', () => {
    const a = arena({ p0: [['curse.antidote']], p1: [['shot']] });
    const permanent = () =>
      a.effects(B1).filter((e) => ['weakness', 'vulnerable', 'confusion'].includes(e.defId) && e.duration === null).length;
    a.use(A1, 'curse.antidote', B1).end();
    a.use(B1, 'shot', A1).end(); // turn 2: a random Debuff, and Condemned is back
    expect([permanent(), a.has(B1, 'condemned')]).toEqual([1, true]);
    a.pass(3); // the Confusion ends on turn 4
    a.use(B1, 'shot', A1).end(); // turn 6: Condemned resolves and stays gone
    expect([permanent(), a.has(B1, 'condemned')]).toEqual([2, false]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(permanent()).toBe(2);
  });

  it('Theriac Brand: 20 and Sanctified for 1 turn, healing 5 more per Toxin on them', () => {
    const a = arena({ p0: [['smite.antidote'], ['shot']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: B1 });
    a.setHp(A2, 50).use(A1, 'smite.antidote', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([65, 75]);
  });

  it('Theriac Brand: without Toxin, an ordinary 15', () => {
    const a = arena({ p0: [['smite.antidote'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.antidote', B1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(65);
  });

  it('Healing Liturgy: all allies heal 20 and gain 10 Shield', () => {
    const a = arena({ p0: [['prayer.antidote'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.antidote').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(65);
  });

  it('Healing Liturgy: for 2 turns, a Debuff an enemy gives one ally makes every ally immune to it', () => {
    const a = arena({ p0: [['prayer.antidote'], ['shot']], p1: [['curse'], ['curse']] });
    a.use(A1, 'prayer.antidote').end();
    a.use(B1, 'curse', A1).use(B2, 'curse', A2).end();
    expect([a.has(A1, 'confusion'), a.has(A2, 'confusion')]).toEqual([true, false]);
  });

  it('Twin Fangs: 20 and 10 to another enemy; if one is Condemned, the other is Prey for 2 turns', () => {
    const a = arena({ p0: [['cleave.antidote']], p1: [['shot'], ['shot']] });
    a.give(B2, 'condemned', { source: A1 });
    a.use(A1, 'cleave.antidote', B1).end();
    expect([a.hp(B1), a.hp(B2), isPrey(a, B1), isPrey(a, B2)]).toEqual([80, 90, true, false]);
    a.pass(3);
    expect(isPrey(a, B1)).toBe(false);
  });

  it('Twin Fangs: no Condemned, no Prey', () => {
    const a = arena({ p0: [['cleave.antidote']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.antidote', B1).end();
    expect([isPrey(a, B1), isPrey(a, B2)]).toEqual([false, false]);
  });

  it('Sterilize: every ally loses 1 Debuff; all enemies Intimidated, 1 stack per Debuff stack removed', () => {
    const a = arena({ p0: [['shout.antidote'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'weakness', { stacks: 2, source: B1 }).give(A2, 'toxin', { source: B1 });
    a.use(A1, 'shout.antidote').end();
    expect([a.has(A1, 'weakness'), a.has(A2, 'toxin')]).toEqual([false, false]);
    expect([a.stacks(B1, 'intimidated'), a.stacks(B2, 'intimidated')]).toEqual([3, 3]);
  });

  it('Sterilize: no Debuffs to remove, still 1 stack of Intimidated', () => {
    const a = arena({ p0: [['shout.antidote']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.antidote').end();
    expect([a.stacks(B1, 'intimidated'), a.stacks(B2, 'intimidated')]).toEqual([1, 1]);
    a.pass(3);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Hardened Constitution: Purges all Debuffs onto enemies, then 20 Shield +10 per Debuff stack Purged', () => {
    const a = arena({ p0: [['withstand.antidote']], p1: [['strike']] });
    a.give(A1, 'weakness', { stacks: 2, source: B1 }).give(A1, 'confusion', { source: B1 });
    a.use(A1, 'withstand.antidote').end();
    expect([debuffs(a, A1).length, a.hp(B1)]).toEqual([0, 70]);
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(50);
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Hardened Constitution: with no Debuffs, 20 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.antidote']], p1: [['strike']] });
    a.use(A1, 'withstand.antidote').end();
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(20);
    a.pass(2);
    expect(a.has(A1, 'shield')).toBe(false);
  });

  it('Turn the Other Cheek: Taunted for 2 turns; each hit on the user Anoints them', () => {
    const a = arena({ p0: [['taunt.antidote'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.antidote', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    expect(a.has(A1, 'anointed')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(2);
    expect(a.has(A1, 'anointed')).toBe(false); // until the end of the user's next turn
  });

  it('Living Cure: 2 Armor for 3 turns, Inoculated at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['titan.antidote']], p1: [['curse']] });
    a.use(A1, 'titan.antidote').end();
    expect(a.stacks(A1, 'armor')).toBe(2);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true); // not Inoculated yet
    expect(a.has(A1, 'inoculated')).toBe(true); // turn 3 started
    a.pass(4);
    expect(a.has(A1, 'armor')).toBe(false);
  });
});
