// Spec-driven tests for the Ninja fusion (Wind + Shadow): Shadow Clones, Substitution, Flurry and all 30 variants.
// Sources: skill/status descriptions and glossary, docs/rules.md §21.45, and the wind-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Flurry is a fusion passive every character with a Ninja skill carries (§21.0), so skill numbers include it.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const FLURRY = { p0c0: ['ninja_flurry'] };

const key = (e: { inline?: { id: string }; defId: string }) => (e.inline ? e.inline.id : e.defId);
const find = (a: Arena, id: string, k: string) => a.effects(id).find((e) => key(e) === k);
const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const clones = (a: Arena) => minions(a, 0, 'shadow_clone');
const seen = (a: Arena, p: 0 | 1, bearer: string, k: string) =>
  viewFor(content, a.state, p).effects.some((e) => e.bearer === bearer && key(e) === k);
/** Gives A1 `n` Clones through Shadow Doubles (summon.ninja, needs it in A1's kit), and passes back to A1. */
const doubles = (a: Arena) => a.use(A1, 'summon.ninja').end().pass(1);

describe('Ninja keywords', () => {
  it('Shadow Clone: a 5 HP minion, at most 3', () => {
    const a = arena({ p0: [['summon.ninja', 'dance.ninja']], p1: [['withstand']] });
    doubles(a);
    expect(clones(a).map((c) => c.hp)).toEqual([5, 5, 5]);
    a.use(A1, 'dance.ninja').end();
    expect(clones(a)).toHaveLength(3);
  });

  it('Shadow Clone: lasts until hit', () => {
    const a = arena({ p0: [['summon.ninja']], p1: [['shot']] });
    a.use(A1, 'summon.ninja').end();
    a.use(B1, 'shot', clones(a)[0]!.id).end();
    expect(clones(a)).toHaveLength(2);
    a.pass(10);
    expect(clones(a)).toHaveLength(2);
  });

  it('Substitution: the first single-target enemy skill on the Ninja each turn hits a Clone instead', () => {
    const a = arena({ p0: [['summon.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.ninja').end();
    expect(a.has(A1, 'substitution')).toBe(true);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), clones(a).length]).toEqual([85, 2]);
    a.pass(1).use(B1, 'shot', A1).end(); // works again next turn
    expect([a.hp(A1), clones(a).length]).toEqual([85, 1]);
  });

  it('Substitution: multi-target skills aren\'t substituted', () => {
    const a = arena({ p0: [['summon.ninja']], p1: [['blast']] });
    a.use(A1, 'summon.ninja').end().use(B1, 'blast').end();
    expect(a.hp(A1)).toBe(65);
  });

  it('Substitution: with no Clones left, hits land on the Ninja', () => {
    const a = arena({ p0: [['strike.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.ninja', B1).end(); // 1 Clone
    a.use(B1, 'shot', A1).end().pass(1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), clones(a).length, a.has(A1, 'substitution')]).toEqual([85, 0, false]);
  });

  it('Flurry: each Harmful skill deals each enemy it hits 5 Piercing per Clone', () => {
    const a = arena({ p0: [['summon.ninja', 'shot', 'blast']], p1: [['withstand'], ['withstand']], passives: FLURRY });
    doubles(a);
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100 - 0 - 15, 100]); // Shot 15 − 15 Armor, Flurry 3×5 Piercing
    a.pass(1).use(A1, 'blast').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85 - 20 - 15, 100 - 35 - 15]);
  });

  it('Flurry: no Clones, no Flurry; Helpful skills don\'t Flurry', () => {
    const a = arena({ p0: [['shot', 'withstand']], p1: [['withstand']], passives: FLURRY });
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
    const b = arena({ p0: [['summon.ninja', 'withstand']], p1: [['withstand']], passives: FLURRY });
    doubles(b);
    b.use(A1, 'withstand').end();
    expect(b.hp(B1)).toBe(100);
  });

  it('Flurry: it\'s not direct — it doesn\'t spend a Mark', () => {
    const a = arena({ p0: [['summon.ninja', 'withstand'], ['mislead']], p1: [['withstand']], passives: FLURRY });
    doubles(a);
    a.give(B1, 'mark', { source: A1, duration: 4 }).use(A1, 'withstand').end();
    expect(a.has(B1, 'mark')).toBe(true);
  });

  it('Flurry: a character with a Ninja skill carries it from the start (no passive given by hand)', () => {
    const a = arena({ p0: [['summon.ninja', 'shot'], ['shot']], p1: [['withstand']] });
    expect([a.has(A1, 'ninja_flurry'), a.has(A2, 'ninja_flurry')]).toEqual([true, false]);
    doubles(a);
    a.use(A1, 'shot', B1).use(A2, 'shot', B1).end(); // only the Ninja's own skills Flurry
    expect(a.hp(B1)).toBe(100 - 15 - 15 - 15);
  });

  it('Substitution: a single Clone takes the first single-target skill, the second lands', () => {
    const a = arena({ p0: [['strike.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.ninja', B1).end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), clones(a).length]).toEqual([85, 0]);
  });
});

