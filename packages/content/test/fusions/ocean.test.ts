// Spec-driven tests for the Ocean fusion (Water + Water), written from the in-game descriptions,
// docs/rules.md §21.3 and the "Pure fusions" design doc. Units: A1..A3 = p0c0..p0c2 (player 1, odd
// turns), B1..B3 = p1c0..p1c2. Crest is a skill's first use, then the forms alternate.

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
const dur = (a: Arena, id: string, key: string) => a.effects(id).find((e) => e.defId === key)?.duration ?? 0;
const shield = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => n + ((e.inline ?? content.statuses[e.defId])?.shield ? e.value : 0), 0);

describe('Ocean keywords', () => {
  it('Crest and Trough: the first use is Crest, then the forms alternate', () => {
    const a = arena({ p0: [['strike.ocean']], p1: [['shot']], hp: 200 });
    const hits: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = a.hp(B1);
      a.use(A1, 'strike.ocean', B1).end().pass(1);
      hits.push(before - a.hp(B1));
    }
    expect(hits).toEqual([25, 15, 25]);
  });

  it('Crest and Trough: each unit tracks its own uses', () => {
    const a = arena({ p0: [['strike.ocean'], ['strike.ocean']], p1: [['shot']], hp: 200 });
    a.use(A1, 'strike.ocean', B1).end().pass(1);
    a.use(A2, 'strike.ocean', B1).end();
    expect(a.hp(B1)).toBe(150);
  });

  it('Crest and Trough: a countered use still switches the form', () => {
    const a = arena({ p0: [['strike.ocean']], p1: [['shot', 'riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'strike.ocean', B1).end().pass(1); // countered Crest
    const before = a.hp(B1);
    a.use(A1, 'strike.ocean', B1).end();
    expect(before - a.hp(B1)).toBe(15);
  });

  it('Brimming: Renew healing past max HP becomes Shield', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.setHp(A1, 95).give(A1, 'brimming').give(A1, 'renew', { stacks: 3, source: A1 }).end();
    expect([a.hp(A1), shield(a, A1)]).toEqual([100, 10]);
  });

  it('Brimming: the Shield is capped at 30', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'brimming').give(A1, 'renew', { stacks: 10, source: A1 }).end().pass(1);
    expect(shield(a, A1)).toBe(30);
  });

  it('Brimming: without it, overflow is lost', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'renew', { stacks: 3, source: A1 }).end();
    expect(shield(a, A1)).toBe(0);
  });
});

