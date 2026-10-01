// Spec-driven scenarios for the Dimension fusion (Shadow + Shadow): Banished, Entangled and all 30
// skills, from the in-game descriptions and docs/rules.md §21.10.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { redactEvents, viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type A = ReturnType<typeof arena>;

/** Banished on either side (`banished` on enemies, `banished_ally` on the user's side). */
const banished = (a: A, id: string) => a.has(id, 'banished') || a.has(id, 'banished_ally');
const entangled = (a: A, id: string) => a.has(id, 'entangled') || a.has(id, 'entangled_buffs');
const minionsOf = (a: A, owner: number, defId: string) =>
  a.state.units.filter((u) => u.owner === owner && u.defId === defId && u.alive);

describe('Dimension: cost and cooldown match the kit table', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 1], smash: ['Sr', 2], charge: ['S', 3], riposte: ['A', 3], rage: ['AA', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['r', 2], maneuver: ['r', 3], companion: ['A', 1],
    bolt: ['Ar', 1], blast: ['Irr', 2], consume: ['r', 2], summon: ['I', 1], channel: ['Ar', 3],
    stab: ['r', 0], ravage: ['Ar', 1], mislead: ['A', 2], stun: ['A', 2], dance: ['A', 3],
    heal: ['r', 1], bless: ['r', 2], curse: ['A', 2], smite: ['A', 1], prayer: ['Wrr', 2],
    cleave: ['S', 1], shout: ['Ar', 3], withstand: ['A', 3], taunt: ['r', 4], titan: ['AW', 4],
  };
  const minionKit: Record<string, [string, number]> = {
    void_stalker_tether: ['r', 0], void_stalker_rend: ['r', 0], rift_shunt: ['I', 0],
  };
  const norm = (c: Record<string, number | undefined>) =>
    Object.fromEntries(['S', 'A', 'I', 'W', 'r'].map((k) => [k, c[k] ?? 0]));
  const parse = (s: string) => {
    const c: Record<string, number> = {};
    for (const ch of s) c[ch] = (c[ch] ?? 0) + 1;
    return norm(c);
  };
  const all = { ...Object.fromEntries(Object.entries(kit).map(([k, v]) => [`${k}.dimension`, v])), ...minionKit };
  it.each(Object.entries(all))('%s', (id, [cost, cd]) => {
    const s = content.skills[id];
    expect(s, id).toBeDefined();
    expect(norm(s!.cost as unknown as Record<string, number>)).toEqual(parse(cost));
    expect(s!.cooldown).toBe(cd);
  });

  it('the kit has exactly the 30 archetypes', () => {
    const ids = Object.values(content.skills).filter((s) => s.element === 'Dimension' && s.archetype !== 'Minion');
    expect(ids.map((s) => s.id).sort()).toEqual(Object.keys(kit).map((k) => `${k}.dimension`).sort());
  });
});

