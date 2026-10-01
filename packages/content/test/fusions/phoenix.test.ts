// Spec-driven tests for Phoenix (Fire + Holy): Kindle, Rebirth / Ashes, and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.17, and the fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { formatCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const queuedR = (a: Arena, p: 0 | 1 = 0) => a.state.players[p].queue[0]!.cost.r;
const shieldLeft = (a: Arena, id: string) => a.effects(id).reduce((n, e) => n + (e.defId === 'shield' || e.inline?.id === 'cocoon_of_flame' ? e.value : 0), 0);
const duration = (a: Arena, id: string, key: string) => a.effects(id).find((e) => (e.inline ? e.inline.id : e.defId) === key)?.duration ?? null;

/**
 * A2 (with Rebirth) burns to Ashes on our own turn 3: B1's Riposte counters A2's Shot for 15.
 * A2 then stays in Ashes through the enemy's turn 4 and rises at the start of turn 5.
 */
function ashesOnOwnTurn(a: Arena, hp = 10) {
  a.setHp(A2, hp).give(A2, 'rebirth');
  a.pass(1).use(B1, 'riposte').end();
  a.use(A2, 'shot', B1);
}

/** A2 (10 HP, with Rebirth) is hit by B1's Shot on turn 2 and burns to Ashes (rising at the start of turn 3). */
function ashesOnTurn2(a: Arena, who = A2) {
  a.setHp(who, 10).give(who, 'rebirth');
  a.pass(1).use(B1, 'shot', who).end();
}

describe('Phoenix keywords', () => {
  it('Kindle: on an enemy it deals the damage and Ignites', () => {
    const a = arena({ p0: [['strike.phoenix']], p1: [['shot']] });
    a.use(A1, 'strike.phoenix', B1).end();
    expect(a.has(B1, 'ignite')).toBe(true);
    expect(a.hp(B1)).toBe(75); // 20 + the Ignite's 5
  });

  it('Kindle: on an ally it heals the damage instead and gives 2 Renew (no Ignite)', () => {
    const a = arena({ p0: [['strike.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'strike.phoenix', A2);
    expect(a.has(A2, 'ignite')).toBe(false);
    a.end();
    expect(a.has(A2, 'ignite')).toBe(false);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(70);
    expect(a.hp(B1)).toBe(100);
  });

  it('Kindle: 2 Renew heals 10, then 5 more on the next turn (Renew loses a stack per tick)', () => {
    const a = arena({ p0: [['strike.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'strike.phoenix', A2).end();
    expect(a.hp(A2)).toBe(80); // 20 + 10
    a.pass(2);
    expect(a.hp(A2)).toBe(85);
    expect(a.has(A2, 'renew')).toBe(false);
  });

  it('Kindle: Harmful on an enemy (countered), Helpful on an ally (not countered)', () => {
    const a = arena({ p0: [['strike.phoenix'], ['shot']], p1: [['mislead']] });
    a.setHp(A2, 50);
    a.pass(1).use(B1, 'mislead', A1).end();
    a.use(A1, 'strike.phoenix', A2).end();
    expect(a.hp(A2)).toBeGreaterThanOrEqual(70);
    const b = arena({ p0: [['strike.phoenix']], p1: [['mislead']] });
    b.pass(1).use(B1, 'mislead', A1).end();
    b.use(A1, 'strike.phoenix', B1).end();
    expect([b.hp(B1), b.has(B1, 'ignite')]).toEqual([100, false]);
  });

  it('Rebirth: a lethal hit leaves the bearer at 1 HP in Ashes, and Rebirth ends', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['riposte']] });
    ashesOnOwnTurn(a);
    a.end();
    expect([a.unit(A2).alive, a.hp(A2), a.has(A2, 'ashes'), a.has(A2, 'rebirth')]).toEqual([true, 1, true, false]);
  });

  it('Rebirth (simplified): a hit leaving exactly 1 HP also counts as dying', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['riposte']] });
    ashesOnOwnTurn(a, 16);
    a.end();
    expect([a.hp(A2), a.has(A2, 'ashes')]).toEqual([1, true]);
  });

  it('Rebirth: a non-lethal hit does nothing to it', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'rebirth');
    a.pass(1).use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(A2, 'ashes'), a.has(A2, 'rebirth')]).toEqual([35, false, true]);
  });

  it('Rebirth: without it, the character simply dies', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 10);
    a.pass(1).use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
  });

  it('Ashes: Untargetable by enemies and takes no damage (Affliction included)', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['riposte'], ['blast'], ['shot']] });
    ashesOnOwnTurn(a);
    a.end();
    a.give(A2, 'ignite', { source: B1 });
    expect(a.reject(() => a.use(B3, 'shot', A2))).toBe('bad_target');
    a.use(B2, 'blast').end();
    expect(a.hp(A1)).toBe(65);
    expect(a.hp(A2)).toBe(25); // took nothing, then rose at the start of turn 5
  });

  it('Ashes: Untargetable by allies too (an ally\'s heal queued behind the fall fails)', () => {
    const a = arena({ p0: [['shot'], ['shot'], ['heal']], p1: [['riposte']] });
    ashesOnOwnTurn(a);
    a.use(A3, 'heal', A2).end();
    expect(a.hp(A2)).toBe(1);
  });

  it('Ashes: the bearer rises with 25 HP at the start of their next turn', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    ashesOnTurn2(a);
    // Turn 3 has started: A2 rose.
    expect([a.hp(A2), a.has(A2, 'ashes')]).toEqual([25, false]);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
    const b = arena({ p0: [['shot'], ['shot']], p1: [['riposte']] });
    ashesOnOwnTurn(b);
    b.end().end(); // turn 4 passes in Ashes
    expect([b.hp(A2), b.has(A2, 'ashes')]).toEqual([25, false]);
  });

  it('Ashes: enemies can\'t target a unit in Ashes during the turn it fell', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 10).give(A2, 'rebirth');
    a.pass(1).use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect([a.hp(A2), a.unit(A2).alive]).toEqual([25, true]);
  });
});

