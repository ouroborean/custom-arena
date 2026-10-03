// Scenarios for the Lightning element (Charged, Sapped, Stormborn, Conduit, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@arena/engine';
import { arena } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';

/** Total energy gained by `player` in the last energyGained event among `events`. */
function gained(events: readonly GameEvent[], player: 0 | 1): number {
  const e = [...events].reverse().find((x) => x.t === 'energyGained' && x.player === player);
  if (!e || e.t !== 'energyGained') throw new Error('no energyGained event');
  return Object.values(e.gained).reduce((a, b) => a + b, 0);
}

describe('Lightning statuses', () => {
  it('Charged: caps at 3; at 3 the owner gains 1 extra energy next turn and the Charge is spent', () => {
    const a = arena({ p0: [['shot'], ['shot'], ['shot']], p1: [['shot']], richEnergy: false });
    a.give(A1, 'charged', { stacks: 3 }).pass(2);
    expect(gained(a.last, 0)).toBe(4); // 3 characters + 1
    expect(a.has(A1, 'charged')).toBe(false);
  });

  it('Charged below 3 does nothing to energy', () => {
    const a = arena({ p0: [['shot'], ['shot'], ['shot']], p1: [['shot']], richEnergy: false });
    a.give(A1, 'charged', { stacks: 2 }).pass(2);
    expect([gained(a.last, 0), a.stacks(A1, 'charged')]).toEqual([3, 2]);
  });

  it('Sapped: at 3 the owner generates 1 less energy on their next turn', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot'], ['shot']], richEnergy: false });
    a.give(B1, 'sapped', { stacks: 3, source: A1 }).end();
    expect(gained(a.last, 1)).toBe(2);
    expect(a.has(B1, 'sapped')).toBe(false);
  });

  it('Charge applications stack but never exceed 3', () => {
    const a = arena({ p0: [['shot.lightning']], p1: [['shot']] });
    for (let i = 0; i < 4; i++) a.use(A1, 'shot.lightning', B1).end().pass(1);
    expect(a.stacks(A1, 'charged')).toBeLessThanOrEqual(3);
  });

  it('Stormborn: gains Charge when dealing and when receiving damage', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'stormborn').use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'charged')).toBe(1);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'charged')).toBe(2);
  });

  it('Conduit: steals Charge from enemies it damages', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'conduit').give(B1, 'charged', { stacks: 2 }).use(A1, 'shot', B1).end();
    expect([a.stacks(A1, 'charged'), a.stacks(B1, 'charged')]).toEqual([2, 0]);
  });

  it('Conduit: a Charged ally using a Helpful skill on it transfers their Charge', () => {
    const a = arena({ p0: [['shot'], ['heal']], p1: [['shot']] });
    a.give(A1, 'conduit').give(A2, 'charged', { stacks: 2 }).use(A2, 'heal', A1).end();
    expect([a.stacks(A1, 'charged'), a.stacks(A2, 'charged')]).toEqual([2, 0]);
  });
});

