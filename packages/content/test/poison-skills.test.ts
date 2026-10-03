// Scenarios for the Poison element (statuses, Prey, all 30 variants, minion skills).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Toxin ticks (5 Affliction per stack) at the end of the applier's turn.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition, viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

const isPrey = (a: ReturnType<typeof arena>, id: string) => evaluateNamedCondition(content, a.state, 'prey', id);

describe('Poison statuses', () => {
  it('Toxin: stacks merge per applying side; 5 Affliction per stack', () => {
    const a = arena({ p0: [['strike.poison'], ['strike.poison']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 });
    a.use(A1, 'strike.poison', B1).use(A2, 'strike.poison', B1).end();
    const tox = a.effects(B1).filter((e) => e.defId === 'toxin');
    expect(tox).toHaveLength(1);
    expect(tox[0]!.stacks).toBe(2);
    expect(a.hp(B1)).toBe(90); // 2 × 20 absorbed by Shield, then 10 Affliction through it
  });

  it('Prey: more than 2 debuff stacks, below 20 HP, or marked', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 2 }).give(B1, 'weakness');
    a.give(B2, 'toxin', { stacks: 2 });
    a.setHp('p1c2', 15);
    expect([isPrey(a, B1), isPrey(a, B2), isPrey(a, 'p1c2')]).toEqual([true, false, true]);
    a.give(B2, 'prey');
    expect(isPrey(a, B2)).toBe(true);
  });
});

