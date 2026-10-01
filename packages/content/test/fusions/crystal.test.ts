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

  it('Shard Rush: 15 and 1 Focus; the next skill\'s Frost debuffs last 1 turn longer', () => {
    const run = (charge: boolean) => {
      const a = arena({ p0: [['charge.crystal', 'shot.ice']], p1: [['shot']] });
      if (charge) a.use(A1, 'charge.crystal', B1).end().pass(1);
      else a.pass(2);
      a.use(A1, 'shot.ice', B1).end();
      return a;
    };
    const a = run(true);
    expect(a.hp(B1)).toBe(100 - 15 - 20);
    expect(dur(a, B1, 'chilled')).toBe(dur(run(false), B1, 'chilled') + 2);
    expect(a.has(A1, 'focus')).toBe(false);
  });

  it('Shard Rush: gives 1 Focus that lowers the next skill\'s cost', () => {
    const a = arena({ p0: [['charge.crystal', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.crystal', B1).end();
    expect(a.stacks(A1, 'focus')).toBe(1);
    a.pass(1).use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
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

  it('Crystal Lance: 40 Piercing on the following turn, plus 10 per Brittle', () => {
    const a = arena({ p0: [['snipe.crystal']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'snipe.crystal', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(100 - 40 - 20 - 10); // + Brittle's own 5 per stack
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

  it('Crystal Cocoon: Invulnerable, Debuffs end; then Diamond for 1 turn per Debuff removed', () => {
    const run = (debuffs: string[]) => {
      const a = arena({ p0: [['maneuver.crystal']], p1: [['shot']] });
      for (const d of debuffs) a.give(A1, d, { source: B1 });
      a.use(A1, 'maneuver.crystal').end();
      return a;
    };
    const a = run(['weakness', 'vulnerable']);
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'weakness'), a.has(A1, 'vulnerable'), a.has(A1, 'diamond')]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    a.end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'diamond')]).toEqual([false, true]);
    const b = run(['weakness']).end();
    expect(dur(a, A1, 'diamond')).toBe(dur(b, A1, 'diamond') + 2);
    const c = run([]).end();
    expect(c.has(A1, 'diamond')).toBe(false);
  });

  it('Crystal Golem: 40 HP; at the start of each of your turns the ally with the least HP gains Diamond', () => {
    const a = arena({ p0: [['companion.crystal'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'companion.crystal').end();
    expect(minions(a, 'crystal_golem').map((u) => u.hp)).toEqual([40]);
    a.end();
    expect([a.has(A2, 'diamond'), a.has(A1, 'diamond')]).toEqual([true, false]);
  });

  it('Shard Slam: 15 and 1 Brittle', () => {
    const a = arena({ p0: [['companion.crystal']], p1: [['shot']] });
    a.use(A1, 'companion.crystal').end().pass(1);
    a.use(minions(a, 'crystal_golem')[0]!.id, 'golem_shard_slam', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'brittle')]).toEqual([85, 1]);
  });

  it('Quartz Spike: 20 and a Mark; when the Mark is spent, 2 Brittle', () => {
    const a = arena({ p0: [['bolt.crystal'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.crystal', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 15 - 10);
    expect([a.has(B1, 'mark'), a.stacks(B1, 'brittle')]).toEqual([false, 2]);
    a.pass(3).use(A1, 'bolt.crystal', B2).end();
    expect([a.has(B2, 'mark'), a.stacks(B2, 'brittle')]).toEqual([true, 0]); // unspent: no Brittle
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

  it('Harvest Shards: 10; removes all Brittle, 10 Shield per stack', () => {
    const a = arena({ p0: [['consume.crystal']], p1: [['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).use(A1, 'consume.crystal', B1).end();
    expect([a.has(B1, 'brittle'), shield(a, A1)]).toEqual([false, 20]);
    expect(a.hp(B1)).toBe(80);
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

  it('Shatterpoint: 25 Piercing; at 2+ Brittle it Shatters them now', () => {
    const a = arena({ p0: [['ravage.crystal']], p1: [['shot'], ['shot']] });
    a.give(B1, 'brittle', { stacks: 2, source: A1 }).give(B2, 'brittle', { stacks: 1, source: A1 });
    a.use(A1, 'ravage.crystal', B1).end();
    expect([a.has(B1, 'shattered'), a.has(B1, 'brittle'), a.hp(B1)]).toEqual([true, false, 100 - 35 - 20]);
    a.pass(3).use(A1, 'ravage.crystal', B2).end();
    expect([a.has(B2, 'shattered'), a.stacks(B2, 'brittle'), a.hp(B2)]).toEqual([false, 1, 70]);
  });

  it('Price of Frost: counters the target\'s Harmful skill', () => {
    const a = arena({ p0: [['mislead.crystal']], p1: [['shot']] });
    a.use(A1, 'mislead.crystal', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Price of Frost: once it triggers, Chilled enemies\' skills cost 1 more for 2 turns', () => {
    const a = arena({ p0: [['mislead.crystal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.crystal', B1).end().use(B1, 'shot', A1).end();
    a.give(B2, 'chilled', { source: A1, duration: 10 }).pass(1);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1);
    expect(a.state.players[1].queue.map((q) => q.cost.r)).toEqual([1, 2]);
  });

  it('Price of Frost: no toll if it never triggers', () => {
    const a = arena({ p0: [['mislead.crystal']], p1: [['shot'], ['shot']] });
    a.give(B2, 'chilled', { source: A1, duration: 10 }).use(A1, 'mislead.crystal', B1).end();
    a.use(B2, 'shot', A1);
    expect(a.state.players[1].queue[0]?.cost.r).toBe(1);
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

  it('Seeking Shards: 25 + 15 to a Frostbitten enemy if any, who is also Numb for 2 turns', () => {
    const a = arena({ p0: [['cleave.crystal']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B3, 'frostbitten', { source: A1, duration: 10 }).use(A1, 'cleave.crystal', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.has(B3, 'numb')]).toEqual([75, 100, 85, true]);
  });

  it('Seeking Shards: with no Frostbitten enemy, a random other one is hit and not Numbed', () => {
    const a = arena({ p0: [['cleave.crystal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.crystal', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'numb')]).toEqual([75, 85, false]);
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

  it('Flawless Challenge: Taunt for 2 turns and Diamond against the target\'s hits', () => {
    const a = arena({ p0: [['taunt.crystal']], p1: [['shot', 'smash']] });
    a.use(A1, 'taunt.crystal', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Flawless Challenge: each capped hit extends the Taunt by 1 turn', () => {
    const run = (skill: string) => {
      const a = arena({ p0: [['taunt.crystal']], p1: [[skill]] });
      a.use(A1, 'taunt.crystal', B1).end().use(B1, skill, A1).end();
      return dur(a, B1, 'taunt');
    };
    expect(run('smash')).toBe(run('shot') + 2);
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
