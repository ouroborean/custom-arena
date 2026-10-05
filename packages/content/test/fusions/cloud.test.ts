// Spec-driven tests for the Cloud fusion (Wind + Wind), written from the in-game descriptions,
// docs/rules.md §21.5 and the "Pure fusions" design doc. Units: A1..A3 = p0c0..p0c2 (player 1, odd
// turns), B1..B3 = p1c0..p1c2. A Drift skill used on turn 1 lands at the start of turn 3.

import { describe, expect, it } from 'vitest';
import { effectDefinition, evaluateNamedCondition, parseCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const channeling = (a: Arena, id: string) => a.effects(id).some((e) => effectDefinition(content, e)?.interruptible);
const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.defId === defId && u.alive);
const shield = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => n + ((e.inline ?? content.statuses[e.defId])?.shield ? e.value : 0), 0);
const immobile = (a: Arena, id: string) => evaluateNamedCondition(content, a.state, 'immobile', id);

describe('Cloud keywords', () => {
  it('Drift: hangs for a turn and lands at the start of the user\'s next turn', () => {
    const a = arena({ p0: [['strike.cloud']], p1: [['shot']] });
    a.use(A1, 'strike.cloud', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Drift: still lands if the user is Stunned', () => {
    const a = arena({ p0: [['strike.cloud']], p1: [['stun']] });
    a.use(A1, 'strike.cloud', B1).end().use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.hp(B1)]).toEqual([true, 65]);
  });

  it('Drift: lost if the user dies', () => {
    const a = arena({ p0: [['strike.cloud'], ['shot']], p1: [['shot']] });
    a.use(A1, 'strike.cloud', B1).end().setHp(A1, 10).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Drift: counters react when it lands', () => {
    const a = arena({ p0: [['strike.cloud']], p1: [['riposte']] });
    a.use(A1, 'strike.cloud', B1).end().use(B1, 'riposte').end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([100, 85]);
  });

  it('Drift: if the target is no longer valid, it lands on another valid one', () => {
    const a = arena({ p0: [['strike.cloud']], p1: [['maneuver'], ['shot']] });
    a.use(A1, 'strike.cloud', B1).end().use(B1, 'maneuver').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 65]);
  });

  it('Aloft: +5 direct damage, and dealing damage doesn\'t end it', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'aloft', { duration: 10 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'aloft')]).toEqual([80, true]);
  });

  it('Aloft: no Invulnerability', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'aloft', { duration: 10 }).pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Aloft: counts as Leaping for Wind\'s payoffs', () => {
    const a = arena({ p0: [['strike.wind']], p1: [['shot']] });
    a.give(A1, 'aloft', { duration: 10 }).use(A1, 'strike.wind', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns')]).toEqual([70, true]);
    expect(immobile(a, A1)).toBe(false);
  });
});

