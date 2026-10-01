// Spec-driven tests for the Ghost fusion (Wind + Unholy): Spectral, Haunt and all 30 variants.
// Sources: skill/status descriptions, docs/rules.md §21.44, and the wind-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

const key = (e: { inline?: { id: string }; defId: string }) => (e.inline ? e.inline.id : e.defId);
const find = (a: Arena, id: string, k: string) => a.effects(id).find((e) => key(e) === k);
const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const seen = (a: Arena, p: 0 | 1, bearer: string, k: string) =>
  viewFor(content, a.state, p).effects.some((e) => e.bearer === bearer && key(e) === k);
/** Haunted by any Haunt variant (they count as Haunt). */
const haunted = (a: Arena, id: string) =>
  a.effects(id).some((e) => e.defId === 'haunt' || (e.inline?.countsAs ?? []).includes('haunt'));

describe('Ghost keywords', () => {
  it('Spectral: no Normal damage; Piercing and Affliction still hurt', () => {
    const a = arena({ p0: [['shot']], p1: [['shot', 'ravage'], ['curse.ghost']] });
    a.give(A1, 'spectral').pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1).use(B1, 'ravage', A1).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Haunt: 10 Affliction at the end of the applier\'s turn, through Shield; stays with no ally to drift to', () => {
    const a = arena({ p0: [['curse.ghost']], p1: [['withstand']] });
    a.give(B1, 'shield', { value: 50 }).give(B1, 'armor', { stacks: 3 }).use(A1, 'curse.ghost', B1).end();
    expect([a.hp(B1), haunted(a, B1)]).toEqual([90, true]);
  });

  it('Haunt: doesn\'t tick at the end of the enemy\'s turn', () => {
    const a = arena({ p0: [['curse.ghost']], p1: [['withstand']] });
    a.use(A1, 'curse.ghost', B1).end().pass(1);
    expect(a.hp(B1)).toBe(90);
    a.pass(1);
    expect(a.hp(B1)).toBe(80);
  });

  it('Haunt: after ticking, it drifts to an ally of the bearer', () => {
    const a = arena({ p0: [['curse.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'curse.ghost', B1).end();
    expect([a.hp(B1), a.hp(B2), haunted(a, B1), haunted(a, B2)]).toEqual([90, 100, false, true]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2), haunted(a, B1), haunted(a, B2)]).toEqual([90, 90, true, false]);
  });

  it('Haunt: ends when its duration runs out', () => {
    const a = arena({ p0: [['curse.ghost']], p1: [['withstand']] });
    a.use(A1, 'curse.ghost', B1).end().pass(6);
    expect(haunted(a, B1)).toBe(false);
    const hp = a.hp(B1);
    a.pass(2);
    expect(a.hp(B1)).toBe(hp);
  });
});

describe('Ghost skills', () => {
  it('Phantom Blade: 25 and Haunted for 1 turn', () => {
    const a = arena({ p0: [['strike.ghost']], p1: [['withstand']] });
    a.use(A1, 'strike.ghost', B1).end();
    expect([a.hp(B1), haunted(a, B1)]).toEqual([65, true]); // 25 + the Haunt's tick
    a.pass(2);
    expect(haunted(a, B1)).toBe(false);
  });

  it('Phantom Blade: a Haunt already on them ticks now and doesn\'t drift this turn', () => {
    const a = arena({ p0: [['curse.ghost', 'strike.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'curse.ghost', B1).end().pass(1); // drifted to B2
    expect(haunted(a, B2)).toBe(true);
    a.use(A1, 'strike.ghost', B2).end();
    expect(a.hp(B2)).toBe(100 - 25 - 10 - 10); // ticks on the hit, and at the end of the turn
    expect([haunted(a, B2), haunted(a, B1), a.hp(B1)]).toEqual([true, false, 90]);
  });

  it('Poltergeist Crash: 20 to the target, 10 to their allies, and the target Haunted for 2 turns', () => {
    const a = arena({ p0: [['smash.ghost']], p1: [['withstand']] });
    a.use(A1, 'smash.ghost', B1).end();
    expect([a.hp(B1), haunted(a, B1)]).toEqual([70, true]);
    a.pass(4);
    expect(haunted(a, B1)).toBe(false);
  });

  it('Poltergeist Crash: an already-Haunted target splits it — a second Haunt lands on an ally', () => {
    const a = arena({ p0: [['curse.ghost', 'smash.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'curse.ghost', B1).end().pass(1); // Haunt on B2 now
    a.use(A1, 'smash.ghost', B2).end();
    expect(a.hp(B2)).toBe(100 - 20 - 10); // hit, then its Haunt's tick
    expect(a.hp(B1)).toBe(90 - 10 - 10); // splash, then the second Haunt's tick
  });

  it('Poltergeist Crash: both Haunts survive the drift after a split', () => {
    const a = arena({ p0: [['curse.ghost', 'smash.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'curse.ghost', B1).end().pass(1).use(A1, 'smash.ghost', B2).end();
    expect([haunted(a, B1), haunted(a, B2)]).toEqual([true, true]);
  });

  it('Walk Through Walls: Spectral until the user\'s next skill, which Bypasses', () => {
    const a = arena({ p0: [['charge.ghost', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.ghost').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.give(B1, 'invulnerable', { duration: 2 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'walk_through_walls'), a.has(A1, 'spectral')]).toEqual([85, false, false]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Vengeful Spirit: invisible; Spectral for 1 turn, and the first enemy to strike takes 15 Affliction', () => {
    const a = arena({ p0: [['riposte.ghost']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.ghost').end();
    expect([seen(a, 0, A1, 'vengeful_spirit'), seen(a, 1, A1, 'vengeful_spirit')]).toEqual([true, false]);
    a.give(B1, 'shield', { value: 50 }).use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([100, 85, 100]);
  });

  it('Vengeful Spirit: Helpful skills don\'t set it off; it ends after 1 turn', () => {
    const a = arena({ p0: [['riposte.ghost']], p1: [['shot']] });
    a.use(A1, 'riposte.ghost').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 100]);
  });

  it('Unfinished Business: usable while Stunned; Immortal for 3 turns', () => {
    const a = arena({ p0: [['rage.ghost']], p1: [['smash']] });
    a.give(A1, 'stun', { source: B1, duration: 3 }).use(A1, 'rage.ghost').end();
    expect(a.has(A1, 'immortal')).toBe(true);
    a.setHp(A1, 10).use(B1, 'smash', A1).end();
    expect([a.unit(A1).alive, a.hp(A1)]).toEqual([true, 5]);
  });

  it('Unfinished Business: each Debuff they would gain becomes 1 Might instead', () => {
    const a = arena({ p0: [['rage.ghost']], p1: [['curse'], ['shout']] });
    a.use(A1, 'rage.ghost').end().use(B1, 'curse', A1).use(B2, 'shout').end();
    expect([a.has(A1, 'confusion'), a.has(A1, 'intimidated'), a.stacks(A1, 'might')]).toEqual([false, false, 2]);
  });

  it('Unfinished Business: after 3 turns, Debuffs land again', () => {
    const a = arena({ p0: [['rage.ghost']], p1: [['curse']] });
    a.use(A1, 'rage.ghost').end().pass(6).use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true);
  });

  it('Phantom Pain: 10; for 2 turns, direct damage to the target\'s allies deals them 5 Affliction too', () => {
    const a = arena({ p0: [['shot.ghost'], ['shot']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'shot.ghost', B1).use(A2, 'shot', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it('Phantom Pain: direct damage to the target itself doesn\'t echo', () => {
    const a = arena({ p0: [['shot.ghost'], ['shot']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'shot.ghost', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 100]);
  });

  it('Phantom Pain: indirect damage to an ally doesn\'t echo', () => {
    const a = arena({ p0: [['shot.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'shot.ghost', B1).end().pass(1);
    a.give(B2, 'haunt', { source: A1, duration: 4 }).end(); // the Haunt's tick on B2 is indirect
    expect([a.hp(B2), a.hp(B1)]).toEqual([90, 90]);
  });

  it('Phantom Pain: lasts 2 turns', () => {
    const a = arena({ p0: [['shot.ghost'], ['shot']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'shot.ghost', B1).end().pass(3).use(A2, 'shot', B2).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Grave Omen: the user is Spectral until it lands; 35 Piercing on the following turn', () => {
    const a = arena({ p0: [['snipe.ghost']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'snipe.ghost', B1).end();
    expect([a.hp(B1), a.has(A1, 'spectral') || a.effects(A1).some((e) => (e.inline?.countsAs ?? []).includes('spectral'))]).toEqual([100, true]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 65]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Hangman\'s Noose: invisible; the target\'s first Buff is removed and they\'re Haunted for 3 turns', () => {
    const a = arena({ p0: [['trap.ghost']], p1: [['withstand', 'rage']] });
    a.use(A1, 'trap.ghost', B1).end();
    expect([seen(a, 0, B1, 'hangmans_noose'), seen(a, 1, B1, 'hangmans_noose')]).toEqual([true, false]);
    a.use(B1, 'withstand').end();
    expect([a.has(B1, 'shield'), haunted(a, B1)]).toEqual([false, true]);
    a.pass(1).use(B1, 'rage').end(); // only the first Buff
    expect(a.has(B1, 'might')).toBe(true);
  });

  it('Hangman\'s Noose: after 2 turns, Buffs are safe', () => {
    const a = arena({ p0: [['trap.ghost']], p1: [['withstand']] });
    a.use(A1, 'trap.ghost', B1).end().pass(4).use(B1, 'withstand').end();
    expect([a.has(B1, 'shield'), haunted(a, B1)]).toEqual([true, false]);
  });

  it('Fade: Spectral for 2 turns', () => {
    const a = arena({ p0: [['maneuver.ghost']], p1: [['shot']] });
    a.use(A1, 'maneuver.ghost').end().use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Fade: ends early if the user deals damage', () => {
    const a = arena({ p0: [['maneuver.ghost', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.ghost').end().pass(1).use(A1, 'shot', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Poltergeist: a permanent 30 HP minion that is always Spectral', () => {
    const a = arena({ p0: [['companion.ghost']], p1: [['shot', 'ravage']] });
    a.use(A1, 'companion.ghost').end();
    const p = minions(a, 0, 'poltergeist')[0]!;
    expect(p.hp).toBe(30);
    a.use(B1, 'shot', p.id).end();
    expect(a.hp(p.id)).toBe(30);
    a.pass(8);
    expect(a.unit(p.id).alive).toBe(true);
  });

  it('Poltergeist Rattle: 10 Affliction and Haunted for 2 turns', () => {
    const a = arena({ p0: [['companion.ghost']], p1: [['withstand']] });
    a.use(A1, 'companion.ghost').end().pass(1);
    a.give(B1, 'armor', { stacks: 3 }).use(minions(a, 0, 'poltergeist')[0]!.id, 'poltergeist_rattle', B1).end();
    expect([a.hp(B1), haunted(a, B1)]).toEqual([80, true]); // 10 + the Haunt's tick
  });

  it('Reaping Bolt: 20 and Marked; when the Mark is spent, the user gains a Soul Fragment', () => {
    const a = arena({ p0: [['bolt.ghost'], ['shot']], p1: [['withstand']] });
    a.use(A1, 'bolt.ghost', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.stacks(A1, 'soul_fragment')]).toEqual([80, true, 0]);
    a.pass(1).use(A2, 'shot', B1).end(); // Mark expired after 1 turn: nothing
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
    const b = arena({ p0: [['bolt.ghost'], ['shot']], p1: [['withstand']] });
    b.use(A1, 'bolt.ghost', B1).use(A2, 'shot', B1).end();
    expect([b.hp(B1), b.stacks(A1, 'soul_fragment')]).toEqual([55, 1]);
  });

  it('Spirit Storm: 20 to all enemies with no deaths', () => {
    const a = arena({ p0: [['blast.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'blast.ghost').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Spirit Storm: +10 per character on either side who has died; minions don\'t count', () => {
    const a = arena({ p0: [['blast.ghost', 'summon.ghost'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['withstand']] });
    a.setHp(B2, 5).setHp('p0c2', 5).use(A2, 'shot', B2).end();
    a.use(B1, 'shot', 'p0c2').end();
    expect([a.unit(B2).alive, a.unit('p0c2').alive]).toEqual([false, false]);
    a.use(A1, 'blast.ghost').end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Spirit Storm: a dead minion isn\'t a character', () => {
    const a = arena({ p0: [['blast.ghost', 'summon.ghost']], p1: [['shot']] });
    a.use(A1, 'summon.ghost').end();
    const w = minions(a, 0, 'wraith')[0]!;
    a.use(B1, 'shot', w.id).end();
    expect(a.unit(w.id).alive).toBe(false);
    a.use(A1, 'blast.ghost').end();
    expect(a.hp(B1)).toBe(100 - 20 - 10); // no bonus; the 10 is the killer's Haunt ticking
  });

  it('Steal Breath: 5, and a 2-turn Haunt whose damage heals the user wherever it drifts', () => {
    const a = arena({ p0: [['consume.ghost']], p1: [['withstand'], ['withstand']] });
    a.setHp(A1, 50).use(A1, 'consume.ghost', B1).end();
    expect([a.hp(B1), a.hp(A1), haunted(a, B2)]).toEqual([85, 60, true]); // 5 + 10 tick; healed 10
    a.pass(2);
    expect([a.hp(B2), a.hp(A1)]).toEqual([90, 70]);
  });

  it('Wraiths: two 10 HP minions for 3 turns', () => {
    const a = arena({ p0: [['summon.ghost']], p1: [['shot']] });
    a.use(A1, 'summon.ghost').end();
    expect(minions(a, 0, 'wraith').map((u) => u.hp)).toEqual([10, 10]);
    a.pass(5);
    expect(minions(a, 0, 'wraith')).toHaveLength(0);
  });

  it('Wraiths: a Wraith\'s killer is Haunted for 2 turns', () => {
    const a = arena({ p0: [['summon.ghost']], p1: [['shot'], ['withstand']] });
    a.use(A1, 'summon.ghost').end();
    a.use(B1, 'shot', minions(a, 0, 'wraith')[0]!.id).end();
    expect([haunted(a, B1), haunted(a, B2)]).toEqual([true, false]);
  });

  it('Wraith Cold Grasp: 5 Affliction', () => {
    const a = arena({ p0: [['summon.ghost']], p1: [['withstand']] });
    a.use(A1, 'summon.ghost').end().pass(1);
    a.give(B1, 'armor', { stacks: 3 }).use(minions(a, 0, 'wraith')[0]!.id, 'wraith_cold_grasp', B1).end();
    expect(a.hp(B1)).toBe(95);
  });

  it('Restless Dead: 10 to all enemies at the end of each of the user\'s turns, for 2 turns', () => {
    const a = arena({ p0: [['channel.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'channel.ghost').end();
    const [h1, h2] = [a.hp(B1), a.hp(B2)];
    expect(h1 + h2).toBe(200 - 20 - 10); // 10 each, plus one Haunt tick
    a.pass(2);
    expect(a.hp(B1) + a.hp(B2)).toBe(h1 + h2 - 20 - 10);
    a.pass(2);
    expect(a.hp(B1) + a.hp(B2)).toBe(h1 + h2 - 30 - 10); // channel over (2 ticks); only the Haunt still ticks
  });

  it('Restless Dead: a random enemy is Haunted; each drift gives the user a Soul Fragment', () => {
    const a = arena({ p0: [['channel.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'channel.ghost').end();
    expect([haunted(a, B1) || haunted(a, B2), a.stacks(A1, 'soul_fragment')]).toEqual([true, 1]);
    a.pass(2);
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
  });

  it('Restless Dead: no drift (single enemy), no Soul Fragment', () => {
    const a = arena({ p0: [['channel.ghost']], p1: [['withstand']] });
    a.use(A1, 'channel.ghost').end();
    expect([haunted(a, B1), a.stacks(A1, 'soul_fragment')]).toEqual([true, 0]);
  });

  it('Through the Veil: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.ghost']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.ghost', B1).end().pass(1).use(A1, 'stab.ghost', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Through the Veil: Bypasses Invulnerable, but not Stealth (simplified ruling)', () => {
    const a = arena({ p0: [['stab.ghost']], p1: [['shot'], ['shot']] });
    a.give(B1, 'invulnerable', { duration: 2 }).use(A1, 'stab.ghost', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1).give(B2, 'stealth', { duration: 2 });
    expect(a.reject(() => a.use(A1, 'stab.ghost', B2))).toBe('bad_target');
  });

  it('Rend the Living: 30 Piercing', () => {
    const a = arena({ p0: [['ravage.ghost']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.ghost', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Rend the Living: for 2 turns, a Horrified target can\'t be healed; un-Horrified, they can', () => {
    const a = arena({ p0: [['ravage.ghost']], p1: [['shot'], ['heal']] });
    a.use(A1, 'ravage.ghost', B1).end().use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(95);
    const b = arena({ p0: [['ravage.ghost']], p1: [['shot'], ['heal']] });
    b.use(A1, 'ravage.ghost', B1).end().give(B1, 'horrified', { source: A1, duration: 2 }).use(B2, 'heal', B1).end();
    expect(b.hp(B1)).toBe(70);
  });

  it('Night Terror: invisible; the target\'s next Harmful skill passes through its targets, then they\'re Horrified for 2 turns', () => {
    const a = arena({ p0: [['mislead.ghost'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.ghost', B1).end();
    expect([seen(a, 0, B1, 'night_terror'), seen(a, 1, B1, 'night_terror')]).toEqual([true, false]);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'horrified')]).toEqual([100, true]);
    a.pass(3);
    expect(a.has(B1, 'horrified')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Night Terror: the targets stay Spectral for the rest of that turn (ruling); only the user is Horrified', () => {
    const a = arena({ p0: [['mislead.ghost'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.ghost', B1).end().use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect([a.hp(A2), a.has(B2, 'horrified')]).toEqual([100, false]);
    a.pass(1).use(B2, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Night Terror: Helpful skills don\'t set it off', () => {
    const a = arena({ p0: [['mislead.ghost'], ['shot']], p1: [['withstand', 'shot']] });
    a.use(A1, 'mislead.ghost', B1).end().use(B1, 'withstand').end();
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Frozen with Fear: Stunned for 1 turn and Haunted for 2; the first ally it drifts to is Stunned too', () => {
    const a = arena({ p0: [['stun.ghost']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.ghost', B1).end();
    expect([a.has(B1, 'stun'), a.hp(B1), haunted(a, B2), a.has(B2, 'stun')]).toEqual([true, 90, true, true]);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
  });

  it('Frozen with Fear: only the first drift stuns', () => {
    const a = arena({ p0: [['stun.ghost']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.ghost', B1).end().pass(2); // drifts back to B1
    expect([haunted(a, B1), a.has(B1, 'stun')]).toEqual([true, false]);
  });

  it('Ghostly Waltz: Spectral, 1 Might and 2 Swiftness for 3 turns', () => {
    const a = arena({ p0: [['dance.ghost']], p1: [['shot']] });
    a.use(A1, 'dance.ghost').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([100, 1, 2]);
    a.pass(5).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'might')]).toEqual([85, false]);
  });

  it('Ghostly Waltz: meanwhile the user can\'t be healed', () => {
    const a = arena({ p0: [['dance.ghost'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'dance.ghost').end().pass(1).use(A2, 'heal', A1).end();
    expect(a.hp(A1)).toBe(50);
  });

  it('Soul Transfer: 15 with no Soul Fragments', () => {
    const a = arena({ p0: [['heal.ghost'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.ghost', A2).end();
    expect([a.hp(A2), a.has(A2, 'leaping')]).toEqual([65, false]);
  });

  it('Soul Transfer: +10 per Soul Fragment spent, up to 2; with 2 spent, the ally Leaps', () => {
    const a = arena({ p0: [['heal.ghost'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 3 }).setHp(A2, 50).use(A1, 'heal.ghost', A2).end();
    expect([a.hp(A2), a.stacks(A1, 'soul_fragment'), a.has(A2, 'leaping')]).toEqual([85, 1, true]);
  });

  it('Soul Transfer: 1 Soul Fragment: +10 and no Leap', () => {
    const a = arena({ p0: [['heal.ghost'], ['shot']], p1: [['shot']] });
    a.give(A1, 'soul_fragment').setHp(A2, 50).use(A1, 'heal.ghost', A2).end();
    expect([a.hp(A2), a.stacks(A1, 'soul_fragment'), a.has(A2, 'leaping')]).toEqual([75, 0, false]);
  });

  it('Spirit Form: the ally is Spectral for 2 turns; each Harmful skill an enemy uses on them feeds the user a Soul Fragment', () => {
    const a = arena({ p0: [['bless.ghost'], ['shot']], p1: [['shot'], ['ravage']] });
    a.use(A1, 'bless.ghost', A2).end().use(B1, 'shot', A2).use(B2, 'ravage', A2).end();
    expect([a.hp(A2), a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment')]).toEqual([75, 2, 0]);
    a.pass(3);
    expect(a.has(A2, 'spirit_form')).toBe(false);
  });

  it('Spirit Mark: Haunted for 3 turns; each ally it drifts to is Horrified for 1 turn on arrival', () => {
    const a = arena({ p0: [['curse.ghost']], p1: [['withstand'], ['withstand']] });
    a.use(A1, 'curse.ghost', B1).end();
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified'), haunted(a, B2)]).toEqual([false, true, true]);
    a.use(B2, 'withstand').end(); // Horrified through the enemy's turn: no Buffs
    expect(a.has(B2, 'shield')).toBe(false);
    a.end(); // drifts back to B1
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([true, false]);
  });

  it('Unnerving Touch: 20 and Horrified for 1 turn', () => {
    const a = arena({ p0: [['smite.ghost']], p1: [['withstand']] });
    a.use(A1, 'smite.ghost', B1).end();
    expect([a.hp(B1), a.has(B1, 'horrified')]).toEqual([80, true]);
    a.use(B1, 'withstand').end();
    expect(a.has(B1, 'shield')).toBe(false);
    a.pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Unnerving Touch: each Helpful skill used on them meanwhile gives the user 1 Swiftness', () => {
    const a = arena({ p0: [['smite.ghost']], p1: [['withstand'], ['heal']] });
    a.use(A1, 'smite.ghost', B1).end().use(B1, 'withstand').use(B2, 'heal', B1).end();
    expect(a.stacks(A1, 'swiftness')).toBe(2);
  });

  it('Dirge of Spirits: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.ghost'], ['shot']], p1: [['taunt']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.ghost').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
  });

  it('Dirge of Spirits: an ally\'s Swiftness shrugs off a Taunt, spending 1 stack; without Swiftness it lands', () => {
    const a = arena({ p0: [['prayer.ghost'], ['shot']], p1: [['taunt'], ['taunt']] });
    a.give(A2, 'swiftness').use(A1, 'prayer.ghost').end().use(B1, 'taunt', A2).use(B2, 'taunt', A1).end();
    expect([a.has(A2, 'taunt'), a.stacks(A2, 'swiftness'), a.has(A1, 'taunt')]).toEqual([false, 0, true]);
  });

  it('Phantom Sweep: 20 and 15; whichever of the two has more HP is Isolated for 1 turn', () => {
    const a = arena({ p0: [['cleave.ghost']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'cleave.ghost', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([80, 35, true, false]);
    a.pass(2);
    expect(a.has(B1, 'isolated')).toBe(false);
  });

  it('Phantom Sweep: the secondary target is Isolated when it has more HP', () => {
    const a = arena({ p0: [['cleave.ghost']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'cleave.ghost', B1).end();
    expect([a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([false, true]);
  });

  it('Keening: all enemies Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.ghost']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.ghost').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.pass(4);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Keening: meanwhile, the user\'s side keeps Rushing through a turn without a skill', () => {
    const a = arena({ p0: [['shout.ghost'], ['charge.wind']], p1: [['shot']] });
    a.use(A1, 'shout.ghost').use(A2, 'charge.wind').end().pass(2);
    expect(a.has(A2, 'rushing')).toBe(true);
    const b = arena({ p0: [['shout'], ['charge.wind']], p1: [['shot']] });
    b.use(A1, 'shout').use(A2, 'charge.wind').end().pass(2);
    expect(b.has(A2, 'rushing')).toBe(false);
  });

  it('Ectoplasmic Shield: 20 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.ghost']], p1: [['shot']] });
    a.use(A1, 'withstand.ghost').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'spectral')]).toEqual([100, false]);
  });

  it('Ectoplasmic Shield: when it breaks, the user becomes Spectral for 1 turn', () => {
    const a = arena({ p0: [['withstand.ghost']], p1: [['smash'], ['shot']] });
    a.use(A1, 'withstand.ghost').end().use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'spectral')]).toEqual([95, true]); // 5 through, then Spectral
  });

  it('Beckoning Spirit: Taunts for 2 turns, and the Taunted enemy\'s Normal damage can\'t hurt the user', () => {
    const a = arena({ p0: [['taunt.ghost'], ['shot']], p1: [['shot', 'ravage'], ['shot']] });
    a.use(A1, 'taunt.ghost', B1).end();
    expect(find(a, B1, 'taunt')?.source).toBe(A1);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // only B2's shot hurt
    a.pass(1).use(B1, 'ravage', A1).end();
    expect(a.hp(A1)).toBe(60); // Piercing still hurts
  });

  it('Second Haunting: 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.ghost']], p1: [['curse']] });
    a.use(A1, 'titan.ghost').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([2, true, false]);
    a.pass(5);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Second Haunting: the first time the user would die, they vanish and return at the start of their next turn with 30 HP', () => {
    const a = arena({ p0: [['titan.ghost'], ['shot']], p1: [['smash'], ['shot']] });
    a.use(A1, 'titan.ghost').end().setHp(A1, 10).use(B1, 'smash', A1).end();
    expect(a.unit(A1).alive).toBe(true);
    a.end(); // the user's next turn: they return
    expect(a.hp(A1)).toBe(30);
    a.pass(1);
    expect(a.hp(A1)).toBe(30);
  });

  it('Second Haunting: while vanished, later hits that turn do nothing', () => {
    const a = arena({ p0: [['titan.ghost'], ['shot']], p1: [['smash'], ['shot']] });
    a.use(A1, 'titan.ghost').end().setHp(A1, 10).use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(true);
    a.pass(1);
    expect(a.hp(A1)).toBe(30);
  });
});

describe('Ghost costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 1], smash: ['Ar', 2], charge: ['nc', 1], riposte: ['r', 2], rage: ['S', 4],
    shot: ['r', 1], snipe: ['Ar', 2], trap: ['I', 3], maneuver: ['r', 3], companion: ['S', 1],
    bolt: ['I', 1], blast: ['SIr', 2], consume: ['I', 2], summon: ['r', 3], channel: ['AS', 3],
    stab: ['r', 0], ravage: ['AS', 2], mislead: ['r', 2], stun: ['r', 2], dance: ['AA', 4],
    heal: ['r', 1], bless: ['W', 2], curse: ['r', 1], smite: ['Sr', 1], prayer: ['Arr', 2],
    cleave: ['Ar', 1], shout: ['S', 3], withstand: ['r', 3], taunt: ['S', 3], titan: ['SW', 4],
  };
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(Object.entries(kit))('%s.ghost matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.ghost`]!;
    expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
  });
});
