// Spec-driven tests for the Crystal fusion (Ice + Ice), written from the in-game descriptions,
// docs/rules.md §21.2 and the "Pure fusions" design doc. Units: A1..A3 = p0c0..p0c2 (player 1, odd
// turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { parseCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.defId === defId && u.alive);
const fromSkill = (a: Arena, id: string, skill: string) => a.effects(id).some((e) => e.sourceSkill === skill);
const dur = (a: Arena, id: string, key: string) => a.effects(id).find((e) => e.defId === key)?.duration ?? 0;
const shield = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => n + ((e.inline ?? content.statuses[e.defId])?.shield ? e.value : 0), 0);

describe('Crystal keywords', () => {
  it('Brittle: 5 more direct damage taken per stack', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Brittle: indirect damage isn\'t increased', () => {
    const a = arena({ p0: [['channel']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).use(A1, 'channel').end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Brittle: max 3', () => {
    const a = arena({ p0: [['strike.crystal']], p1: [['shot']] });
    for (const s of ['frostbitten', 'chilled', 'numb']) a.give(B1, s, { source: A1, duration: 4 });
    a.give(B1, 'brittle', { stacks: 1, source: A1 });
    a.use(A1, 'strike.crystal', B1).end();
    expect(a.stacks(B1, 'brittle')).toBe(3);
  });

  it('Brittle: at 3, the next direct hit Shatters: 20 more, Shattered for 2 turns, Brittle removed', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 3, source: A1 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 15 - 20);
    expect([a.has(B1, 'brittle'), a.has(B1, 'shattered')]).toEqual([false, true]);
    a.pass(2);
    expect(a.has(B1, 'shattered')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'shattered')).toBe(false);
  });

  it('Brittle: fewer than 3 stacks never Shatter', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).use(A1, 'shot', B1).end();
    expect([a.stacks(B1, 'brittle'), a.has(B1, 'shattered')]).toEqual([2, false]);
  });

  it('Diamond: no single hit takes more than 15 HP', () => {
    const a = arena({ p0: [['shot']], p1: [['smash'], ['shot']] });
    a.give(A1, 'diamond').pass(1).use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100 - 15 - 15); // two separate hits, each capped
  });

  it('Diamond: counted after Shield', () => {
    const a = arena({ p0: [['shot']], p1: [['blast']] });
    a.give(A1, 'diamond').give(A1, 'shield', { value: 25 }).pass(1).use(B1, 'blast').end();
    expect([a.hp(A1), shield(a, A1)]).toEqual([90, 0]); // 35 - 25 Shield = 10 HP, under the cap
  });

  it('Diamond: doesn\'t affect hits of 15 or less', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'diamond').pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });
});

