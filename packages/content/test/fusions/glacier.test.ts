// Spec-driven tests for the Glacier fusion (Ice + Water): Icebound, Meltwater and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.20, and the "Glacier — Ice + Water" kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Durations: "for N turns" applied on the applier's own turn is 2N internal ticks (rules §8.1);
// applied on the opponent's turn it's 2N + 1. Cooldowns: using a cd-n skill sets n + 1, and it
// drops by 1 at the end of each of its owner's turns (rules §5.2).

import { describe, expect, it } from 'vitest';
import { viewFor, type GameEvent } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

/** Internal duration of the first effect with this key on the unit (null = permanent / absent). */
function dur(a: Arena, id: string, key: string): number | null | undefined {
  return a.effects(id).find((e) => (e.inline ? e.inline.id : e.defId) === key)?.duration;
}

/** Stacks of `defId` applied to `bearer` by the most recent command. */
function gained(a: Arena, bearer: string, defId: string): number {
  return a.last
    .filter((e): e is Extract<GameEvent, { t: 'effectApplied' }> => e.t === 'effectApplied' && e.bearer === bearer && e.defId === defId)
    .reduce((n, e) => n + e.stacks, 0);
}

/** The internal duration given by the most recent application of `defId` to `bearer`. */
function appliedDur(a: Arena, bearer: string, defId: string): number | null | undefined {
  const evs = a.last.filter((e): e is Extract<GameEvent, { t: 'effectApplied' }> => e.t === 'effectApplied' && e.bearer === bearer && e.defId === defId);
  return evs[evs.length - 1]?.duration;
}

function setCd(a: Arena, id: string, skillId: string, n: number): void {
  const s = a.unit(id).skills.find((x) => x.defId === skillId);
  if (!s) throw new Error(`${id} has no ${skillId}`);
  s.cooldown = n;
}

function minion(a: Arena, defId: string) {
  return a.state.units.find((u) => u.defId === defId && u.alive);
}