describe('Cloud skills', () => {
  it('Heavy Sky: Drift, 35 when it lands', () => {
    const a = arena({ p0: [['strike.cloud']], p1: [['shot']] });
    a.use(A1, 'strike.cloud', B1).end();
    expect(a.cooldown(A1, 'strike.cloud')).toBe(0);
    a.end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Anvil Cloud: at the start of the user\'s second turn from now, 50 to the target and 30 to their allies', () => {
    const a = arena({ p0: [['smash.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.cloud', B1).end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
    a.end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 70]);
  });

  it('Anvil Cloud: still lands if the user is Stunned, but is lost if they die', () => {
    const a = arena({ p0: [['smash.cloud']], p1: [['stun']] });
    a.use(A1, 'smash.cloud', B1).end().use(B1, 'stun', A1).end().pass(2);
    expect(a.hp(B1)).toBe(50);
    const b = arena({ p0: [['smash.cloud'], ['shot']], p1: [['shot']] });
    b.use(A1, 'smash.cloud', B1).end().setHp(A1, 10).use(B1, 'shot', A1).end().pass(2);
    expect(b.hp(B1)).toBe(100);
  });

  it('Rising Air: free; 10 and Aloft for 2 turns', () => {
    const a = arena({ p0: [['charge.cloud']], p1: [['shot']] });
    a.use(A1, 'charge.cloud', B1);
    expect(a.state.players[0].queue[0]?.cost).toEqual(parseCost('nc'));
    a.end();
    expect([a.hp(B1), a.has(A1, 'aloft'), a.has(B1, 'stun_ns')]).toEqual([90, true, false]);
    a.pass(2);
    expect(a.has(A1, 'aloft')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'aloft')).toBe(false);
  });

  it('Rising Air: already Aloft, the user dives: the target\'s non-Strategic skills are stunned for 1 turn', () => {
    const a = arena({ p0: [['charge.cloud']], p1: [['shot', 'heal']] });
    a.give(A1, 'aloft', { duration: 10 }).use(A1, 'charge.cloud', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns')]).toEqual([85, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Cloud Veil: counters the first Harmful skill; its user is Isolated, and the user is Aloft for 2 turns', () => {
    const a = arena({ p0: [['riposte.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.cloud').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    expect([a.has(B1, 'isolated'), a.has(B2, 'isolated'), a.has(A1, 'aloft')]).toEqual([true, false, true]);
  });

  it('Rise Above: Aloft and 1 Might; Debuffs applied to the user drift off at the start of their next turn', () => {
    const a = arena({ p0: [['rage.cloud', 'shot']], p1: [['curse']] });
    a.use(A1, 'rage.cloud').end();
    expect([a.has(A1, 'aloft'), a.stacks(A1, 'might')]).toEqual([true, 1]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 15 - 5 - 5);
  });

  it('Hailfall: 15 to every other unit that isn\'t Leaping or Aloft, allies included', () => {
    const a = arena({ p0: [['shot.cloud'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'aloft', { duration: 10 }).give(B2, 'leaping');
    a.use(A1, 'shot.cloud').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3), a.hp(B1), a.hp(B2)]).toEqual([100, 100, 85, 85, 100]);
  });

  it('Squall Line: next turn, 30 Piercing to enemies who used a Harmful skill meanwhile, 15 to the rest', () => {
    const a = arena({ p0: [['snipe.cloud']], p1: [['shot'], ['heal']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.cloud').end();
    expect(channeling(a, A1)).toBe(true);
    a.use(B1, 'shot', A1).use(B2, 'heal', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 85]);
  });

  it('Overcast: each skill the target uses adds a cloud; when it ends, 15 per cloud drifts onto them', () => {
    const a = arena({ p0: [['trap.cloud']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap.cloud', B1).end();
    a.use(B1, 'shot', A1).end().pass(1).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(4);
    expect(a.hp(B1)).toBe(70);
  });

  it('Overcast: no skills, no clouds', () => {
    const a = arena({ p0: [['trap.cloud']], p1: [['shot']] });
    a.use(A1, 'trap.cloud', B1).end().pass(8);
    expect(a.hp(B1)).toBe(100);
  });

  it('Idle Updraft: Invulnerable, Rushing; for 3 turns Rushing survives a turn with no skill', () => {
    const a = arena({ p0: [['maneuver.cloud']], p1: [['shot']] });
    a.use(A1, 'maneuver.cloud').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'rushing')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2); // turn 3: no skill used
    expect(a.has(A1, 'rushing')).toBe(true);
    a.pass(6);
    expect(a.has(A1, 'rushing')).toBe(false);
  });

  it('Sky Whale: 50 HP; Rain Down drifts in and heals all allies 10', () => {
    const a = arena({ p0: [['companion.cloud'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.cloud').end().pass(1);
    const whale = minions(a, 'sky_whale')[0]!;
    expect(whale.hp).toBe(50);
    a.setHp(A1, 50).setHp(A2, 50).use(whale.id, 'whale_rain_down').end();
    expect(a.hp(A2)).toBe(50);
    a.end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([60, 60]);
  });

  it('Breach: drifts in and deals 20 to all enemies', () => {
    const a = arena({ p0: [['companion.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.cloud').end().pass(1);
    a.use(minions(a, 'sky_whale')[0]!.id, 'whale_breach').end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Cirrus Bolt: drifts in; 30 to the enemy with the least HP and a Mark for 1 turn', () => {
    const a = arena({ p0: [['bolt.cloud']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'bolt.cloud').end();
    expect(a.hp(B2)).toBe(60);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'mark')]).toEqual([100, 30, true]);
  });

  it('Cloudburst: 20 to all enemies, then 10 more Drifts onto each at the start of each of the user\'s next 2 turns', () => {
    const a = arena({ p0: [['blast.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.cloud').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
    a.end(); // the user's next turn starts
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
    a.end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 60]);
    a.end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 60]); // twice only
  });

  it('Evaporate: 5 and the user heals 5; at the start of the user\'s next turn it drains 15 more', () => {
    const a = arena({ p0: [['consume.cloud']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.cloud', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 55]);
    a.end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 70]);
  });

  it('Cloudlings: 2 Cloudlings (10 HP) for 3 turns; when one dies, all allies heal 10', () => {
    const a = arena({ p0: [['summon.cloud'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.cloud').end();
    const c = minions(a, 'cloudling');
    expect(c.map((u) => u.hp)).toEqual([10, 10]);
    a.setHp(A1, 50).setHp(A2, 50).use(B1, 'shot', c[0]!.id).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([60, 60]);
    a.pass(4);
    expect(minions(a, 'cloudling')).toHaveLength(0);
  });

  it('Drizzle: free; drifts in for 10', () => {
    const a = arena({ p0: [['summon.cloud']], p1: [['shot']] });
    a.use(A1, 'summon.cloud').end().pass(1);
    a.use(minions(a, 'cloudling')[0]!.id, 'cloudling_drizzle', B1);
    expect(a.state.players[0].queue[0]?.cost).toEqual(parseCost('nc'));
    a.end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Gathering Clouds: a storm gathers over every enemy and grows by 15 at the end of each of the user\'s turns', () => {
    const a = arena({ p0: [['channel.cloud'], ['shot']], p1: [['shot'], ['shot']] });
    expect(content.skills['channel.cloud']!.tags).toContain('Channeled');
    const storm = (id: string) => a.effects(id).find((e) => e.defId === 'gathering_storm')?.value;
    a.use(A1, 'channel.cloud').end();
    expect([storm(B1), storm(B2), a.hp(B1)]).toEqual([15, 15, 100]);
    a.pass(1);
    expect(storm(B1)).toBe(15); // not on the enemy's turn
    a.pass(1);
    expect([storm(B1), a.hp(B1)]).toEqual([30, 100]);
  });

  it('Gathering Clouds: at the end of the user\'s third turn, it breaks: each enemy takes all of theirs', () => {
    const a = arena({ p0: [['channel.cloud'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.cloud').end().pass(3);
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
    a.pass(1);
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'gathering_storm'), channeling(a, A1)]).toEqual([55, 55, false, false]);
    a.pass(2);
    expect(a.hp(B1)).toBe(55);
  });

  it('Gathering Clouds: breaking the channel stops the storm growing, but it still breaks on time', () => {
    const a = arena({ p0: [['channel.cloud'], ['shot']], p1: [['stun'], ['shot']] });
    a.use(A1, 'channel.cloud').end().use(B1, 'stun', A1).end();
    expect(channeling(a, A1)).toBe(false);
    a.pass(2);
    expect(a.hp(B2)).toBe(100);
    a.pass(1); // the end of the user's third turn
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it("Sleet Needle: 5 now, and 10 more Drifts onto the target at the start of the user's next turn", () => {
    const a = arena({ p0: [['stab.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stab.cloud', B1).end();
    expect(a.hp(B1)).toBe(95);
    a.end(); // the enemy's turn ends; the user's next turn starts
    expect(a.hp(B1)).toBe(85);
    a.end().end();
    expect(a.hp(B1)).toBe(85); // once only
  });

  it('Downburst: nothing lands at once; the first Harmful skill the target uses brings 35 Piercing damage down on them', () => {
    const a = arena({ p0: [['ravage.cloud']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.cloud', B1).end();
    expect([a.hp(B1), a.has(B1, 'downburst')]).toEqual([100, true]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'downburst')]).toEqual([65, 85, false]); // their skill still goes
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(65); // once only
  });

  it('Downburst: Helpful skills don\'t set it off; with no Harmful one, it falls for 20 as it ends', () => {
    const a = arena({ p0: [['ravage.cloud']], p1: [['heal'], ['shot']] });
    a.use(A1, 'ravage.cloud', B1).end().use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.has(B1, 'downburst')]).toEqual([80, false]);
  });

  it('Downburst: a second one on the same enemy replaces the first', () => {
    const a = arena({ p0: [['ravage.cloud'], ['ravage.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'ravage.cloud', B1).use(A2, 'ravage.cloud', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Low Ceiling: counters the target\'s Harmful skill, and they count as Immobile for 2 turns', () => {
    const a = arena({ p0: [['mislead.cloud']], p1: [['shot', 'charge']] });
    a.give(B1, 'swiftness', { duration: 20 });
    expect(immobile(a, B1)).toBe(false);
    a.use(A1, 'mislead.cloud', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), immobile(a, B1)]).toEqual([100, true]);
    a.pass(4);
    expect(immobile(a, B1)).toBe(false);
  });

  it('Low Ceiling: no Harmful skill, no Immobile', () => {
    const a = arena({ p0: [['mislead.cloud']], p1: [['heal', 'charge']] });
    a.use(A1, 'mislead.cloud', B1).end().use(B1, 'heal', B1).end();
    expect(immobile(a, B1)).toBe(false);
  });

  it('Sleet Squall: Drift; when it lands, 10 damage to the target and each of their allies, and the enemy with the most HP is Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.cloud']], p1: [['shot'], ['shot']] });
    expect(content.skills['stun.cloud']!.tags).toContain('Drift');
    a.setHp(B2, 50).use(A1, 'stun.cloud', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 50]);
    a.use(B1, 'shot', A1).end(); // it hangs in plain sight; the target still acts this turn
    expect([a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([85, 90, 40]);
    a.end();
    a.use(B2, 'shot', A1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    a.use(B1, 'shot', A1);
  });

  it('Sleet Squall: the Stun goes to whoever has the most HP, not necessarily the target', () => {
    const a = arena({ p0: [['stun.cloud']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'stun.cloud', B1).end().end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([40, 90]);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'shot', A1);
  });

  it('Sleet Squall: it\'s the ordinary Stun, so Swiftness stops it', () => {
    const a = arena({ p0: [['stun.cloud']], p1: [['shot']] });
    a.give(B1, 'swiftness').use(A1, 'stun.cloud', B1).end().end().end();
    expect(a.has(B1, 'swiftness')).toBe(false);
    a.use(B1, 'shot', A1);
  });

  it('Sky Dancer: Aloft and 1 Focus; each of the user\'s turns a random enemy loses their mobility buffs', () => {
    const a = arena({ p0: [['dance.cloud']], p1: [['shot']] });
    a.use(A1, 'dance.cloud').end();
    expect([a.has(A1, 'aloft'), a.stacks(A1, 'focus')]).toEqual([true, 1]);
    a.give(B1, 'swiftness').give(B1, 'rushing').end();
    expect([a.has(B1, 'swiftness'), a.has(B1, 'rushing')]).toEqual([false, false]);
  });

  it('Rain Check: heals 15; for 1 turn, each hit is held and lands later, 10 lower', () => {
    const a = arena({ p0: [['heal.cloud'], ['shot']], p1: [['smash']] });
    a.setHp(A2, 50).use(A1, 'heal.cloud', A2).end();
    expect(a.hp(A2)).toBe(65);
    a.use(B1, 'smash', A2).end().end();
    expect(a.hp(A2)).toBe(65 - 15);
  });

  it('Lift: Aloft for 2 turns; any Taunt ends, and they can\'t be Taunted while Aloft', () => {
    const a = arena({ p0: [['bless.cloud'], ['shot']], p1: [['taunt'], ['taunt']] });
    a.give(A2, 'taunt', { source: B1, duration: 4 }).use(A1, 'bless.cloud', A2).end();
    expect([a.has(A2, 'aloft'), a.has(A2, 'taunt')]).toEqual([true, false]);
    a.use(B2, 'taunt', A2).end();
    expect(a.has(A2, 'taunt')).toBe(false);
  });

  it('Becalmed: for 2 turns, the target\'s skills Drift', () => {
    const a = arena({ p0: [['curse.cloud']], p1: [['shot']] });
    a.use(A1, 'curse.cloud', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Silver Lining: 20; for 1 turn, each ally who damages the target loses a Debuff', () => {
    const a = arena({ p0: [['smite.cloud'], ['shot'], ['heal']], p1: [['shot']] });
    a.give(A2, 'vulnerable', { source: B1 }).give(A3, 'vulnerable', { source: B1 });
    a.use(A1, 'smite.cloud', B1).use(A2, 'shot', B1).use(A3, 'heal', A3).end();
    expect([a.hp(B1), a.has(A2, 'vulnerable'), a.has(A3, 'vulnerable')]).toEqual([65, false, true]);
  });

  it('Blessed Rain: Drift; all allies heal 30 and gain 1 Swiftness when it lands', () => {
    const a = arena({ p0: [['prayer.cloud'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.cloud').end();
    expect([a.hp(A2), a.has(A2, 'swiftness')]).toEqual([50, false]);
    a.end();
    expect([a.hp(A1), a.hp(A2), a.stacks(A2, 'swiftness'), a.has(B1, 'swiftness')]).toEqual([80, 80, 1, false]);
  });

  it('Gust Front: 20 + 15 to a random other enemy, and Aloft for 1 turn', () => {
    const a = arena({ p0: [['cleave.cloud']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.cloud', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'aloft')]).toEqual([80, 85, true]);
    a.pass(1);
    expect(a.has(A1, 'aloft')).toBe(false);
  });

  it('Gust Front: already Aloft, the second hit goes to the enemy with the least HP', () => {
    const a = arena({ p0: [['cleave.cloud']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B3, 50).give(A1, 'aloft', { duration: 10 }).use(A1, 'cleave.cloud', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 100, 30]);
  });

  it('Gale Warning: Intimidates all enemies; each ally with Swiftness trades 1 to begin Rushing', () => {
    const a = arena({ p0: [['shout.cloud'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'swiftness', { stacks: 2 });
    a.use(A1, 'shout.cloud').end();
    expect([a.stacks(B1, 'intimidated'), a.stacks(B2, 'intimidated')]).toEqual([1, 1]);
    expect([a.has(A2, 'rushing'), a.stacks(A2, 'swiftness'), a.has(A3, 'rushing'), a.has(A1, 'rushing')]).toEqual([
      true,
      1,
      false,
      false,
    ]);
  });

  it('Cloudbank: 20 Shield for 2 turns; if it breaks while the user is Rushing, they Leap', () => {
    const a = arena({ p0: [['withstand.cloud', 'shot']], p1: [['smash']] });
    a.use(A1, 'withstand.cloud').end();
    expect(shield(a, A1)).toBe(20);
    a.give(A1, 'rushing').use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.has(A1, 'leaping'), a.has(A1, 'invulnerable')]).toEqual([95, true, true]);
    const b = arena({ p0: [['withstand.cloud']], p1: [['smash']] });
    b.use(A1, 'withstand.cloud').end().use(B1, 'smash', A1).end();
    expect(b.has(A1, 'leaping')).toBe(false);
  });

  it('Looming Cloud: Taunt for 2 turns; each skill the target uses drifts 10 back onto them', () => {
    const a = arena({ p0: [['taunt.cloud']], p1: [['shot']] });
    a.use(A1, 'taunt.cloud', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(3);
    expect(a.hp(B1)).toBe(90);
  });

  it('Cloud Titan: Immune and Aloft; each turn, 15 drifts onto the enemy who last damaged the user', () => {
    const a = arena({ p0: [['titan.cloud']], p1: [['shot', 'curse'], ['shot']] });
    a.use(A1, 'titan.cloud').end();
    expect([a.has(A1, 'immune'), a.has(A1, 'aloft')]).toEqual([true, true]);
    a.use(B1, 'shot', A1).end();
    a.pass(3);
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });
});

const KIT: [string, string, number][] = [
  ['strike', 'S', 0], ['smash', 'Arr', 3], ['charge', 'nc', 1], ['riposte', 'r', 2], ['rage', 'S', 4],
  ['shot', 'r', 1], ['snipe', 'Ar', 2], ['trap', 'A', 3], ['maneuver', 'r', 3], ['companion', 'I', 1],
  ['bolt', 'I', 1], ['blast', 'Arr', 2], ['consume', 'r', 2], ['summon', 'r', 3], ['channel', 'AI', 3],
  ['stab', 'r', 0], ['ravage', 'Ar', 1], ['mislead', 'A', 2], ['stun', 'r', 2], ['dance', 'AA', 4],
  ['heal', 'A', 1], ['bless', 'A', 2], ['curse', 'A', 2], ['smite', 'Wr', 1], ['prayer', 'Wrr', 2],
  ['cleave', 'Ar', 1], ['shout', 'A', 3], ['withstand', 'r', 3], ['taunt', 'r', 3], ['titan', 'SW', 4],
];

describe('Cloud costs and cooldowns (design doc kit table)', () => {
  it.each(KIT)('%s.cloud costs %s, cooldown %i', (base, cost, cd) => {
    const s = content.skills[`${base}.cloud`]!;
    expect([s.cost, s.cooldown]).toEqual([parseCost(cost), cd]);
  });
});