describe('Poison skills', () => {
  it('Viper Strike: 20 and 1 Toxin', () => {
    const a = arena({ p0: [['strike.poison']], p1: [['shot']] });
    a.use(A1, 'strike.poison', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect(a.stacks(B1, 'toxin')).toBe(1);
  });

  it("Plague Stomp: 25 to the target, 1 Toxin to each of the target's allies", () => {
    const a = arena({ p0: [['smash.poison']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.poison', B1).end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([75, 95, 0, 1]);
  });

  it('Lunge: 10; all enemies are Prey through the user’s next turn', () => {
    const a = arena({ p0: [['charge.poison']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.poison', B1).end();
    expect([isPrey(a, B1), isPrey(a, B2)]).toEqual([true, true]);
    a.pass(1);
    expect(isPrey(a, B2)).toBe(true); // still on the user's next turn
    a.pass(1);
    expect(isPrey(a, B2)).toBe(false);
  });

  it('Shed Skin: on the next direct hit, heal 15 and gain 3 Renew', () => {
    const a = arena({ p0: [['riposte.poison']], p1: [['shot']] });
    a.setHp(A1, 60).use(A1, 'riposte.poison').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(60);
    expect(a.stacks(A1, 'renew')).toBe(3);
    expect(a.has(A1, 'shed_skin')).toBe(false);
  });

  it('Viper Stance: every Might in the battle becomes Weakness', () => {
    const a = arena({ p0: [['rage.poison']], p1: [['shot']] });
    a.give(A1, 'might', { stacks: 2 }).give(B1, 'might');
    a.use(A1, 'rage.poison').end();
    expect([a.stacks(A1, 'weakness'), a.stacks(B1, 'weakness'), a.has(A1, 'might'), a.has(B1, 'might')]).toEqual([2, 1, false, false]);
  });

  it('Sting: 5 Piercing and one random debuff', () => {
    const a = arena({ p0: [['shot.poison']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 5 }).use(A1, 'shot.poison', B1).end();
    expect(a.hp(B1)).toBeLessThanOrEqual(95); // Piercing ignores Armor (plus a Toxin tick if rolled)
    expect(a.stacks(B1, 'toxin') + a.stacks(B1, 'weakness') + a.stacks(B1, 'vulnerable')).toBe(1);
  });

  it('Banewood Javelin: 25 Affliction on the following turn, and it cannot be countered', () => {
    const a = arena({ p0: [['snipe.poison']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'snipe.poison', B1).end();
    expect(a.events.some((e) => e.t === 'skillCountered')).toBe(false);
    a.end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Snake Pit: each Strategic skill the target uses gives them 1 Toxin', () => {
    const a = arena({ p0: [['trap.poison']], p1: [['shot', 'curse']] });
    a.use(A1, 'trap.poison', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'toxin')).toBe(false);
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.stacks(B1, 'toxin')).toBe(1);
  });

  it('Slither: Invulnerable for 1 turn, gains Focus, usable while Stunned', () => {
    const a = arena({ p0: [['maneuver.poison']], p1: [['shot']] });
    a.give(A1, 'stun').use(A1, 'maneuver.poison').end();
    expect([a.has(A1, 'invulnerable'), a.stacks(A1, 'focus')]).toEqual([true, 1]);
  });

  it('Emerald Asp: a minion with its own skills (Serpent Fang, Constrict)', () => {
    const a = arena({ p0: [['companion.poison']], p1: [['shot']] });
    a.use(A1, 'companion.poison').end().pass(1);
    const asp = a.state.units.find((u) => u.defId === 'emerald_asp')!;
    a.use(asp.id, 'asp_fang', B1).end();
    expect(a.hp(B1)).toBe(90); // 5 Piercing + 5 Toxin tick
    a.pass(1).use(asp.id, 'asp_constrict', B1).end();
    expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable')]).toEqual([2, 2]);
  });

  it('Acid Orb: 20; against Prey, Mark and 1 Vulnerable', () => {
    const a = arena({ p0: [['bolt.poison']], p1: [['shot']] });
    a.use(A1, 'bolt.poison', B1).end();
    expect(a.has(B1, 'mark')).toBe(false);
    a.pass(3).setHp(B1, 35).use(A1, 'bolt.poison', B1).end(); // drops below 20 → Prey
    expect([a.has(B1, 'mark'), a.stacks(B1, 'vulnerable')]).toEqual([true, 1]);
  });

  it('Acid Wash: 15 to all enemies and 1 Vulnerable for 2 turns', () => {
    const a = arena({ p0: [['blast.poison']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.poison').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(B2, 'vulnerable')]).toEqual([85, 85, 1]);
  });

  it('Devour: executes characters under 15 HP, minions under 30', () => {
    const a = arena({ p0: [['consume.poison']], p1: [['shot']] });
    a.setHp(B1, 20).use(A1, 'consume.poison', B1).end();
    expect(a.unit(B1).alive).toBe(true);
    const b = arena({ p0: [['consume.poison']], p1: [['shot'], ['shot']] });
    b.setHp(B1, 10).use(A1, 'consume.poison', B1).end();
    expect(b.unit(B1).alive).toBe(false);
    const c = arena({ p0: [['consume.poison']], p1: [['shot'], ['companion']] });
    c.pass(1).use(B2, 'companion').end();
    const wolf = c.state.units.find((u) => u.defId === 'wolf')!;
    c.use(A1, 'consume.poison', wolf.id).end(); // wolf at 30 HP: not under 30
    expect(c.unit(wolf.id).alive).toBe(true);
    const d = arena({ p0: [['consume.poison']], p1: [['shot'], ['companion']] });
    d.pass(1).use(B2, 'companion').end();
    const wolf2 = d.state.units.find((u) => u.defId === 'wolf')!;
    d.setHp(wolf2.id, 25).use(A1, 'consume.poison', wolf2.id).end();
    expect(d.unit(wolf2.id).alive).toBe(false);
  });

  it('Spriggan Harasser: a 3-turn minion that can Sting', () => {
    const a = arena({ p0: [['summon.poison']], p1: [['shot']] });
    a.use(A1, 'summon.poison').end().pass(1);
    const spr = a.state.units.find((u) => u.defId === 'spriggan_harasser')!;
    a.use(spr.id, 'spriggan_sting', B1).end();
    expect(a.hp(B1)).toBeLessThanOrEqual(95);
    a.pass(3);
    expect(a.unit(spr.id).alive).toBe(false);
  });

  it('Nine Plagues: 5 Affliction to all enemies and 1 Toxin to a random enemy each user turn', () => {
    const a = arena({ p0: [['channel.poison']], p1: [['shot']] });
    a.use(A1, 'channel.poison').end();
    expect(a.hp(B1)).toBe(95);
    expect(a.stacks(B1, 'toxin')).toBe(1);
    a.pass(2);
    expect(a.stacks(B1, 'toxin')).toBe(2);
  });

  it('Pounce: 5 Piercing; against Prey, the user gains a random energy; otherwise 1 Toxin', () => {
    const a = arena({ p0: [['stab.poison']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'stab.poison', B1).end();
    const gains = () => a.last.filter((e) => e.t === 'energyGained' && e.player === 0).length;
    expect([gains(), a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([0, 90, 1]); // 5 Piercing through Armor, then a Toxin tick
    a.pass(1).give(B1, 'prey').use(A1, 'stab.poison', B1).end();
    expect([gains(), a.stacks(B1, 'toxin')]).toEqual([1, 1]); // no more Toxin
  });

  it('Envenom: 25 Piercing that Bypasses Invulnerable; 2 Toxin against Prey or Invulnerable targets', () => {
    const a = arena({ p0: [['ravage.poison']], p1: [['shot']] });
    a.give(B1, 'invulnerable').use(A1, 'ravage.poison', B1).end();
    expect(a.hp(B1)).toBe(75 - 10);
    expect(a.stacks(B1, 'toxin')).toBe(2);
  });

  it('Numbing Needle: counters a Harmful skill and gives 1 Toxin, 1 Weakness, 1 Vulnerable', () => {
    const a = arena({ p0: [['mislead.poison']], p1: [['shot']] });
    a.use(A1, 'mislead.poison', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect([a.stacks(B1, 'toxin'), a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable')]).toEqual([1, 1, 1]);
  });

  it('Lacerate: Stun for 1 turn, 2 against Prey', () => {
    const a = arena({ p0: [['stun.poison'], ['stun.poison']], p1: [['shot'], ['shot']] });
    a.give(B2, 'prey');
    a.use(A1, 'stun.poison', B1).use(A2, 'stun.poison', B2).end();
    const dur = (id: string) => a.effects(id).find((e) => e.defId === 'stun')?.duration;
    expect([dur(B1), dur(B2)]).toEqual([1, 3]); // after this turn's countdown: 2−1, 4−1
  });

  it('Cobra Stance: every Armor in the battle becomes Vulnerable', () => {
    const a = arena({ p0: [['dance.poison']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'dance.poison').end();
    expect([a.stacks(B1, 'vulnerable'), a.has(B1, 'armor')]).toEqual([3, false]);
  });

  it('Moonglove Mixture: heals any unit 30 and gives it 2 Toxin', () => {
    const a = arena({ p0: [['heal.poison']], p1: [['shot']] });
    a.setHp(B1, 50).use(A1, 'heal.poison', B1).end();
    expect(a.hp(B1)).toBe(80 - 10);
    expect(a.stacks(B1, 'toxin')).toBe(2);
  });

  it("Viper's Crest: 1 Might and 1 Swiftness for 3 turns", () => {
    const a = arena({ p0: [['bless.poison'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.poison', A2).end();
    expect([a.stacks(A2, 'might'), a.stacks(A2, 'swiftness')]).toEqual([1, 1]);
  });

  it('Swamp Toxins: 1 Confusion and 1 Toxin', () => {
    const a = arena({ p0: [['curse.poison']], p1: [['shot']] });
    a.use(A1, 'curse.poison', B1).end();
    expect([a.stacks(B1, 'confusion'), a.stacks(B1, 'toxin')]).toEqual([1, 1]);
  });

  it('Preymark: 15; for 1 turn, allied direct damage to the target gives them 1 Vulnerable each hit', () => {
    const a = arena({ p0: [['smite.poison'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.poison', B1).use(A2, 'shot', B1).end();
    expect(a.stacks(B1, 'vulnerable')).toBe(1);
    expect(a.hp(B1)).toBe(70);
  });

  it('Serpentsong: all allies gain 2 Renew, all enemies 1 Toxin', () => {
    const a = arena({ p0: [['prayer.poison'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'prayer.poison').end();
    expect(a.stacks(B1, 'toxin') + a.stacks(B2, 'toxin')).toBe(2);
    expect(a.stacks(A2, 'renew')).toBe(1); // 2 stacks, one spent on the end-of-turn tick
  });

  it('Tail Lash: 15 to all enemies; hitting Prey resets its cooldown', () => {
    const a = arena({ p0: [['cleave.poison']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.poison').end();
    expect(a.cooldown(A1, 'cleave.poison')).toBeGreaterThan(0);
    const b = arena({ p0: [['cleave.poison']], p1: [['shot'], ['shot']] });
    b.give(B2, 'prey').use(A1, 'cleave.poison').end();
    expect(b.cooldown(A1, 'cleave.poison')).toBe(0);
  });

  it('Bad Stomach: Toxin on the user if they have none, otherwise on all enemies', () => {
    const a = arena({ p0: [['shout.poison']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.poison').end();
    expect(a.stacks(A1, 'toxin')).toBe(1);
    a.pass(3).use(A1, 'shout.poison').end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([1, 1]);
  });

  it('Coil: 5 Shield and 1 Armor', () => {
    const a = arena({ p0: [['withstand.poison']], p1: [['shot']] });
    a.use(A1, 'withstand.poison').end();
    expect([a.effects(A1).find((e) => e.defId === 'shield')?.value, a.stacks(A1, 'armor')]).toEqual([5, 1]);
  });

  it('Mesmerizing Glare: Taunted and Prey for 3 turns', () => {
    const a = arena({ p0: [['taunt.poison'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.poison', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    expect(isPrey(a, B1)).toBe(true);
  });

  it('Constrictor Stance: every Focus in the battle becomes Confusion', () => {
    const a = arena({ p0: [['titan.poison']], p1: [['shot']] });
    a.give(B1, 'focus', { stacks: 2 }).use(A1, 'titan.poison').end();
    expect([a.stacks(B1, 'confusion'), a.has(B1, 'focus')]).toEqual([2, false]);
  });
});
