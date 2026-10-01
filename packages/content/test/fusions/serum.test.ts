// Spec-driven scenarios for Serum (Water + Poison): Dose, Overdose, the Prey hooks and all 30 variants.
// Sources: in-game descriptions, docs/rules.md §21.30, and the kit table in water-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor, type Cost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const three = (s: string[] = ['shot']) => [s, ['shot'], ['shot']];

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

/** How many effects on `bearer` the opponent (player 2) can see. */
const seenByB = (a: Arena, bearer: string) =>
  viewFor(content, a.state, 1).effects.filter((e) => e.bearer === bearer).length;

const dose = (a: Arena, id: string) => a.stacks(id, 'dose');

/** Sum of Affliction damage dealt to `id` in log lines since event index `from`. */
const afflictionTo = (a: Arena, id: string, from: number) => {
  const name = a.unit(id).name;
  return a
    .log(a.events.slice(from))
    .map((l) => new RegExp(`deals (\\d+) (?:indirect )?Affliction damage to ${name} `).exec(l))
    .reduce((n, m) => n + (m ? Number(m[1]) : 0), 0);
};

const debuffs = (a: Arena, id: string) =>
  a.effects(id).filter((e) => (e.inline ?? content.statuses[e.defId])?.kind === 'Debuff').length;