describe('Phoenix skills', () => {
  it('Firebrand Talon: 20 + Ignite on an enemy; the user gains 1 Might', () => {
    const a = arena({ p0: [['strike.phoenix']], p1: [['shot']] });
    a.use(A1, 'strike.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite'), a.stacks(A1, 'might')]).toEqual([75, true, 1]);
  });

  // BUG: "the user gains 1 Might" states no duration, so by Q16 (as with base Strike, rules §10) it's permanent;
  // the Talon's Might runs out after 1 turn.
  it.fails('Firebrand Talon: the Might has no stated duration, so it stays', () => {
    const a = arena({ p0: [['strike.phoenix']], p1: [['shot']] });
    a.use(A1, 'strike.phoenix', B1).end().pass(3);
    expect(a.stacks(A1, 'might')).toBe(1);
  });

  it('Firebrand Talon: 20 healing + 2 Renew on an ally; the user still gains 1 Might', () => {
    const a = arena({ p0: [['strike.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'strike.phoenix', A2).end();
    expect(a.stacks(A1, 'might')).toBe(1);
    expect([a.hp(A2), a.hp(B1)]).toEqual([80, 100]); // 20 + 10 from 2 Renew
  });

  it('Wingbeat: 25 to the target and 15 to their allies', () => {
    const a = arena({ p0: [['smash.phoenix']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.phoenix', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Wingbeat: an ally who went to Ashes this turn rises at the end of this turn', () => {
    const run = (wing: boolean) => {
      const a = arena({ p0: [['smash.phoenix'], ['shot']], p1: [['riposte'], ['shot']] });
      a.setHp(A2, 10).give(A2, 'rebirth');
      a.pass(1).use(B1, 'riposte').end();
      a.use(A2, 'shot', B1); // countered: A2 takes 15 and burns to Ashes on our own turn
      if (wing) a.use(A1, 'smash.phoenix', B2);
      a.end();
      return a;
    };
    const plain = run(false);
    expect([plain.has(A2, 'ashes'), plain.hp(A2)]).toEqual([true, 1]); // waits for turn 3
    const a = run(true);
    expect([a.has(A2, 'ashes'), a.hp(A2)]).toEqual([false, 25]);
  });

  it('Rising Dive: 15 + Ignite on an enemy, or 15 healing + 2 Renew on an ally', () => {
    const a = arena({ p0: [['charge.phoenix'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([80, true]);
    const b = arena({ p0: [['charge.phoenix'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 50).use(A1, 'charge.phoenix', A2).end();
    expect([b.hp(A2), b.has(A2, 'ignite')]).toEqual([75, false]); // 15 + 10 from 2 Renew
  });

  it('Rising Dive: the user gains 1 Focus for their next skill', () => {
    const a = arena({ p0: [['charge.phoenix', 'shot.phoenix']], p1: [['shot']] });
    a.use(A1, 'charge.phoenix', B1).end().pass(1);
    a.use(A1, 'shot.phoenix', B1);
    expect(queuedR(a)).toBe(0);
    a.end().pass(1).use(A1, 'shot.phoenix', B1);
    expect(queuedR(a)).toBe(1); // used up
  });

  it('Searing Rebuttal: counters the first Harmful skill; an Ignited attacker burns at once and the user is Anointed', () => {
    const a = arena({ p0: [['riposte.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    expect(content.skills['riposte.phoenix']!.tags).toContain('Invisible');
    a.give(B1, 'ignite', { source: A2 });
    a.use(A1, 'riposte.phoenix').end();
    const b1 = a.hp(B1);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(b1 - a.hp(B1)).toBe(5);
    expect(a.hp(A1)).toBe(85); // B2's shot is not countered
    expect(a.has(A1, 'anointed')).toBe(true);
  });

  it('Searing Rebuttal: the Anointed ends at the end of the user\'s next turn', () => {
    const a = arena({ p0: [['riposte.phoenix'], ['shot']], p1: [['shot']] });
    a.give(B1, 'ignite', { source: A2 });
    a.use(A1, 'riposte.phoenix').end().use(B1, 'shot', A1).end();
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Searing Rebuttal: an un-Ignited attacker is countered but nothing burns and nobody is Anointed', () => {
    const a = arena({ p0: [['riposte.phoenix']], p1: [['shot']] });
    a.use(A1, 'riposte.phoenix').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(A1, 'anointed')]).toEqual([100, 100, false]);
  });

  it('Pyreheart Fury: 2 Might, Immune and Rebirth for 3 turns', () => {
    const a = arena({ p0: [['rage.phoenix']], p1: [['curse']] });
    a.use(A1, 'rage.phoenix').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'confusion'), a.has(A1, 'rebirth')]).toEqual([2, false, true]);
    a.pass(4);
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), a.has(A1, 'rebirth')]).toEqual([0, false, false]);
  });

  it('Pyreheart Fury: rising from Ashes starts it over for 3 more turns (with a fresh Rebirth)', () => {
    const a = arena({ p0: [['rage.phoenix']], p1: [['strike']] });
    a.use(A1, 'rage.phoenix').end().pass(2);
    a.setHp(A1, 10).use(B1, 'strike', A1).end(); // turn 4: Ashes
    // Turn 5 starts: risen.
    expect([a.hp(A1), a.has(A1, 'rebirth'), a.stacks(A1, 'might')]).toEqual([25, true, 2]);
    a.pass(4); // the original 3 turns would be over now
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), a.has(A1, 'rebirth')]).toEqual([2, true, true]);
  });

  it('Ember Shot: 15 damage; at or below 30 HP the user gains Rebirth for 1 turn', () => {
    const a = arena({ p0: [['shot.phoenix']], p1: [['strike']] });
    a.setHp(A1, 30).use(A1, 'shot.phoenix', B1).end();
    expect([a.hp(B1), a.has(A1, 'rebirth')]).toEqual([85, true]);
    a.setHp(A1, 10).use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.has(A1, 'rebirth')]).toEqual([25, false]); // burned to Ashes and rose
    const b = arena({ p0: [['shot.phoenix']], p1: [['shot']] });
    b.setHp(A1, 31).use(A1, 'shot.phoenix', B1).end();
    expect(b.has(A1, 'rebirth')).toBe(false);
  });

  it('Ember Shot: the Rebirth lasts only 1 turn', () => {
    const a = arena({ p0: [['shot.phoenix']], p1: [['shot']] });
    a.setHp(A1, 30).use(A1, 'shot.phoenix', B1).end().pass(1);
    expect(a.has(A1, 'rebirth')).toBe(false);
  });

  it('Sunfall Lance: 50 damage on the following turn', () => {
    const a = arena({ p0: [['snipe.phoenix']], p1: [['shot']] });
    expect(content.skills['snipe.phoenix']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    a.use(A1, 'snipe.phoenix', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1);
    expect(a.hp(B1)).toBe(50);
  });

  it('Sunfall Lance: still fires if the user is in Ashes when it lands, and deals 25 more', () => {
    const a = arena({ p0: [['snipe.phoenix']], p1: [['shot']] });
    a.setHp(A1, 10).give(A1, 'rebirth');
    a.use(A1, 'snipe.phoenix', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(25);
  });

  it('Smoldering Nest: the first time the target sends a unit to Ashes, they take 25 and are Ignited', () => {
    const a = arena({ p0: [['trap.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    expect(content.skills['trap.phoenix']!.tags).toContain('Invisible');
    a.setHp(A2, 10).give(A2, 'rebirth');
    a.use(A1, 'trap.phoenix', B1).end().use(B1, 'shot', A2).end();
    expect([a.has(A2, 'ashes') || a.hp(A2) === 25, a.hp(B1), a.has(B1, 'ignite')]).toEqual([true, 75, true]);
  });

  it('Smoldering Nest: kills count; only the first one flares', () => {
    const a = arena({ p0: [['trap.phoenix'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 10).setHp(A3, 10);
    a.use(A1, 'trap.phoenix', B1).end().use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, a.hp(B1)]).toEqual([false, 75]);
    a.pass(1).use(B1, 'shot', A3).end();
    expect([a.unit(A3).alive, a.hp(B1)]).toEqual([false, 75 - 5]); // only its Ignite (sourced by A1) ticked
  });

  it('Smoldering Nest: kills by other enemies don\'t trigger it, and non-lethal hits don\'t', () => {
    const a = arena({ p0: [['trap.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 10);
    a.use(A1, 'trap.phoenix', B1).end().use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.unit(A2).alive, a.hp(B1), a.has(B1, 'ignite')]).toEqual([false, 100, false]);
  });

  it('Anointed Ascent: Invulnerable for 1 turn and Anointed until the end of the user\'s next turn', () => {
    const a = arena({ p0: [['maneuver.phoenix']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'maneuver.phoenix').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    expect([a.has(A1, 'anointed'), a.hp(A1)]).toEqual([true, 50]); // no heal without Condemn
    a.pass(1);
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Anointed Ascent: a Condemned user is purged (no Condemn debuff) and heals 15', () => {
    const a = arena({ p0: [['maneuver.phoenix']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'condemned', { source: B1 }).use(A1, 'maneuver.phoenix').end();
    expect([a.has(A1, 'condemned'), a.hp(A1)]).toEqual([false, 65]);
    expect(a.has(A1, 'weakness') || a.has(A1, 'vulnerable') || a.has(A1, 'confusion')).toBe(false);
  });

  it('Phoenix Chick: a permanent 15 HP minion; Peck deals 10 and Ignites', () => {
    const a = arena({ p0: [['companion.phoenix']], p1: [['shot']] });
    a.use(A1, 'companion.phoenix').end().pass(1);
    const ch = minions(a, 0, 'phoenix_chick')[0]!;
    expect(ch.hp).toBe(15);
    a.use(ch.id, 'phoenix_chick_peck', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([85, true]);
    a.pass(10);
    expect(a.unit(ch.id).alive).toBe(true);
  });

  it('Phoenix Chick: the first time it dies, it rises at the end of the owner\'s next turn as a 30 HP Firebird', () => {
    const a = arena({ p0: [['companion.phoenix']], p1: [['shot']] });
    a.use(A1, 'companion.phoenix').end();
    const ch = minions(a, 0, 'phoenix_chick')[0]!;
    a.use(B1, 'shot', ch.id).end();
    expect(a.unit(ch.id).alive).toBe(false);
    expect(minions(a, 0, 'firebird')).toHaveLength(0);
    a.end(); // the owner's next turn ends
    const fb = minions(a, 0, 'firebird');
    expect(fb).toHaveLength(1);
    expect(fb[0]!.hp).toBe(30);
  });

  it('Phoenix Chick: the Firebird\'s Peck deals 20 and Ignites; a Firebird does not rise again', () => {
    const a = arena({ p0: [['companion.phoenix']], p1: [['strike']] });
    a.use(A1, 'companion.phoenix').end();
    a.use(B1, 'strike', minions(a, 0, 'phoenix_chick')[0]!.id).end().end();
    const fb = minions(a, 0, 'firebird')[0]!;
    a.pass(1).use(fb.id, 'firebird_peck', B1);
    const b1 = a.hp(B1);
    a.end();
    expect([b1 - a.hp(B1), a.has(B1, 'ignite')]).toEqual([25, true]); // 20 + its Ignite tick
    a.setHp(fb.id, 5).use(B1, 'strike', fb.id).end().pass(4);
    expect([minions(a, 0, 'firebird').length, minions(a, 0, 'phoenix_chick').length]).toEqual([0, 0]);
  });

  it('Flare of Mercy: 20 + Ignite on an enemy', () => {
    const a = arena({ p0: [['bolt.phoenix']], p1: [['shot']] });
    a.use(A1, 'bolt.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([75, true]);
  });

  it('Flare of Mercy: an ally it mends heals 20, gains 2 Renew and loses exactly 1 Debuff', () => {
    const a = arena({ p0: [['bolt.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'weakness', { source: B1 }).give(A2, 'vulnerable', { source: B1 });
    a.use(A1, 'bolt.phoenix', A2).end();
    expect(a.stacks(A2, 'weakness') + a.stacks(A2, 'vulnerable')).toBe(1);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(70);
  });

  it('Cleansing Fire: 25 to all enemies, who lose all their Buffs (not their Debuffs)', () => {
    const a = arena({ p0: [['blast.phoenix']], p1: [['shot'], ['shot']] });
    a.give(B1, 'might').give(B1, 'swiftness').give(B2, 'weakness', { source: A1 });
    a.use(A1, 'blast.phoenix').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
    expect([a.has(B1, 'might'), a.has(B1, 'swiftness'), a.has(B2, 'weakness')]).toEqual([false, false, true]);
  });

  it('Cleansing Fire: every ally, the user included, loses all their Debuffs (and keeps their Buffs)', () => {
    const a = arena({ p0: [['blast.phoenix'], ['shot']], p1: [['shot']] });
    a.give(A1, 'confusion', { source: B1 }).give(A2, 'weakness', { source: B1, stacks: 2 }).give(A2, 'might');
    a.use(A1, 'blast.phoenix').end();
    expect([a.has(A1, 'confusion'), a.has(A2, 'weakness'), a.has(A2, 'might')]).toEqual([false, false, true]);
  });

  it('Draw the Flame: 5 drain; every Ignite on enemies goes out, healing the weakest ally 10 each', () => {
    const a = arena({ p0: [['consume.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 90).setHp(A2, 30);
    a.give(B1, 'ignite', { source: A2 }).give(B2, 'ignite', { source: A2 }).give(A1, 'ignite', { source: B1 });
    a.use(A1, 'consume.phoenix', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([false, false]);
    expect(a.has(A1, 'ignite')).toBe(true); // allies' Ignites stay
    expect([a.hp(A1), a.hp(A2), a.hp(B1), a.hp(B2)]).toEqual([95, 50, 95, 100]);
  });

  it('Draw the Flame: with no Ignites, nobody else heals', () => {
    const a = arena({ p0: [['consume.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 30).use(A1, 'consume.phoenix', B1).end();
    expect(a.hp(A2)).toBe(30);
  });

  it('Ember Spirit: a 20 HP minion for 3 turns', () => {
    const a = arena({ p0: [['summon.phoenix']], p1: [['shot']] });
    a.use(A1, 'summon.phoenix').end();
    const sp = minions(a, 0, 'ember_spirit')[0]!;
    expect(sp.hp).toBe(20);
    a.pass(5);
    expect(a.unit(sp.id).alive).toBe(false);
  });

  it('Ember Spirit / Waver: Kindle — 15 + Ignite to an enemy, or 15 healing + 2 Renew to an ally', () => {
    const a = arena({ p0: [['summon.phoenix'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.phoenix').end().pass(1);
    const sp = minions(a, 0, 'ember_spirit')[0]!;
    a.use(sp.id, 'ember_spirit_waver', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([80, true]);
    a.setHp(A2, 50).pass(1).use(sp.id, 'ember_spirit_waver', A2).end();
    expect([a.hp(A2) >= 65, a.has(A2, 'ignite')]).toEqual([true, false]);
  });

  it('Eternal Pyre: at the end of the user\'s turns, 10 + Ignite to each enemy and 10 healing + 2 Renew to each ally', () => {
    const a = arena({ p0: [['channel.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'channel.phoenix').end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.has(A2, 'ignite')]).toEqual([true, true, false]);
    expect(a.hp(B1)).toBeLessThanOrEqual(90);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(60);
    expect(a.has(A2, 'renew')).toBe(true);
  });

  it('Eternal Pyre: lasts up to 3 of the user\'s turns', () => {
    const a = arena({ p0: [['channel.phoenix']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.phoenix').end().pass(4); // ticks on turns 1, 3, 5
    const b2 = a.hp(B2);
    // 3 × 10, and the Ignite (applied as the turn-1 tick lands) burns on turns 3 and 5.
    expect(b2).toBe(100 - 3 * 10 - 2 * 5);
    a.pass(2);
    expect(b2 - a.hp(B2)).toBe(5); // only the Ignite
  });

  it('Eternal Pyre: stunning the user stops it', () => {
    const a = arena({ p0: [['channel.phoenix']], p1: [['stun'], ['shot']] });
    a.use(A1, 'channel.phoenix').end().use(B1, 'stun', A1).end();
    const b2 = a.hp(B2);
    a.pass(1);
    expect(b2 - a.hp(B2)).toBe(5);
  });

  it('Ember Needle: 10 + Ignite to an enemy, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.phoenix']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60);
    a.use(A1, 'stab.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([85, true]);
    a.pass(1);
    const b1 = a.hp(B1);
    a.use(A1, 'stab.phoenix', B2).end();
    expect(a.hp(B2)).toBe(35);
    expect(b1 - a.hp(B1)).toBe(5);
  });

  it('Ember Needle: on an ally, 10 healing + 2 Renew, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 61).use(A1, 'stab.phoenix', A2).end();
    expect(a.hp(A2)).toBe(61 + 10 + 10);
    const b = arena({ p0: [['stab.phoenix'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 60).use(A1, 'stab.phoenix', A2).end();
    expect(b.hp(A2)).toBe(60 + 20 + 10);
  });

  it('Pyre Talon: 25 Piercing + Ignite, 15 more against a Stunned enemy', () => {
    const a = arena({ p0: [['ravage.phoenix']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).give(B2, 'stun', { source: A1, duration: 10 });
    a.use(A1, 'ravage.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([70, true]);
    a.pass(3).use(A1, 'ravage.phoenix', B2).end();
    expect(a.hp(B2)).toBe(100 - 40 - 5);
  });

  it('Pyre Talon: on an ally, 25 healing + 2 Renew and it ends their Stun', () => {
    const a = arena({ p0: [['ravage.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'stun', { source: B1, duration: 4 });
    a.use(A1, 'ravage.phoenix', A2).end();
    expect([a.has(A2, 'stun'), a.hp(A2) >= 75, a.has(A2, 'ignite')]).toEqual([false, true, false]);
  });

  it('Flaring Feint: counters the target\'s Harmful skill, and their Ignite burns three times at once', () => {
    const a = arena({ p0: [['mislead.phoenix'], ['shot']], p1: [['shot']] });
    expect(content.skills['mislead.phoenix']!.tags).toContain('Invisible');
    a.give(B1, 'ignite', { source: A2 });
    a.use(A1, 'mislead.phoenix', B1).end();
    const b1 = a.hp(B1);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), b1 - a.hp(B1)]).toEqual([100, 15]);
  });

  it('Flaring Feint: without an Ignite it just counters; Helpful skills pass', () => {
    const a = arena({ p0: [['mislead.phoenix'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.phoenix', B1).end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([100, 100]);
    const b = arena({ p0: [['mislead.phoenix']], p1: [['heal']] });
    b.setHp(B1, 50).use(A1, 'mislead.phoenix', B1).end().use(B1, 'heal', B1).end();
    expect(b.hp(B1)).toBe(75);
  });

  it('Blinding Plumage: 15 damage and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.phoenix']], p1: [['shot']] });
    a.use(A1, 'stun.phoenix', B1).end();
    expect([a.hp(B1), a.reject(() => a.use(B1, 'shot', A1))]).toEqual([85, 'cannot_act']);
    a.pass(2);
    a.use(B1, 'shot', A1);
  });

  it('Blinding Plumage (simplified): on a Condemned target, the Stun lasts 3 turns', () => {
    const a = arena({ p0: [['stun.phoenix']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 });
    a.use(A1, 'stun.phoenix', B1).end().pass(4);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // turn 6
    a.pass(2);
    a.use(B1, 'shot', A1); // turn 8
  });

  it('Dance of Embers: 1 Might, 2 Swiftness and 1 Focus for 4 turns', () => {
    const a = arena({ p0: [['dance.phoenix']], p1: [['shot']] });
    a.use(A1, 'dance.phoenix').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 2, 1]);
    a.pass(8);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([0, 0, 0]);
  });

  it('Dance of Embers: a Kindle on an enemy heals the weakest ally for half its damage', () => {
    const a = arena({ p0: [['dance.phoenix', 'strike.phoenix'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(B1, 'armor'); // cancels the Dance's Might: the Talon deals 20
    a.use(A1, 'dance.phoenix').end().pass(1);
    a.setHp(A2, 30);
    a.use(A1, 'strike.phoenix', B1).end();
    expect(a.hp(A2)).toBe(40);
  });

  it('Dance of Embers: a Kindle on an ally heals no one else', () => {
    const a = arena({ p0: [['dance.phoenix', 'strike.phoenix'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'dance.phoenix').end().pass(1);
    a.setHp(A2, 30).setHp(A3, 90);
    a.use(A1, 'strike.phoenix', A3).end();
    expect(a.hp(A2)).toBe(30);
  });

  it('Sacrificial Flame: the user burns 30 HP; the target ally heals twice that', () => {
    const a = arena({ p0: [['heal.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 30).use(A1, 'heal.phoenix', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 90]);
  });

  it('Sacrificial Flame: never below 1 HP; heals twice what was actually burned', () => {
    const a = arena({ p0: [['heal.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 11).setHp(A2, 30).use(A1, 'heal.phoenix', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([1, 50]);
  });

  it('Phoenix Blessing: 1 Might and Rebirth for 3 turns', () => {
    const a = arena({ p0: [['bless.phoenix'], ['shot']], p1: [['strike']] });
    a.use(A1, 'bless.phoenix', A2).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.setHp(A2, 10).use(B1, 'strike', A2).end();
    expect([a.unit(A2).alive, a.hp(A2)]).toEqual([true, 25]);
  });

  it('Phoenix Blessing: if the Rebirth goes unused, the ally heals 25 when it ends', () => {
    const a = arena({ p0: [['bless.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.phoenix', A2).end().pass(4);
    expect(a.hp(A2)).toBe(50);
    a.pass(1);
    expect(a.hp(A2)).toBe(75);
  });

  it('Phoenix Blessing: a used Rebirth gives no heal when it ends', () => {
    const a = arena({ p0: [['bless.phoenix'], ['shot']], p1: [['strike']] });
    a.setHp(A2, 10).use(A1, 'bless.phoenix', A2).end().use(B1, 'strike', A2).end();
    expect(a.hp(A2)).toBe(25);
    a.pass(4);
    expect(a.hp(A2)).toBe(25);
  });

  it('Cinders of Doubt: Confused for 2 turns and Condemned', () => {
    const a = arena({ p0: [['curse.phoenix']], p1: [['shot']] });
    a.use(A1, 'curse.phoenix', B1).end();
    expect([a.has(B1, 'confusion'), a.has(B1, 'condemned')]).toEqual([true, true]);
  });

  it('Cinders of Doubt: for 2 turns, each Weakness, Vulnerable or Confusion the target gains lasts 1 turn longer', () => {
    const a = arena({ p0: [['curse.phoenix'], ['curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.phoenix', B1).use(A2, 'curse', B1).end();
    const b = arena({ p0: [['shot'], ['curse']], p1: [['shot'], ['shot']] });
    b.use(A2, 'curse', B1).end();
    const plain = b.effects(B1).find((e) => e.defId === 'confusion')!.duration!;
    const longer = a.effects(B1).filter((e) => e.defId === 'confusion' && e.sourceSkill === 'curse').map((e) => e.duration!);
    expect(longer).toEqual([plain + 2]);
  });

  it('Cinders of Doubt: other Debuffs (a Stun) are not lengthened, and other enemies are unaffected', () => {
    const a = arena({ p0: [['curse.phoenix'], ['stun'], ['curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.phoenix', B1).use(A2, 'stun', B1).use(A3, 'curse', B2).end();
    const b = arena({ p0: [['shot'], ['stun'], ['curse']], p1: [['shot'], ['shot']] });
    b.use(A2, 'stun', B1).use(A3, 'curse', B2).end();
    expect(duration(a, B1, 'stun_ns') ?? duration(a, B1, 'stun')).toBe(duration(b, B1, 'stun_ns') ?? duration(b, B1, 'stun'));
    expect(duration(a, B2, 'confusion')).toBe(duration(b, B2, 'confusion'));
  });

  it('Sanctified Pyre: 20 damage and Sanctify for 2 turns', () => {
    const a = arena({ p0: [['smite.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.phoenix', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([65, 65]);
    a.pass(2);
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Sanctified Pyre: each time the Sanctify heals someone, the target\'s Ignite burns once', () => {
    const a = arena({ p0: [['smite.phoenix'], ['shot']], p1: [['shot']] });
    a.give(B1, 'ignite', { source: B1 }); // ticks only on the enemy's turn
    a.setHp(A2, 50).use(A1, 'smite.phoenix', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 15 - 5);
  });

  it('Second Dawn: fallen allies return with 20 HP and no effects, then all allies heal 15', () => {
    const a = arena({ p0: [['prayer.phoenix'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 10).give(A2, 'might');
    a.setHp(B2, 10);
    a.use(A3, 'shot', B2);
    a.end().use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, a.unit(B2).alive]).toEqual([false, false]);
    a.setHp(A1, 50).use(A1, 'prayer.phoenix').end();
    expect([a.unit(A2).alive, a.hp(A2), a.has(A2, 'might'), a.hp(A1)]).toEqual([true, 35, false, 65]);
    expect(a.unit(B2).alive).toBe(false); // enemies stay down
  });

  it('Fanned Flames: 25 and 15; each one\'s Ignite burns once now, and the user heals as much', () => {
    const a = arena({ p0: [['cleave.phoenix']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).give(B1, 'ignite', { source: B1 });
    a.use(A1, 'cleave.phoenix', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([70, 85, 55]);
  });

  it('Fanned Flames: no Ignites, no burns and no healing', () => {
    const a = arena({ p0: [['cleave.phoenix']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'cleave.phoenix', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([75, 85, 50]);
  });

  it('Phoenix Cry: all enemies are Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.phoenix']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.phoenix').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.pass(3);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Phoenix Cry: only allies who have risen this battle (or are in Ashes) gain 1 Might and 1 Swiftness for 2 turns', () => {
    const a = arena({ p0: [['shout.phoenix'], ['shot'], ['shot']], p1: [['shot']] });
    ashesOnTurn2(a); // A2 rose at the start of turn 3
    a.use(A1, 'shout.phoenix').end();
    expect([a.stacks(A2, 'might'), a.stacks(A2, 'swiftness')]).toEqual([1, 1]);
    expect([a.stacks(A1, 'might'), a.stacks(A3, 'might')]).toEqual([0, 0]);
    a.pass(4);
    expect([a.stacks(A2, 'might'), a.stacks(A2, 'swiftness')]).toEqual([0, 0]);
  });

  it('Cocoon of Flame: 40 Shield, and the user can\'t act on their next turn', () => {
    const a = arena({ p0: [['withstand.phoenix', 'shot']], p1: [['shot']] });
    a.use(A1, 'withstand.phoenix').end();
    expect(shieldLeft(a, A1)).toBe(40);
    a.pass(1);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    a.pass(2);
    a.use(A1, 'shot', B1);
  });

  it('Cocoon of Flame: when it opens, the user and every ally heal as much as the Shield has left', () => {
    const a = arena({ p0: [['withstand.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'withstand.phoenix').end();
    a.use(B1, 'shot', A1).end(); // 15 absorbed
    expect(a.hp(A1)).toBe(50);
    a.end(); // the user's next turn ends: it opens
    expect([a.hp(A1), a.hp(A2)]).toEqual([75, 75]);
  });

  it('Blazing Challenge: Taunts for 2 turns; each hit from the Taunted enemy makes the user\'s next skill 1 cheaper', () => {
    const a = arena({ p0: [['taunt.phoenix', 'shot.phoenix']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.phoenix', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.use(B1, 'shot', A1).end();
    a.use(A1, 'shot.phoenix', B1);
    expect(queuedR(a)).toBe(0);
  });

  it('Blazing Challenge: hits from other enemies don\'t count', () => {
    const a = arena({ p0: [['taunt.phoenix', 'shot.phoenix']], p1: [['heal'], ['shot']] });
    a.use(A1, 'taunt.phoenix', B1).end();
    a.use(B2, 'shot', A1).end();
    a.use(A1, 'shot.phoenix', B1);
    expect(queuedR(a)).toBe(1);
  });

  it('Undying Phoenix: 2 Armor, Immune and Rebirth for 3 turns', () => {
    const a = arena({ p0: [['titan.phoenix']], p1: [['strike']] });
    a.use(A1, 'titan.phoenix').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.has(A1, 'rebirth')]).toEqual([2, true, true]);
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it('Undying Phoenix: rising from Ashes gives 40 HP instead of 25, and the Titan starts over', () => {
    const a = arena({ p0: [['titan.phoenix']], p1: [['strike']] });
    a.use(A1, 'titan.phoenix').end().pass(2);
    a.setHp(A1, 5).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(40);
    a.pass(4); // the first 3 turns would be over
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.has(A1, 'rebirth')]).toEqual([2, true, true]);
  });
});

describe('Phoenix costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['r', 3], rage: ['SA', 4],
    shot: ['r', 0], snipe: ['Srr', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['Sr', 1], blast: ['IW', 2], consume: ['r', 2], summon: ['I', 1], channel: ['rr', 3],
    stab: ['r', 0], ravage: ['Ar', 1], mislead: ['S', 2], stun: ['A', 2], dance: ['AW', 5],
    heal: ['W', 1], bless: ['r', 2], curse: ['r', 2], smite: ['Sr', 1], prayer: ['Wrr', 5],
    cleave: ['S', 1], shout: ['W', 3], withstand: ['A', 3], taunt: ['r', 3], titan: ['SW', 4],
  };
  it.each(Object.entries(kit))('%s.phoenix', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.phoenix`]!;
    expect([formatCost(s.cost), s.cooldown]).toEqual([cost, cd]);
  });
  it('minion skills: Peck and Waver cost r with no cooldown', () => {
    for (const id of ['phoenix_chick_peck', 'firebird_peck', 'ember_spirit_waver']) {
      expect([formatCost(content.skills[id]!.cost), content.skills[id]!.cooldown]).toEqual(['r', 0]);
    }
  });
});
