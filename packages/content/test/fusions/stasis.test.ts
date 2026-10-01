// Spec-driven tests for the Stasis fusion (Ice + Poison): Suspended, Thaw and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.23 (and Poison §12.1 for Toxin/Prey),
// and the "Stasis — Ice + Poison" kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Durations: "for N turns" applied on the applier's own turn is 2N internal ticks (rules §8.1);
// applied on the opponent's turn it's 2N + 1. Toxin ticks 5 per stack at the end of its
// applier's turn; a `give` without a source makes the bearer its applier.

import { describe, expect, it } from 'vitest';
import { viewFor, type Energy, type GameEvent } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type Applied = Extract<GameEvent, { t: 'effectApplied' }>;

function dur(a: Arena, id: string, key: string): number | null | undefined {
  return a.effects(id).find((e) => (e.inline ? e.inline.id : e.defId) === key)?.duration;
}

function appliedDur(a: Arena, bearer: string, defId: string): number | null | undefined {
  const evs = a.last.filter((e): e is Applied => e.t === 'effectApplied' && e.bearer === bearer && e.defId === defId);
  return evs[evs.length - 1]?.duration;
}

const suspended = (a: Arena, id: string) => a.has(id, 'suspended') || a.has(id, 'suspended_ally');

function setEnergy(a: Arena, player: 0 | 1, e: Partial<Energy>): void {
  a.state.players[player].energy = { S: 0, A: 0, I: 0, W: 0, ...e };
}

const total = (e: Energy) => e.S + e.A + e.I + e.W;

function minion(a: Arena, defId: string) {
  return a.state.units.find((u) => u.defId === defId && u.alive);
}

const hidden = (a: Arena, bearer: string, from: 0 | 1) => !viewFor(content, a.state, from).effects.some((e) => e.bearer === bearer && e.source !== bearer);

describe('Stasis keywords', () => {
  it('Suspended: the bearer’s effects don’t tick or lose duration, and the bearer still acts', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).give(B1, 'weakness', { source: A1, duration: 3 });
    a.give(B1, 'suspended', { source: A1, duration: 3 });
    a.end().use(B1, 'shot', A1).end(); // B1 acts (Weakness still works); their Toxin doesn't tick
    expect(a.hp(A1)).toBe(90);
    expect(dur(a, B1, 'weakness')).toBe(3);
    expect(a.hp(B1)).toBe(100);
  });

  it('Thaw: when Suspended ends, Toxin deals its damage at once, doubled (10 Affliction per stack), then keeps ticking', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).give(B1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 50 });
    a.give(B1, 'suspended', { source: A1, duration: 2 }); // ends with B's turn
    a.end().end();
    expect([a.hp(B1), suspended(a, B1), a.stacks(B1, 'toxin')]).toEqual([80, false, 2]);
    a.end().end(); // B's next turn: Toxin ticks normally again
    expect(a.hp(B1)).toBe(70);
  });

  it('Thaw: no Toxin, no damage', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'suspended', { source: A1, duration: 2 }).end().end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Suspended is a Debuff; the allied version is a Buff that counts as Suspended', () => {
    expect(content.statuses.suspended?.kind).toBe('Debuff');
    expect(content.statuses.suspended_ally?.kind).toBe('Buff');
    expect(content.statuses.suspended_ally?.countsAs).toContain('suspended');
  });

  it('Suspended (allied): the bearer’s Buffs hold', () => {
    const a = arena({ p0: [['heal.stasis']], p1: [['shot']] });
    a.give(A1, 'might', { duration: 1 }); // would end this turn
    a.use(A1, 'heal.stasis', A1).end().end();
    expect(a.has(A1, 'might')).toBe(true);
  });
});