describe('Lightning skills', () => {
  it('Jolt: 15 +5 per Charge', () => {
    const a = arena({ p0: [['strike.lightning']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'strike.lightning', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([75, 2]);
  });

  it('Static Slam: 25; if Charged, the target\'s allies take 15 and are Sapped', () => {
    const a = arena({ p0: [['smash.lightning']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.lightning', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 100]);
    a.give(A1, 'charged').pass(5).use(A1, 'smash.lightning', B1).end();
    expect([a.hp(B2), a.has(B2, 'sapped')]).toEqual([85, true]);
  });

  it('Charged Dash: 10 and Charge', () => {
    const a = arena({ p0: [['charge.lightning']], p1: [['shot']] });
    a.use(A1, 'charge.lightning', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([90, 1]);
  });

  it('Feedback Loop: counters once and trades Charge for cooldown', () => {
    const a = arena({ p0: [['riposte.lightning']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'riposte.lightning').end();
    const cd = a.cooldown(A1, 'riposte.lightning');
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.has(A1, 'charged')).toBe(false);
    expect(a.cooldown(A1, 'riposte.lightning')).toBe(Math.max(0, cd - 2)); // cooldowns don't tick on enemy turns
  });

  it('Overcharge: Stormborn for 3 turns', () => {
    const a = arena({ p0: [['rage.lightning']], p1: [['shot']] });
    a.use(A1, 'rage.lightning').end();
    expect(a.has(A1, 'stormborn')).toBe(true);
  });

  it('Zap: 15 and Charge; costs r instead of I while Charged', () => {
    const a = arena({ p0: [['shot.lightning']], p1: [['shot']] });
    a.use(A1, 'shot.lightning', B1);
    expect(a.state.players[0].queue[0]?.cost).toMatchObject({ I: 1, r: 0 });
    a.end().pass(1).use(A1, 'shot.lightning', B1);
    expect(a.state.players[0].queue[0]?.cost).toMatchObject({ I: 0, r: 1 });
    a.end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([70, 2]);
  });

  it('Particle Beam: 30 Piercing a turn later to the target and every Sapped enemy', () => {
    const a = arena({ p0: [['snipe.lightning']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'sapped', { source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'snipe.lightning', B1).end().pass(2);
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([70, 70, 100]);
  });

  it('Tesla Coil: the next skill costs its user 15 and Saps them', () => {
    const a = arena({ p0: [['trap.lightning']], p1: [['shot']] });
    a.use(A1, 'trap.lightning', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.has(B1, 'tesla_coil')]).toEqual([85, 1, false]);
  });

  it('Blink: 5 damage to any enemy and Saps them; the user becomes Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.lightning']], p1: [['shot']] });
    a.use(A1, 'maneuver.lightning', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.has(A1, 'invulnerable')]).toEqual([95, 1, true]);
    a.pass(1);
    expect(a.has(A1, 'invulnerable')).toBe(false); // gone after that enemy turn
  });

  it('Storm Hawk: 25 HP; Stormfeather Saps, Glowing Down grants Charge', () => {
    const a = arena({ p0: [['companion.lightning'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.lightning').end().pass(1);
    const hawk = a.state.units.find((u) => u.owner === 0 && u.defId === 'storm_hawk')!;
    expect(hawk.hp).toBe(25);
    a.use(hawk.id, 'hawk_stormfeather', B1).end();
    expect([a.hp(B1), a.has(B1, 'sapped')]).toEqual([90, true]);
    a.pass(1).use(hawk.id, 'hawk_glowing_down', A2).end();
    expect(a.stacks(A2, 'charged')).toBe(1);
  });

  it('Innervate: 20 and Sapped', () => {
    const a = arena({ p0: [['bolt.lightning']], p1: [['shot']] });
    a.use(A1, 'bolt.lightning', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped')]).toEqual([80, 1]);
  });

  it('Static Burst: 15 to all, +10 per consumed Charge', () => {
    const a = arena({ p0: [['blast.lightning']], p1: [['shot'], ['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'blast.lightning').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'charged')]).toEqual([65, 65, false]);
  });

  it('Siphon Charge: 5, Sapped, and the user gains Charge', () => {
    const a = arena({ p0: [['consume.lightning']], p1: [['shot']] });
    a.use(A1, 'consume.lightning', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.stacks(A1, 'charged')]).toEqual([95, 1, 1]);
  });

  it('Static Elemental: spends one Charge for 1 Might; Zap is +5 against Sapped', () => {
    const a = arena({ p0: [['summon.lightning']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'summon.lightning').end();
    const el = a.state.units.find((u) => u.owner === 0 && u.defId === 'static_elemental')!;
    expect([el.hp, a.stacks(A1, 'charged'), a.has(el.id, 'might')]).toEqual([15, 1, true]);
    a.give(B1, 'sapped', { source: A1 }).pass(1).use(el.id, 'static_zap', B1).end();
    expect(a.hp(B1)).toBe(80); // 15 + 5 Might
  });

  it('Lightningrod: Stormborn that ends with the channel', () => {
    const a = arena({ p0: [['channel.lightning', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.lightning').end();
    expect([a.has(A1, 'lightningrod'), a.has(A1, 'stormborn')]).toEqual([true, true]);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'charged')).toBe(1);
    a.use(A1, 'shot', B1).end();
    expect([a.has(A1, 'lightningrod'), a.has(A1, 'stormborn')]).toEqual([false, false]);
  });

  it('Stun Baton: Charge off healthy targets; Saps targets left at 40 or less', () => {
    const a = arena({ p0: [['stab.lightning']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stab.lightning', B1).end();
    expect([a.stacks(A1, 'charged'), a.has(B1, 'sapped')]).toEqual([1, false]);
    a.setHp(B2, 50).pass(1).use(A1, 'stab.lightning', B2).end();
    expect([a.stacks(A1, 'charged'), a.has(B2, 'sapped')]).toEqual([1, true]);
  });

  it('Malectrocute: 20 Piercing, +10 if Charged, +10 if the target is Sapped', () => {
    const a = arena({ p0: [['ravage.lightning']], p1: [['shot']] });
    a.give(A1, 'charged').give(B1, 'sapped', { source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.lightning', B1).end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Hologram: every Sapped enemy\'s Harmful skill is countered; the user becomes Untargetable', () => {
    const a = arena({ p0: [['mislead.lightning'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'sapped', { source: A1 }).give(B2, 'sapped', { source: A1 }).use(A1, 'mislead.lightning').end();
    expect([a.has(B1, 'hologram'), a.has(B2, 'hologram'), a.has('p1c2', 'hologram')]).toEqual([true, true, false]);
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect([a.hp(A2), a.has(A1, 'untargetable')]).toEqual([100, true]); // both countered
  });

  it('Hologram: only the first Harmful skill of the other enemies is countered, and its user is Sapped', () => {
    const a = arena({ p0: [['mislead.lightning'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'mislead.lightning').end(); // nobody is Sapped yet
    expect([B1, B2, 'p1c2'].map((u) => a.has(u, 'hologram_decoy'))).toEqual([true, true, true]);
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).use('p1c2', 'shot', A2).end();
    expect(a.hp(A2)).toBe(70); // B1's was countered; B2's and p1c2's hit
    expect([a.stacks(B1, 'sapped'), a.has(B2, 'sapped'), a.has(A1, 'untargetable')]).toEqual([1, false, true]);
    expect([B1, B2, 'p1c2'].some((u) => a.has(u, 'hologram_decoy'))).toBe(false);
  });

  it('System Shock: 15 and a non-Strategic stun, longer against Sapped targets', () => {
    const a = arena({ p0: [['stun.lightning']], p1: [['shot'], ['shot']] });
    a.give(B2, 'sapped', { source: A1 }).use(A1, 'stun.lightning', B1).end();
    const short = a.effects(B1).find((e) => e.defId === 'stun_ns')!.duration!;
    a.pass(5).use(A1, 'stun.lightning', B2).end();
    const long = a.effects(B2).find((e) => e.defId === 'stun_ns')!.duration!;
    expect([a.hp(B1), long - short]).toEqual([85, 2]);
  });

  it('Three Storm Breaths: Stormborn and Conduit', () => {
    const a = arena({ p0: [['dance.lightning']], p1: [['shot']] });
    a.use(A1, 'dance.lightning').end();
    expect([a.has(A1, 'stormborn'), a.has(A1, 'conduit')]).toEqual([true, true]);
  });

  it('Defibrillate: 20 +5 per Charge', () => {
    const a = arena({ p0: [['heal.lightning'], ['shot']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).setHp(A2, 50).use(A1, 'heal.lightning', A2).end();
    expect(a.hp(A2)).toBe(80);
  });

  it('Overclock: the ally gains 2 Charge, and Conduit for 2 turns', () => {
    const a = arena({ p0: [['bless.lightning'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.lightning', A2).end();
    expect([a.stacks(A2, 'charged'), a.has(A2, 'conduit')]).toEqual([2, true]);
    a.pass(2);
    expect(a.has(A2, 'conduit')).toBe(true);
    a.pass(2);
    expect([a.stacks(A2, 'charged'), a.has(A2, 'conduit')]).toEqual([2, false]); // the Charge stays
  });

  it('Power Drain: Sapped', () => {
    const a = arena({ p0: [['curse.lightning']], p1: [['shot']] });
    a.use(A1, 'curse.lightning', B1).end();
    expect(a.stacks(B1, 'sapped')).toBe(1);
  });

  it('Apply Polarity: allies that damage the target this turn gain Charge', () => {
    const a = arena({ p0: [['smite.lightning'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.lightning', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged'), a.stacks(A2, 'charged')]).toEqual([75, 0, 1]);
  });

  it('Signal Boost: 25 and Charge to the target, then 10 per Charge to Charged allies', () => {
    const a = arena({ p0: [['prayer.lightning'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50).give(A3, 'charged', { stacks: 2 });
    a.use(A1, 'prayer.lightning', A2).end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3), a.stacks(A2, 'charged')]).toEqual([50, 85, 70, 1]);
  });

  it('Arc: 10 to the target and every Marked enemy, then Marks the target', () => {
    const a = arena({ p0: [['cleave.lightning']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'mark', { source: A1 }).use(A1, 'cleave.lightning', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2'), a.has(B1, 'mark')]).toEqual([90, 80, 100, true]); // B2's Mark adds 10
  });

  it('Crackle: Saps all enemies', () => {
    const a = arena({ p0: [['shout.lightning']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.lightning').end();
    expect([a.stacks(B1, 'sapped'), a.stacks(B2, 'sapped')]).toEqual([1, 1]);
  });

  it('Lightning Cage: 20 +10 per Charge Shield; each absorbed hit (even the last) gives Charge', () => {
    const a = arena({ p0: [['withstand.lightning']], p1: [['shot']] });
    a.give(A1, 'charged').use(A1, 'withstand.lightning').end();
    expect(a.effects(A1).find((e) => e.defId.endsWith('lightning_cage'))?.value).toBe(30);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'charged')]).toEqual([100, 2]);
    const b = arena({ p0: [['withstand.lightning']], p1: [['strike']] });
    b.use(A1, 'withstand.lightning').end().use(B1, 'strike', A1).end(); // depletes the 20
    expect(b.stacks(A1, 'charged')).toBe(1);
  });

  it('Aggro Signal: the target\'s next Harmful skill is reflected back and they are Intimidated', () => {
    const a = arena({ p0: [['taunt.lightning']], p1: [['shot']] });
    a.use(A1, 'taunt.lightning', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'intimidated')]).toEqual([100, 85, true]);
  });

  it('EXO-Armor: Charge becomes Armor and Swiftness, then Stormborn', () => {
    const a = arena({ p0: [['titan.lightning']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'titan.lightning').end();
    expect([a.stacks(A1, 'armor'), a.stacks(A1, 'swiftness'), a.has(A1, 'charged'), a.has(A1, 'stormborn')]).toEqual([
      2,
      2,
      false,
      true,
    ]);
  });
});