describe('Glacier keywords', () => {
  it('Icebound: the bearer’s cooldowns don’t tick down while it lasts; other units’ still do', () => {
    const a = arena({ p0: [['shot']], p1: [['smash'], ['smash']] });
    a.pass(1).use(B1, 'smash', A1).use(B2, 'smash', A1).end(); // turn 2: both at 2
    expect([a.cooldown(B1, 'smash'), a.cooldown(B2, 'smash')]).toEqual([2, 2]);
    a.give(B1, 'icebound', { source: A1, duration: 2 }).end(); // covers B's next turn
    a.end(); // turn 4 (B)
    expect([a.cooldown(B1, 'smash'), a.cooldown(B2, 'smash')]).toEqual([2, 1]);
    expect(a.has(B1, 'icebound')).toBe(false);
    a.pass(2); // Icebound gone: B1's cooldown ticks again
    expect(a.cooldown(B1, 'smash')).toBe(1);
  });

  it('Meltwater: the bearer’s cooldowns tick down 1 extra at the end of each of their turns (not the enemy’s)', () => {
    const a = arena({ p0: [['smash'], ['smash']], p1: [['shot']] });
    a.give(A1, 'meltwater');
    a.use(A1, 'smash', B1).use(A2, 'smash', B1).end();
    expect([a.cooldown(A1, 'smash'), a.cooldown(A2, 'smash')]).toEqual([1, 2]);
    a.end(); // enemy turn: no extra tick
    expect(a.cooldown(A1, 'smash')).toBe(1);
    a.end();
    expect([a.cooldown(A1, 'smash'), a.cooldown(A2, 'smash')]).toEqual([0, 1]);
  });

  it('Icebound is a Debuff (Immune blocks it) and Meltwater is a Buff', () => {
    expect(content.statuses.icebound?.kind).toBe('Debuff');
    expect(content.statuses.meltwater?.kind).toBe('Buff');
    const a = arena({ p0: [['strike.glacier']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'strike.glacier', B1).end();
    expect(a.has(B1, 'icebound')).toBe(false);
  });
});

describe('Glacier skills', () => {
  it('Glacial Fist: 25 damage and Icebound for 1 turn (through the enemy’s turn)', () => {
    const a = arena({ p0: [['strike.glacier']], p1: [['shot']] });
    a.use(A1, 'strike.glacier', B1).end();
    expect([a.hp(B1), a.has(B1, 'icebound'), a.has(A1, 'meltwater')]).toEqual([75, true, false]);
    a.end();
    expect(a.has(B1, 'icebound')).toBe(false);
  });

  it('Glacial Fist: against an Icebound target, the user gains Meltwater for 1 turn instead (no refresh)', () => {
    const a = arena({ p0: [['strike.glacier']], p1: [['shot']] });
    a.give(B1, 'icebound', { source: A1, duration: 5 });
    a.use(A1, 'strike.glacier', B1).end();
    expect([a.hp(B1), a.has(A1, 'meltwater')]).toEqual([75, true]);
    expect(appliedDur(a, A1, 'meltwater')).toBe(2);
    expect(dur(a, B1, 'icebound')).toBe(4); // only the turn's countdown, not refreshed
    expect(gained(a, B1, 'icebound')).toBe(0);
  });

  it('Spring Breakup: 20 to the target and 10 to their allies without Renew', () => {
    const a = arena({ p0: [['smash.glacier']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.glacier', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it('Spring Breakup: spends all the user’s Renew, +5 to every hit per stack', () => {
    const a = arena({ p0: [['smash.glacier'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'renew', { stacks: 2, source: B1 }).give(A2, 'renew', { stacks: 3, source: B1 });
    a.use(A1, 'smash.glacier', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]);
    expect(a.stacks(A1, 'renew')).toBe(0);
    expect(a.stacks(A2, 'renew')).toBe(3); // only the user's Renew
  });

  it('Meltwater Rush: 15 damage; a Chilled target loses the Chill and the user gains Meltwater for 2 turns', () => {
    const a = arena({ p0: [['charge.glacier']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1 }).use(A1, 'charge.glacier', B1).end();
    expect([a.hp(B1), a.has(B1, 'chilled'), a.has(A1, 'meltwater')]).toEqual([85, false, true]);
    expect(appliedDur(a, A1, 'meltwater')).toBe(4);
  });

  it('Meltwater Rush: no Meltwater against a target that isn’t Chilled', () => {
    const a = arena({ p0: [['charge.glacier']], p1: [['shot']] });
    a.use(A1, 'charge.glacier', B1).end();
    expect([a.hp(B1), a.has(A1, 'meltwater')]).toEqual([85, false]);
  });

  it('Pressure Ridge: Invisible; counters only the first Harmful skill used on the user', () => {
    const a = arena({ p0: [['riposte.glacier']], p1: [['smash'], ['shot']] });
    a.use(A1, 'riposte.glacier').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // smash countered; only the first, so the shot lands
  });

  it('Pressure Ridge: the user gains Meltwater for 1 turn per turn of the countered skill’s cooldown', () => {
    const a = arena({ p0: [['riposte.glacier']], p1: [['smash']] });
    a.use(A1, 'riposte.glacier').end().use(B1, 'smash', A1).end();
    expect(a.has(A1, 'meltwater')).toBe(true);
    expect(appliedDur(a, A1, 'meltwater')).toBe(5); // 2 turns, applied on the enemy's turn
  });

  it('Pressure Ridge: Meltwater is capped at 3 turns', () => {
    const b = arena({ p0: [['riposte.glacier']], p1: [['trap.glacier']] });
    b.use(A1, 'riposte.glacier').end().use(B1, 'trap.glacier', A1).end();
    expect(appliedDur(b, A1, 'meltwater')).toBe(7); // 3 turns
  });

  it('Pressure Ridge: a countered cd-0 skill gives no Meltwater', () => {
    const a = arena({ p0: [['riposte.glacier']], p1: [['shot']] });
    a.use(A1, 'riposte.glacier').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'meltwater')]).toEqual([100, false]);
  });

  it('Pressure Ridge: doesn’t counter Helpful skills, and expires after 1 turn', () => {
    const a = arena({ p0: [['riposte.glacier']], p1: [['shot']] });
    a.use(A1, 'riposte.glacier').end().end().end(); // through B's turn
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Spring Thaw: Immune and Meltwater for 3 turns; Meltwater freeing a skill gives 1 Might until it ends', () => {
    const a = arena({ p0: [['rage.glacier', 'smash']], p1: [['curse']] });
    a.use(A1, 'smash', B1).end().end(); // smash at 2
    a.use(A1, 'rage.glacier').end(); // end of turn: smash 2 → 0 with Meltwater
    expect([a.has(A1, 'immune'), a.has(A1, 'meltwater'), a.cooldown(A1, 'smash')]).toEqual([true, true, 0]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false); // Immune
    expect(a.stacks(A1, 'might')).toBe(1);
    a.pass(4);
    expect([a.has(A1, 'immune'), a.has(A1, 'meltwater'), a.has(A1, 'might')]).toEqual([false, false, false]);
  });

  it('Spring Thaw: no Might when Meltwater frees nothing', () => {
    const a = arena({ p0: [['rage.glacier']], p1: [['shot']] });
    a.use(A1, 'rage.glacier').end().end();
    expect(a.has(A1, 'might')).toBe(false);
  });

  it('Borrowed Hour: 15 damage; the target’s and the user’s other longest cooldowns swap', () => {
    const a = arena({ p0: [['shot.glacier', 'smash', 'rage']], p1: [['shot', 'smash', 'blast']] });
    setCd(a, A1, 'smash', 4);
    setCd(a, A1, 'rage', 2);
    setCd(a, B1, 'smash', 1);
    setCd(a, B1, 'blast', 3);
    a.use(A1, 'shot.glacier', B1).end();
    expect(a.hp(B1)).toBe(85);
    // B1's blast (3) ↔ A1's smash (4); then A1's own end-of-turn tick
    expect([a.cooldown(B1, 'blast'), a.cooldown(B1, 'smash'), a.cooldown(B1, 'shot')]).toEqual([4, 1, 0]);
    expect([a.cooldown(A1, 'smash'), a.cooldown(A1, 'rage'), a.cooldown(A1, 'shot.glacier')]).toEqual([2, 1, 2]);
  });

  it('Serac Spear: 50 Piercing on the following turn', () => {
    const a = arena({ p0: [['snipe.glacier']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.glacier', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(50);
  });

  it('Serac Spear: against an Icebound target it lands at once and ends their Icebound', () => {
    const a = arena({ p0: [['snipe.glacier']], p1: [['shot']] });
    a.give(B1, 'icebound', { source: A1, duration: 6 }).use(A1, 'snipe.glacier', B1).end();
    expect([a.hp(B1), a.has(B1, 'icebound')]).toEqual([50, false]);
    a.end();
    expect(a.hp(B1)).toBe(50); // doesn't hit again
  });

  it('Serac Spear: the target is hidden from the opponent', () => {
    const a = arena({ p0: [['snipe.glacier']], p1: [['shot']] });
    a.use(A1, 'snipe.glacier', B1).end();
    expect(content.skills['snipe.glacier']?.tags).toEqual(expect.arrayContaining(['HiddenTarget', 'Channeled']));
  });

  it('Crevasse: a Harmful skill from the target Icebinds them for 2 turns and raises their cooldowns by 1', () => {
    const a = arena({ p0: [['trap.glacier']], p1: [['smash']] });
    a.use(A1, 'trap.glacier', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false); // Invisible
    a.use(B1, 'smash', A1).end();
    expect(a.has(B1, 'icebound')).toBe(true);
    expect(appliedDur(a, B1, 'icebound')).toBe(5); // 2 turns, applied on their turn
    expect(a.cooldown(B1, 'smash')).toBe(4); // 3 on use, +1, and frozen this turn
    a.pass(2);
    expect(a.cooldown(B1, 'smash')).toBe(4); // still frozen
  });

  it('Crevasse: Helpful skills don’t set it off', () => {
    const a = arena({ p0: [['trap.glacier']], p1: [['heal']] });
    a.use(A1, 'trap.glacier', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.has(B1, 'icebound')).toBe(false);
  });

  it('Crevasse: lasts 2 turns', () => {
    const a = arena({ p0: [['trap.glacier']], p1: [['shot']] });
    a.use(A1, 'trap.glacier', B1).end().pass(4);
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'icebound')).toBe(false);
  });

  it('Under the Ice: the user is Invulnerable for 1 turn; only enemies with a skill on cooldown are Icebound', () => {
    const a = arena({ p0: [['maneuver.glacier']], p1: [['smash'], ['shot']] });
    a.pass(1).use(B1, 'smash', A1).end();
    a.use(A1, 'maneuver.glacier').end();
    expect([a.has(A1, 'invulnerable'), a.has(B1, 'icebound'), a.has(B2, 'icebound')]).toEqual([true, true, false]);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('bad_target');
    a.end().end();
    expect([a.has(A1, 'invulnerable'), a.has(B1, 'icebound')]).toEqual([false, false]);
  });

  it('Walrus Bull: a permanent 45 HP Walrus; Tusk deals 20', () => {
    const a = arena({ p0: [['companion.glacier']], p1: [['shot']] });
    a.use(A1, 'companion.glacier').end();
    const w = minion(a, 'walrus_bull');
    expect(w?.hp).toBe(45);
    expect(w?.owner).toBe(0);
    a.end().use(w!.id, 'walrus_tusk', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.pass(10);
    expect(minion(a, 'walrus_bull')).toBeDefined(); // permanent
  });

  it('Walrus Bull: Haul Out gives an ally Meltwater for 2 turns and Icebinds the Walrus for as long', () => {
    const a = arena({ p0: [['companion.glacier'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.glacier').end().end();
    const w = minion(a, 'walrus_bull')!;
    a.use(w.id, 'walrus_haul_out', A2).end();
    expect([a.has(A2, 'meltwater'), a.has(w.id, 'icebound')]).toEqual([true, true]);
    expect(dur(a, w.id, 'icebound')).toBe(dur(a, A2, 'meltwater'));
    expect(appliedDur(a, A2, 'meltwater')).toBe(4);
  });

  it('Glacial Erratic: 20 damage and a 2-turn Mark that breaks for 30 if it expires unspent', () => {
    const a = arena({ p0: [['bolt.glacier']], p1: [['shot']] });
    a.use(A1, 'bolt.glacier', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([80, true]);
    a.pass(2);
    expect(a.hp(B1)).toBe(80); // still waiting
    a.pass(1);
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([50, false]);
  });

  it('Glacial Erratic: a Mark spent by a direct hit doesn’t also break for 30', () => {
    const a = arena({ p0: [['bolt.glacier'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.glacier', B1).end().end();
    a.use(A2, 'shot', B1).end(); // 15 + 10 from the Mark
    expect(a.hp(B1)).toBe(55);
    a.pass(4);
    expect(a.hp(B1)).toBe(55);
  });

  it('Thawburst: 25 to all enemies; every Frost debuff is removed and gives a random ally 2 Renew', () => {
    const a = arena({ p0: [['blast.glacier'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B2, 'frostbitten', { source: A1 });
    a.give(B2, 'weakness', { source: A1 });
    a.use(A1, 'blast.glacier').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
    expect(['chilled', 'numb'].some((k) => a.has(B1, k)) || a.has(B2, 'frostbitten')).toBe(false);
    expect(a.has(B2, 'weakness')).toBe(true); // not a Frost debuff
    expect(gained(a, A1, 'renew') + gained(a, A2, 'renew')).toBe(6);
    expect(gained(a, B1, 'renew') + gained(a, B2, 'renew')).toBe(0);
  });

  it('Thawburst: no Frost debuffs, no Renew', () => {
    const a = arena({ p0: [['blast.glacier']], p1: [['shot']] });
    a.use(A1, 'blast.glacier').end();
    expect(gained(a, A1, 'renew')).toBe(0);
  });

  it('Stolen Thaw: 5 damage healing the user; an Icebound target loses it and the user gains 2 turns of Meltwater', () => {
    const a = arena({ p0: [['consume.glacier']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'icebound', { source: A1, duration: 6 });
    a.use(A1, 'consume.glacier', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'icebound'), a.has(A1, 'meltwater')]).toEqual([95, 55, false, true]);
    expect(appliedDur(a, A1, 'meltwater')).toBe(4);
  });

  it('Stolen Thaw: no Meltwater if the target isn’t Icebound', () => {
    const a = arena({ p0: [['consume.glacier']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.glacier', B1).end();
    expect([a.hp(A1), a.has(A1, 'meltwater')]).toEqual([55, false]);
  });

  it('Advancing Glacier: a 50 HP Ice Tongue idles 2 turns, then deals 30 Piercing each turn until it leaves after 4', () => {
    const a = arena({ p0: [['summon.glacier']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'summon.glacier').end();
    expect(minion(a, 'ice_tongue')?.hp).toBe(50);
    a.pass(2); // its second turn
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(40);
    a.pass(2);
    expect(minion(a, 'ice_tongue')).toBeUndefined();
    expect(a.hp(B1)).toBe(40);
  });

  it('Glacial Advance: 10 a turn for up to 3 turns, Icebinding the target; the user’s cooldowns are frozen meanwhile', () => {
    const a = arena({ p0: [['channel.glacier', 'smash']], p1: [['shot']] });
    setCd(a, A1, 'smash', 3);
    a.use(A1, 'channel.glacier', B1).end();
    expect([a.hp(B1), a.has(B1, 'icebound'), a.cooldown(A1, 'smash')]).toEqual([90, true, 3]);
    a.pass(2);
    expect([a.hp(B1), a.cooldown(A1, 'smash')]).toEqual([80, 3]);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect(a.hp(B1)).toBe(70); // over after 3 ticks
    expect(a.cooldown(A1, 'smash')).toBeLessThan(3); // ticking again
  });

  it('Hoarfrost Pick: 10 damage, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.glacier'], ['stab.glacier']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.glacier', B1).use(A2, 'stab.glacier', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Hoarfrost Pick: for 2 turns, Frost debuffs on the target can’t be removed', () => {
    const a = arena({ p0: [['stab.glacier'], ['charge.glacier']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1 });
    a.use(A1, 'stab.glacier', B1).use(A2, 'charge.glacier', B1).end();
    expect(a.has(B1, 'chilled')).toBe(true);
    const b = arena({ p0: [['shot'], ['charge.glacier']], p1: [['shot']] }); // control
    b.give(B1, 'chilled', { source: A1 }).use(A2, 'charge.glacier', B1).end();
    expect(b.has(B1, 'chilled')).toBe(false);
  });

  it('Scouring Melt: 25 Piercing, +10 per Confusion (max 3), then the Confusion is washed away', () => {
    const a = arena({ p0: [['ravage.glacier'], ['ravage.glacier']], p1: [['shot'], ['shot']] });
    a.give(B1, 'confusion', { stacks: 2, source: A1 }).give(B2, 'confusion', { stacks: 5, source: A1 }).give(B2, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.glacier', B1).use(A2, 'ravage.glacier', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([55, 45]);
    expect([a.has(B1, 'confusion'), a.has(B2, 'confusion')]).toEqual([false, false]);
    const c = arena({ p0: [['ravage.glacier']], p1: [['shot']] });
    c.use(A1, 'ravage.glacier', B1).end();
    expect(c.hp(B1)).toBe(75);
  });

  it('Thin Ice: Invisible; counters the target’s Harmful skill and Icebinds them', () => {
    const a = arena({ p0: [['mislead.glacier']], p1: [['smash']] });
    a.use(A1, 'mislead.glacier', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false);
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.has(B1, 'icebound')]).toEqual([100, true]);
  });

  it('Thin Ice: Icebound lasts 1 turn per turn of the countered skill’s cooldown', () => {
    const a = arena({ p0: [['mislead.glacier']], p1: [['smash']] });
    a.use(A1, 'mislead.glacier', B1).end().use(B1, 'smash', A1).end();
    expect(appliedDur(a, B1, 'icebound')).toBe(5); // 2 turns, applied on their turn
  });

  it('Thin Ice: Icebound is capped at 3 turns', () => {
    const a = arena({ p0: [['mislead.glacier']], p1: [['trap.glacier']] });
    a.use(A1, 'mislead.glacier', B1).end().use(B1, 'trap.glacier', A1).end();
    expect(appliedDur(a, B1, 'icebound')).toBe(7);
  });

  it('Thin Ice: a countered cd-0 skill gives no Icebound', () => {
    const b = arena({ p0: [['mislead.glacier']], p1: [['shot']] });
    b.use(A1, 'mislead.glacier', B1).end().use(B1, 'shot', A1).end();
    expect([b.hp(A1), b.has(B1, 'icebound')]).toEqual([100, false]);
  });

  it('Thin Ice: Helpful skills go through', () => {
    const a = arena({ p0: [['mislead.glacier']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.glacier', B1).end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'icebound')]).toEqual([75, false]);
  });

  it('Pack Ice: 15 damage and a 1-turn Stun, Icebound for as long', () => {
    const a = arena({ p0: [['stun.glacier']], p1: [['shot']] });
    a.use(A1, 'stun.glacier', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), a.has(B1, 'icebound')]).toEqual([85, true, true]);
    expect(dur(a, B1, 'icebound')).toBe(dur(a, B1, 'stun'));
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect([a.has(B1, 'stun'), a.has(B1, 'icebound')]).toEqual([false, false]);
  });

  it('Spring Current: 1 Swiftness and Meltwater for 3 turns; allies the user helps gain Meltwater for 1 turn', () => {
    const a = arena({ p0: [['dance.glacier', 'heal'], ['shot']], p1: [['shot']] });
    a.use(A1, 'dance.glacier').end();
    expect([a.stacks(A1, 'swiftness'), a.has(A1, 'meltwater'), a.has(A2, 'meltwater')]).toEqual([1, true, false]);
    a.end().use(A1, 'heal', A2).end();
    expect(a.has(A2, 'meltwater')).toBe(true);
    expect(appliedDur(a, A2, 'meltwater')).toBe(2);
    expect(a.has(B1, 'meltwater')).toBe(false);
  });

  it('Spring Current: Harmful skills on enemies don’t give them Meltwater', () => {
    const a = arena({ p0: [['dance.glacier', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.glacier').end().end().use(A1, 'shot', B1).end();
    expect(a.has(B1, 'meltwater')).toBe(false);
  });

  it('Glacial Spring: heals 15 and gives Meltwater for 1 turn', () => {
    const a = arena({ p0: [['heal.glacier'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.glacier', A2).end();
    expect([a.hp(A2), a.has(A2, 'meltwater')]).toEqual([65, true]);
    expect(appliedDur(a, A2, 'meltwater')).toBe(2);
  });

  it('Snowmelt: Meltwater for 2 turns, +1 per Icebound/Chilled removed', () => {
    const run = (debuffs: string[]) => {
      const a = arena({ p0: [['bless.glacier'], ['shot']], p1: [['shot']] });
      for (const d of debuffs) a.give(A2, d, { source: B1 });
      a.use(A1, 'bless.glacier', A2).end();
      return [a.has(A2, 'icebound'), a.has(A2, 'chilled'), appliedDur(a, A2, 'meltwater')];
    };
    expect(run([])).toEqual([false, false, 4]);
    expect(run(['icebound'])).toEqual([false, false, 6]);
    expect(run(['icebound', 'chilled'])).toEqual([false, false, 8]);
  });

  it('Snowmelt: other Debuffs stay', () => {
    const a = arena({ p0: [['bless.glacier']], p1: [['shot']] });
    a.give(A1, 'numb', { source: B1 }).give(A1, 'weakness', { source: B1 });
    a.use(A1, 'bless.glacier', A1).end();
    expect([a.has(A1, 'numb'), a.has(A1, 'weakness')]).toEqual([true, true]);
  });

  it('Frozen in Time: Icebound for 2 turns and their cooldowns rise by 1', () => {
    const a = arena({ p0: [['curse.glacier']], p1: [['smash']] });
    a.pass(1).use(B1, 'smash', A1).end(); // smash at 2
    a.use(A1, 'curse.glacier', B1).end();
    expect([a.has(B1, 'icebound'), a.cooldown(B1, 'smash')]).toEqual([true, 3]);
    expect(appliedDur(a, B1, 'icebound')).toBe(4);
    a.pass(2);
    expect(a.cooldown(B1, 'smash')).toBe(3); // stays there
  });

  it('Tidemark: 20 damage; for 1 turn, allies who damage the target heal their Renew once without losing a stack', () => {
    const a = arena({ p0: [['smite.glacier'], ['shot'], ['shot']], p1: [['shot']] });
    // Renew from an enemy source ticks on the enemy's turn, so only Tidemark heals here.
    a.give(A2, 'renew', { stacks: 2, source: B1 }).give('p0c2', 'renew', { stacks: 2, source: B1 });
    a.setHp(A2, 50).setHp('p0c2', 50);
    a.use(A1, 'smite.glacier', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2), a.stacks(A2, 'renew')]).toEqual([65, 60, 2]);
    expect(a.hp('p0c2')).toBe(50); // didn't damage them
  });

  it('Stillfrost Hymn: all allies heal 20 and gain 10 Shield for 1 turn', () => {
    const a = arena({ p0: [['prayer.glacier'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.glacier').end();
    expect([a.hp(A1), a.hp(A2), a.has(A1, 'shield'), a.has(A2, 'shield')]).toEqual([70, 70, true, true]);
    a.end().end();
    expect(a.has(A2, 'shield')).toBe(false);
  });

  it('Stillfrost Hymn: for 2 turns, Frostbitten enemies can’t use Helpful skills; others can', () => {
    const a = arena({ p0: [['prayer.glacier']], p1: [['heal'], ['heal']] });
    a.give(B1, 'frostbitten', { source: A1 }).use(A1, 'prayer.glacier').end();
    expect(a.reject(() => a.use(B1, 'heal', B1))).toBe('cannot_act');
    a.use(B2, 'heal', B2).end();
    a.pass(3);
    a.use(B1, 'heal', B1).end(); // over after 2 turns
  });

  it('Calving: 25 to the target and 15 to another enemy, who then share their Debuffs', () => {
    const a = arena({ p0: [['cleave.glacier']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B2, 'weakness', { source: A1 });
    a.use(A1, 'cleave.glacier', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    expect([a.has(B1, 'weakness'), a.has(B2, 'chilled'), a.stacks(B1, 'chilled'), a.stacks(B2, 'weakness')]).toEqual([true, true, 1, 1]);
  });

  it('Calving: Buffs aren’t shared', () => {
    const a = arena({ p0: [['cleave.glacier']], p1: [['shot'], ['shot']] });
    a.give(B1, 'might');
    a.use(A1, 'cleave.glacier', B1).end();
    expect(a.has(B2, 'might')).toBe(false);
  });

  it('Floe Horn: all enemies Intimidated for 2 turns; only allies with Flow become Frostborn', () => {
    const a = arena({ p0: [['shout.glacier'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'flow').use(A1, 'shout.glacier').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    expect([a.has(A1, 'frostborn'), a.has(A2, 'frostborn')]).toEqual([false, true]);
    expect(appliedDur(a, A2, 'frostborn')).toBe(appliedDur(a, B1, 'intimidated'));
  });

  it('Ice Shelf: 20 Shield for 2 turns, with Meltwater while any of it remains', () => {
    const a = arena({ p0: [['withstand.glacier']], p1: [['shot'], ['smash']] });
    a.use(A1, 'withstand.glacier').end();
    expect([a.has(A1, 'ice_shelf'), a.has(A1, 'meltwater')]).toEqual([true, true]);
    a.use(B1, 'shot', A1).end(); // 15 absorbed, 5 left
    expect([a.hp(A1), a.has(A1, 'meltwater')]).toEqual([100, true]);
    a.end().use('p1c1', 'smash', A1).end(); // breaks it
    expect([a.has(A1, 'ice_shelf'), a.has(A1, 'meltwater')]).toEqual([false, false]);
  });

  it('Rime Glare: Taunted by the user until they next take direct damage', () => {
    const a = arena({ p0: [['taunt.glacier'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.glacier', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect(() => a.use(B1, 'shot', A2)).toThrow();
    a.use(B1, 'shot', A1).end();
    a.use(A2, 'shot', B1).end();
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Rime Glare: indirect damage doesn’t end it; it runs out after 4 turns', () => {
    const a = arena({ p0: [['taunt.glacier']], p1: [['shot']] });
    a.give(B1, 'toxin', { source: A1 });
    a.use(A1, 'taunt.glacier', B1).end();
    expect(a.hp(B1)).toBe(95);
    a.pass(6);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Glacier Form: Icebound and Immune for 3 turns, plus 1 Armor per skill on cooldown', () => {
    const a = arena({ p0: [['titan.glacier', 'smash']], p1: [['shot', 'curse']] });
    a.use(A1, 'titan.glacier').end();
    expect([a.has(A1, 'icebound'), a.has(A1, 'immune')]).toEqual([true, true]);
    a.use(B1, 'shot', A1).end(); // only Glacier Form itself on cooldown: 1 Armor
    expect(a.hp(A1)).toBe(90);
    a.end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Glacier Form: max 3 Armor, rechecked as each hit lands', () => {
    const a = arena({ p0: [['titan.glacier', 'smash', 'blast', 'bolt']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.glacier').end();
    setCd(a, A1, 'smash', 3);
    setCd(a, A1, 'blast', 3);
    setCd(a, A1, 'bolt', 3);
    a.use(B1, 'shot', A1).end(); // 4 on cooldown → 3 Armor
    expect(a.hp(A1)).toBe(100);
    setCd(a, A1, 'smash', 0);
    setCd(a, A1, 'blast', 0);
    setCd(a, A1, 'bolt', 0);
    a.end().use(B2, 'shot', A1).end(); // only Glacier Form → 1 Armor
    expect(a.hp(A1)).toBe(90);
  });

  it('Glacier Form: the user’s cooldowns don’t tick (Icebound)', () => {
    const a = arena({ p0: [['titan.glacier', 'smash']], p1: [['shot']] });
    setCd(a, A1, 'smash', 3);
    a.use(A1, 'titan.glacier').end();
    expect([a.cooldown(A1, 'smash'), a.cooldown(A1, 'titan.glacier')]).toEqual([3, 5]);
  });
});

describe('Glacier costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    'strike.glacier': ['I', 1],
    'smash.glacier': ['Srr', 2],
    'charge.glacier': ['I', 2],
    'riposte.glacier': ['r', 3],
    'rage.glacier': ['SS', 4],
    'shot.glacier': ['A', 2],
    'snipe.glacier': ['AIr', 2],
    'trap.glacier': ['II', 4],
    'maneuver.glacier': ['I', 4],
    'companion.glacier': ['I', 1],
    'bolt.glacier': ['Ir', 1],
    'blast.glacier': ['Irr', 2],
    'consume.glacier': ['r', 2],
    'summon.glacier': ['Ir', 2],
    'channel.glacier': ['I', 3],
    'stab.glacier': ['r', 0],
    'ravage.glacier': ['Ir', 1],
    'mislead.glacier': ['I', 2],
    'stun.glacier': ['A', 2],
    'dance.glacier': ['Ar', 4],
    'heal.glacier': ['W', 1],
    'bless.glacier': ['r', 2],
    'curse.glacier': ['IW', 3],
    'smite.glacier': ['I', 1],
    'prayer.glacier': ['Ir', 3],
    'cleave.glacier': ['S', 1],
    'shout.glacier': ['I', 3],
    'withstand.glacier': ['I', 3],
    'taunt.glacier': ['r', 3],
    'titan.glacier': ['WI', 4],
    walrus_tusk: ['S', 0],
    walrus_haul_out: ['r', 0],
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