describe('Stasis skills', () => {
  it('Ticking Venom: 20 damage; until the user’s next turn, the target’s Toxin also deals its damage when they use a skill', () => {
    const a = arena({ p0: [['strike.stasis']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).use(A1, 'strike.stasis', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B1, 'shot', A1).end(); // +10 on use, +10 normal tick at the end of B's turn
    expect(a.hp(B1)).toBe(60);
  });

  it('Ticking Venom: wears off at the user’s next turn', () => {
    const a = arena({ p0: [['strike.stasis', 'shot']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).use(A1, 'strike.stasis', B1).end().end(); // B didn't act: 80 − 10 tick
    expect(a.hp(B1)).toBe(70);
    a.end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(60); // only the normal tick
  });

  it('Frozen Stomp: 25 damage and Suspended for 1 turn; at the Thaw, each of their allies takes half its damage', () => {
    const a = arena({ p0: [['smash.stasis']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 2 });
    a.use(A1, 'smash.stasis', B1).end();
    expect([a.hp(B1), a.has(B1, 'suspended')]).toEqual([75, true]);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.has(B1, 'suspended')]).toEqual([55, 90, 90, false]);
  });

  it('Frozen Stomp: no Toxin, nothing to share', () => {
    const a = arena({ p0: [['smash.stasis']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.stasis', B1).end().end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 100]);
  });

  it('Freezing Lunge: 10 damage; through the user’s next turn every enemy is Prey', () => {
    const a = arena({ p0: [['charge.stasis']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.stasis', B1).end();
    expect([a.hp(B1), a.has(B1, 'prey'), a.has(B2, 'prey')]).toEqual([90, true, true]);
    a.end().end();
    expect(a.has(B2, 'prey')).toBe(false);
  });

  it('Freezing Lunge: the user’s next skill Suspends its targets for 1 turn (only the next)', () => {
    const a = arena({ p0: [['charge.stasis', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.stasis', B1).end().end();
    a.use(A1, 'shot', B2).end();
    expect([a.has(B2, 'suspended'), a.has(B1, 'suspended')]).toEqual([true, false]);
    expect(appliedDur(a, B2, 'suspended')).toBe(2);
    a.end().use(A1, 'shot', B1).end();
    expect(a.has(B1, 'suspended')).toBe(false);
  });

  it('Freeze Frame: Invisible; counters every Harmful skill used on the user; each attacker gains 2 Toxin and is Suspended', () => {
    const a = arena({ p0: [['riposte.stasis']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.stasis').end();
    expect(hidden(a, A1, 1)).toBe(true);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin'), a.has(B1, 'suspended'), a.has(B2, 'suspended')]).toEqual([2, 2, true, true]);
  });

  it('Freeze Frame: the Toxin lands later as a Thaw', () => {
    const a = arena({ p0: [['riposte.stasis']], p1: [['shot']] });
    a.use(A1, 'riposte.stasis').end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect(a.has(B1, 'suspended')).toBe(false);
    expect(a.hp(B1)).toBe(80); // the 20 Thaw
  });

  it('Freeze Frame: Helpful skills aren’t countered', () => {
    const a = arena({ p0: [['riposte.stasis']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'riposte.stasis').end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'toxin')]).toEqual([75, false]);
  });

  it('Stopped Clock: 1 Might and Immune for 3 turns, and the user’s skills don’t go on cooldown', () => {
    const a = arena({ p0: [['rage.stasis', 'smash']], p1: [['curse']] });
    a.use(A1, 'rage.stasis').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([1, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.use(A1, 'smash', B1).end();
    expect(a.cooldown(A1, 'smash')).toBe(0);
    a.end().use(A1, 'smash', B1).end(); // again right away
    expect(a.hp(B1)).toBe(40);
  });

  it('Stopped Clock: when it ends, every skill of theirs goes 2 turns onto cooldown', () => {
    const a = arena({ p0: [['rage.stasis', 'smash', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.stasis').end();
    a.pass(5);
    expect([a.has(A1, 'immune'), a.cooldown(A1, 'smash') >= 2, a.cooldown(A1, 'shot') >= 2]).toEqual([false, true, true]);
    expect(() => a.use(A1, 'shot', B1)).toThrow();
  });

  it('Rime Needle: 10 Piercing; each Frost debuff on the target lasts 1 turn longer', () => {
    const a = arena({ p0: [['shot.stasis']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1, duration: 3 }).give(B1, 'numb', { source: A1, duration: 3 }).give(B1, 'weakness', { source: A1, duration: 3 });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'shot.stasis', B1).end();
    expect(a.hp(B1)).toBe(90);
    expect([dur(a, B1, 'chilled'), dur(a, B1, 'numb'), dur(a, B1, 'weakness')]).toEqual([4, 4, 2]);
  });

  it('Release: Suspended until it lands the following turn; then 30 Piercing and they Thaw', () => {
    const a = arena({ p0: [['snipe.stasis']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'snipe.stasis', B1).end();
    expect([a.hp(B1), a.has(B1, 'suspended')]).toEqual([100, true]);
    a.end();
    expect([a.hp(B1), a.has(B1, 'suspended')]).toEqual([50, false]); // 30 + 20 Thaw; the Toxin didn't tick
  });

  it('Cold Pit: Invisible; the first time the target is healed, they gain 2 Toxin and are Suspended for 1 turn', () => {
    const a = arena({ p0: [['trap.stasis']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'trap.stasis', B1).end();
    expect(hidden(a, B1, 1)).toBe(true);
    a.use(B1, 'heal', B1).end();
    expect([a.stacks(B1, 'toxin'), a.has(B1, 'suspended')]).toEqual([2, true]);
    a.pass(3).use(B1, 'heal', B1).end();
    expect(a.stacks(B1, 'toxin')).toBe(2); // only the first time
  });

  it('Cold Pit: damage doesn’t set it off', () => {
    const a = arena({ p0: [['trap.stasis'], ['shot']], p1: [['heal']] });
    a.use(A1, 'trap.stasis', B1).use(A2, 'shot', B1).end();
    expect(a.has(B1, 'toxin')).toBe(false);
  });

  it('Cryosleep: Invulnerable for 1 turn and Suspended for 2: Buffs hold, Debuffs wait', () => {
    const a = arena({ p0: [['maneuver.stasis']], p1: [['shot']] });
    a.give(A1, 'might', { duration: 2 }).give(A1, 'toxin', { stacks: 1, source: B1 });
    a.use(A1, 'maneuver.stasis').end();
    expect([a.has(A1, 'invulnerable'), suspended(a, A1)]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect([a.hp(A1), a.has(A1, 'might')]).toEqual([100, true]); // no tick, Might held
    expect(content.skills['maneuver.stasis']?.tags).toContain('Unstunnable');
  });

  it('Cryosleep: usable while Stunned (Unstunnable)', () => {
    const a = arena({ p0: [['maneuver.stasis']], p1: [['shot']] });
    a.give(A1, 'stun', { source: B1, duration: 2 }).use(A1, 'maneuver.stasis').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
  });

  it('Ice Spider: a permanent 30 HP Spider; Frost Web Suspends for 1 turn', () => {
    const a = arena({ p0: [['companion.stasis']], p1: [['shot']] });
    a.use(A1, 'companion.stasis').end().end();
    const sp = minion(a, 'ice_spider')!;
    expect(sp.hp).toBe(30);
    a.use(sp.id, 'ice_spider_frost_web', B1).end();
    expect(a.has(B1, 'suspended')).toBe(true);
    expect(appliedDur(a, B1, 'suspended')).toBe(2);
  });

  it('Ice Spider: Frozen Fang deals 5 Piercing and 1 Toxin', () => {
    const a = arena({ p0: [['companion.stasis']], p1: [['shot']] });
    a.use(A1, 'companion.stasis').end().end();
    const sp = minion(a, 'ice_spider')!;
    a.give(B1, 'armor', { stacks: 2 }).use(sp.id, 'ice_spider_frozen_fang', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([90, 1]); // 5 Piercing, then the new Toxin ticks 5
  });

  it('Ice Spider: Frozen Fang on a Suspended target Thaws them at once instead (no hit, no new Toxin)', () => {
    const a = arena({ p0: [['companion.stasis', 'smash.stasis']], p1: [['shot']] });
    a.use(A1, 'companion.stasis').end().end();
    const sp = minion(a, 'ice_spider')!;
    a.give(B1, 'toxin', { stacks: 2 });
    a.use(A1, 'smash.stasis', B1).use(sp.id, 'ice_spider_frozen_fang', B1).end();
    expect([a.hp(B1), a.has(B1, 'suspended'), a.stacks(B1, 'toxin')]).toEqual([55, false, 2]); // 25 + 20 Thaw
  });

  it('Chilling Acid: 20 damage; for 2 turns, a Toxined target is Chilled at the end of the user’s turns (ruling)', () => {
    const a = arena({ p0: [['bolt.stasis']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 1, source: A1 }).use(A1, 'bolt.stasis', B1).end();
    expect([a.hp(B1), a.has(B1, 'chilled')]).toEqual([75, true]);
  });

  it('Chilling Acid: no Toxin, no Chill', () => {
    const a = arena({ p0: [['bolt.stasis']], p1: [['shot']] });
    a.use(A1, 'bolt.stasis', B1).end().end();
    expect(a.has(B1, 'chilled')).toBe(false);
  });

  it('Absolute Stillness: 25 to all enemies, then every unit on both sides, the user included, is Suspended for 1 turn', () => {
    const a = arena({ p0: [['blast.stasis'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.stasis').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
    expect([a.has(B1, 'suspended'), a.has(B2, 'suspended'), a.has(A1, 'suspended_ally'), a.has(A2, 'suspended_ally')]).toEqual([true, true, true, true]);
  });

  it('Final Thaw: the target’s Toxin deals its damage at once, doubled, and the user heals as much', () => {
    const a = arena({ p0: [['consume.stasis']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'toxin', { stacks: 3 }).give(B1, 'shield', { value: 50 });
    a.use(A1, 'consume.stasis', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([70, 80]);
  });

  it('Final Thaw: no Toxin, no damage or healing', () => {
    const a = arena({ p0: [['consume.stasis']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.stasis', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([100, 50]);
  });

  it('Cryo Sprite: 15 HP for 3 turns; Rime Sting deals 5 Piercing and 1 Toxin', () => {
    const a = arena({ p0: [['summon.stasis']], p1: [['shot']] });
    a.use(A1, 'summon.stasis').end().end();
    const cs = minion(a, 'cryo_sprite')!;
    expect(cs.hp).toBe(15);
    a.give(B1, 'armor', { stacks: 2 }).use(cs.id, 'cryo_sprite_rime_sting', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([90, 1]); // 5 Piercing, then the new Toxin ticks 5
  });

  it('Cryo Sprite: if it lasts all 3 turns, every enemy with Toxin is Suspended for 1 turn', () => {
    const a = arena({ p0: [['summon.stasis']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 1, source: A1 });
    a.use(A1, 'summon.stasis').end().end();
    a.end().end();
    expect(a.has(B1, 'suspended')).toBe(false);
    a.end();
    expect([a.has(B1, 'suspended'), a.has(B2, 'suspended')]).toEqual([true, false]);
  });

  it('Cryo Sprite: killed early, nothing happens', () => {
    const a = arena({ p0: [['summon.stasis']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 1, source: A1 });
    a.use(A1, 'summon.stasis').end();
    const cs = minion(a, 'cryo_sprite')!;
    a.use(B1, 'shot', cs.id).end();
    expect(minion(a, 'cryo_sprite')).toBeUndefined();
    a.pass(6);
    expect(a.has(B1, 'suspended')).toBe(false);
  });

  it('Nine Winters: while it channels every enemy is Suspended (Toxin and durations held) and gains Toxin each turn', () => {
    const a = arena({ p0: [['channel.stasis']], p1: [['shot']] });
    a.give(B1, 'weakness', { source: A1, duration: 3 });
    a.use(A1, 'channel.stasis').end();
    expect(a.stacks(B1, 'toxin')).toBe(1);
    a.pass(2);
    expect([a.stacks(B1, 'toxin'), a.hp(B1), dur(a, B1, 'weakness')]).toEqual([2, 100, 3]);
  });

  it('Nine Winters: after up to 4 turns it ends and they all Thaw', () => {
    const a = arena({ p0: [['channel.stasis']], p1: [['shot']] });
    a.use(A1, 'channel.stasis').end().pass(6); // 4 ticks: 4 Toxin
    expect(a.stacks(B1, 'toxin')).toBe(4);
    a.pass(2);
    expect(suspended(a, B1)).toBe(false);
    expect(a.hp(B1)).toBeLessThanOrEqual(60); // 40 Thaw
  });

  it('Nine Winters: if the channel breaks, they Thaw then', () => {
    const a = arena({ p0: [['channel.stasis']], p1: [['stun']] });
    a.use(A1, 'channel.stasis').end();
    a.use(B1, 'stun', A1).end(); // interrupts the channel
    expect(suspended(a, B1)).toBe(false);
    expect(a.hp(B1)).toBe(90); // 1 Toxin, doubled
  });

  it('Icebite: 5 Piercing; against Prey, +1 random energy for the user’s player and Suspended for 1 turn', () => {
    const a = arena({ p0: [['stab.stasis']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 0, { S: 1 });
    a.give(B1, 'prey', { source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'stab.stasis', B1).end();
    expect([a.hp(B1), a.has(B1, 'suspended'), total(a.state.players[0].energy)]).toEqual([95, true, 1]);
  });

  it('Icebite: against a target that isn’t Prey, just the damage', () => {
    const a = arena({ p0: [['stab.stasis']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 0, { S: 1 });
    a.use(A1, 'stab.stasis', B1).end();
    expect([a.hp(B1), a.has(B1, 'suspended'), total(a.state.players[0].energy)]).toEqual([95, false, 0]);
  });

  it('Cryo Rend: 25 Piercing, or 40 against a Stunned target, who is also Suspended so the Stun can’t wear off', () => {
    const a = arena({ p0: [['ravage.stasis'], ['ravage.stasis']], p1: [['shot'], ['shot']] });
    a.give(B1, 'stun', { source: A1, duration: 1 }).give(B2, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.stasis', B1).use(A2, 'ravage.stasis', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'suspended'), a.has(B2, 'suspended')]).toEqual([60, 75, true, false]);
    expect(a.has(B1, 'stun')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Cold Shelter: Invisible; counters the target’s Harmful skill and the user is Frostborn for 2 turns', () => {
    const a = arena({ p0: [['mislead.stasis']], p1: [['shot']] });
    a.use(A1, 'mislead.stasis', B1).end();
    expect(hidden(a, B1, 1)).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'frostborn')]).toEqual([100, true]);
    expect(appliedDur(a, A1, 'frostborn')).toBe(5);
  });

  it('Cold Shelter: Helpful skills go through with no Frostborn', () => {
    const a = arena({ p0: [['mislead.stasis']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.stasis', B1).end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(A1, 'frostborn')]).toEqual([75, false]);
  });

  it('Hold: Stunned for 1 turn; when the Stun ends, their Toxin deals its damage at once, doubled', () => {
    const a = arena({ p0: [['stun.stasis']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: A1 });
    a.use(A1, 'stun.stasis', B1).end(); // 10 tick at the end of A's turn
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([90, true]);
    expect(appliedDur(a, B1, 'stun')).toBe(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([70, false]);
  });

  it('Hold: 2 turns against Prey', () => {
    const a = arena({ p0: [['stun.stasis']], p1: [['shot']] });
    a.give(B1, 'prey', { source: A1 }).use(A1, 'stun.stasis', B1).end();
    expect(appliedDur(a, B1, 'stun')).toBe(4);
  });

  it('Serpent’s Measure: 1 Might, 1 Swiftness and 1 Focus for 3 turns', () => {
    const a = arena({ p0: [['dance.stasis']], p1: [['shot']] });
    a.use(A1, 'dance.stasis').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1, 1]);
  });

  it('Serpent’s Measure: each enemy with Toxin at the end of the user’s turns is Prey until their next turn', () => {
    const a = arena({ p0: [['dance.stasis']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 1 });
    a.use(A1, 'dance.stasis').end();
    expect([a.has(B1, 'prey'), a.has(B2, 'prey')]).toEqual([true, false]);
  });

  it('Cold Storage: heals 25 and removes their Toxin, then Suspended (allied) for 1 turn', () => {
    const a = arena({ p0: [['heal.stasis'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'toxin', { stacks: 3, source: B1 });
    a.use(A1, 'heal.stasis', A2).end();
    expect([a.hp(A2), a.has(A2, 'toxin'), a.has(A2, 'suspended_ally'), a.has(A2, 'suspended')]).toEqual([75, false, true, false]);
    expect(appliedDur(a, A2, 'suspended_ally')).toBe(2);
  });

  it('Preserved Vigor: 1 Might per Buff the ally has, then Suspended for 2 turns so their Buffs hold', () => {
    const a = arena({ p0: [['bless.stasis'], ['shot']], p1: [['shot']] });
    a.give(A2, 'armor', { duration: 1 }).give(A2, 'swiftness', { duration: 1 });
    a.use(A1, 'bless.stasis', A2).end();
    expect([a.stacks(A2, 'might'), a.has(A2, 'suspended_ally')]).toEqual([2, true]);
    expect(appliedDur(a, A2, 'suspended_ally')).toBe(4);
    a.end();
    expect([a.has(A2, 'armor'), a.has(A2, 'swiftness')]).toEqual([true, true]);
  });

  it('Preserved Vigor: no Buffs, no Might', () => {
    const a = arena({ p0: [['bless.stasis']], p1: [['shot']] });
    a.use(A1, 'bless.stasis', A1).end();
    expect(a.has(A1, 'might')).toBe(false);
  });

  it('Stilled Blood: Confused and Suspended for 2 turns; each skill they use adds 1 Toxin, held for the Thaw', () => {
    const a = arena({ p0: [['curse.stasis']], p1: [['shot']] });
    a.use(A1, 'curse.stasis', B1).end();
    expect([a.has(B1, 'confusion'), a.has(B1, 'suspended')]).toEqual([true, true]);
    expect(appliedDur(a, B1, 'suspended')).toBe(4);
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'toxin'), a.hp(B1)]).toEqual([1, 100]);
    a.end().use(B1, 'shot', A1).end(); // second skill; the Suspension ends: Thaw for 2 stacks
    expect([a.has(B1, 'suspended'), a.hp(B1)]).toEqual([false, 80]);
  });

  it('Frozen Quarry: 20 damage; for 2 turns each Frost debuff on them counts toward Prey', () => {
    const a = arena({ p0: [['smite.stasis'], ['stab.stasis']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B1, 'weakness', { source: A1 });
    a.use(A1, 'smite.stasis', B1).use(A2, 'stab.stasis', B1).end(); // 2 Frost + 1 Weakness = 3 > 2: Prey
    expect([a.hp(B1), a.has(B1, 'suspended')]).toEqual([75, true]);
  });

  it('Frozen Quarry: without it, Frost debuffs don’t count toward Prey', () => {
    const a = arena({ p0: [['shot'], ['stab.stasis']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B1, 'weakness', { source: A1 });
    a.use(A2, 'stab.stasis', B1).end();
    expect(a.has(B1, 'suspended')).toBe(false);
  });

  it('Hymn of Stillness: all allies heal 15 and lose their Toxin, gaining 10 Shield per stack lost', () => {
    const a = arena({ p0: [['prayer.stasis'], ['shot']], p1: [['shot'], ['smash']] });
    a.setHp(A1, 50).setHp(A2, 50).give(A2, 'toxin', { stacks: 2, source: B1 });
    a.use(A1, 'prayer.stasis').end();
    expect([a.hp(A1), a.hp(A2), a.has(A2, 'toxin')]).toEqual([65, 65, false]);
    a.use(B1, 'shot', A1).use(B2, 'smash', A2).end(); // A1: no Shield (shot + smash splash); A2: 20 Shield
    expect([a.hp(A1), a.hp(A2)]).toEqual([35, 60]);
  });

  it('Frozen Lash: 25 to the target, 10 to another enemy who gains the target’s Toxin (max 3) and is Suspended', () => {
    const a = arena({ p0: [['cleave.stasis']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 5 });
    a.use(A1, 'cleave.stasis', B1).end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B2, 'toxin'), a.has(B2, 'suspended'), a.has(B1, 'suspended')]).toEqual([75, 90, 3, true, false]);
    expect(a.stacks(B1, 'toxin')).toBe(5);
  });

  it('Frozen Lash: a target without Toxin passes none on', () => {
    const a = arena({ p0: [['cleave.stasis']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.stasis', B1).end();
    expect([a.has(B2, 'toxin'), a.has(B2, 'suspended')]).toEqual([false, true]);
  });

  it('Crack the Ice: every Suspended enemy Thaws now', () => {
    const a = arena({ p0: [['shout.stasis']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).give(B1, 'suspended', { source: A1, duration: 6 });
    a.use(A1, 'shout.stasis').end();
    expect([a.hp(B1), a.has(B1, 'suspended'), a.has(B2, 'toxin')]).toEqual([80, false, false]);
  });

  it('Crack the Ice: if none were Suspended, all enemies gain 1 Toxin instead', () => {
    const a = arena({ p0: [['shout.stasis']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.stasis').end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([1, 1]);
  });

  it('Hold the Moment: 10 Shield for 1 turn; at the start of the next turn, heals all HP lost since', () => {
    const a = arena({ p0: [['withstand.stasis']], p1: [['smash']] });
    a.use(A1, 'withstand.stasis').end();
    a.use(B1, 'smash', A1).end(); // 25 − 10 Shield = 15 lost, healed back
    expect(a.hp(A1)).toBe(100);
  });

  it('Hold the Moment: healing is capped at 40', () => {
    const a = arena({ p0: [['withstand.stasis']], p1: [['smash'], ['smash'], ['smash']] });
    a.use(A1, 'withstand.stasis').end();
    a.use(B1, 'smash', A1).use(B2, 'smash', A1).use(B3, 'smash', A1).end(); // 75 − 10 = 65 lost
    expect(a.hp(A1)).toBe(75);
  });

  it('Glacial Glare: Taunted for 2 turns; meanwhile Frostbitten stops all their Strategic skills', () => {
    const a = arena({ p0: [['taunt.stasis']], p1: [['heal', 'shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).use(A1, 'taunt.stasis', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect(a.reject(() => a.use(B1, 'heal', B1))).toBe('cannot_act');
    a.use(B1, 'shot', A1).end(); // non-Strategic still fine
  });

  it('Glacial Glare: without Frostbitten, Helpful Strategic skills still work', () => {
    const a = arena({ p0: [['taunt.stasis']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'taunt.stasis', B1).end().use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Frozen Instant: Immune for 3 turns; damage taken is held instead of landing', () => {
    const a = arena({ p0: [['titan.stasis']], p1: [['strike', 'curse']] });
    a.use(A1, 'titan.stasis').end();
    expect(a.has(A1, 'immune')).toBe(true);
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Frozen Instant: each held hit lands 3 turns later, halved, as Affliction', () => {
    const a = arena({ p0: [['titan.stasis']], p1: [['strike']] });
    a.use(A1, 'titan.stasis').end();
    a.use(B1, 'strike', A1).end(); // 20 held (turn 2)
    a.give(A1, 'shield', { value: 50 });
    a.pass(4);
    expect(a.hp(A1)).toBe(100);
    a.pass(2);
    expect(a.hp(A1)).toBe(90);
  });
});

describe('Stasis costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    'strike.stasis': ['W', 0],
    'smash.stasis': ['Sr', 2],
    'charge.stasis': ['S', 1],
    'riposte.stasis': ['I', 2],
    'rage.stasis': ['S', 4],
    'shot.stasis': ['r', 1],
    'snipe.stasis': ['AIr', 2],
    'trap.stasis': ['W', 2],
    'maneuver.stasis': ['I', 3],
    'companion.stasis': ['I', 1],
    'bolt.stasis': ['I', 1],
    'blast.stasis': ['Wr', 2],
    'consume.stasis': ['I', 2],
    'summon.stasis': ['I', 2],
    'channel.stasis': ['Irr', 5],
    'stab.stasis': ['r', 0],
    'ravage.stasis': ['Ar', 1],
    'mislead.stasis': ['W', 2],
    'stun.stasis': ['A', 3],
    'dance.stasis': ['AI', 4],
    'heal.stasis': ['W', 1],
    'bless.stasis': ['W', 2],
    'curse.stasis': ['r', 2],
    'smite.stasis': ['Wr', 1],
    'prayer.stasis': ['Ir', 2],
    'cleave.stasis': ['Sr', 1],
    'shout.stasis': ['r', 1],
    'withstand.stasis': ['r', 3],
    'taunt.stasis': ['r', 3],
    'titan.stasis': ['WI', 4],
    ice_spider_frost_web: ['r', 0],
    ice_spider_frozen_fang: ['r', 0],
    cryo_sprite_rime_sting: ['W', 0],
  };
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(Object.entries(table))('%s costs %j', (id, [cost, cd]) => {
    const s = content.skills[id];
    expect(s).toBeDefined();
    expect({ ...s!.cost }).toEqual(parse(cost));
    expect(s!.cooldown ?? 0).toBe(cd);
  });
});
