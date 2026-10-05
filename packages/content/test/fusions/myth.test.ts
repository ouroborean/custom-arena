// Spec-driven scenarios for the Myth fusion (Ice + Earth): Legend, Mythic, the Saga passive and all
// 30 skills, written from the in-game descriptions and docs/rules.md §21.24.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const SAGA = { p0c0: ['saga'] };

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

// Effects the opponent can see on a unit, ignoring Myth's public Saga and Legend.
const seenByFoe = (a: Arena, bearer: string) =>
  viewFor(content, a.state, 1).effects.filter((e) => e.bearer === bearer && e.defId !== 'saga' && e.defId !== 'legend');

const dur = (a: Arena, id: string, key: string) => a.effects(id).find((e) => e.defId === key)?.duration ?? null;

const cost = (s: string) => {
  const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
  return c;
};

describe('Myth keywords', () => {
  it('Saga: each Myth skill used gives 1 Legend; other skills give none', () => {
    const a = arena({ p0: [['stab.myth', 'shot']], p1: [['shot'], ['shot']], passives: SAGA });
    a.use(A1, 'stab.myth', B1).end();
    expect(a.stacks(A1, 'legend')).toBe(1);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'legend')).toBe(1);
  });

  it('Saga: killing an enemy character or minion gives 1 Legend', () => {
    const a = arena({ p0: [['shot']], p1: [['shot', 'charge.earth'], ['shot']], passives: SAGA });
    a.setHp(B2, 10).use(A1, 'shot', B2).end();
    expect([a.unit(B2).alive, a.stacks(A1, 'legend')]).toEqual([false, 1]);
    a.use(B1, 'charge.earth', A1).end();
    const boulder = minions(a, 1, 'boulder')[0]!;
    a.setHp(boulder.id, 10).use(A1, 'shot', boulder.id).end();
    expect([a.unit(boulder.id).alive, a.stacks(A1, 'legend')]).toEqual([false, 2]);
  });

  it('Saga: every character with a Myth skill carries it from the start (rules §21.0); others do not', () => {
    const a = arena({ p0: [['stab.myth'], ['shot']], p1: [['shot']] });
    expect([a.has(A1, 'saga'), a.has(A2, 'saga'), a.has(B1, 'saga')]).toEqual([true, false, false]);
  });

  it('Legend: at 3 the bearer becomes Mythic, gaining 20 max HP and 20 healing, and Legend resets', () => {
    const a = arena({ p0: [['stab.myth']], p1: [['shot']], passives: SAGA });
    a.give(A1, 'legend', { stacks: 2 }).use(A1, 'stab.myth', B1).end();
    expect([a.has(A1, 'mythic'), a.stacks(A1, 'legend'), a.unit(A1).maxHp, a.hp(A1)]).toEqual([true, 0, 120, 120]);
  });

  it('Mythic: 2 Armor (-10 Normal damage taken), but Piercing goes through', () => {
    const a = arena({ p0: [['stab.myth']], p1: [['shot', 'ravage']], passives: SAGA });
    a.give(A1, 'legend', { stacks: 2 }).use(A1, 'stab.myth', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(115);
    a.pass(1).use(B1, 'ravage', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it("Mythic: the bearer can't be Stunned", () => {
    const a = arena({ p0: [['stab.myth']], p1: [['stun']], passives: SAGA });
    a.give(A1, 'legend', { stacks: 2 }).use(A1, 'stab.myth', B1).end();
    a.use(B1, 'stun', A1).end();
    expect(a.has(A1, 'stun')).toBe(false);
  });

  it('Mythic: lasts 3 turns, then the max HP goes and Legend starts again from 0', () => {
    const a = arena({ p0: [['stab.myth']], p1: [['shot']], passives: SAGA });
    a.give(A1, 'legend', { stacks: 2 }).use(A1, 'stab.myth', B1).end();
    a.pass(4);
    expect(a.has(A1, 'mythic')).toBe(true);
    a.pass(1);
    expect([a.has(A1, 'mythic'), a.unit(A1).maxHp, a.stacks(A1, 'legend')]).toEqual([false, 100, 0]);
    expect(a.hp(A1)).toBeLessThanOrEqual(100);
  });

  it('Mythic: no Legend is gained while Mythic', () => {
    const a = arena({ p0: [['stab.myth']], p1: [['shot']], passives: SAGA });
    a.give(A1, 'legend', { stacks: 2 }).use(A1, 'stab.myth', B1).end();
    a.pass(1).use(A1, 'stab.myth', B1).end();
    expect([a.has(A1, 'mythic'), a.stacks(A1, 'legend')]).toEqual([true, 0]);
  });
});

describe('Myth skills', () => {
  it('Jotun Fist: 30 with no allied minions, 20 with one', () => {
    const a = arena({ p0: [['strike.myth'], ['charge.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.myth', B1).end();
    expect(a.hp(B1)).toBe(70);
    a.pass(1).use(A2, 'charge.earth', B2).use(A1, 'strike.myth', B1).end();
    expect(a.hp(B1)).toBe(50);
  });

  it('Jotun Fist: Mythic also hits a random other enemy for 15; not without Mythic', () => {
    const a = arena({ p0: [['strike.myth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.myth', B1).end();
    expect(a.hp(B2)).toBe(100);
    a.give(A1, 'mythic').pass(1).use(A1, 'strike.myth', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([40, 85]);
  });

  it('Mountain Stomp: 15 to the target and 10 to their allies', () => {
    const a = arena({ p0: [['smash.myth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.myth', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 90]);
    expect(minions(a, 0, 'boulder')).toHaveLength(0);
  });

  it('Mountain Stomp: +5 to each hit per allied Boulder', () => {
    const a = arena({ p0: [['smash.myth'], ['charge.earth']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A2, 'charge.earth', B2).end().pass(1); // B2 takes 10; one Boulder
    a.use(A1, 'smash.myth', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([180, 175]);
  });

  it('Mountain Stomp: Mythic creates a Boulder for each enemy hit', () => {
    const a = arena({ p0: [['smash.myth']], p1: [['shot'], ['shot']] });
    a.give(A1, 'mythic').use(A1, 'smash.myth', B1).end();
    expect(minions(a, 0, 'boulder')).toHaveLength(2);
  });

  it('Mammoth Charge: 15 and creates a Boulder when the user has none', () => {
    const a = arena({ p0: [['charge.myth']], p1: [['shot']] });
    a.use(A1, 'charge.myth', B1).end();
    expect([a.hp(B1), minions(a, 0, 'boulder').length]).toEqual([85, 1]);
  });

  it("Mammoth Charge: with a Boulder, it's destroyed to add half its HP to the hit", () => {
    const a = arena({ p0: [['charge.myth']], p1: [['shot']] });
    a.use(A1, 'charge.myth', B1).end().pass(5);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.setHp(boulder.id, 30).use(A1, 'charge.myth', B1).end();
    expect([a.hp(B1), a.unit(boulder.id).alive]).toEqual([85 - 30, false]);
    expect(minions(a, 0, 'boulder')).toHaveLength(0);
  });

  it("Mammoth Charge: Mythic uses the Boulder without destroying it (and doesn't make a second one)", () => {
    const a = arena({ p0: [['charge.myth']], p1: [['shot']] });
    a.use(A1, 'charge.myth', B1).end().pass(5);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.setHp(boulder.id, 30).give(A1, 'mythic').use(A1, 'charge.myth', B1).end();
    expect([a.unit(boulder.id).alive, minions(a, 0, 'boulder').length]).toEqual([true, 1]);
    expect(a.hp(B1)).toBeLessThan(85 - 15);
  });

  it('Runic Ward: Invisible; counters only the first Harmful skill on the user and creates a Boulder', () => {
    const a = arena({ p0: [['riposte.myth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.myth').end();
    expect(seenByFoe(a, A1)).toEqual([]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), minions(a, 0, 'boulder').length]).toEqual([85, 100, 1]);
  });

  it('Runic Ward: lasts 1 turn and makes no Boulder if nothing is countered', () => {
    const a = arena({ p0: [['riposte.myth']], p1: [['shot']] });
    a.use(A1, 'riposte.myth').end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), minions(a, 0, 'boulder').length]).toEqual([85, 0]);
  });

  it('Runic Ward: Mythic reflects the skill back at its user', () => {
    const a = arena({ p0: [['riposte.myth']], p1: [['shot']] });
    a.give(A1, 'mythic').use(A1, 'riposte.myth').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 85]);
  });

  it('Call of the Saga: a Boulder and Immune for 2 turns', () => {
    const a = arena({ p0: [['rage.myth']], p1: [['curse']] });
    a.use(A1, 'rage.myth').end();
    expect([minions(a, 0, 'boulder').length, a.has(A1, 'immune')]).toEqual([1, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(1);
    expect(a.has(A1, 'immune')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Call of the Saga: 2 Legend plus the Saga one reach 3, so the user becomes Mythic', () => {
    const a = arena({ p0: [['rage.myth']], p1: [['shot']], passives: SAGA });
    a.use(A1, 'rage.myth').end();
    expect([a.has(A1, 'mythic'), a.stacks(A1, 'legend')]).toEqual([true, 0]);
  });

  it('Hurl the Stone: 15 to an enemy, plus 5 per Legend the user has (the Saga one for this use included)', () => {
    const a = arena({ p0: [['shot.myth']], p1: [['shot']] });
    a.use(A1, 'shot.myth', B1).end();
    expect([a.stacks(A1, 'legend'), a.hp(B1)]).toEqual([1, 80]);
    a.pass(1).use(A1, 'shot.myth', B1).end();
    expect([a.stacks(A1, 'legend'), a.hp(B1)]).toEqual([2, 80 - 25]);
  });

  it('Hurl the Stone: while Mythic (no Legend), just 15', () => {
    const a = arena({ p0: [['shot.myth']], p1: [['shot']] });
    a.give(A1, 'mythic').use(A1, 'shot.myth', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Hurl the Stone: an allied Boulder shatters into 1 Legend per 15 HP it had; other allies are illegal', () => {
    const a = arena({ p0: [['shot.myth'], ['charge.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).end().pass(1); // B1 at 90
    const boulder = minions(a, 0, 'boulder')[0]!;
    expect(a.reject(() => a.use(A1, 'shot.myth', A2))).toBe('bad_target');
    a.setHp(boulder.id, 29).use(A1, 'shot.myth', boulder.id).end();
    // The Saga's Legend for the use, then 1 for the 29-HP Boulder; nothing is thrown.
    expect([a.unit(boulder.id).alive, a.stacks(A1, 'legend'), a.hp(B1)]).toEqual([false, 2, 90]);
  });

  it('Hurl the Stone: a full Boulder gives the most, 3 Legend: the user becomes Mythic', () => {
    const a = arena({ p0: [['shot.myth'], ['charge.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).end().pass(1);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.use(A1, 'shot.myth', boulder.id).end();
    expect([a.unit(boulder.id).alive, a.has(A1, 'mythic')]).toEqual([false, true]);
  });

  it("Giant's Spear: hidden target; grows each of the user's turns and lands at 60 Piercing", () => {
    const a = arena({ p0: [['snipe.myth']], p1: [['shot']] });
    a.use(A1, 'snipe.myth', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1);
    expect(a.hp(B1)).toBe(100);
    a.pass(4);
    expect(a.hp(B1)).toBe(40);
    a.pass(4);
    expect(a.hp(B1)).toBe(40); // it landed once
  });

  it("Giant's Spear: Piercing goes through Armor", () => {
    const a = arena({ p0: [['snipe.myth']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.myth', B1).end().pass(4);
    expect(a.hp(B1)).toBe(40);
  });

  it("Giant's Spear: lands early, at its current size, as soon as the user takes damage", () => {
    const a = arena({ p0: [['snipe.myth']], p1: [['shot']] });
    a.use(A1, 'snipe.myth', B1).end(); // 20, grows to 40 at the end of this turn
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(60);
    a.pass(4);
    expect(a.hp(B1)).toBe(60);
  });

  it('Troll Bridge: Invisible; an enemy repeating the skill they used on their previous turn takes 20', () => {
    const a = arena({ p0: [['trap.myth']], p1: [['shot', 'heal'], ['shot', 'heal']] });
    a.use(A1, 'trap.myth').end();
    expect([A1, B1, B2].flatMap((u) => seenByFoe(a, u))).toEqual([]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]); // no previous turn to repeat
    a.pass(1).use(B1, 'shot', A1).use(B2, 'heal', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]); // B2 switched skills
  });

  it('Troll Bridge: fires every repeat for 3 turns, then stops', () => {
    const a = arena({ p0: [['trap.myth']], p1: [['shot']], hp: 200 });
    a.use(A1, 'trap.myth').end();
    for (let i = 0; i < 4; i++) a.use(B1, 'shot', A1).end().pass(1);
    // shots on turns 2, 4, 6, 8: repeats on 4 and 6 are inside the 3 turns
    expect(a.hp(B1)).toBe(160);
  });

  it('Barrow: Stunned and Invulnerable until the end of the next turn, and 1 more Legend', () => {
    const a = arena({ p0: [['maneuver.myth', 'shot']], p1: [['shot']], passives: SAGA });
    a.use(A1, 'maneuver.myth').end();
    expect(a.stacks(A1, 'legend')).toBe(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    a.end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Mammoth: a 55 HP permanent minion whose Trample hits all enemies for 15', () => {
    const a = arena({ p0: [['companion.myth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.myth').end().pass(9);
    const mammoth = minions(a, 0, 'mammoth')[0]!;
    expect(a.unit(mammoth.id).hp).toBe(55);
    a.use(mammoth.id, 'mammoth_trample').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it("Mammoth: while it stands, enemies' Frost debuffs can't be ended by other skills", () => {
    const a = arena({ p0: [['companion.myth'], ['stun.prism']], p1: [['shot']] });
    a.use(A1, 'companion.myth').end().pass(1);
    a.give(B1, 'frostbitten', { source: A1 }).use(A2, 'stun.prism', B1).end();
    expect(a.has(B1, 'frostbitten')).toBe(true);
  });

  it("Mammoth: while it stands, enemies' Frost debuffs survive a cleanse", () => {
    const a = arena({ p0: [['companion.myth']], p1: [['rage.wind']] });
    a.use(A1, 'companion.myth').end();
    a.give(B1, 'frostbitten', { source: A1 }).give(B1, 'weakness', { source: A1 });
    a.use(B1, 'rage.wind').end();
    expect([a.has(B1, 'frostbitten'), a.has(B1, 'weakness')]).toEqual([true, false]);
  });

  it('Mammoth: once it falls, Frost debuffs can be removed again', () => {
    const a = arena({ p0: [['companion.myth']], p1: [['rage.wind'], ['shot']] });
    a.use(A1, 'companion.myth').end();
    const mammoth = minions(a, 0, 'mammoth')[0]!;
    a.setHp(mammoth.id, 10).give(B1, 'frostbitten', { source: A1 });
    a.use(B2, 'shot', mammoth.id).use(B1, 'rage.wind').end();
    expect([a.unit(mammoth.id).alive, a.has(B1, 'frostbitten')]).toEqual([false, false]);
  });

  it('Frost Rune: 25; 1 more Legend only if the target has a Frost debuff', () => {
    const a = arena({ p0: [['bolt.myth'], ['bolt.myth']], p1: [['shot'], ['shot']], passives: { p0c0: ['saga'], p0c1: ['saga'] } });
    a.give(B2, 'chilled', { source: A2 });
    a.use(A1, 'bolt.myth', B1).use(A2, 'bolt.myth', B2).end();
    expect([a.hp(B1), a.stacks(A1, 'legend'), a.stacks(A2, 'legend')]).toEqual([75, 1, 2]);
  });

  it("Frost Rune: Mythic spreads the target's Frost debuffs to a random ally of theirs", () => {
    const a = arena({ p0: [['bolt.myth']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B1, 'chilled', { source: A1 }).give(A1, 'mythic');
    a.use(A1, 'bolt.myth', B1).end();
    expect([a.has(B2, 'frostbitten'), a.has(B2, 'chilled'), a.has(B1, 'frostbitten')]).toEqual([true, true, true]);
  });

  it('Frost Rune: without Mythic nothing spreads', () => {
    const a = arena({ p0: [['bolt.myth']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).use(A1, 'bolt.myth', B1).end();
    expect(a.has(B2, 'frostbitten')).toBe(false);
  });

  it('Age of Ice: 25 to all enemies; an enemy minion it kills becomes an allied Boulder', () => {
    const a = arena({ p0: [['blast.myth']], p1: [['charge.earth'], ['shot']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    const theirs = minions(a, 1, 'boulder')[0]!;
    a.setHp(theirs.id, 20).use(A1, 'blast.myth').end();
    expect([a.hp(B1), a.hp(B2), a.unit(theirs.id).alive]).toEqual([75, 75, false]);
    expect(minions(a, 0, 'boulder')).toHaveLength(1);
  });

  it('Age of Ice: a minion that survives stays theirs without Mythic', () => {
    const a = arena({ p0: [['blast.myth']], p1: [['charge.earth']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    const theirs = minions(a, 1, 'boulder')[0]!;
    a.use(A1, 'blast.myth').end();
    expect([a.unit(theirs.id).alive, a.unit(theirs.id).hp, minions(a, 0, 'boulder').length]).toEqual([true, 20, 0]);
  });

  it('Age of Ice: Mythic turns every enemy minion it hits into an allied Boulder, dead or not', () => {
    const a = arena({ p0: [['blast.myth']], p1: [['charge.earth']] });
    a.pass(1).use(B1, 'charge.earth', A1).end();
    const theirs = minions(a, 1, 'boulder')[0]!;
    a.give(A1, 'mythic').use(A1, 'blast.myth').end();
    expect([a.unit(theirs.id).alive, minions(a, 1).length, minions(a, 0, 'boulder').length]).toEqual([false, 0, 1]);
  });

  it('Draught of Ages: 5 damage; the heal grows by 5 per round the battle has lasted', () => {
    const heal = (round: number) => {
      const a = arena({ p0: [['consume.myth']], p1: [['shot']], hp: 200 });
      a.pass(2 * round);
      a.setHp(A1, 50).use(A1, 'consume.myth', B1).end();
      expect(a.hp(B1)).toBe(195);
      return a.hp(A1) - 50;
    };
    const early = heal(0);
    expect(early).toBeGreaterThanOrEqual(5);
    expect(heal(2) - early).toBe(10);
  });

  it('Draught of Ages: the per-round bonus is capped at 40', () => {
    const a = arena({ p0: [['consume.myth']], p1: [['shot']] });
    a.pass(60).setHp(A1, 10).use(A1, 'consume.myth', B1).end();
    expect(a.hp(A1)).toBe(10 + 5 + 40); // the 5 drained, plus at most 40 more
  });

  it('Trollkin: 2 Trolls (20 HP) whose Club deals 10', () => {
    const a = arena({ p0: [['summon.myth']], p1: [['shot']] });
    a.use(A1, 'summon.myth').end().pass(1);
    const trolls = minions(a, 0, 'troll');
    expect(trolls.map((t) => t.hp)).toEqual([20, 20]);
    a.use(trolls[0]!.id, 'troll_club', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Trollkin: a Troll that dies turns to stone, an allied Boulder with 20 HP', () => {
    const a = arena({ p0: [['summon.myth']], p1: [['shot']] });
    a.use(A1, 'summon.myth').end();
    const troll = minions(a, 0, 'troll')[0]!;
    a.setHp(troll.id, 10).use(B1, 'shot', troll.id).end();
    const boulders = minions(a, 0, 'boulder');
    expect([a.unit(troll.id).alive, boulders.length, boulders[0]?.hp, boulders[0]?.maxHp]).toEqual([false, 1, 20, 20]);
  });

  it('Trollkin: after 3 turns the Trolls expire and both turn to stone', () => {
    const a = arena({ p0: [['summon.myth']], p1: [['shot']] });
    a.use(A1, 'summon.myth').end().pass(4);
    expect(minions(a, 0, 'troll')).toHaveLength(2);
    a.pass(1);
    expect(minions(a, 0, 'troll')).toHaveLength(0);
    expect(minions(a, 0, 'boulder').map((b) => b.hp)).toEqual([20, 20]);
  });

  it('Awakening the Ancients: a Boulder at the end of each of 3 user turns, then all awaken as Rime Giants', () => {
    const a = arena({ p0: [['channel.myth']], p1: [['shot']] });
    a.use(A1, 'channel.myth').end();
    expect(minions(a, 0, 'boulder')).toHaveLength(1);
    a.pass(2);
    expect(minions(a, 0, 'boulder')).toHaveLength(2);
    a.pass(3); // the channel's 3 turns end on the enemy turn after its third tick
    const giants = minions(a, 0, 'rime_giant');
    expect([minions(a, 0, 'boulder').length, giants.length, giants[0]?.hp]).toEqual([0, 3, 45]);
  });

  it("Awakening the Ancients: other allies' Boulders awaken too", () => {
    const a = arena({ p0: [['channel.myth'], ['charge.earth']], p1: [['shot']], hp: 200 });
    a.use(A2, 'charge.earth', B1).use(A1, 'channel.myth').end().pass(5);
    expect([minions(a, 0, 'boulder').length, minions(a, 0, 'rime_giant').length]).toEqual([0, 4]);
  });

  it('Rime Giant: Frost Maul deals 15 and costs nothing', () => {
    const a = arena({ p0: [['channel.myth']], p1: [['shot']] });
    a.use(A1, 'channel.myth').end().pass(5);
    const giant = minions(a, 0, 'rime_giant')[0]!;
    a.use(giant.id, 'rime_giant_frost_maul', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(content.skills.rime_giant_frost_maul!.cost).toEqual(cost('nc'));
  });

  it('Rimecut: 10, +5 per Frost debuff on the target', () => {
    const a = arena({ p0: [['stab.myth'], ['stab.myth'], ['stab.myth']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'chilled', { source: A1 });
    for (const k of ['frostbitten', 'chilled', 'numb']) a.give(B3, k, { source: A1 });
    a.use(A1, 'stab.myth', B1).use(A2, 'stab.myth', B2).use('p0c2', 'stab.myth', B3).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 85, 75]);
  });

  it('Rimecut: max 25 in all', () => {
    const a = arena({ p0: [['stab.myth']], p1: [['shot']] });
    for (const k of ['frostbitten', 'chilled', 'numb', 'snowbound']) a.give(B1, k, { source: A1 });
    a.use(A1, 'stab.myth', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Giant-Slayer: 25 Piercing, +20 if the target has more HP than the user', () => {
    const a = arena({ p0: [['ravage.myth'], ['ravage.myth']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'ravage.myth', B1).use(A2, 'ravage.myth', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 55]);
  });

  it('Giant-Slayer: Mythic always adds the bonus', () => {
    const a = arena({ p0: [['ravage.myth']], p1: [['shot']] });
    a.give(A1, 'mythic').setHp(B1, 60).use(A1, 'ravage.myth', B1).end();
    expect(a.hp(B1)).toBe(15);
  });

  it('Giant-Slayer: a kill gives 1 more Legend on top of the Saga (3 in all: Mythic)', () => {
    const a = arena({ p0: [['ravage.myth']], p1: [['shot'], ['shot']], passives: SAGA });
    a.setHp(B1, 20).use(A1, 'ravage.myth', B1).end();
    expect([a.unit(B1).alive, a.has(A1, 'mythic')]).toEqual([false, true]);
  });

  it('Giant-Slayer: no kill, no extra Legend', () => {
    const a = arena({ p0: [['ravage.myth']], p1: [['shot'], ['shot']], passives: SAGA });
    a.use(A1, 'ravage.myth', B1).end();
    expect(a.stacks(A1, 'legend')).toBe(1);
  });

  it('Frozen Riddle: Invisible; counters a Harmful skill', () => {
    const a = arena({ p0: [['mislead.myth']], p1: [['smash']] });
    a.use(A1, 'mislead.myth', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it("Frozen Riddle: their cooldowns don't tick down while they have a Frost debuff", () => {
    const run = (frost: boolean) => {
      const a = arena({ p0: [['mislead.myth']], p1: [['smash']] });
      if (frost) a.give(B1, 'frostbitten', { source: A1 });
      a.use(A1, 'mislead.myth', B1).end();
      a.use(B1, 'smash', A1).end();
      const after = a.cooldown(B1, 'smash');
      a.pass(2);
      return [after, a.cooldown(B1, 'smash')] as const;
    };
    const [c0, c1] = run(true);
    expect(c1).toBe(c0);
    const [d0, d1] = run(false);
    expect(d1).toBe(d0 - 1);
  });

  it('Turned to Stone: Stunned with 25 Shield for 3 turns', () => {
    const a = arena({ p0: [['stun.myth']], p1: [['shot']] });
    a.use(A1, 'stun.myth', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(4);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Turned to Stone: the 25 Shield absorbs hits; the Stun holds while it stands', () => {
    const a = arena({ p0: [['stun.myth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'stun.myth', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Turned to Stone: the Stun ends if the Shield breaks', () => {
    const a = arena({ p0: [['stun.myth'], ['smash']], p1: [['shot']] });
    a.use(A1, 'stun.myth', B1).use(A2, 'smash', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Turned to Stone: Mythic keeps the Stun when the Shield breaks', () => {
    const a = arena({ p0: [['stun.myth'], ['smash']], p1: [['shot']] });
    a.give(A1, 'mythic').use(A1, 'stun.myth', B1).use(A2, 'smash', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Retold Saga: 1 Might, Swiftness and Focus; 1 more of each per earlier use', () => {
    const a = arena({ p0: [['dance.myth']], p1: [['shot']] });
    const kit = () => ['might', 'swiftness', 'focus'].map((k) => a.stacks(A1, k));
    a.use(A1, 'dance.myth').end();
    expect(kit()).toEqual([1, 1, 1]);
    a.pass(5);
    expect(kit()).toEqual([0, 0, 0]); // 3 turns
    a.pass(6).use(A1, 'dance.myth').end();
    expect(kit()).toEqual([2, 2, 2]);
  });

  it('Rime Cairn: target ally heals 20 and the user creates a Boulder with 10 HP per enemy Frost debuff', () => {
    const a = arena({ p0: [['heal.myth'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B2, 'chilled', { source: A1 });
    a.setHp(A2, 50).use(A1, 'heal.myth', A2).end();
    expect([a.hp(A2), minions(a, 0, 'boulder').map((b) => b.hp)]).toEqual([70, [30]]);
  });

  it('Rime Cairn: the Boulder is capped at 40 HP', () => {
    const a = arena({ p0: [['heal.myth']], p1: [['shot'], ['shot']] });
    for (const k of ['frostbitten', 'chilled', 'numb']) a.give(B1, k, { source: A1 }).give(B2, k, { source: A1 });
    a.use(A1, 'heal.myth', A1).end();
    expect(minions(a, 0, 'boulder').map((b) => b.hp)).toEqual([40]);
  });

  it('Rime Cairn: no Frost debuffs, no Boulder', () => {
    const a = arena({ p0: [['heal.myth']], p1: [['shot']] });
    a.use(A1, 'heal.myth', A1).end();
    expect(minions(a, 0, 'boulder')).toHaveLength(0);
  });

  it('Ancestral Gift: a character ally gains 1 Might or 1 Armor (not both) for 2 turns', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['bless.myth'], ['shot']], p1: [['shot']], seed });
      a.use(A1, 'bless.myth', A2).end();
      expect(a.stacks(A2, 'might') + a.stacks(A2, 'armor')).toBe(1);
      a.pass(2);
      expect(a.stacks(A2, 'might') + a.stacks(A2, 'armor')).toBe(1);
      a.pass(1);
      expect(a.stacks(A2, 'might') + a.stacks(A2, 'armor')).toBe(0);
    }
  });

  it('Ancestral Gift: an allied minion gains both', () => {
    const a = arena({ p0: [['bless.myth'], ['charge.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).end().pass(1);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.use(A1, 'bless.myth', boulder.id).end();
    expect([a.stacks(boulder.id, 'might'), a.stacks(boulder.id, 'armor')]).toEqual([1, 1]);
  });

  it('Ancestral Gift: Mythic makes a non-minion ally Mythic until the end of their next turn', () => {
    const a = arena({ p0: [['bless.myth'], ['shot']], p1: [['shot']] });
    a.give(A1, 'mythic').use(A1, 'bless.myth', A2).end();
    expect(a.has(A2, 'mythic')).toBe(true);
    a.pass(2);
    expect(a.has(A2, 'mythic')).toBe(false);
  });

  it("Kinslayer's Doom: Confused for 2 turns", () => {
    const a = arena({ p0: [['curse.myth']], p1: [['shot'], ['shot']], passives: SAGA });
    a.use(A1, 'curse.myth', B1).end();
    expect([a.has(B1, 'confusion'), a.has(B2, 'confusion')]).toEqual([true, false]);
    a.pass(3);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it("Kinslayer's Doom: if the target dies before it ends, every ally of theirs is Confused for 2 turns", () => {
    const a = arena({ p0: [['curse.myth'], ['shot']], p1: [['shot'], ['shot'], ['shot']], passives: SAGA });
    a.use(A1, 'curse.myth', B1).end().pass(1);
    a.setHp(B1, 10).use(A2, 'shot', B1).end();
    expect([a.unit(B1).alive, a.has(B2, 'confusion'), a.has(B3, 'confusion')]).toEqual([false, true, true]);
  });

  it("Kinslayer's Doom: a death after it has ended spreads nothing", () => {
    const a = arena({ p0: [['curse.myth'], ['shot']], p1: [['shot'], ['shot']], passives: SAGA });
    a.use(A1, 'curse.myth', B1).end().pass(5);
    a.setHp(B1, 10).use(A2, 'shot', B1).end();
    expect([a.unit(B1).alive, a.has(B2, 'confusion')]).toEqual([false, false]);
  });

  it('Deed of Renown: 20; each ally who damages the target that turn gives the user 1 Legend', () => {
    const a = arena({ p0: [['smite.myth'], ['shot'], ['shot']], p1: [['shot'], ['shot']], passives: SAGA });
    a.use(A1, 'smite.myth', B1).use(A2, 'shot', B1).use('p0c2', 'shot', B2).end();
    expect([a.hp(B1), a.stacks(A1, 'legend')]).toEqual([65, 2]);
  });

  it('Deed of Renown: the window is 1 turn', () => {
    const a = arena({ p0: [['smite.myth'], ['shot']], p1: [['shot']], passives: SAGA });
    a.use(A1, 'smite.myth', B1).end().pass(1).use(A2, 'shot', B1).end();
    expect(a.stacks(A1, 'legend')).toBe(1);
  });

  it('Deed of Renown: Mythic gives those allies 1 Armor', () => {
    const a = arena({ p0: [['smite.myth'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'mythic').use(A1, 'smite.myth', B1).use(A2, 'shot', B1).use('p0c2', 'shot', B2).end();
    expect([a.stacks(A2, 'armor'), a.stacks('p0c2', 'armor')]).toEqual([1, 0]);
  });

  it('Song of the Saga: all allies heal 20, allied minions heal to full', () => {
    const a = arena({ p0: [['prayer.myth'], ['charge.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).end().pass(1);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.setHp(A1, 50).setHp(A2, 50).setHp(boulder.id, 5).use(A1, 'prayer.myth').end();
    expect([a.hp(A1), a.hp(A2), a.unit(boulder.id).hp]).toEqual([70, 70, 45]);
  });

  it('Song of the Saga: Mythic gives allies 20 max HP while the user stays Mythic', () => {
    const a = arena({ p0: [['titan.myth', 'prayer.myth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'titan.myth').end().pass(1).use(A1, 'prayer.myth').end();
    expect(a.unit(A2).maxHp).toBe(120);
    a.pass(10);
    expect([a.has(A1, 'mythic'), a.unit(A2).maxHp]).toEqual([false, 100]);
  });

  it("Jotun Sweep: 25 to the target; this use's own Legend (1) sweeps 1 random other enemy for 10; no Frostbite", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ seed, p0: [['cleave.myth']], p1: [['shot'], ['shot'], ['shot']], passives: SAGA });
      a.use(A1, 'cleave.myth', B1).end();
      expect([a.hp(B1), a.stacks(A1, 'legend')]).toEqual([75, 1]);
      expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 90]);
      expect([B1, B2, B3].some((b) => a.has(b, 'frostbitten'))).toBe(false);
    }
  });

  it('Jotun Sweep: with 2 Legend it sweeps 2 other enemies, each only once', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ seed, p0: [['cleave.myth']], p1: [['shot'], ['shot'], ['shot']], passives: SAGA });
      a.give(A1, 'legend').use(A1, 'cleave.myth', B1).end();
      expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 90, 90]);
    }
  });

  it('Jotun Sweep: Mythic sweeps every other enemy for 10 and Frostbites them for 1 turn (not the target)', () => {
    const a = arena({ p0: [['cleave.myth']], p1: [['shot'], ['shot'], ['shot']], passives: SAGA });
    a.give(A1, 'mythic').use(A1, 'cleave.myth', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 90, 90]);
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'frostbitten'), a.has(B3, 'frostbitten')]).toEqual([false, true, true]);
    a.pass(1);
    expect(a.has(B2, 'frostbitten')).toBe(false);
  });

  it('Jotun Sweep: reaching 3 Legend with this use makes the user Mythic first, so it sweeps everyone', () => {
    const a = arena({ p0: [['cleave.myth']], p1: [['shot'], ['shot'], ['shot']], passives: SAGA });
    a.give(A1, 'legend', { stacks: 2 }).use(A1, 'cleave.myth', B1).end();
    expect([a.has(A1, 'mythic'), a.hp(B2), a.hp(B3), a.has(B2, 'frostbitten')]).toEqual([true, 90, 90, true]);
  });

  it('Jotun Sweep: with no other enemy, the sweep finds no one', () => {
    const a = arena({ p0: [['cleave.myth']], p1: [['shot']], passives: SAGA });
    a.give(A1, 'legend').use(A1, 'cleave.myth', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Horn of the North: each enemy has one skill that is cooling down set back 2 turns; ready skills are untouched', () => {
    const a = arena({ p0: [['shout.myth']], p1: [['bolt', 'shot'], ['shot']] });
    a.end().use(B1, 'bolt', A1).end();
    const cd = a.cooldown(B1, 'bolt');
    expect(cd).toBeGreaterThan(0);
    a.use(A1, 'shout.myth').end();
    expect([a.cooldown(B1, 'bolt'), a.cooldown(B1, 'shot'), a.has(B1, 'intimidated')]).toEqual([cd + 2, 0, false]);
  });

  it('Horn of the North: an enemy with nothing cooling down is Intimidated for 2 turns instead', () => {
    const a = arena({ p0: [['shout.myth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.myth').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.has(B1, 'frostbitten')]).toEqual([true, true, false]);
    a.pass(2);
    expect(a.has(B1, 'intimidated')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it('Horn of the North: while the user is Mythic, 3 turns', () => {
    const a = arena({ p0: [['shout.myth']], p1: [['bolt']] });
    a.end().use(B1, 'bolt', A1).end();
    const cd = a.cooldown(B1, 'bolt');
    a.give(A1, 'mythic').use(A1, 'shout.myth').end();
    expect(a.cooldown(B1, 'bolt')).toBe(cd + 3);
  });

  it('Frozen Rampart: no Shield; creates an allied 25-HP Boulder, and each direct hit is split between the user and it', () => {
    const a = arena({ p0: [['withstand.myth']], p1: [['strike']] });
    a.use(A1, 'withstand.myth').end();
    const boulder = minions(a, 0, 'boulder')[0]!;
    expect([boulder.hp, boulder.maxHp, a.effects(A1).some((e) => e.defId === 'shield' || e.inline?.shield)]).toEqual([25, 25, false]);
    a.use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.unit(boulder.id).hp]).toEqual([90, 15]);
  });

  it('Frozen Rampart: a big hit can\'t be soaked whole — the user always takes their half', () => {
    const a = arena({ p0: [['withstand.myth']], p1: [['strike']] });
    a.use(A1, 'withstand.myth').end();
    a.give(B1, 'might', { stacks: 8 }).use(B1, 'strike', A1).end(); // 60
    expect([a.hp(A1), minions(a, 0, 'boulder').length]).toEqual([70, 0]);
  });

  it('Frozen Rampart: once no allied minion is left, hits land in full', () => {
    const a = arena({ p0: [['withstand.myth']], p1: [['strike'], ['strike']] });
    a.use(A1, 'withstand.myth').end();
    minions(a, 0, 'boulder')[0]!.hp = 1;
    a.use(B1, 'strike', A1).use(B2, 'strike', A1).end();
    expect([minions(a, 0, 'boulder').length, a.hp(A1)]).toEqual([0, 100 - 10 - 20]);
  });

  it('Frozen Rampart: only direct hits are split; damage over time isn\'t', () => {
    const a = arena({ p0: [['withstand.myth']], p1: [['shot']] });
    a.give(A1, 'ignite', { source: B1 }).use(A1, 'withstand.myth').end().pass(1);
    expect([a.hp(A1) < 100, minions(a, 0, 'boulder')[0]?.hp]).toEqual([true, 25]);
  });

  it('Frozen Rampart: any allied minion can take the other half', () => {
    const a = arena({ p0: [['withstand.myth', 'companion.myth']], p1: [['strike']] });
    a.use(A1, 'companion.myth').end().pass(1);
    for (const u of minions(a, 0)) u.hp = 1000;
    a.pass(2).use(A1, 'withstand.myth').end();
    for (const u of minions(a, 0)) u.hp = 1000;
    a.use(B1, 'strike', A1).end();
    expect([a.hp(A1), minions(a, 0).filter((u) => u.hp === 990).length]).toEqual([90, 1]);
  });

  it("Frozen Rampart: it lasts until the user's next turn; the Boulder stays", () => {
    const a = arena({ p0: [['withstand.myth']], p1: [['shot']] });
    a.use(A1, 'withstand.myth').end().pass(1);
    expect(a.has(A1, 'frozen_rampart')).toBe(false);
    a.end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), minions(a, 0, 'boulder')[0]?.hp]).toEqual([85, 25]);
  });

  it('Old Feud: the target is Taunted until the user becomes Mythic; then the feud is settled for 25 damage', () => {
    const a = arena({ p0: [['taunt.myth', 'stab.myth'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.myth', B1).end(); // 1 Legend
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end().use(A1, 'stab.myth', B2).end(); // 2 Legend
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end().use(A1, 'stab.myth', B2).end(); // 3 Legend: Mythic
    expect([a.has(A1, 'mythic'), a.hp(B1), a.has(B1, 'taunt')]).toEqual([true, 75, false]);
    expect(() => a.use(B1, 'shot', A2)).not.toThrow();
  });

  it('Old Feud: without Mythic it ends after 4 turns, with no damage', () => {
    const a = arena({ p0: [['taunt.myth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.myth', B1).end().pass(6);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end().pass(1);
    expect(() => a.use(B1, 'shot', A2)).not.toThrow();
    expect(a.hp(B1)).toBe(100);
  });

  it('Old Feud: if the user is already Mythic, it is a plain 2-turn Taunt', () => {
    const a = arena({ p0: [['taunt.myth'], ['shot']], p1: [['shot']] });
    a.give(A1, 'mythic').use(A1, 'taunt.myth', B1).end().pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    expect(a.has(A1, 'old_feud_oath')).toBe(false);
    a.end().pass(1);
    expect(() => a.use(B1, 'shot', A2)).not.toThrow();
  });

  it('Awakened Giant: Mythic now (with its max HP) and Immune for as long', () => {
    const a = arena({ p0: [['titan.myth']], p1: [['curse']], passives: SAGA });
    a.use(A1, 'titan.myth').end();
    expect([a.has(A1, 'mythic'), a.has(A1, 'immune'), a.unit(A1).maxHp]).toEqual([true, true, 120]);
    expect(dur(a, A1, 'immune')).toBe(dur(a, A1, 'mythic'));
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Awakened Giant: 3 turns, +1 per Legend the user had', () => {
    const a = arena({ p0: [['titan.myth']], p1: [['shot']] });
    a.use(A1, 'titan.myth').end();
    expect(dur(a, A1, 'mythic')).toBe(2 * 3 - 1);
    const b = arena({ p0: [['titan.myth']], p1: [['shot']] });
    b.give(A1, 'legend', { stacks: 2 }).use(A1, 'titan.myth').end();
    expect([dur(b, A1, 'mythic'), b.stacks(A1, 'legend')]).toEqual([2 * 5 - 1, 0]);
  });

  it('Minion skills: Trample, Club and Frost Maul are Harmful', () => {
    for (const id of ['mammoth_trample', 'troll_club', 'rime_giant_frost_maul']) {
      expect(content.skills[id]!.tags).toContain('Harmful');
    }
  });
});

describe('Myth costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    strike: ['W', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['r', 1], rage: ['SI', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['W', 3], maneuver: ['r', 4], companion: ['I', 1],
    bolt: ['Ir', 1], blast: ['Irr', 2], consume: ['W', 2], summon: ['I', 1], channel: ['Ir', 3],
    stab: ['r', 0], ravage: ['Wr', 2], mislead: ['A', 2], stun: ['Ar', 4], dance: ['AI', 5],
    heal: ['r', 1], bless: ['nc', 0], curse: ['r', 2], smite: ['W', 1], prayer: ['Irr', 2],
    cleave: ['W', 1], shout: ['S', 3], withstand: ['r', 3], taunt: ['W', 3], titan: ['IW', 4],
  };
  for (const [arch, [c, cd]] of Object.entries(table)) {
    it(`${arch}.myth: ${c} · ${cd}`, () => {
      const s = content.skills[`${arch}.myth`]!;
      expect([s.cost, s.cooldown]).toEqual([cost(c), cd]);
    });
  }
  it('Mammoth Trample (r), Troll Club (r)', () => {
    expect(content.skills.mammoth_trample!.cost).toEqual(cost('r'));
    expect(content.skills.troll_club!.cost).toEqual(cost('r'));
  });
});