describe('Ocean skills', () => {
  it('Breaker: Crest 25 and one target Buff washes away; Trough 15 and one user Debuff washes away', () => {
    const a = arena({ p0: [['strike.ocean']], p1: [['shot']] });
    a.give(B1, 'might', { source: B1 }).give(A1, 'vulnerable', { source: B1 });
    a.use(A1, 'strike.ocean', B1).end();
    expect([a.hp(B1), a.has(B1, 'might'), a.has(A1, 'vulnerable')]).toEqual([75, false, true]);
    a.pass(1).use(A1, 'strike.ocean', B1).end();
    expect([a.hp(B1), a.has(A1, 'vulnerable')]).toEqual([60, false]);
  });

  it('Rogue Wave: Crest 30 and 15 to allies; Trough 15 and every enemy loses their Shield', () => {
    const a = arena({ p0: [['smash.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.ocean', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 85]);
    a.give(B2, 'shield', { value: 20 }).pass(5);
    a.use(A1, 'smash.ocean', B1).end();
    expect([a.hp(B1), a.hp(B2), shield(a, B2)]).toEqual([55, 85, 0]);
  });

  it('Swell: Crest grows 5 per own turn since the last Trough', () => {
    const a = arena({ p0: [['charge.ocean']], p1: [['shot']], hp: 400 });
    a.use(A1, 'charge.ocean', B1).end(); // turn 1: Crest, no turns yet
    expect(a.hp(B1)).toBe(385);
    a.pass(5).use(A1, 'charge.ocean', B1).end(); // turn 7: Trough
    expect(a.hp(B1)).toBe(375);
    a.pass(5).use(A1, 'charge.ocean', B1).end(); // turn 13: Crest, 3 own turns after the Trough
    expect(a.hp(B1)).toBe(375 - 30);
  });

  it("Swell: Trough deals 10 and gives Flow until the end of the user's next turn", () => {
    const a = arena({ p0: [['charge.ocean']], p1: [['shot']] });
    a.use(A1, 'charge.ocean', B1).end().pass(5);
    const before = a.hp(B1);
    a.use(A1, 'charge.ocean', B1).end();
    expect(before - a.hp(B1)).toBe(10);
    expect(a.has(A1, 'flow')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'flow')).toBe(true); // through the user's next turn
    a.pass(1);
    expect(a.has(A1, 'flow')).toBe(false);
  });

  it('Swell: the Crest bonus is capped at 20', () => {
    const a = arena({ p0: [['charge.ocean']], p1: [['shot']], hp: 400 });
    a.use(A1, 'charge.ocean', B1).end().pass(5).use(A1, 'charge.ocean', B1).end(); // turn 7: Trough
    a.pass(11);
    const before = a.hp(B1);
    a.use(A1, 'charge.ocean', B1).end(); // turn 19: 6 own turns later
    expect(before - a.hp(B1)).toBe(35);
  });

  it('Breakwater: counters every Harmful skill for 1 turn; Brimming and 2 Renew per counter', () => {
    const a = arena({ p0: [['riposte.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.ocean').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'brimming'), a.stacks(A1, 'renew')]).toEqual([100, true, 4]);
  });

  it('Breakwater: nothing countered, nothing gained', () => {
    const a = arena({ p0: [['riposte.ocean']], p1: [['shot']] });
    a.use(A1, 'riposte.ocean').end().end();
    expect([a.has(A1, 'brimming'), a.stacks(A1, 'renew')]).toEqual([false, 0]);
  });

  it('Relentless Surf: 2 Might; the first hit on each Stunned enemy lengthens their Stuns by 1 turn, once', () => {
    const a = arena({ p0: [['rage.ocean', 'shot']], p1: [['shot']], hp: 200 });
    a.give(B1, 'stun', { source: A1, duration: 6 }).use(A1, 'rage.ocean').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    a.pass(1);
    const d0 = dur(a, B1, 'stun');
    a.use(A1, 'shot', B1).end();
    expect(dur(a, B1, 'stun')).toBe(d0 - 1 + 2);
    expect(200 - a.hp(B1)).toBe(25); // Shot + 2 Might
    a.pass(1);
    const d1 = dur(a, B1, 'stun');
    a.use(A1, 'shot', B1).end();
    expect(dur(a, B1, 'stun')).toBe(d1 - 1); // only once per enemy
  });

  it('Spindrift: 15, 2 Renew and Brimming for 2 turns', () => {
    const a = arena({ p0: [['shot.ocean']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'shot.ocean', B1).end();
    expect([a.hp(B1), a.has(A1, 'brimming')]).toEqual([85, true]);
    expect(a.hp(A1)).toBe(60); // 2 Renew healed 10 at the end of the turn
  });

  it('Spindrift: already Brimming, it spends the Brimming Shield for as much extra damage (up to 20)', () => {
    const a = arena({ p0: [['shot.ocean']], p1: [['shot']] });
    a.give(A1, 'brimming').give(A1, 'brimming_shield', { value: 25 }).use(A1, 'shot.ocean', B1).end();
    expect([a.hp(B1), shield(a, A1), a.stacks(A1, 'renew')]).toEqual([65, 5, 0]);
  });

  it('Harpoon: Crest 45 on the following turn; Trough 30 and allies heal 30 split evenly', () => {
    const a = arena({ p0: [['snipe.ocean'], ['shot']], p1: [['shot']], hp: 200 });
    a.use(A1, 'snipe.ocean', B1).end();
    expect(a.hp(B1)).toBe(200);
    a.end();
    expect(a.hp(B1)).toBe(155);
    a.setHp(A1, 100).setHp(A2, 100).pass(4).use(A1, 'snipe.ocean', B1).end().end();
    expect(a.hp(B1)).toBe(125);
    expect([a.hp(A1), a.hp(A2)]).toEqual([115, 115]);
  });

  it('Undercurrent (Crest): for 2 turns, each Harmful skill the target uses deals them 10', () => {
    const a = arena({ p0: [['trap.ocean']], p1: [['shot']] });
    a.use(A1, 'trap.ocean', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(1).use(B1, 'shot', A1).end(); // 2 turns are over
    expect(a.hp(B1)).toBe(80);
  });

  it("Undercurrent (Crest): each Harmful skill raises the target's other cooldowns by 1", () => {
    const run = (trap: boolean) => {
      const a = arena({ p0: [['trap.ocean', 'shot']], p1: [['shot', 'smash']] });
      a.pass(1).use(B1, 'smash', A1).end(); // Smash goes on cooldown
      a.use(A1, trap ? 'trap.ocean' : 'shot', B1).end();
      a.use(B1, 'shot', A1).end();
      return a.cooldown(B1, 'smash');
    };
    expect(run(true)).toBe(run(false) + 1);
  });

  it('Undercurrent (Crest): Helpful skills don\'t trigger it', () => {
    const a = arena({ p0: [['trap.ocean']], p1: [['heal']] });
    a.use(A1, 'trap.ocean', B1).end().use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Undercurrent (Trough): each Helpful skill the target uses heals the user\'s weakest ally as much', () => {
    const a = arena({ p0: [['trap.ocean'], ['shot']], p1: [['heal']] });
    a.use(A1, 'trap.ocean', B1).end().pass(7);
    a.setHp(A2, 40).use(A1, 'trap.ocean', B1).end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([75, 65]);
  });

  it('Sounding: Invulnerable and Flow; each skill used with Flow gives the weakest ally 2 Renew', () => {
    const a = arena({ p0: [['maneuver.ocean', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.ocean').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'flow')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end().setHp(A2, 40).use(A1, 'shot', B1).end();
    expect(a.hp(A2)).toBe(50); // 2 Renew tick
  });

  it('Kraken: 40 HP; Tentacles Crest 15, Trough stuns non-Strategic skills for 1 turn', () => {
    const a = arena({ p0: [['companion.ocean']], p1: [['shot', 'heal']] });
    a.use(A1, 'companion.ocean').end().pass(1);
    const k = minions(a, 'kraken')[0]!;
    expect(k.hp).toBe(40);
    a.use(k.id, 'kraken_tentacles', B1).end().pass(1);
    expect(a.hp(B1)).toBe(85);
    a.use(k.id, 'kraken_tentacles', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_ns')]).toEqual([85, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'heal', B1); // Strategic skills still work
  });

  it('Brine Bolt: 25 and a Mark; whoever spends it gains 2 Renew and Brimming', () => {
    const a = arena({ p0: [['bolt.ocean'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.ocean', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 15 - 10);
    expect([a.has(A2, 'brimming'), a.has(A1, 'brimming')]).toEqual([true, false]);
    expect(a.effects(A2).some((e) => e.defId === 'renew')).toBe(true);
  });

  it('Flood Tide: 20 to all; every ally gains Brimming and 1 Renew per enemy hit', () => {
    const a = arena({ p0: [['blast.ocean'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'blast.ocean').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 80, 80]);
    expect([a.has(A1, 'brimming'), a.has(A2, 'brimming')]).toEqual([true, true]);
    // 3 Renew each; one tick at the end of the turn costs a stack.
    expect([a.stacks(A1, 'renew'), a.stacks(A2, 'renew')]).toEqual([2, 2]);
  });

  it('Ebbing Toll: 5 and the user heals 5; for 2 turns the target\'s Confusion heals the user 10 per extra energy', () => {
    const a = arena({ p0: [['consume.ocean']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'confusion', { source: A1, duration: 10 }).use(A1, 'consume.ocean', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 55]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(55 - 15 + 10);
  });

  it('Ebbing Toll: no Confusion, no healing', () => {
    const a = arena({ p0: [['consume.ocean']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.ocean', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(40);
  });

  it('Jellyfish Bloom: 3 Jellyfish (10 HP) for 3 turns', () => {
    const a = arena({ p0: [['summon.ocean']], p1: [['shot']] });
    a.use(A1, 'summon.ocean').end();
    expect(minions(a, 'jellyfish').map((u) => u.hp)).toEqual([10, 10, 10]);
    a.pass(5);
    expect(minions(a, 'jellyfish')).toHaveLength(0);
  });

  it('Jellyfish Bloom: the enemy who kills a Jellyfish is Stunned for 1 turn', () => {
    const a = arena({ p0: [['summon.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.ocean').end();
    const j = minions(a, 'jellyfish')[0]!;
    a.use(B1, 'shot', j.id).end();
    expect([a.has(B1, 'stun'), a.has(B2, 'stun')]).toEqual([true, false]);
  });

  it('Stinging Bell: free, 5 damage', () => {
    const a = arena({ p0: [['summon.ocean']], p1: [['shot']] });
    a.use(A1, 'summon.ocean').end().pass(1);
    a.use(minions(a, 'jellyfish')[0]!.id, 'jellyfish_stinging_bell', B1);
    expect(a.state.players[0].queue[0]?.cost).toEqual(parseCost('nc'));
    a.end();
    expect(a.hp(B1)).toBe(95);
  });

  it('Slack Water: 10 to all enemies each of the user\'s turns, up to 3 turns', () => {
    const a = arena({ p0: [['channel.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.ocean').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(6);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });

  it('Slack Water: while it channels, allies\' Renew doesn\'t lose stacks', () => {
    const a = arena({ p0: [['channel.ocean'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'renew', { stacks: 2, source: A2 }).use(A1, 'channel.ocean').end();
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([60, 2]);
    a.pass(6); // the channel is over: Renew wears down again
    expect(a.stacks(A2, 'renew')).toBeLessThan(2);
  });

  it('Slipfoot Knife: 10, or 20 at or below 60 HP; a Confused target loses it and is Stunned', () => {
    const a = arena({ p0: [['stab.ocean']], p1: [['shot'], ['shot']] });
    a.give(B1, 'confusion', { source: A1, duration: 10 }).setHp(B2, 60);
    a.use(A1, 'stab.ocean', B1).end();
    expect([a.hp(B1), a.has(B1, 'confusion'), a.has(B1, 'stun')]).toEqual([90, false, true]);
    a.pass(1).use(A1, 'stab.ocean', B2).end();
    expect([a.hp(B2), a.has(B2, 'stun')]).toEqual([40, false]);
  });

  it('Breaker Swell: 40 Piercing and 15 to each ally; the user is Stunned on their next turn', () => {
    const a = arena({ p0: [['ravage.ocean', 'shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.ocean', B1).end(); // Piercing ignores Armor
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 85]);
    a.pass(1);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    a.pass(2);
    a.use(A1, 'shot', B2).end();
    expect(a.hp(B2)).toBe(70);
  });

  it('Siren\'s Lure (Crest): counters a Harmful skill and Taunts its user to the caster for 2 turns', () => {
    const a = arena({ p0: [['mislead.ocean'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.ocean', B1).end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'taunt')]).toEqual([100, true]);
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(A1);
  });

  it('Siren\'s Lure (Crest): Helpful skills go through', () => {
    const a = arena({ p0: [['mislead.ocean']], p1: [['heal']] });
    a.use(A1, 'mislead.ocean', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Siren\'s Lure (Trough): counters a Helpful skill and Stuns its user; Harmful ones go through', () => {
    const a = arena({ p0: [['mislead.ocean']], p1: [['heal'], ['shot']] });
    a.use(A1, 'mislead.ocean', B1).end().pass(5);
    a.use(A1, 'mislead.ocean', B1).end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([50, true]);
    const b = arena({ p0: [['mislead.ocean']], p1: [['shot']] });
    b.use(A1, 'mislead.ocean', B1).end().pass(5).use(A1, 'mislead.ocean', B1).end();
    b.use(B1, 'shot', A1).end();
    expect(b.hp(A1)).toBe(85);
  });

  it('Maelstrom: Crest 15 and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.ocean']], p1: [['shot']] });
    a.use(A1, 'stun.ocean', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([85, true]);
  });

  it('Maelstrom: Trough lengthens Stunned enemies\' Stuns by 1 turn; the others gain 1 Confusion', () => {
    const a = arena({ p0: [['stun.ocean'], ['stun.crystal']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.ocean', B1).end().pass(3);
    a.use(A2, 'stun.crystal', B1).end().pass(1);
    const d = dur(a, B1, 'stun');
    a.use(A1, 'stun.ocean', B1).end();
    expect(dur(a, B1, 'stun')).toBe(d - 1 + 2);
    expect([a.has(B1, 'confusion'), a.stacks(B2, 'confusion')]).toEqual([false, 1]);
  });

  it('Swell of the Deep: Flow, Brimming, Swiftness, and 2 Renew at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['dance.ocean']], p1: [['shot']] });
    a.use(A1, 'dance.ocean').end();
    expect([a.has(A1, 'flow'), a.has(A1, 'brimming'), a.stacks(A1, 'swiftness')]).toEqual([true, true, 1]);
    a.pass(1);
    expect(a.stacks(A1, 'renew')).toBeGreaterThanOrEqual(2);
  });

  it('Swell of the Deep: each time Brimming gives Shield, 1 Might for 1 turn', () => {
    const a = arena({ p0: [['dance.ocean']], p1: [['shot']] });
    a.use(A1, 'dance.ocean').end().pass(1).end(); // turn 3: 2 Renew at full HP overflows
    expect([shield(a, A1) > 0, a.stacks(A1, 'might')]).toEqual([true, 1]);
  });

  it('Tidepool: heals 30; overflow becomes 2 Renew per 10, and Brimming for 2 turns', () => {
    const a = arena({ p0: [['heal.ocean'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 80).use(A1, 'heal.ocean', A2).end();
    expect(a.hp(A2)).toBe(100);
    expect(a.has(A2, 'brimming')).toBe(true);
    // 10 overflow → 2 Renew; its first tick at full HP becomes Shield.
    expect(a.effects(A2).filter((e) => e.defId === 'renew').reduce((n, e) => n + e.stacks, 0) + 1).toBe(2);
    expect(shield(a, A2)).toBe(10);
  });

  it('Sea Legs: Flow for 3 turns; each counter it ignores heals the ally 15', () => {
    const a = arena({ p0: [['bless.ocean'], ['shot']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.setHp(A2, 50).use(A1, 'bless.ocean', A2).use(A2, 'shot', B1).end();
    expect([a.has(A2, 'flow'), a.hp(B1), a.hp(A2)]).toEqual([true, 85, 65]);
  });

  it('Brine Haze: Confused for 2 turns; each Renew an ally of the user gains adds 1 Confusion', () => {
    const a = arena({ p0: [['curse.ocean'], ['strike.water']], p1: [['shot']] });
    a.use(A1, 'curse.ocean', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
    a.pass(1).use(A2, 'strike.water', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(2);
  });

  it('Foambreaker: 20; for 1 turn, allies who damage the target gain 2 Renew and Brimming', () => {
    const a = arena({ p0: [['smite.ocean'], ['shot'], ['heal']], p1: [['shot']] });
    a.use(A1, 'smite.ocean', B1).use(A2, 'shot', B1).use(A3, 'heal', A3).end();
    expect(a.hp(B1)).toBe(65);
    expect([a.has(A2, 'brimming'), a.has(A3, 'brimming')]).toEqual([true, false]);
  });

  it('Chorus of Tides: all allies heal 30; overflow becomes Shield, up to 30 each', () => {
    const a = arena({ p0: [['prayer.ocean'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 90).setHp(A2, 40).use(A1, 'prayer.ocean').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([100, 70, 100]);
    expect([shield(a, A1), shield(a, A2), shield(a, A3)]).toEqual([20, 0, 30]);
  });

  it('Crosscurrent: Crest 25 to the target and 15 to another', () => {
    const a = arena({ p0: [['cleave.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.ocean', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Crosscurrent: Trough 10 to the target and another, and each gains the other\'s Debuffs', () => {
    const a = arena({ p0: [['cleave.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.ocean', B1).end().pass(3);
    a.give(B1, 'weakness', { source: A1 }).give(B2, 'vulnerable', { source: A1, duration: 10 });
    a.use(A1, 'cleave.ocean', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 70]); // B1 has Weakness, B2 Vulnerable
    expect([a.has(B1, 'vulnerable'), a.has(B2, 'weakness'), a.has(B1, 'weakness'), a.has(B2, 'vulnerable')]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("Whalesong: 1 Vulnerable for 2 turns; reveals enemies' Invisible effects", () => {
    const a = arena({ p0: [['shout.ocean']], p1: [['trap.dragon'], ['shot']] });
    a.pass(1).use(B1, 'trap.dragon', A1).end();
    const hidden = () => a.effects(A1).find((e) => e.sourceSkill === 'trap.dragon');
    expect(hidden()?.revealed).toBe(false);
    a.use(A1, 'shout.ocean').end();
    expect([a.stacks(B1, 'vulnerable'), a.stacks(B2, 'vulnerable')]).toEqual([1, 1]);
    expect(hidden()?.revealed).toBe(true);
    a.pass(4);
    expect(a.has(B1, 'vulnerable')).toBe(false);
  });

  it('Whalesong: Invisible effects the enemies make in the next 2 turns are revealed as they\'re made', () => {
    const a = arena({ p0: [['shout.ocean']], p1: [['trap']] });
    a.use(A1, 'shout.ocean').end().use(B1, 'trap', A1).end();
    expect(a.effects(A1).find((e) => e.defId === 'trap')?.revealed).toBe(true);
  });

  it('Returning Wave: 30 Shield for 1 turn; what\'s left is split evenly among enemies when it ends', () => {
    const a = arena({ p0: [['withstand.ocean']], p1: [['stab'], ['shot']] });
    a.use(A1, 'withstand.ocean').end();
    expect(shield(a, A1)).toBe(30);
    a.use(B1, 'stab', A1).end(); // 20 left
    expect([shield(a, A1), a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([0, 100, 90, 90]);
  });

  it('Returning Wave: an untouched Shield crashes for 15 each on 2 enemies', () => {
    const a = arena({ p0: [['withstand.ocean']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.ocean').end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it('Riptide: Taunt for 2 turns; each Harmful skill the target uses gives the user 2 Renew', () => {
    const a = arena({ p0: [['taunt.ocean']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'taunt.ocean', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'renew')).toBe(2);
  });

  it('Leviathan Form: 2 Armor and Brimming; each turn, bites the enemy with the least HP for 15 and gains 2 Renew', () => {
    const a = arena({ p0: [['titan.ocean']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'titan.ocean').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'brimming')]).toEqual([100, 35, true]);
    expect(a.stacks(A1, 'renew')).toBeGreaterThanOrEqual(1);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95); // 2 Armor
  });
});

const KIT: [string, string, number][] = [
  ['strike', 'I', 0], ['smash', 'Srr', 2], ['charge', 'I', 2], ['riposte', 'r', 3], ['rage', 'SS', 4],
  ['shot', 'r', 0], ['snipe', 'Ir', 2], ['trap', 'A', 3], ['maneuver', 'I', 3], ['companion', 'I', 1],
  ['bolt', 'I', 1], ['blast', 'II', 2], ['consume', 'r', 2], ['summon', 'I', 1], ['channel', 'rr', 3],
  ['stab', 'r', 0], ['ravage', 'Ar', 3], ['mislead', 'I', 2], ['stun', 'I', 2], ['dance', 'Ar', 5],
  ['heal', 'W', 1], ['bless', 'r', 2], ['curse', 'r', 2], ['smite', 'I', 1], ['prayer', 'Irr', 2],
  ['cleave', 'S', 1], ['shout', 'I', 2], ['withstand', 'r', 3], ['taunt', 'r', 3], ['titan', 'WI', 4],
];

describe('Ocean costs and cooldowns (design doc kit table)', () => {
  it.each(KIT)('%s.ocean costs %s, cooldown %i', (base, cost, cd) => {
    const s = content.skills[`${base}.ocean`]!;
    expect([s.cost, s.cooldown]).toEqual([parseCost(cost), cd]);
  });
});
