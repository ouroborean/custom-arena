// Spec-driven scenarios for the Night fusion (Ice + Shadow): Dusk, Midnight, Frozen Sleep, First Light,
// Dormant and all 30 skills, written from the in-game descriptions and docs/rules.md §21.27.
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

const asleep = (a: Arena, id: string) => a.has(id, 'frozen_sleep');
const dormant = (a: Arena, id: string) => a.effects(id).some((e) => ['dormant', 'dormant_enemy'].includes(e.defId) || e.inline?.countsAs?.includes('dormant'));
const dur = (a: Arena, id: string, key: string) => a.effects(id).find((e) => e.defId === key)?.duration ?? null;
const shieldOf = (a: Arena, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.id?.includes('shield')).reduce((n, e) => n + e.value, 0);

const cost = (s: string) => {
  const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
  return c;
};

/** The B-turn (2, 4, 6, …) on which a Dusk applied to B1 on turn 1 brings Midnight. */
const midnightTurn = (a: Arena, max = 30) => {
  while (a.state.turn < max) {
    a.end();
    if (asleep(a, B1)) return a.state.turn;
  }
  return null;
};

describe('Night keywords', () => {
  it('Dusk 4: four of the bearer’s turns pass in full, then Midnight puts them in Frozen Sleep', () => {
    const a = arena({ p0: [['shot.night']], p1: [['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end();
    expect(a.has(B1, 'dusk')).toBe(true);
    expect(midnightTurn(a)).toBe(10); // turns 2, 4, 6, 8 pass; Midnight on 10
  });

  // BUG: Dusk: "hidden" ("the enemy sees none") vs the Dusk is marked revealed as soon as it's applied, so the bearer's side sees it
  it.fails("Dusk is hidden from the bearer's side", () => {
    const a = arena({ p0: [['shot.night']], p1: [['shot']] });
    a.use(A1, 'shot.night', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.defId === 'dusk')).toBe(false);
    expect(viewFor(content, a.state, 0).effects.some((e) => e.bearer === B1 && e.defId === 'dusk')).toBe(true);
  });

  it('Dusk: applying it again deepens it by 1 instead, so Midnight comes a turn sooner', () => {
    const a = arena({ p0: [['shot.night', 'curse.night']], p1: [['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end().pass(1).use(A1, 'shot.night', B1).end();
    expect(a.effects(B1).filter((e) => e.defId === 'dusk')).toHaveLength(1);
    expect(midnightTurn(a)).toBe(8);
  });

  it('Frozen Sleep: at Midnight the bearer can’t act, and the Dusk is gone', () => {
    const a = arena({ p0: [['shot.night', 'shot']], p1: [['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end();
    expect(midnightTurn(a)).toBe(10);
    expect([a.reject(() => a.use(B1, 'shot', A1)), a.has(B1, 'dusk')]).toEqual(['cannot_act', false]);
  });

  // BUG: Frozen Sleep: "Midnight puts the bearer in Frozen Sleep for 1 turn" vs it starts on their turn and lasts through their next one too, so they lose 2 turns
  it.fails('Frozen Sleep: lasts 1 turn; they act again on their following turn', () => {
    const a = arena({ p0: [['shot.night', 'shot']], p1: [['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end();
    expect(midnightTurn(a)).toBe(10);
    a.end().end();
    expect(asleep(a, B1)).toBe(false);
    a.use(B1, 'shot', A1);
  });

  it('Frozen Sleep: damage while asleep doesn’t wake them', () => {
    const b = arena({ p0: [['shot']], p1: [['shot']] });
    b.give(B1, 'frozen_sleep', { duration: 4 }).use(A1, 'shot', B1).end();
    expect([b.hp(B1), asleep(b, B1)]).toEqual([85, true]);
    expect(b.reject(() => b.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  // SPEC: Frozen Sleep "counts as Frostbitten, Chilled and Numb", but skills that count Frost debuffs (Rimecut: +5 each) don't see it. Should they?
  it.fails('Frozen Sleep: counts as Frost debuffs for skills that count them', () => {
    const a = arena({ p0: [['stab.myth']], p1: [['shot']] });
    a.give(B1, 'frozen_sleep', { duration: 4 }).use(A1, 'stab.myth', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('First Light: after Frozen Sleep, the bearer can’t gain Dusk for 2 turns', () => {
    const a = arena({ p0: [['shot.night']], p1: [['shot']], hp: 300 });
    a.use(A1, 'shot.night', B1).end();
    expect(midnightTurn(a)).toBe(10);
    while (asleep(a, B1)) a.end();
    if (a.active === 1) a.end();
    expect(a.has(B1, 'first_light')).toBe(true);
    a.use(A1, 'shot.night', B1).end();
    expect(a.has(B1, 'dusk')).toBe(false);
    a.pass(5).use(A1, 'shot.night', B1).end();
    expect(a.has(B1, 'first_light')).toBe(false);
    expect(a.has(B1, 'dusk')).toBe(true);
  });

  it('Dormant: can’t use skills or be targeted by enemies; 10 Shield at the end of each of their turns; wakes with 1 Focus', () => {
    const a = arena({ p0: [['maneuver.night', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.night').end();
    expect(dormant(a, A1)).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    a.end();
    expect(shieldOf(a, A1)).toBeGreaterThanOrEqual(10);
    a.pass(2);
    expect([dormant(a, A1), a.stacks(A1, 'focus')]).toEqual([false, 1]);
  });

  it('Dormant: ticking damage still lands', () => {
    const a = arena({ p0: [['maneuver.night']], p1: [['shot']] });
    a.give(A1, 'ignite', { source: B1, stacks: 2 }).use(A1, 'maneuver.night').end().end();
    expect([dormant(a, A1), a.hp(A1)]).toEqual([true, 90]);
  });
});

describe('Night skills', () => {
  it('Gloaming Blow: 20 and their Dusk deepens by 1', () => {
    const a = arena({ p0: [['shot.night', 'strike.night']], p1: [['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end().pass(1).use(A1, 'strike.night', B1).end();
    expect(a.hp(B1)).toBe(170);
    expect(midnightTurn(a)).toBe(8);
  });

  it('Gloaming Blow: no Dusk to deepen, none is added', () => {
    const a = arena({ p0: [['strike.night']], p1: [['shot']] });
    a.use(A1, 'strike.night', B1).end();
    expect([a.hp(B1), a.has(B1, 'dusk')]).toEqual([80, false]);
  });

  it('Gloaming Blow: 15 more against Frozen Sleep', () => {
    const a = arena({ p0: [['strike.night']], p1: [['shot']] });
    a.give(B1, 'frozen_sleep', { duration: 4 }).use(A1, 'strike.night', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it("Moonfall: 25 and 15 to their allies; Frostborn for 1 turn +1 per enemy hit without Buffs", () => {
    const a = arena({ p0: [['smash.night']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B3, 'might').use(A1, 'smash.night', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 85, 85]);
    expect(dur(a, A1, 'frostborn')).toBe(2 * 3 - 1);
  });

  it('Moonfall: every enemy Buffed, Frostborn for just 1 turn', () => {
    const a = arena({ p0: [['smash.night']], p1: [['shot']] });
    a.give(B1, 'might').use(A1, 'smash.night', B1).end();
    expect(dur(a, A1, 'frostborn')).toBe(1);
  });

  it('Silent Descent: 15 and Dusk 3; Stealthy: keeps Stealth and gives 1 Focus if Stealthed', () => {
    const a = arena({ p0: [['charge.night'], ['charge.night']], p1: [['shot'], ['shot']], hp: 200 });
    a.give(A1, 'stealth', { duration: 3 }).use(A1, 'charge.night', B1).use(A2, 'charge.night', B2).end();
    expect([a.hp(B1), a.has(B1, 'dusk'), a.has(A1, 'stealth'), a.stacks(A1, 'focus'), a.stacks(A2, 'focus')]).toEqual([185, true, true, 1, 0]);
    expect(midnightTurn(a)).toBe(8); // Dusk 3: turns 2, 4, 6 pass
  });

  it('Snowdrift Shelter: Invisible; counters the first Harmful skill and makes the lowest-HP ally Dormant for 1 turn', () => {
    const a = arena({ p0: [['riposte.night'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A3, 40).use(A1, 'riposte.night').end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === A1)).toEqual([]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), dormant(a, A3), dormant(a, A2)]).toEqual([85, true, false]);
  });

  it('Snowdrift Shelter: no counter, no Dormant', () => {
    const a = arena({ p0: [['riposte.night'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).use(A1, 'riposte.night').end().end();
    expect(dormant(a, A2)).toBe(false);
  });

  it('Polar Night: 1 Might and Immune for 3 turns; skills don’t end Stealth meanwhile', () => {
    const a = arena({ p0: [['rage.night', 'shot']], p1: [['curse']] });
    a.use(A1, 'rage.night').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([1, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([80, true]);
    a.pass(3);
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('Evening Star: 10 and Dusk 4', () => {
    const a = arena({ p0: [['shot.night']], p1: [['shot']] });
    a.use(A1, 'shot.night', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'dusk')]).toEqual([90, 4]);
  });

  it('Last Light: 40 on the following turn', () => {
    const a = arena({ p0: [['snipe.night']], p1: [['shot']] });
    a.use(A1, 'snipe.night', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Last Light: 70 Piercing against Frozen Sleep', () => {
    const a = arena({ p0: [['snipe.night']], p1: [['shot']] });
    a.give(B1, 'frozen_sleep', { duration: 6 }).give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.night', B1).end().end();
    expect(a.hp(B1)).toBe(30);
  });

  it('Breaking Ice: Invisible; the first enemy to use a Harmful skill on the ally takes 20 Piercing and is Stunned', () => {
    const a = arena({ p0: [['trap.night'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.night', A2).end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === A2)).toEqual([]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'stun'), a.has(B1, 'stun')]).toEqual([100, 80, true, false]);
    a.pass(1);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'shot', A2).end();
    expect(a.hp(B1)).toBe(100); // only the first
  });

  it('Breaking Ice: lasts 3 turns', () => {
    const a = arena({ p0: [['trap.night'], ['shot']], p1: [['shot']] });
    a.use(A1, 'trap.night', A2).end().pass(6).use(B1, 'shot', A2).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Hibernate: Dormant for 2 turns', () => {
    const a = arena({ p0: [['maneuver.night', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.night').end();
    a.pass(2);
    expect(dormant(a, A1)).toBe(true);
    a.pass(1);
    expect(dormant(a, A1)).toBe(false);
  });

  it('Snow Owl: 25 HP, permanent; each turn a random enemy without Dusk gains Dusk 4', () => {
    const a = arena({ p0: [['companion.night']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.night').end();
    const owl = minions(a, 0, 'snow_owl')[0]!;
    expect(owl.hp).toBe(25);
    expect([B1, B2].filter((u) => a.has(u, 'dusk')).map((u) => a.stacks(u, 'dusk'))).toEqual([4]);
    a.pass(2);
    expect([B1, B2].filter((u) => a.has(u, 'dusk'))).toHaveLength(2);
  });

  it('Snow Owl: an enemy that already has Dusk is skipped', () => {
    const a = arena({ p0: [['companion.night', 'shot.night']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end().pass(1).use(A1, 'companion.night').end();
    expect([a.stacks(B1, 'dusk') <= 4, a.stacks(B2, 'dusk')]).toEqual([true, 4]);
  });

  it('Snow Owl: Silent Talons deals 15, or 30 against Frozen Sleep', () => {
    const a = arena({ p0: [['companion.night']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.night').end().pass(1);
    const owl = minions(a, 0, 'snow_owl')[0]!;
    a.give(B2, 'frozen_sleep', { duration: 6 }).use(owl.id, 'snow_owl_silent_talons', B1).end().pass(1);
    a.use(owl.id, 'snow_owl_silent_talons', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 70]);
  });

  it('Rime Lance: 20 and Mark for 1 turn; whoever spends the Mark leaves them Frostbitten for 2 turns', () => {
    const a = arena({ p0: [['bolt.night'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.night', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.has(B1, 'frostbitten')]).toEqual([55, false, true]);
    a.pass(3);
    expect(a.has(B1, 'frostbitten')).toBe(false);
  });

  it('Rime Lance: an unspent Mark leaves no Frostbite', () => {
    const a = arena({ p0: [['bolt.night']], p1: [['shot']] });
    a.use(A1, 'bolt.night', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.has(B1, 'frostbitten')]).toEqual([80, true, false]);
    a.pass(2);
    expect([a.has(B1, 'mark'), a.has(B1, 'frostbitten')]).toEqual([false, false]);
  });

  it('Eventide: 20 to all enemies; each gains Dusk 3 or has it deepened', () => {
    const a = arena({ p0: [['blast.night', 'shot.night']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end().pass(1).use(A1, 'blast.night').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B2, 'dusk')]).toEqual([170, 180, 3]);
    expect(a.effects(B1).filter((e) => e.defId === 'dusk')).toHaveLength(1);
    expect(midnightTurn(a)).toBe(8);
  });

  it('Stolen Hours: 5 and heals for it; Debuffs on the user’s side lose time, the target’s gain time', () => {
    const a = arena({ p0: [['consume.night'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).give(A2, 'confusion', { duration: 6, source: B1 }).give(B1, 'confusion', { duration: 6, source: A1 });
    a.use(A1, 'consume.night', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 55]);
    expect(dur(a, A2, 'confusion')!).toBeLessThan(6 - 1);
    expect(dur(a, B1, 'confusion')!).toBeGreaterThan(6 - 1);
  });

  it("Call the Revenant: 20 HP for 3 turns; each user turn it hits the last enemy who damaged the user for 15", () => {
    const a = arena({ p0: [['summon.night']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'summon.night').end();
    expect(minions(a, 0, 'rime_revenant').map((m) => m.hp)).toEqual([20]);
    expect(300 - a.hp(B1) - a.hp(B2) - a.hp(B3)).toBe(15); // nobody yet: a random enemy
    const before = [a.hp(B1), a.hp(B2), a.hp(B3)];
    a.use(B2, 'shot', A1).end().end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([before[0], before[1]! - 15, before[2]]);
  });

  it('Call the Revenant: gone after 3 turns', () => {
    const a = arena({ p0: [['summon.night']], p1: [['shot']] });
    a.use(A1, 'summon.night').end().pass(5);
    expect(minions(a, 0, 'rime_revenant')).toHaveLength(0);
  });

  it('Winter Solstice: Dormant for 2 turns, and 10 to all enemies at the end of each of the user’s turns', () => {
    const a = arena({ p0: [['channel.night']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.night').end();
    expect([dormant(a, A1), a.hp(B1), a.hp(B2)]).toEqual([true, 90, 90]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
    a.pass(4);
    expect([a.hp(B1), dormant(a, A1)]).toEqual([80, false]);
  });

  it('Rime Stiletto: 10, or 25 against an Asleep target without waking them', () => {
    const a = arena({ p0: [['stab.night'], ['stab.night'], ['stab.night']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'sleep', { duration: 4, source: A1 }).give(B3, 'frozen_sleep', { duration: 4 });
    a.use(A1, 'stab.night', B1).use(A2, 'stab.night', B2).use(A3, 'stab.night', B3).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 75, 75]);
    expect([a.has(B2, 'sleep'), asleep(a, B3)]).toEqual([true, true]);
  });

  it('Blackfrost Fang: 25 Piercing; a Blindness ends and becomes Frostbitten and Numb for 2 turns', () => {
    const a = arena({ p0: [['ravage.night'], ['ravage.night']], p1: [['shot'], ['shot']] });
    a.give(B1, 'blinded', { duration: 4, source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.night', B1).use(A2, 'ravage.night', B2).end();
    expect([a.hp(B1), a.has(B1, 'blinded'), a.has(B1, 'frostbitten'), a.has(B1, 'numb')]).toEqual([75, false, true, true]);
    expect([a.has(B2, 'frostbitten'), a.has(B2, 'numb')]).toEqual([false, false]);
    a.pass(3);
    expect(a.has(B1, 'numb')).toBe(false);
  });

  it('False Dawn: Invisible; counters a Harmful skill, and if they have Dusk, Midnight strikes now', () => {
    const a = arena({ p0: [['mislead.night', 'shot.night']], p1: [['shot']], hp: 200 });
    a.use(A1, 'shot.night', B1).end().pass(1).use(A1, 'mislead.night', B1).end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === B1 && e.defId !== 'dusk')).toEqual([]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), asleep(a, B1), a.has(B1, 'dusk')]).toEqual([200, true, false]);
  });

  it('False Dawn: without Dusk, just the counter', () => {
    const a = arena({ p0: [['mislead.night']], p1: [['shot']] });
    a.use(A1, 'mislead.night', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), asleep(a, B1)]).toEqual([100, false]);
  });

  it("Lulled Under Snow: 15, and Dormant for 1 turn: can't act, and the user's side can't reach them", () => {
    const a = arena({ p0: [['stun.night', 'shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.night', B1).use(A2, 'shot', B1).end(); // A2's shot finds no target
    expect([a.hp(B1), dormant(a, B1)]).toEqual([85, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect(dormant(a, B1)).toBe(false);
  });

  it('Lulled Under Snow: the enemy version gives no Shield and no Focus', () => {
    const a = arena({ p0: [['stun.night']], p1: [['shot']] });
    a.use(A1, 'stun.night', B1).end().pass(3);
    expect([shieldOf(a, B1), a.stacks(B1, 'focus')]).toEqual([0, 0]);
  });

  it('Drowsing Waltz: 1 Might and 2 Swiftness for 4 turns', () => {
    const a = arena({ p0: [['dance.night']], p1: [['shot']] });
    a.use(A1, 'dance.night').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([1, 2]);
    a.pass(6);
    expect(a.stacks(A1, 'might')).toBe(1);
    a.pass(1);
    expect(a.stacks(A1, 'might')).toBe(0);
  });

  it('Drowsing Waltz: the first hit that would leave them below 30 stops at 30, and they become Dormant for 1 turn', () => {
    const a = arena({ p0: [['dance.night'], ['shot']], p1: [['ravage'], ['ravage']] });
    a.setHp(A1, 40).use(A1, 'dance.night').end();
    a.use(B1, 'ravage', A1).end();
    expect([a.hp(A1), dormant(a, A1)]).toEqual([30, true]);
    a.pass(1);
    expect(a.reject(() => a.use(B2, 'ravage', A1))).toBe('bad_target');
  });

  it('Drowsing Waltz: only the first such hit is stopped', () => {
    const a = arena({ p0: [['dance.night'], ['shot']], p1: [['ravage'], ['ravage']] });
    a.setHp(A1, 40).use(A1, 'dance.night').end();
    a.use(B1, 'ravage', A1).end().pass(3);
    a.use(B2, 'ravage', A1).end();
    expect(a.hp(A1)).toBeLessThan(30);
  });

  it('Winter Rest: target ally heals 15 and becomes Dormant for 1 turn', () => {
    const a = arena({ p0: [['heal.night'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 20).use(A1, 'heal.night', A2).end();
    expect([a.hp(A2), dormant(a, A2)]).toEqual([35, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(2);
    expect(dormant(a, A2)).toBe(false);
  });

  it('Promise of Dawn: nothing yet; 2 turns later the ally gains 2 Might, 2 Swiftness and 3 Renew for 3 turns', () => {
    const a = arena({ p0: [['bless.night'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.night', A2).end();
    expect(['might', 'swiftness', 'renew'].map((k) => a.stacks(A2, k))).toEqual([0, 0, 0]);
    a.pass(3);
    expect(['might', 'swiftness', 'renew'].map((k) => a.stacks(A2, k))).toEqual([2, 2, 3]);
  });

  it('Starless Sky: Dusk 4; for 2 turns, each skill they use deepens it by 1 more', () => {
    const a = arena({ p0: [['curse.night']], p1: [['shot']], hp: 300 });
    a.use(A1, 'curse.night', B1).end();
    a.use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect(midnightTurn(a)).toBe(6); // Dusk 4, deepened twice
  });

  it('Starless Sky: on a bearer with Dusk, it deepens by 1', () => {
    const a = arena({ p0: [['curse.night', 'shot.night']], p1: [['shot']], hp: 300 });
    a.use(A1, 'shot.night', B1).end().pass(1).use(A1, 'curse.night', B1).end();
    expect(midnightTurn(a)).toBe(8);
  });

  it('Hidden Moon: 20 and Sanctified for 1 turn; Stealthy', () => {
    const a = arena({ p0: [['smite.night']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 3 }).use(A1, 'smite.night', B1).end();
    expect([a.hp(B1), a.has(B1, 'sanctify'), a.has(A1, 'stealth')]).toEqual([80, true, true]);
  });

  // BUG: Hidden Moon: "allies who damage them keep their Stealth" vs a Stealthed ally's hit on the target still ends their Stealth
  it.fails('Hidden Moon: allies who damage them keep their Stealth', () => {
    const a = arena({ p0: [['smite.night'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stealth', { duration: 6 }).use(A1, 'smite.night', B1).use(A2, 'shot', B1).end();
    expect(a.has(A2, 'stealth')).toBe(true);
    const b = arena({ p0: [['smite'], ['shot']], p1: [['shot']] });
    b.give(A2, 'stealth', { duration: 6 }).use(A1, 'smite', B1).use(A2, 'shot', B1).end();
    expect(b.has(A2, 'stealth')).toBe(false);
  });

  it('Hibernal Vigil: all allies heal 15 and become Dormant for 1 turn', () => {
    const a = arena({ p0: [['prayer.night'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.night').end();
    expect([a.hp(A1), a.hp(A2), dormant(a, A1), dormant(a, A2)]).toEqual([65, 65, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });

  it('Crescent Cleave: 25, and 15 to another enemy with Dusk', () => {
    const a = arena({ p0: [['cleave.night', 'shot.night']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'shot.night', B3).end().pass(1).use(A1, 'cleave.night', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 100, 75]);
  });

  it('Crescent Cleave: with no one else Dusked, a random other enemy', () => {
    const a = arena({ p0: [['cleave.night']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.night', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Hoarfrost Howl: Intimidated for 2 turns; Frost debuffs they gain meanwhile last 1 turn longer', () => {
    const a = arena({ p0: [['shout.night'], ['strike.ice']], p1: [['shot']] });
    a.use(A1, 'shout.night').use(A2, 'strike.ice', B1).end();
    expect(a.has(B1, 'intimidated')).toBe(true);
    const control = arena({ p0: [['shot'], ['strike.ice']], p1: [['shot']] });
    control.use(A2, 'strike.ice', B1).end();
    expect(dur(a, B1, 'frostbitten')).toBe(dur(control, B1, 'frostbitten')! + 2);
  });

  // BUG: Frostfall Cloak: "If an enemy breaks it, the user gains Stealth for 1 turn per Frost debuff that enemy has" vs no Stealth when a Chilled, Numb (or Frostbitten) enemy breaks it
  it.fails('Frostfall Cloak: 20 Shield for 1 turn; an enemy breaking it gives Stealth 1 turn per Frost debuff they have', () => {
    const a = arena({ p0: [['withstand.night']], p1: [['smash']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 });
    a.use(A1, 'withstand.night').end();
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.has(A1, 'stealth')]).toEqual([95, true]);
    expect(dur(a, A1, 'stealth')).toBe(2 * 2);
  });

  it('Frostfall Cloak: an enemy with no Frost debuffs gives no Stealth', () => {
    const a = arena({ p0: [['withstand.night']], p1: [['smash']] });
    a.use(A1, 'withstand.night').end();
    a.use(B1, 'smash', A1).end();
    expect(a.has(A1, 'stealth')).toBe(false);
  });

  it('Feigned Sleep: Taunted for 2 turns and the user goes Dormant out of reach', () => {
    const a = arena({ p0: [['taunt.night'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.night', B1).end();
    expect([a.has(B1, 'taunt'), dormant(a, A1)]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B2, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  // BUG: Feigned Sleep: "the Taunted enemy has no one they may target" vs while the taunter is Dormant, the Taunted enemy can target the user's allies
  it.fails('Feigned Sleep: while the user sleeps, the Taunted enemy has no one they may target', () => {
    const a = arena({ p0: [['taunt.night'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.night', B1).end();
    expect([a.has(B1, 'taunt'), dormant(a, A1)]).toEqual([true, true]);
    a.reject(() => a.use(B1, 'shot', A1)); // the user is out of reach
    a.reject(() => a.use(B1, 'shot', A2)); // and the Taunt forbids anyone else
    a.use(B2, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Sleeping Giant: Dormant for 2 turns with 20 Shield per turn; when they wake, every enemy gains Dusk 2', () => {
    const a = arena({ p0: [['titan.night']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.night').end();
    expect(dormant(a, A1)).toBe(true);
    expect(shieldOf(a, A1)).toBe(20);
    a.pass(4);
    expect(dormant(a, A1)).toBe(false);
    expect([a.stacks(B1, 'dusk'), a.stacks(B2, 'dusk')]).toEqual([2, 2]);
  });
});

describe('Night costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Sr', 2], charge: ['A', 2], riposte: ['r', 3], rage: ['SI', 4],
    shot: ['r', 0], snipe: ['Arr', 2], trap: ['AI', 3], maneuver: ['r', 4], companion: ['I', 1],
    bolt: ['Ir', 1], blast: ['AIr', 3], consume: ['r', 2], summon: ['I', 1], channel: ['Ir', 3],
    stab: ['r', 1], ravage: ['Ar', 1], mislead: ['I', 2], stun: ['A', 2], dance: ['AA', 4],
    heal: ['W', 2], bless: ['r', 2], curse: ['Ar', 2], smite: ['Wr', 1], prayer: ['Irr', 4],
    cleave: ['Sr', 1], shout: ['A', 3], withstand: ['r', 3], taunt: ['r', 3], titan: ['IW', 4],
  };
  for (const [arch, [c, cd]] of Object.entries(table)) {
    it(`${arch}.night: ${c} · ${cd}`, () => {
      const s = content.skills[`${arch}.night`]!;
      expect([s.cost, s.cooldown]).toEqual([cost(c), cd]);
    });
  }
  it('Snow Owl: Silent Talons (A)', () => {
    expect(content.skills.snow_owl_silent_talons!.cost).toEqual(cost('A'));
  });
});
