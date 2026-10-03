// Spec-driven scenarios for the Zealot fusion (Holy + Unholy): Fervor, Martyr and all 30 variants.
// Sources: in-game descriptions, docs/rules.md §21.53, and the Holy & Unholy pairs kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { parseCost, skillAvailability, viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type Arena = ReturnType<typeof arena>;

const condemnDebuffs = (a: Arena, id: string) =>
  a.stacks(id, 'weakness') + a.stacks(id, 'vulnerable') + a.stacks(id, 'confusion');

const minion = (a: Arena, defId: string) => a.state.units.find((u) => u.defId === defId)!;

const costOf = (a: Arena, actor: string, skill: string) =>
  skillAvailability(content, a.state, a.unit(actor).owner).find((s) => s.actor === actor && s.skill === skill)!.cost;

/** Hidden from the opponent: no effect on `bearer` shows up in the other player's view. */
const hiddenFromOpponent = (a: Arena, bearer: string, viewer: 0 | 1) =>
  !viewFor(content, a.state, viewer).effects.some((e) => e.bearer === bearer);

describe('Zealot: costs and cooldowns match the kit table', () => {
  const table: [string, string, number | null][] = [
    ['strike.zealot', 'S', 0],
    ['smash.zealot', 'SS', 3],
    ['charge.zealot', 'S', 2],
    ['riposte.zealot', 'r', 3],
    ['rage.zealot', 'A', 4],
    ['shot.zealot', 'r', 0],
    ['snipe.zealot', 'Arr', 2],
    ['trap.zealot', 'r', 2],
    ['maneuver.zealot', 'A', 2],
    ['companion.zealot', 'SI', 4],
    ['bolt.zealot', 'Ir', 1],
    ['blast.zealot', 'SIr', 2],
    ['consume.zealot', 'I', 2],
    ['summon.zealot', 'A', 1],
    ['channel.zealot', 'W', 3],
    ['stab.zealot', 'A', 0],
    ['ravage.zealot', 'AS', 2],
    ['mislead.zealot', 'A', 2],
    ['stun.zealot', 'A', 4],
    ['dance.zealot', 'W', 0],
    ['heal.zealot', 'r', 0],
    ['bless.zealot', 'W', 2],
    ['curse.zealot', 'S', 2],
    ['smite.zealot', 'Ar', 1],
    ['prayer.zealot', 'Wrr', 2],
    ['cleave.zealot', 'S', 1],
    ['shout.zealot', 'W', 3],
    ['withstand.zealot', 'r', 3],
    ['taunt.zealot', 'S', 3],
    ['titan.zealot', 'AW', 4],
    // Minion skills: the kit lists costs only.
    ['flagellant_self_scourge', 'nc', null],
    ['flagellant_blood_whip', 'r', null],
    ['initiate_take_the_blow', 'nc', null],
  ];
  it.each(table)('%s costs %s (cooldown %s)', (id, cost, cd) => {
    const s = content.skills[id]!;
    expect(s.cost).toEqual(parseCost(cost));
    if (cd !== null) expect(s.cooldown).toBe(cd);
  });

  it('every Zealot variant is in the table', () => {
    const ids = Object.values(content.skills)
      .filter((s) => s.element === 'Zealot')
      .map((s) => s.id)
      .sort();
    expect(ids).toEqual(table.map((t) => t[0]).sort());
  });

  it('Invisible skills are tagged Invisible; Martyr\'s Spear is Channeled with a hidden target', () => {
    for (const id of ['riposte.zealot', 'trap.zealot', 'maneuver.zealot', 'mislead.zealot'])
      expect(content.skills[id]!.tags).toContain('Invisible');
    expect(content.skills['snipe.zealot']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    expect(content.skills['channel.zealot']!.tags).toContain('Channeled');
  });
});

describe('Zealot: Fervor', () => {
  it('is a Buff that stacks up to 5', () => {
    const def = content.statuses.fervor!;
    expect(def.kind).toBe('Buff');
    const a = arena({ p0: [['strike.zealot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 5 }).use(A1, 'strike.zealot', B1).end();
    expect(a.stacks(A1, 'fervor')).toBe(5);
  });

  it('+5 damage per stack to the bearer\'s Zealot skills', () => {
    const a = arena({ p0: [['shot.zealot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 3 }).use(A1, 'shot.zealot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15);
  });

  it('does not boost non-Zealot skills', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 3 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('+1 when an enemy damages the bearer', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'fervor').pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'fervor')).toBe(2);
  });

  it('+1 when an enemy gives the bearer a Debuff', () => {
    const a = arena({ p0: [['shot']], p1: [['curse']] });
    a.give(A1, 'fervor').pass(1).use(B1, 'curse', A1).end();
    expect(a.stacks(A1, 'confusion')).toBe(1);
    expect(a.stacks(A1, 'fervor')).toBe(2);
  });

  it('a unit without Fervor gains none from being hit', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'fervor')).toBe(0);
  });

  it('self-inflicted damage doesn\'t feed Fervor (Give of Yourself: only its own +1)', () => {
    const a = arena({ p0: [['heal.zealot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor').use(A1, 'heal.zealot', A2).end();
    expect(a.stacks(A1, 'fervor')).toBe(2);
  });

  it('can\'t exceed 5 from enemy hits', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'fervor', { stacks: 4 }).pass(1).use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'fervor')).toBe(5);
  });

  it('Simplified (ruling): no +5 healing per stack on Zealot heals', () => {
    const a = arena({ p0: [['heal.zealot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A1, 'fervor', { stacks: 3 }).use(A1, 'heal.zealot', A2).end();
    expect(a.hp(A2)).toBe(70);
  });
});

describe('Zealot: Martyr', () => {
  it('when a unit with Fervor dies, each ally heals 10 per stack and gains 1 Might per 2 stacks', () => {
    const a = arena({ p0: [['shot'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'fervor', { stacks: 4 }).setHp(A1, 5).setHp(A2, 40).setHp(A3, 40).setHp(B2, 40);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
    expect([a.hp(A2), a.hp(A3)]).toEqual([80, 80]);
    expect([a.stacks(A2, 'might'), a.stacks(A3, 'might')]).toEqual([2, 2]);
    expect(a.hp(B2)).toBe(40); // enemies get nothing
  });

  it('odd stacks round the Might down (3 Fervor → 1 Might); the Might is permanent', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 3 }).setHp(A1, 5).setHp(A2, 50);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A2), a.stacks(A2, 'might')]).toEqual([80, 1]);
    a.pass(8);
    expect(a.stacks(A2, 'might')).toBe(1);
  });

  it('1 Fervor: heals 10 but no Might', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor').setHp(A1, 5).setHp(A2, 50);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A2), a.stacks(A2, 'might')]).toEqual([60, 0]);
  });

  it('no Fervor, no Martyr', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 5).setHp(A2, 50);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A2), a.stacks(A2, 'might')]).toEqual([50, 0]);
  });
});

