// Spec-driven scenarios for the Prism fusion (Ice + Holy): Refract, Lens and all 30 skills, written
// from the in-game descriptions, the Refract glossary entry and docs/rules.md §21.25.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

const seenByFoe = (a: Arena, bearer: string, viewer: 0 | 1 = 1) =>
  viewFor(content, a.state, viewer).effects.filter((e) => e.bearer === bearer);

const cost = (s: string) => {
  const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
  return c;
};

describe('Prism keywords', () => {
  it('Refract: a Refracting hit also strikes one random other unit on the target side at half strength', () => {
    const a = arena({ p0: [['strike.prism']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'strike.prism', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.hp(B2), a.hp(B3)].sort((x, y) => x - y)).toEqual([90, 100]);
  });

  // BUG: Hovering Prism: "the user's direct hits Refract to a random other enemy at half strength" vs the refracted hit deals 0
  it.fails('Refract: the refracted damage rounds down to a multiple of 5', () => {
    const a = arena({ p0: [['summon.prism', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.prism').end().pass(1).use(A1, 'shot', B1).end(); // 15 refracts as 5
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 95]);
  });

  it('Lens: the next skill deals 50% more direct damage and does not Refract; the Lens is spent', () => {
    const a = arena({ p0: [['stab.prism', 'strike.prism']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'stab.prism', B1).end().pass(1); // 10, and Lens
    expect(a.has(A1, 'lens')).toBe(true);
    a.use(A1, 'strike.prism', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'lens')]).toEqual([160, 200, false]);
    a.pass(1).use(A1, 'strike.prism', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([140, 190]);
  });

  it('Lens: any skill spends it, even a Helpful one, and healing is not boosted (ruling)', () => {
    const a = arena({ p0: [['stab.prism', 'heal.prism'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'stab.prism', B1).end().pass(1);
    a.setHp(A2, 40).setHp(A3, 50).use(A1, 'heal.prism', A2).end();
    expect([a.hp(A2), a.hp(A3), a.has(A1, 'lens')]).toEqual([80, 50, false]); // 40, not 60, and no Refract
  });
});

describe('Prism skills', () => {
  it('Glintstrike: a refracted hit on a Frostbitten enemy is full strength', () => {
    const a = arena({ p0: [['strike.prism']], p1: [['shot'], ['shot']] });
    a.give(B2, 'frostbitten', { source: A1 }).use(A1, 'strike.prism', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it("Lightfall: 20 and 10 to the target's allies; next turn 10 more to those still Frost-debuffed", () => {
    const a = arena({ p0: [['smash.prism']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B3, 'chilled', { source: A1 });
    a.use(A1, 'smash.prism', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 90, 90]);
    a.end(); // start of the user's next turn
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([70, 90, 80]);
    a.pass(4);
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([70, 90, 80]); // only once
  });

  it("Lightspeed: 15; the user's next skill costs nothing but its cooldown is 2 turns longer", () => {
    const a = arena({ p0: [['charge.prism', 'smash.prism', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.prism', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(A1, 'smash.prism', B1);
    expect(a.state.players[0].queue[0]?.cost).toEqual(cost('nc'));
    a.end();
    const control = arena({ p0: [['smash.prism']], p1: [['shot']] });
    control.use(A1, 'smash.prism', B1).end();
    expect(a.cooldown(A1, 'smash.prism')).toBe(control.cooldown(A1, 'smash.prism') + 2);
    a.pass(1).use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost).toEqual(cost('r')); // only the next skill
  });

  it('Spectrum Ward: Invisible; counters the first Harmful skill, and a random ally of its user takes 15', () => {
    const a = arena({ p0: [['riposte.prism']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.prism').end();
    expect(seenByFoe(a, A1)).toEqual([]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([85, 100, 85]);
  });

  it("Spectrum Ward: doesn't catch Helpful skills, and lasts 1 turn", () => {
    const a = arena({ p0: [['riposte.prism']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.prism').end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Burning Glass: Anointed for 3 turns', () => {
    const a = arena({ p0: [['rage.prism']], p1: [['shot']] });
    a.use(A1, 'rage.prism').end();
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(4);
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Burning Glass: Lens for damaging the same enemy as on the previous turn, not a different one', () => {
    const a = arena({ p0: [['rage.prism', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.prism').end().pass(1);
    a.use(A1, 'shot', B1).end().pass(1);
    expect(a.has(A1, 'lens')).toBe(false);
    a.use(A1, 'shot', B1).end();
    expect(a.has(A1, 'lens')).toBe(true);
    const b = arena({ p0: [['rage.prism', 'shot']], p1: [['shot'], ['shot']] });
    b.use(A1, 'rage.prism').end().pass(1);
    b.use(A1, 'shot', B1).end().pass(1).use(A1, 'shot', B2).end();
    expect(b.has(A1, 'lens')).toBe(false);
  });

  it('Glint Shot: 15; a Helpful skill on their next turn leaves them Numb for 2 turns', () => {
    const a = arena({ p0: [['shot.prism']], p1: [['heal'], ['shot']] });
    a.use(A1, 'shot.prism', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.use(B1, 'heal', B1).end();
    expect(a.has(B1, 'numb')).toBe(true);
    a.pass(3);
    expect(a.has(B1, 'numb')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'numb')).toBe(false);
  });

  it('Glint Shot: a Harmful skill, or a Helpful one a turn later, leaves them free', () => {
    const a = arena({ p0: [['shot.prism'], ['shot.prism']], p1: [['shot', 'heal'], ['shot', 'heal']] });
    a.use(A1, 'shot.prism', B1).use(A2, 'shot.prism', B2).end();
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'numb')).toBe(false);
    a.pass(1).use(B1, 'heal', B1).use(B2, 'heal', B2).end();
    expect([a.has(B1, 'numb'), a.has(B2, 'numb')]).toEqual([false, false]);
  });

  it('Focal Point: Invisible target; 50 Piercing on the following turn', () => {
    const a = arena({ p0: [['snipe.prism']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.prism', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 100]);
  });

  it('Focal Point: on a kill, the damage left over hits a random ally of theirs at full strength', () => {
    const a = arena({ p0: [['snipe.prism']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 30).use(A1, 'snipe.prism', B1).end().end();
    expect([a.unit(B1).alive, a.hp(B2)]).toEqual([false, 80]);
  });

  it('Standing Decree: Invisible; Condemned, and the Condemnation returns after it triggers', () => {
    const a = arena({ p0: [['trap.prism']], p1: [['shot']] });
    a.use(A1, 'trap.prism', B1).end();
    expect(a.has(B1, 'condemned')).toBe(true);
    a.use(B1, 'shot', A1).end();
    const debuffs = ['weakness', 'vulnerable', 'confusion'].reduce((n, k) => n + a.stacks(B1, k), 0);
    expect([a.has(B1, 'condemned'), debuffs]).toEqual([false, 1]);
    a.end(); // end of the user's next turn
    expect(a.has(B1, 'condemned')).toBe(true);
  });

  it('Standing Decree: Invisible, so the opponent does not see the Condemnation', () => {
    const a = arena({ p0: [['trap.prism']], p1: [['shot']] });
    a.use(A1, 'trap.prism', B1).end();
    expect(seenByFoe(a, B1)).toEqual([]);
  });

  it('Standing Decree: after 3 turns it no longer returns', () => {
    const a = arena({ p0: [['trap.prism']], p1: [['shot']] });
    a.use(A1, 'trap.prism', B1).end().pass(6);
    a.use(B1, 'shot', A1).end().pass(2);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Afterglow: Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.prism']], p1: [['shot']] });
    a.use(A1, 'maneuver.prism').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Afterglow: next turn, the last skill used before it comes off cooldown, and the next skill is free', () => {
    const a = arena({ p0: [['smash.prism', 'maneuver.prism']], p1: [['shot']] });
    a.use(A1, 'smash.prism', B1).end().pass(1).use(A1, 'maneuver.prism').end().pass(1);
    expect(a.cooldown(A1, 'smash.prism')).toBe(0);
    a.use(A1, 'smash.prism', B1);
    expect(a.state.players[0].queue[0]?.cost).toEqual(cost('nc'));
  });

  it('Lumen Elk: a 45 HP permanent minion; Antler Glow gives Lens, Gore deals 15 and Sanctifies for 1 turn', () => {
    const a = arena({ p0: [['companion.prism'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.prism').end().pass(9);
    const elk = minions(a, 0, 'lumen_elk')[0]!;
    expect(elk.hp).toBe(45);
    a.use(elk.id, 'lumen_elk_antler_glow', A2).end();
    expect(a.has(A2, 'lens')).toBe(true);
    a.pass(1).use(elk.id, 'lumen_elk_gore', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([85, true]);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Hallowed Hoarfrost: 20 and Sanctified for 2 turns', () => {
    const a = arena({ p0: [['bolt.prism']], p1: [['shot']] });
    a.use(A1, 'bolt.prism', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify'), a.has(B1, 'chilled')]).toEqual([80, true, false]);
    a.pass(2);
    expect(a.has(B1, 'sanctify')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Hallowed Hoarfrost: each time the Sanctify heals someone, the target gains Chilled', () => {
    const a = arena({ p0: [['bolt.prism'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bolt.prism', B1).use(A2, 'shot', B1).end();
    expect([a.hp(A2), a.has(B1, 'chilled')]).toEqual([65, true]);
  });

  it('Colorless Nova: 25 Piercing to all enemies; each loses one Buff', () => {
    const a = arena({ p0: [['blast.prism']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'might').give(B2, 'armor', { stacks: 2 }).give(B2, 'immune');
    a.use(A1, 'blast.prism').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 75]);
    expect(a.has(B1, 'might')).toBe(false);
    expect(Number(a.has(B2, 'armor')) + Number(a.has(B2, 'immune'))).toBe(1);
  });

  it('Harvest of Grace: 5; every enemy Sanctify ends and the user heals 15 for each', () => {
    const a = arena({ p0: [['consume.prism'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'sanctify', { source: A1 }).give(B2, 'sanctify', { source: A1 }).give(A2, 'sanctify', { source: B1 });
    a.setHp(A1, 50).use(A1, 'consume.prism', B3).end();
    expect([a.hp(B3), a.hp(A1), a.has(B1, 'sanctify'), a.has(B2, 'sanctify'), a.has(A2, 'sanctify')]).toEqual([95, 80, false, false, true]);
  });

  it('Hovering Prism: 10 HP, gone after 3 turns', () => {
    const a = arena({ p0: [['summon.prism']], p1: [['shot']] });
    a.use(A1, 'summon.prism').end();
    expect(minions(a, 0, 'hovering_prism').map((m) => m.hp)).toEqual([10]);
    a.pass(4);
    expect(minions(a, 0, 'hovering_prism')).toHaveLength(1);
    a.pass(1);
    expect(minions(a, 0, 'hovering_prism')).toHaveLength(0);
  });

  // BUG: Hovering Prism: "the user's direct hits Refract to a random other enemy at half strength" vs the refracted hit deals 0
  it.fails('Hovering Prism: the user’s direct hits Refract to another enemy at half strength', () => {
    const a = arena({ p0: [['summon.prism', 'strike']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.prism').end();
    const prism = minions(a, 0, 'hovering_prism')[0]!;
    expect(prism.hp).toBe(10);
    a.pass(1).use(A1, 'strike', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it('Hovering Prism: once it falls, hits stop Refracting', () => {
    const a = arena({ p0: [['summon.prism', 'strike']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.prism').end();
    a.use(B1, 'shot', minions(a, 0, 'hovering_prism')[0]!.id).end();
    a.use(A1, 'strike', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
  });

  it('Dispersion: 10 and Sanctify to the target at the end of each user turn, for 3 turns', () => {
    const a = arena({ p0: [['channel.prism']], p1: [['shot']], hp: 200 });
    a.use(A1, 'channel.prism', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([190, true]);
    a.pass(6);
    expect(a.hp(B1)).toBe(170);
  });

  it('Dispersion: it Refracts to 1 more enemy each turn, for 5 and Sanctify', () => {
    const a = arena({ p0: [['channel.prism']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'channel.prism', B1).end();
    const others = () => [B2, B3].filter((u) => a.hp(u) < 100).length;
    expect(others()).toBe(1);
    expect([B2, B3].filter((u) => a.has(u, 'sanctify')).length).toBe(1);
    a.pass(2);
    expect(a.hp(B2) + a.hp(B3)).toBe(200 - 5 - 10);
  });

  it('Focused Needle: 10 and Lens; 20 (and no Lens) against a Condemned or Frostbitten enemy', () => {
    const a = arena({ p0: [['stab.prism'], ['stab.prism'], ['stab.prism']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'condemned', { source: A1 }).give(B3, 'frostbitten', { source: A1 });
    a.use(A1, 'stab.prism', B1).use(A2, 'stab.prism', B2).use(A3, 'stab.prism', B3).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 80, 80]);
    expect([a.has(A1, 'lens'), a.has(A2, 'lens'), a.has(A3, 'lens')]).toEqual([true, false, false]);
  });

  it('Cold Crusade: 20 Piercing to the target and every other Condemned enemy; those above 75 HP are Condemned', () => {
    const a = arena({ p0: [['ravage.prism']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'condemned', { source: A1 }).give(B1, 'armor', { stacks: 2 }).setHp(B2, 70);
    a.use(A1, 'ravage.prism', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 50, 100]);
    expect([a.has(B1, 'condemned'), a.has(B3, 'condemned')]).toEqual([true, false]);
  });

  it('Cold Crusade: a target left at or below 75 HP is not Condemned', () => {
    const a = arena({ p0: [['ravage.prism']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 60).use(A1, 'ravage.prism', B1).end();
    expect([a.hp(B1), a.has(B1, 'condemned')]).toEqual([40, false]);
  });

  it('Caught Light: Invisible; counters a Harmful skill', () => {
    const a = arena({ p0: [['mislead.prism'], ['shot']], p1: [['blast']] });
    a.use(A1, 'mislead.prism', B1).end();
    expect(seenByFoe(a, B1)).toEqual([]);
    a.use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 100]);
  });

  it('Caught Light: every unit the countered skill targeted gains Lens', () => {
    const a = arena({ p0: [['mislead.prism'], ['shot']], p1: [['blast']] });
    a.use(A1, 'mislead.prism', B1).end();
    expect(seenByFoe(a, B1)).toEqual([]);
    a.use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2), a.has(A1, 'lens'), a.has(A2, 'lens')]).toEqual([100, 100, true, true]);
  });

  it('Caught Light: a single-target skill gives Lens only to its target; lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.prism'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.prism', B1).end();
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(A2, 'lens'), a.has(A1, 'lens')]).toEqual([100, true, false]);
    const b = arena({ p0: [['mislead.prism'], ['shot']], p1: [['shot']] });
    b.use(A1, 'mislead.prism', B1).end().pass(2).use(B1, 'shot', A2).end();
    expect(b.hp(A2)).toBe(85);
  });

  it('Shattering Awe: 10; Frost debuffs end, then Stunned 1 turn and Condemned 1 turn per debuff ended', () => {
    const a = arena({ p0: [['stun.prism']], p1: [['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B1, 'chilled', { source: A1 });
    a.use(A1, 'stun.prism', B1).end();
    expect([a.hp(B1), a.has(B1, 'frostbitten'), a.has(B1, 'chilled'), a.has(B1, 'stun'), a.has(B1, 'condemned')]).toEqual([90, false, false, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.has(B1, 'condemned')).toBe(true); // 2 turns for 2 debuffs
    a.pass(1);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Shattering Awe: no Frost debuffs, no Stun', () => {
    const a = arena({ p0: [['stun.prism']], p1: [['shot']] });
    a.use(A1, 'stun.prism', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), a.has(B1, 'condemned')]).toEqual([90, false, false]);
  });

  it('Halo of Ice: Immune for 3 turns; Lens at the start of each turn, and Invulnerable while it holds Lens', () => {
    const a = arena({ p0: [['dance.prism', 'shot']], p1: [['curse', 'shot']] });
    a.use(A1, 'dance.prism').end();
    a.use(B1, 'curse', A1).end();
    expect([a.has(A1, 'confusion'), a.has(A1, 'lens')]).toEqual([false, true]);
    a.end(); // A1 holds the Lens
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end().use(A1, 'shot', B1).end(); // spends it: 22 or 23
    expect(a.hp(B1)).toBeLessThanOrEqual(78);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Diffused Light: 40 to the target and 20 to the ally with the least HP', () => {
    const a = arena({ p0: [['heal.prism'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 30).use(A1, 'heal.prism', A2).end();
    expect([a.hp(A2), a.hp(A3), a.hp(A1)]).toEqual([90, 50, 100]);
  });

  it('Diffused Light: no Refract when the target is already the least-HP ally', () => {
    const a = arena({ p0: [['heal.prism'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 80).setHp(A2, 30).setHp(A3, 90).use(A1, 'heal.prism', A2).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([80, 70, 90]);
  });

  it('Lens of Favor: Anointed until the end of their next turn', () => {
    const a = arena({ p0: [['bless.prism'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.prism', A2).end();
    expect([a.has(A2, 'anointed'), a.has(A2, 'lens')]).toEqual([true, false]);
    a.pass(1);
    expect(a.has(A2, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A2, 'anointed')).toBe(false);
  });

  it('Lens of Favor: an ally who already was Anointed also gains Lens', () => {
    const a = arena({ p0: [['bless.prism'], ['shot']], p1: [['shot']] });
    a.give(A2, 'anointed').use(A1, 'bless.prism', A2).end();
    expect([a.has(A2, 'anointed'), a.has(A2, 'lens')]).toEqual([true, true]);
  });

  it("Split Verdict: Condemned until the end of the user's next turn; a random ally of theirs is Sanctified as long", () => {
    const a = arena({ p0: [['curse.prism']], p1: [['shot'], ['shot']] });
    a.use(A1, 'curse.prism', B1).end();
    expect([a.has(B1, 'condemned'), a.has(B2, 'sanctify'), a.has(B1, 'sanctify')]).toEqual([true, true, false]);
    a.pass(1);
    expect([a.has(B1, 'condemned'), a.has(B2, 'sanctify')]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(B1, 'condemned'), a.has(B2, 'sanctify')]).toEqual([false, false]);
  });

  it('Glacial Rebuke: 20 and Sanctified for 1 turn; the first ally to damage them gains Lens', () => {
    const a = arena({ p0: [['smite.prism'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.prism', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify'), a.hp(A2)]).toEqual([50, true, 65]);
    expect([a.has(A2, 'lens'), a.has(A3, 'lens')]).toEqual([true, false]);
    a.pass(1);
    expect(a.has(B1, 'sanctify')).toBe(false);
  });

  it('Beacon of Mercy: allies heal 20 with 10 Shield for 1 turn; then the lowest unit on the field heals 40', () => {
    const a = arena({ p0: [['prayer.prism'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 70).setHp(B1, 30).use(A1, 'prayer.prism').end();
    expect([a.hp(A1), a.hp(A2), a.hp(B1)]).toEqual([70, 90, 70]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(65);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(50); // the Shield is gone
  });

  it('Beacon of Mercy: if an ally is the lowest, they get the 40', () => {
    const a = arena({ p0: [['prayer.prism'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 10).setHp(B1, 50).use(A1, 'prayer.prism').end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([70, 50]);
  });

  it('Split Beam: 20 and 10 to a random other enemy; the first of them to use a skill is Chilled for 2 turns', () => {
    const a = arena({ p0: [['cleave.prism']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.prism', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
    a.use(B2, 'shot', A1).use(B1, 'shot', A1).end();
    expect([a.has(B2, 'chilled'), a.has(B1, 'chilled')]).toEqual([true, false]);
    a.pass(3);
    expect(a.has(B2, 'chilled')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'chilled')).toBe(false);
  });

  it('Harsh Light: every ally gains Lens; Frostbitten or Sanctified enemies are Condemned for 1 turn', () => {
    const a = arena({ p0: [['shout.prism'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B2, 'sanctify', { source: A1 });
    a.use(A1, 'shout.prism').end();
    expect([a.has(A1, 'lens'), a.has(A2, 'lens')]).toEqual([true, true]);
    expect([a.has(B1, 'condemned'), a.has(B2, 'condemned'), a.has(B3, 'condemned')]).toEqual([true, true, false]);
    a.pass(1);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Ice Aegis: 25 Shield for 2 turns; when it breaks, Lens (and no Immune unless Anointed)', () => {
    const a = arena({ p0: [['withstand.prism']], p1: [['strike'], ['strike']] });
    a.use(A1, 'withstand.prism').end();
    a.use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.has(A1, 'lens')]).toEqual([100, false]);
    a.pass(1).use(B1, 'strike', A1).end(); // 25 Might-boosted: breaks
    expect([a.has(A1, 'lens'), a.has(A1, 'immune')]).toEqual([true, false]);
  });

  it('Ice Aegis: an Anointed user also becomes Immune for 1 turn when it breaks', () => {
    const a = arena({ p0: [['withstand.prism']], p1: [['smash']] });
    a.give(A1, 'anointed').use(A1, 'withstand.prism').end();
    a.use(B1, 'smash', A1).end();
    expect([a.has(A1, 'lens'), a.has(A1, 'immune')]).toEqual([true, true]);
  });

  it('Ice Aegis: the Shield lasts 2 turns', () => {
    const a = arena({ p0: [['withstand.prism']], p1: [['shot']] });
    a.use(A1, 'withstand.prism').end().pass(4);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Frozen Gleam: target Taunted by the user for 2 turns, and a random ally of theirs too', () => {
    const a = arena({ p0: [['taunt.prism'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'taunt.prism', B1).end();
    expect(['bad_target', 'taunted']).toContain(a.reject(() => a.use(B1, 'shot', A2)));
    const taunted = [B2, B3].filter((u) => a.has(u, 'taunt'));
    expect([a.has(B1, 'taunt'), taunted.length]).toEqual([true, 1]);
    a.pass(4);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Colossus of Light: 1 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.prism']], p1: [['curse']] });
    a.use(A1, 'titan.prism').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([1, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(4);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('Colossus of Light: half of a direct hit Refracts away, striking a random enemy', () => {
    const a = arena({ p0: [['titan.prism']], p1: [['ravage'], ['shot']] });
    a.use(A1, 'titan.prism').end();
    a.use(B1, 'ravage', A1).end(); // 25 Piercing (Armor doesn't apply)
    const lost = 100 - a.hp(A1);
    const bounced = 200 - a.hp(B1) - a.hp(B2);
    expect([12, 13]).toContain(lost); // half of 25
    expect(bounced).toBe(lost); // ruling: the amount they take strikes a random enemy
  });
});

describe('Prism costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Wr', 2], charge: ['S', 2], riposte: ['A', 3], rage: ['I', 4],
    shot: ['r', 0], snipe: ['Arr', 2], trap: ['r', 2], maneuver: ['r', 2], companion: ['II', 4],
    bolt: ['Ir', 1], blast: ['IA', 2], consume: ['r', 2], summon: ['I', 1], channel: ['I', 3],
    stab: ['A', 0], ravage: ['Wr', 1], mislead: ['A', 2], stun: ['r', 2], dance: ['AI', 5],
    heal: ['Wr', 3], bless: ['r', 2], curse: ['A', 2], smite: ['W', 1], prayer: ['I', 2],
    cleave: ['S', 1], shout: ['W', 3], withstand: ['r', 4], taunt: ['A', 3], titan: ['Ir', 4],
  };
  for (const [arch, [c, cd]] of Object.entries(table)) {
    it(`${arch}.prism: ${c} · ${cd}`, () => {
      const s = content.skills[`${arch}.prism`]!;
      expect([s.cost, s.cooldown]).toEqual([cost(c), cd]);
    });
  }
  it('Lumen Elk: Antler Glow (W), Gore (r)', () => {
    expect(content.skills.lumen_elk_antler_glow!.cost).toEqual(cost('W'));
    expect(content.skills.lumen_elk_gore!.cost).toEqual(cost('r'));
  });
});
