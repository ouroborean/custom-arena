// Spec-driven tests for Ritual (Fire + Shadow): Rites and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.19, and the fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { formatCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const rites = (a: Arena, id: string) =>
  a.effects(id).filter((e) => e.defId === 'rite' || (e.inline?.countsAs ?? []).includes('rite'));
/** Steps left on the user's Rite (0 = no Rite). */
const rite = (a: Arena, id: string) => rites(a, id).reduce((n, e) => n + e.stacks, 0);
const shieldLeft = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => n + (e.defId === 'shield' || e.inline?.id === 'smokewall' ? e.value : 0), 0);

describe('Rite', () => {
  it('starting a Rite puts it on the user with N steps; the skill that starts it doesn\'t count', () => {
    const a = arena({ p0: [['strike.ritual']], p1: [['shot']] });
    a.use(A1, 'strike.ritual', B1).end();
    expect(rite(a, A1)).toBe(2);
    expect(rites(a, A1)).toHaveLength(1);
  });

  it('each skill the user uses is one step; the last step completes it with its effect', () => {
    const a = arena({ p0: [['strike.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.ritual', B1).end().pass(1);
    a.use(A1, 'shot', B1).end().pass(1);
    expect(rite(a, A1)).toBe(1);
    expect(a.hp(B2)).toBe(100);
    a.use(A1, 'shot', B1).end();
    expect(rite(a, A1)).toBe(0);
    expect(a.hp(B2)).toBe(90); // Sacrificial Blade's Rite: the target Explodes
  });

  it('enemy skills don\'t advance it', () => {
    const a = arena({ p0: [['strike.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.ritual', B1).end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(rite(a, A1)).toBe(2);
  });

  it('only one Rite at a time: starting another replaces it', () => {
    const a = arena({ p0: [['strike.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.ritual', B1).end().pass(1).use(A1, 'smash.ritual', B1).end();
    expect(rites(a, A1)).toHaveLength(1);
    expect(rite(a, A1)).toBe(3);
    expect(a.hp(B2)).toBe(90); // the Blade's Rite was replaced, not completed
  });

  it('gaining a Stun breaks it (no effect)', () => {
    const a = arena({ p0: [['strike.ritual', 'shot']], p1: [['stun'], ['shot']] });
    a.use(A1, 'strike.ritual', B1).end().use(B1, 'stun', A1).end();
    expect(rite(a, A1)).toBe(0);
    a.pass(2).use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B2)).toBe(100);
  });

  it('falling Asleep breaks it', () => {
    const a = arena({ p0: [['strike.ritual']], p1: [['stun.shadow']] });
    a.use(A1, 'strike.ritual', B1).end().use(B1, 'stun.shadow', A1).end(); // Sap: 10 damage, then Sleep
    expect(a.has(A1, 'sleep')).toBe(true);
    expect(rite(a, A1)).toBe(0);
  });

  it('Acolyte skills advance their summoner\'s Rite', () => {
    const a = arena({ p0: [['companion.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.ritual').end().pass(1);
    const ac = minions(a, 0, 'shadow_acolyte')[0]!;
    a.use(A1, 'smash.ritual', B1).end().pass(1);
    a.use(ac.id, 'acolyte_flame_lash', B1).end();
    expect(rite(a, A1)).toBe(2);
  });
});

describe('Ritual skills', () => {
  it('Sacrificial Blade: 25 damage', () => {
    const a = arena({ p0: [['strike.ritual']], p1: [['shot']] });
    a.use(A1, 'strike.ritual', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Circle of Ash: 20 to the target and 10 to the others; Rite (3)', () => {
    const a = arena({ p0: [['smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end();
    expect([a.hp(B1), a.hp(B2), rite(a, A1)]).toEqual([80, 90, 3]);
  });

  it('Circle of Ash: Rite (3) — every enemy is Ignited and Blinded for 2 turns', () => {
    const a = arena({ p0: [['smash.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end();
    for (let i = 0; i < 2; i++) a.pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'blinded')]).toEqual([false, false]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, true, true, true]);
    a.pass(2);
    expect(a.has(B2, 'blinded')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'blinded')).toBe(false);
  });

  it('Candlestep: 15 damage and 1 Focus', () => {
    const a = arena({ p0: [['charge.ritual']], p1: [['shot']] });
    a.use(A1, 'charge.ritual', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'focus')]).toEqual([85, 1]);
  });

  it('Candlestep: the user carries a flame: their next damaging skill Ignites what it hits', () => {
    const a = arena({ p0: [['charge.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.ritual', B1).end();
    expect(a.has(B1, 'ignite')).toBe(false); // the Candlestep itself doesn't Ignite
    a.pass(1).use(A1, 'smash.ritual', B2).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, true]);
  });

  it('Candlestep: only the next damaging skill Ignites', () => {
    const a = arena({ p0: [['charge.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.ritual', B1).end().pass(1).use(A1, 'shot', B1).end().pass(1);
    a.use(A1, 'shot', B2).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, false]);
  });

  it('Warding Candle: counters only the first Harmful skill on the user', () => {
    const a = arena({ p0: [['riposte.ritual']], p1: [['shot'], ['shot']] });
    expect(content.skills['riposte.ritual']!.tags).toContain('Invisible');
    a.use(A1, 'riposte.ritual').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Warding Candle: the user\'s Rite can\'t be broken (by a Stun) until the end of their next turn', () => {
    const a = arena({ p0: [['riposte.ritual', 'smash.ritual']], p1: [['shot'], ['stun']] });
    a.use(A1, 'smash.ritual', B1).end().pass(1).use(A1, 'riposte.ritual').end();
    expect(rite(a, A1)).toBe(2);
    a.use(B1, 'shot', A1).use(B2, 'stun', A1).end();
    expect(rite(a, A1)).toBe(2);
  });

  it('Bonfire Revel: the user is Immune, and every unit on both sides gains 2 Might for 3 turns', () => {
    const a = arena({ p0: [['rage.ritual'], ['shot']], p1: [['curse'], ['shot']] });
    a.use(A1, 'rage.ritual').end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    expect([A1, A2, B1, B2].map((u) => a.stacks(u, 'might'))).toEqual([2, 2, 2, 2]);
    expect([a.has(A2, 'immune'), a.has(B1, 'immune')]).toEqual([false, false]);
    a.pass(4);
    expect([A1, A2, B1, B2].map((u) => a.stacks(u, 'might'))).toEqual([0, 0, 0, 0]);
  });

  it('Severing Spark: 10 Piercing; a target with no Buffs is Isolated for 1 turn', () => {
    const a = arena({ p0: [['shot.ritual']], p1: [['shot'], ['heal']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B1, 'vulnerable', { source: A1 });
    a.use(A1, 'shot.ritual', B1).end();
    expect(a.hp(B1)).toBe(85); // 10 + 5 Vulnerable; Armor (a Buff) doesn't stop Piercing
    expect(a.has(B1, 'isolated')).toBe(false); // it has a Buff (Armor)
    const b = arena({ p0: [['shot.ritual']], p1: [['shot'], ['heal']] });
    b.use(A1, 'shot.ritual', B1).end();
    expect(b.has(B1, 'isolated')).toBe(true);
    expect(b.reject(() => b.use(B2, 'heal', B1))).toBe('bad_target');
  });

  it('Far Invocation: nothing until its Rite (2) completes: 50 damage, Bypassing Invulnerable, and Ignite', () => {
    const a = arena({ p0: [['snipe.ritual', 'shot']], p1: [['shot'], ['shot']] });
    expect(content.skills['snipe.ritual']!.tags).toContain('HiddenTarget');
    a.use(A1, 'snipe.ritual', B1).end();
    expect([a.hp(B1), rite(a, A1)]).toEqual([100, 2]);
    a.pass(1).use(A1, 'shot', B2).end().pass(1);
    a.give(B1, 'invulnerable', { source: B1, duration: 4 });
    a.use(A1, 'shot', B2).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([45, true]);
  });

  it('Chains of Smoke: for 2 turns, each Harmful skill the target uses deals them 10 Affliction and advances the user\'s Rite', () => {
    const a = arena({ p0: [['trap.ritual', 'smash.ritual']], p1: [['shot', 'heal'], ['shot']] });
    expect(content.skills['trap.ritual']!.tags).toContain('Invisible');
    a.give(B1, 'armor', { stacks: 4 });
    a.use(A1, 'trap.ritual', B1).end().use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100); // Helpful: no trigger; B2 isn't trapped
    a.use(A1, 'smash.ritual', B2).end(); // Rite (3)
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), rite(a, A1)]).toEqual([90, 2]);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 6: over
    expect([a.hp(B1), rite(a, A1)]).toEqual([90, 2]);
  });

  it('Hush of Smoke: Stealthy; Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.ritual']], p1: [['shot']] });
    expect(content.skills['maneuver.ritual']!.tags).toContain('Stealthy');
    a.use(A1, 'maneuver.ritual').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Hush of Smoke: each enemy who uses a Harmful skill meanwhile is Blinded for 1 turn', () => {
    const a = arena({ p0: [['maneuver.ritual'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.ritual').end().use(B1, 'shot', A2).end();
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, false]);
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(true); // through their next turn
    a.use(B2, 'shot', A2).end(); // turn 4: the Hush is over
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([false, false]);
  });

  it('Shadow Acolyte: a permanent 30 HP minion; Chant heals an ally 10, Flame Lash deals 10 and Ignites', () => {
    const a = arena({ p0: [['companion.ritual'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.ritual').end().pass(1);
    const ac = minions(a, 0, 'shadow_acolyte')[0]!;
    expect(ac.hp).toBe(30);
    a.setHp(A2, 50).use(ac.id, 'acolyte_chant', A2).end();
    expect(a.hp(A2)).toBe(60);
    a.pass(1).use(ac.id, 'acolyte_flame_lash', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([85, true]);
    a.pass(10);
    expect(a.unit(ac.id).alive).toBe(true);
  });

  it('Shadow Acolyte: Chant advances its summoner\'s Rite too', () => {
    const a = arena({ p0: [['companion.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.ritual').end().pass(1);
    const ac = minions(a, 0, 'shadow_acolyte')[0]!;
    a.use(A1, 'smash.ritual', B1).end().pass(1).use(ac.id, 'acolyte_chant', A1).end();
    expect(rite(a, A1)).toBe(2);
  });

  it('Shadowflame Bolt: 20 damage and Blinded for 2 turns', () => {
    const a = arena({ p0: [['bolt.ritual']], p1: [['shot']] });
    a.use(A1, 'bolt.ritual', B1).end();
    expect([a.hp(B1), a.has(B1, 'blinded')]).toEqual([80, true]);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Shadowflame Bolt (simplified): each skill the Blinded target uses Ignites them', () => {
    const a = arena({ p0: [['bolt.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.ritual', B1).end();
    expect(a.has(B1, 'ignite')).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, false]);
  });

  it('Rite of Ruin: 20 to all enemies; Rite (3) — each enemy takes 10 Affliction per skill they used while it counted', () => {
    const a = arena({ p0: [['blast.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.ritual').end();
    a.use(B1, 'shot', A1).end(); // B1: 1 skill; B2: none
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end();
    a.use(B1, 'shot', A1).end(); // B1: 2 skills
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 80]);
    a.use(A1, 'shot', B1).end(); // completes
    expect([a.hp(B1), a.hp(B2)]).toEqual([35 - 20, 80]);
  });

  it('Candle Offering: 5 damage healing the user; without a Rite they heal 15 more', () => {
    const a = arena({ p0: [['consume.ritual']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.ritual', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([70, 95]);
  });

  it('Candle Offering: with a Rite, it advances it by 1 more (and no extra healing)', () => {
    const a = arena({ p0: [['consume.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end().pass(1);
    a.setHp(A1, 50).use(A1, 'consume.ritual', B1).end();
    // Rite (3): the Offering is one step as a skill, and its advance another.
    expect([rite(a, A1), a.hp(A1)]).toEqual([1, 55]);
  });

  it('Candle Offering: an advance that finishes the Rite completes it', () => {
    const a = arena({ p0: [['consume.ritual', 'smash.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end().pass(1).use(A1, 'shot', B1).end().pass(1);
    a.use(A1, 'consume.ritual', B1).end();
    expect(rite(a, A1)).toBe(0);
    expect([a.has(B1, 'ignite'), a.has(B2, 'blinded')]).toEqual([true, true]); // Circle of Ash
  });

  it('Tended Wick: a 15 HP Wick for 3 turns that deals 10 to a random enemy at the end of each of your turns, doubling', () => {
    const a = arena({ p0: [['summon.ritual']], p1: [['shot']] });
    a.use(A1, 'summon.ritual').end();
    const wk = minions(a, 0, 'tended_wick')[0]!;
    expect(wk.hp).toBe(15);
    expect(a.hp(B1)).toBe(90);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(30);
    a.pass(1);
    expect(a.unit(wk.id).alive).toBe(false);
  });

  it('Tended Wick: any damage to it resets it to 10', () => {
    const a = arena({ p0: [['summon.ritual']], p1: [['shot']] });
    a.use(A1, 'summon.ritual').end();
    const wk = minions(a, 0, 'tended_wick')[0]!;
    a.setHp(wk.id, 15).give(wk.id, 'shield', { value: 50 });
    a.use(B1, 'shot', wk.id).end().pass(1);
    expect(a.hp(B1)).toBe(80); // 10, then 10 again (not 20)
  });

  it('Dark Liturgy: 10 to all enemies at the end of each of the user\'s turns, for 3 turns', () => {
    const a = arena({ p0: [['channel.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.ritual').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(4);
    expect(a.hp(B2)).toBe(70);
    a.pass(2);
    expect(a.hp(B2)).toBe(70);
  });

  it('Dark Liturgy: while it lasts the user can\'t be put to Sleep', () => {
    const a = arena({ p0: [['channel.ritual']], p1: [['stun.shadow'], ['shot']] });
    a.use(A1, 'channel.ritual').end().use(B1, 'stun.shadow', A1).end();
    expect(a.has(A1, 'sleep')).toBe(false);
  });

  it('Dark Liturgy: while it lasts the user can\'t be Stunned', () => {
    const a = arena({ p0: [['channel.ritual']], p1: [['stun'], ['shot']] });
    a.use(A1, 'channel.ritual').end().use(B1, 'stun', A1).end();
    expect(a.has(A1, 'stun') || a.has(A1, 'stun_ns')).toBe(false);
    a.pass(1);
    expect(a.hp(B2)).toBe(80); // still channeling
  });

  it('Dark Liturgy: each tick advances the user\'s Rite by 1', () => {
    const a = arena({ p0: [['channel.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end().pass(1);
    a.use(A1, 'channel.ritual').end(); // the use is a step, and so is the tick
    expect(rite(a, A1)).toBe(1);
  });

  it('Ritual Knife: 10 damage with no Rite', () => {
    const a = arena({ p0: [['stab.ritual']], p1: [['shot']] });
    a.use(A1, 'stab.ritual', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Ritual Knife: 25 if it\'s the skill that completes the user\'s Rite', () => {
    const a = arena({ p0: [['stab.ritual', 'strike.ritual', 'shot']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'strike.ritual', B2).end().pass(1);
    a.use(A1, 'shot', B2).end().pass(1);
    a.use(A1, 'stab.ritual', B1).end();
    expect(a.hp(B1)).toBe(200 - 25 - 10); // 25, plus the Blade's Explosion
  });

  it('Ritual Knife: a Knife that doesn\'t complete the Rite deals only 10', () => {
    const a = arena({ p0: [['stab.ritual', 'strike.ritual']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'strike.ritual', B2).end().pass(1);
    a.use(A1, 'stab.ritual', B1).end();
    expect(rite(a, A1)).toBe(1);
    expect(a.hp(B1)).toBe(190);
  });

  it('Flashpoint: 20 Piercing and the target is Ignited, then every Ignite on the enemy team burns once now (not the user\'s team\'s)', () => {
    const a = arena({ p0: [['ravage.ritual'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).give(B2, 'ignite', { source: B2 });
    a.give(A2, 'ignite', { source: B1 });
    a.use(A1, 'ravage.ritual', B1).end();
    expect(a.has(B1, 'ignite')).toBe(true);
    // B1: 20 (Armor doesn't stop Piercing), its new Ignite burns now, then ticks at the end of the turn.
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([70, 95, 100]);
  });

  it('Circle of Warding: counters the target\'s Harmful skill and completes the user\'s Rite at once', () => {
    const a = arena({ p0: [['mislead.ritual', 'smash.ritual'], ['shot']], p1: [['shot'], ['shot']] });
    expect(content.skills['mislead.ritual']!.tags).toContain('Invisible');
    a.use(A1, 'smash.ritual', B1).end().pass(1).use(A1, 'mislead.ritual', B1).end();
    expect(rite(a, A1)).toBe(2);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), rite(a, A1), a.has(B1, 'ignite'), a.has(B2, 'blinded')]).toEqual([100, 0, true, true]);
  });

  it('Circle of Warding: Helpful skills pass, and the Rite is untouched', () => {
    const a = arena({ p0: [['mislead.ritual', 'smash.ritual']], p1: [['heal'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end().pass(1).use(A1, 'mislead.ritual', B1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), rite(a, A1)]).toEqual([100, 2]);
  });

  it('Waking Hex: 10 damage; the next damage within 2 turns Stuns them for 1 turn', () => {
    const a = arena({ p0: [['stun.ritual'], ['shot']], p1: [['shot']] });
    a.use(A1, 'stun.ritual', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.use(B1, 'shot', A1); // not stunned by the Hex's own hit
    a.end().use(A2, 'shot', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Waking Hex: no stun after the 2 turns', () => {
    const a = arena({ p0: [['stun.ritual'], ['shot']], p1: [['shot']] });
    a.use(A1, 'stun.ritual', B1).end().pass(3).use(A2, 'shot', B1).end();
    a.use(B1, 'shot', A1);
  });

  it('Dance of Candles: 1 Swiftness and 1 Focus; each skill advances the Rite by 1 more', () => {
    const a = arena({ p0: [['dance.ritual', 'smash.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.ritual').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    a.pass(1).use(A1, 'smash.ritual', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect(rite(a, A1)).toBe(1);
  });

  it('Rite of Mending: target ally heals 15; Rite (2): all allies heal 25', () => {
    const a = arena({ p0: [['heal.ritual', 'shot'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'heal.ritual', A2).end();
    expect([a.hp(A2), a.hp(A3)]).toEqual([65, 50]);
    a.pass(1).use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(A2), a.hp(A3)]).toEqual([90, 75]);
  });

  it('Double Wick: the ally Ignites each enemy they damage', () => {
    const a = arena({ p0: [['bless.ritual'], ['smash']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.ritual', A2).use(A2, 'smash', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, true]);
    expect(a.effects(B1).find((e) => e.defId === 'ignite')!.source).toBe(A2);
  });

  it('Double Wick: Ignites the ally applies can stack, up to 2', () => {
    const a = arena({ p0: [['bless.ritual'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.ritual', A2).use(A2, 'shot', B1).end().pass(1);
    a.use(A2, 'shot', B1);
    const hp = a.hp(B1);
    a.end();
    expect(a.stacks(B1, 'ignite')).toBe(2);
    expect(hp - a.hp(B1)).toBe(15 + 2 * 5);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.stacks(B1, 'ignite')).toBe(2); // no more than 2
  });

  it('Double Wick: lasts 2 turns', () => {
    const a = arena({ p0: [['bless.ritual'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.ritual', A2).end().pass(3);
    a.use(A2, 'shot', B2).end();
    expect(a.has(B2, 'ignite')).toBe(false);
  });

  it('Double Wick: without it, a second Ignite just refreshes the first', () => {
    const a = arena({ p0: [['shot'], ['strike.phoenix']], p1: [['shot']] });
    a.use(A2, 'strike.phoenix', B1).end().pass(1).use(A2, 'strike.phoenix', B1).end();
    expect(a.effects(B1).filter((e) => e.defId === 'ignite').reduce((n, e) => n + e.stacks, 0)).toBe(1);
  });

  it('Rite of Blindness: Blinded for 2 turns; Rite (2): every enemy is Blinded for 2 turns and Scorched', () => {
    const a = arena({ p0: [['curse.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.ritual', B1).end();
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, false]);
    a.pass(1).use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B2, 'blinded'), a.has(B1, 'scorched'), a.has(B2, 'scorched')]).toEqual([true, true, true]);
  });

  it('Veilbrand: 15 damage and Sanctify for 2 turns', () => {
    const a = arena({ p0: [['smite.ritual'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.ritual', B1).use(A2, 'shot', B1).end();
    // B1: 15 + 15, then the new Ignite's tick. A2 heals 15 from Sanctify.
    expect([a.hp(B1), a.hp(A2)]).toEqual([65, 65]);
    a.pass(2);
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Veilbrand: a target that isn\'t Ignited becomes Ignited (and isn\'t Blinded)', () => {
    const a = arena({ p0: [['smite.ritual']], p1: [['shot']] });
    a.use(A1, 'smite.ritual', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B1, 'blinded')]).toEqual([true, false]);
  });

  it('Veilbrand: an Ignited target is Blinded for 1 turn', () => {
    const a = arena({ p0: [['smite.ritual']], p1: [['shot']] });
    a.give(B1, 'ignite', { source: B1 });
    a.use(A1, 'smite.ritual', B1).end();
    expect(a.has(B1, 'blinded')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Veilbrand: its own Ignite makes the next use Blind', () => {
    const a = arena({ p0: [['smite.ritual']], p1: [['shot']] });
    a.use(A1, 'smite.ritual', B1).end().pass(3);
    a.use(A1, 'smite.ritual', B1).end();
    expect(a.has(B1, 'blinded')).toBe(true);
  });

  it('Vigil of Candles: all allies heal 20; Rite (3)', () => {
    const a = arena({ p0: [['prayer.ritual'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.ritual').end();
    expect([a.hp(A1), a.hp(A2), rite(a, A1)]).toEqual([70, 70, 3]);
  });

  it('Vigil of Candles: Rite (3) — every ally who hasn\'t taken damage since it started heals 30 and gains Stealth', () => {
    const a = arena({ p0: [['prayer.ritual', 'shot'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 50);
    a.use(A1, 'prayer.ritual').end(); // 70 / 70
    a.use(B1, 'shot', A3).end(); // A3 took damage: 55
    a.use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(A2), a.has(A2, 'stealth')]).toEqual([100, true]);
    expect([a.hp(A3), a.has(A3, 'stealth')]).toEqual([55, false]);
  });

  it('Cinder Tether: 20 and 15; until the user\'s next turn, healing either receives is dealt to the other instead', () => {
    const a = arena({ p0: [['cleave.ritual']], p1: [['heal'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'cleave.ritual', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([30, 85]);
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([30, 60]);
  });

  it('Cinder Tether: over by the user\'s next turn', () => {
    const a = arena({ p0: [['cleave.ritual']], p1: [['heal'], ['shot']] });
    a.use(A1, 'cleave.ritual', B1).end().pass(2).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 85]);
  });

  it('Invocation: all enemies Intimidated for 2 turns; the Rite advances 1 per Blinded or Ignited enemy', () => {
    const run = (afflicted: boolean) => {
      const a = arena({ p0: [['shout.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
      a.use(A1, 'smash.ritual', B1).end().pass(1);
      if (afflicted) a.give(B1, 'blinded', { source: A1, duration: 4 });
      a.use(A1, 'shout.ritual').end();
      expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
      return rite(a, A1);
    };
    expect([run(false), run(true)]).toEqual([2, 1]);
  });

  it('Smokewall: 20 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.ritual']], p1: [['shot']] });
    a.use(A1, 'withstand.ritual').end();
    expect(shieldLeft(a, A1)).toBe(20);
    a.pass(1);
    expect(shieldLeft(a, A1)).toBe(0);
  });

  it('Smokewall: each enemy who damages it is Ignited', () => {
    const a = arena({ p0: [['withstand.ritual']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'withstand.ritual').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    // 15 absorbed, then the last 5 absorbed: both hit it. B3 didn't.
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.has('p1c2', 'ignite')]).toEqual([true, true, false]);
    expect(a.hp(A1)).toBe(90);
  });

  it('Effigy: creates a 10 HP Effigy and Taunts the target to it for 1 turn', () => {
    const a = arena({ p0: [['taunt.ritual']], p1: [['shot']] });
    a.use(A1, 'taunt.ritual', B1).end();
    const ef = minions(a, 0, 'effigy')[0]!;
    expect(ef.hp).toBe(10);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B1, 'shot', ef.id).end();
    expect(a.unit(ef.id).alive).toBe(false);
  });

  it('Effigy: if it\'s destroyed, the user\'s Rite completes at once', () => {
    const a = arena({ p0: [['taunt.ritual', 'smash.ritual']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ritual', B1).end().pass(1).use(A1, 'taunt.ritual', B1).end();
    expect(rite(a, A1)).toBe(2);
    a.use(B1, 'shot', minions(a, 0, 'effigy')[0]!.id).end();
    expect([rite(a, A1), a.has(B1, 'ignite'), a.has(B2, 'blinded')]).toEqual([0, true, true]);
  });

  it('Avatar of the Rite: 3 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.ritual']], p1: [['curse']] });
    a.use(A1, 'titan.ritual').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'confusion')]).toEqual([3, false]);
    a.pass(4);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('Avatar of the Rite: a Rite completing meanwhile takes effect twice', () => {
    const a = arena({ p0: [['titan.ritual', 'strike.ritual', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.ritual', B1).end().pass(1).use(A1, 'titan.ritual').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B2)).toBe(80); // the target Explodes twice
  });
});

describe('Ritual costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['A', 3], rage: ['S', 3],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['r', 2], maneuver: ['r', 3], companion: ['S', 1],
    bolt: ['Ar', 1], blast: ['Irr', 2], consume: ['r', 2], summon: ['I', 1], channel: ['Sr', 3],
    stab: ['r', 0], ravage: ['Ar', 1], mislead: ['S', 2], stun: ['A', 3], dance: ['A', 3],
    heal: ['r', 1], bless: ['r', 2], curse: ['A', 2], smite: ['S', 1], prayer: ['Wrr', 2],
    cleave: ['S', 1], shout: ['Sr', 3], withstand: ['A', 1], taunt: ['r', 2], titan: ['SW', 4],
  };
  it.each(Object.entries(kit))('%s.ritual', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.ritual`]!;
    expect([formatCost(s.cost), s.cooldown]).toEqual([cost, cd]);
  });
  it('minion skills: Chant and Flame Lash cost r', () => {
    expect([formatCost(content.skills.acolyte_chant!.cost), formatCost(content.skills.acolyte_flame_lash!.cost)]).toEqual(['r', 'r']);
  });
});
