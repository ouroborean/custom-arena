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
    const a = arena({ p0: [['summon.ninja', 'charge.ninja']], p1: [['withstand']] });
    doubles(a);
    expect(clones(a).map((c) => c.hp)).toEqual([5, 5, 5]);
    a.use(A1, 'charge.ninja').end();
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

  // BUG: each Clone's Substitution redirects its own first skill each turn, so with 3 Clones the first three
  // single-target skills on the Ninja each turn hit Clones (the glossary says only the first one does)
  it.fails('Substitution: the first single-target enemy skill on the Ninja each turn hits a Clone instead', () => {
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

  // BUG: Flurry should hit each enemy the skill hits, but Whirlwind's 10 to the others draws no Flurry
  it.fails('Whirlwind of Blades: 20 to the target and 10 to the others, each Flurried', () => {
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

  it('Blur: the user begins Rushing and creates a Clone', () => {
    const a = arena({ p0: [['charge.ninja']], p1: [['withstand']] });
    a.use(A1, 'charge.ninja').end();
    expect([a.has(A1, 'rushing'), clones(a).length]).toEqual([true, 1]);
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

  // SPEC: Track should make a Stealthed enemy lose Stealth, but Stealth makes them untargetable (Bypass doesn't
  // pierce it), so Track can never be aimed at a Stealthed enemy. Should Track ignore Stealth for targeting?
  it.fails('Ninken Track: a Stealthed enemy loses Stealth', () => {
    const a = arena({ p0: [['companion.ninja']], p1: [['withstand']] });
    a.use(A1, 'companion.ninja').end().pass(1).give(B1, 'stealth', { duration: 4 });
    a.use(minions(a, 0, 'ninken')[0]!.id, 'ninken_track', B1).end();
    expect(a.has(B1, 'stealth')).toBe(false);
  });

  it('Ninken Track: the target can\'t gain Stealth for 1 turn', () => {
    const a = arena({ p0: [['companion.ninja']], p1: [['bless.shadow']] });
    a.use(A1, 'companion.ninja').end().pass(1);
    a.use(minions(a, 0, 'ninken')[0]!.id, 'ninken_track', B1).end();
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

  it('Second Draw: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.ninja']], p1: [['withstand'], ['withstand']] });
    a.setHp(B2, 60).use(A1, 'stab.ninja', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
    a.use(A1, 'stab.ninja', B2).end();
    expect(a.hp(B2)).toBe(40);
  });

  it('Second Draw: still Rushing at the start of the next turn, it strikes the same enemy again for 10', () => {
    const a = arena({ p0: [['stab.ninja']], p1: [['withstand'], ['withstand']] });
    a.give(A1, 'rushing').use(A1, 'stab.ninja', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
  });

  it('Second Draw: no longer Rushing, no second strike', () => {
    const a = arena({ p0: [['stab.ninja']], p1: [['curse.wind']] });
    a.give(A1, 'rushing').use(A1, 'stab.ninja', B1).end().use(B1, 'curse.wind', A1).end();
    expect([a.has(A1, 'rushing'), a.hp(B1)]).toEqual([false, 90]);
  });

  it('Quickdraw: 25 Piercing; no Stealth if the user wasn\'t Leaping', () => {
    const a = arena({ p0: [['ravage.ninja']], p1: [['withstand']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.ninja', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([75, false]);
  });

  it('Quickdraw: Leaping, +5 and the user lands in Stealth', () => {
    const a = arena({ p0: [['ravage.ninja']], p1: [['withstand']] });
    a.give(A1, 'leaping').use(A1, 'ravage.ninja', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth'), a.has(A1, 'leaping')]).toEqual([70, true, false]);
  });

  it('Feint: invisible; counters the target\'s Harmful skill and fills the user up to 3 Clones', () => {
    const a = arena({ p0: [['mislead.ninja', 'strike.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'strike.ninja', B1).end().pass(1).use(A1, 'mislead.ninja', B1).end();
    expect([seen(a, 0, B1, 'feint'), seen(a, 1, B1, 'feint')]).toEqual([true, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), clones(a).length]).toEqual([100, 3]);
  });

  it('Feint: Helpful skills aren\'t countered and give no Clones', () => {
    const a = arena({ p0: [['mislead.ninja']], p1: [['withstand']] });
    a.use(A1, 'mislead.ninja', B1).end().use(B1, 'withstand').end();
    expect([a.has(B1, 'shield'), clones(a).length]).toEqual([true, 0]);
  });

  it('Pressure Point: 10 and Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.ninja']], p1: [['shot', 'charge.wind']] });
    a.use(A1, 'stun.ninja', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), a.cooldown(B1, 'charge.wind')]).toEqual([90, true, 0]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Pressure Point: ends Rushing or Leaping, and pushes their mobility skills 1 turn further onto cooldown', () => {
    const a = arena({ p0: [['stun.ninja']], p1: [['shot', 'charge.wind', 'maneuver', 'dance']] });
    a.give(B1, 'rushing').give(B1, 'leaping').use(A1, 'stun.ninja', B1).end();
    expect([a.has(B1, 'rushing'), a.has(B1, 'leaping')]).toEqual([false, false]);
    expect([a.cooldown(B1, 'charge.wind'), a.cooldown(B1, 'maneuver'), a.cooldown(B1, 'dance'), a.cooldown(B1, 'shot')]).toEqual([1, 1, 1, 0]);
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

  it('Blinding Dust: Blinded for 2 turns and 1 Confusion', () => {
    const a = arena({ p0: [['curse.ninja']], p1: [['shot']] });
    a.use(A1, 'curse.ninja', B1).end();
    expect([a.has(B1, 'blinded'), a.stacks(B1, 'confusion')]).toEqual([true, 1]);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(false);
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

  it('Shadow Whirl: Stealthy; creates a Clone if none, then 20 / 15, and each Clone adds 10 to another enemy', () => {
    const a = arena({ p0: [['cleave.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'cleave.ninja', B1).end();
    expect(clones(a)).toHaveLength(1);
    expect(200 - a.hp(B1) - a.hp(B2)).toBeGreaterThanOrEqual(20 + 15 + 10 + 5);
    expect(content.skills['cleave.ninja']!.tags).toContain('Stealthy');
  });

  // BUG: Flurry should hit each enemy the skill hits, but Shadow Whirl's 15 to the second enemy draws no Flurry
  it.fails('Shadow Whirl: both enemies it hits are Flurried', () => {
    const a = arena({ p0: [['cleave.ninja']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'cleave.ninja', B1).end();
    expect(200 - a.hp(B1) - a.hp(B2)).toBe(20 + 15 + 10 + 5 + 5); // 1 Clone: +5 on each enemy hit
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

  it('Shadow Guard: 20 Shield for 1 turn and a Clone', () => {
    const a = arena({ p0: [['withstand.ninja']], p1: [['blast']] });
    a.use(A1, 'withstand.ninja').end();
    expect([find(a, A1, 'shield')?.value ?? a.effects(A1).find((e) => e.value === 20)?.value, clones(a).length]).toEqual([20, 1]);
    a.use(B1, 'blast').end(); // 35 to all: 20 absorbed
    expect(a.hp(A1)).toBe(85);
  });

  it('Mocking Shadows: a Clone, and the target is Taunted by the user for 2 turns', () => {
    const a = arena({ p0: [['taunt.ninja'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.ninja', B1).end();
    expect([clones(a).length, find(a, B1, 'taunt')?.source]).toEqual([1, A1]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });

  it('Mocking Shadows: each skill the Taunted enemy uses draws 5 Piercing per Clone', () => {
    const a = arena({ p0: [['taunt.ninja', 'summon.ninja']], p1: [['withstand']] });
    doubles(a);
    a.use(A1, 'taunt.ninja', B1).end(); // 3 Clones (max)
    a.give(B1, 'armor', { stacks: 3 }).use(B1, 'withstand').end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Shadow Master: 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.ninja']], p1: [['curse']] });
    a.use(A1, 'titan.ninja').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([2, true, false]);
    a.pass(5);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Shadow Master: a Clone at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['titan.ninja']], p1: [['withstand']] });
    a.use(A1, 'titan.ninja').end();
    expect(clones(a)).toHaveLength(0);
    a.pass(1);
    expect(clones(a)).toHaveLength(1);
    a.pass(2);
    expect(clones(a)).toHaveLength(2);
  });
});

describe('Ninja costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Ar', 2], charge: ['nc', 1], riposte: ['A', 3], rage: ['SS', 4],
    shot: ['r', 0], snipe: ['Arr', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['Ar', 1], blast: ['Irr', 2], consume: ['r', 2], summon: ['r', 3], channel: ['AI', 3],
    stab: ['r', 0], ravage: ['A', 1], mislead: ['A', 2], stun: ['A', 2], dance: ['A', 2],
    heal: ['A', 1], bless: ['r', 2], curse: ['A', 2], smite: ['W', 1], prayer: ['Wrr', 2],
    cleave: ['S', 1], shout: ['A', 3], withstand: ['A', 1], taunt: ['r', 2], titan: ['AW', 4],
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
