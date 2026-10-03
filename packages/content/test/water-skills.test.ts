// Scenarios for the Water element (Flow, Renew interactions, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

describe('Water statuses', () => {
  it('Flow: the bearer ignores counters', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.give(A1, 'flow').use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('without Flow the same skill is countered', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100);
  });
});

describe('Water skills', () => {
  it('Flowing Fist: 20 damage and 2 Renew on the user', () => {
    const a = arena({ p0: [['strike.water']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'strike.water', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect(a.stacks(A1, 'renew') + (a.hp(A1) - 50) / 5).toBeGreaterThanOrEqual(2);
  });

  it('Waterfall: 30 / 10 and reduces the user\'s other cooldowns by 1', () => {
    const a = arena({ p0: [['smash.water', 'stun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun', B2).end().pass(1);
    const before = a.cooldown(A1, 'stun');
    a.use(A1, 'smash.water', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 75]); // B2 also took Stun's 15
    expect(a.cooldown(A1, 'stun')).toBe(Math.max(0, before - 2)); // −1 from Waterfall, −1 end of turn
    expect(a.cooldown(A1, 'smash.water')).toBe(2);
  });

  it('Surge: ally gets 2 Renew; the user\'s next Renew application gets +2 stacks', () => {
    const run = (surge: boolean) => {
      const a = arena({ p0: [['charge.water', 'heal.water'], ['shot'], ['shot']], p1: [['shot']] });
      if (surge) a.use(A1, 'charge.water', 'p0c2');
      a.end().pass(1);
      const before = a.stacks(A2, 'renew');
      a.use(A1, 'heal.water', A2).end();
      return { gained: a.stacks(A2, 'renew') - before, surgeLeft: a.has(A1, 'surge') };
    };
    const plain = run(false);
    const surged = run(true);
    expect(surged.surgeLeft).toBe(false); // consumed by the Renewing Spring
    expect(surged.gained).toBe(plain.gained + 2);
  });

  it('Riverbend: counters Strategic skills (not non-Strategic ones) and grants Flow', () => {
    const a = arena({ p0: [['riposte.water']], p1: [['shot']] });
    a.use(A1, 'riposte.water').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // Shot is non-Strategic
    const b = arena({ p0: [['riposte.water']], p1: [['curse']] });
    b.use(A1, 'riposte.water').end().use(B1, 'curse', A1).end();
    expect([b.hp(A1), b.has(A1, 'flow')]).toEqual([100, true]);
  });

  it('Quiet Fury: Flow, Might and Focus', () => {
    const a = arena({ p0: [['rage.water']], p1: [['shot']] });
    a.use(A1, 'rage.water').end();
    expect(['flow', 'might', 'focus'].map((s) => a.has(A1, s))).toEqual([true, true, true]);
  });

  it('Coordinated Shot: 10 and Marks the target; Flow only if they were already Marked', () => {
    const a = arena({ p0: [['shot.water'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.water', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.has(A1, 'flow')]).toEqual([90, true, false]);
    a.pass(1).use(A1, 'shot.water', B1).end(); // its own Mark: +10 from the Mark, Flow, and a fresh Mark
    expect([a.hp(B1), a.has(B1, 'mark'), a.has(A1, 'flow')]).toEqual([70, true, true]);
    const b = arena({ p0: [['shot.water'], ['shot']], p1: [['shot']] });
    b.use(A1, 'shot.water', B1).use(A2, 'shot', B1).end(); // an ally cashes in the Mark
    expect([b.hp(B1), b.has(B1, 'mark')]).toEqual([100 - 10 - 15 - 10, false]);
  });

  it('Tidal Arrow: lands 40 a turn later with a hidden target, then the user gains Flow', () => {
    const a = arena({ p0: [['snipe.water']], p1: [['shot']] });
    a.use(A1, 'snipe.water', B1).end();
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1)?.targets).toEqual([]);
    expect([a.hp(B1), a.has(A1, 'flow')]).toEqual([100, false]);
    a.pass(2);
    expect([a.hp(B1), a.has(A1, 'flow')]).toEqual([60, true]);
  });

  it('Tidal Arrow: Channeled; a Stun interrupts it, so no damage and no Flow', () => {
    const a = arena({ p0: [['snipe.water']], p1: [['stun']] });
    a.use(A1, 'snipe.water', B1).end();
    a.use(B1, 'stun', A1).end().pass(2);
    expect([a.hp(B1), a.has(A1, 'flow')]).toEqual([100, false]);
  });

  it('Whirlpool Trap: Strategic skills give the target Confusion', () => {
    const a = arena({ p0: [['trap.water']], p1: [['shot', 'curse']] });
    a.use(A1, 'trap.water', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'confusion')).toBe(0);
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
  });

  it('Dive: Invulnerable and 2 Renew', () => {
    const a = arena({ p0: [['maneuver.water']], p1: [['shot']] });
    a.use(A1, 'maneuver.water').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Rainbow Scale Fish: Shimmer gives 2 Renew, and Flow at 3+ Renew', () => {
    const a = arena({ p0: [['companion.water'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.water').end().pass(1);
    const fish = a.state.units.find((u) => u.owner === 0 && u.defId === 'rainbow_scale_fish');
    expect(fish?.hp).toBe(35);
    a.use(fish!.id, 'fish_shimmer', A2).end();
    expect(a.has(A2, 'flow')).toBe(false);
    a.give(A2, 'renew', { stacks: 5 }).pass(1).use(fish!.id, 'fish_shimmer', A2).end();
    expect(a.has(A2, 'flow')).toBe(true);
  });

  it('Splash: 20 damage and 2 Renew to a random ally', () => {
    const a = arena({ p0: [['bolt.water'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.water', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect(a.stacks(A1, 'renew') + a.stacks(A2, 'renew')).toBeGreaterThanOrEqual(1);
  });

  it('Deluge: 15 to all; without Flow the user gains Flow, with Flow it consumes it to stun non-Strategic skills', () => {
    const a = arena({ p0: [['blast.water']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.water').end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'stun_ns'), a.has(A1, 'flow')]).toEqual([85, 85, false, true]);
    a.pass(5).use(A1, 'blast.water').end(); // its own Flow pays off the next cast
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'stun_ns'), a.has(B2, 'stun_ns')]).toEqual([70, 70, true, true]);
    expect(a.has(A1, 'flow')).toBe(false); // the Flow was consumed
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(5).use(A1, 'blast.water').end(); // so the third cast regains Flow instead of stunning
    expect([a.has(A1, 'flow'), a.has(B1, 'stun_ns')]).toEqual([true, false]);
  });

  it('Drink Deeply: strips all allied Renew and heals 10 per stack', () => {
    const a = arena({ p0: [['consume.water'], ['shot']], p1: [['shot']] });
    a.give(A1, 'renew', { stacks: 2 }).give(A2, 'renew', { stacks: 3 }).setHp(A2, 40);
    a.use(A1, 'consume.water', A2).end();
    expect([a.hp(A2), a.stacks(A1, 'renew'), a.stacks(A2, 'renew')]).toEqual([90, 0, 0]);
  });

  it('Drink Deeply: with no allied Renew, the target gains 3 Renew instead', () => {
    const a = arena({ p0: [['consume.water'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).use(A1, 'consume.water', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([40 + 15, 3 - 1]); // 3 Renew, which ticked once at the end of the turn
  });

  it('Water Elemental: 15 HP minion for 3 turns with an Uncounterable free hit', () => {
    const a = arena({ p0: [['summon.water']], p1: [['riposte']] });
    a.use(A1, 'summon.water').end();
    const el = a.state.units.find((u) => u.owner === 0 && u.defId === 'water_elemental')!;
    expect(el.hp).toBe(15);
    a.use(B1, 'riposte').end();
    a.use(el.id, 'elemental_lashing_water', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Call Rain: 5 to all enemies and 1 Renew to all allies each turn', () => {
    const a = arena({ p0: [['channel.water'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.water').end();
    a.pass(1);
    expect(a.hp(B1)).toBeLessThan(100);
    expect(a.hp(B1)).toBe(a.hp(B2));
  });

  it('Shell Knife: 10 and 2 Renew for the user; 25 (and no Renew) with 3+ Renew', () => {
    const a = arena({ p0: [['stab.water']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'stab.water', B1).end();
    expect([a.hp(B1), a.hp(A1), a.stacks(A1, 'renew')]).toEqual([90, 60, 1]); // 2 Renew, ticked once
    a.pass(1).give(A1, 'renew', { stacks: 2 }); // 1 + 2 = 3
    a.use(A1, 'stab.water', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'renew')]).toEqual([65, 1]); // 25, and no new Renew (both instances ticked once)
  });

  it('Drown: 25 Piercing; extends an active Stun by 1 turn', () => {
    const a = arena({ p0: [['ravage.water']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 1 }).give(B1, 'stun', { source: A1, duration: 2 });
    a.use(A1, 'ravage.water', B1).end();
    expect(a.hp(B1)).toBe(75);
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(true); // unextended, it would have expired here
    a.pass(2);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Dunk: counters the target\'s Helpful skills and gives Confusion', () => {
    const a = arena({ p0: [['mislead.water']], p1: [['shot', 'rage']] });
    a.use(A1, 'mislead.water', B1).end();
    a.use(B1, 'rage').end();
    expect([a.has(B1, 'might'), a.stacks(B1, 'confusion')]).toEqual([false, 1]);
  });

  it('Undertow: 15 and a 1-turn Stun; extends an existing Stun instead', () => {
    const a = arena({ p0: [['stun.water']], p1: [['shot']] });
    a.use(A1, 'stun.water', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([85, true]);
    const d = a.effects(B1).find((e) => e.defId === 'stun')!.duration!;
    const b = arena({ p0: [['stun.water']], p1: [['shot']] });
    b.give(B1, 'stun', { source: A1, duration: 1 });
    b.use(A1, 'stun.water', B1).end();
    expect(b.effects(B1).filter((e) => e.defId === 'stun')).toHaveLength(1);
    expect(b.effects(B1).find((e) => e.defId === 'stun')!.duration).toBeGreaterThan(d);
    expect(b.has(B1, 'stun')).toBe(true);
  });

  it('Pull of the River: Flow, 3 Renew and Swiftness', () => {
    const a = arena({ p0: [['dance.water']], p1: [['shot']] });
    a.use(A1, 'dance.water').end();
    expect([a.has(A1, 'flow'), a.has(A1, 'renew'), a.has(A1, 'swiftness')]).toEqual([true, true, true]);
  });

  it('Renewing Spring: 4 Renew heals 5 per stack each turn and decays', () => {
    const a = arena({ p0: [['heal.water'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.water', A2).end().pass(1);
    expect(a.hp(A2)).toBeGreaterThan(50);
    expect(a.stacks(A2, 'renew')).toBeLessThan(4);
  });

  it('Touch of Grace: ally gains Flow', () => {
    const a = arena({ p0: [['bless.water'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.water', A2).end();
    expect(a.has(A2, 'flow')).toBe(true);
  });

  it('Airless Helm: 10 Affliction and 3 Weakness', () => {
    const a = arena({ p0: [['curse.water']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'curse.water', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'weakness')]).toEqual([90, 3]);
  });

  it('Aqua Ring: allies that hit the ringed enemy gain Flow', () => {
    const a = arena({ p0: [['smite.water'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.water', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.has(A1, 'flow')).toBe(false); // Aqua Ring's own hit lands before the ring
    const b = arena({ p0: [['smite.water'], ['shot']], p1: [['shot']] });
    b.use(A1, 'smite.water', B1).end().pass(1).use(A2, 'shot', B1).end();
    expect(b.has(A2, 'flow')).toBe(true);
  });

  it('Whale Call: Vulnerable to all; Stunned or Taunted enemies take 15 Affliction', () => {
    const a = arena({ p0: [['shout.water']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'stun', { source: A1 }).give('p1c2', 'taunt', { source: A1 });
    a.use(A1, 'shout.water').end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2')]).toEqual([100, 80, 80]); // 15 Affliction + 5 from the fresh Vulnerable
    expect(a.has(B1, 'vulnerable')).toBe(true);
  });

  it('Aqua Veil: 10 Shield and 2 Renew', () => {
    const a = arena({ p0: [['withstand.water']], p1: [['shot']] });
    a.use(A1, 'withstand.water').end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBeGreaterThanOrEqual(95);
  });

  it('Tidal Pull: Taunt; its cooldown resets when the user gains Flow', () => {
    const a = arena({ p0: [['taunt.water', 'rage.water']], p1: [['shot']] });
    a.use(A1, 'taunt.water', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1);
    expect(a.cooldown(A1, 'taunt.water')).toBeGreaterThan(0);
    a.use(A1, 'rage.water').end();
    expect(a.cooldown(A1, 'taunt.water')).toBe(0);
  });

  it('Naiad Form: 2 Armor, 2 Renew and Might', () => {
    const a = arena({ p0: [['titan.water']], p1: [['shot']] });
    a.use(A1, 'titan.water').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'renew'), a.has(A1, 'might')]).toEqual([2, true, true]);
  });
});
