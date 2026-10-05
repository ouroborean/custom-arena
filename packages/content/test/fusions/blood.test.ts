// Spec-driven tests for the Blood fusion (Water + Unholy): Blood Price, Hemorrhage, all 30 skills and both minions.
// Sources: skill/status descriptions, glossary.blood.yaml, docs/rules.md §21.33, and the design-doc kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2 (even turns).

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const energyTotal = (a: ReturnType<typeof arena>, p: 0 | 1) => {
  const e = a.state.players[p].energy;
  return e.S + e.A + e.I + e.W;
};
const minion = (a: ReturnType<typeof arena>, defId: string) => a.state.units.find((u) => u.defId === defId && u.alive);

describe('Blood: costs and cooldowns match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike.blood', 'S', 1],
    ['smash.blood', 'Sr', 2],
    ['charge.blood', 'S', 2],
    ['riposte.blood', 'r', 3],
    ['rage.blood', 'Ir', 4],
    ['shot.blood', 'r', 0],
    ['snipe.blood', 'Ir', 2],
    ['trap.blood', 'A', 3],
    ['maneuver.blood', 'I', 2],
    ['companion.blood', 'S', 1],
    ['bolt.blood', 'Ir', 1],
    ['blast.blood', 'SIr', 2],
    ['consume.blood', 'I', 2],
    ['summon.blood', 'rr', 1],
    ['channel.blood', 'rr', 3],
    ['stab.blood', 'r', 0],
    ['ravage.blood', 'AS', 2],
    ['mislead.blood', 'r', 3],
    ['stun.blood', 'A', 2],
    ['dance.blood', 'I', 3],
    ['heal.blood', 'W', 1],
    ['bless.blood', 'W', 2],
    ['curse.blood', 'r', 1],
    ['smite.blood', 'Sr', 1],
    ['prayer.blood', 'Irr', 2],
    ['cleave.blood', 'Sr', 1],
    ['shout.blood', 'S', 3],
    ['withstand.blood', 'r', 3],
    ['taunt.blood', 'I', 3],
    ['titan.blood', 'Wrr', 4],
    ['bloodbound_familiar_bite', 'r', 0],
    ['blood_elemental_lash', 'nc', 0],
  ];
  const letters = (c: { S: number; A: number; I: number; W: number; r: number }) => {
    const s = 'S'.repeat(c.S) + 'A'.repeat(c.A) + 'I'.repeat(c.I) + 'W'.repeat(c.W) + 'r'.repeat(c.r);
    return s === '' ? 'nc' : s;
  };
  const sorted = (s: string) => (s === 'nc' ? s : [...s].sort().join(''));
  it.each(table)('%s costs %s with cooldown %i', (id, cost, cd) => {
    const def = content.skills[id]!;
    expect(sorted(letters(def.cost))).toBe(sorted(cost));
    expect(def.cooldown).toBe(cd);
  });

  it('Blood Price skills are exactly the ones the kit marks Blood Price', () => {
    const bp = Object.keys(content.skills).filter((id) => id.endsWith('.blood') && content.skills[id]!.tags.includes('BloodPrice'));
    expect(bp.sort()).toEqual(
      [
        'riposte.blood',
        'rage.blood',
        'shot.blood',
        'snipe.blood',
        'bolt.blood',
        'blast.blood',
        'summon.blood',
        'channel.blood',
        'mislead.blood',
        'prayer.blood',
        'titan.blood',
      ].sort(),
    );
  });
});