describe('Zealot skills', () => {
  it('Scourge: 20, +5 per Debuff on the user; the user gains 1 Fervor', () => {
    const a = arena({ p0: [['strike.zealot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.zealot', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([80, 1]);
    const b = arena({ p0: [['strike.zealot']], p1: [['shot']] });
    b.give(A1, 'confusion', { source: B1 }).give(A1, 'sanctify', { source: B1 });
    b.use(A1, 'strike.zealot', B1).end();
    expect(b.hp(B1)).toBe(70);
  });

  it('Scourge: existing Fervor adds to the hit (the new stack comes after)', () => {
    const a = arena({ p0: [['strike.zealot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 2 }).use(A1, 'strike.zealot', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([70, 3]);
  });

  it("Crusader's Wrath: spends all Fervor for +10 per stack on each hit (20 target, 10 to their allies)", () => {
    const a = arena({ p0: [['smash.zealot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'fervor', { stacks: 3 }).use(A1, 'smash.zealot', B1).end();
    // Fervor is spent before the hits, so its own +5/stack doesn't also apply.
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([50, 60, 60]);
    expect(a.stacks(A1, 'fervor')).toBe(0);
  });

  it("Crusader's Wrath: with no Fervor, just 20 and 10", () => {
    const a = arena({ p0: [['smash.zealot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.zealot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it("Fanatic's Charge: 15; the next skill costs 1 less per 25 HP missing", () => {
    const a = arena({ p0: [['charge.zealot', 'prayer.zealot']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'charge.zealot', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1);
    expect(costOf(a, A1, 'prayer.zealot')).toEqual(parseCost('W'));
    a.use(A1, 'prayer.zealot').end().pass(1);
    expect(costOf(a, A1, 'prayer.zealot')).toEqual(parseCost('Wrr')); // only the next skill
  });

  it("Fanatic's Charge: 26 missing → 1 less; at full HP no discount", () => {
    const a = arena({ p0: [['charge.zealot', 'prayer.zealot']], p1: [['shot']] });
    a.setHp(A1, 74).use(A1, 'charge.zealot', B1).end().pass(1);
    expect(costOf(a, A1, 'prayer.zealot')).toEqual(parseCost('Wr'));
    const b = arena({ p0: [['charge.zealot', 'prayer.zealot']], p1: [['shot']] });
    b.use(A1, 'charge.zealot', B1).end().pass(1);
    expect(costOf(b, A1, 'prayer.zealot')).toEqual(parseCost('Wrr'));
  });

  it('Welcome the Blow: Invisible; counters the first Harmful skill on the user, who gains 2 Fervor', () => {
    const a = arena({ p0: [['riposte.zealot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.zealot').end();
    expect(hiddenFromOpponent(a, A1, 1)).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([100, 2]);
  });

  it('Welcome the Blow: only the first is countered; the second lands (and feeds Fervor normally)', () => {
    const a = arena({ p0: [['riposte.zealot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.zealot').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([85, 3]);
  });

  it('Welcome the Blow: lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.zealot']], p1: [['shot']] });
    a.use(A1, 'riposte.zealot').end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([85, 0]);
  });

  it('Welcome the Blow: Helpful skills aren\'t countered', () => {
    const a = arena({ p0: [['riposte.zealot']], p1: [['curse']] });
    a.use(A1, 'riposte.zealot').end();
    a.use(B1, 'curse', A1).end(); // curse is Harmful → countered
    expect(a.stacks(A1, 'confusion')).toBe(0);
    const b = arena({ p0: [['riposte.zealot'], ['shot']], p1: [['heal']] });
    b.setHp(B1, 50).use(A1, 'riposte.zealot').end().use(B1, 'heal', B1).end();
    expect(b.hp(B1)).toBe(75);
  });

  it('Fanaticism: 2 Might for 3 turns', () => {
    const a = arena({ p0: [['rage.zealot']], p1: [['shot']] });
    a.use(A1, 'rage.zealot').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    a.pass(4);
    expect(a.stacks(A1, 'might')).toBe(2);
    a.pass(1);
    expect(a.stacks(A1, 'might')).toBe(0);
  });

  it('Fanaticism: enemy Debuffs are prevented and give exactly 1 Fervor each instead', () => {
    const a = arena({ p0: [['rage.zealot']], p1: [['curse'], ['curse']] });
    a.use(A1, 'rage.zealot').end();
    a.use(B1, 'curse', A1).use(B2, 'curse', A1).end();
    expect([a.stacks(A1, 'confusion'), a.stacks(A1, 'fervor')]).toEqual([0, 2]);
  });

  it('Fanaticism: a user who already has Fervor gains only 1 per prevented Debuff', () => {
    const a = arena({ p0: [['rage.zealot']], p1: [['curse']] });
    a.give(A1, 'fervor').use(A1, 'rage.zealot').end();
    a.use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'confusion'), a.stacks(A1, 'fervor')]).toEqual([0, 2]);
  });

  it('Fanaticism: after it ends, Debuffs land again', () => {
    const a = arena({ p0: [['rage.zealot']], p1: [['curse']] });
    a.use(A1, 'rage.zealot').end().pass(6);
    a.use(B1, 'curse', A1).end();
    expect(a.stacks(A1, 'confusion')).toBe(1);
  });

  it("Penitent's Flail: 15; spends 1 Fervor to heal 15", () => {
    const a = arena({ p0: [['shot.zealot']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'fervor', { stacks: 2 }).use(A1, 'shot.zealot', B1).end();
    expect(a.hp(B1)).toBe(75); // 15 + 2 Fervor
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([65, 1]);
  });

  it("Penitent's Flail: with no Fervor, no heal (and no Fervor gained)", () => {
    const a = arena({ p0: [['shot.zealot']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'shot.zealot', B1).end();
    expect([a.hp(B1), a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([85, 50, 0]);
  });

  it("Martyr's Spear: 50 on the following turn, target hidden from the opponent", () => {
    const a = arena({ p0: [['snipe.zealot']], p1: [['shot']] });
    a.use(A1, 'snipe.zealot', B1).end();
    expect(a.hp(B1)).toBe(100);
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1)?.targets ?? []).toEqual([]);
    a.end();
    expect(a.hp(B1)).toBe(50);
  });

  it("Martyr's Spear: if the user dies first, it lands at once, doubled", () => {
    const a = arena({ p0: [['snipe.zealot'], ['shot']], p1: [['shot'], ['shot']], hp: 200 });
    a.setHp(A1, 10).use(A1, 'snipe.zealot', B1).end();
    a.use(B2, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
    expect(a.hp(B1)).toBe(100);
  });

  it('Inquisition: Invisible; Trap 15 on the next Harmful skill, and only once', () => {
    const a = arena({ p0: [['trap.zealot']], p1: [['shot']] });
    a.use(A1, 'trap.zealot', B1).end();
    expect(hiddenFromOpponent(a, B1, 1)).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Inquisition: each skill a Condemned target uses Condemns them again', () => {
    const a = arena({ p0: [['trap.zealot']], p1: [['shot', 'heal']] });
    a.give(B1, 'condemned', { source: A1 }).use(A1, 'trap.zealot', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([condemnDebuffs(a, B1), a.has(B1, 'condemned')]).toEqual([1, true]);
    a.pass(1).use(B1, 'heal', B1).end(); // any skill, Helpful too
    expect([condemnDebuffs(a, B1), a.has(B1, 'condemned')]).toEqual([2, true]);
  });

  it('Inquisition: a target who isn\'t Condemned isn\'t Condemned by using a skill', () => {
    const a = arena({ p0: [['trap.zealot']], p1: [['shot']] });
    a.use(A1, 'trap.zealot', B1).end().use(B1, 'shot', A1).end();
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Hair Shirt: Invisible, so the opponent never sees the Immortal', () => {
    const a = arena({ p0: [['maneuver.zealot']], p1: [['shot']] });
    a.use(A1, 'maneuver.zealot').end();
    expect(hiddenFromOpponent(a, A1, 1)).toBe(true);
  });

  it('Hair Shirt: Immortal for 1 turn; brought to 5 HP → 3 Fervor', () => {
    const a = arena({ p0: [['maneuver.zealot']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'maneuver.zealot').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.unit(A1).alive, a.stacks(A1, 'fervor')]).toEqual([5, true, 3]);
  });

  it('Hair Shirt: not brought to 5 → no Fervor; and the Immortality ends after 1 turn', () => {
    const a = arena({ p0: [['maneuver.zealot']], p1: [['shot']] });
    a.use(A1, 'maneuver.zealot').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([85, 0]);
    a.pass(1).setHp(A1, 10).use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  it('Flagellant: permanent 40 HP minion with 1 Fervor', () => {
    const a = arena({ p0: [['companion.zealot']], p1: [['shot']] });
    a.use(A1, 'companion.zealot').end();
    const f = minion(a, 'flagellant');
    expect([f.owner, f.hp, a.stacks(f.id, 'fervor')]).toEqual([0, 40, 1]);
    a.pass(12);
    expect(a.unit(f.id).alive).toBe(true);
  });

  it('Flagellant: Self-Scourge is 10 Affliction to itself and +1 Fervor', () => {
    const a = arena({ p0: [['companion.zealot']], p1: [['shot']] });
    a.use(A1, 'companion.zealot').end().pass(1);
    const f = minion(a, 'flagellant');
    a.give(f.id, 'armor', { stacks: 2 }).give(f.id, 'shield', { value: 20 });
    a.use(f.id, 'flagellant_self_scourge').end();
    expect([a.hp(f.id), a.stacks(f.id, 'fervor')]).toEqual([30, 2]);
  });

  it('Flagellant: Blood Whip deals 10 +5 per Fervor the Flagellant has (not counted twice)', () => {
    const a = arena({ p0: [['companion.zealot']], p1: [['shot']] });
    a.use(A1, 'companion.zealot').end().pass(1);
    const f = minion(a, 'flagellant');
    a.use(f.id, 'flagellant_blood_whip', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(f.id, 'flagellant_self_scourge').end().pass(1);
    a.use(f.id, 'flagellant_blood_whip', B1).end();
    expect(a.hp(B1)).toBe(85 - 20);
  });

  it('Flagellant: when it dies, its Fervor pays out as a Martyr to its side', () => {
    const a = arena({ p0: [['companion.zealot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.zealot').end();
    const f = minion(a, 'flagellant');
    a.setHp(f.id, 5).setHp(A1, 50).setHp(A2, 50);
    a.use(B1, 'shot', f.id).end();
    expect(a.unit(f.id).alive).toBe(false);
    expect([a.hp(A1), a.hp(A2)]).toEqual([60, 60]);
  });

  it('Heresy Bolt: 25 and Sanctify 1 turn; an ally who triggers it heals and drains a Soul Fragment', () => {
    const a = arena({ p0: [['bolt.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bolt.zealot', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([60, true]);
    expect([a.hp(A2), a.stacks(A2, 'soul_fragment')]).toEqual([65, 1]);
    expect(a.stacks(A1, 'soul_fragment')).toBe(0); // the Bolt itself doesn't trigger its own Sanctify
    expect(a.stacks(A3, 'soul_fragment')).toBe(0);
  });

  it('Heresy Bolt: the Sanctify lasts 1 turn', () => {
    const a = arena({ p0: [['bolt.zealot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.zealot', B1).end();
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Harrowing Nova: 25 Piercing to all; a fragment per enemy dropped from above half to half or below', () => {
    const a = arena({ p0: [['blast.zealot']], p1: [['shot'], ['shot'], ['shot']] });
    // The crossing enemy is hit last, so the drained fragment can't add to the other hits.
    a.setHp(B3, 60).setHp(B2, 50).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'blast.zealot').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 25, 35]);
    expect(a.stacks(A1, 'soul_fragment')).toBe(1); // only B3 crossed; B2 was already at half
  });

  it('Harrowing Nova: two enemies crossing give two fragments', () => {
    const a = arena({ p0: [['blast.zealot']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 70).setHp(B2, 51).use(A1, 'blast.zealot').end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
  });

  it("Sin Eater: 5 and heals the user; takes every Debuff off the user's allies, with their turns left", () => {
    const a = arena({ p0: [['consume.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50)
      .give(A2, 'weakness', { source: B1, duration: 6 })
      .give(A3, 'confusion', { source: B1, duration: 4 })
      .give(A2, 'might');
    a.use(A1, 'consume.zealot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 55]);
    expect([a.has(A2, 'weakness'), a.has(A3, 'confusion'), a.has(A2, 'might')]).toEqual([false, false, true]);
    const w = a.effects(A1).find((e) => e.defId === 'weakness');
    const c = a.effects(A1).find((e) => e.defId === 'confusion');
    expect([w?.duration, c?.duration]).toEqual([5, 3]);
    expect(a.has(A1, 'might')).toBe(false); // Buffs stay
  });

  it("Sin Eater: enemies' Debuffs aren't taken", () => {
    const a = arena({ p0: [['consume.zealot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'weakness', { source: A1, duration: 6 }).use(A1, 'consume.zealot', B1).end();
    expect([a.has(B2, 'weakness'), a.has(A1, 'weakness')]).toEqual([true, false]);
  });

  it('Initiate: 20 HP and 1 Fervor for 3 turns', () => {
    const a = arena({ p0: [['summon.zealot']], p1: [['shot']] });
    a.use(A1, 'summon.zealot').end();
    const i = minion(a, 'initiate');
    expect([i.owner, i.hp, a.stacks(i.id, 'fervor')]).toEqual([0, 20, 1]);
    a.pass(4);
    expect(a.unit(i.id).alive).toBe(true);
    a.pass(1);
    expect(a.unit(i.id).alive).toBe(false);
  });

  it('Initiate: Take the Blow redirects the next single-target Harmful skill on the ally', () => {
    const a = arena({ p0: [['summon.zealot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.zealot').end().pass(1);
    const i = minion(a, 'initiate');
    a.use(i.id, 'initiate_take_the_blow', A2).end();
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect(a.hp(i.id)).toBe(5);
    expect(a.hp(A2)).toBe(85); // only the first was redirected
  });

  it('Initiate: an Initiate that dies taking the blow is a Martyr for its 1+ Fervor', () => {
    const a = arena({ p0: [['summon.zealot'], ['shot']], p1: [['strike']] });
    a.use(A1, 'summon.zealot').end().pass(1);
    const i = minion(a, 'initiate');
    a.setHp(A1, 50).use(i.id, 'initiate_take_the_blow', A2).end();
    a.use(B1, 'strike', A2).end();
    expect([a.unit(i.id).alive, a.hp(A2), a.hp(A1)]).toEqual([false, 100, 60]);
  });

  it('Mortification: channel, 3 ticks; each tick the user takes 10 Affliction and gains 1 Fervor, then a random enemy takes 5 per Fervor', () => {
    const a = arena({ p0: [['channel.zealot']], p1: [['shot']] });
    a.give(A1, 'fervor').give(A1, 'shield', { value: 50 }).use(A1, 'channel.zealot').end();
    expect([a.hp(A1), a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([90, 90, 2]);
    a.pass(2);
    expect([a.hp(A1), a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([80, 75, 3]);
    a.pass(2);
    expect([a.hp(A1), a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([70, 55, 4]);
    a.pass(2);
    expect([a.hp(A1), a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([70, 55, 4]); // over after 3 ticks
  });

  it('Mortification: with no Fervor to start, the first tick still hits for 5 and builds from there', () => {
    const a = arena({ p0: [['channel.zealot']], p1: [['shot']] });
    a.use(A1, 'channel.zealot').end();
    expect([a.hp(A1), a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([90, 95, 1]);
    a.pass(2);
    expect([a.hp(B1), a.stacks(A1, 'fervor')]).toEqual([85, 2]);
  });

  it('Mortification: hits exactly one enemy per tick', () => {
    const a = arena({ p0: [['channel.zealot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'channel.zealot').end();
    expect(300 - a.hp(B1) - a.hp(B2) - a.hp(B3)).toBe(5);
  });

  it('Mortification: Channeled; using another skill ends it', () => {
    const a = arena({ p0: [['channel.zealot', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.zealot').end().pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([90, 1]);
  });

  it('Votive Dagger: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.zealot'], ['stab.zealot']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 70).setHp(B2, 60).use(A1, 'stab.zealot', B1).use(A2, 'stab.zealot', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 40]);
  });

  it("Votive Dagger: a kill pays out the user's Fervor as a Martyr to their allies, and the user keeps it", () => {
    const a = arena({ p0: [['stab.zealot'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'fervor', { stacks: 2 }).setHp(A1, 50).setHp(A2, 50).setHp(A3, 50).setHp(B1, 25);
    a.use(A1, 'stab.zealot', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    expect([a.hp(A2), a.hp(A3), a.stacks(A2, 'might')]).toEqual([70, 70, 1]);
    expect([a.hp(A1), a.stacks(A1, 'fervor')]).toEqual([50, 2]);
  });

  it('Votive Dagger: no kill, no payout', () => {
    const a = arena({ p0: [['stab.zealot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 2 }).setHp(A2, 50).use(A1, 'stab.zealot', B1).end();
    expect(a.hp(A2)).toBe(50);
  });

  it('Strip the Faithless: 30 Piercing', () => {
    const a = arena({ p0: [['ravage.zealot']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.zealot', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Strip the Faithless: for 2 turns, Horrified enemies lose a random Buff at the start of their turn', () => {
    const a = arena({ p0: [['ravage.zealot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'horrified', { source: A1 }).give(B2, 'might').give(B2, 'swiftness').give(B2, 'focus');
    a.give(B3, 'might');
    a.use(A1, 'ravage.zealot', B1).end(); // turn 2 starts
    const buffs = (id: string) => ['might', 'swiftness', 'focus'].filter((k) => a.has(id, k)).length;
    expect([buffs(B2), buffs(B3)]).toEqual([2, 1]);
    a.pass(2); // turn 4 starts
    expect(buffs(B2)).toBe(1);
    a.pass(2); // turn 6 starts: over
    expect(buffs(B2)).toBe(1);
  });

  it('Willing Martyrs: Invisible; counters the target\'s Harmful skill and heals its targets 10 per Fervor', () => {
    const a = arena({ p0: [['mislead.zealot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 2 }).setHp(A2, 50).use(A1, 'mislead.zealot', B1).end();
    expect(hiddenFromOpponent(a, B1, 1)).toBe(true);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(70);
  });

  it('Willing Martyrs: Helpful skills go through; it lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.zealot']], p1: [['heal', 'shot']] });
    a.setHp(B1, 50).use(A1, 'mislead.zealot', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Mass Penance: all enemies Stunned 1 turn; the user takes 15 Affliction per enemy Stunned', () => {
    const a = arena({ p0: [['stun.zealot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'shield', { value: 50 }).give(B3, 'immune').use(A1, 'stun.zealot').end();
    expect([a.has(B1, 'stun'), a.has(B2, 'stun'), a.has(B3, 'stun')]).toEqual([true, true, false]);
    expect(a.hp(A1)).toBe(70);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Ecstasy: spends 1 Fervor for 1 Might, Swiftness and Focus until the end of the next turn', () => {
    const a = arena({ p0: [['dance.zealot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 2 }).use(A1, 'dance.zealot').end();
    const buffs = () => ['might', 'swiftness', 'focus'].map((k) => a.stacks(A1, k));
    expect([a.stacks(A1, 'fervor'), ...buffs()]).toEqual([1, 1, 1, 1]);
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(1);
    expect(buffs()).toEqual([1, 1, 1]);
    a.pass(1);
    expect(buffs()).toEqual([0, 0, 0]);
  });

  it('Ecstasy: with no Fervor, the user gains 1 Fervor and 1 Confusion for 1 turn', () => {
    const a = arena({ p0: [['dance.zealot']], p1: [['shot']] });
    a.use(A1, 'dance.zealot').end();
    expect([a.stacks(A1, 'fervor'), a.stacks(A1, 'confusion'), a.has(A1, 'might')]).toEqual([1, 1, false]);
    a.pass(1);
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Give of Yourself: the user takes 15 and gains 1 Fervor; the ally heals 20', () => {
    const a = arena({ p0: [['heal.zealot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.zealot', A2).end();
    expect([a.hp(A1), a.stacks(A1, 'fervor'), a.hp(A2)]).toEqual([85, 1, 70]);
  });

  it('Unholy Unction: 1 Might and Lifesteal for 3 turns', () => {
    const a = arena({ p0: [['bless.zealot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.zealot', A2).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2), a.stacks(A2, 'might')]).toEqual([80, 70, 1]);
    a.pass(4);
    expect([a.has(A2, 'lifesteal'), a.stacks(A2, 'might')]).toEqual([true, 1]);
    a.pass(1);
    expect([a.has(A2, 'lifesteal'), a.stacks(A2, 'might')]).toEqual([false, 0]);
  });

  it('Unholy Unction: a heal that tops them up to full HP gives 10 Shield', () => {
    const a = arena({ p0: [['bless.zealot'], ['shot'], ['heal']], p1: [['shot']] });
    a.setHp(A2, 90).use(A1, 'bless.zealot', A2).use(A3, 'heal', A2).end();
    expect(a.hp(A2)).toBe(100);
    expect(a.effects(A2).filter((e) => e.defId === 'unction_shield').reduce((n, e) => n + e.value, 0)).toBe(10);
  });

  it('Unholy Unction: a heal that finds them hurt gives no Shield', () => {
    const a = arena({ p0: [['bless.zealot'], ['shot'], ['heal']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.zealot', A2).use(A3, 'heal', A2).end();
    expect(a.hp(A2)).toBe(75);
    expect(a.has(A2, 'unction_shield')).toBe(false);
  });

  it('Communal Grace: Sanctified for 2 turns; each trigger heals every other ally of the damager 5', () => {
    const a = arena({ p0: [['curse.zealot'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50).setHp(B2, 50);
    a.use(A1, 'curse.zealot', B1).use(A2, 'shot', B1).end();
    expect([a.hp(A2), a.hp(A1), a.hp(A3), a.hp(B2)]).toEqual([65, 55, 55, 50]);
    a.pass(2);
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it("Communal Grace: other Sanctifies don't spread healing (ruling: only this target's)", () => {
    const a = arena({ p0: [['curse.zealot'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A3, 50).give(B2, 'sanctify', { source: A1 });
    a.use(A1, 'curse.zealot', B1).use(A2, 'shot', B2).end();
    expect([a.hp(A1), a.hp(A3)]).toEqual([50, 50]);
  });

  it('Holy Hunger: 20 and Sanctify 2 turns; each ally who triggers it gains 1 Fervor', () => {
    const a = arena({ p0: [['smite.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.zealot', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(50);
    expect([a.stacks(A1, 'fervor'), a.stacks(A2, 'fervor'), a.stacks(A3, 'fervor')]).toEqual([0, 1, 1]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.stacks(A2, 'fervor')).toBe(2);
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
    a.use(A3, 'shot', B1).end();
    expect(a.stacks(A3, 'fervor')).toBe(1); // over with the Sanctify
  });

  it('Fervent Chant: all allies heal 25', () => {
    const a = arena({ p0: [['prayer.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 90).use(A1, 'prayer.zealot').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([75, 75, 100]);
  });

  it("Fervent Chant: an ally who dies before the user's next turn is a Martyr as if they had 3 Fervor", () => {
    const a = arena({ p0: [['prayer.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.zealot').end();
    a.setHp(A2, 5).setHp(A1, 50).setHp(A3, 50).use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
    expect([a.hp(A1), a.hp(A3), a.stacks(A3, 'might')]).toEqual([80, 80, 1]);
  });

  it("Fervent Chant: from the user's next turn on, deaths aren't Martyrs", () => {
    const a = arena({ p0: [['prayer.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.zealot').end().pass(2);
    a.setHp(A2, 5).setHp(A1, 50).use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, a.hp(A1)]).toEqual([false, 50]);
  });

  it("Heretics' Circle: 25, and 15 to each other enemy with a Debuff if the target has one", () => {
    const a = arena({ p0: [['cleave.zealot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'confusion', { source: A1 }).give(B2, 'vulnerable', { source: A1 });
    a.use(A1, 'cleave.zealot', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 80, 100]); // B2: 15 + 5 Vulnerable
  });

  it("Heretics' Circle: a target with no Debuff → no splash", () => {
    const a = arena({ p0: [['cleave.zealot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'confusion', { source: A1 }).use(A1, 'cleave.zealot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 100]);
  });

  it('Sermon of Dread: all enemies Intimidated for 2 turns; Horrified ones are also Condemned', () => {
    const a = arena({ p0: [['shout.zealot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'horrified', { source: A1 }).use(A1, 'shout.zealot').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    expect([a.has(B1, 'condemned'), a.has(B2, 'condemned')]).toEqual([true, false]);
    a.pass(2);
    expect(a.has(B2, 'intimidated')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'intimidated')).toBe(false);
  });

  it('Shield of Martyrs: 25 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.zealot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.zealot').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95); // 25 of the 30 absorbed
    const b = arena({ p0: [['withstand.zealot']], p1: [['shot']] });
    b.use(A1, 'withstand.zealot').end().pass(2).use(B1, 'shot', A1).end();
    expect(b.hp(A1)).toBe(85); // gone after 1 turn
  });

  it('Shield of Martyrs: an ally dying meanwhile gives the user 2 Fervor on top of the Martyr payout', () => {
    const a = arena({ p0: [['withstand.zealot'], ['shot']], p1: [['shot']] });
    a.give(A2, 'fervor', { stacks: 2 }).setHp(A1, 50).setHp(A2, 5).use(A1, 'withstand.zealot').end();
    a.use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
    expect([a.hp(A1), a.stacks(A1, 'might'), a.stacks(A1, 'fervor')]).toEqual([70, 1, 2]);
  });

  it('Shield of Martyrs: no death, no Fervor', () => {
    const a = arena({ p0: [['withstand.zealot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'withstand.zealot').end().use(B1, 'shot', A2).end();
    expect(a.stacks(A1, 'fervor')).toBe(0);
  });

  it('Strike Me Down: Taunts for 2 turns', () => {
    const a = arena({ p0: [['taunt.zealot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.zealot', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it("Strike Me Down: the user's killer takes 10 Affliction per Fervor stack", () => {
    const a = arena({ p0: [['taunt.zealot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 5 }).give(B1, 'shield', { value: 50 });
    a.setHp(A1, 10).use(A1, 'taunt.zealot', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
    expect(a.hp(B1)).toBe(50);
  });

  it('Strike Me Down: any killer pays, not just the Taunted one (ruling)', () => {
    const a = arena({ p0: [['taunt.zealot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'fervor', { stacks: 5 }).setHp(A1, 10).use(A1, 'taunt.zealot', B1).end();
    a.use(B2, 'shot', A1).end();
    expect([a.unit(A1).alive, a.hp(B2), a.hp(B1)]).toEqual([false, 50, 100]);
  });

  it('Strike Me Down: no death, no retribution', () => {
    const a = arena({ p0: [['taunt.zealot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 5 }).use(A1, 'taunt.zealot', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Living Saint: 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.zealot']], p1: [['shot']] });
    a.use(A1, 'titan.zealot').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([2, true]);
    a.pass(4);
    expect(a.has(A1, 'immune')).toBe(true);
    a.pass(1);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it("Living Saint: when it ends, the user's allies get the Martyr payout for their Fervor, which is spent", () => {
    const a = arena({ p0: [['titan.zealot'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'fervor', { stacks: 4 }).setHp(A1, 40).setHp(A2, 40).setHp(A3, 40);
    a.use(A1, 'titan.zealot').end().pass(4);
    expect(a.hp(A2)).toBe(40); // not yet
    a.pass(1);
    expect([a.hp(A2), a.hp(A3), a.stacks(A2, 'might')]).toEqual([80, 80, 2]);
    expect([a.hp(A1), a.stacks(A1, 'fervor'), a.unit(A1).alive]).toEqual([40, 0, true]);
  });
});
