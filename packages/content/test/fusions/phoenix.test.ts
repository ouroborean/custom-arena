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
const shieldLeft = (a: Arena, id: string) => a.effects(id).reduce((n, e) => n + (e.defId === 'shield' || e.inline?.id === 'cocoon_of_flame' ? e.value : 0), 0);

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
    const a = arena({ p0: [['bolt.phoenix']], p1: [['shot']] });
    a.use(A1, 'bolt.phoenix', B1).end();
    expect(a.has(B1, 'ignite')).toBe(true);
    expect(a.hp(B1)).toBe(75); // 20 + the Ignite's 5
  });

  it('Kindle: on an ally it heals the damage instead and gives 2 Renew (no Ignite)', () => {
    const a = arena({ p0: [['bolt.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'bolt.phoenix', A2);
    expect(a.has(A2, 'ignite')).toBe(false);
    a.end();
    expect(a.has(A2, 'ignite')).toBe(false);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(70);
    expect(a.hp(B1)).toBe(100);
  });

  it('Kindle: 2 Renew heals 10, then 5 more on the next turn (Renew loses a stack per tick)', () => {
    const a = arena({ p0: [['bolt.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'bolt.phoenix', A2).end();
    expect(a.hp(A2)).toBe(80); // 20 + 10
    a.pass(2);
    expect(a.hp(A2)).toBe(85);
    expect(a.has(A2, 'renew')).toBe(false);
  });

  it('Kindle: Harmful on an enemy (countered), Helpful on an ally (not countered)', () => {
    const a = arena({ p0: [['bolt.phoenix'], ['shot']], p1: [['mislead']] });
    a.setHp(A2, 50);
    a.pass(1).use(B1, 'mislead', A1).end();
    a.use(A1, 'bolt.phoenix', A2).end();
    expect(a.hp(A2)).toBeGreaterThanOrEqual(70);
    const b = arena({ p0: [['bolt.phoenix']], p1: [['mislead']] });
    b.pass(1).use(B1, 'mislead', A1).end();
    b.use(A1, 'bolt.phoenix', B1).end();
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

});

describe('Phoenix skills: evolutions', () => {
  it('Firebrand Talon: on an enemy, 10 damage, then 10 Affliction each time they use a skill, for 2 turns', () => {
    const a = arena({ p0: [['strike.phoenix']], p1: [['shot']] });
    a.use(A1, 'strike.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'firebrand'), a.has(B1, 'ignite')]).toEqual([90, true, false]);
    a.use(B1, 'shot', A1).end(); // turn 2
    expect(a.hp(B1)).toBe(80);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 4
    expect(a.hp(B1)).toBe(70);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 6: the brand is gone
    expect([a.hp(B1), a.has(B1, 'firebrand')]).toEqual([70, false]);
  });

  it('Firebrand Talon: on an ally, 10 healing, then 10 more each time they use a skill, for 2 turns', () => {
    const a = arena({ p0: [['strike.phoenix'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).setHp(A3, 40).use(A1, 'strike.phoenix', A3).end();
    expect([a.hp(A3), a.has(A3, 'firebrand_mend')]).toEqual([50, true]); // A3 didn't act: just the 10
    a.pass(1).use(A1, 'strike.phoenix', A2).use(A2, 'shot', B1).end(); // turn 3: 10, then 10 for A2's Shot
    expect(a.hp(A2)).toBe(60);
    a.pass(1).use(A2, 'shot', B1).end(); // turn 5
    expect(a.hp(A2)).toBe(70);
    a.pass(1).use(A2, 'shot', B1).end(); // turn 7: over
    expect([a.hp(A2), a.has(A2, 'firebrand_mend')]).toEqual([70, false]);
  });

  it('Firebrand Talon: a second brand refreshes the first instead of doubling it', () => {
    const a = arena({ p0: [['strike.phoenix']], p1: [['shot']] });
    a.use(A1, 'strike.phoenix', B1).end().pass(1).use(A1, 'strike.phoenix', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Pyre Plunge: the user burns 40 of their own HP; the target takes that much, and each of their allies half', () => {
    const a = arena({ p0: [['smash.phoenix'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.phoenix', B1).end();
    expect([a.hp(A1), a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A2)]).toEqual([60, 60, 80, 80, 100]);
  });

  it('Pyre Plunge: never below 1: at 31 HP the user burns 30, for 30 and 15', () => {
    const a = arena({ p0: [['smash.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 31).use(A1, 'smash.phoenix', B1).end();
    expect([a.hp(A1), a.unit(A1).alive, a.hp(B1), a.hp(B2)]).toEqual([1, true, 70, 85]);
  });

  it('Pyre Plunge: at 1 HP nothing burns and nothing is dealt, but the user still gains Rebirth', () => {
    const a = arena({ p0: [['smash.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 1).use(A1, 'smash.phoenix', B1).end();
    expect([a.hp(A1), a.hp(B1), a.hp(B2), a.has(A1, 'rebirth')]).toEqual([1, 100, 100, true]);
  });

  it('Pyre Plunge: the user rises from it with Rebirth: a lethal hit on the enemy’s turn sends them to Ashes, and they rise with 25', () => {
    const a = arena({ p0: [['smash.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 41).use(A1, 'smash.phoenix', B1).end();
    expect([a.hp(A1), a.hp(B1), a.has(A1, 'rebirth')]).toEqual([1, 60, true]);
    a.use(B1, 'shot', A1).end();
    expect([a.unit(A1).alive, a.has(A1, 'ashes'), a.has(A1, 'rebirth')]).toEqual([true, false, false]);
    expect(a.hp(A1)).toBe(25);
  });

  it('Pyre Plunge: the Rebirth lasts 1 turn', () => {
    const a = arena({ p0: [['smash.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.phoenix', B1).end();
    expect(a.has(A1, 'rebirth')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'rebirth')).toBe(false);
  });

  it('Rising Dive: 15 damage to an enemy, or 15 healing to an ally (no Ignite, no Renew)', () => {
    const a = arena({ p0: [['charge.phoenix'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.phoenix', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([85, false]);
    const b = arena({ p0: [['charge.phoenix'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 50).use(A1, 'charge.phoenix', A2).end();
    expect([b.hp(A2), b.has(A2, 'renew')]).toEqual([65, false]);
  });

  it('Rising Dive: the user has Rebirth until their next skill; a lethal hit sends them to Ashes and spends it', () => {
    const a = arena({ p0: [['charge.phoenix', 'shot']], p1: [['strike'], ['shot']] });
    a.setHp(A1, 15).use(A1, 'charge.phoenix', B1).end();
    expect(a.has(A1, 'rising_dive')).toBe(true);
    a.use(B1, 'strike', A1).end();
    expect([a.unit(A1).alive, a.hp(A1), a.has(A1, 'rising_dive')]).toEqual([true, 25, false]); // rose at the start of turn 3
    a.use(A1, 'shot', B2).end();
    expect(a.hp(B2)).toBe(85); // spent: no bonus
  });

  it("Rising Dive: unspent, the user's next skill to land deals 15 more to its enemy target — that one skill only", () => {
    const a = arena({ p0: [['charge.phoenix', 'shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'charge.phoenix', B1).end().pass(1);
    a.use(A1, 'shot', B2).end().pass(1);
    expect([a.hp(B2), a.has(A1, 'rising_dive')]).toEqual([70, false]);
    a.use(A1, 'shot', B3).end();
    expect(a.hp(B3)).toBe(85);
  });

  it('Rising Dive: if that next skill targets an ally, they heal 15 more', () => {
    const a = arena({ p0: [['charge.phoenix', 'heal'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.phoenix', B1).end().pass(1);
    a.setHp(A2, 40).use(A1, 'heal', A2).end();
    expect(a.hp(A2)).toBe(40 + 25 + 15);
  });

  it('Rising Dive: a countered skill spends nothing; after 2 turns, the Rebirth and bonus lapse', () => {
    const a = arena({ p0: [['charge.phoenix', 'shot']], p1: [['riposte'], ['shot']] });
    a.use(A1, 'charge.phoenix', B2).end();
    a.use(B1, 'riposte').end();
    a.use(A1, 'shot', B1).end(); // turn 3: countered
    expect([a.hp(B1), a.has(A1, 'rising_dive')]).toEqual([100, true]);
    a.end().use(A1, 'shot', B1).end(); // turn 5
    expect([a.hp(B1), a.has(A1, 'rising_dive')]).toEqual([85, false]);
  });

  it('Pyreheart Fury: for 3 turns, each enemy the user hits directly is Ignited (no Might, no Immune)', () => {
    const a = arena({ p0: [['rage.phoenix', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.phoenix').end();
    expect([a.has(A1, 'pyreheart_fury'), a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([true, 0, false]);
    a.pass(1).use(A1, 'shot', B1).end(); // turn 3: nobody was Ignited yet, a plain 15
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([100 - 15 - 5, true]);
    a.pass(1).use(A1, 'shot', B2).end(); // turn 5: 1 Ignited enemy
    expect([a.hp(B2), a.has(B2, 'ignite')]).toEqual([100 - 20 - 5, true]);
  });

  it('Pyreheart Fury: 5 more direct damage per Ignited enemy, whoever lit them; over after 3 turns', () => {
    const a = arena({ p0: [['rage.phoenix', 'shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'rage.phoenix').end().pass(1);
    a.give(B1, 'ignite', { source: A1 }).give(B2, 'ignite', { source: A1 });
    a.use(A1, 'shot', B3).end();
    expect(a.hp(B3)).toBe(100 - 25 - 5); // 15 + 2 × 5, then its new Ignite burns
    a.pass(3); // turn 7
    expect(a.has(A1, 'pyreheart_fury')).toBe(false);
    const b1 = a.hp(B1);
    a.use(A1, 'shot', B1).end();
    expect(b1 - a.hp(B1)).toBe(15 + 5); // a plain Shot, then B1's Ignite burns
  });

  it("Ember Shot: 10 damage; the next direct hit from the user's side deals 10 more and Ignites them, once", () => {
    const a = arena({ p0: [['shot.phoenix'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'shot.phoenix', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    // 10, then 15 + 10, then a plain 15; the Ignite burns 5 at the end of the turn.
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([100 - 10 - 25 - 15 - 5, true]);
  });

  it('Ember Shot: the ember lasts 1 turn', () => {
    const a = arena({ p0: [['shot.phoenix'], ['shot']], p1: [['shot']] });
    a.use(A1, 'shot.phoenix', B1).end().pass(1);
    a.use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([75, false]);
  });

  it('Sunfall Lance: on the following turn, 35 to target enemy and 15 to each of their allies', () => {
    const a = arena({ p0: [['snipe.phoenix']], p1: [['shot'], ['shot'], ['shot']] });
    const s = content.skills['snipe.phoenix']!;
    expect(s.target).toBe('enemy');
    expect(s.tags).toEqual(expect.arrayContaining(['Harmful', 'Channeled', 'HiddenTarget']));
    a.use(A1, 'snipe.phoenix', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
    a.end(); // it falls at the end of the following turn
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([65, 85, 85]);
  });

  it('Sunfall Lance: Channeled — a Stun before it falls stops it', () => {
    const a = arena({ p0: [['snipe.phoenix']], p1: [['stun'], ['shot']] });
    a.use(A1, 'snipe.phoenix', B2).end().use(B1, 'stun', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
  });

  it('Banked Embers: no enemy or ally can target the user, and they lose no HP (Affliction included)', () => {
    const a = arena({ p0: [['maneuver.phoenix'], ['heal']], p1: [['shot'], ['blast']] });
    a.setHp(A1, 60).give(A1, 'ignite', { source: B1 });
    a.use(A1, 'maneuver.phoenix').use(A2, 'heal', A1).end();
    expect([a.hp(A1), a.has(A1, 'banked_embers')]).toEqual([60, true]); // the ally's heal queued behind it fails
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B2, 'blast').end();
    expect(a.hp(A2)).toBeLessThan(100);
    expect([a.hp(A1), a.has(A1, 'banked_embers')]).toEqual([60, false]); // out at the start of turn 3
  });

  it('Banked Embers: they come out with the HP they had (no rise to 25, not Ashes)', () => {
    const a = arena({ p0: [['maneuver.phoenix']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'maneuver.phoenix');
    expect(a.has(A1, 'ashes')).toBe(false);
    a.end().end();
    expect([a.hp(A1), a.has(A1, 'banked_embers')]).toEqual([10, false]);
  });

  it('Draw the Flame: 10 damage; if the target still has more HP, the user heals half the difference', () => {
    const a = arena({ p0: [['consume.phoenix']], p1: [['shot']] });
    a.setHp(A1, 40).use(A1, 'consume.phoenix', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 65]); // (90 − 40) ÷ 2
    const b = arena({ p0: [['consume.phoenix']], p1: [['shot']] });
    b.setHp(A1, 59).use(A1, 'consume.phoenix', B1).end();
    expect(b.hp(A1)).toBe(74); // 31 ÷ 2, rounded down
  });

  it('Draw the Flame: at most 25; nothing if the user has as much HP or more', () => {
    const a = arena({ p0: [['consume.phoenix']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'consume.phoenix', B1).end();
    expect(a.hp(A1)).toBe(35);
    const b = arena({ p0: [['consume.phoenix']], p1: [['shot']] });
    b.setHp(B1, 60).setHp(A1, 50).use(A1, 'consume.phoenix', B1).end();
    expect([b.hp(B1), b.hp(A1)]).toEqual([50, 50]);
  });

  it("Eternal Pyre: at the end of each of the user's turns, all enemies burn for 5, then 10, then 15", () => {
    const a = arena({ p0: [['channel.phoenix']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.phoenix').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 95]);
    a.pass(2);
    expect(a.hp(B2)).toBe(85);
    a.pass(2);
    expect(a.hp(B2)).toBe(70);
    a.pass(2);
    expect([a.hp(B2), a.has(A1, 'eternal_pyre')]).toEqual([70, false]);
  });

  it("Eternal Pyre: Channeled — a Stun or the user's next skill puts it out, growth and all", () => {
    const a = arena({ p0: [['channel.phoenix']], p1: [['stun'], ['shot']] });
    a.use(A1, 'channel.phoenix').end().use(B1, 'stun', A1).end();
    a.pass(4);
    expect(a.hp(B2)).toBe(95);
    const b = arena({ p0: [['channel.phoenix', 'shot']], p1: [['shot'], ['shot']] });
    b.use(A1, 'channel.phoenix').end().pass(1).use(A1, 'shot', B1).end().pass(3);
    expect(b.hp(B2)).toBe(95);
  });

  it("Cautery Needle: on an enemy, 15 damage, and they can't be healed until the end of their next turn", () => {
    const a = arena({ p0: [['stab.phoenix']], p1: [['shot'], ['heal'], ['heal']] });
    a.setHp(B1, 50).use(A1, 'stab.phoenix', B1).end();
    expect(a.hp(B1)).toBe(35);
    a.use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(35);
    a.pass(1).use(B3, 'heal', B1).end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Cautery Needle: on an ally, up to 2 Debuffs burn away, and they lose 10 HP for each (Buffs stay)', () => {
    const a = arena({ p0: [['stab.phoenix'], ['shot']], p1: [['shot']] });
    a.give(A2, 'weakness', { source: B1, stacks: 2 }).give(A2, 'vulnerable', { source: B1 }).give(A2, 'might');
    a.use(A1, 'stab.phoenix', A2).end();
    expect([a.hp(A2), a.has(A2, 'weakness'), a.has(A2, 'vulnerable'), a.has(A2, 'might')]).toEqual([80, false, false, true]);
  });

  it('Cautery Needle: no more than 2 Debuffs a use; with none, it costs nothing', () => {
    const a = arena({ p0: [['stab.phoenix'], ['shot']], p1: [['shot']] });
    a.give(A2, 'weakness', { source: B1 }).give(A2, 'vulnerable', { source: B1 }).give(A2, 'confusion', { source: B1 });
    a.use(A1, 'stab.phoenix', A2).end();
    const left = a.effects(A2).filter((e) => ['weakness', 'vulnerable', 'confusion'].includes(e.defId)).length;
    expect([a.hp(A2), left]).toEqual([80, 1]);
    const b = arena({ p0: [['stab.phoenix'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 50).use(A1, 'stab.phoenix', A2).end();
    expect(b.hp(A2)).toBe(50);
  });

  it('Cautery Needle: the ally never drops below 1 HP', () => {
    const a = arena({ p0: [['stab.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 5).give(A2, 'weakness', { source: B1 }).use(A1, 'stab.phoenix', A2).end();
    expect([a.unit(A2).alive, a.hp(A2), a.has(A2, 'weakness')]).toEqual([true, 1, false]);
  });

  it('Pyre Talon: 20 Piercing at full HP; 5 more for every 10 HP the user is missing', () => {
    const a = arena({ p0: [['ravage.phoenix']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.phoenix', B1).end();
    expect(a.hp(B1)).toBe(80);
    const b = arena({ p0: [['ravage.phoenix']], p1: [['shot']] });
    b.setHp(A1, 55).use(A1, 'ravage.phoenix', B1).end();
    expect(b.hp(B1)).toBe(100 - 20 - 20); // 45 missing: 4 × 5
  });

  it('Pyre Talon: at most 30 more', () => {
    const a = arena({ p0: [['ravage.phoenix']], p1: [['shot']] });
    a.setHp(A1, 5).use(A1, 'ravage.phoenix', B1).end();
    expect(a.hp(B1)).toBe(50);
  });

  it('Cinder Shroud: 15 damage and Stunned for 2 turns', () => {
    const a = arena({ p0: [['stun.phoenix']], p1: [['shot']] });
    a.use(A1, 'stun.phoenix', B1).end();
    expect([a.hp(B1), a.reject(() => a.use(B1, 'shot', A1))]).toEqual([85, 'cannot_act']);
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // turn 4
    a.pass(2);
    a.use(B1, 'shot', A1); // turn 6
  });

  it("Cinder Shroud: while they're Stunned, they can't lose HP (Affliction included)", () => {
    const a = arena({ p0: [['stun.phoenix'], ['shot'], ['strike.fire']], p1: [['shot']] });
    a.use(A1, 'stun.phoenix', B1).use(A2, 'shot', B1).use(A3, 'strike.fire', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([85, true]);
  });

  it("Cinder Shroud: if the Stun doesn't take (Swiftness), the cinders don't protect them", () => {
    const a = arena({ p0: [['stun.phoenix'], ['shot']], p1: [['shot']] });
    a.give(B1, 'swiftness').use(A1, 'stun.phoenix', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Dance of Embers: 2 Swiftness for 4 turns', () => {
    const a = arena({ p0: [['dance.phoenix']], p1: [['shot']] });
    a.use(A1, 'dance.phoenix').end();
    expect(a.stacks(A1, 'swiftness')).toBe(2);
    a.pass(8);
    expect(a.stacks(A1, 'swiftness')).toBe(0);
  });

  it('Dance of Embers: each skill used leaves an ember; when the dance ends, each burns every enemy for 10 and heals every ally 5', () => {
    const a = arena({ p0: [['dance.phoenix', 'shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.phoenix').end().pass(1);
    a.use(A1, 'shot', B1).end().pass(1); // ember 1 (turn 3)
    a.use(A1, 'shot', B1).end().pass(1); // ember 2 (turn 5)
    a.setHp(A2, 50);
    const b2 = a.hp(B2);
    a.use(A1, 'shot', B1).end(); // ember 3 (turn 7)
    expect(a.hp(B2)).toBe(b2);
    a.end(); // the dance ends with turn 8
    expect([b2 - a.hp(B2), a.hp(A2)]).toEqual([30, 65]);
  });

  it('Dance of Embers: no skills used, no embers', () => {
    const a = arena({ p0: [['dance.phoenix']], p1: [['shot']] });
    a.use(A1, 'dance.phoenix').end().pass(8);
    expect(a.hp(B1)).toBe(100);
  });

  it("Cinders of Doubt: Ignites the target; at the end of the user's turn, they gain 1 Weakness or 1 Vulnerable, or 1 Confusion", () => {
    const a = arena({ p0: [['curse.phoenix']], p1: [['shot']] });
    a.use(A1, 'curse.phoenix', B1).end();
    const doubts = ['weakness', 'vulnerable', 'confusion'].filter((k) => a.has(B1, k));
    expect([a.has(B1, 'ignite'), a.hp(B1), doubts.length]).toEqual([true, 95, 1]);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it("Cinders of Doubt: a fresh doubt at the end of each of the user's turns for 3 turns; Weakness and Vulnerable last 1 turn", () => {
    const a = arena({ p0: [['curse.phoenix']], p1: [['shot']] });
    const doubts = () => ['weakness', 'vulnerable', 'confusion'].filter((k) => a.has(B1, k)).length;
    a.use(A1, 'curse.phoenix', B1).end();
    const seen = [doubts()];
    for (let i = 0; i < 3; i++) {
      a.use(B1, 'shot', A1).end(); // their skill spends a Confusion; a Weakness or Vulnerable runs out
      seen.push(doubts());
      a.end();
      seen.push(doubts());
    }
    expect(seen).toEqual([1, 0, 1, 0, 1, 0, 0]);
  });

  it('Cinders of Doubt: no Ignite, no doubt', () => {
    const a = arena({ p0: [['curse.phoenix']], p1: [['shot']] });
    a.use(A1, 'curse.phoenix', B1).end();
    a.state.effects = a.state.effects.filter((e) => !(e.bearer === B1 && e.defId === 'ignite')); // put out on turn 2
    a.use(B1, 'shot', A1).end().end(); // turn 3 ends
    expect([a.has(B1, 'cinders_of_doubt'), ['weakness', 'vulnerable', 'confusion'].filter((k) => a.has(B1, k))]).toEqual([true, []]);
  });

  it('Sanctified Pyre: 20 damage; the pyre counts as Sanctify but heals no attacker', () => {
    const a = arena({ p0: [['smite.phoenix'], ['stab.holy']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.phoenix', B1).use(A2, 'stab.holy', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([100 - 20 - 20, 50]); // Piercing Light sees a Sanctified target
  });

  it('Sanctified Pyre: when it ends, they burn for 15 Affliction per direct hit taken meanwhile', () => {
    const a = arena({ p0: [['smite.phoenix'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.phoenix', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(50);
    a.end(); // it ends with the enemy's turn
    expect([a.hp(B1), a.has(B1, 'sanctified_pyre')]).toEqual([50 - 30, false]);
    const b = arena({ p0: [['smite.phoenix']], p1: [['shot']] });
    b.use(A1, 'smite.phoenix', B1).end().end();
    expect(b.hp(B1)).toBe(80); // no hits, no burn
  });

  it('Fanned Flames: 20 to the target and 15 to a random other enemy', () => {
    const a = arena({ p0: [['cleave.phoenix']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.phoenix', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'ignite')]).toEqual([80, 85, false]);
  });

  it('Fanned Flames: for 1 turn, each direct hit on either of them burns the other for 5', () => {
    const a = arena({ p0: [['cleave.phoenix'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.phoenix', B1).use(A2, 'shot', B1).use(A3, 'shot', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 65]); // B1: 20 + 15 + 5; B2: 15 + 5 + 15
    a.pass(1).use(A2, 'shot', B2).end(); // turn 3: the flames have died down
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'fanned_flames')]).toEqual([60, 50, false]);
  });

  it('Phoenix Cry: for 2 turns, an enemy who hits an ally of the user is Ignited, and the ally hit gains 1 Renew', () => {
    const a = arena({ p0: [['shout.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.phoenix').end();
    a.use(B1, 'shot', A2).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.stacks(A2, 'renew'), a.hp(A2)]).toEqual([true, false, 1, 85]);
    a.end(); // the Renew is the user's: it heals at the end of their turn
    expect(a.hp(A2)).toBe(90);
  });

  it('Phoenix Cry: after 2 turns, hits are free again', () => {
    const a = arena({ p0: [['shout.phoenix'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.phoenix').end().pass(4);
    a.use(B1, 'shot', A2).end();
    expect([a.has(B1, 'ignite'), a.has(A2, 'renew')]).toEqual([false, false]);
  });

  it("Blazing Challenge: Taunted for 1 turn; each hit from them on the user heals the user's other allies 10", () => {
    const a = arena({ p0: [['taunt.phoenix'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50).use(A1, 'taunt.phoenix', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([20, 60, 60]); // B2's hit doesn't count
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Blazing Challenge: once the Taunt is over, hits heal no one', () => {
    const a = arena({ p0: [['taunt.phoenix'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'taunt.phoenix', B1).end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A2)).toBe(50);
  });

  it('Undying Phoenix: Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.phoenix']], p1: [['curse']] });
    a.use(A1, 'titan.phoenix').end().use(B1, 'curse', A1).end();
    expect([a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([true, false]);
    a.pass(4);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Undying Phoenix: each direct hit gives the user 1 Renew per 10 damage', () => {
    const a = arena({ p0: [['titan.phoenix']], p1: [['strike'], ['shot']] });
    a.use(A1, 'titan.phoenix').end();
    a.use(B1, 'strike', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'renew')]).toEqual([65, 3]); // 20 → 2 Renew, 15 → 1
    a.end(); // the user's Renew heals at the end of their turn: 10 + 5
    expect(a.hp(A1)).toBe(80);
  });

  it('Undying Phoenix: never more than 3 Renew at a time', () => {
    const a = arena({ p0: [['titan.phoenix']], p1: [['strike'], ['strike'], ['smash']] });
    a.use(A1, 'titan.phoenix').end();
    a.use(B1, 'strike', A1).use(B2, 'strike', A1).use(B3, 'smash', A1).end();
    expect(a.stacks(A1, 'renew')).toBe(3); // 2, then 1 of the next 2, then none
  });

  it('Undying Phoenix: after 3 turns, hits give nothing', () => {
    const a = arena({ p0: [['titan.phoenix']], p1: [['strike']] });
    a.use(A1, 'titan.phoenix').end().pass(6);
    a.use(B1, 'strike', A1).end();
    expect(a.has(A1, 'renew')).toBe(false);
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