describe('Crystal skills', () => {
  it('Faceted Hammer: 20 and 1 Brittle; each other Frost debuff ends for 1 more Brittle', () => {
    const a = arena({ p0: [['strike.crystal']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1, duration: 4 }).give(B1, 'chilled', { source: A1, duration: 4 });
    a.use(A1, 'strike.crystal', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.stacks(B1, 'brittle'), a.has(B1, 'frostbitten'), a.has(B1, 'chilled')]).toEqual([3, false, false]);
    a.pass(3).use(A1, 'strike.crystal', B2).end();
    expect(a.stacks(B2, 'brittle')).toBe(1);
  });

  it('Crystal Quake: 25 and 1 Brittle, then the Brittle bursts for 10 per stack to each ally', () => {
    const a = arena({ p0: [['smash.crystal']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'brittle', { stacks: 1, source: A1 }).use(A1, 'smash.crystal', B1).end();
    expect(a.hp(B1)).toBe(70); // 25 + 5 from the Brittle already there
    expect(a.has(B1, 'brittle')).toBe(false);
    expect([a.hp(B2), a.hp(B3)]).toEqual([80, 80]); // 2 stacks burst
  });

  it('Shard Rush: 15 and 1 Brittle; the user has Diamond until they next use a skill', () => {
    const a = arena({ p0: [['charge.crystal', 'shot']], p1: [['smash']] });
    a.use(A1, 'charge.crystal', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle'), a.has(A1, 'diamond')]).toEqual([85, 1, true]);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(85); // the 25 is capped at 15
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'diamond')]).toEqual([85 - 15 - 5, false]);
  });

  it('Shard Rush: no Focus', () => {
    const a = arena({ p0: [['charge.crystal']], p1: [['shot']] });
    a.use(A1, 'charge.crystal', B1).end();
    expect(a.has(A1, 'focus')).toBe(false);
  });

  it('Hoarfrost Guard: counters the first Harmful skill; its user is Frostbitten and the user Frostborn', () => {
    const a = arena({ p0: [['riposte.crystal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.crystal').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // only the first is countered
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'frostbitten'), a.has(A1, 'frostborn')]).toEqual([true, false, true]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target'); // can't touch them
  });

  it('Flawless: Diamond and 2 Might for 3 turns, but no healing', () => {
    const a = arena({ p0: [['rage.crystal', 'shot'], ['heal']], p1: [['smash']] });
    a.setHp(A1, 50).use(A1, 'rage.crystal').use(A2, 'heal', A1).end();
    expect([a.has(A1, 'diamond'), a.stacks(A1, 'might'), a.hp(A1)]).toEqual([true, 2, 50]);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(35);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Rime Splinter: 15; for 1 turn the target\'s Frost debuffs don\'t count down', () => {
    const run = (skill: string) => {
      const a = arena({ p0: [[skill], ['strike.ice']], p1: [['shot']] });
      a.use(A2, 'strike.ice', B1).use(A1, skill, B1).end();
      return a;
    };
    const a = run('shot.crystal');
    expect(a.hp(B1)).toBe(100 - 25 - 15);
    expect(dur(a, B1, 'frostbitten')).toBe(dur(run('shot'), B1, 'frostbitten') + 2);
  });

  it('Crystal Lance: on the following turn, 3 shards of 5 Piercing, each leaving 1 Brittle (so they hit 5, 10, 15)', () => {
    const a = arena({ p0: [['snipe.crystal']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.crystal', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle')]).toEqual([100, 0]);
    a.end();
    // Piercing ignores the Armor; each shard lands, then leaves its Brittle for the next.
    expect([a.hp(B1), a.stacks(B1, 'brittle'), a.has(B1, 'shattered')]).toEqual([100 - 5 - 10 - 15, 3, false]);
  });

  it('Crystal Lance: it leaves them at 3 Brittle, so the next direct hit Shatters them', () => {
    const a = arena({ p0: [['snipe.crystal'], ['shot']], p1: [['shot']] });
    a.use(A1, 'snipe.crystal', B1).end().end();
    a.use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'shattered'), a.has(B1, 'brittle')]).toEqual([70 - 15 - 15 - 20, true, false]);
  });

  it('Crystal Lance: Brittle already on them makes the shards hit harder, and a shard can Shatter them', () => {
    const a = arena({ p0: [['snipe.crystal']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 1, source: A1 }).use(A1, 'snipe.crystal', B1).end().end();
    // 10 (→2), 15 (→3), then the third shard hits at 3: 20 and the Shatter's 20; it then leaves 1 Brittle.
    expect([a.hp(B1), a.has(B1, 'shattered'), a.stacks(B1, 'brittle')]).toEqual([100 - 10 - 15 - 20 - 20, true, 1]);
  });

  it('Crystal Lance: Channeled — stunning the user stops it', () => {
    const a = arena({ p0: [['snipe.crystal']], p1: [['stun']] });
    a.use(A1, 'snipe.crystal', B1).end();
    a.use(B1, 'stun', A1).end();
    expect([a.hp(B1), a.has(B1, 'brittle')]).toEqual([100, false]);
  });

  it('Hairline Fracture: the target\'s first Harmful skill raises their Brittle to 3', () => {
    const a = arena({ p0: [['trap.crystal']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap.crystal', B1).end();
    a.use(B1, 'heal', B1).end(); // Helpful: nothing
    expect(a.stacks(B1, 'brittle')).toBe(0);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'brittle')).toBe(3);
  });

  it('Hairline Fracture: expires after 2 turns', () => {
    const a = arena({ p0: [['trap.crystal']], p1: [['shot']] });
    a.use(A1, 'trap.crystal', B1).end().pass(4).use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'brittle')).toBe(0);
  });

  it('Crystal Cocoon: Diamond for 2 turns; each enemy hit it caps gives the attacker 1 Brittle', () => {
    const a = arena({ p0: [['maneuver.crystal']], p1: [['smash'], ['shot']] });
    a.use(A1, 'maneuver.crystal').end();
    expect([a.has(A1, 'diamond'), a.has(A1, 'invulnerable')]).toEqual([true, false]);
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    // Smash's 25 is capped (Brittle for B1); Shot's 15 isn't (none for B2).
    expect([a.hp(A1), a.stacks(B1, 'brittle'), a.stacks(B2, 'brittle')]).toEqual([70, 1, 0]);
  });

  it('Crystal Cocoon: it ends after 2 turns', () => {
    const a = arena({ p0: [['maneuver.crystal']], p1: [['smash']] });
    a.use(A1, 'maneuver.crystal').end().pass(2);
    expect(a.has(A1, 'diamond')).toBe(true);
    a.pass(2);
    expect([a.has(A1, 'diamond'), a.has(A1, 'crystal_cocoon')]).toEqual([false, false]);
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'brittle')]).toEqual([75, 0]);
  });

  it('Crystal Golem: a permanent 40 HP Golem, with no Diamond for allies', () => {
    const a = arena({ p0: [['companion.crystal'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'companion.crystal').end();
    expect(minions(a, 'crystal_golem').map((u) => u.hp)).toEqual([40]);
    a.pass(9);
    expect(minions(a, 'crystal_golem').length).toBe(1);
    expect([a.has(A2, 'diamond'), a.has(A1, 'diamond')]).toEqual([false, false]);
  });

  it('Shard Burst: 10 and 1 Brittle to every enemy', () => {
    const a = arena({ p0: [['companion.crystal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.crystal').end().pass(1);
    a.use(minions(a, 'crystal_golem')[0]!.id, 'golem_shard_slam').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B1, 'brittle'), a.stacks(B2, 'brittle')]).toEqual([90, 90, 1, 1]);
  });

  it('Quartz Spike: 20 damage; one of their Buffs crystallizes into 2 Brittle', () => {
    const a = arena({ p0: [['bolt.crystal']], p1: [['shot']] });
    a.give(B1, 'might').give(B1, 'focus').use(A1, 'bolt.crystal', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle'), a.has(B1, 'mark')]).toEqual([80, 2, false]);
    expect([a.has(B1, 'might'), a.has(B1, 'focus')].filter(Boolean).length).toBe(1);
  });

  it('Quartz Spike: with no Buffs, 1 Brittle', () => {
    const a = arena({ p0: [['bolt.crystal']], p1: [['shot']] });
    a.use(A1, 'bolt.crystal', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle')]).toEqual([80, 1]);
  });

  it('Hard Freeze: 25 to all; Chilled deepens to Frostbitten, Numb to Chilled', () => {
    const a = arena({ p0: [['blast.crystal']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1, duration: 2 }).give(B2, 'numb', { source: A1, duration: 2 });
    a.use(A1, 'blast.crystal').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 75]);
    expect([a.has(B1, 'frostbitten'), a.has(B1, 'chilled')]).toEqual([true, false]);
    expect([a.has(B2, 'chilled'), a.has(B2, 'numb')]).toEqual([true, false]);
    expect([a.has(B3, 'chilled'), a.has(B3, 'frostbitten'), a.has(B3, 'numb')]).toEqual([false, false, false]);
    a.pass(2);
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'chilled')]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(B1, 'frostbitten'), a.has(B2, 'chilled')]).toEqual([false, false]);
  });

  it('Harvest Shards: 10 and 1 Brittle; it’s harvested at once for 10 Shield', () => {
    const a = arena({ p0: [['consume.crystal']], p1: [['shot']] });
    a.use(A1, 'consume.crystal', B1).end();
    expect([a.hp(B1), a.has(B1, 'brittle'), shield(a, A1)]).toEqual([90, false, 10]);
  });

  it('Harvest Shards: Brittle already there is harvested too, 10 Shield per stack', () => {
    const a = arena({ p0: [['consume.crystal']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).use(A1, 'consume.crystal', B1).end();
    expect([a.has(B1, 'brittle'), shield(a, A1)]).toEqual([false, 30]);
    expect(a.hp(B1)).toBe(80); // 10 + 10 from the 2 Brittle
  });

  it('Sentinel Shards: 2 Sentinels (15 HP, Diamond) for 3 turns', () => {
    const a = arena({ p0: [['summon.crystal']], p1: [['smash']] });
    a.use(A1, 'summon.crystal').end();
    const s = minions(a, 'sentinel');
    expect(s.map((u) => u.hp)).toEqual([15, 15]);
    expect(s.every((u) => a.has(u.id, 'diamond'))).toBe(true);
    a.pass(5);
    expect(minions(a, 'sentinel')).toHaveLength(0);
  });

  it('Glint: 10 and 1 Brittle', () => {
    const a = arena({ p0: [['summon.crystal']], p1: [['shot']] });
    a.use(A1, 'summon.crystal').end().pass(1);
    a.use(minions(a, 'sentinel')[0]!.id, 'sentinel_glint', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle')]).toEqual([90, 1]);
  });

  it('Accretion: each turn, enemies without Brittle gain 1, enemies with Brittle take 10', () => {
    const a = arena({ p0: [['channel.crystal']], p1: [['shot'], ['shot']] });
    a.give(B1, 'brittle', { stacks: 1, source: A1 });
    a.use(A1, 'channel.crystal').end();
    expect([a.hp(B1), a.stacks(B1, 'brittle'), a.hp(B2), a.stacks(B2, 'brittle')]).toEqual([90, 1, 100, 1]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);
    a.pass(2); // 3 turns only
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);
  });

  it('Ice Pick: 10, or 20 at or below 60 HP; chips one Frost debuff (not Brittle) for 10 more', () => {
    const a = arena({ p0: [['stab.crystal']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1, duration: 4 }).give(B1, 'chilled', { source: A1, duration: 4 });
    a.setHp(B2, 60).give(B3, 'brittle', { stacks: 1, source: A1 });
    a.use(A1, 'stab.crystal', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.has(B1, 'frostbitten'), a.has(B1, 'chilled')].filter(Boolean)).toHaveLength(1);
    a.pass(1).use(A1, 'stab.crystal', B2).end();
    expect(a.hp(B2)).toBe(40);
    a.pass(1).use(A1, 'stab.crystal', B3).end();
    expect([a.hp(B3), a.stacks(B3, 'brittle')]).toEqual([85, 1]); // 10 + Brittle's 5; Brittle isn't chipped
  });

  it('Breaking Point: 40 Piercing damage (ignores Armor), and the user gains 1 Brittle', () => {
    const a = arena({ p0: [['ravage.crystal']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.crystal', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'brittle'), a.has(B1, 'brittle')]).toEqual([60, 1, false]);
  });

  it("Breaking Point: the user's Brittle is real: hits on them grow, and it builds toward a Shatter", () => {
    const a = arena({ p0: [['ravage.crystal']], p1: [['shot']] });
    a.use(A1, 'ravage.crystal', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(80);
    const b = arena({ p0: [['ravage.crystal']], p1: [['shot']] });
    b.give(A1, 'brittle', { stacks: 2, source: B1 }).use(A1, 'ravage.crystal', B1).end();
    b.use(B1, 'shot', A1).end();
    expect([b.hp(A1), b.has(A1, 'shattered')]).toEqual([100 - 15 - 15 - 20, true]);
  });

  it('Frozen Gambit: the first Harmful skill costing 2 or more is countered, and they gain 1 Brittle per energy', () => {
    const a = arena({ p0: [['mislead.crystal'], ['shot']], p1: [['smash'], ['snipe']] });
    a.use(A1, 'mislead.crystal', B1).end();
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.hp(A2), a.stacks(B1, 'brittle')]).toEqual([100, 100, 2]);
    const b = arena({ p0: [['mislead.crystal']], p1: [['snipe']] });
    b.use(A1, 'mislead.crystal', B1).end();
    b.use(B1, 'snipe', A1).end().pass(1);
    expect([b.hp(A1), b.stacks(B1, 'brittle')]).toEqual([100, 3]);
  });

  it('Frozen Gambit: a cheaper Harmful skill slips through and leaves it waiting, for 2 turns', () => {
    const a = arena({ p0: [['mislead.crystal']], p1: [['shot', 'smash']] });
    a.use(A1, 'mislead.crystal', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'brittle')]).toEqual([85, 0]);
    a.pass(1).use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'brittle')]).toEqual([85, 2]);
  });

  it('Frozen Gambit: only the first; Helpful skills are untouched; it ends after 2 turns', () => {
    const a = arena({ p0: [['mislead.crystal'], ['shot'], ['shot']], p1: [['smash', 'blast']] });
    a.use(A1, 'mislead.crystal', B1).end();
    a.use(B1, 'smash', A1).end().pass(1);
    a.use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2), a.stacks(B1, 'brittle')]).toEqual([65, 65, 2]);
    const h = arena({ p0: [['mislead.crystal']], p1: [['heal']] });
    h.setHp(B1, 50).use(A1, 'mislead.crystal', B1).end();
    h.use(B1, 'heal', B1).end();
    expect([h.hp(B1), h.stacks(B1, 'brittle')]).toEqual([75, 0]);
    const b = arena({ p0: [['mislead.crystal']], p1: [['smash']] });
    b.use(A1, 'mislead.crystal', B1).end().pass(4);
    b.use(B1, 'smash', A1).end();
    expect([b.hp(A1), b.stacks(B1, 'brittle')]).toEqual([75, 0]);
  });

  it('Encrust: 15, Stunned for 2 turns with Diamond for as long', () => {
    const a = arena({ p0: [['stun.crystal']], p1: [['shot']] });
    a.use(A1, 'stun.crystal', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), a.has(B1, 'diamond')]).toEqual([85, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(1);
    expect([a.has(B1, 'stun'), a.has(B1, 'diamond')]).toEqual([false, false]);
  });

  it('Perfect Form: 2 Might, 2 Swiftness, 1 Focus for 4 turns', () => {
    const a = arena({ p0: [['dance.crystal', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.crystal').end();
    expect(a.stacks(A1, 'swiftness')).toBe(2); // Might and Focus ride on the Perfect Form effect (§21.2)
    a.use(B1, 'shot', A1).end(); // under 25: nothing breaks
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
    a.end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Perfect Form: the first hit of 25+ shatters it all and Stuns the user for 1 turn', () => {
    const a = arena({ p0: [['dance.crystal', 'shot']], p1: [['smash']] });
    a.use(A1, 'dance.crystal').end();
    a.use(B1, 'smash', A1).end();
    const buffs = a.effects(A1).filter((e) => e.sourceSkill === 'dance.crystal' && e.defId !== 'stun');
    expect([buffs.length, a.has(A1, 'swiftness'), a.has(A1, 'stun')]).toEqual([0, false, true]);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
  });

  it('Faceted Ward: heals 20; for 2 turns the ally can\'t lose more than 25 HP in a turn', () => {
    const a = arena({ p0: [['heal.crystal']], p1: [['smash'], ['smash']] });
    a.setHp(A1, 60).use(A1, 'heal.crystal', A1).end();
    expect(a.hp(A1)).toBe(80);
    a.use(B1, 'smash', A1).use(B2, 'smash', A1).end();
    expect(a.hp(A1)).toBe(55);
  });

  it('Faceted Ward: ends after 2 turns', () => {
    const a = arena({ p0: [['heal.crystal']], p1: [['smash'], ['smash']] });
    a.use(A1, 'heal.crystal', A1).end().pass(4);
    a.use(B1, 'smash', A1).use(B2, 'smash', A1).end();
    expect(a.hp(A1)).toBe(50);
  });

  it('Diamond Skin: Diamond for 2 turns; when it ends, heal half of what it prevented', () => {
    const a = arena({ p0: [['bless.crystal']], p1: [['blast']] });
    a.use(A1, 'bless.crystal', A1).end();
    a.use(B1, 'blast').end(); // 35 → 15, 20 prevented
    expect(a.hp(A1)).toBe(85);
    a.pass(1);
    expect(fromSkill(a, A1, 'bless.crystal')).toBe(true);
    a.pass(1);
    expect([fromSkill(a, A1, 'bless.crystal'), a.hp(A1)]).toEqual([false, 95]);
  });

  it('Diamond Skin: the heal is capped at 30', () => {
    const a = arena({ p0: [['bless.crystal']], p1: [['blast'], ['blast'], ['blast']] });
    a.use(A1, 'bless.crystal', A1).end();
    a.use(B1, 'blast').use(B2, 'blast').use(B3, 'blast').end(); // 60 prevented
    expect(a.hp(A1)).toBe(55);
    a.pass(2);
    expect(a.hp(A1)).toBe(85);
  });

  it('Fault Lines: for 2 turns, 1 Brittle each time the target uses a skill', () => {
    const a = arena({ p0: [['curse.crystal']], p1: [['shot', 'heal']] });
    a.use(A1, 'curse.crystal', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.stacks(B1, 'brittle')).toBe(1);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'brittle')).toBe(2);
    a.pass(1).use(B1, 'shot', A1).end(); // over
    expect(a.stacks(B1, 'brittle')).toBe(2);
  });

  it('Cold Clarity: 20; for 1 turn, allies who damage the target become Frostborn for 1 turn', () => {
    const a = arena({ p0: [['smite.crystal'], ['shot'], ['heal']], p1: [['shot']] });
    a.use(A1, 'smite.crystal', B1).use(A2, 'shot', B1).use(A3, 'heal', A3).end();
    expect(a.hp(B1)).toBe(65);
    expect([a.has(A2, 'frostborn'), a.has(A3, 'frostborn')]).toEqual([true, false]);
  });

  it('Diamond Choir: all allies heal 15 and gain Diamond for 1 turn', () => {
    const a = arena({ p0: [['prayer.crystal'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.crystal').end();
    expect([a.hp(A1), a.hp(A2), a.has(A1, 'diamond'), a.has(A2, 'diamond'), a.has(B1, 'diamond')]).toEqual([
      65,
      65,
      true,
      true,
      false,
    ]);
    a.pass(2);
    expect(a.has(A1, 'diamond')).toBe(false);
  });

  it('Seeking Shards: 20 and 1 Brittle; the Brittle shards off to a random other enemy, who takes 10', () => {
    const a = arena({ p0: [['cleave.crystal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.crystal', B1).end();
    // B2 takes 10 + Brittle's 5.
    expect([a.hp(B1), a.stacks(B1, 'brittle'), a.hp(B2), a.stacks(B2, 'brittle')]).toEqual([80, 0, 85, 1]);
  });

  it('Seeking Shards: all the target\'s Brittle moves, and it can Shatter the second enemy', () => {
    const a = arena({ p0: [['cleave.crystal']], p1: [['shot'], ['shot']] });
    a.give(B1, 'brittle', { stacks: 1, source: A1 }).give(B2, 'brittle', { stacks: 1, source: A1 });
    a.use(A1, 'cleave.crystal', B1).end();
    // B1: 20 + 5. B2: 1 + 2 moved = 3 Brittle, so the 10 (+15) Shatters them (+20).
    expect([a.hp(B1), a.has(B1, 'brittle')]).toEqual([75, false]);
    expect([a.hp(B2), a.has(B2, 'brittle'), a.has(B2, 'shattered')]).toEqual([100 - 10 - 15 - 20, false, true]);
  });

  it('Seeking Shards: with no other enemy, the Brittle stays', () => {
    const a = arena({ p0: [['cleave.crystal']], p1: [['shot']] });
    a.use(A1, 'cleave.crystal', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle')]).toEqual([80, 1]);
  });

  it('Glass Harmonic: Intimidates all enemies; every Shield on the field breaks and every unit is Shattered', () => {
    const a = arena({ p0: [['shout.crystal'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'shield', { value: 20 }).give(B1, 'shield', { value: 20 });
    a.use(A1, 'shout.crystal').end();
    expect([shield(a, A2), shield(a, B1)]).toEqual([0, 0]);
    expect([A1, A2, B1, B2].every((u) => a.has(u, 'shattered'))).toBe(true);
    expect([a.stacks(B1, 'intimidated'), a.stacks(A2, 'intimidated')]).toEqual([1, 0]);
  });

  it('Latticework: 30 Shield for 2 turns; an ally\'s damage comes out of it first', () => {
    const a = arena({ p0: [['withstand.crystal'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.crystal').end();
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), shield(a, A1)]).toEqual([100, 15]);
    a.pass(3);
    expect(shield(a, A1)).toBe(0);
  });

  it('Crystal Effigy: a 30 HP Effigy for 2 turns; the target is Taunted by it', () => {
    const a = arena({ p0: [['taunt.crystal']], p1: [['shot']] });
    a.use(A1, 'taunt.crystal', B1).end();
    const e = minions(a, 'crystal_effigy');
    expect([e.length, e[0]!.hp, a.has(e[0]!.id, 'diamond'), a.has(B1, 'taunt')]).toEqual([1, 30, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end().pass(2);
    expect([minions(a, 'crystal_effigy').length, a.has(B1, 'taunt')]).toEqual([0, false]);
  });

  it('Crystal Effigy: its Diamond caps each hit, and each enemy hit gives the attacker 1 Brittle', () => {
    const a = arena({ p0: [['taunt.crystal']], p1: [['smash'], ['shot']] });
    a.use(A1, 'taunt.crystal', B1).end();
    const e = minions(a, 'crystal_effigy')[0]!.id;
    a.use(B1, 'smash', e).use(B2, 'shot', e).end();
    expect([a.unit(e).alive, a.stacks(B1, 'brittle'), a.stacks(B2, 'brittle')]).toEqual([false, 1, 1]);
  });

  it('Diamond Colossus: Diamond and Immune for 3 turns; then every enemy gains 2 Brittle', () => {
    const a = arena({ p0: [['titan.crystal']], p1: [['smash', 'curse'], ['shot']] });
    a.use(A1, 'titan.crystal').end();
    expect([fromSkill(a, A1, 'titan.crystal'), a.has(A1, 'immune')]).toEqual([true, true]);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(85); // Diamond caps the 25
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(1);
    expect([a.stacks(B1, 'brittle'), a.stacks(B2, 'brittle')]).toEqual([0, 0]);
    a.pass(1);
    expect([fromSkill(a, A1, 'titan.crystal'), a.stacks(B1, 'brittle'), a.stacks(B2, 'brittle')]).toEqual([false, 2, 2]);
  });
});

const KIT: [string, string, number][] = [
  ['strike', 'I', 1], ['smash', 'Sr', 2], ['charge', 'S', 2], ['riposte', 'I', 3], ['rage', 'SI', 4],
  ['shot', 'A', 0], ['snipe', 'AIr', 2], ['trap', 'II', 3], ['maneuver', 'r', 3], ['companion', 'I', 1],
  ['bolt', 'Ir', 1], ['blast', 'Irr', 2], ['consume', 'r', 2], ['summon', 'Ir', 2], ['channel', 'I', 3],
  ['stab', 'r', 0], ['ravage', 'Ar', 1], ['mislead', 'I', 2], ['stun', 'AI', 3], ['dance', 'AI', 5],
  ['heal', 'W', 1], ['bless', 'I', 2], ['curse', 'I', 2], ['smite', 'W', 1], ['prayer', 'Ir', 3],
  ['cleave', 'S', 1], ['shout', 'I', 3], ['withstand', 'I', 3], ['taunt', 'r', 3], ['titan', 'WI', 4],
];

describe('Crystal costs and cooldowns (design doc kit table)', () => {
  it.each(KIT)('%s.crystal costs %s, cooldown %i', (base, cost, cd) => {
    const s = content.skills[`${base}.crystal`]!;
    expect([s.cost, s.cooldown]).toEqual([parseCost(cost), cd]);
  });
});
