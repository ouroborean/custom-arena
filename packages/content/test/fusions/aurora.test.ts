// Spec-driven tests for the Aurora fusion (Ice + Lightning): Shimmer, Dazzled and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.21, and the "Aurora — Ice + Lightning" kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Durations: "for N turns" applied on the applier's own turn is 2N internal ticks (rules §8.1);
// applied on the opponent's turn it's 2N + 1.

import { describe, expect, it } from 'vitest';
import { viewFor, type Energy, type GameEvent } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type Applied = Extract<GameEvent, { t: 'effectApplied' }>;
type Gained = Extract<GameEvent, { t: 'energyGained' }>;

function dur(a: Arena, id: string, key: string): number | null | undefined {
  return a.effects(id).find((e) => (e.inline ? e.inline.id : e.defId) === key)?.duration;
}

function appliedDur(a: Arena, bearer: string, defId: string): number | null | undefined {
  const evs = a.last.filter((e): e is Applied => e.t === 'effectApplied' && e.bearer === bearer && e.defId === defId);
  return evs[evs.length - 1]?.duration;
}

function setEnergy(a: Arena, player: 0 | 1, e: Partial<Energy>): void {
  a.state.players[player].energy = { S: 0, A: 0, I: 0, W: 0, ...e };
}

function energy(a: Arena, player: 0 | 1): Energy {
  return { ...a.state.players[player].energy };
}

/** Energy-shift events (one color −1, another +1) for `player` in the most recent command. */
function shifts(a: Arena, player: 0 | 1): Gained[] {
  return a.last.filter(
    (e): e is Gained => e.t === 'energyGained' && e.player === player && Object.values(e.gained).some((v) => v < 0) && Object.values(e.gained).some((v) => v > 0),
  );
}

function setCd(a: Arena, id: string, skillId: string, n: number): void {
  const s = a.unit(id).skills.find((x) => x.defId === skillId);
  if (!s) throw new Error(`${id} has no ${skillId}`);
  s.cooldown = n;
}

function minion(a: Arena, defId: string) {
  return a.state.units.find((u) => u.defId === defId && u.alive);
}

const hidden = (a: Arena, bearer: string, from: 0 | 1) => !viewFor(content, a.state, from).effects.some((e) => e.bearer === bearer && e.source !== bearer);

describe('Aurora keywords', () => {
  it('Shimmer: the bearer may pay colored costs with any color', () => {
    const a = arena({ p0: [['smash'], ['smash']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 0, { W: 4 });
    a.give(A1, 'shimmer');
    a.use(A1, 'smash', B1); // Sr paid with W
    expect(a.reject(() => a.use(A2, 'smash', B1))).not.toBe(''); // no Shimmer: needs S
    a.end();
    expect(a.hp(B1)).toBe(75);
    expect(energy(a, 0).W).toBe(2);
  });

  it('Shimmer is a Buff; Dazzled is a Debuff', () => {
    expect(content.statuses.shimmer?.kind).toBe('Buff');
    expect(content.statuses.dazzled?.kind).toBe('Debuff');
  });

  it('Dazzled: at the start of the bearer’s turn, one of their player’s energies changes to another color', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 1, { S: 3 });
    a.give(B1, 'dazzled', { source: A1 });
    a.end(); // B's turn starts
    const s = shifts(a, 1);
    expect(s).toHaveLength(1);
    const g = s[0]!.gained;
    expect(Object.values(g).reduce((n, v) => n + v, 0)).toBe(0); // same total
    expect(Object.entries(g).filter(([, v]) => v === -1).map(([k]) => k)).toEqual(['S']);
  });

  it('Dazzled: no shift on the other player’s turns, or without it', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 1, { S: 3 });
    a.end();
    expect(shifts(a, 1)).toHaveLength(0);
    a.give(B1, 'dazzled', { source: A1 }).end(); // A's turn starts
    expect(shifts(a, 0)).toHaveLength(0);
  });
});

