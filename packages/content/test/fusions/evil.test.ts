// Spec-driven scenarios for Evil (Unholy + Unholy): Unhallowed, Tithe, Soul Fragment drains, all 30 skills
// and both minions. Expected values come from the in-game descriptions and docs/rules.md §21.9.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2 (even turns).

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

/** Total energy player 0 holds (all colors). */
const energy0 = (a: Arena) => {
  const e = a.state.players[0].energy;
  return e.S + e.A + e.I + e.W;
};

/** Whether the opponent (player 1) can see any effect on `id`. */
const p1Sees = (a: Arena, id: string) => viewFor(content, a.state, 1).effects.some((e) => e.bearer === id);

const minion = (a: Arena, defId: string) => a.state.units.find((u) => u.defId === defId);

const shieldOf = (a: Arena, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);

describe('Evil: Unhallowed', () => {
  it('a heal on an Unhallowed character deals that much Affliction instead (ignores Shield and Armor)', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['heal']] });
    a.give(B1, 'unhallowed', { source: A1 }).give(B1, 'shield', { value: 50 }).give(B1, 'armor', { stacks: 3 });
    a.setHp(B1, 50).pass(1).use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(25);
  });

  it('a character without Unhallowed is healed normally', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['heal']] });
    a.give(B2, 'unhallowed', { source: A1 }).setHp(B1, 50).pass(1).use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Renew on an Unhallowed character hurts instead of healing', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'unhallowed', { source: A1 }).give(B1, 'renew', { stacks: 2, source: B2 }).setHp(B1, 50);
    a.pass(2); // Renew ticks at the end of B2's turn: 10
    expect(a.hp(B1)).toBe(40);
  });

  it('Lifesteal on an Unhallowed attacker hurts them instead of healing', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'unhallowed', { source: A1 }).give(B1, 'lifesteal').setHp(B1, 50).pass(1);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 35]);
  });

  it('Unhallowed is a Debuff: Immune stops it', () => {
    const a = arena({ p0: [['tormentor_false_mercy', 'summon.evil']], p1: [['shot']] });
    expect(content.statuses.unhallowed?.kind).toBe('Debuff');
    a.give(B1, 'immune').use(A1, 'tormentor_false_mercy', B1).end();
    expect(a.has(B1, 'unhallowed')).toBe(false);
  });
});

describe('Evil: Soul Fragment drains and Tithe', () => {
  it('a drain takes a Fragment from the target and gives it to the user', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot']] });
    a.give(B1, 'soul_fragment', { stacks: 2 }).use(A1, 'stab.evil', B1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([1, 1]);
  });

  it('a drain on a target with no Fragments still gives the user one', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot']] });
    a.use(A1, 'stab.evil', B1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([0, 1]);
  });

  it('Tithe spends at most N Fragments and the skill still works with none', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'bless.evil', A2).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'might')]).toEqual([1, 2]);
    const b = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    b.use(A1, 'bless.evil', A2).end();
    expect([b.has(A2, 'lifesteal'), b.stacks(A2, 'might')]).toEqual([true, 0]);
  });
});

