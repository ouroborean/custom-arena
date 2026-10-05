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
    const a = arena({ p0: [['charge.evil']], p1: [['shot']] });
    a.give(B1, 'soul_fragment', { stacks: 2 }).use(A1, 'charge.evil', B1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([1, 1]);
  });

  it('a drain on a target with no Fragments still gives the user one', () => {
    const a = arena({ p0: [['charge.evil']], p1: [['shot']] });
    a.use(A1, 'charge.evil', B1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([0, 1]);
  });

  it('Tithe spends at most N Fragments and the skill still works with none', () => {
    const a = arena({ p0: [['smite.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'smite.evil', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
    const b = arena({ p0: [['smite.evil']], p1: [['shot']] });
    b.use(A1, 'smite.evil', B1).end();
    expect(b.hp(B1)).toBe(80);
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
  it('Soulgrinder: 25 damage; at the end of the user’s turn, 10 Affliction to the target, 5 to each of their allies, and the user drains a Soul Fragment from the target', () => {
    const a = arena({ p0: [['smash.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'soul_fragment').give(B2, 'armor', { stacks: 4 }).give(B2, 'shield', { value: 50 });
    a.use(A1, 'smash.evil', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([65, 95, 95]); // Affliction: through Shield and Armor
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([0, 1]);
  });

  it('Soulgrinder: it grinds for 2 turns, once more at the end of the user’s next turn, then stops', () => {
    const a = arena({ p0: [['smash.evil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.evil', B1).end().end().end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'soul_fragment')]).toEqual([55, 90, 2]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'soul_fragment'), a.has(B1, 'soulgrinder')]).toEqual([55, 90, 2, false]);
  });

  // Charge
  it('Soul Hunt: 20 damage, and the user drains a Soul Fragment from the target', () => {
    const a = arena({ p0: [['charge.evil']], p1: [['shot']] });
    a.give(B1, 'soul_fragment').use(A1, 'charge.evil', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([80, 1, 0]);
  });

  it('Soul Hunt: the first enemy to hit the user before their next turn drains a Fragment back', () => {
    const a = arena({ p0: [['charge.evil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.evil', B1).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment'), a.stacks(B2, 'soul_fragment')]).toEqual([0, 1, 0]);
  });

  it('Soul Hunt: unhit until their next turn, the user keeps it', () => {
    const a = arena({ p0: [['charge.evil']], p1: [['shot']] });
    a.use(A1, 'charge.evil', B1).end().end().end(); // the user's next turn has come and gone
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([1, 0]);
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

  it('Take You With Me: if the user dies before the end of their next turn, the last enemy countered dies too', () => {
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
  it('Atrocity: Immortal for 2 turns, with no Fragments needed or spent', () => {
    const a = arena({ p0: [['rage.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment').use(A1, 'rage.evil').end();
    expect([a.has(A1, 'immortal'), a.stacks(A1, 'soul_fragment')]).toEqual([true, 1]);
    a.setHp(A1, 10).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.unit(A1).alive]).toEqual([5, true]);
    a.pass(1);
    expect(a.has(A1, 'immortal')).toBe(true); // through the second enemy turn
    a.pass(1);
    expect(a.has(A1, 'immortal')).toBe(false);
  });

  it('Atrocity: meanwhile, each enemy who damages the user loses a Soul Fragment to them', () => {
    const a = arena({ p0: [['rage.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'soul_fragment').give(B2, 'soul_fragment');
    a.use(A1, 'rage.evil').end();
    a.use(B1, 'shot', A1).use(B3, 'shot', A1).end();
    expect([a.stacks(B1, 'soul_fragment'), a.stacks(B2, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([
      0, 1, 2,
    ]);
  });

  // Shot
  it('Bone Needle: with no Fragment to spend, 10 damage and the user drains a Soul Fragment from the target', () => {
    const a = arena({ p0: [['shot.evil']], p1: [['shot']] });
    a.give(B1, 'soul_fragment').use(A1, 'shot.evil', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([90, 1, 0]);
  });

  it('Bone Needle: with a Fragment to spend, the user hurls it: 25 Piercing, and no drain', () => {
    const a = arena({ p0: [['shot.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).give(B1, 'armor', { stacks: 3 }).use(A1, 'shot.evil', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([70, 1]); // 25 + the Fragment left's Might
  });

  it('Bone Needle: the drained Fragment is the next Needle’s ammunition', () => {
    const a = arena({ p0: [['shot.evil']], p1: [['shot']] });
    a.use(A1, 'shot.evil', B1).end().pass(3).use(A1, 'shot.evil', B1).end(); // cooldown 1
    expect([a.hp(B1), a.stacks(A1, 'soul_fragment')]).toEqual([65, 0]);
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
  it('Deathless Step: the user gains a Soul Fragment; for 1 turn, each time they’d lose HP they lose a Fragment instead, then HP once none are left', () => {
    const a = arena({ p0: [['maneuver.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'soul_fragment').use(A1, 'maneuver.evil').end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).use(B3, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'soul_fragment')]).toEqual([85, 0]); // two shots paid in Fragments, the third in HP
  });

  it('Deathless Step: it lasts 1 turn', () => {
    const a = arena({ p0: [['maneuver.evil']], p1: [['shot']] });
    a.use(A1, 'maneuver.evil').end().end().end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'soul_fragment')]).toEqual([85, 1]);
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
  it('Profane Bolt: 25 damage; for 2 turns, each Buff the target gains costs them 10 HP', () => {
    const a = arena({ p0: [['bolt.evil']], p1: [['maneuver', 'dance']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'bolt.evil', B1).end();
    expect([a.hp(B1), a.has(B1, 'profane_bolt')]).toEqual([100, true]); // the Shield took the hit
    a.use(B1, 'maneuver').end(); // Invulnerable: one Buff, 10 HP through Shield and Invulnerable
    expect([a.hp(B1), a.has(B1, 'invulnerable')]).toEqual([90, true]);
  });

  it('Profane Bolt: each Buff counts', () => {
    const a = arena({ p0: [['bolt.evil']], p1: [['dance']] });
    a.use(A1, 'bolt.evil', B1).end().use(B1, 'dance').end(); // Might, Swiftness and Focus
    expect(a.hp(B1)).toBe(45);
  });

  it('Profane Bolt: after 2 turns, Buffs are free again', () => {
    const a = arena({ p0: [['bolt.evil']], p1: [['maneuver']] });
    a.use(A1, 'bolt.evil', B1).end().pass(4).use(B1, 'maneuver').end();
    expect([a.hp(B1), a.has(B1, 'profane_bolt')]).toEqual([75, false]);
  });

  // Blast
  it('Soulfire Nova: 45 to all enemies, then the user and each of their allies are Unhallowed for 2 turns', () => {
    const a = arena({ p0: [['blast.evil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.evil').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([55, 55]);
    expect([a.has(A1, 'unhallowed'), a.has(A2, 'unhallowed'), a.has(B1, 'unhallowed')]).toEqual([true, true, false]);
  });

  it('Soulfire Nova: meanwhile, healing on the user’s side hurts; after the 2 turns it heals again', () => {
    const a = arena({ p0: [['blast.evil'], ['heal']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 60).use(A1, 'blast.evil').end().end();
    a.use(A2, 'heal', A1).end();
    expect(a.hp(A1)).toBe(35);
    a.end();
    expect(a.has(A1, 'unhallowed')).toBe(false);
    a.pass(2).use(A2, 'heal', A1).end(); // Heal's cooldown
    expect(a.hp(A1)).toBe(60);
  });

  // Consume
  it('Reap: every enemy takes 5 and is Horrified for 1 turn', () => {
    const a = arena({ p0: [['consume.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'consume.evil').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([95, 95, 95]);
    expect([B1, B2, B3].map((b) => a.has(b, 'horrified'))).toEqual([true, true, true]);
    a.end();
    expect([B1, B2, B3].map((b) => a.has(b, 'horrified'))).toEqual([false, false, false]);
  });

  it('Reap: drains a Soul Fragment from the enemy with the least HP, and the user heals 10', () => {
    const a = arena({ p0: [['consume.evil']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'soul_fragment').give(B3, 'soul_fragment').setHp(B2, 60).setHp(A1, 50);
    a.use(A1, 'consume.evil').end();
    expect([a.stacks(B2, 'soul_fragment'), a.stacks(B3, 'soul_fragment'), a.stacks(A1, 'soul_fragment')]).toEqual([
      0, 1, 1,
    ]);
    expect(a.hp(A1)).toBe(60);
  });

  it('Reap: a target with no Fragment still gives the user one', () => {
    const a = arena({ p0: [['consume.evil']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.evil').end();
    expect([a.stacks(A1, 'soul_fragment'), a.hp(A1)]).toEqual([1, 60]);
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
  it('Heartpiercer: 15 damage; a target left above 30 HP isn’t Unhallowed', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot']] });
    a.setHp(B1, 46).use(A1, 'stab.evil', B1).end();
    expect([a.hp(B1), a.has(B1, 'unhallowed'), a.stacks(A1, 'soul_fragment')]).toEqual([31, false, 0]);
  });

  it('Heartpiercer: left at or below 30 HP, they’re Unhallowed for 2 turns, so healing hurts them', () => {
    const a = arena({ p0: [['stab.evil']], p1: [['shot'], ['heal']] });
    a.setHp(B1, 45).use(A1, 'stab.evil', B1).end();
    expect([a.hp(B1), a.has(B1, 'unhallowed')]).toEqual([30, true]);
    a.use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(5);
    a.pass(2);
    expect(a.has(B1, 'unhallowed')).toBe(false); // 2 turns
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
  it('Cruel Mercy: Stunned for 2 turns', () => {
    const a = arena({ p0: [['stun.evil']], p1: [['shot']] });
    a.use(A1, 'stun.evil', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // their second turn
    a.end().end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Cruel Mercy: Immortal for as long: nothing takes them below 5 HP, and then it ends', () => {
    const a = arena({ p0: [['stun.evil'], ['smash']], p1: [['shot']] });
    a.setHp(B1, 20).use(A1, 'stun.evil', B1).use(A2, 'smash', B1).end();
    expect([a.hp(B1), a.unit(B1).alive, a.has(B1, 'immortal')]).toEqual([5, true, true]);
    a.pass(4);
    expect([a.has(B1, 'immortal'), a.has(B1, 'stun')]).toEqual([false, false]);
  });

  it('Cruel Mercy: Immortal is a Buff, so a Horrified target gets only the Stun', () => {
    const a = arena({ p0: [['stun.evil']], p1: [['shot']] });
    a.give(B1, 'horrified', { source: A1 }).use(A1, 'stun.evil', B1).end();
    expect([a.has(B1, 'stun'), a.has(B1, 'immortal')]).toEqual([true, false]);
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

  it('Borrowed Blood: heals 35, then the ally loses 10 at the end of each of their next 2 turns', () => {
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

  it('Borrowed Blood: no loss on a turn the ally damaged an enemy', () => {
    const a = arena({ p0: [['heal.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.evil', A2).end().pass(1);
    a.use(A2, 'shot', B1).end(); // turn 3
    expect(a.hp(A2)).toBe(85);
    a.pass(2); // turn 5: no damage
    expect(a.hp(A2)).toBe(75);
  });

  // Bless
  it('Dark Gift: the user gives up 1 Soul Fragment and the ally gains 2; after 2 turns, one of them crumbles', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'bless.evil', A2).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment')]).toEqual([2, 2]);
    a.pass(2); // through the user's next turn: still 2
    expect(a.stacks(A2, 'soul_fragment')).toBe(2);
    a.pass(1); // the end of the enemy's 2nd turn
    expect(a.stacks(A2, 'soul_fragment')).toBe(1);
    a.pass(10);
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment')]).toEqual([2, 1]); // no Fragment minted
  });

  it('Dark Gift: with none to give up, the user pays 15 HP instead, the ally gains 2, and both crumble after 2 turns', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.give(A1, 'shield', { value: 50 }).use(A1, 'bless.evil', A2).end();
    expect([a.hp(A1), a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment')]).toEqual([85, 0, 2]);
    a.use(B1, 'shot', A1).end().use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 25); // the 2 borrowed Fragments are worth +10 meanwhile
    a.pass(1);
    expect(a.stacks(A2, 'soul_fragment')).toBe(0);
  });

  it('Dark Gift: only the gift crumbles; the ally keeps the Fragments they already had', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment').give(A2, 'soul_fragment', { stacks: 3 }).use(A1, 'bless.evil', A2).end();
    expect(a.stacks(A2, 'soul_fragment')).toBe(5);
    a.pass(3);
    expect(a.stacks(A2, 'soul_fragment')).toBe(4);
  });

  it('Dark Gift: the 15 HP can’t kill the user', () => {
    const a = arena({ p0: [['bless.evil'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'bless.evil', A2).end();
    expect([a.hp(A1), a.stacks(A2, 'soul_fragment')]).toEqual([1, 2]);
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
  it("Spreading Agony: 20 to the target; their allies take 5 Affliction per 20 HP the target is now missing, at least 5 (Shield doesn't stop it)", () => {
    const a = arena({ p0: [['cleave.evil'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'shield', { value: 50 }).use(A1, 'cleave.evil', B1).end(); // missing 20
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 95, 95]);
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]); // the user's side is untouched
    const b = arena({ p0: [['cleave.evil']], p1: [['shot'], ['shot'], ['shot']] });
    b.setHp(B1, 70).use(A1, 'cleave.evil', B1).end(); // missing 50
    expect([b.hp(B1), b.hp(B2), b.hp(B3)]).toEqual([50, 90, 90]);
    const c = arena({ p0: [['cleave.evil']], p1: [['shot'], ['shot']] });
    c.setHp(B1, 50).use(A1, 'cleave.evil', B1).end(); // missing 70
    expect([c.hp(B1), c.hp(B2)]).toEqual([30, 85]);
  });

  it('Spreading Agony: at most 15 each, and a blow that kills still counts what the target is missing', () => {
    const a = arena({ p0: [['cleave.evil']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 25).use(A1, 'cleave.evil', B1).end(); // missing 95
    expect([a.hp(B1), a.hp(B2)]).toEqual([5, 85]);
    const b = arena({ p0: [['cleave.evil']], p1: [['shot'], ['shot']] });
    b.setHp(B1, 10).use(A1, 'cleave.evil', B1).end();
    expect([b.unit(B1).alive, b.hp(B2)]).toEqual([false, 85]);
  });

  it('Spreading Agony: it counts the HP the blow actually took', () => {
    const a = arena({ p0: [['cleave.evil']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 70).give(B1, 'armor', { stacks: 2 }).use(A1, 'cleave.evil', B1).end(); // 10 through: missing 40
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 90]);
  });

  it('Spreading Agony: with no other enemy, only the target is hit', () => {
    const a = arena({ p0: [['cleave.evil']], p1: [['shot']] });
    a.use(A1, 'cleave.evil', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 100]);
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

  it('Lord of Souls: the user can\'t spend Fragments (a Tithe gets none)', () => {
    const a = arena({ p0: [['titan.evil', 'shot.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'titan.evil').end().pass(1);
    a.use(A1, 'shot.evil', B1).end(); // Bone Needle can't hurl one, so it drains instead
    expect([a.stacks(A1, 'soul_fragment'), a.hp(B1)]).toEqual([4, 75]); // 10 + 3 Fragments' Might
  });

  it('Lord of Souls: Deathless Step can\'t pay with Fragments, so HP is lost', () => {
    const a = arena({ p0: [['titan.evil', 'maneuver.evil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment').use(A1, 'titan.evil').end().pass(1);
    a.use(A1, 'maneuver.evil').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'soul_fragment')]).toEqual([90, 2]); // 15, less 1 Armor
  });

  it('Lord of Souls: enemies can\'t drain the user\'s Fragments either', () => {
    const a = arena({ p0: [['titan.evil']], p1: [['charge.evil']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).use(A1, 'titan.evil').end();
    a.use(B1, 'charge.evil', A1).end();
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
    ['cleave.evil', 'Sr', 1],
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