describe('Banished', () => {
  it('a Banished ally (Implosion) can\'t be targeted by enemies and takes no damage from their AoE', () => {
    const a = arena({ p0: [['smash.dimension'], ['shot']], p1: [['shot', 'blast'], ['shot']] });
    a.use(A1, 'smash.dimension', B1).end();
    expect(banished(a, A1)).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 65]);
  });

  it('lasts until the end of the bearer\'s next turn: they can\'t act on it, and are back after', () => {
    const a = arena({ p0: [['smash.dimension', 'shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.dimension', B1).end().pass(1);
    // Turn 3: A1's next turn, still Banished.
    expect(banished(a, A1)).toBe(true);
    expect(a.reject(() => a.use(A1, 'shot', B1))).not.toBe(undefined);
    a.end();
    // Turn 4: back in the fight, targetable again.
    expect(banished(a, A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('can\'t be targeted by the bearer\'s own side either', () => {
    const a = arena({ p0: [['smash.dimension'], ['heal']], p1: [['shot']] });
    a.use(A1, 'smash.dimension', B1).end().pass(1);
    expect(banished(a, A1)).toBe(true);
    expect(a.reject(() => a.use(A2, 'heal', A1))).toBe('bad_target');
  });

  it('the bearer\'s effects neither tick nor count down while Banished', () => {
    const a = arena({ p0: [['smash.dimension'], ['shot']], p1: [['shot']] });
    a.give(A1, 'confusion', { duration: 3, source: B1 });
    a.use(A1, 'smash.dimension', B1).end();
    const d = a.effects(A1).find((e) => e.defId === 'confusion')!.duration;
    a.pass(2); // through A1's Banished turn
    expect(banished(a, A1)).toBe(false);
    expect(a.effects(A1).find((e) => e.defId === 'confusion')?.duration).toBe(d);
  });

  it('a Banished enemy\'s Renew-style ticks don\'t run (Ignite on them doesn\'t burn)', () => {
    // The enemy's Ignite ticks at the end of its applier's turn; while Banished it is frozen.
    const a = arena({ p0: [['strike.fire', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.fire', B1).end();
    const afterHit = a.hp(B1);
    a.give(B1, 'banished', { duration: 3, source: A1 });
    a.pass(1); // end of A's turn 3: Ignite would tick
    expect(a.hp(B1)).toBe(afterHit);
  });

  it('banishing interrupts the bearer\'s channels (Singularity on a Crossfolding enemy)', () => {
    const a = arena({ p0: [['channel.dimension'], ['shot'], ['shot']], p1: [['blast.dimension'], ['shot'], ['shot']] });
    a.setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'channel.dimension').end(); // tick 1: 10 to each enemy
    expect(a.hp(B2)).toBe(90);
    a.use(B1, 'blast.dimension').end(); // A1 has the most HP: Banished
    expect(banished(a, A1)).toBe(true);
    a.pass(4);
    expect(a.hp(B2)).toBe(90); // no further Crossfold ticks
  });

  it('on an enemy it\'s a Debuff: Immune stops it', () => {
    const a = arena({ p0: [['blast.dimension']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).give(B1, 'immune');
    a.use(A1, 'blast.dimension').end();
    expect(banished(a, B1)).toBe(false);
  });

  it('on the user\'s side it\'s a Buff (Implosion\'s Banish isn\'t blocked by the user\'s Immune)', () => {
    const a = arena({ p0: [['smash.dimension']], p1: [['shot']] });
    a.give(A1, 'immune');
    a.use(A1, 'smash.dimension', B1).end();
    expect(banished(a, A1)).toBe(true);
    const e = a.effects(A1).find((x) => x.defId === 'banished_ally' || x.defId === 'banished')!;
    expect(content.statuses[e.defId]?.kind).toBe('Buff');
  });
});

describe('Entangled', () => {
  it('an effect applied to one member lands once on each other member; damage does not spread', () => {
    const a = arena({ p0: [['bolt.dimension'], ['curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.dimension', B1).use(A2, 'curse', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
    expect([a.stacks(B1, 'confusion'), a.stacks(B2, 'confusion')]).toEqual([1, 1]);
  });

  it('links units on the same side only: the user\'s side is unaffected', () => {
    const a = arena({ p0: [['bolt.dimension'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.dimension', B1).end();
    expect([entangled(a, A1), entangled(a, A2), entangled(a, B1), entangled(a, B2)]).toEqual([false, false, true, true]);
  });

  it('no re-spreading: with three linked, each gets the effect exactly once', () => {
    const a = arena({ p0: [['shout.dimension'], ['curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'shout.dimension').end().pass(1).use(A2, 'curse', B1).end();
    expect([B1, B2, B3].map((u) => a.stacks(u, 'confusion'))).toEqual([1, 1, 1]);
  });

  // SPEC: ruling says a death "breaks the bearer out of the group" (survivors stay linked), the design doc says the link lasts "until one of them dies"; actual: the whole group's link ends.
  it.fails('a death breaks the bearer out of the group; the survivors stay linked', () => {
    const a = arena({ p0: [['shout.dimension'], ['curse'], ['strike']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'shout.dimension').end().pass(1);
    a.setHp(B3, 10).use(A3, 'strike', B3).use(A2, 'curse', B1).end();
    expect(a.unit(B3).alive).toBe(false);
    expect([a.stacks(B1, 'confusion'), a.stacks(B2, 'confusion')]).toEqual([1, 1]);
  });

  it('a link of 2 turns (Dark Matter) is gone by the user\'s third turn', () => {
    const a = arena({ p0: [['bolt.dimension'], ['curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.dimension', B1).end().pass(1);
    expect(entangled(a, B1)).toBe(true); // turn 3
    a.pass(2);
    expect([entangled(a, B1), entangled(a, B2)]).toEqual([false, false]); // turn 5
    a.use(A2, 'curse', B1).end();
    expect(a.stacks(B2, 'confusion')).toBe(0);
  });
});

describe('Dimension skills', () => {
  it('Folded Moment: 10 damage, and the user can still use a normal skill this turn', () => {
    const a = arena({ p0: [['strike.dimension', 'shot']], p1: [['shot']] });
    a.use(A1, 'strike.dimension', B1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 10 - 15);
    expect(a.cooldown(A1, 'strike.dimension')).toBeGreaterThan(0);
  });

  it('Folded Moment: without it, only one skill per unit can be queued', () => {
    const a = arena({ p0: [['shot', 'stab']], p1: [['shot']] });
    a.use(A1, 'shot', B1);
    expect(a.reject(() => a.use(A1, 'stab', B1))).not.toBe(undefined);
  });

  it('Folded Moment: CD 1, unusable on the user\'s next turn', () => {
    const a = arena({ p0: [['strike.dimension', 'shot']], p1: [['shot']] });
    a.use(A1, 'strike.dimension', B1).end().pass(1);
    expect(a.reject(() => a.use(A1, 'strike.dimension', B1))).not.toBe(undefined);
    a.pass(2).use(A1, 'strike.dimension', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Implosion: 30 to the target, 20 to their allies, then the user is Banished', () => {
    const a = arena({ p0: [['smash.dimension'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.dimension', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A2)]).toEqual([70, 80, 80, 100]);
    expect([banished(a, A1), banished(a, A2), banished(a, B1)]).toEqual([true, false, false]);
  });

  // BUG: Phase Lunge says the user gains Stealth at the start of their next turn; the pending effect expires at the end of the enemy turn and no Stealth is granted.
  it.fails('Phase Lunge: 15 Bypassing (through Invulnerable); Stealth arrives at the start of the user\'s next turn', () => {
    const a = arena({ p0: [['charge.dimension']], p1: [['shot']] });
    a.give(B1, 'invulnerable', { duration: 5 });
    a.use(A1, 'charge.dimension', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.has(A1, 'stealth')).toBe(false); // not yet
    a.end(); // enemy turn passes untargeted
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Phase Lunge: an enemy targeting the user first cancels the Stealth', () => {
    const a = arena({ p0: [['charge.dimension']], p1: [['shot']] });
    a.use(A1, 'charge.dimension', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    expect(a.has(A1, 'stealth')).toBe(false);
    a.pass(2);
    expect(a.has(A1, 'stealth')).toBe(false);
  });

  it('Pocket Dimension: counters the first Harmful skill on the user and Banishes its user; only the first', () => {
    const a = arena({ p0: [['riposte.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.dimension').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // only B2's shot landed
    expect([banished(a, B1), banished(a, B2)]).toEqual([true, false]);
  });

  it('Pocket Dimension: lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.dimension']], p1: [['shot']] });
    a.use(A1, 'riposte.dimension').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), banished(a, B1)]).toEqual([85, false]);
  });

  it('Void Walker: 1 Might and Immune for 3 turns; Stealthy', () => {
    const a = arena({ p0: [['rage.dimension']], p1: [['curse']] });
    a.give(A1, 'stealth', { duration: 3 }).use(A1, 'rage.dimension').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), a.has(A1, 'stealth')]).toEqual([1, true, true]);
    a.pass(4);
    expect([a.has(A1, 'might'), a.has(A1, 'immune')]).toEqual([true, true]); // turn 6: the 3rd enemy turn
    a.pass(1);
    expect([a.has(A1, 'might'), a.has(A1, 'immune')]).toEqual([false, false]);
  });

  it('Void Walker: a skill that ends the user\'s Stealth Blinds its enemy targets for 1 turn', () => {
    const a = arena({ p0: [['rage.dimension', 'shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stealth', { duration: 9 }).use(A1, 'rage.dimension').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect([a.has(A1, 'stealth'), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([false, true, false]);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Void Walker: no Blind when the skill doesn\'t end a Stealth', () => {
    const a = arena({ p0: [['rage.dimension', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.dimension').end().pass(1).use(A1, 'shot', B1).end();
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Echo Shard: 10 Piercing; an un-Entangled target is Entangled with a random ally for 2 turns', () => {
    const a = arena({ p0: [['shot.dimension']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'shot.dimension', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 100]);
    expect([entangled(a, B1), entangled(a, B2)]).toEqual([true, true]);
  });

  it('Echo Shard: an Entangled target\'s partners take it too', () => {
    const a = arena({ p0: [['shot.dimension']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'shot.dimension', B1).end().pass(1).use(A1, 'shot.dimension', B1).end();
    const partner = [B2, B3].find((u) => entangled(a, u))!;
    const other = [B2, B3].find((u) => u !== partner)!;
    expect([a.hp(B1), a.hp(partner), a.hp(other)]).toEqual([80, 90, 100]);
  });

  it('Through the Rift: 40 on the following turn, target hidden, and the user\'s Stealth survives', () => {
    const a = arena({ p0: [['snipe.dimension']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 3 }).use(A1, 'snipe.dimension', B1).end();
    expect(a.hp(B1)).toBe(100);
    const used = a.events.find((e) => e.t === 'skillUsed' && e.skill === 'snipe.dimension');
    expect(used && used.t === 'skillUsed' && used.secretFrom).toBe(1);
    expect(a.has(A1, 'stealth')).toBe(true);
    a.end();
    expect(a.hp(B1)).toBe(60);
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  // BUG: Event Horizon says the Helpful skill's target is Banished instead of helped; the skill is countered but nobody is Banished.
  it.fails('Event Horizon: the trapped enemy\'s first Helpful skill Banishes its target instead of helping', () => {
    const a = arena({ p0: [['trap.dimension'], ['shot']], p1: [['heal', 'bless'], ['shot'], ['shot']] });
    a.use(A1, 'trap.dimension', B1).use(A2, 'shot', B2).end();
    a.use(B1, 'heal', B2).end();
    expect([a.hp(B2), banished(a, B2)]).toEqual([85, true]);
    a.pass(1).use(B1, 'bless', B3).end(); // only the first
    expect([banished(a, B3), a.has(B3, 'might')]).toEqual([false, true]);
  });

  it('Event Horizon: Harmful skills are unaffected, and it stays armed for the first Helpful one', () => {
    const a = arena({ p0: [['trap.dimension']], p1: [['shot', 'heal'], ['shot']] });
    a.use(A1, 'trap.dimension', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), banished(a, A1)]).toEqual([85, false]);
    a.setHp(B2, 50).pass(1).use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(50); // not helped
  });

  it('Event Horizon: expires after 2 turns', () => {
    const a = arena({ p0: [['trap.dimension']], p1: [['heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'trap.dimension', B1).end().pass(4).use(B1, 'heal', B2).end();
    expect([a.hp(B2), banished(a, B2)]).toEqual([75, false]);
  });

  it('Step Between: the user is Banished, and so is the last enemy who damaged them', () => {
    const a = arena({ p0: [['maneuver.dimension']], p1: [['shot'], ['shot']] });
    a.end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    a.use(A1, 'maneuver.dimension').end();
    expect([banished(a, A1), banished(a, B1), banished(a, B2)]).toEqual([true, false, true]);
  });

  it('Step Between: with no last attacker, only the user is Banished', () => {
    const a = arena({ p0: [['maneuver.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.dimension').end();
    expect([banished(a, A1), banished(a, B1), banished(a, B2)]).toEqual([true, false, false]);
  });

  it('Void Stalker: a permanent 30 HP minion', () => {
    const a = arena({ p0: [['companion.dimension']], p1: [['shot']] });
    a.use(A1, 'companion.dimension').end();
    const [vs] = minionsOf(a, 0, 'void_stalker');
    expect(vs?.hp).toBe(30);
    a.pass(10);
    expect(minionsOf(a, 0, 'void_stalker')).toHaveLength(1);
  });

  it('Void Stalker Tether: the target and a random ally of theirs are Entangled for 2 turns', () => {
    const a = arena({ p0: [['companion.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.dimension').end().pass(1);
    const vs = minionsOf(a, 0, 'void_stalker')[0]!.id;
    a.use(vs, 'void_stalker_tether', B1).end();
    expect([entangled(a, B1), entangled(a, B2), a.hp(B1)]).toEqual([true, true, 100]);
    a.pass(4);
    expect([entangled(a, B1), entangled(a, B2)]).toEqual([false, false]);
  });

  it('Void Stalker Rend: 10 Piercing, and Entangled partners take it too', () => {
    const a = arena({ p0: [['companion.dimension']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'companion.dimension').end().pass(1);
    const vs = minionsOf(a, 0, 'void_stalker')[0]!.id;
    a.give(B1, 'armor', { stacks: 2 }).use(vs, 'void_stalker_rend', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 100, 100]); // not Entangled: only the target
    a.pass(1).use(vs, 'void_stalker_tether', B1).end().pass(1).use(vs, 'void_stalker_rend', B1).end();
    const partner = [B2, B3].find((u) => entangled(a, u))!;
    const other = [B2, B3].find((u) => u !== partner)!;
    expect([a.hp(B1), a.hp(partner), a.hp(other)]).toEqual([80, 90, 100]);
  });

  it('Dark Matter: Entangled with a random ally for 2 turns, 20 damage and Blinded for 2 turns (both are)', () => {
    const a = arena({ p0: [['bolt.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.dimension', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, true]);
    a.pass(2);
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, true]); // turn 4: the 2nd enemy turn
    a.pass(1);
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([false, false]);
  });

  it('Singularity: 25 to all enemies, then the one with the most HP is Banished', () => {
    const a = arena({ p0: [['blast.dimension']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 60).setHp(B3, 80);
    a.use(A1, 'blast.dimension').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([35, 75, 55]);
    expect([banished(a, B1), banished(a, B2), banished(a, B3)]).toEqual([false, true, false]);
    a.pass(1);
    expect(a.reject(() => a.use(A1, 'blast.dimension'))).toBe('on_cooldown'); // CD 2
    expect(banished(a, B2)).toBe(false); // it ended with B2's next turn
  });

  it('Singularity: the Banished enemy sits out its next turn and is back after it', () => {
    const a = arena({ p0: [['blast.dimension'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'blast.dimension').end();
    expect(banished(a, B1)).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // B1's next turn
    a.end();
    expect(banished(a, B1)).toBe(false); // back once that turn ended
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Sever: 5 Affliction to all; Blinded ones take 10 more and the Blind moves to an un-Blinded enemy', () => {
    const a = arena({ p0: [['consume.dimension']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'blinded', { source: A1, duration: 5 }).give(B2, 'shield', { value: 20 }).give(B2, 'armor', { stacks: 2 });
    a.use(A1, 'consume.dimension').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([85, 95, 95]);
    expect(a.has(B1, 'blinded')).toBe(false);
    expect([B2, B3].filter((u) => a.has(u, 'blinded'))).toHaveLength(1);
  });

  it('Sever: with no Blinded enemies, just 5 Affliction each and no Blind appears', () => {
    const a = arena({ p0: [['consume.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'consume.dimension').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([95, 95, false, false]);
  });

  it('Rift: a 20 HP minion for 3 turns', () => {
    const a = arena({ p0: [['summon.dimension']], p1: [['shot']] });
    a.use(A1, 'summon.dimension').end();
    expect(minionsOf(a, 0, 'rift')[0]?.hp).toBe(20);
    a.pass(4);
    expect(minionsOf(a, 0, 'rift')).toHaveLength(1);
    a.pass(1);
    expect(minionsOf(a, 0, 'rift')).toHaveLength(0);
  });

  it('Rift Shunt: Isolated for 1 turn, or Banished if they already were', () => {
    const a = arena({ p0: [['summon.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.dimension').end().pass(1);
    const rift = minionsOf(a, 0, 'rift')[0]!.id;
    a.use(rift, 'rift_shunt', B1).end();
    expect([a.has(B1, 'isolated'), banished(a, B1)]).toEqual([true, false]);
    a.give(B2, 'isolated', { duration: 9 }).pass(1).use(rift, 'rift_shunt', B2).end();
    expect(banished(a, B2)).toBe(true);
  });

  it('Rift Shunt: the Isolation lasts 1 turn', () => {
    const a = arena({ p0: [['summon.dimension']], p1: [['shot']] });
    a.use(A1, 'summon.dimension').end().pass(1);
    a.use(minionsOf(a, 0, 'rift')[0]!.id, 'rift_shunt', B1).end();
    expect(a.has(B1, 'isolated')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'isolated')).toBe(false);
  });

  it('Crossfold: 10 to all enemies at the end of each of the user\'s turns, for 3 turns', () => {
    const a = arena({ p0: [['channel.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.dimension').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(6);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });

  it('Crossfold: an ally\'s Debuff and an enemy\'s Buff trade places', () => {
    const a = arena({ p0: [['channel.dimension']], p1: [['shot']] });
    a.give(A1, 'weakness', { source: B1 }).give(B1, 'might');
    a.use(A1, 'channel.dimension').end();
    expect([a.has(A1, 'weakness'), a.has(A1, 'might'), a.has(B1, 'weakness'), a.has(B1, 'might')]).toEqual([false, true, true, false]);
  });

  it('Crossfold: ends if the user uses another skill', () => {
    const a = arena({ p0: [['channel.dimension', 'stab']], p1: [['shot']] });
    a.use(A1, 'channel.dimension').end().pass(1).use(A1, 'stab', B1).end().pass(4);
    expect(a.hp(B1)).toBe(100 - 10 - 10);
  });

  it('Unwatched Knife: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.dimension'], ['stab.dimension']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 61).setHp(B2, 60);
    a.use(A1, 'stab.dimension', B1).use(A2, 'stab.dimension', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([51, 40]);
  });

  // BUG: Unwatched Knife says knifing an Isolated target gives the user Stealth; no Stealth is gained.
  it.fails('Unwatched Knife: knifing an Isolated target gives Stealth; otherwise none', () => {
    const a = arena({ p0: [['stab.dimension'], ['stab.dimension']], p1: [['shot'], ['shot']] });
    a.give(B1, 'isolated', { duration: 5 });
    a.use(A1, 'stab.dimension', B1).use(A2, 'stab.dimension', B2).end();
    expect([a.has(A1, 'stealth'), a.has(A2, 'stealth')]).toEqual([true, false]);
  });

  it('Rend Space: 25 Piercing; Blind and Isolation on the target last 2 turns longer', () => {
    const a = arena({ p0: [['ravage.dimension']], p1: [['shot'], ['shot']] });
    a.give(B1, 'blinded', { duration: 2 }).give(B1, 'isolated', { duration: 2 }).give(B1, 'armor', { stacks: 2 });
    a.give(B2, 'blinded', { duration: 2 });
    a.use(A1, 'ravage.dimension', B1).end();
    expect(a.hp(B1)).toBe(75);
    // "2 turns" = 2 of each side's turns (the "for N turns" convention).
    expect(a.effects(B1).find((e) => e.defId === 'blinded')?.duration).toBe(1 + 4);
    expect(a.effects(B1).find((e) => e.defId === 'isolated')?.duration).toBe(1 + 4);
    expect(a.effects(B2).find((e) => e.defId === 'blinded')?.duration).toBe(1); // other enemies unaffected
  });

  it('Crossed Doors: a Harmful skill is countered; they and a random ally are Entangled, then Isolated (both)', () => {
    const a = arena({ p0: [['mislead.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.dimension', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && !e.revealed)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect([entangled(a, B1), entangled(a, B2), a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([true, true, true, true]);
    a.pass(1);
    expect([a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([false, false]);
  });

  it('Crossed Doors: Helpful skills go through, and it lasts only 1 turn', () => {
    const a = arena({ p0: [['mislead.dimension']], p1: [['heal', 'shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.dimension', B1).end().use(B1, 'heal', B2).end();
    expect([a.hp(B2), entangled(a, B1)]).toEqual([75, false]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), entangled(a, B1)]).toEqual([85, false]);
  });

  it('Phase Lock: 10 damage and Asleep (can\'t act)', () => {
    const a = arena({ p0: [['stun.dimension']], p1: [['shot']] });
    a.use(A1, 'stun.dimension', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([90, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Phase Lock: if damage wakes them, they\'re Banished instead', () => {
    const a = arena({ p0: [['stun.dimension', 'shot']], p1: [['shot']] });
    a.use(A1, 'stun.dimension', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'sleep'), banished(a, B1)]).toEqual([false, true]);
  });

  it('Phase Lock: Sleep from other sources still just wakes normally', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'sleep', { source: A1 }).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'sleep'), banished(a, B1)]).toEqual([false, false]);
  });

  // BUG: Unfold says the user gains Stealth when they return; they get Ghosted and Focus but no Stealth.
  it.fails('Unfold: the user is Banished; when they return they gain Stealth, Ghosted and 1 Focus for 2 turns', () => {
    const a = arena({ p0: [['dance.dimension']], p1: [['shot']] });
    a.use(A1, 'dance.dimension').end();
    expect([banished(a, A1), a.has(A1, 'stealth')]).toEqual([true, false]);
    a.pass(2); // end of A1's next turn: back
    expect([banished(a, A1), a.has(A1, 'stealth'), a.has(A1, 'ghosted'), a.stacks(A1, 'focus')]).toEqual([false, true, true, 1]);
    a.pass(4);
    expect([a.has(A1, 'ghosted'), a.has(A1, 'focus')]).toEqual([false, false]);
  });

  it('Safe Harbor: the ally is Banished; when they return they heal 30 and lose their Debuffs', () => {
    const a = arena({ p0: [['heal.dimension'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'confusion', { source: B1 }).give(A2, 'weakness', { source: B1 }).give(A2, 'might');
    a.use(A1, 'heal.dimension', A2).end();
    expect([banished(a, A2), a.hp(A2)]).toEqual([true, 50]);
    a.pass(2);
    expect([banished(a, A2), a.hp(A2), a.has(A2, 'confusion'), a.has(A2, 'weakness'), a.has(A2, 'might')]).toEqual([false, 80, false, false, true]);
  });

  it('Twin Veil: target ally and a random other ally are Entangled for 2 turns; the target gains Stealth (so the partner does too)', () => {
    const a = arena({ p0: [['bless.dimension'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.dimension', A2).end();
    expect([entangled(a, A1), entangled(a, A2), a.has(A2, 'stealth'), a.has(A1, 'stealth')]).toEqual([true, true, true, true]);
  });

  it('Twin Veil: exactly one other ally is linked; enemies are not', () => {
    const a = arena({ p0: [['bless.dimension'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.dimension', A2).end();
    expect([entangled(a, A2), a.has(A2, 'stealth'), entangled(a, B1)]).toEqual([true, true, false]);
    expect([A1, A3].filter((u) => entangled(a, u))).toHaveLength(1);
    a.pass(4);
    expect(entangled(a, A2)).toBe(false); // 2 turns
  });

  it('Tangled Fates: target and a random ally Entangled for 3 turns; each skill either uses gives both 1 Confusion', () => {
    const a = arena({ p0: [['curse.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.dimension', B1).end();
    expect([entangled(a, B1), entangled(a, B2)]).toEqual([true, true]);
    expect([a.stacks(B1, 'confusion'), a.stacks(B2, 'confusion')]).toEqual([0, 0]);
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'confusion'), a.stacks(B2, 'confusion')]).toEqual([1, 1]);
  });

  it('Tangled Fates: the partner using a skill also gives both 1 Confusion; the user\'s side is untouched', () => {
    const a = arena({ p0: [['curse.dimension', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.dimension', B1).end().use(B2, 'shot', A1).end();
    expect([a.stacks(B1, 'confusion'), a.stacks(B2, 'confusion'), a.stacks(A1, 'confusion')]).toEqual([1, 1, 0]);
  });

  it('Tangled Fates: the target and exactly one of their allies are linked', () => {
    const a = arena({ p0: [['curse.dimension']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'curse.dimension', B2).end();
    expect(entangled(a, B2)).toBe(true);
    expect([B1, B3].filter((u) => entangled(a, u))).toHaveLength(1);
  });

  it('Tangled Fates: the link lasts 3 turns', () => {
    const a = arena({ p0: [['curse.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.dimension', B1).end().pass(4);
    expect(entangled(a, B1)).toBe(true); // turn 6: the 3rd enemy turn
    a.pass(1);
    expect([entangled(a, B1), entangled(a, B2)]).toEqual([false, false]);
  });

  const brandThrough = (status: string) => {
    const a = arena({ p0: [['smite.dimension'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.dimension', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.give(B1, status, { duration: 9 }).pass(1);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  };

  it('Void Brand: 10 damage; the user\'s side can then target (and hit) them through Invulnerable', () => brandThrough('invulnerable'));

  // BUG: Void Brand says the user's side can target the bearer even if Stealthed; queueing on them is rejected (bad_target).
  it.fails('Void Brand: the user\'s side can target them through Stealth', () => brandThrough('stealth'));

  // BUG: Void Brand says the user's side can target the bearer even if Untargetable; queueing on them is rejected (bad_target).
  it.fails('Void Brand: the user\'s side can target them through Untargetable', () => brandThrough('untargetable'));

  it('Void Brand: without it, a Stealthed enemy can\'t be targeted; and it lasts 2 turns', () => {
    const a = arena({ p0: [['smite.dimension'], ['shot']], p1: [['shot']] });
    a.give(B1, 'stealth', { duration: 99 });
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('bad_target');
    const b = arena({ p0: [['smite.dimension'], ['shot']], p1: [['shot']] });
    b.use(A1, 'smite.dimension', B1).end();
    b.give(B1, 'stealth', { duration: 99 }).pass(5);
    expect(b.reject(() => b.use(A2, 'shot', B1))).toBe('bad_target');
  });

  it('Lifeline Weave: all allies heal 20 and are Entangled; only Buffs pass through the link', () => {
    const a = arena({ p0: [['prayer.dimension'], ['bless'], ['shot']], p1: [['curse']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'prayer.dimension').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([70, 70, 70]);
    a.use(B1, 'curse', A1).end();
    expect([a.has(A1, 'confusion'), a.has(A2, 'confusion'), a.has(A3, 'confusion')]).toEqual([true, false, false]);
    a.use(A2, 'bless', A1).end();
    expect([A1, A2, A3].map((u) => a.stacks(u, 'might'))).toEqual([1, 1, 1]);
  });

  it('Shear: 10 to all enemies, repeated at the start of the user\'s next turn if still Stealthed; Stealthy', () => {
    const a = arena({ p0: [['cleave.dimension']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stealth', { duration: 3 }).use(A1, 'cleave.dimension').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'stealth')]).toEqual([90, 90, true]);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Shear: no repeat when the user isn\'t Stealthed', () => {
    const a = arena({ p0: [['cleave.dimension']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.dimension').end().pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
  });

  it('Dislocation: all enemies Entangled together for 2 turns, then Blinded for 1 turn', () => {
    const a = arena({ p0: [['shout.dimension']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'shout.dimension').end();
    expect([B1, B2, B3].map((u) => entangled(a, u))).toEqual([true, true, true]);
    expect([B1, B2, B3].map((u) => a.has(u, 'blinded'))).toEqual([true, true, true]);
    expect([A1].map((u) => entangled(a, u))).toEqual([false]);
    a.pass(2);
    expect([B1, B2, B3].map((u) => a.has(u, 'blinded'))).toEqual([false, false, false]);
    expect(entangled(a, B1)).toBe(true);
  });

  it('Pocket Ward: 25 Shield; damage it absorbs becomes Shield on the ally with the least HP', () => {
    const a = arena({ p0: [['withstand.dimension'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).setHp(A3, 60);
    a.use(A1, 'withstand.dimension').end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    const sh = (u: string) => a.effects(u).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);
    expect([sh(A2), sh(A3)]).toEqual([15, 0]);
    a.pass(2); // that Shield lasts 1 turn
    expect(sh(A2)).toBe(0);
  });

  it('Pocket Ward: the Shield lasts 1 turn', () => {
    const a = arena({ p0: [['withstand.dimension']], p1: [['shot']] });
    a.use(A1, 'withstand.dimension').end().pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Pocket Arena: target is Taunted by the user; every other unit, minions included, is Banished', () => {
    const a = arena({ p0: [['companion.dimension', 'taunt.dimension'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'companion.dimension').end().pass(1);
    const vs = minionsOf(a, 0, 'void_stalker')[0]!.id;
    a.use(A1, 'taunt.dimension', B1).end();
    expect([A2, A3, B2, B3, vs].map((u) => banished(a, u))).toEqual([true, true, true, true, true]);
    expect([A1, B1].map((u) => banished(a, u))).toEqual([false, false]);
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(A1);
    expect(a.reject(() => a.use(B2, 'shot', A1))).not.toBe(undefined);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Pocket Arena: the Banish lasts the rest of this turn and the enemies\' next', () => {
    const a = arena({ p0: [['taunt.dimension'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.dimension', B1).end().end();
    expect([banished(a, A2), banished(a, B2), a.has(B1, 'taunt')]).toEqual([false, false, false]);
    a.use(A2, 'shot', B2).end();
    expect(a.hp(B2)).toBe(85);
  });

  it('Faceless Void: the user and the least-HP ally gain 2 Armor and Immune, lasting 3 turns', () => {
    const a = arena({ p0: [['titan.dimension'], ['shot']], p1: [['curse', 'shot']] });
    a.setHp(A2, 40).use(A1, 'titan.dimension').end();
    expect([entangled(a, A1), entangled(a, A2)]).toEqual([true, true]);
    expect([a.stacks(A1, 'armor'), a.stacks(A2, 'armor'), a.has(A1, 'immune'), a.has(A2, 'immune')]).toEqual([2, 2, true, true]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(35); // 15 − 2 Armor × 5
    a.pass(3);
    expect(a.has(A1, 'armor')).toBe(true); // turn 6: the 3rd enemy turn
    a.pass(1);
    expect([a.has(A1, 'armor'), a.has(A2, 'armor'), entangled(a, A1)]).toEqual([false, false, false]);
  });

  // BUG: Faceless Void says the user is Entangled with the one ally with the least HP; every ally is Entangled and gets the Armor and Immune.
  it.fails('Faceless Void: the user is Entangled with the least-HP ally, and both gain 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.dimension'], ['shot'], ['shot']], p1: [['curse']] });
    a.setHp(A2, 80).setHp(A3, 40);
    a.use(A1, 'titan.dimension').end();
    expect([entangled(a, A1), entangled(a, A2), entangled(a, A3)]).toEqual([true, false, true]);
    expect([a.stacks(A1, 'armor'), a.stacks(A3, 'armor'), a.stacks(A2, 'armor')]).toEqual([2, 2, 0]);
    expect([a.has(A1, 'immune'), a.has(A3, 'immune'), a.has(A2, 'immune')]).toEqual([true, true, false]);
    a.use(B1, 'curse', A3).end();
    expect(a.has(A3, 'confusion')).toBe(false);
    a.pass(5);
    expect([a.has(A1, 'armor'), a.has(A3, 'armor'), entangled(a, A1)]).toEqual([false, false, false]);
  });
});

// Keeps the imported redaction helper honest about the hidden Snipe target as seen by the opponent.
describe('Dimension visibility', () => {
  it('Through the Rift: the opponent doesn\'t see the target', () => {
    const a = arena({ p0: [['snipe.dimension']], p1: [['shot']] });
    a.use(A1, 'snipe.dimension', B1).end();
    const used = a.last.filter((e) => e.t === 'skillUsed');
    const theirs = redactEvents(used, 1)[0] as { targets?: string[] } | undefined;
    expect(theirs?.targets ?? []).toEqual([]);
  });
});