describe('Serum keyword: Dose and Overdose', () => {
  it('Dose is a Buff: Immune doesn\'t stop it', () => {
    expect(content.statuses.dose?.kind).toBe('Buff');
    const a = arena({ p0: [['strike.serum']], p1: three() });
    a.give(B1, 'immune').use(A1, 'strike.serum', B1).end();
    expect(dose(a, B1)).toBe(2);
  });

  it('Horrified blocks Dose', () => {
    const a = arena({ p0: [['strike.serum']], p1: three() });
    a.give(B1, 'horrified').use(A1, 'strike.serum', B1).end();
    expect(dose(a, B1)).toBe(0);
  });

  it('heals 5 per stack at the end of its applier\'s turn, without losing stacks', () => {
    const a = arena({ p0: [['strike.serum']], p1: three() });
    a.use(A1, 'strike.serum', B1).end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([90, 2]); // 100 − 20 + 10
    a.setHp(B1, 50).end();
    expect(a.hp(B1)).toBe(50); // not on the bearer's own turn
    a.end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([60, 2]);
  });

  it('Dose merges into one stack count', () => {
    const a = arena({ p0: [['strike.serum'], ['bolt.serum']], p1: three() });
    a.use(A1, 'strike.serum', B1).end().pass(1).use(A2, 'bolt.serum', B2).end();
    a.pass(1).use(A1, 'strike.serum', B2).end();
    expect(a.effects(B1).filter((e) => e.defId === 'dose')).toHaveLength(1);
  });

  it('Overdose at 4: 10 Affliction per stack and all Dose is lost', () => {
    const a = arena({ p0: [['strike.serum']], p1: three() });
    a.use(A1, 'strike.serum', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
    a.use(A1, 'strike.serum', B1).end();
    // 20 + 5×2 = 30 → 60, then 4 Dose → 40 Affliction → 20; no Dose left to heal
    expect([a.hp(B1), dose(a, B1)]).toEqual([20, 0]);
  });

  it('Overdose counts every stack: going from 3 to 5 deals 50', () => {
    const a = arena({ p0: [['strike.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 3, source: A1 }).use(A1, 'strike.serum', B1).end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([15, 0]); // 100 − 35 − 50
  });

  it('3 Dose is safe: no Overdose below 4', () => {
    const a = arena({ p0: [['companion.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 2, source: A1 }).use(A1, 'companion.serum').end().pass(1);
    const leech = minions(a, 0, 'giant_leech')[0]!;
    a.use(leech.id, 'giant_leech_latch', B1).end();
    expect([dose(a, B1), a.hp(B1)]).toEqual([3, 100]);
  });

  it('Overdose is Affliction: Shield and Armor don\'t reduce it', () => {
    const a = arena({ p0: [['companion.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 3, source: A1 }).give(B1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 50 });
    a.use(A1, 'companion.serum').end().pass(1);
    const leech = minions(a, 0, 'giant_leech')[0]!;
    a.use(leech.id, 'giant_leech_latch', B1).end();
    expect([dose(a, B1), a.hp(B1)]).toEqual([0, 60]); // Latch's 5 Piercing went into the Shield
  });

  it('Prey hooks: a unit with Dose isn\'t Prey by itself', () => {
    const a = arena({ p0: [['strike.serum'], ['bolt.poison']], p1: three() });
    a.use(A1, 'strike.serum', B1).use(A2, 'bolt.poison', B1).end();
    expect(a.has(B1, 'mark')).toBe(false);
  });
});

describe('Serum skills', () => {
  it('Hypodermic Strike: 20 +5 per Dose, then 2 Dose', () => {
    const a = arena({ p0: [['strike.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 1, source: A1 }).setHp(B1, 50).use(A1, 'strike.serum', B1).end();
    expect(dose(a, B1)).toBe(3);
    expect(a.hp(B1)).toBe(50 - 25 + 15); // the merged 3 Dose heals at the end of the user's turn
    const b = arena({ p0: [['strike.serum']], p1: three() });
    b.give(B1, 'horrified').use(A1, 'strike.serum', B1).end();
    expect(b.hp(B1)).toBe(80); // no Dose: a plain 20
  });

  it('Shattering Vial: 25 / 15; enemies hit who have Dose gain 2, the rest 1', () => {
    const a = arena({ p0: [['smash.serum']], p1: three() });
    a.give(B2, 'dose', { stacks: 1, source: A1 }).use(A1, 'smash.serum', B1).end();
    expect([dose(a, B1), dose(a, B2), dose(a, B3)]).toEqual([1, 3, 1]);
    expect([a.hp(B1), a.hp(B3)]).toEqual([80, 90]); // 75 / 85 + 5 Dose healing
  });

  it('Stim Rush: 15 and 1 Focus; the next skill\'s cooldown is cut by 1', () => {
    const a = arena({ p0: [['charge.serum', 'smash.serum']], p1: three() });
    a.use(A1, 'charge.serum', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(A1, 'smash.serum', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0); // the Focus: Sr costs S
    a.end();
    expect(a.cooldown(A1, 'smash.serum')).toBe(1);
    a.pass(3).use(A1, 'smash.serum', B1).end();
    expect(a.cooldown(A1, 'smash.serum')).toBe(2); // only the next skill
  });

  it('Reactive Serum: counters every Harmful skill used on the user; each user gains 3 Dose', () => {
    const a = arena({ p0: [['riposte.serum']], p1: three() });
    const seen = seenByB(a, A1);
    a.use(A1, 'riposte.serum').end();
    expect(seenByB(a, A1)).toBe(seen); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), dose(a, B1), dose(a, B2), dose(a, B3)]).toEqual([100, 3, 3, 0]);
  });

  it('Stimulant Binge: Immune, and 1 Might at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['rage.serum', 'shot']], p1: [['curse'], ['shot'], ['shot']] });
    a.use(A1, 'rage.serum').end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false); // Immune
    const m1 = a.stacks(A1, 'might');
    expect(m1).toBeGreaterThanOrEqual(1);
    a.use(A1, 'shot', B1).end().end();
    expect(a.stacks(A1, 'might')).toBe(m1 + 1);
  });

  it('Stimulant Binge: a turn with no damaging skill ends it, with 20 Affliction', () => {
    const a = arena({ p0: [['rage.serum', 'shot']], p1: [['curse'], ['shot'], ['shot']] });
    a.use(A1, 'rage.serum').end().pass(2);
    expect(a.hp(A1)).toBe(80);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true); // no longer Immune
  });

  it('Stimulant Binge: the turn it\'s used doesn\'t count, and damaging turns keep it going', () => {
    const a = arena({ p0: [['rage.serum', 'shot']], p1: [['curse'], ['shot'], ['shot']] });
    a.use(A1, 'rage.serum').end().end().use(A1, 'shot', B1).end();
    expect(a.hp(A1)).toBe(100);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Purging Dart: 5 Piercing +10 per Debuff on the user, and those Debuffs end', () => {
    const a = arena({ p0: [['shot.serum']], p1: three() });
    a.give(A1, 'confusion', { source: B1 }).give(A1, 'intimidated', { source: B1 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'shot.serum', B1).end();
    expect([a.hp(B1), a.has(A1, 'confusion'), a.has(A1, 'intimidated')]).toEqual([75, false, false]);
    const b = arena({ p0: [['shot.serum']], p1: three() });
    b.use(A1, 'shot.serum', B1).end();
    expect(b.hp(B1)).toBe(95);
  });

  it('Lethal Dose: on the following turn, 20 Affliction and enough Dose to reach 4 (so they Overdose)', () => {
    const a = arena({ p0: [['snipe.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 1, source: A1 }).setHp(B1, 95).use(A1, 'snipe.serum', B1).end();
    expect(a.hp(B1)).toBe(100); // 1 Dose healed 5; nothing has landed yet
    a.end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([40, 0]); // 20, then 40 Overdose
  });

  it('Lethal Dose: Uncounterable', () => {
    const a = arena({ p0: [['snipe.serum']], p1: [['riposte'], ['shot'], ['shot']] });
    a.end().use(B1, 'riposte').end().use(A1, 'snipe.serum', B1).end().end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([40, 100]);
  });

  it('Tainted Supply: each time the target is healed for 3 turns, they gain 1 Dose', () => {
    const a = arena({ p0: [['trap.serum']], p1: [['shot'], ['heal'], ['heal']] });
    const seen = seenByB(a, B1);
    a.use(A1, 'trap.serum', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.setHp(B1, 40).use(B2, 'heal', B1).use(B3, 'heal', B1).end();
    expect(dose(a, B1)).toBe(2);
    a.setHp(B2, 50).pass(1).use(B1, 'shot', A1).end();
    expect(dose(a, B2)).toBe(0); // only the target
  });

  it('Stimulant: Invulnerable for 1 turn; the user\'s Dose moves to a random enemy', () => {
    const a = arena({ p0: [['maneuver.serum']], p1: [['shot']] });
    a.give(A1, 'dose', { stacks: 2, source: B1 }).use(A1, 'maneuver.serum').end();
    expect([a.has(A1, 'invulnerable'), dose(a, A1), dose(a, B1)]).toEqual([true, 0, 2]);
  });

  it('Stimulant: with no Dose the user gains 2; Unstunnable', () => {
    const a = arena({ p0: [['maneuver.serum']], p1: three() });
    a.give(A1, 'stun', { duration: 5 }).use(A1, 'maneuver.serum').end();
    expect([a.has(A1, 'invulnerable'), dose(a, A1), dose(a, B1) + dose(a, B2) + dose(a, B3)]).toEqual([true, 2, 0]);
  });

  it('Giant Leech: permanent, 25 HP; Latch deals 5 Piercing and 1 Dose', () => {
    const a = arena({ p0: [['companion.serum']], p1: three() });
    a.use(A1, 'companion.serum').end().pass(1);
    const leech = minions(a, 0, 'giant_leech')[0]!;
    expect(leech.hp).toBe(25);
    a.give(B1, 'armor', { stacks: 3 }).setHp(B1, 50).use(leech.id, 'giant_leech_latch', B1).end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([50, 1]); // 5 Piercing, then 1 Dose heals 5
    a.pass(20);
    expect(a.unit(leech.id).alive).toBe(true);
  });

  it('Giant Leech: Bloodletting makes an ally lose 2 Dose and heal 10', () => {
    const a = arena({ p0: [['companion.serum'], ['shot']], p1: three() });
    a.use(A1, 'companion.serum').end().pass(1);
    const leech = minions(a, 0, 'giant_leech')[0]!;
    a.setHp(A2, 50).give(A2, 'dose', { stacks: 3, source: B1 }).use(leech.id, 'giant_leech_bloodletting', A2).end();
    expect([a.hp(A2), dose(a, A2)]).toEqual([60, 1]);
  });

  it('Pressurized Dose: 20 and 2 Dose; while they have Dose they count as Prey', () => {
    const a = arena({ p0: [['bolt.serum'], ['bolt.poison']], p1: three() });
    a.use(A1, 'bolt.serum', B1).use(A2, 'bolt.poison', B1).end();
    expect([dose(a, B1), a.has(B1, 'mark')]).toEqual([2, true]);
  });

  it('Pressurized Dose: the Prey ends when the Dose does', () => {
    const a = arena({ p0: [['bolt.serum', 'consume.serum'], ['bolt.poison']], p1: three() });
    a.use(A1, 'bolt.serum', B1).end().pass(1).pass(1); // B1 still has Dose
    a.pass(1).use(A1, 'consume.serum', B1).use(A2, 'bolt.poison', B1).end();
    expect([dose(a, B1), a.has(B1, 'mark')]).toEqual([0, false]);
  });

  it('Acid Rain: 20 to all, each gains 1 Dose, then all the Dose pools on one enemy', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['blast.serum']], p1: three(), seed });
      a.use(A1, 'blast.serum').end();
      const doses = [B1, B2, B3].map((b) => dose(a, b)).sort();
      expect(doses).toEqual([0, 0, 3]);
    }
  });

  it('Acid Rain: pooling to 4 or more Overdoses that enemy', () => {
    const a = arena({ p0: [['blast.serum']], p1: three() });
    a.give(B2, 'dose', { stacks: 1, source: A1 }).use(A1, 'blast.serum').end();
    expect([B1, B2, B3].map((b) => dose(a, b))).toEqual([0, 0, 0]);
    expect([a.hp(B1), a.hp(B2), a.hp(B3)].sort()).toEqual([40, 80, 80]);
  });

  it('Extraction: on an enemy, removes all Dose for 10 Affliction per stack', () => {
    const a = arena({ p0: [['consume.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 3, source: B1 }).give(B1, 'shield', { value: 50 }).use(A1, 'consume.serum', B1).end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([70, 0]);
  });

  it('Extraction: on an ally, removes all Dose and heals 10 per stack', () => {
    const a = arena({ p0: [['consume.serum'], ['shot']], p1: three() });
    a.setHp(A2, 40).give(A2, 'dose', { stacks: 3, source: B1 }).use(A1, 'consume.serum', A2).end();
    expect([a.hp(A2), dose(a, A2)]).toEqual([70, 0]);
  });

  it('Spriggan Nurse: 15 HP for 3 turns; Titrate gives an ally 1 Dose', () => {
    const a = arena({ p0: [['summon.serum'], ['shot']], p1: three() });
    a.use(A1, 'summon.serum').end().pass(1);
    const nurse = minions(a, 0, 'spriggan_nurse')[0]!;
    expect(nurse.hp).toBe(15);
    a.use(nurse.id, 'spriggan_nurse_titrate', A2).end();
    expect(dose(a, A2)).toBe(1);
    a.pass(3);
    expect(minions(a, 0, 'spriggan_nurse')).toHaveLength(0);
  });

  it('Spriggan Nurse: Titrate on an ally with 3 Dose gives a random enemy 2 instead', () => {
    const a = arena({ p0: [['summon.serum'], ['shot']], p1: three() });
    a.use(A1, 'summon.serum').end().pass(1);
    const nurse = minions(a, 0, 'spriggan_nurse')[0]!;
    a.give(A2, 'dose', { stacks: 3, source: B1 }).use(nurse.id, 'spriggan_nurse_titrate', A2).end();
    expect(dose(a, A2)).toBe(3);
    expect([B1, B2, B3].map((b) => dose(a, b)).sort()).toEqual([0, 0, 2]);
  });

  it('Drip: each of the user\'s turns, the target gains 1 Dose and takes 5 Affliction per Dose', () => {
    const a = arena({ p0: [['channel.serum']], p1: three() });
    a.setHp(B1, 50);
    let n = a.events.length;
    a.use(A1, 'channel.serum', B1).end();
    expect([dose(a, B1), afflictionTo(a, B1, n)]).toEqual([1, 5]);
    n = a.events.length;
    a.pass(2);
    expect([dose(a, B1), afflictionTo(a, B1, n)]).toEqual([2, 10]);
  });

  it('Drip: the drip that brings them to 4 makes them Overdose', () => {
    const a = arena({ p0: [['channel.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 2, source: A1 }).use(A1, 'channel.serum', B1).end().pass(2);
    expect(dose(a, B1)).toBe(0);
  });

  it('Drip: it ends when they Overdose', () => {
    const a = arena({ p0: [['channel.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 2, source: A1 }).use(A1, 'channel.serum', B1).end();
    expect(dose(a, B1)).toBe(3);
    a.pass(2);
    expect(dose(a, B1)).toBe(0); // reached 4 and Overdosed
    a.pass(2);
    expect(dose(a, B1)).toBe(0); // no more drips
  });

  it('Microdose: 5 now and at the start of each of the target\'s next 3 turns', () => {
    const a = arena({ p0: [['stab.serum']], p1: three() });
    a.use(A1, 'stab.serum', B1);
    a.end();
    expect(a.hp(B1)).toBe(90); // 5 now, 5 at the start of their turn
    a.pass(2);
    expect(a.hp(B1)).toBe(85);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
  });

  it('Microdose: each dose is 15 while the target is at or below 60 HP', () => {
    const a = arena({ p0: [['stab.serum']], p1: three() });
    a.setHp(B1, 70).use(A1, 'stab.serum', B1).end();
    expect(a.hp(B1)).toBe(65 - 5); // 70 → 65 (above 60), then 65 → 60 (still above 60 when it ticks)
    a.pass(2);
    expect(a.hp(B1)).toBe(45);
  });

  it('Toxic Injection: 25 Piercing; for 2 turns their Toxin also ticks at the start of their turns', () => {
    const a = arena({ p0: [['ravage.serum']], p1: three() });
    a.give(B1, 'toxin', { stacks: 1, source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.serum', B1).end();
    expect(a.hp(B1)).toBe(65); // 25, Toxin at the end of A's turn, Toxin again at the start of B's
    const b = arena({ p0: [['ravage']], p1: three() });
    b.give(B1, 'toxin', { stacks: 1, source: A1 }).use(A1, 'ravage', B1).end();
    expect(b.hp(B1)).toBe(70);
  });

  it('Toxic Injection: the extra ticks stop after 2 turns', () => {
    const a = arena({ p0: [['ravage.serum']], p1: three() });
    a.give(B1, 'toxin', { stacks: 1, source: A1 }).use(A1, 'ravage.serum', B1).end().pass(2);
    expect(a.hp(B1)).toBe(55); // ticks: end of turn 1, start of 2, end of 3, start of 4
    a.pass(2); // end of turn 5 (normal tick), start of turn 6: no extra tick any more
    expect(a.hp(B1)).toBe(50);
  });

  it('Placebo: Invisible; the target\'s Helpful skill is countered', () => {
    const a = arena({ p0: [['mislead.serum']], p1: [['heal'], ['shot'], ['shot']] });
    const seen = seenByB(a, B1);
    a.use(A1, 'mislead.serum', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(50);
  });

  it('Placebo: each target of the countered skill gains 2 Dose', () => {
    const a = arena({ p0: [['mislead.serum']], p1: [['heal'], ['shot'], ['shot']] });
    a.use(A1, 'mislead.serum', B1).end().setHp(B2, 50).use(B1, 'heal', B2).end();
    expect(dose(a, B2)).toBe(2);
  });

  it('Placebo: Harmful skills go through', () => {
    const a = arena({ p0: [['mislead.serum']], p1: three() });
    a.use(A1, 'mislead.serum', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), dose(a, A1)]).toEqual([85, 0]);
  });

  it('Sedative: 15 and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.serum']], p1: three() });
    a.use(A1, 'stun.serum', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([85, true]);
    a.end();
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Sedative: +1 turn per 2 Dose', () => {
    const a = arena({ p0: [['stun.serum']], p1: three() });
    a.give(B1, 'dose', { stacks: 2, source: B1 }).use(A1, 'stun.serum', B1).end().pass(2);
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Sedative: at most 3 turns (Mutagen lets them hold 6 Dose)', () => {
    const a = arena({ p0: [['stun.serum']], p1: [['titan.serum'], ['shot'], ['shot']] });
    a.end().use(B1, 'titan.serum').end();
    a.give(B1, 'dose', { stacks: 5, source: B1 });
    a.use(A1, 'stun.serum', B1).end().pass(4);
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Rebalance: Toxin on allies becomes Renew; Renew on enemies becomes Toxin', () => {
    const a = arena({ p0: three(['dance.serum']), p1: three() });
    a.give(A2, 'toxin', { stacks: 2, source: B1 }).give(B1, 'renew', { stacks: 3, source: B1 });
    a.give(B2, 'toxin', { stacks: 1, source: A1 }).give(A3, 'renew', { stacks: 1, source: A3 });
    a.use(A1, 'dance.serum').end();
    expect([a.stacks(A2, 'toxin'), a.has(A2, 'renew')]).toEqual([0, true]);
    expect([a.stacks(B1, 'renew'), a.stacks(B1, 'toxin')]).toEqual([0, 3]);
    expect([a.stacks(B2, 'toxin'), a.stacks(A3, 'toxin')]).toEqual([1, 0]); // the other way round is untouched
  });

  it('Remedy: heals 25; an ally also gains 1 Dose', () => {
    const a = arena({ p0: [['heal.serum'], ['shot']], p1: three() });
    a.setHp(A2, 50).use(A1, 'heal.serum', A2).end();
    expect([a.hp(A2), dose(a, A2)]).toEqual([80, 1]); // 25, then 1 Dose heals 5
  });

  it('Remedy: can target an enemy, who heals 25 and gains 3 Dose', () => {
    const a = arena({ p0: [['heal.serum']], p1: three() });
    a.setHp(B1, 50).use(A1, 'heal.serum', B1).end();
    expect([a.hp(B1), dose(a, B1)]).toEqual([90, 3]);
  });

  it('Flushing Drip: 1 Might and 1 Renew; each time the ally is healed meanwhile, they lose 1 Debuff', () => {
    const a = arena({ p0: [['bless.serum'], ['shot'], ['heal']], p1: three() });
    a.setHp(A2, 50).give(A2, 'weakness', { source: B1 }).give(A2, 'confusion', { source: B1 }).give(A2, 'intimidated', { source: B1 });
    a.use(A1, 'bless.serum', A2).use(A3, 'heal', A2).end();
    expect(a.stacks(A2, 'might')).toBe(1);
    expect(debuffs(a, A2)).toBe(1); // the heal and the Renew tick each flushed one
  });

  it('Flushing Drip: healing other allies flushes nothing', () => {
    const a = arena({ p0: [['bless.serum'], ['shot'], ['heal']], p1: three() });
    a.setHp(A3, 50).give(A3, 'weakness', { source: B1 }).give(A3, 'confusion', { source: B1 });
    a.use(A1, 'bless.serum', A2).use(A3, 'heal', A3).end();
    expect([a.hp(A3), debuffs(a, A3)]).toEqual([75, 2]);
  });

  it('Weak Constitution: Confused for 2 turns, and any Weakness makes them Prey', () => {
    const a = arena({ p0: [['curse.serum'], ['bolt.poison']], p1: three() });
    a.give(B1, 'weakness', { source: A1 }).use(A1, 'curse.serum', B1).use(A2, 'bolt.poison', B1).end();
    expect([a.stacks(B1, 'confusion'), a.has(B1, 'mark')]).toEqual([1, true]);
  });

  it('Weak Constitution: without Weakness they aren\'t Prey; without the curse, 1 Weakness isn\'t enough', () => {
    const a = arena({ p0: [['curse.serum'], ['bolt.poison']], p1: three() });
    a.use(A1, 'curse.serum', B1).use(A2, 'bolt.poison', B1).end();
    expect(a.has(B1, 'mark')).toBe(false);
    const b = arena({ p0: [['curse.serum'], ['bolt.poison']], p1: three() });
    b.give(B1, 'weakness', { source: A1 }).give(B1, 'confusion', { source: A1 }).use(A2, 'bolt.poison', B1).end();
    expect(b.has(B1, 'mark')).toBe(false);
  });

  it('Mercy Dose: 15 and Sanctified; an ally whose damage leaves them below 15 executes them', () => {
    const a = arena({ p0: [['smite.serum'], ['shot']], p1: three() });
    a.setHp(B1, 40).setHp(A2, 50).use(A1, 'smite.serum', B1).use(A2, 'shot', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    expect(a.hp(A2)).toBe(65); // Sanctify's 15
  });

  it('Mercy Dose: no execution at 15 or more', () => {
    const a = arena({ p0: [['smite.serum'], ['shot']], p1: three() });
    a.setHp(B1, 45).use(A1, 'smite.serum', B1).use(A2, 'shot', B1).end();
    expect([a.unit(B1).alive, a.hp(B1)]).toEqual([true, 15]);
  });

  it('Tonic Round: allies heal 10 per Dose (at least 10) and lose 1 Dose; all enemies gain 1', () => {
    const a = arena({ p0: [['prayer.serum'], ['shot']], p1: three() });
    a.setHp(A1, 50).setHp(A2, 50).give(A1, 'dose', { stacks: 3, source: B1 });
    a.use(A1, 'prayer.serum').end();
    expect([a.hp(A1), dose(a, A1), a.hp(A2), dose(a, A2)]).toEqual([80, 2, 60, 0]);
    expect([B1, B2, B3].map((b) => dose(a, b))).toEqual([1, 1, 1]);
  });

  it('Lashing Spray: 25 / 15 to a random other enemy, who gains as many Dose as the target has', () => {
    const a = arena({ p0: [['cleave.serum']], p1: [['shot'], ['shot']] });
    a.give(B1, 'dose', { stacks: 2, source: B1 }).use(A1, 'cleave.serum', B1).end();
    expect([dose(a, B1), dose(a, B2)]).toEqual([2, 2]);
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 95]); // B2's new Dose heals 10 at the end of A's turn
  });

  it('Bad Batch: every unit with Dose gains 1 more, allies included', () => {
    const a = arena({ p0: [['shout.serum'], ['shot']], p1: three() });
    a.give(A2, 'dose', { stacks: 1, source: B1 }).give(B1, 'dose', { stacks: 2, source: B1 });
    a.use(A1, 'shout.serum').end();
    expect([dose(a, A1), dose(a, A2), dose(a, B1), dose(a, B2), dose(a, B3)]).toEqual([0, 2, 3, 0, 0]);
  });

  it('Bad Batch: if no enemy has Dose, every enemy gains 1 instead', () => {
    const a = arena({ p0: [['shout.serum'], ['shot']], p1: three() });
    a.use(A1, 'shout.serum').end();
    expect([B1, B2, B3].map((b) => dose(a, b))).toEqual([1, 1, 1]);
  });

  it('Clotting Agent: 30 Shield for 2 turns', () => {
    const a = arena({ p0: [['withstand.serum']], p1: three() });
    a.use(A1, 'withstand.serum').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // 30 used up
  });

  it('Clotting Agent: meanwhile, 10 less Affliction from each hit', () => {
    const a = arena({ p0: [['withstand.serum']], p1: three() });
    a.give(A1, 'toxin', { stacks: 3, source: B1 }).use(A1, 'withstand.serum').end().end();
    expect(a.hp(A1)).toBe(95);
    const b = arena({ p0: [['withstand']], p1: three() });
    b.give(A1, 'toxin', { stacks: 3, source: B1 }).use(A1, 'withstand').end().end();
    expect(b.hp(A1)).toBe(85);
  });

  it('Bitter Tonic: Taunts for 2 turns; each time an ally of the user is healed, the Taunted enemy gains 1 Toxin', () => {
    const a = arena({ p0: [['taunt.serum'], ['heal'], ['shot']], p1: three() });
    a.setHp(A3, 50).use(A1, 'taunt.serum', B1).use(A2, 'heal', A3).end();
    expect([a.has(B1, 'taunt'), a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([true, 1, 0]);
  });

  it('Mutagen: 3 Dose, 2 Might and 2 Armor; no Overdose at 4 while it lasts', () => {
    const a = arena({ p0: [['titan.serum'], ['heal.serum']], p1: three() });
    a.use(A1, 'titan.serum').use(A2, 'heal.serum', A1).end();
    expect([dose(a, A1), a.stacks(A1, 'might'), a.stacks(A1, 'armor'), a.hp(A1)]).toEqual([4, 2, 2, 100]);
  });

  it('Mutagen: when it ends, the user Overdoses if they have 4 or more', () => {
    const a = arena({ p0: [['titan.serum'], ['heal.serum']], p1: three() });
    a.use(A1, 'titan.serum').use(A2, 'heal.serum', A1).end().pass(4);
    expect([dose(a, A1), a.hp(A1)]).toEqual([4, 100]);
    a.pass(1);
    expect([dose(a, A1), a.hp(A1), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([0, 60, 0, 0]);
  });

  it('Mutagen: with 3 Dose at the end, nothing happens', () => {
    const a = arena({ p0: [['titan.serum']], p1: three() });
    a.use(A1, 'titan.serum').end().pass(5);
    expect([dose(a, A1), a.hp(A1)]).toEqual([3, 100]);
  });
});

describe('Serum cost and cooldown (kit table)', () => {
  const table: Record<string, [string, number]> = {
    strike: ['W', 0], smash: ['Sr', 2], charge: ['S', 1], riposte: ['I', 2], rage: ['S', 4],
    shot: ['r', 1], snipe: ['Ar', 1], trap: ['W', 2], maneuver: ['I', 2], companion: ['I', 1],
    bolt: ['I', 1], blast: ['Wr', 2], consume: ['r', 2], summon: ['I', 2], channel: ['rr', 3],
    stab: ['r', 1], ravage: ['Ar', 1], mislead: ['W', 2], stun: ['I', 3], dance: ['A', 2],
    heal: ['W', 1], bless: ['r', 2], curse: ['r', 2], smite: ['Wr', 1], prayer: ['Ir', 2],
    cleave: ['S', 2], shout: ['r', 1], withstand: ['W', 2], taunt: ['r', 3], titan: ['I', 3],
  };
  const parse = (s: string): Cost => {
    const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof Cost] += 1;
    return c;
  };
  for (const [arch, [cost, cd]] of Object.entries(table)) {
    it(`${arch}.serum costs ${cost}, cooldown ${cd}`, () => {
      const s = content.skills[`${arch}.serum`]!;
      expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
    });
  }
  it('minion skills: Latch r, Bloodletting rr, Titrate W', () => {
    expect(content.skills.giant_leech_latch!.cost).toEqual(parse('r'));
    expect(content.skills.giant_leech_bloodletting!.cost).toEqual(parse('rr'));
    expect(content.skills.spriggan_nurse_titrate!.cost).toEqual(parse('W'));
  });
  it('Extraction and Remedy are Radiant (any unit)', () => {
    expect(content.skills['consume.serum']!.tags).toContain('Radiant');
    expect(content.skills['heal.serum']!.tags).toContain('Radiant');
  });
});