describe('Blood Price', () => {
  it('random pips cost no energy; colored pips are still paid', () => {
    const a = arena({ p0: [['snipe.blood']], p1: [['shot']] });
    a.use(A1, 'snipe.blood', B1);
    expect(a.state.players[0].queue[0]!.cost).toEqual({ S: 0, A: 0, I: 1, W: 0, r: 0 });
    const before = energyTotal(a, 0);
    a.end();
    expect(energyTotal(a, 0)).toBe(before - 1);
  });

  it('pays 10 HP per random pip as the skill resolves, not when queued', () => {
    const a = arena({ p0: [['summon.blood']], p1: [['shot']] });
    a.use(A1, 'summon.blood');
    expect(a.hp(A1)).toBe(100);
    a.end();
    expect(a.hp(A1)).toBe(80);
  });

  it('the HP is paid raw: Shield and Armor don\'t reduce it', () => {
    const a = arena({ p0: [['shot.blood']], p1: [['shot']] });
    a.give(A1, 'shield', { value: 50 }).give(A1, 'armor', { stacks: 3 }).use(A1, 'shot.blood', B1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it('can\'t be queued if the HP would kill the user (exactly lethal included)', () => {
    const a = arena({ p0: [['shot.blood']], p1: [['shot']] });
    a.setHp(A1, 10);
    expect(a.reject(() => a.use(A1, 'shot.blood', B1))).toBe('cannot_act');
    a.setHp(A1, 11).use(A1, 'shot.blood', B1).end();
    expect(a.hp(A1)).toBe(1);
  });

  it('fails as it resolves if the HP would now kill the user (and starts no cooldown)', () => {
    const a = arena({ p0: [['shot.blood'], ['heal.unholy']], p1: [['shot']] });
    // Consume Lesser hits A1 for 15 before Blood Dart resolves.
    a.setHp(A1, 20).use(A2, 'heal.unholy', A1).use(A1, 'shot.blood', B1).end();
    expect([a.hp(A1), a.unit(A1).alive, a.hp(B1), a.cooldown(A1, 'shot.blood')]).toEqual([5, true, 100, 0]);
  });

  it('non-Blood-Price skills with random costs still pay energy and no HP', () => {
    const a = arena({ p0: [['stab.blood']], p1: [['shot']] });
    a.use(A1, 'stab.blood', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(1);
    a.end();
    expect(a.hp(A1)).toBe(100);
  });

  it('extra random cost (Confusion) is also paid in HP', () => {
    const a = arena({ p0: [['shot.blood']], p1: [['curse']] });
    a.pass(1).use(B1, 'curse', A1).end();
    a.use(A1, 'shot.blood', B1).end();
    expect(a.hp(A1)).toBe(80);
  });
});

describe('Hemorrhage', () => {
  it('at the end of its applier\'s turn: 5 Affliction per stack, then +1 stack', () => {
    const a = arena({ p0: [['curse.blood']], p1: [['shot']] });
    a.use(A1, 'curse.blood', B1).end();
    // 2 stacks tick for 10, then grow to 3.
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([90, 3]);
    a.end(); // the bearer's own turn: no tick
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([90, 3]);
    a.end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([75, 4]);
  });

  it('caps at 5 stacks (25 a tick) and merges into one instance', () => {
    const a = arena({ p0: [['curse.blood']], p1: [['shot']] });
    a.give(B1, 'hemorrhage', { stacks: 4, source: A1 }).use(A1, 'curse.blood', B1).end();
    expect(a.effects(B1).filter((e) => e.defId === 'hemorrhage')).toHaveLength(1);
    expect([a.stacks(B1, 'hemorrhage'), a.hp(B1)]).toEqual([5, 75]);
    a.pass(2);
    expect([a.stacks(B1, 'hemorrhage'), a.hp(B1)]).toEqual([5, 50]);
  });

  it('is Affliction: Armor and Shield don\'t reduce it', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'hemorrhage', { stacks: 2, source: A1 }).give(B1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 50 });
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it('any healing the bearer receives removes it entirely', () => {
    const a = arena({ p0: [['shot']], p1: [['heal']] });
    a.give(B1, 'hemorrhage', { stacks: 3, source: A1 }).pass(1).setHp(B1, 50);
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage')]).toEqual([75, false]);
    a.end();
    expect(a.hp(B1)).toBe(75);
  });

  it('is a Debuff: Immune blocks it', () => {
    const a = arena({ p0: [['curse.blood']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'curse.blood', B1).end();
    expect(a.has(B1, 'hemorrhage')).toBe(false);
  });
});

describe('Blood skills', () => {
  it('Wringing Cut: 20 damage, removes up to 2 Weakness and drains a Soul Fragment for each', () => {
    const a = arena({ p0: [['strike.blood']], p1: [['shot']] });
    a.give(B1, 'weakness', { stacks: 3 }).use(A1, 'strike.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'weakness'), a.stacks(A1, 'soul_fragment')]).toEqual([80, 1, 2]);
  });

  it('Wringing Cut: no Weakness, no fragments', () => {
    const a = arena({ p0: [['strike.blood']], p1: [['shot']] });
    a.use(A1, 'strike.blood', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([80, 0]);
  });

  it('Wringing Cut: one Weakness gives one fragment', () => {
    const a = arena({ p0: [['strike.blood']], p1: [['shot']] });
    a.give(B1, 'weakness', { stacks: 1 }).use(A1, 'strike.blood', B1).end();
    expect([a.stacks(B1, 'weakness'), a.stacks(A1, 'soul_fragment')]).toEqual([0, 1]);
  });

  it('Crimson Wave: 25 / 10 splash; target +1 Hemorrhage, allies half the target\'s rounded up', () => {
    const a = arena({ p0: [['smash.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'hemorrhage', { stacks: 2, source: A1 }).use(A1, 'smash.blood', B1).end();
    // Target 3 stacks (15 tick → 4), allies ceil(3/2) = 2 (10 tick → 3).
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([60, 4]);
    expect([a.hp(B2), a.stacks(B2, 'hemorrhage'), a.hp(B3), a.stacks(B3, 'hemorrhage')]).toEqual([80, 3, 80, 3]);
  });

  it('Crimson Wave: a fresh target gives allies 1 each (half of 1, rounded up)', () => {
    const a = arena({ p0: [['smash.blood']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage'), a.hp(B2), a.stacks(B2, 'hemorrhage')]).toEqual([70, 2, 85, 2]);
  });

  it('Quickened Pulse: 10 damage, and the target gains 1 Hemorrhage; nothing more on the turn it\'s used', () => {
    const a = arena({ p0: [['charge.blood']], p1: [['shot']] });
    a.use(A1, 'charge.blood', B1).end();
    // Only the usual tick at the end of the user's turn: 5, then 2 stacks.
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage'), a.has(A1, 'quickened_pulse')]).toEqual([85, 2, true]);
  });

  it('Quickened Pulse: when the user\'s next skill resolves, every bleeding enemy\'s Hemorrhage ticks once more and grows', () => {
    const a = arena({ p0: [['charge.blood', 'shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'hemorrhage', { source: A1 }).use(A1, 'charge.blood', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([85, 95, 100]);
    a.pass(1).use(A1, 'shot', B1).end();
    // B1: 15 from Shot, an extra tick of 10 (→ 3 stacks), then the usual tick of 15 (→ 4).
    // B2: an extra tick of 10 (→ 3), then the usual 15 (→ 4). B3 isn't bleeding.
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage'), a.hp(B2), a.stacks(B2, 'hemorrhage'), a.hp(B3)]).toEqual([45, 4, 70, 4, 100]);
    expect(a.has(A1, 'quickened_pulse')).toBe(false);
  });

  it('Quickened Pulse: only the next skill — the one after it doesn\'t quicken anything', () => {
    const a = arena({ p0: [['charge.blood', 'shot', 'stab']], p1: [['shot']] });
    a.use(A1, 'charge.blood', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([45, 4]);
    a.pass(1).use(A1, 'stab', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([45 - 20 - 20, 5]); // Stab, then only the usual tick
  });

  it('Quickened Pulse: a pulse on no bleeding enemy does nothing', () => {
    const a = arena({ p0: [['charge.blood', 'shot']], p1: [['heal'], ['shot']] });
    a.use(A1, 'charge.blood', B1).end().use(B1, 'heal', B1).end();
    expect(a.has(B1, 'hemorrhage')).toBe(false);
    const before = a.hp(B1);
    a.use(A1, 'shot', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'quickened_pulse')]).toEqual([before, 85, false]);
  });

  it('Blood Spite: invisible; counters the first Harmful skill, attacker gains 1 Hemorrhage per 20 HP missing', () => {
    const a = arena({ p0: [['riposte.blood']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 70).use(A1, 'riposte.blood').end();
    expect(a.hp(A1)).toBe(60); // Blood Price
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    // 40 missing → 2 Hemorrhage on the countered attacker; only the first skill is countered.
    expect([a.stacks(B1, 'hemorrhage'), a.has(B2, 'hemorrhage'), a.hp(A1)]).toEqual([2, false, 45]);
  });

  it('Blood Spite: with less than 20 HP missing it counters but gives no Hemorrhage', () => {
    const a = arena({ p0: [['riposte.blood']], p1: [['shot']] });
    a.use(A1, 'riposte.blood').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'hemorrhage')]).toEqual([90, false]);
  });

  it('Blood Spite: expires after 1 turn when nothing triggers it', () => {
    const a = arena({ p0: [['riposte.blood']], p1: [['shot']] });
    a.use(A1, 'riposte.blood').end().end();
    expect(a.has(A1, 'blood_spite')).toBe(false);
  });

  it('Crimson Frenzy: Lifesteal and +5 per 20 HP missing, rechecked as each hit lands', () => {
    const a = arena({ p0: [['rage.blood', 'shot']], p1: [['shot']] });
    a.setHp(A1, 70).use(A1, 'rage.blood').end();
    expect(a.hp(A1)).toBe(60);
    a.pass(1).use(A1, 'shot', B1).end();
    // 40 missing → +10: 25 damage, all stolen back.
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 85]);
    a.pass(1).use(A1, 'shot', B1).end();
    // Now 15 missing → +0.
    expect([a.hp(B1), a.hp(A1)]).toEqual([60, 100]);
  });

  it('Crimson Frenzy: ends after 3 turns', () => {
    const a = arena({ p0: [['rage.blood', 'shot']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'rage.blood').end().pass(5);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([85, 40]);
  });

  it('Blood Dart: 15 and 1 Hemorrhage; no refund on a fresh target', () => {
    const a = arena({ p0: [['shot.blood']], p1: [['shot']] });
    a.use(A1, 'shot.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage'), a.hp(A1)]).toEqual([80, 2, 90]);
  });

  it('Blood Dart: against a bleeding target the user heals back the HP paid', () => {
    const a = arena({ p0: [['shot.blood']], p1: [['shot']] });
    a.give(B1, 'hemorrhage', { source: A1 }).use(A1, 'shot.blood', B1).end();
    expect([a.hp(A1), a.stacks(B1, 'hemorrhage')]).toEqual([100, 3]);
  });

  it('Crimson Lance: 40 on the following turn, target hidden', () => {
    const a = arena({ p0: [['snipe.blood']], p1: [['shot']] });
    a.use(A1, 'snipe.blood', B1).end();
    expect(a.hp(B1)).toBe(100);
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1)?.targets).toEqual([]);
    a.pass(2);
    expect(a.hp(B1)).toBe(60);
  });

  it('Crimson Lance: adds the damage the user took in between', () => {
    const a = arena({ p0: [['snipe.blood']], p1: [['shot']] });
    a.use(A1, 'snipe.blood', B1).end();
    a.use(B1, 'shot', A1).end().end();
    expect(a.hp(B1)).toBe(45);
  });

  it('Crimson Lance: the bonus is capped at 30', () => {
    const a = arena({ p0: [['snipe.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'snipe.blood', B1).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).use(B3, 'shot', A1).end().end();
    expect(a.hp(B1)).toBe(30);
  });

  it('Tainted Cure: invisible; the next healing becomes Hemorrhage, 1 per 10 HP', () => {
    const a = arena({ p0: [['trap.blood']], p1: [['heal'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.blood', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.use(B2, 'heal', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([50, 2]);
  });

  it('Tainted Cure: only the next healing; the one after works (and clears the Hemorrhage)', () => {
    const a = arena({ p0: [['trap.blood']], p1: [['heal'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.blood', B1).end();
    a.use(B2, 'heal', B1).end().end(); // Hemorrhage ticks once on A's turn: 10, then 3 stacks
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage')]).toEqual([65, false]);
  });

  it('Tainted Cure: expires after 3 turns', () => {
    const a = arena({ p0: [['trap.blood']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.blood', B1).end().pass(6);
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage')]).toEqual([75, false]);
  });

  it('Pale Step: invisible to the enemy', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot']] });
    a.use(A1, 'maneuver.blood').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
  });

  it('Pale Step: the enemy who last damaged the user gains 1 Hemorrhage, and for 1 turn enemies with Hemorrhage can\'t target them', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot'], ['shot']] });
    a.end().use(B1, 'shot', A1).end();
    a.use(A1, 'maneuver.blood').end();
    expect([a.has(B1, 'hemorrhage'), a.has(B2, 'hemorrhage')]).toEqual([true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B2, 'shot', A1).end(); // a clean enemy still can
    expect(a.hp(A1)).toBe(70);
  });

  it('Pale Step: if no enemy has damaged the user yet, a random enemy gains 1 Hemorrhage', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'maneuver.blood').end();
    expect([B1, B2, B3].filter((id) => a.has(id, 'hemorrhage'))).toHaveLength(1);
  });

  it('Pale Step: their ticking damage can\'t reach the user either', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot']] });
    a.give(B1, 'hemorrhage', { source: A1 }).give(A1, 'ignite', { source: B1 }).use(A1, 'maneuver.blood').end().end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Pale Step: each enemy who damages the user gains 1 Hemorrhage', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.end().use(B3, 'shot', A1).end(); // B3 is the one who bleeds from the start
    a.use(A1, 'maneuver.blood').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    // Each now bleeds (ticking at the end of the user's turn): 5, then 2 stacks.
    expect([a.hp(A1), a.has(B1, 'hemorrhage'), a.has(B2, 'hemorrhage')]).toEqual([55, true, true]);
    a.end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([95, 2]);
  });

  it('Pale Step: gone after 1 turn', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot']] });
    a.use(A1, 'maneuver.blood').end().pass(2);
    a.give(B1, 'hemorrhage', { source: A1 }).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Bloodbound Familiar: permanent; a hit on it doesn\'t kill it and hurts the user instead', () => {
    const a = arena({ p0: [['companion.blood']], p1: [['strike']] });
    a.use(A1, 'companion.blood').end();
    const fam = minion(a, 'bloodbound_familiar')!;
    expect(fam.owner).toBe(0);
    a.use(B1, 'strike', fam.id).end();
    expect([a.hp(A1) < 100, a.unit(fam.id).alive, a.unit(fam.id).hp]).toEqual([true, true, 10]);
    a.pass(10);
    expect(a.unit(fam.id).alive).toBe(true);
  });

  it('Bloodbound Familiar: the full damage dealt to it goes to the user', () => {
    const a = arena({ p0: [['companion.blood']], p1: [['strike']] });
    a.use(A1, 'companion.blood').end();
    const fam = minion(a, 'bloodbound_familiar')!;
    a.use(B1, 'strike', fam.id).end();
    expect(a.hp(A1)).toBe(80);
  });

  it('Bloodbound Familiar: healing it heals the user', () => {
    const a = arena({ p0: [['companion.blood'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'companion.blood').end().pass(1);
    const fam = minion(a, 'bloodbound_familiar')!;
    a.use(A2, 'heal', fam.id).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Bloodbound Familiar: dies when the user dies', () => {
    const a = arena({ p0: [['companion.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.blood').end();
    const fam = minion(a, 'bloodbound_familiar')!;
    a.setHp(A1, 10).use(B1, 'shot', A1).end();
    expect([a.unit(A1).alive, a.unit(fam.id).alive]).toEqual([false, false]);
  });

  it('Bloodbound Familiar: Bite deals 15', () => {
    const a = arena({ p0: [['companion.blood']], p1: [['shot']] });
    a.use(A1, 'companion.blood').end().pass(1);
    const fam = minion(a, 'bloodbound_familiar')!;
    a.use(fam.id, 'bloodbound_familiar_bite', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Sanguine Bolt: 25 damage; the HP paid heals the lowest-HP ally, doubled', () => {
    const a = arena({ p0: [['bolt.blood'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).setHp('p0c2', 60).use(A1, 'bolt.blood', B1).end();
    expect([a.hp(B1), a.hp(A1), a.hp(A2), a.hp('p0c2')]).toEqual([75, 90, 60, 60]);
  });

  it('Red Rain: 25 to all, then spends every fragment for 1 Hemorrhage each on every enemy', () => {
    const a = arena({ p0: [['blast.blood']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'blast.blood').end();
    // 25 + 10 (fragments still held when it hits), then 2 Hemorrhage tick for 10 → 3 stacks.
    expect([a.hp(B1), a.hp(B2), a.stacks(B1, 'hemorrhage'), a.stacks(B2, 'hemorrhage')]).toEqual([55, 55, 3, 3]);
    expect([a.stacks(A1, 'soul_fragment'), a.hp(A1)]).toEqual([0, 90]);
  });

  it('Red Rain: without fragments, no Hemorrhage', () => {
    const a = arena({ p0: [['blast.blood']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.blood').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'hemorrhage')]).toEqual([75, 75, false]);
  });

  it('Transfusion: drinks the Hemorrhage — it ends and the user heals 10 per stack', () => {
    const a = arena({ p0: [['consume.blood']], p1: [['shot']] });
    a.give(B1, 'hemorrhage', { stacks: 3, source: A1 }).setHp(A1, 50).use(A1, 'consume.blood', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage'), a.hp(A1)]).toEqual([95, false, 80]);
  });

  it('Transfusion: on a target without Hemorrhage, they gain 1 and nobody heals', () => {
    const a = arena({ p0: [['consume.blood']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage'), a.hp(A1)]).toEqual([90, 2, 50]);
  });

  it('Blood Elemental: lasts 3 turns, with HP equal to what was paid', () => {
    const a = arena({ p0: [['summon.blood']], p1: [['shot']] });
    a.use(A1, 'summon.blood').end();
    const el = minion(a, 'blood_elemental')!;
    expect([a.hp(A1), el.hp, el.maxHp]).toEqual([80, 20, 20]);
    a.pass(4);
    expect(a.unit(el.id).alive).toBe(true);
    a.pass(1);
    expect(a.unit(el.id).alive).toBe(false);
    expect(a.hp(A1)).toBe(80); // ruling: it doesn't return its HP
  });

  it('Blood Elemental: paying more (Confusion) makes a bigger Elemental', () => {
    const a = arena({ p0: [['summon.blood']], p1: [['curse']] });
    a.pass(1).use(B1, 'curse', A1).end();
    a.use(A1, 'summon.blood').end();
    const el = minion(a, 'blood_elemental')!;
    expect([a.hp(A1), el.hp, el.maxHp]).toEqual([70, 30, 30]);
  });

  it('Blood Elemental: Blood Lash costs nothing, deals 10 and gives 1 Hemorrhage', () => {
    const a = arena({ p0: [['summon.blood']], p1: [['shot']] });
    a.use(A1, 'summon.blood').end().pass(1);
    const el = minion(a, 'blood_elemental')!;
    a.use(el.id, 'blood_elemental_lash', B1);
    expect(a.state.players[0].queue[0]!.cost).toEqual({ S: 0, A: 0, I: 0, W: 0, r: 0 });
    a.end();
    // 10, then the Hemorrhage (applied this turn by the user's side) ticks 5 → 2 stacks.
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([85, 2]);
  });

  it('Exsanguinate: each of the user\'s turns adds 1 Hemorrhage and heals 5 per stack on the target', () => {
    const a = arena({ p0: [['channel.blood']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'channel.blood', B1).end();
    // Paid 20; first tick: 1 stack → heals 5 (the new Hemorrhage hasn't ticked yet).
    expect([a.hp(A1), a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([35, 100, 1]);
    a.pass(2);
    // +1 → 2 stacks: heals 10, the Hemorrhage deals 10 and grows to 3.
    expect([a.hp(A1), a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([45, 90, 3]);
    a.pass(2);
    expect([a.hp(A1), a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([65, 70, 5]);
  });

  it('Exsanguinate: stops after 3 turns (the Hemorrhage keeps ticking, but no more healing)', () => {
    const a = arena({ p0: [['channel.blood']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'channel.blood', B1).end().pass(5);
    expect(a.hp(A1)).toBe(65);
    a.pass(1);
    expect([a.hp(A1), a.hp(B1)]).toEqual([65, 45]);
  });

  it('Bloodletter\'s Knife: 10 damage; a target missing under 30 HP after it doesn\'t bleed', () => {
    const a = arena({ p0: [['stab.blood']], p1: [['shot']] });
    a.setHp(B1, 81).use(A1, 'stab.blood', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage')]).toEqual([71, false]);
  });

  it('Bloodletter\'s Knife: then 1 Hemorrhage for every 30 HP the target is missing', () => {
    const a = arena({ p0: [['stab.blood'], ['stab.blood']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 70).setHp(B2, 41).use(A1, 'stab.blood', B1).use(A2, 'stab.blood', B2).end();
    // B1: 60 HP, 40 missing → 1 (ticks 5, grows to 2). B2: 31 HP, 69 missing → 2 (ticks 10, grows to 3).
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage'), a.hp(B2), a.stacks(B2, 'hemorrhage')]).toEqual([55, 2, 21, 3]);
  });

  it('Arterial Strike: 30 Piercing (ignores Armor) and 2 Hemorrhage', () => {
    const a = arena({ p0: [['ravage.blood']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([60, 3]);
  });

  it('Arterial Strike: if healed before the user\'s next turn, the healer takes the Hemorrhage', () => {
    const a = arena({ p0: [['ravage.blood']], p1: [['shot'], ['heal']] });
    a.use(A1, 'ravage.blood', B1).end();
    a.use(B2, 'heal', B1).end();
    expect([a.has(B1, 'hemorrhage'), a.stacks(B2, 'hemorrhage'), a.hp(B1)]).toEqual([false, 3, 85]);
  });

  it('Arterial Strike: healing after the user\'s next turn just removes the Hemorrhage', () => {
    const a = arena({ p0: [['ravage.blood']], p1: [['shot'], ['heal']] });
    a.use(A1, 'ravage.blood', B1).end().pass(2);
    a.use(B2, 'heal', B1).end();
    expect([a.has(B1, 'hemorrhage'), a.has(B2, 'hemorrhage')]).toEqual([false, false]);
  });

  it('Red Herring: invisible; target enemy gains 1 Hemorrhage, and their next Harmful skill is countered', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['smash']] });
    a.use(A1, 'mislead.blood', B1).end();
    expect(a.hp(A1)).toBe(90); // Blood Price
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([95, 2]);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it('Red Herring: only one counter in all — the first Harmful skill used by any bleeding enemy; a clean one isn\'t watched', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'hemorrhage', { source: A1 }).use(A1, 'mislead.blood', B1).end();
    a.use(B2, 'shot', A1).use(B1, 'shot', A1).use(B3, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90 - 15 - 15); // B2's shot is countered; B1's and B3's land
    const b = arena({ p0: [['mislead.blood']], p1: [['shot'], ['shot']] });
    b.give(B2, 'hemorrhage', { source: A1 }).use(A1, 'mislead.blood', B1).end();
    b.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(b.hp(A1)).toBe(90 - 15); // now B1's is the one countered
  });

  it('Red Herring: Helpful skills aren\'t countered', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.blood', B1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage')]).toEqual([45 + 25, false]);
  });

  it('Red Herring: lasts only 1 turn', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['shot']] });
    a.use(A1, 'mislead.blood', B1).end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Swoon: 15 damage and Stunned', () => {
    const a = arena({ p0: [['stun.blood']], p1: [['shot']] });
    a.use(A1, 'stun.blood', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Swoon: lasts up to 2 turns without healing', () => {
    const a = arena({ p0: [['stun.blood']], p1: [['shot']] });
    a.use(A1, 'stun.blood', B1).end().pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Swoon: healing wakes them', () => {
    const a = arena({ p0: [['stun.blood']], p1: [['shot'], ['heal']] });
    a.use(A1, 'stun.blood', B1).end();
    a.use(B2, 'heal', B1).end().pass(1);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Danse Sanguine: 1 Hemorrhage; damaging a bleeding enemy deepens it and gives Swiftness', () => {
    const a = arena({ p0: [['dance.blood', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.blood', B1).end();
    expect(a.stacks(B1, 'hemorrhage')).toBe(2); // 1, ticked to 2
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.stacks(B1, 'hemorrhage'), a.stacks(A1, 'swiftness')]).toEqual([4, 1]);
  });

  it('Danse Sanguine: damaging a non-bleeding enemy does nothing', () => {
    const a = arena({ p0: [['dance.blood', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.blood', B1).end().pass(1);
    a.use(A1, 'shot', B2).end();
    expect([a.has(B2, 'hemorrhage'), a.has(A1, 'swiftness')]).toEqual([false, false]);
  });

  it('Danse Sanguine: Swiftness is capped at 2', () => {
    const a = arena({ p0: [['dance.blood', 'smash']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'dance.blood', B1).end();
    a.give(B2, 'hemorrhage', { source: A1 }).give(B3, 'hemorrhage', { source: A1 }).pass(1);
    a.use(A1, 'smash', B1).end();
    expect(a.stacks(A1, 'swiftness')).toBe(2);
  });

  it('Danse Sanguine: ends after 3 turns', () => {
    const a = arena({ p0: [['dance.blood', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.blood', B1).end().pass(5);
    a.use(A1, 'shot', B1).end();
    expect(a.has(A1, 'swiftness')).toBe(false);
  });

  it('Bloodletting: up to 2 of target ally\'s Debuffs are removed, and they heal 15 plus 10 per Debuff removed', () => {
    const a = arena({ p0: [['heal.blood'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).give(A2, 'weakness', { source: B1 }).give(A2, 'intimidated', { source: B1 }).give(A2, 'vulnerable', { source: B1 });
    a.use(A1, 'heal.blood', A2).end();
    const left = ['weakness', 'intimidated', 'vulnerable'].filter((d) => a.has(A2, d));
    expect([a.hp(A2), left.length]).toEqual([75, 1]);
  });

  it('Bloodletting: one Debuff removed heals 25; none heals 15', () => {
    const a = arena({ p0: [['heal.blood'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).give(A2, 'weakness', { source: B1 });
    a.use(A1, 'heal.blood', A2).end();
    expect([a.hp(A2), a.has(A2, 'weakness')]).toEqual([65, false]);
    const b = arena({ p0: [['heal.blood'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 40).use(A1, 'heal.blood', A2).end();
    expect(b.hp(A2)).toBe(55);
  });

  it('Blood Doping: 2 Might and 2 Swiftness for 2 turns', () => {
    const a = arena({ p0: [['bless.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.blood', A2).end();
    expect([a.stacks(A2, 'might'), a.stacks(A2, 'swiftness')]).toEqual([2, 2]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Blood Doping: when it ends the ally crashes, Stunned even with Swiftness', () => {
    const a = arena({ p0: [['bless.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.blood', A2).end().pass(3);
    a.give(A2, 'swiftness', { stacks: 2 });
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('cannot_act');
  });

  it('Blood Doping: the crash lasts only 1 of the ally\'s turns', () => {
    const a = arena({ p0: [['bless.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.blood', A2).end().pass(5);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Hemophilia: 2 Hemorrhage that healing can\'t remove for 2 turns', () => {
    const a = arena({ p0: [['curse.blood']], p1: [['heal']] });
    a.use(A1, 'curse.blood', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.stacks(B1, 'hemorrhage')).toBe(3);
  });

  it('Hemophilia: after 2 turns, healing removes the Hemorrhage again', () => {
    const a = arena({ p0: [['curse.blood']], p1: [['heal']] });
    a.use(A1, 'curse.blood', B1).end().pass(4);
    a.use(B1, 'heal', B1).end();
    expect(a.has(B1, 'hemorrhage')).toBe(false);
  });

  it('Bloodmark: 20 and 1 Hemorrhage; allies who damage the target heal 5 per stack', () => {
    const a = arena({ p0: [['smite.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([75, 2]);
    a.setHp(A2, 50).pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(60);
  });

  it('Bloodmark: ends after 2 turns', () => {
    const a = arena({ p0: [['smite.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.blood', B1).end().setHp(A2, 50).pass(5);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(50);
  });

  it('Blood Chant: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.blood'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.blood').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([50, 70]); // the user also paid 20
  });

  it('Blood Chant: through the user\'s next turn, other allies pay random costs in HP (10 each), not energy', () => {
    const a = arena({ p0: [['prayer.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.blood').end().pass(1);
    a.use(A2, 'shot', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(0);
    a.end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([90, 85]);
  });

  it('Blood Chant: an ally who queued alongside it already paid energy, and pays no HP on top', () => {
    const a = arena({ p0: [['prayer.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.blood').use(A2, 'shot', B1);
    expect(a.state.players[0].queue[1]!.cost.r).toBe(1);
    a.end();
    expect(a.hp(A2)).toBe(100);
  });

  it('Blood Chant: after the user\'s next turn, allies pay energy again', () => {
    const a = arena({ p0: [['prayer.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.blood').end().pass(3);
    a.use(A2, 'shot', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(1);
    a.end();
    expect(a.hp(A2)).toBe(100);
  });

  it('Crimson Spray: 20 damage; with no Hemorrhage on the target, a random other enemy still takes 10', () => {
    const a = arena({ p0: [['cleave.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.blood', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 90]);
  });

  it('Crimson Spray: the target\'s Hemorrhage bursts onto a random other enemy — it ends, and that enemy takes 10 per stack', () => {
    const a = arena({ p0: [['cleave.blood']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hemorrhage', { stacks: 3, source: A1 }).use(A1, 'cleave.blood', B1).end();
    expect([a.hp(B1), a.has(B1, 'hemorrhage'), a.hp(B2), a.has(B2, 'hemorrhage')]).toEqual([80, false, 70, false]);
    const b = arena({ p0: [['cleave.blood']], p1: [['shot'], ['shot']] });
    b.give(B1, 'hemorrhage', { stacks: 1, source: A1 }).use(A1, 'cleave.blood', B1).end();
    expect([b.hp(B1), b.hp(B2)]).toEqual([80, 90]);
  });

  it('Bloodcurdle: all enemies gain 1 Hemorrhage', () => {
    const a = arena({ p0: [['shout.blood']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.blood').end();
    expect([a.has(B1, 'hemorrhage'), a.has(B2, 'hemorrhage'), a.has(B1, 'intimidated')]).toEqual([true, true, false]);
  });

  it('Bloodcurdle: for 2 turns, an enemy who\'s healed is also Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.blood']], p1: [['heal'], ['shot']] });
    a.use(A1, 'shout.blood').end();
    a.use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'intimidated'), a.has(B1, 'hemorrhage'), a.has(B2, 'intimidated')]).toEqual([true, false, false]);
    expect(a.cooldown(B1, 'heal')).toBe(1); // used before the Intimidation landed
    a.pass(3);
    expect(a.has(B1, 'intimidated')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Bloodcurdle: healing after the 2 turns doesn\'t Intimidate', () => {
    const a = arena({ p0: [['shout.blood']], p1: [['heal']] });
    a.use(A1, 'shout.blood').end().pass(4);
    a.use(B1, 'heal', B1).end();
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Clotting Ward: for 1 turn, direct hits deal half damage; every 20 it stops clots into 1 Hemorrhage', () => {
    const a = arena({ p0: [['withstand.blood']], p1: [['smash.devil'], ['smash.devil']] });
    a.use(A1, 'withstand.blood').end();
    a.use(B1, 'smash.devil', A1).use(B2, 'smash.devil', A1).end(); // 40 → 20 twice: 40 stopped
    expect([a.hp(A1), a.stacks(A1, 'hemorrhage')]).toEqual([60, 2]);
  });

  it('Clotting Ward: what it stops adds up over the turn, so small hits clot too', () => {
    const a = arena({ p0: [['withstand.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'withstand.blood').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // 15 → 8 twice: 16 stopped, no clot yet
    expect([a.hp(A1), a.has(A1, 'hemorrhage')]).toEqual([84, false]);
    const b = arena({ p0: [['withstand.blood']], p1: [['shot'], ['shot'], ['shot']] });
    b.use(A1, 'withstand.blood').end();
    b.use(B1, 'shot', A1).use(B2, 'shot', A1).use(B3, 'shot', A1).end(); // 24 stopped
    expect([b.hp(A1), b.stacks(A1, 'hemorrhage')]).toEqual([76, 1]);
  });

  it("Clotting Ward: the clot bleeds once at the end of the user's next turn, then closes: their Hemorrhage ends", () => {
    const a = arena({ p0: [['withstand.blood'], ['shot']], p1: [['smash.devil']] });
    a.use(A1, 'withstand.blood').end().use(B1, 'smash.devil', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'hemorrhage')]).toEqual([80, 1]);
    a.end(); // the user's turn ends: it bleeds 5, then the clot closes
    expect([a.hp(A1), a.has(A1, 'hemorrhage')]).toEqual([75, false]);
    a.pass(4);
    expect(a.hp(A1)).toBe(75);
  });

  it('Clotting Ward: it lasts 1 turn', () => {
    const a = arena({ p0: [['withstand.blood']], p1: [['shot']] });
    a.use(A1, 'withstand.blood').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'hemorrhage')]).toEqual([85, false]);
  });

  it('Open Vein: the user gains 2 Hemorrhage, and target enemy is Taunted by them for 2 turns', () => {
    const a = arena({ p0: [['taunt.blood'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.blood', B1).end();
    // The user's own Hemorrhage ticks: 10, then 3 stacks.
    expect([a.hp(A1), a.stacks(A1, 'hemorrhage')]).toEqual([90, 3]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end().pass(1);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Open Vein: when the Taunted enemy damages the user, the user\'s Hemorrhage moves onto them', () => {
    const a = arena({ p0: [['taunt.blood'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.blood', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'hemorrhage'), a.stacks(B1, 'hemorrhage')]).toEqual([75, false, 3]);
    a.end(); // now it bleeds them at the end of the user's turn
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([85, 4]);
  });

  it('Open Vein: an enemy the user didn\'t Taunt takes nothing', () => {
    const a = arena({ p0: [['taunt.blood'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.blood', B1).end().use(B2, 'shot', A1).end();
    expect([a.stacks(A1, 'hemorrhage'), a.has(B2, 'hemorrhage')]).toEqual([3, false]);
  });

  it('Crimson Colossus: 2 Armor and Immortal for 3 turns', () => {
    const a = arena({ p0: [['titan.blood']], p1: [['strike']] });
    a.use(A1, 'titan.blood').end();
    expect([a.hp(A1), a.stacks(A1, 'armor'), a.has(A1, 'immortal')]).toEqual([80, 2, true]);
    a.setHp(A1, 6).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(5);
    a.pass(4);
    expect([a.has(A1, 'armor'), a.has(A1, 'immortal')]).toEqual([false, false]);
  });

  it('Crimson Colossus: meanwhile all the user\'s random costs are paid in HP', () => {
    const a = arena({ p0: [['titan.blood', 'stab.blood']], p1: [['shot']] });
    a.use(A1, 'titan.blood').end().pass(1);
    a.use(A1, 'stab.blood', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(0);
    a.end();
    expect(a.hp(A1)).toBe(70);
  });

  it('Crimson Colossus: after 3 turns random costs are energy again', () => {
    const a = arena({ p0: [['titan.blood', 'stab.blood']], p1: [['shot']] });
    a.use(A1, 'titan.blood').end().pass(5);
    a.use(A1, 'stab.blood', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(1);
  });
});