describe('Aurora skills', () => {
  it('Polar Jolt: 15 damage with no Charge, and no Shimmer', () => {
    const a = arena({ p0: [['strike.aurora']], p1: [['shot']] });
    a.use(A1, 'strike.aurora', B1).end();
    expect([a.hp(B1), a.has(A1, 'shimmer')]).toEqual([85, false]);
  });

  it('Polar Jolt: +5 per Charge, then 1 Charge is spent for Shimmer until the end of the user’s next turn', () => {
    const a = arena({ p0: [['strike.aurora']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'strike.aurora', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged'), a.has(A1, 'shimmer')]).toEqual([75, 1, true]);
    a.end();
    expect(a.has(A1, 'shimmer')).toBe(true); // through the user's next turn
    a.end();
    expect(a.has(A1, 'shimmer')).toBe(false);
  });

  it('Hoarfrost Crash: 25 to the target and 10 to their allies', () => {
    const a = arena({ p0: [['smash.aurora']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.aurora', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 90]);
  });

  it('Hoarfrost Crash: Frost debuffs on everyone hit last through the user’s next turn (ruling: 3 ticks longer)', () => {
    const a = arena({ p0: [['smash.aurora']], p1: [['shot'], ['shot']] });
    a.give(B2, 'chilled', { source: A1, duration: 1 }); // would end this turn
    a.give(B1, 'numb', { source: A1, duration: 1 });
    a.use(A1, 'smash.aurora', B1).end();
    expect([a.has(B1, 'numb'), a.has(B2, 'chilled')]).toEqual([true, true]);
    a.end().end();
    expect(a.has(B2, 'chilled')).toBe(true); // through the user's next turn
    a.end();
    expect(a.has(B2, 'chilled')).toBe(false); // extended once, not held forever
  });

  it('Hoarfrost Crash: meanwhile those Frost debuffs can’t be removed', () => {
    const a = arena({ p0: [['smash.aurora'], ['charge.glacier']], p1: [['shot']] });
    a.give(B1, 'chilled', { source: A1, duration: 6 });
    a.use(A1, 'smash.aurora', B1).use(A2, 'charge.glacier', B1).end(); // Meltwater Rush would melt the Chill
    expect(a.has(B1, 'chilled')).toBe(true);
  });

  it('Streak of Light: 15 damage; Shimmer for the next skill, which deals 10 more to the same enemy', () => {
    const a = arena({ p0: [['charge.aurora', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.aurora', B1).end();
    expect([a.hp(B1), a.has(A1, 'shimmer')]).toEqual([85, true]);
    a.end().use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.has(A1, 'shimmer')]).toEqual([60, false]);
  });

  it('Streak of Light: the bonus doesn’t apply to a different enemy', () => {
    const a = arena({ p0: [['charge.aurora', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.aurora', B1).end().end().use(A1, 'shot', B2).end();
    expect(a.hp(B2)).toBe(85);
  });

  it('Magnetic Veil: Invisible; counters the first Harmful skill and Saps its user twice', () => {
    const a = arena({ p0: [['riposte.aurora']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.aurora').end();
    expect(hidden(a, A1, 1)).toBe(true);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped')]).toEqual([85, 2, 0]);
  });

  it('Magnetic Veil: the attacker’s Sapped can’t be removed for 3 turns', () => {
    const a = arena({ p0: [['riposte.aurora']], p1: [['shot', 'maneuver.aurora']] });
    a.use(A1, 'riposte.aurora').end().use(B1, 'shot', A1).end();
    a.end().use(B1, 'maneuver.aurora').end(); // Vanishing Light would turn their Sapped into Charge
    expect(a.stacks(B1, 'sapped')).toBe(2);
  });

  it('Magnetic Veil: Helpful skills aren’t countered', () => {
    const a = arena({ p0: [['riposte.aurora']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'riposte.aurora').end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'sapped')]).toEqual([75, false]);
  });

  it('Polar Storm: Stormborn and 1 Might for 3 turns', () => {
    const a = arena({ p0: [['rage.aurora']], p1: [['shot']] });
    a.use(A1, 'rage.aurora').end();
    expect([a.has(A1, 'stormborn'), a.stacks(A1, 'might')]).toEqual([true, 1]);
    a.pass(5);
    expect([a.has(A1, 'stormborn'), a.has(A1, 'might')]).toEqual([false, false]);
  });

  it('Polar Storm: when the user’s Charge reaches 3, every enemy is Dazzled for 1 turn', () => {
    const a = arena({ p0: [['rage.aurora', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.aurora').end().end();
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'shot', B1).end(); // Stormborn: +1 → 3
    expect([a.has(B1, 'dazzled'), a.has(B2, 'dazzled')]).toEqual([true, true]);
  });

  it('Polar Storm: no Dazzle while Charge stays below 3', () => {
    const a = arena({ p0: [['rage.aurora', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.aurora').end().end().use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'charged'), a.has(B1, 'dazzled')]).toEqual([1, false]);
  });

  it('Glimmer: 10 damage and Dazzled for 2 turns; 20 if they were already Dazzled', () => {
    const a = arena({ p0: [['shot.aurora']], p1: [['shot']] });
    a.use(A1, 'shot.aurora', B1).end();
    expect([a.hp(B1), a.has(B1, 'dazzled')]).toEqual([90, true]);
    expect(appliedDur(a, B1, 'dazzled')).toBe(4);
    a.end().use(A1, 'shot.aurora', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Polar Lance: Chilled until it lands, Sapped per energy their skills cost, then 35 Piercing', () => {
    const a = arena({ p0: [['snipe.aurora']], p1: [['smash']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'snipe.aurora', B1).end();
    expect([a.hp(B1), a.has(B1, 'chilled')]).toEqual([100, true]);
    a.use(B1, 'smash', A1).end(); // Sr = 2 energy
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.has(B1, 'chilled')]).toEqual([65, 2, false]);
  });

  it('Polar Lance: no Sapped if the target uses nothing', () => {
    const a = arena({ p0: [['snipe.aurora']], p1: [['smash']] });
    a.use(A1, 'snipe.aurora', B1).end().end();
    expect([a.hp(B1), a.has(B1, 'sapped')]).toEqual([65, false]);
  });

  // BUG: text says Invisible; the untriggered snare shows as revealed to the target's player after the user's turn ends
  it.fails('Rime Snare: Invisible to the target’s player until it fires', () => {
    const a = arena({ p0: [['trap.aurora']], p1: [['shot']] });
    a.use(A1, 'trap.aurora', B1).end();
    expect([a.hp(B1), hidden(a, B1, 1)]).toEqual([100, true]);
  });

  it('Rime Snare: the first time the target has a Frost debuff at the end of the user’s turn: 15 Piercing, +2 turns', () => {
    const a = arena({ p0: [['trap.aurora']], p1: [['shot']] });
    a.use(A1, 'trap.aurora', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    a.give(B1, 'armor', { stacks: 3 }).give(B1, 'chilled', { source: A1, duration: 2 }).end();
    expect(a.hp(B1)).toBe(85);
    expect(dur(a, B1, 'chilled')).toBe(5); // 2 → +4, then the turn's countdown
    a.end().end();
    expect(a.hp(B1)).toBe(85); // only the first time
  });

  it('Rime Snare: doesn’t fire without a Frost debuff, and runs out after 3 turns', () => {
    const a = arena({ p0: [['trap.aurora']], p1: [['shot']] });
    a.use(A1, 'trap.aurora', B1).end().pass(6);
    a.give(B1, 'chilled', { source: A1 }).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Vanishing Light: Invulnerable for 1 turn; Sapped turns into as much Charge', () => {
    const a = arena({ p0: [['maneuver.aurora']], p1: [['shot']] });
    a.give(A1, 'sapped', { stacks: 2, source: B1 }).use(A1, 'maneuver.aurora').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'sapped'), a.stacks(A1, 'charged'), a.has(A1, 'shimmer')]).toEqual([true, false, 2, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Vanishing Light: if Chilled, the Chill ends and the user gains Shimmer for 2 turns', () => {
    const a = arena({ p0: [['maneuver.aurora']], p1: [['shot']] });
    a.give(A1, 'chilled', { source: B1 }).use(A1, 'maneuver.aurora').end();
    expect([a.has(A1, 'chilled'), a.has(A1, 'shimmer')]).toEqual([false, true]);
    expect(appliedDur(a, A1, 'shimmer')).toBe(4);
  });

  it('Aurora Fox: a permanent 30 HP Fox with Stormborn; Foxfire 10 +5 per Fox Charge, Dazzles 1 turn', () => {
    const a = arena({ p0: [['companion.aurora']], p1: [['shot']] });
    a.use(A1, 'companion.aurora').end();
    const fox = minion(a, 'aurora_fox')!;
    expect([fox.hp, a.has(fox.id, 'stormborn')]).toEqual([30, true]);
    a.end().use(fox.id, 'aurora_fox_foxfire', B1).end();
    expect([a.hp(B1), a.has(B1, 'dazzled'), a.stacks(fox.id, 'charged')]).toEqual([90, true, 1]);
    expect(appliedDur(a, B1, 'dazzled')).toBe(2);
    a.end().use(fox.id, 'aurora_fox_foxfire', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Flickerbolt: 20 damage, and the user gains Shimmer for their next skill', () => {
    const a = arena({ p0: [['bolt.aurora']], p1: [['shot']] });
    a.use(A1, 'bolt.aurora', B1).end();
    expect([a.hp(B1), a.has(A1, 'shimmer')]).toEqual([80, true]);
  });

  it('Flickerbolt: with Shimmer, it ends and the bolt deals 15 more', () => {
    const a = arena({ p0: [['bolt.aurora']], p1: [['shot']] });
    a.give(A1, 'shimmer').use(A1, 'bolt.aurora', B1).end();
    expect([a.hp(B1), a.has(A1, 'shimmer')]).toEqual([65, false]);
  });

  it('Borealis: 25 to all; Chilled enemies are Dazzled for 2 turns, the rest Chilled for 1', () => {
    const a = arena({ p0: [['blast.aurora']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).use(A1, 'blast.aurora').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
    expect([a.has(B1, 'dazzled'), a.has(B2, 'dazzled'), a.has(B2, 'chilled')]).toEqual([true, false, true]);
    expect(appliedDur(a, B1, 'dazzled')).toBe(4);
    expect(appliedDur(a, B2, 'chilled')).toBe(2);
  });

  it('Drink the Light: 5 damage; the enemy player loses 1 of their most-held color and the user’s player gains it', () => {
    const a = arena({ p0: [['consume.aurora']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 0, { W: 1 });
    setEnergy(a, 1, { A: 3, I: 1 });
    a.use(A1, 'consume.aurora', B1).end();
    expect(a.hp(B1)).toBe(95);
    expect(energy(a, 0)).toEqual({ S: 0, A: 1, I: 0, W: 0 });
    const startGain = a.last.filter((e): e is Gained => e.t === 'energyGained' && e.player === 1 && Object.values(e.gained).every((v) => v >= 0));
    const add = startGain.reduce((n, e) => n + e.gained.A, 0);
    expect(energy(a, 1).A - add).toBe(2);
    expect(energy(a, 1).I - startGain.reduce((n, e) => n + e.gained.I, 0)).toBe(1);
  });

  it('Stray Aurora: hits a random unit on the side with more total HP each turn; gone after 3 turns', () => {
    const a = arena({ p0: [['summon.aurora']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.aurora').end();
    const sa = minion(a, 'stray_aurora')!;
    expect(sa.hp).toBe(30);
    expect(a.hp(B1) + a.hp(B2)).toBe(185); // enemies 200 vs 130
    expect(a.hp(A1)).toBe(100);
    a.pass(6);
    expect(minion(a, 'stray_aurora')).toBeUndefined();
  });

  it('Stray Aurora: when the user’s side has more HP, it hits the user’s side instead', () => {
    const a = arena({ p0: [['summon.aurora'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.aurora').end();
    const sa = minion(a, 'stray_aurora')!;
    expect(a.hp(B1)).toBe(100);
    expect(a.hp(A1) + a.hp(A2) + a.unit(sa.id).hp).toBe(215);
  });

  it('Stray Aurora: either team can target it', () => {
    const a = arena({ p0: [['summon.aurora']], p1: [['shot']] });
    a.use(A1, 'summon.aurora').end();
    const sa = minion(a, 'stray_aurora')!;
    a.use(B1, 'shot', sa.id).end();
    expect(a.unit(sa.id).hp).toBe(15);
  });

  it('Skyglow: 5 to all enemies at the end of each of the user’s turns for up to 3 turns; allies have Shimmer', () => {
    const a = arena({ p0: [['channel.aurora'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.aurora').end();
    expect([a.hp(B1), a.hp(B2), a.has(A2, 'shimmer'), a.has(A1, 'shimmer')]).toEqual([95, 95, true, true]);
    a.pass(2);
    expect(a.hp(B1)).toBe(90);
    a.pass(2);
    expect(a.hp(B1)).toBe(85);
    a.pass(2);
    expect([a.hp(B1), a.has(A2, 'shimmer')]).toEqual([85, false]);
  });

  it('Skyglow: ends early if the user takes direct damage', () => {
    const a = arena({ p0: [['channel.aurora'], ['shot']], p1: [['shot']] });
    a.use(A1, 'channel.aurora').end();
    a.use(B1, 'shot', A1).end();
    a.end();
    expect([a.hp(B1), a.has(A2, 'shimmer')]).toEqual([95, false]);
  });

  it('Skyglow: indirect damage doesn’t end it', () => {
    const a = arena({ p0: [['channel.aurora']], p1: [['shot']] });
    a.give(A1, 'toxin', { source: B1 }).use(A1, 'channel.aurora').end().end();
    expect(a.hp(A1)).toBe(95);
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Shock Icicle: 10 damage and Dazzled for 1 turn', () => {
    const a = arena({ p0: [['stab.aurora']], p1: [['shot']] });
    setEnergy(a, 1, { S: 2, A: 2 });
    a.use(A1, 'stab.aurora', B1).end();
    expect([a.hp(B1), a.has(B1, 'dazzled')]).toEqual([90, true]);
    expect(appliedDur(a, B1, 'dazzled')).toBe(2);
  });

  it('Shock Icicle: 25 if the target’s player has 1 or no energy left', () => {
    const a = arena({ p0: [['stab.aurora'], ['stab.aurora']], p1: [['shot'], ['shot']] });
    setEnergy(a, 1, { W: 1 });
    a.use(A1, 'stab.aurora', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Grounding Rend: 25 Piercing; all the user’s Charge pours in, Sapping them once per Charge', () => {
    const a = arena({ p0: [['ravage.aurora']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.aurora', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.has(A1, 'charged')]).toEqual([75, 2, false]);
    const b = arena({ p0: [['ravage.aurora']], p1: [['shot']] });
    b.use(A1, 'ravage.aurora', B1).end();
    expect(b.has(B1, 'sapped')).toBe(false);
  });

  it('Ghost Lights: Invisible; counters a Harmful skill and Dazzles its user', () => {
    const a = arena({ p0: [['mislead.aurora']], p1: [['smash']] });
    a.use(A1, 'mislead.aurora', B1).end();
    expect(hidden(a, B1, 1)).toBe(true);
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), a.has(B1, 'dazzled')]).toEqual([100, true]);
  });

  // BUG: text says Dazzled for 1 turn +1 per energy the countered skill cost (Smash Sr → 3 turns, Shot r → 2); it's always 1 turn
  it.fails('Ghost Lights: Dazzled 1 turn +1 per energy the countered skill cost', () => {
    const a = arena({ p0: [['mislead.aurora']], p1: [['smash']] });
    a.use(A1, 'mislead.aurora', B1).end().use(B1, 'smash', A1).end();
    expect(appliedDur(a, B1, 'dazzled')).toBe(7);
    const b = arena({ p0: [['mislead.aurora']], p1: [['shot']] });
    b.use(A1, 'mislead.aurora', B1).end().use(B1, 'shot', A1).end(); // r: 2 turns
    expect(appliedDur(b, B1, 'dazzled')).toBe(5);
  });

  it('Ghost Lights: Helpful skills go through', () => {
    const a = arena({ p0: [['mislead.aurora']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.aurora', B1).end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'dazzled')]).toEqual([75, false]);
  });

  it('Lightshow: 15 damage; for 2 turns their non-Strategic skills are stunned, Strategic ones aren’t', () => {
    const a = arena({ p0: [['stun.aurora']], p1: [['shot', 'curse']] });
    a.use(A1, 'stun.aurora', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act'); // second turn
    a.end().end();
    a.use(B1, 'shot', A1).end();
  });

  it('Dance of Lights: Shimmer for 3 turns; each skill gives 1 Charge, every second also 1 Swiftness', () => {
    const a = arena({ p0: [['dance.aurora', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.aurora').end();
    expect([a.has(A1, 'shimmer'), a.stacks(A1, 'charged'), a.has(A1, 'swiftness')]).toEqual([true, 0, false]);
    a.end().use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'charged'), a.has(A1, 'swiftness')]).toEqual([1, false]);
    a.end().use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'charged'), a.stacks(A1, 'swiftness')]).toEqual([2, 1]);
    a.pass(2);
    expect(a.has(A1, 'shimmer')).toBe(false);
  });

  it('Glow of the Long Night: heals 15, then 5 per enemy Frost debuff at the start of the user’s next turn', () => {
    const a = arena({ p0: [['heal.aurora'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B1, 'numb', { source: A1 }).give(B2, 'frostbitten', { source: A1 });
    a.setHp(A2, 50).use(A1, 'heal.aurora', A2).end();
    expect(a.hp(A2)).toBe(65);
    a.end();
    expect(a.hp(A2)).toBe(80);
  });

  it('Glow of the Long Night: the bonus is capped at 30, and is 0 without Frost debuffs', () => {
    const a = arena({ p0: [['heal.aurora'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    for (const b of [B1, B2, B3]) for (const d of ['chilled', 'numb', 'frostbitten']) a.give(b, d, { source: A1 });
    a.setHp(A2, 10).use(A1, 'heal.aurora', A2).end().end();
    expect(a.hp(A2)).toBe(55);
    const c = arena({ p0: [['heal.aurora'], ['shot']], p1: [['shot']] });
    c.setHp(A2, 50).use(A1, 'heal.aurora', A2).end().end();
    expect(c.hp(A2)).toBe(65);
  });

  it('Shimmering Veil: Shimmer for 2 turns, and all the user’s Charge moves to the ally', () => {
    const a = arena({ p0: [['bless.aurora'], ['shot']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'bless.aurora', A2).end();
    expect([a.has(A2, 'shimmer'), a.stacks(A2, 'charged'), a.has(A1, 'charged')]).toEqual([true, 2, false]);
    expect(appliedDur(a, A2, 'shimmer')).toBe(4);
  });

  it('Shimmering Veil: moved Charge respects the cap of 3', () => {
    const a = arena({ p0: [['bless.aurora'], ['shot']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).give(A2, 'charged', { stacks: 2 }).use(A1, 'bless.aurora', A2).end();
    expect(a.stacks(A2, 'charged')).toBe(3);
  });

  it('Color Drain: Dazzled for 2 turns, and Sapped each time it shifts an energy', () => {
    const a = arena({ p0: [['curse.aurora']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 1, { S: 2 });
    a.use(A1, 'curse.aurora', B1).end();
    expect([a.has(B1, 'dazzled'), shifts(a, 1).length, a.stacks(B1, 'sapped')]).toEqual([true, 1, 1]);
    a.end().end();
    expect(a.stacks(B1, 'sapped')).toBe(2);
  });

  it('Color Drain: a plain Dazzle (not Color Drain) doesn’t Sap', () => {
    const a = arena({ p0: [['shot.aurora']], p1: [['shot']] });
    a.use(A1, 'shot.aurora', B1).end();
    expect(a.has(B1, 'sapped')).toBe(false);
  });

  it('Lodestar: 15 damage and Dazzled for 1 turn; each ally who damages them extends it by 1 turn', () => {
    const a = arena({ p0: [['smite.aurora'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.aurora', B1).use(A2, 'shot', B1).use('p0c2', 'shot', B1).end();
    const b = arena({ p0: [['smite.aurora']], p1: [['shot']] });
    b.use(A1, 'smite.aurora', B1).end();
    expect([a.hp(B1), b.hp(B1)]).toEqual([55, 85]);
    expect(dur(b, B1, 'dazzled')).toBe(1);
    expect(dur(a, B1, 'dazzled')).toBe(5); // +2 turns
  });

  it('Polar Dawn: all allies heal 15 and gain 10 Shield for 1 turn', () => {
    const a = arena({ p0: [['prayer.aurora'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.aurora').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([65, 65]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(60); // 10 absorbed
  });

  it('Polar Dawn: every skill on cooldown on the user’s side comes 1 turn closer; enemies’ don’t', () => {
    const a = arena({ p0: [['prayer.aurora'], ['smash']], p1: [['smash']] });
    setCd(a, A2, 'smash', 3);
    setCd(a, B1, 'smash', 3);
    a.use(A1, 'prayer.aurora').end();
    expect([a.cooldown(A2, 'smash'), a.cooldown(B1, 'smash')]).toEqual([1, 3]);
  });

  it('Arc of Lights: 20 to the target, arcing 10 to the other enemy and Dazzling them for 1 turn', () => {
    const a = arena({ p0: [['cleave.aurora']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.aurora', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'dazzled'), a.has(B2, 'dazzled')]).toEqual([80, 90, false, true]);
    expect(appliedDur(a, B2, 'dazzled')).toBe(2);
  });

  it('Polar Static: all enemies Intimidated for 2 turns; 1 Charge per Frost debuff among them (max 3)', () => {
    const a = arena({ p0: [['shout.aurora']], p1: [['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B2, 'numb', { source: A1 });
    a.use(A1, 'shout.aurora').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.stacks(A1, 'charged')]).toEqual([true, true, 2]);
    const b = arena({ p0: [['shout.aurora']], p1: [['shot'], ['shot']] });
    for (const d of ['chilled', 'numb', 'frostbitten']) b.give(B1, d, { source: A1 }).give(B2, d, { source: A1 });
    b.use(A1, 'shout.aurora').end();
    expect(b.stacks(A1, 'charged')).toBe(3);
    const c = arena({ p0: [['shout.aurora']], p1: [['shot']] });
    c.use(A1, 'shout.aurora').end();
    expect(c.has(A1, 'charged')).toBe(false);
  });

  it('Ice Cage: 25 Shield for 2 turns, with Shimmer while any of it remains', () => {
    const a = arena({ p0: [['withstand.aurora']], p1: [['shot'], ['smash']] });
    a.use(A1, 'withstand.aurora').end();
    expect(a.has(A1, 'shimmer')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'shimmer')]).toEqual([100, true]);
    a.end().use(B2, 'smash', A1).end(); // 10 left, breaks
    expect([a.hp(A1), a.has(A1, 'shimmer')]).toEqual([85, false]);
  });

  it('Polar Beacon: Taunted for 2 turns; meanwhile each Sapped they gain counts as 2', () => {
    const a = arena({ p0: [['taunt.aurora'], ['ravage.aurora']], p1: [['shot']] });
    a.give(A2, 'charged', { stacks: 1 });
    a.use(A1, 'taunt.aurora', B1).use(A2, 'ravage.aurora', B1).end();
    expect([a.has(B1, 'taunt'), a.stacks(B1, 'sapped')]).toEqual([true, 2]);
    expect(() => a.use(B1, 'shot', A2)).toThrow();
  });

  it('Polar Beacon: un-Taunted enemies gain Sapped normally', () => {
    const a = arena({ p0: [['ravage.aurora']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 1 }).use(A1, 'ravage.aurora', B1).end();
    expect(a.stacks(B1, 'sapped')).toBe(1);
  });

  it('Heavenlight Armor: Shimmer and Immune for 3 turns, 1 Armor per color among the player’s energies', () => {
    const a = arena({ p0: [['titan.aurora']], p1: [['shot', 'curse']] });
    a.use(A1, 'titan.aurora').end(); // rich energy: all 4 colors → 4 Armor
    expect([a.has(A1, 'shimmer'), a.has(A1, 'immune')]).toEqual([true, true]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100); // 15 − 20
    a.end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Heavenlight Armor: fewer colors, less Armor', () => {
    const a = arena({ p0: [['titan.aurora']], p1: [['shot']], richEnergy: false });
    setEnergy(a, 0, { W: 1, I: 3 });
    a.use(A1, 'titan.aurora').end(); // pays W + 1 I, leaving only I → 1 Armor
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90);
  });
});

describe('Aurora costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    'strike.aurora': ['r', 0],
    'smash.aurora': ['SI', 2],
    'charge.aurora': ['r', 2],
    'riposte.aurora': ['I', 3],
    'rage.aurora': ['SS', 4],
    'shot.aurora': ['r', 0],
    'snipe.aurora': ['AIr', 2],
    'trap.aurora': ['r', 2],
    'maneuver.aurora': ['r', 2],
    'companion.aurora': ['I', 1],
    'bolt.aurora': ['Ir', 1],
    'blast.aurora': ['Irr', 2],
    'consume.aurora': ['r', 2],
    'summon.aurora': ['I', 1],
    'channel.aurora': ['rr', 3],
    'stab.aurora': ['r', 0],
    'ravage.aurora': ['Ir', 1],
    'mislead.aurora': ['I', 2],
    'stun.aurora': ['AA', 2],
    'dance.aurora': ['SA', 5],
    'heal.aurora': ['I', 1],
    'bless.aurora': ['I', 1],
    'curse.aurora': ['r', 2],
    'smite.aurora': ['S', 1],
    'prayer.aurora': ['WW', 2],
    'cleave.aurora': ['I', 1],
    'shout.aurora': ['Sr', 3],
    'withstand.aurora': ['S', 3],
    'taunt.aurora': ['r', 3],
    'titan.aurora': ['Wr', 4],
    aurora_fox_foxfire: ['r', 0],
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