describe('Ninja skills', () => {
  it('Twin Strike: 20, and a Clone if the user has none', () => {
    const a = arena({ p0: [['strike.ninja']], p1: [['withstand']] });
    a.use(A1, 'strike.ninja', B1).end();
    expect([a.hp(B1), clones(a).length]).toEqual([75, 1]); // 20, then Flurry from the new Clone
    a.pass(1).use(A1, 'strike.ninja', B1).end();
    expect(clones(a)).toHaveLength(1);
  });

  it('Whirlwind of Blades: under 3 Clones, creates one', () => {
    const a = arena({ p0: [['smash.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'smash.ninja', B1).end();
    expect([a.hp(B1), clones(a).length]).toEqual([75, 1]); // 20 + Flurry
  });

  it('Whirlwind of Blades: 20 to the target and 10 to the others, each Flurried', () => {
    const a = arena({ p0: [['smash.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'smash.ninja', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Whirlwind of Blades: at 3 Clones, each is destroyed and deals 10 to a random enemy', () => {
    const a = arena({ p0: [['smash.ninja', 'summon.ninja']], p1: [['withstand']] });
    doubles(a);
    a.use(A1, 'smash.ninja', B1).end();
    expect([a.hp(B1), clones(a).length]).toEqual([100 - 20 - 30, 0]);
  });

  it('Blur: the user creates a Clone and is blurred (Helpful: no Flurry, no Rushing)', () => {
    const a = arena({ p0: [['charge.ninja']], p1: [['withstand']] });
    a.use(A1, 'charge.ninja').end();
    expect([clones(a).length, a.has(A1, 'blur'), a.has(A1, 'rushing'), a.hp(B1)]).toEqual([1, true, false, 100]);
  });

  it('Blur: the user\'s next Harmful skill Flurries twice; the one after, once again', () => {
    const a = arena({ p0: [['charge.ninja', 'shot']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'charge.ninja').end().pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'blur')]).toEqual([100 - 15 - 10, false]); // 1 Clone, counted twice
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75 - 15 - 5);
  });

  it('Log Trick: invisible; counters the first Harmful skill, makes a Clone, and every Clone strikes for 10 Piercing', () => {
    const a = arena({ p0: [['riposte.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.ninja').end();
    expect([seen(a, 0, A1, 'log_trick'), seen(a, 1, A1, 'log_trick')]).toEqual([true, false]);
    a.give(B1, 'armor', { stacks: 3 }).use(B1, 'shot', A1).end();
    expect([a.hp(A1), clones(a).length, a.hp(B1)]).toEqual([100, 1, 90]);
  });

  it('Log Trick: only the first is countered; it ends after 1 turn', () => {
    const a = arena({ p0: [['riposte.ninja']], p1: [['shot'], ['blast']] });
    a.use(A1, 'riposte.ninja').end().use(B1, 'shot', A1).use(B2, 'blast').end();
    expect(a.hp(A1)).toBe(65); // the AoE lands
    const b = arena({ p0: [['riposte.ninja']], p1: [['shot']] });
    b.use(A1, 'riposte.ninja').end().pass(2).use(B1, 'shot', A1).end();
    expect([b.hp(A1), clones(b).length]).toEqual([85, 0]);
  });

  it('Shadow Army: 2 Clones and Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.ninja']], p1: [['curse']] });
    a.use(A1, 'rage.ninja').end().use(B1, 'curse', A1).end();
    expect([clones(a).length, a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([2, true, false]);
    a.pass(5);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Shadow Army: +1 Might each time one of the user\'s Clones is destroyed', () => {
    const a = arena({ p0: [['rage.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.ninja').end().use(B1, 'shot', A1).use(B2, 'shot', clones(a)[1]!.id).end();
    expect([clones(a).length, a.stacks(A1, 'might')]).toEqual([0, 2]);
  });

  it('Shuriken: three hits of 5', () => {
    const a = arena({ p0: [['shot.ninja']], p1: [['withstand']] });
    a.use(A1, 'shot.ninja', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Shuriken: Might, Vulnerable and Armor apply to each hit', () => {
    const a = arena({ p0: [['shot.ninja']], p1: [['withstand'], ['withstand']] });
    a.give(A1, 'might').give(B2, 'vulnerable').use(A1, 'shot.ninja', B1).end();
    expect(a.hp(B1)).toBe(70); // 3 × 10
    a.pass(1).use(A1, 'shot.ninja', B2).end();
    expect(a.hp(B2)).toBe(55); // 3 × 15
    const b = arena({ p0: [['shot.ninja']], p1: [['withstand']] });
    b.give(B1, 'armor').use(A1, 'shot.ninja', B1).end();
    expect(b.hp(B1)).toBe(100);
  });

  it('Hidden Needle: on the following turn, the target loses half their current HP as Affliction', () => {
    const a = arena({ p0: [['snipe.ninja']], p1: [['withstand']] });
    a.setHp(B1, 80).give(B1, 'shield', { value: 50 }).use(A1, 'snipe.ninja', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(1);
    expect(a.hp(B1)).toBe(40);
  });

  it('Hidden Needle: Channeled — stunning the user first stops it', () => {
    const a = arena({ p0: [['snipe.ninja']], p1: [['stun']] });
    a.use(A1, 'snipe.ninja', B1).end().use(B1, 'stun', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Paper Seal: invisible; each Buff gained deals 10 Piercing and lasts 1 turn less', () => {
    const a = arena({ p0: [['trap.ninja']], p1: [['rage']] });
    a.use(A1, 'trap.ninja', B1).end();
    expect([seen(a, 0, B1, 'paper_seal'), seen(a, 1, B1, 'paper_seal')]).toEqual([true, false]);
    a.use(B1, 'rage').end(); // Might and Immune: two Buffs
    const ref = arena({ p0: [['trap']], p1: [['rage']] });
    ref.pass(1).use(B1, 'rage').end();
    expect(a.hp(B1)).toBe(80);
    expect(find(a, B1, 'might')!.duration).toBe(find(ref, B1, 'might')!.duration! - 2);
  });

  it('Paper Seal: Debuffs don\'t trigger it; it ends after 3 turns', () => {
    const a = arena({ p0: [['trap.ninja', 'curse']], p1: [['rage']] });
    a.use(A1, 'trap.ninja', B1).end().pass(1).use(A1, 'curse', B1).end();
    expect(a.hp(B1)).toBe(100);
    const b = arena({ p0: [['trap.ninja']], p1: [['rage']] });
    b.use(A1, 'trap.ninja', B1).end().pass(6).use(B1, 'rage').end();
    expect(b.hp(B1)).toBe(100);
  });

  it('Vanishing Smoke: with a Clone, destroys it for Stealth', () => {
    const a = arena({ p0: [['maneuver.ninja', 'strike.ninja']], p1: [['shot']] });
    a.use(A1, 'strike.ninja', B1).end().pass(1).use(A1, 'maneuver.ninja').end();
    expect([clones(a).length, a.has(A1, 'stealth'), a.has(A1, 'invulnerable')]).toEqual([0, true, false]);
  });

  it('Vanishing Smoke: with no Clone, Invulnerable for 1 turn and creates a Clone', () => {
    const a = arena({ p0: [['maneuver.ninja']], p1: [['shot']] });
    a.use(A1, 'maneuver.ninja').end();
    expect([clones(a).length, a.has(A1, 'stealth'), a.has(A1, 'invulnerable')]).toEqual([1, false, true]);
    a.pass(1);
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  it('Ninken: a permanent 30 HP minion; Snap deals 10 Piercing', () => {
    const a = arena({ p0: [['companion.ninja']], p1: [['withstand']] });
    a.use(A1, 'companion.ninja').end().pass(1);
    const n = minions(a, 0, 'ninken')[0]!;
    expect(n.hp).toBe(30);
    a.give(B1, 'armor', { stacks: 3 }).use(n.id, 'ninken_snap', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it("Ninken Track: every Stealthed enemy loses Stealth (untargeted, so Stealth can't dodge it)", () => {
    const a = arena({ p0: [['companion.ninja']], p1: [['withstand']] });
    a.use(A1, 'companion.ninja').end().pass(1).give(B1, 'stealth', { duration: 4 });
    a.use(minions(a, 0, 'ninken')[0]!.id, 'ninken_track').end();
    expect(a.has(B1, 'stealth')).toBe(false);
  });

  it("Ninken Track: enemies can't gain Stealth for 1 turn", () => {
    const a = arena({ p0: [['companion.ninja']], p1: [['bless.shadow']] });
    a.use(A1, 'companion.ninja').end().pass(1);
    a.use(minions(a, 0, 'ninken')[0]!.id, 'ninken_track').end();
    a.use(B1, 'bless.shadow', B1).end();
    expect(a.has(B1, 'stealth')).toBe(false);
    const b = arena({ p0: [['companion.ninja']], p1: [['bless.shadow']] });
    b.use(A1, 'companion.ninja').end().pass(1);
    b.use(minions(b, 0, 'ninken')[0]!.id, 'ninken_track', B1).end().pass(2).use(B1, 'bless.shadow', B1).end();
    expect(b.has(B1, 'stealth')).toBe(true);
  });

  it('Pinning Kunai: 20 and Marked for 1 turn; they lose their Swiftness and can\'t gain mobility buffs', () => {
    const a = arena({ p0: [['bolt.ninja']], p1: [['charge.wind']] });
    a.give(B1, 'swiftness', { stacks: 2 }).use(A1, 'bolt.ninja', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.stacks(B1, 'swiftness')]).toEqual([80, true, 0]);
    a.use(B1, 'charge.wind').end();
    expect([a.has(B1, 'rushing'), a.has(B1, 'swiftness')]).toEqual([false, false]);
  });

  it('Pinning Kunai: after it ends, mobility buffs stick again', () => {
    const a = arena({ p0: [['bolt.ninja']], p1: [['charge.wind']] });
    a.use(A1, 'bolt.ninja', B1).end().pass(2).use(B1, 'charge.wind').end();
    expect(a.has(B1, 'rushing')).toBe(true);
  });

  it('Thousand Blades: 20 to all enemies; with no Clones, the user creates 3 first', () => {
    const a = arena({ p0: [['blast.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'blast.ninja').end();
    expect([a.hp(B1), a.hp(B2), clones(a).length]).toEqual([65, 65, 3]); // 20 + 3 × 5 Flurry
  });

  it('Thousand Blades: the 3 new Clones come first, so they Flurry the volley', () => {
    const a = arena({ p0: [['blast.ninja']], p1: [['withstand'], ['withstand']], passives: FLURRY });
    a.use(A1, 'blast.ninja').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 65]);
  });

  it('Thousand Blades: with a Clone already, no new ones', () => {
    const a = arena({ p0: [['blast.ninja', 'strike.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'strike.ninja', B1).end().pass(1).use(A1, 'blast.ninja').end();
    expect(clones(a)).toHaveLength(1);
  });

  it('Steal Sight: 5 damage healing the user; with no Clones, creates one', () => {
    const a = arena({ p0: [['consume.ninja']], p1: [['withstand']] });
    a.setHp(A1, 50).use(A1, 'consume.ninja', B1).end();
    expect([a.hp(B1), a.hp(A1), clones(a).length]).toEqual([90, 55, 1]); // + Flurry from the new Clone
  });

  it('Steal Sight: absorbs every Clone, healing 10 each', () => {
    const a = arena({ p0: [['consume.ninja', 'summon.ninja']], p1: [['withstand']] });
    doubles(a);
    a.setHp(A1, 50).use(A1, 'consume.ninja', B1).end();
    expect([a.hp(A1), clones(a).length]).toEqual([85, 0]);
  });

  it('Shadow Doubles: the user creates 3 Clones', () => {
    const a = arena({ p0: [['summon.ninja']], p1: [['withstand']] });
    a.use(A1, 'summon.ninja').end();
    expect(clones(a).every((c) => c.summonedBy === A1)).toBe(true);
    expect(clones(a)).toHaveLength(3);
  });

  it('Blade Tornado: each tick creates a Clone, then 10 to all enemies and a Flurry from every Clone', () => {
    const a = arena({ p0: [['channel.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'channel.ninja').end();
    expect([a.hp(B1), a.hp(B2), clones(a).length]).toEqual([85, 85, 1]); // 10 + 1 Clone × 5
    a.pass(2);
    expect([a.hp(B1), a.hp(B2), clones(a).length]).toEqual([65, 65, 2]); // 10 + 2 × 5
    a.pass(2);
    expect([a.hp(B1), clones(a).length]).toEqual([65, 2]); // 2 turns only
  });

  it('Second Draw: 5 damage, and a new Clone slips into the target\'s blind spot', () => {
    const a = arena({ p0: [['stab.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'stab.ninja', B1).end();
    expect([a.hp(B1), clones(a).length]).toEqual([100 - 5 - 5, 1]); // the new Clone is there for the Flurry
  });

  it('Second Draw: still standing at the start of the user\'s next turn, the Clone stabs them for 15 and is destroyed', () => {
    const a = arena({ p0: [['stab.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'stab.ninja', B1).end().pass(1);
    expect([a.hp(B1), a.hp(B2), clones(a).length]).toEqual([90 - 15, 100, 0]);
  });

  it('Second Draw: a Clone destroyed first never stabs', () => {
    const a = arena({ p0: [['stab.ninja']], p1: [['shot'], ['withstand']] });
    a.use(A1, 'stab.ninja', B1).end().use(B1, 'shot', clones(a)[0]!.id).end();
    expect([a.hp(B1), clones(a).length]).toEqual([90, 0]);
  });

  it('Second Draw: at 3 Clones, one of them goes instead', () => {
    const a = arena({ p0: [['summon.ninja', 'stab.ninja']], p1: [['withstand'], ['withstand']] });
    doubles(a);
    a.use(A1, 'stab.ninja', B1).end();
    expect([a.hp(B1), clones(a).length]).toEqual([100 - 5 - 15, 3]);
    a.pass(1);
    expect([a.hp(B1), clones(a).length]).toEqual([80 - 15, 2]);
  });

  it('Quickdraw: nothing at once; the first skill the target uses draws a 30 Piercing cut first', () => {
    const a = arena({ p0: [['ravage.ninja']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.ninja', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([70, 85]);
    a.pass(1).use(B1, 'shot', A1).end(); // only the first
    expect(a.hp(B1)).toBe(70);
  });

  it('Quickdraw: the cut lands before the skill takes effect', () => {
    const a = arena({ p0: [['ravage.ninja']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 30).use(A1, 'ravage.ninja', B1).end().use(B1, 'shot', A1).end();
    expect([a.unit(B1).alive, a.hp(A1)]).toEqual([false, 100]);
  });

  it('Quickdraw: if the target uses no skill, the cut lands as the turn ends, for 20', () => {
    const a = arena({ p0: [['ravage.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'ravage.ninja', B1).end().use(B2, 'shot', A1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Feint: invisible; counters the target\'s Harmful skill and the user Leaps', () => {
    const a = arena({ p0: [['mislead.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.ninja', B1).end();
    expect([seen(a, 0, B1, 'feint'), seen(a, 1, B1, 'feint')]).toEqual([true, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(A1, 'leaping'), a.has(A1, 'invulnerable'), a.has(A1, 'mark')]).toEqual([100, true, true, false]);
  });

  it('Feint: Helpful skills aren\'t countered; unbitten, the user is Marked for 1 turn', () => {
    const a = arena({ p0: [['mislead.ninja']], p1: [['withstand']] });
    a.use(A1, 'mislead.ninja', B1).end().use(B1, 'withstand').end();
    expect([a.has(B1, 'shield'), a.has(A1, 'leaping'), a.has(A1, 'mark')]).toEqual([true, false, true]);
    a.pass(2);
    expect(a.has(A1, 'mark')).toBe(false);
  });

  it('Pressure Point: 10 damage; the target isn\'t Stunned yet', () => {
    const a = arena({ p0: [['stun.ninja']], p1: [['shot']] });
    a.use(A1, 'stun.ninja', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([90, false]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Pressure Point: at the end of their next turn it seizes: they\'re Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.ninja']], p1: [['shot']] });
    a.use(A1, 'stun.ninja', B1).end().pass(1);
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Shadow Dance: Stealth, 2 Clones and 1 Might', () => {
    const a = arena({ p0: [['dance.ninja']], p1: [['shot']] });
    a.use(A1, 'dance.ninja').end();
    expect([a.has(A1, 'stealth'), clones(a).length, a.stacks(A1, 'might')]).toEqual([true, 2, 1]);
    a.pass(6);
    expect(a.has(A1, 'might')).toBe(false);
  });

  it('Shadow Dance: a skill that would end Stealth destroys a Clone instead', () => {
    const a = arena({ p0: [['dance.ninja', 'shot']], p1: [['withstand']] });
    a.use(A1, 'dance.ninja').end().pass(1).use(A1, 'shot', B1).end();
    expect([a.has(A1, 'stealth'), clones(a).length]).toEqual([true, 1]);
    expect(a.hp(B1)).toBeLessThanOrEqual(80); // 15 + 5 Might, plus Flurry
  });

  it('Field Dressing: heals 30 and the ally falls Asleep', () => {
    const a = arena({ p0: [['heal.ninja'], ['shot']], p1: [['withstand']] });
    a.setHp(A2, 50).use(A1, 'heal.ninja', A2).end().pass(1);
    expect([a.hp(A2), a.has(A2, 'sleep')]).toEqual([80, true]);
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('cannot_act');
  });

  it('Field Dressing: on waking, the ally begins Rushing and gains 1 Swiftness', () => {
    const a = arena({ p0: [['heal.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal.ninja', A2).end().use(B1, 'shot', A2).end();
    expect([a.has(A2, 'sleep'), a.has(A2, 'rushing'), a.stacks(A2, 'swiftness') >= 1]).toEqual([false, true, true]);
  });

  it('Field Dressing: the Sleep lasts 2 turns, then they wake Rushing', () => {
    const a = arena({ p0: [['heal.ninja'], ['shot']], p1: [['withstand']] });
    a.use(A1, 'heal.ninja', A2).end().pass(2);
    expect(a.has(A2, 'sleep')).toBe(true);
    a.pass(1); // the Sleep runs out at the end of the enemy's 2nd turn
    expect([a.has(A2, 'sleep'), a.has(A2, 'rushing')]).toEqual([false, true]);
  });

  it('Cloak of Shadows: the ally gains 1 Swiftness and the user creates a Clone', () => {
    const a = arena({ p0: [['bless.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.ninja', A2).end();
    expect([a.stacks(A2, 'swiftness'), clones(a).length]).toEqual([1, 1]);
  });

  it('Cloak of Shadows: for 2 turns, the user\'s Clones Substitute for that ally', () => {
    const a = arena({ p0: [['bless.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.ninja', A2).end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), clones(a).length]).toEqual([100, 0]);
  });

  it('Haunting Shadows: the user creates a Clone; each skill the target uses draws a Flurry on them, Helpful or not', () => {
    const a = arena({ p0: [['curse.ninja']], p1: [['withstand', 'shot'], ['withstand']] });
    a.use(A1, 'curse.ninja', B1).end();
    expect([clones(a).length, a.hp(B1)]).toEqual([1, 100]);
    a.use(B1, 'withstand').use(B2, 'withstand').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 100]); // only the haunted one
    a.pass(1).use(B1, 'shot', A1).end(); // the Clone takes the shot, but haunts them as it's used
    expect([a.hp(B1), clones(a).length]).toEqual([90, 0]);
  });

  it('Haunting Shadows: 5 Piercing per Clone the user has; it lasts 2 turns', () => {
    const a = arena({ p0: [['curse.ninja', 'summon.ninja']], p1: [['shot']] });
    doubles(a);
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'curse.ninja', B1).end(); // still 3 Clones
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85); // Piercing
    a.pass(3).use(B1, 'shot', A1).end(); // turn 8: over
    expect(a.hp(B1)).toBe(85);
  });

  it('Shadow Mark: 20; each ally who damages the target this turn gives the user a Clone', () => {
    const a = arena({ p0: [['smite.ninja'], ['shot'], ['shot']], p1: [['withstand']] });
    a.use(A1, 'smite.ninja', B1).use(A2, 'shot', B1).use('p0c2', 'shot', B1).end();
    expect([a.hp(B1), clones(a).length]).toEqual([50, 2]);
    expect(clones(a).every((c) => c.summonedBy === A1)).toBe(true);
  });

  it('Shadow Mark: enemies damaging the target give nothing; it lasts 1 turn', () => {
    const a = arena({ p0: [['smite.ninja'], ['shot']], p1: [['withstand'], ['shot']] });
    a.use(A1, 'smite.ninja', B1).end().pass(1).use(A2, 'shot', B1).end();
    expect(clones(a)).toHaveLength(0);
  });

  it('Scatter: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.ninja'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.ninja').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
  });

  it('Scatter: an ally targeted by an enemy skill gains Stealth; untargeted allies don\'t', () => {
    const a = arena({ p0: [['prayer.ninja'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'prayer.ninja').end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(A2, 'stealth'), a.has(A1, 'stealth')]).toEqual([85, true, false]);
  });

  it('Shadow Whirl: Stealthy; the user creates a Clone, then 10 to the target and a Flurry on every enemy', () => {
    const a = arena({ p0: [['cleave.ninja']], p1: [['withstand'], ['withstand'], ['withstand']] });
    a.use(A1, 'cleave.ninja', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2'), clones(a).length]).toEqual([85, 95, 95, 1]);
    expect(content.skills['cleave.ninja']!.tags).toContain('Stealthy');
  });

  it('Shadow Whirl: the spread Flurry counts every Clone', () => {
    const a = arena({ p0: [['summon.ninja', 'cleave.ninja']], p1: [['withstand'], ['withstand']] });
    doubles(a);
    a.use(A1, 'cleave.ninja', B1).end();
    expect([a.hp(B1), a.hp(B2), clones(a).length]).toEqual([100 - 10 - 15, 85, 3]);
  });

  it('Shadow Whirl: being Stealthy, it keeps the user\'s Stealth', () => {
    const a = arena({ p0: [['cleave.ninja']], p1: [['withstand'], ['withstand']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'cleave.ninja', B1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Smoke Bomb: all enemies Intimidated for 2 turns, and every character on both sides gains Stealth for 2 turns', () => {
    const a = arena({ p0: [['shout.ninja'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.ninja').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.has(A1, 'intimidated')]).toEqual([true, true, false]);
    expect([A1, A2, B1, B2].map((u) => a.has(u, 'stealth'))).toEqual([true, true, true, true]);
  });

  it('Smoke Bomb: minions aren\'t characters — no Stealth for them', () => {
    const a = arena({ p0: [['shout.ninja', 'strike.ninja']], p1: [['withstand']] });
    a.use(A1, 'strike.ninja', B1).end().pass(1).use(A1, 'shout.ninja').end();
    expect(a.has(clones(a)[0]!.id, 'stealth')).toBe(false);
  });

  it('Shadow Guard: the user creates a Clone, then each of their Clones gains 20 Shield for 1 turn; the user gains none', () => {
    const a = arena({ p0: [['withstand.ninja', 'summon.ninja']], p1: [['shot']] });
    const shieldOf = (id: string) => a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);
    a.use(A1, 'summon.ninja').end().pass(1).use(A1, 'withstand.ninja').end(); // already 3: no new one
    expect([clones(a).map((c) => shieldOf(c.id)), shieldOf(A1)]).toEqual([[20, 20, 20], 0]);
  });

  it('Shadow Guard: a shielded Clone outlasts the hit it Substitutes for; the Shield is gone after 1 turn', () => {
    const a = arena({ p0: [['withstand.ninja']], p1: [['shot']] });
    a.use(A1, 'withstand.ninja').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), clones(a).length]).toEqual([100, 1]);
    a.pass(1).use(B1, 'shot', A1).end(); // turn 4: a bare 5 HP Clone again
    expect([a.hp(A1), clones(a).length]).toEqual([100, 0]);
  });

  it('Mocking Shadows: with no Clones, the target is Taunted by the user for 1 turn', () => {
    const a = arena({ p0: [['taunt.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.ninja', B1).end();
    expect(find(a, B1, 'taunt')?.source).toBe(A1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(2).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Mocking Shadows: every Clone on the user\'s side is destroyed, each adding 1 turn, up to 3 turns', () => {
    const a = arena({ p0: [['taunt.ninja', 'summon.ninja'], ['shot']], p1: [['shot']] });
    doubles(a);
    a.use(A1, 'taunt.ninja', B1).end();
    expect(clones(a)).toHaveLength(0);
    a.pass(4); // turn 8
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(2).use(B1, 'shot', A2).end(); // turn 10: over
    expect(a.hp(A2)).toBe(85);
  });

  it('Mocking Shadows: one Clone gives 2 turns', () => {
    const a = arena({ p0: [['taunt.ninja', 'strike.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'strike.ninja', B1).end().pass(1).use(A1, 'taunt.ninja', B1).end(); // turn 3
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // turn 6
    a.pass(2).use(B1, 'shot', A2).end(); // turn 8: over
    expect(a.hp(A2)).toBe(85);
  });

  it('Shadow Master: Clones until the user has 2, and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.ninja']], p1: [['curse']] });
    a.use(A1, 'titan.ninja').end().pass(1);
    expect([clones(a).length, a.has(A1, 'immune'), a.stacks(A1, 'armor')]).toEqual([2, true, 0]);
    a.pass(4);
    expect(a.has(A1, 'immune')).toBe(false);
    const b = arena({ p0: [['titan.ninja', 'summon.ninja']], p1: [['curse']] });
    doubles(b);
    b.use(A1, 'titan.ninja').end();
    expect(clones(b)).toHaveLength(3);
  });

  it('Shadow Master: while the user\'s side has a Clone, enemies can\'t target them', () => {
    const a = arena({ p0: [['titan.ninja']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.ninja').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    const [c1, c2] = clones(a);
    a.use(B1, 'shot', c1!.id).use(B2, 'shot', c2!.id).end();
    expect(clones(a)).toHaveLength(0);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });
});

describe('Ninja costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Ar', 2], charge: ['r', 1], riposte: ['A', 3], rage: ['SS', 4],
    shot: ['r', 0], snipe: ['Arr', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['Ar', 1], blast: ['Irr', 2], consume: ['r', 2], summon: ['r', 3], channel: ['AI', 3],
    stab: ['r', 0], ravage: ['Ar', 1], mislead: ['A', 2], stun: ['A', 2], dance: ['A', 2],
    heal: ['A', 1], bless: ['r', 2], curse: ['A', 2], smite: ['W', 1], prayer: ['Wrr', 2],
    cleave: ['Sr', 1], shout: ['A', 3], withstand: ['A', 2], taunt: ['r', 3], titan: ['AW', 4],
  };
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(Object.entries(kit))('%s.ninja matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.ninja`]!;
    expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
  });
});