describe('Evil skills', () => {
  // Strike
  it('Cruel Blade: 25 damage against a target not healed recently, no Unhallowed', () => {
    const a = arena({ p0: [['strike.evil']], p1: [['shot']] });
    a.use(A1, 'strike.evil', B1).end();
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([75, false]);
  });

  it('Cruel Blade: healed since the user\'s last turn, the target takes 35 and is Unhallowed for 2 turns', () => {
    const a = arena({ p0: [['strike.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 60).pass(1).use(B2, 'heal', B1).end(); // turn 2: B1 → 85
    a.use(A1, 'strike.evil', B1).end(); // turn 3
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([50, true]);
    a.pass(2); // turns 4, 5
    expect(a.has(B1, 'unhallowed')).toBe(true);
    a.pass(1); // turn 6 ends
    expect(a.has(B1, 'unhallowed')).toBe(false);
  });

  it('Cruel Blade: a heal from before the user\'s last turn doesn\'t count', () => {
    const a = arena({ p0: [['strike.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 60).pass(1).use(B2, 'heal', B1).end(); // turn 2
    a.pass(2); // turns 3, 4
    a.use(A1, 'strike.evil', B1).end(); // turn 5
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([60, false]);
  });

  // Smash
  it('Soulgrinder: 40 to the target, Horrifies only their allies for 2 turns; no Fragments, no extra hits', () => {
    const a = arena({ p0: [['smash.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.evil', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([60, 100, 100]);
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified'), a.has(B3, 'horrified')]).toEqual([false, true, true]);
    a.pass(2); // turns 2–3
    expect(a.has(B2, 'horrified')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'horrified')).toBe(false);
  });

  it('Soulgrinder: Tithe 2, each Fragment spent is 15 Affliction to a random ally of the target', () => {
    const a = arena({ p0: [['smash.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).give(B2, 'armor', { stacks: 4 }).give(B3, 'armor', { stacks: 4 });
    a.give(B2, 'shield', { value: 50 }).give(B3, 'shield', { value: 50 });
    a.use(A1, 'smash.evil', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
    expect(200 - a.hp(B2) - a.hp(B3)).toBe(30);
    expect([a.hp(B2), a.hp(B3)].every((h) => (100 - h) % 15 === 0)).toBe(true);
  });

  it('Soulgrinder: Tithe 2 spends no more than 2 Fragments', () => {
    const a = arena({ p0: [['smash.evil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'smash.evil', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Soulgrinder: the Tithe hits never land on the primary target', () => {
    const a = arena({ p0: [['smash.evil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'smash.evil', B1).end();
    expect(a.hp(B2)).toBe(70);
    expect(a.hp(B1)).toBe(50); // 40 + 2 Fragments' Might, nothing more
  });

  // Charge
  it('Soul Hunt: 15 damage; the next Harmful skill (not Soul Hunt itself) drains a Fragment from its target', () => {
    const a = arena({ p0: [['charge.evil', 'shot']], p1: [['shot']] });
    a.give(B1, 'soul_fragment').use(A1, 'charge.evil', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([85, 0, 1]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([1, 0]);
    a.pass(1).use(A1, 'shot', B1).end(); // only the one skill drains
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Soul Hunt: a Helpful skill doesn\'t use up the drain', () => {
    const a = arena({ p0: [['charge.evil', 'heal', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.evil', B1).end().pass(1).use(A1, 'heal', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Soul Hunt: Tithe 1 spends a Fragment and the next skill costs 1 less', () => {
    const a = arena({ p0: [['charge.evil', 'shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'charge.evil', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
    a.pass(1);
    const before = energy0(a);
    a.use(A1, 'shot', B1).end();
    expect(before - energy0(a)).toBe(0);
  });

  it('Soul Hunt: without a Fragment the next skill costs full price', () => {
    const a = arena({ p0: [['charge.evil', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.evil', B1).end().pass(1);
    const before = energy0(a);
    a.use(A1, 'shot', B1).end();
    expect(before - energy0(a)).toBe(1);
  });

  // Riposte
  it('Take You With Me: invisible; counters every Harmful skill used on the user for 1 turn', () => {
    const a = arena({ p0: [['riposte.evil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.evil').end();
    expect(p1Sees(a, A1)).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 4: over
    expect(a.hp(A1)).toBe(85);
  });

  // BUG: Take You With Me says the last enemy countered dies with the user; the user dies to a tick on turn 2 and B2 (carrying doomed_together) survives
  it.fails('Take You With Me: if the user dies before the end of their next turn, the last enemy countered dies too', () => {
    const a = arena({ p0: [['riposte.evil'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'riposte.evil').end();
    a.setHp(A1, 5).give(A1, 'ignite', { source: B3 }); // 5 Affliction at the end of player 2's turn
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
    expect([a.unit(B1).alive, a.unit(B2).alive, a.unit(B3).alive]).toEqual([true, false, true]);
  });

  it('Take You With Me: dying later than the user\'s next turn takes no one along', () => {
    const a = arena({ p0: [['riposte.evil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.evil').end();
    a.use(B1, 'shot', A1).end(); // countered on turn 2
    a.pass(1); // turn 3: the user's next turn ends
    a.setHp(A1, 5).give(A1, 'ignite', { source: B2 });
    a.end(); // turn 4: A1 burns to death
    expect([a.unit(A1).alive, a.unit(B1).alive]).toEqual([false, true]);
  });

  it('Take You With Me: with nothing countered, the user\'s death takes no one', () => {
    const a = arena({ p0: [['riposte.evil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.evil').end();
    a.setHp(A1, 5).give(A1, 'ignite', { source: B2 }).end();
    expect([a.unit(A1).alive, a.unit(B1).alive, a.unit(B2).alive]).toEqual([false, true, true]);
  });

  // Rage
  it('Atrocity: with no Fragments, nothing happens', () => {
    const a = arena({ p0: [['rage.evil']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'rage.evil').end();
    expect(a.has(A1, 'immortal')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  it('Atrocity: Tithe all, max 3; Immortal for 1 turn per Fragment spent', () => {
    const a = arena({ p0: [['rage.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 5 }).use(A1, 'rage.evil').end();
    expect([a.stacks(A1, 'soul_fragment'), a.has(A1, 'immortal')]).toEqual([2, true]);
    a.pass(5); // through turn 6: 3 turns
    expect(a.has(A1, 'immortal')).toBe(false);
    const b = arena({ p0: [['rage.evil']], p1: [['shot']] });
    b.give(A1, 'soul_fragment').use(A1, 'rage.evil').end();
    expect(b.stacks(A1, 'soul_fragment')).toBe(0);
    b.setHp(A1, 10).use(B1, 'shot', A1).end(); // turn 2: still Immortal
    expect([b.hp(A1), b.unit(A1).alive]).toEqual([5, true]);
    expect(b.has(A1, 'immortal')).toBe(false); // 1 turn only
  });

  it('Atrocity: while Immortal, an enemy who damages the user loses a Fragment to them', () => {
    const a = arena({ p0: [['rage.evil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment').give(B1, 'soul_fragment').give(B2, 'soul_fragment');
    a.use(A1, 'rage.evil').end();
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(B2, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([
      0, 1, 1,
    ]);
  });

  // Shot
  it('Bone Needle: 10 plus 5 per Fragment (on top of the Fragments\' own Might)', () => {
    const a = arena({ p0: [['shot.evil']], p1: [['shot']] });
    a.use(A1, 'shot.evil', B1).end();
    expect(a.hp(B1)).toBe(90);
    const b = arena({ p0: [['shot.evil']], p1: [['shot']] });
    b.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'shot.evil', B1).end();
    expect(b.hp(B1)).toBe(70);
  });

  it('Bone Needle: drains a Fragment only from an Unhallowed target', () => {
    const a = arena({ p0: [['shot.evil']], p1: [['shot'], ['shot']] });
    a.give(B1, 'soul_fragment').give(B2, 'soul_fragment').give(B2, 'unhallowed', { source: A1 });
    a.use(A1, 'shot.evil', B1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([1, 0]);
    a.pass(3).use(A1, 'shot.evil', B2).end(); // cooldown 1
    expect([a.stacks(B2, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([0, 1]);
  });

  // Snipe
  const knellLanding = (heals: number[]) => {
    const a = arena({ p0: [['snipe.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 90).give(B1, 'shield', { value: 50 }).give(B1, 'armor', { stacks: 4 });
    a.use(A1, 'snipe.evil', B1).end(); // turn 1
    for (let turn = 2; turn <= 12; turn++) {
      const hpBefore = a.hp(B1);
      if (heals.includes(turn)) a.use(B2, 'heal', B1);
      a.end();
      const healed = heals.includes(turn) ? Math.min(25, 100 - hpBefore) : 0;
      if (a.hp(B1) < hpBefore + healed) return { turn, dealt: hpBefore + healed - a.hp(B1), a };
    }
    return { turn: 0, dealt: 0, a };
  };

  it('Doom Knell: 70 Affliction later (ignores Shield and Armor); not on the next turn', () => {
    const r = knellLanding([]);
    expect(r.dealt).toBe(70);
    expect(r.turn).toBeGreaterThan(2);
  });

  // "Turn" in skill text is a round (one turn of each side, rules §8 "for N turns"): a turn sooner = 2 engine turns.
  it('Doom Knell: a heal on the target makes it land a turn sooner', () => {
    const base = knellLanding([]);
    const once = knellLanding([2]);
    expect(once.dealt).toBe(70);
    expect(once.turn).toBe(base.turn - 2);
  });

  it('Doom Knell: healing someone else doesn\'t speed it up', () => {
    const a = arena({ p0: [['snipe.evil']], p1: [['shot'], ['heal']] });
    const b = arena({ p0: [['snipe.evil']], p1: [['shot'], ['heal']] });
    for (const x of [a, b]) x.setHp(B1, 90).setHp(B2, 50).use(A1, 'snipe.evil', B1).end();
    a.use(B2, 'heal', B2).end();
    b.end();
    for (let i = 0; i < 6; i++) {
      a.end();
      b.end();
      expect(a.hp(B1)).toBe(b.hp(B1));
    }
  });

  it('Doom Knell: the target is hidden from the enemy, and a Stun on the user stops it', () => {
    const a = arena({ p0: [['snipe.evil']], p1: [['stun']] });
    a.use(A1, 'snipe.evil', B1).end();
    const used = a.events.find((e) => e.t === 'skillUsed');
    expect(used).toBeDefined();
    expect(p1Sees(a, B1)).toBe(false);
    a.use(B1, 'stun', A1).end().pass(8);
    expect(a.hp(B1)).toBe(100);
  });

  // Trap
  it('Damning Shackle: invisible; the first heal on the target hurts instead and Stuns them; the second heals', () => {
    const a = arena({ p0: [['trap.evil']], p1: [['shot'], ['heal'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.evil', B1).end();
    expect(p1Sees(a, B1)).toBe(false);
    a.use(B2, 'heal', B1).end(); // turn 2
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([25, true]);
    a.pass(1).use(B3, 'heal', B1).end(); // turn 4, still within 2 turns: already spent
    expect(a.hp(B1)).toBe(50);
  });

  it('Damning Shackle: other enemies are healed normally', () => {
    const a = arena({ p0: [['trap.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B2, 50).use(A1, 'trap.evil', B1).end().use(B2, 'heal', B2).end();
    expect([a.hp(B2), a.has(B2, 'stun')]).toEqual([75, false]);
  });

  it('Damning Shackle: lasts 2 turns', () => {
    const a = arena({ p0: [['trap.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.evil', B1).end().pass(4); // turns 2–5
    a.use(B2, 'heal', B1).end(); // turn 6
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([75, false]);
  });

  // Maneuver
  it('Deathless Step: the effect is invisible to the opponent', () => {
    const a = arena({ p0: [['maneuver.evil']], p1: [['shot']] });
    a.use(A1, 'maneuver.evil').end();
    expect(p1Sees(a, A1)).toBe(false);
  });

  it('Deathless Step: with no Fragment, Immortal for 1 turn', () => {
    const a = arena({ p0: [['maneuver.evil']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'maneuver.evil').end();
    expect([a.has(A1, 'immortal'), a.has(A1, 'invulnerable')]).toEqual([true, false]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(5);
    expect(a.has(A1, 'immortal')).toBe(false);
  });

  it('Deathless Step: Tithe 1 spends one Fragment for Invulnerable instead', () => {
    const a = arena({ p0: [['maneuver.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'maneuver.evil').end();
    expect([a.stacks(A1, 'soul_fragment'), a.has(A1, 'invulnerable'), a.has(A1, 'immortal')]).toEqual([1, true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  // Companion
  it('Fiend: a permanent 35 HP minion', () => {
    const a = arena({ p0: [['companion.evil']], p1: [['shot']] });
    a.use(A1, 'companion.evil').end().pass(12);
    const f = minion(a, 'fiend')!;
    expect([f.hp, f.alive, f.owner]).toEqual([35, true, 0]);
  });

  it('Fiend / Rend Soul: 15 Affliction and Unhallowed for 1 turn', () => {
    const a = arena({ p0: [['companion.evil']], p1: [['shot']] });
    a.use(A1, 'companion.evil').end().pass(1);
    const f = minion(a, 'fiend')!;
    a.give(B1, 'armor', { stacks: 3 }).use(f.id, 'fiend_rend_soul', B1).end(); // turn 3
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([85, true]);
    a.pass(1);
    expect(a.has(B1, 'unhallowed')).toBe(false);
  });

  it('Fiend / Feast: drains a Fragment from a Horrified enemy for the summoner; can\'t target others', () => {
    const a = arena({ p0: [['companion.evil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.evil').end().pass(1);
    const f = minion(a, 'fiend')!;
    a.give(B1, 'horrified', { source: A1 }).give(B1, 'soul_fragment');
    expect(a.reject(() => a.use(f.id, 'fiend_feast', B2))).toBe('bad_target');
    a.use(f.id, 'fiend_feast', B1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment'), a.stacks(f.id, 'soul_fragment')]).toEqual([
      0, 1, 0,
    ]);
  });

  // Bolt
  it('Profane Bolt: 25 and Horrified for 2 turns against a target that isn\'t Unhallowed', () => {
    const a = arena({ p0: [['bolt.evil']], p1: [['shot']] });
    a.use(A1, 'bolt.evil', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([75, true]);
    a.pass(2);
    expect(a.has(B1, 'horrified')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Profane Bolt: against an Unhallowed target, a 15 heal that hurts instead, and no Horrify', () => {
    const a = arena({ p0: [['bolt.evil']], p1: [['shot']] });
    a.give(B1, 'unhallowed', { source: A1 }).use(A1, 'bolt.evil', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([60, false]);
  });

  // Blast
  it('Soulfire Nova: 25 to all enemies, plus 10 per Fragment (and their Might)', () => {
    const a = arena({ p0: [['blast.evil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.evil').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
    const b = arena({ p0: [['blast.evil']], p1: [['shot'], ['shot']] });
    b.give(A1, 'soul_fragment').use(A1, 'blast.evil').end();
    expect([b.hp(B1), b.hp(B2)]).toEqual([60, 60]);
  });

  it('Soulfire Nova: for 1 turn, healing the enemies receive also heals the user', () => {
    const a = arena({ p0: [['blast.evil']], p1: [['shot'], ['heal']] });
    a.setHp(A1, 50).use(A1, 'blast.evil').end();
    a.use(B2, 'heal', B1).end(); // turn 2
    expect([a.hp(B1), a.hp(A1)]).toEqual([100, 75]);
    a.setHp(B1, 50).pass(3).use(B2, 'heal', B1).end(); // turn 6: over
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 75]);
  });

  // Consume
  it('Reap: a Horrified enemy takes 5 and loses a Fragment to the user, who heals 10; others are untouched', () => {
    const a = arena({ p0: [['consume.evil']], p1: [['shot'], ['shot']] });
    a.give(B1, 'horrified', { source: A1 }).give(B1, 'soul_fragment').give(B2, 'soul_fragment');
    a.setHp(A1, 50).use(A1, 'consume.evil').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B1, 'soul_fragment'), a.stacks(B2, 'soul_fragment')]).toEqual([95, 100, 0, 1]);
    expect([a.stacks(A1, 'soul_fragment'), a.hp(A1)]).toEqual([1, 60]);
  });

  it('Reap: heals 10 per enemy reaped', () => {
    const a = arena({ p0: [['consume.evil']], p1: [['shot'], ['shot'], ['shot']] });
    for (const b of [B1, B2]) a.give(b, 'horrified', { source: A1 }).give(b, 'soul_fragment');
    a.setHp(A1, 50).use(A1, 'consume.evil').end();
    expect([a.stacks(A1, 'soul_fragment'), a.hp(A1), a.hp(B3)]).toEqual([2, 70, 100]);
  });

  it('Reap: with no Horrified enemy, nothing happens', () => {
    const a = arena({ p0: [['consume.evil']], p1: [['shot']] });
    a.give(B1, 'soul_fragment').setHp(A1, 50).use(A1, 'consume.evil').end();
    expect([a.hp(B1), a.hp(A1), a.stacks(A1, 'soul_fragment')]).toEqual([100, 50, 0]);
  });

  // Summon
  it('Tormentor: a 25 HP minion that lasts 3 turns', () => {
    const a = arena({ p0: [['summon.evil']], p1: [['shot']] });
    a.use(A1, 'summon.evil').end();
    expect(minion(a, 'tormentor')?.hp).toBe(25);
    a.pass(4);
    expect(minion(a, 'tormentor')?.alive).toBe(true);
    a.pass(4);
    expect(minion(a, 'tormentor')?.alive ?? false).toBe(false);
  });

  it('Tormentor / Barbed Whip: 10 Affliction damage', () => {
    const a = arena({ p0: [['summon.evil']], p1: [['shot']] });
    a.use(A1, 'summon.evil').end().pass(1);
    const t = minion(a, 'tormentor')!;
    a.give(B1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 20 }).use(t.id, 'tormentor_barbed_whip', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Tormentor / False Mercy: Unhallowed for 1 turn, then a 15 heal that hurts', () => {
    const a = arena({ p0: [['summon.evil']], p1: [['shot']] });
    a.use(A1, 'summon.evil').end().pass(1);
    const t = minion(a, 'tormentor')!;
    a.setHp(B1, 50).use(t.id, 'tormentor_false_mercy', B1).end(); // turn 3
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([35, true]);
    a.pass(1);
    expect(a.has(B1, 'unhallowed')).toBe(false);
  });

  it('Tormentor / False Mercy: if Unhallowed doesn\'t take hold, there\'s no heal', () => {
    const a = arena({ p0: [['summon.evil']], p1: [['shot']] });
    a.use(A1, 'summon.evil').end().pass(1);
    const t = minion(a, 'tormentor')!;
    a.setHp(B1, 50).give(B1, 'immune').use(t.id, 'tormentor_false_mercy', B1).end();
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([50, false]);
  });

  // Channel
  it('Undying Thirst: 10 a turn with Lifesteal, for 3 turns', () => {
    const a = arena({ p0: [['channel.evil']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'channel.evil', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 60]);
    a.pass(10);
    expect([a.hp(B1), a.hp(A1)]).toEqual([70, 80]);
  });

  it('Undying Thirst: the user is Immortal while channeling, and other healing can\'t reach them', () => {
    const a = arena({ p0: [['channel.evil'], ['heal']], p1: [['shot']] });
    a.use(A1, 'channel.evil', B1).end(); // A1 100 (full), B1 90
    a.setHp(A1, 10).use(B1, 'shot', A1).end(); // turn 2
    expect([a.hp(A1), a.unit(A1).alive]).toEqual([5, true]);
    a.use(A2, 'heal', A1).end(); // turn 3: heal blocked, then the Thirst's 10
    expect(a.hp(A1)).toBe(15);
  });

  it('Undying Thirst: Immortality ends with the channel (using another skill ends it)', () => {
    const a = arena({ p0: [['channel.evil', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.evil', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect(a.has(A1, 'immortal')).toBe(false);
    a.setHp(A1, 10).use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  // Stab
  it('Heartpiercer: 15; drains a Fragment at 70+ HP, not below', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 69).use(A1, 'stab.evil', B2).end();
    expect([a.hp(B2), a.stacks(A1, 'soul_fragment')]).toEqual([54, 0]);
    a.pass(1).use(A1, 'stab.evil', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([85, 1]);
  });

  it('Heartpiercer: Tithe 1 executes a target left below 20, spending the Fragment', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment').setHp(B1, 35).use(A1, 'stab.evil', B1).end(); // 20 → 15 left
    expect([a.unit(B1).alive, a.stacks(A1, 'soul_fragment')]).toEqual([false, 0]);
  });

  it('Heartpiercer: no execute (and no Fragment spent) if the target stays at 20+', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment').setHp(B1, 40).use(A1, 'stab.evil', B1).end(); // 20 → 20 left
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([20, 1]);
  });

  it('Heartpiercer: without a Fragment, no execute', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 30).use(A1, 'stab.evil', B1).end();
    expect([a.hp(B1), a.unit(B1).alive]).toEqual([15, true]);
  });

  // Ravage
  it('Mutual Ruin: 35 Piercing; the user loses 25 HP through Shield, and spends no energy', () => {
    const a = arena({ p0: [['ravage.evil']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).give(A1, 'shield', { value: 50 });
    const before = energy0(a);
    a.use(A1, 'ravage.evil', B1).end();
    expect([a.hp(B1), a.hp(A1), energy0(a)]).toEqual([65, 75, before]);
  });

  it('Mutual Ruin: the HP cost can\'t kill the user', () => {
    const a = arena({ p0: [['ravage.evil']], p1: [['shot']] });
    a.setHp(A1, 20).use(A1, 'ravage.evil', B1).end();
    expect([a.hp(A1), a.unit(A1).alive, a.hp(B1)]).toEqual([1, true, 65]);
  });

  // Mislead
  it('Waking Nightmare: invisible; the target\'s Helpful skill is countered', () => {
    const a = arena({ p0: [['mislead.evil']], p1: [['heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.evil', B1).end();
    expect(p1Sees(a, B1)).toBe(false);
    a.use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBeLessThanOrEqual(50);
  });

  it('Waking Nightmare: the countered skill\'s targets take 20 Affliction instead', () => {
    const a = arena({ p0: [['mislead.evil']], p1: [['heal'], ['shot']] });
    a.setHp(B2, 50).give(B2, 'shield', { value: 30 }).use(A1, 'mislead.evil', B1).end();
    a.use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(30);
  });

  it('Waking Nightmare: Harmful skills aren\'t countered', () => {
    const a = arena({ p0: [['mislead.evil']], p1: [['shot']] });
    a.use(A1, 'mislead.evil', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 100]);
  });

  it('Waking Nightmare: lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.evil']], p1: [['heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.evil', B1).end().pass(2).use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(75);
  });

  // Stun
  it('Mutilate: permanent Vulnerable; Weakness too only if Horrified; no Stun without a Fragment', () => {
    const a = arena({ p0: [['stun.evil']], p1: [['shot'], ['shot']] });
    a.give(B2, 'horrified', { source: A1 }).use(A1, 'stun.evil', B1).end().pass(7);
    a.use(A1, 'stun.evil', B2).end().pass(10);
    expect([a.stacks(B1, 'vulnerable'), a.has(B1, 'weakness'), a.has(B1, 'stun')]).toEqual([1, false, false]);
    expect([a.stacks(B2, 'vulnerable'), a.stacks(B2, 'weakness')]).toEqual([1, 1]);
  });

  it('Mutilate: Tithe 1 spends a Fragment to Stun for 1 turn', () => {
    const a = arena({ p0: [['stun.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'stun.evil', B1).end();
    expect([a.has(B1, 'stun'), a.stacks(A1, 'soul_fragment')]).toEqual([true, 1]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect(a.has(B1, 'stun')).toBe(false);
  });

  // Dance
  it('Danse Macabre: 15 Piercing and 1 Confusion on the user for 2 turns', () => {
    const a = arena({ p0: [['dance.evil']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'dance.evil', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'confusion')]).toEqual([85, 1]);
    a.pass(3);
    expect(a.stacks(A1, 'confusion')).toBe(0);
  });

  it('Danse Macabre: meanwhile, the Confusion lowers the user\'s costs by 1 instead of raising them', () => {
    const a = arena({ p0: [['dance.evil', 'smash']], p1: [['shot']] });
    a.use(A1, 'dance.evil', B1).end().pass(1);
    const before = energy0(a);
    a.use(A1, 'smash', B1).end(); // Sr
    expect(before - energy0(a)).toBe(1);
  });

  it('Danse Macabre: after the 2 turns, costs are back to normal', () => {
    const a = arena({ p0: [['dance.evil', 'smash']], p1: [['shot']] });
    a.use(A1, 'dance.evil', B1).end().pass(3);
    const before = energy0(a);
    a.use(A1, 'smash', B1).end();
    expect(before - energy0(a)).toBe(2);
  });

  // Heal
  it('Borrowed Blood: heals 35 and costs 20 HP in all (through Shield) if the ally never attacks', () => {
    const a = arena({ p0: [['heal.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'shield', { value: 50 }).use(A1, 'heal.evil', A2).end().pass(10);
    expect(a.hp(A2)).toBe(65);
  });

  it('Borrowed Blood: a turn the ally damages an enemy skips that turn\'s loss', () => {
    const a = arena({ p0: [['heal.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.evil', A2).end().pass(1);
    a.use(A2, 'shot', B1).end(); // turn 3
    a.pass(10);
    expect(a.hp(A2)).toBe(75);
  });

  // BUG: Borrowed Blood says "at the end of each of their next 2 turns"; the first 10 is lost at the end of the cast turn (turns 1 and 3, not 3 and 5)
  it.fails('Borrowed Blood: heals 35, then the ally loses 10 at the end of each of their next 2 turns', () => {
    const a = arena({ p0: [['heal.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'shield', { value: 50 }).use(A1, 'heal.evil', A2).end();
    expect(a.hp(A2)).toBe(85);
    a.pass(2); // turn 3: their next turn
    expect(a.hp(A2)).toBe(75);
    a.pass(2); // turn 5
    expect(a.hp(A2)).toBe(65);
    a.pass(4);
    expect(a.hp(A2)).toBe(65);
  });

  // BUG: same timing as above (the cast turn counts as the first of the "next 2 turns")
  it.fails('Borrowed Blood: no loss on a turn the ally damaged an enemy', () => {
    const a = arena({ p0: [['heal.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.evil', A2).end().pass(1);
    a.use(A2, 'shot', B1).end(); // turn 3
    expect(a.hp(A2)).toBe(85);
    a.pass(2); // turn 5: no damage
    expect(a.hp(A2)).toBe(75);
  });

  // Bless
  it('Dark Gift: Lifesteal for 2 turns', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.evil', A2).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(65);
    a.pass(3);
    expect(a.has(A2, 'lifesteal')).toBe(false);
  });

  it('Dark Gift: Tithe 2 gives 1 Might per Fragment spent, for 2 turns', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment').use(A1, 'bless.evil', A2).end();
    expect([a.stacks(A2, 'might'), a.stacks(A1, 'soul_fragment')]).toEqual([1, 0]);
    a.pass(3);
    expect(a.stacks(A2, 'might')).toBe(0);
  });

  // Curse
  it('Eternal Torment: 1 Confusion and Immortal for 3 turns', () => {
    const a = arena({ p0: [['curse.evil']], p1: [['shot']] });
    a.use(A1, 'curse.evil', B1).end();
    expect([a.stacks(B1, 'confusion'), a.has(B1, 'immortal')]).toEqual([1, true]);
    a.pass(5);
    expect(a.has(B1, 'immortal')).toBe(false);
  });

  it('Eternal Torment: a hit that would take them below 5 gives its dealer a Fragment; a lighter hit doesn\'t', () => {
    const a = arena({ p0: [['curse.evil'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(B1, 25).use(A1, 'curse.evil', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(5);
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment'), a.stacks(A3, 'soul_fragment')]).toEqual([
      0, 0, 1,
    ]);
  });

  // Smite
  it('Soul Rot: 20 damage; with no Fragment, allies who hit the target gain nothing', () => {
    const a = arena({ p0: [['smite.evil'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.evil', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(A2, 'soul_fragment')]).toEqual([65, 0]);
  });

  it('Soul Rot: Tithe 1, for 2 turns each ally who damages the target gains a Fragment', () => {
    const a = arena({ p0: [['smite.evil'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment').use(A1, 'smite.evil', B1).use(A2, 'shot', B1).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment')]).toEqual([0, 1]);
    a.pass(1).use(A2, 'shot', B2).end(); // another enemy: nothing
    expect(a.stacks(A2, 'soul_fragment')).toBe(1);
    a.pass(1).use(A2, 'shot', B1).end(); // turn 5: over
    expect(a.stacks(A2, 'soul_fragment')).toBe(1);
  });

  // Prayer
  it('Black Mass: all allies heal 25; each left at full HP gives 10 back for a Fragment', () => {
    const a = arena({ p0: [['prayer.evil'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 80).give(A3, 'shield', { value: 50 }).use(A1, 'prayer.evil').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([75, 90, 90]);
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment'), a.stacks(A3, 'soul_fragment')]).toEqual([
      0, 1, 1,
    ]);
  });

  // Cleave
  it('Betrayal: 25 Piercing + 10 to the target, 10 to each of the user\'s allies, not the user', () => {
    const a = arena({ p0: [['cleave.evil'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.evil', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([65, 100, 100, 90, 90]);
  });

  it('Betrayal: Tithe 1 spares the allies', () => {
    const a = arena({ p0: [['cleave.evil'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'cleave.evil', B1).end();
    expect([a.hp(A2), a.hp(A3), a.stacks(A1, 'soul_fragment')]).toEqual([100, 100, 1]);
  });

  // Shout
  it('Wail of the Damned: all enemies Unhallowed until the end of their next turn; a healed one is Horrified for 2 turns', () => {
    const a = arena({ p0: [['shout.evil']], p1: [['shot'], ['heal'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'shout.evil').end();
    expect([B1, B2, B3].map((b) => a.has(b, 'unhallowed'))).toEqual([true, true, true]);
    a.use(B2, 'heal', B1).end(); // turn 2
    expect([a.hp(B1), a.has(B1, 'horrified'), a.has(B3, 'horrified')]).toEqual([25, true, false]);
    expect(a.has(B1, 'unhallowed')).toBe(false);
    a.pass(3); // turns 3–5
    expect(a.has(B1, 'horrified')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Wail of the Damned: after their next turn, heals work again and don\'t Horrify', () => {
    const a = arena({ p0: [['shout.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'shout.evil').end().pass(2).use(B2, 'heal', B1).end(); // turn 4
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([75, false]);
  });

  // Withstand
  it('Wretched Bulwark: 20 Shield, +10 drained as Affliction from each Unhallowed or Horrified enemy', () => {
    const a = arena({ p0: [['withstand.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'unhallowed', { source: A1 }).give(B2, 'horrified', { source: A1 }).give(B2, 'unhallowed', { source: A1 });
    a.give(B1, 'shield', { value: 30 });
    a.use(A1, 'withstand.evil').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 90, 100]);
    expect(shieldOf(a, A1)).toBe(40);
  });

  it('Wretched Bulwark: the Shield lasts 1 turn', () => {
    const a = arena({ p0: [['withstand.evil']], p1: [['shot']] });
    a.use(A1, 'withstand.evil').end();
    expect(shieldOf(a, A1)).toBe(20);
    a.pass(1);
    expect(shieldOf(a, A1)).toBe(0);
  });

  // Taunt
  it('Tyrant\'s Gaze: the target is Taunted for 2 turns, and the user is Immortal meanwhile', () => {
    const a = arena({ p0: [['taunt.evil'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.evil', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // can only target the taunter
    a.setHp(A1, 10).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.unit(A1).alive]).toEqual([5, true]);
    a.pass(2); // turns 3–4
    expect([a.has(B1, 'taunt'), a.has(A1, 'immortal')]).toEqual([false, false]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  // Titan
  it('Lord of Souls: Lifesteal and 1 Armor per Fragment (max 4) for 3 turns', () => {
    const a = arena({ p0: [['titan.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 6 }).use(A1, 'titan.evil').end();
    expect([a.has(A1, 'lifesteal'), a.stacks(A1, 'armor')]).toEqual([true, 4]);
    a.pass(5);
    expect([a.has(A1, 'lifesteal'), a.stacks(A1, 'armor')]).toEqual([false, 0]);
    const b = arena({ p0: [['titan.evil']], p1: [['shot']] });
    b.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'titan.evil').end();
    expect(b.stacks(A1, 'armor')).toBe(2);
  });

  // BUG: Lord of Souls says the user can't spend Fragments; a Tithe keeps the Fragments but still grants its bonus (Deathless Step gives Invulnerable)
  it.fails('Lord of Souls: the user can\'t spend Fragments (a Tithe gets none)', () => {
    const a = arena({ p0: [['titan.evil', 'maneuver.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'titan.evil').end().pass(1);
    a.use(A1, 'maneuver.evil').end();
    expect([a.stacks(A1, 'soul_fragment'), a.has(A1, 'invulnerable'), a.has(A1, 'immortal')]).toEqual([3, false, true]);
  });

  it('Lord of Souls: enemies can\'t drain the user\'s Fragments either', () => {
    const a = arena({ p0: [['titan.evil']], p1: [['stab.evil']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'titan.evil').end();
    a.use(B1, 'stab.evil', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(3);
  });
});

describe('Evil: costs and cooldowns match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike.evil', 'S', 1],
    ['smash.evil', 'SS', 3],
    ['charge.evil', 'S', 2],
    ['riposte.evil', 'r', 3],
    ['rage.evil', 'Sr', 4],
    ['shot.evil', 'r', 1],
    ['snipe.evil', 'AS', 3],
    ['trap.evil', 'S', 3],
    ['maneuver.evil', 'I', 2],
    ['companion.evil', 'S', 1],
    ['bolt.evil', 'Ir', 1],
    ['blast.evil', 'SIr', 2],
    ['consume.evil', 'S', 2],
    ['summon.evil', 'S', 1],
    ['channel.evil', 'rr', 3],
    ['stab.evil', 'r', 0],
    ['ravage.evil', 'nc', 2],
    ['mislead.evil', 'r', 3],
    ['stun.evil', 'AS', 3],
    ['dance.evil', 'S', 0],
    ['heal.evil', 'r', 1],
    ['bless.evil', 'W', 2],
    ['curse.evil', 'r', 2],
    ['smite.evil', 'Sr', 1],
    ['prayer.evil', 'Srr', 2],
    ['cleave.evil', 'S', 1],
    ['shout.evil', 'S', 3],
    ['withstand.evil', 'r', 3],
    ['taunt.evil', 'S', 3],
    ['titan.evil', 'SW', 4],
    ['fiend_rend_soul', 'S', 0],
    ['fiend_feast', 'r', 0],
    ['tormentor_barbed_whip', 'r', 0],
    ['tormentor_false_mercy', 'I', 0],
  ];
  const parse = (c: string) => {
    const out = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (c !== 'nc') for (const ch of c) out[ch as keyof typeof out] += 1;
    return out;
  };
  it.each(table)('%s costs %s with cooldown %i', (id, cost, cd) => {
    const s = content.skills[id];
    expect(s).toBeDefined();
    expect({ ...parse(''), ...s!.cost }).toEqual(parse(cost));
    expect(s!.cooldown).toBe(cd);
  });
});
