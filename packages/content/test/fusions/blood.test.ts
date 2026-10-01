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

  it('Quickened Pulse: 15 damage and 1 Focus for the next skill', () => {
    const a = arena({ p0: [['charge.blood', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.blood', B1).end();
    expect([a.hp(B1), a.has(A1, 'focus')]).toEqual([85, true]);
    a.pass(1).use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(0);
    a.end();
    expect(a.has(A1, 'focus')).toBe(false);
  });

  it('Quickened Pulse: until the end of the user\'s next turn, every 10 HP healed gives 1 Renew (any healing)', () => {
    const a = arena({ p0: [['charge.blood'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'charge.blood', B1).end().pass(1);
    a.use(A2, 'heal', A1).end();
    // Healed 25 → 2 Renew. The Renew tick (+10) is healing too, so it gives 1 more before losing 1.
    expect([a.hp(A1), a.stacks(A1, 'renew')]).toEqual([85, 2]);
  });

  it('Quickened Pulse: healing after the user\'s next turn gives no Renew', () => {
    const a = arena({ p0: [['charge.blood'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'charge.blood', B1).end().pass(3);
    a.use(A2, 'heal', A1).end();
    expect([a.hp(A1), a.has(A1, 'renew')]).toEqual([75, false]);
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

  // BUG: Pale Step is Invisible, but its Immortal is visible to the enemy (only the drain Buff is hidden).
  it.fails('Pale Step: invisible to the enemy', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot']] });
    a.use(A1, 'maneuver.blood').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
  });

  it('Pale Step: Immortal for 1 turn; drains a fragment from each enemy who damages the user', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'soul_fragment').setHp(A1, 30).use(A1, 'maneuver.blood').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    // B1's fragment gives it +5: 20 + 15 = 35 against 30 HP → Immortal floor 5.
    expect([a.hp(A1), a.unit(A1).alive, a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([5, true, 2, 0]);
    expect(a.stacks(B3, 'soul_fragment')).toBe(0);
  });

  it('Pale Step: no damage, no fragments; gone after 1 turn', () => {
    const a = arena({ p0: [['maneuver.blood']], p1: [['shot']] });
    a.use(A1, 'maneuver.blood').end().end();
    expect([a.stacks(A1, 'soul_fragment'), a.has(A1, 'immortal')]).toEqual([0, false]);
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

  // BUG: "damage to it goes to the user" — a 20-damage Strike on the Familiar costs the user only 9 (its 10 HP minus the floor of 1).
  it.fails('Bloodbound Familiar: the full damage dealt to it goes to the user', () => {
    const a = arena({ p0: [['companion.blood']], p1: [['strike']] });
    a.use(A1, 'companion.blood').end();
    const fam = minion(a, 'bloodbound_familiar')!;
    a.use(B1, 'strike', fam.id).end();
    expect(a.hp(A1)).toBe(80);
  });

  // BUG: "healing to it goes to the user" — the Familiar is always at full HP, so a heal on it heals the user 0.
  it.fails('Bloodbound Familiar: healing it heals the user', () => {
    const a = arena({ p0: [['companion.blood'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'companion.blood').end().pass(1);
    const fam = minion(a, 'bloodbound_familiar')!;
    a.use(A2, 'heal', fam.id).end();
    expect(a.hp(A1)).toBe(75);
  });

  // BUG: "it dies only with them" — the Familiar stays alive after its summoner dies.
  it.fails('Bloodbound Familiar: dies when the user dies', () => {
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

  // BUG: "with HP equal to what the user paid" — paying 30 gives max HP 30 but current HP stays 20.
  it.fails('Blood Elemental: paying more (Confusion) makes a bigger Elemental', () => {
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

  it('Bloodletter\'s Knife: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.blood'], ['stab.blood']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 61).setHp(B2, 60).use(A1, 'stab.blood', B1).use(A2, 'stab.blood', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([51, 40]);
  });

  it('Bloodletter\'s Knife: the user\'s Renew heals once now without losing a stack', () => {
    const a = arena({ p0: [['stab.blood']], p1: [['shot']] });
    a.give(A1, 'renew', { stacks: 2, source: A1 }).setHp(A1, 50).use(A1, 'stab.blood', B1).end();
    // +10 now (still 2 stacks), then the normal tick: +10 and down to 1.
    expect([a.hp(A1), a.stacks(A1, 'renew')]).toEqual([70, 1]);
  });

  it('Arterial Strike: 30 Piercing (ignores Armor) and 2 Hemorrhage', () => {
    const a = arena({ p0: [['ravage.blood']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.blood', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'hemorrhage')]).toEqual([60, 3]);
  });

  // SPEC: "the healer takes the Hemorrhage" / status "takes their Hemorrhage": the target's current stacks (3 after a tick) or the 2 applied? The healer gets 2.
  it.fails('Arterial Strike: if healed before the user\'s next turn, the healer takes the Hemorrhage', () => {
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

  // BUG: the countered Smash (Sr, 2 energy) should cost its user 20 HP; they lose 0 ("deals 0 indirect Affliction").
  it.fails('Red Herring: invisible; counters a Harmful skill and the user pays its cost again, 10 HP per energy', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['smash']] });
    a.use(A1, 'mislead.blood', B1).end();
    expect(a.hp(A1)).toBe(90);
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([90, 80]);
  });

  // BUG: same as above for a 1-energy Shot: 10 HP expected, 0 paid.
  it.fails('Red Herring: a countered 1-energy Shot costs its user 10 HP', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['shot']] });
    a.use(A1, 'mislead.blood', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([90, 90]);
  });

  it('Red Herring: Helpful skills aren\'t countered or charged', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.blood', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Red Herring: lasts only 1 turn', () => {
    const a = arena({ p0: [['mislead.blood']], p1: [['shot']] });
    a.use(A1, 'mislead.blood', B1).end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([75, 100]);
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

  it('Restitution: the ally heals 20 and their most recent attacker loses 20 (raw)', () => {
    const a = arena({ p0: [['heal.blood'], ['shot']], p1: [['shot'], ['shot']] });
    a.pass(1).use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    a.give(B2, 'shield', { value: 50 }).give(B2, 'armor', { stacks: 3 });
    a.use(A1, 'heal.blood', A2).end();
    expect([a.hp(A2), a.hp(B1), a.hp(B2)]).toEqual([90, 100, 80]);
  });

  it('Restitution: with no attacker, just the heal', () => {
    const a = arena({ p0: [['heal.blood'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.blood', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([70, 100]);
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

  // BUG: "Stunned for 1 turn" — the crash is applied on the enemy's turn with 3 ticks, so the ally also misses their second turn after it.
  it.fails('Blood Doping: the crash lasts only 1 of the ally\'s turns', () => {
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

  // BUG: an ally queued after Blood Chant pays the random cost twice: energy (locked at queue time) and 10 HP.
  it.fails('Blood Chant: until the user\'s next turn, other allies pay random costs in HP (10 each), not energy', () => {
    const a = arena({ p0: [['prayer.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.blood').use(A2, 'shot', B1);
    const before = energyTotal(a, 0);
    a.end();
    // Only Blood Chant's I is paid in energy; A2's Shot costs them 10 HP.
    expect([energyTotal(a, 0), a.hp(A2), a.hp(B1)]).toEqual([before - 1, 90, 85]);
  });

  it('Blood Chant: by the user\'s next turn, allies pay energy again', () => {
    const a = arena({ p0: [['prayer.blood'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.blood').end().pass(1);
    a.use(A2, 'shot', B1);
    expect(a.state.players[0].queue[0]!.cost.r).toBe(1);
    a.end();
    expect(a.hp(A2)).toBe(100);
  });

  it('Leeching Sweep: 25 to the target and 15 to exactly one other enemy', () => {
    const a = arena({ p0: [['cleave.blood']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.blood', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 85]);
  });

  it('Leeching Sweep: with Lifesteal, the user\'s ticking/Affliction damage heals them too', () => {
    const a = arena({ p0: [['cleave.blood']], p1: [['shot'], ['shot']] });
    a.give(A1, 'lifesteal').give(B1, 'hemorrhage', { stacks: 2, source: A1 }).setHp(A1, 30).use(A1, 'cleave.blood', B1).end();
    // 40 stolen by the hits, 10 by the Hemorrhage tick.
    expect(a.hp(A1)).toBe(80);
  });

  it('Leeching Sweep: without Lifesteal, ticks don\'t heal', () => {
    const a = arena({ p0: [['cleave.blood']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hemorrhage', { stacks: 2, source: A1 }).setHp(A1, 30).use(A1, 'cleave.blood', B1).end();
    expect(a.hp(A1)).toBe(30);
  });

  it('Bloodcurdle: all enemies Intimidated; each who uses a Helpful skill gives the user a fragment', () => {
    const a = arena({ p0: [['shout.blood']], p1: [['heal'], ['shot']] });
    a.use(A1, 'shout.blood').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
    expect(a.cooldown(B1, 'heal')).toBe(2); // CD 1 +1 Intimidated, after one tick
  });

  it('Bloodcurdle: ends after 2 turns', () => {
    const a = arena({ p0: [['shout.blood']], p1: [['heal']] });
    a.use(A1, 'shout.blood').end().pass(4);
    a.use(B1, 'heal', B1).end();
    expect([a.has(B1, 'intimidated'), a.stacks(A1, 'soul_fragment')]).toEqual([false, 0]);
  });

  it('Clotting Ward: 25 Shield; while it holds, Renew heals again at the start of the user\'s turn', () => {
    const a = arena({ p0: [['withstand.blood']], p1: [['shot']] });
    a.give(A1, 'renew', { stacks: 2, source: A1 }).setHp(A1, 50).use(A1, 'withstand.blood').end();
    expect(a.hp(A1)).toBe(60); // normal Renew tick
    a.use(B1, 'shot', A1).end();
    // Shield absorbed the shot; at the start of the user's turn Renew (1 stack) heals once more.
    expect(a.hp(A1)).toBe(65);
  });

  // BUG: ruling 21.33 "lasts until the start of the user's next turn" — the Shield is still up through the user's turn.
  it.fails('Clotting Ward: the Shield ends at the start of the user\'s next turn', () => {
    const a = arena({ p0: [['withstand.blood']], p1: [['shot']] });
    a.use(A1, 'withstand.blood').end().end();
    expect(a.has(A1, 'clotting_ward')).toBe(false);
  });

  it('Clotting Ward: a broken Shield gives no extra Renew', () => {
    const a = arena({ p0: [['withstand.blood']], p1: [['shot'], ['shot']] });
    a.give(A1, 'renew', { stacks: 2, source: A1 }).setHp(A1, 50).use(A1, 'withstand.blood').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(55);
  });

  it('Bloodied Waters: Taunted; each skill aimed at the user gives 1 Confusion', () => {
    const a = arena({ p0: [['taunt.blood'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.blood', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.stacks(B1, 'confusion'), a.has(B2, 'confusion')]).toEqual([1, false]);
  });

  it('Bloodied Waters: the Confusion lasts 2 turns', () => {
    const a = arena({ p0: [['taunt.blood']], p1: [['shot']] });
    a.use(A1, 'taunt.blood', B1).end();
    a.use(B1, 'shot', A1).end().pass(3);
    expect(a.has(B1, 'confusion')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'confusion')).toBe(false);
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
