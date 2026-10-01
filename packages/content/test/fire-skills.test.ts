// Scenarios for the Fire element (statuses + all 30 variants), written from the Fire sheet.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Reminder: Ignite ticks (5 Affliction) at the end of the applier's turn.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

describe('Fire statuses', () => {
  it('Ignite: 5 Affliction per applier turn, does not stack, ignores Invulnerable and Shield', () => {
    const a = arena({ p0: [['blast.fire']], p1: [['maneuver']] });
    a.use(A1, 'blast.fire').end();
    expect(a.hp(B1)).toBe(95);
    a.use(B1, 'maneuver').end(); // Invulnerable doesn't stop Affliction ticks
    a.give(B1, 'shield', { value: 20 });
    a.pass(1); // turn 3: second tick, ignoring Shield
    expect(a.hp(B1)).toBe(90);
    const b = arena({ p0: [['strike.fire'], ['strike.fire']], p1: [['shot']] });
    b.use(A1, 'strike.fire', B1).use(A2, 'strike.fire', B1).end(); // two Ignites → still one instance
    expect(b.stacks(B1, 'ignite')).toBe(1);
  });

  it('Flameborn: the applier heals for their Ignite damage, and heals 10 when their side Explodes', () => {
    const a = arena({ p0: [['strike.fire'], ['dance.fire']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'flameborn').setHp(A2, 50).give(A2, 'flameborn');
    a.use(A1, 'strike.fire', B1).end();
    expect(a.hp(A1)).toBe(55); // healed 5 from the Ignite tick
    a.pass().use(A2, 'dance.fire').end(); // Explosion: both Flameborn allies heal 10
    expect(a.hp(A2)).toBe(60);
    expect(a.hp(A1)).toBe(55 + 5 + 10);
  });

  it('Scorched: healing received is halved, rounded up to the nearest 5', () => {
    const a = arena({ p0: [['heal']], p1: [['shot']] });
    a.setHp(A1, 40).give(A1, 'scorched').use(A1, 'heal', A1).end();
    expect(a.hp(A1)).toBe(55); // 25 → 12.5 → 15
  });

  it('Explosions skip Invulnerable targets despite being Affliction (Q14)', () => {
    const a = arena({ p0: [['dance.fire']], p1: [['shot'], ['shot']] });
    a.give(B1, 'invulnerable');
    a.use(A1, 'dance.fire').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 90]);
  });
});

describe('Fire skills', () => {
  it('Torch Strike: 25 and Ignite', () => {
    const a = arena({ p0: [['strike.fire']], p1: [['shot']] });
    a.use(A1, 'strike.fire', B1).end();
    expect(a.hp(B1)).toBe(70);
    expect(a.has(B1, 'ignite')).toBe(true);
  });

  it('Chain Detonation: 20 + 10 splash; every Ignited target Explodes', () => {
    const a = arena({ p0: [['smash.fire'], ['blast.fire']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A2, 'blast.fire').use(A1, 'smash.fire', B1).end();
    // 3 Explosions × 10 to each enemy, then the Ignite tick.
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([100 - 20 - 30 - 5, 100 - 10 - 30 - 5, 100 - 10 - 30 - 5]);
  });

  it('Hot Foot: +2 Might against an Ignited target, until a new damaging skill', () => {
    const a = arena({ p0: [['strike.fire'], ['charge.fire', 'curse', 'shot']], p1: [['shot']] });
    a.use(A1, 'strike.fire', B1).use(A2, 'charge.fire', B1).end();
    expect(a.stacks(A2, 'might')).toBe(2);
    a.pass().use(A2, 'curse', B1).end(); // Strategic: Might stays
    expect(a.stacks(A2, 'might')).toBe(2);
    const before = a.hp(B1);
    a.pass().use(A2, 'shot', B1).end(); // damaging: Might applies to this hit, then ends
    expect(before - a.hp(B1)).toBe(15 + 10 + 5);
    expect(a.has(A2, 'might')).toBe(false);
  });

  it('Blisterblade: counters and Ignites; an already-Ignited attacker is Scorched', () => {
    const a = arena({ p0: [['riposte.fire'], ['strike.fire']], p1: [['shot'], ['shot']] });
    a.use(A2, 'strike.fire', B1).use(A1, 'riposte.fire').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.has(B1, 'scorched')).toBe(true);
    expect(a.has(B2, 'ignite')).toBe(true);
    expect(a.has(B2, 'scorched')).toBe(false);
  });

  it('Blazing Fury: 1 Might and Flameborn for 3 turns', () => {
    const a = arena({ p0: [['rage.fire']], p1: [['shot']] });
    a.use(A1, 'rage.fire').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'flameborn')]).toEqual([1, true]);
    a.pass(5);
    expect(a.has(A1, 'flameborn')).toBe(false);
  });

  it('Flickerflare: 15 and Ignite; on an already-Ignited enemy, another random enemy is Ignited', () => {
    const a = arena({ p0: [['shot.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.fire', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, false]);
    expect(a.reject(() => a.pass().use(A1, 'shot.fire', B1))).toBe('on_cooldown'); // CD 1 (balance change)
    a.pass(2).use(A1, 'shot.fire', B1).end();
    expect(a.has(B2, 'ignite')).toBe(true);
  });

  it('Heat Seeker: 40 at the end of the following turn, then permanent Scorch; target hidden', () => {
    const a = arena({ p0: [['snipe.fire']], p1: [['shot']] });
    a.use(A1, 'snipe.fire', B1).end();
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1)?.targets).toEqual([]);
    a.end();
    expect(a.hp(B1)).toBe(60);
    const scorch = a.effects(B1).find((e) => e.defId === 'scorched');
    expect(scorch?.duration).toBeNull();
  });

  it('Hidden Explosives: the next Harmful skill triggers an Explosion on the setter’s enemies', () => {
    const a = arena({ p0: [['trap.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.fire', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([90, 90, 85]);
    expect(a.has(B1, 'hidden_explosives')).toBe(false);
  });

  it('Flame Dash: Flameborn and Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.fire']], p1: [['shot']] });
    a.use(A1, 'maneuver.fire').end();
    expect([a.has(A1, 'flameborn'), a.has(A1, 'invulnerable')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Dragon Hatchling: owner Flameborn while it lives; 10 Affliction + Ignite each turn', () => {
    const a = arena({ p0: [['companion.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.fire').end();
    const hatch = a.state.units.find((u) => u.defId === 'dragon_hatchling')!;
    expect(a.has(A1, 'flameborn')).toBe(true);
    const hit = [B1, B2].find((b) => a.hp(b) === 90)!;
    expect(a.has(hit, 'ignite')).toBe(true);
    a.use(B1, 'shot', hatch.id).use(B2, 'shot', hatch.id).end();
    expect(a.unit(hatch.id).alive).toBe(false);
    expect(a.has(A1, 'flameborn')).toBe(false);
  });

  it('Fireball: 20; an Ignited target Explodes', () => {
    const a = arena({ p0: [['bolt.fire'], ['blast.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.fire', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 100]);
    a.pass(3).use(A2, 'blast.fire').use(A1, 'bolt.fire', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80 - 20 - 10 - 5, 100 - 10 - 5]);
  });

  it('Inferno: Ignites all enemies', () => {
    const a = arena({ p0: [['blast.fire']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'blast.fire').end();
    expect([B1, B2, B3].every((b) => a.has(b, 'ignite'))).toBe(true);
  });

  it('Feed the Fire: 10; consumes an Ignite for 3 turns of Flameborn', () => {
    const a = arena({ p0: [['consume.fire'], ['strike.fire']], p1: [['shot']] });
    a.use(A2, 'strike.fire', B1).use(A1, 'consume.fire', B1).end();
    expect(a.has(B1, 'ignite')).toBe(false);
    expect(a.has(A1, 'flameborn')).toBe(true);
    expect(a.hp(B1)).toBe(100 - 25 - 10); // no tick: the Ignite was consumed
  });

  it('Cinderlings: two minions for 2 turns, 5 Affliction to each enemy each turn', () => {
    const a = arena({ p0: [['summon.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.fire').end();
    expect(a.state.units.filter((u) => u.defId === 'cinderling' && u.alive)).toHaveLength(2);
    expect(a.hp(B1)).toBe(90);
    a.pass(3);
    expect(a.hp(B1)).toBe(80);
    expect(a.state.units.filter((u) => u.defId === 'cinderling' && u.alive)).toHaveLength(0);
  });

  it('Flamethrower: 10 to all enemies for 3 turns; Ignited targets Explode', () => {
    const a = arena({ p0: [['channel.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.fire').end().pass(4);
    expect(a.hp(B1)).toBe(70);
    const b = arena({ p0: [['channel.fire'], ['blast.fire']], p1: [['shot']] });
    b.use(A2, 'blast.fire').use(A1, 'channel.fire').end();
    expect(b.hp(B1)).toBe(100 - 5 - 10 - 10); // Ignite tick, channel tick, Explosion
  });

  it('Searing Needle: 10, plus 10 Affliction against Ignited or Scorched targets', () => {
    const a = arena({ p0: [['stab.fire']], p1: [['shot']] });
    a.use(A1, 'stab.fire', B1).end().pass();
    expect(a.hp(B1)).toBe(90);
    a.give(B1, 'scorched').use(A1, 'stab.fire', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Pyrokinesis: 20 Affliction, doubled against Ignited or Scorched targets', () => {
    const a = arena({ p0: [['ravage.fire']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'ravage.fire', B1).end().pass(3);
    expect(a.hp(B1)).toBe(80); // Affliction ignores Shield
    a.give(B1, 'scorched').use(A1, 'ravage.fire', B1).end();
    expect(a.hp(B1)).toBe(40);
  });

  it('Heat Haze: any skill the target uses Ignites and Scorches them', () => {
    const a = arena({ p0: [['mislead.fire']], p1: [['heal']] });
    a.use(A1, 'mislead.fire', B1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B1, 'scorched')]).toEqual([true, true]);
  });

  it("Flashbang: 15 and stuns only the target's non-Strategic skills", () => {
    const a = arena({ p0: [['stun.fire']], p1: [['shot', 'curse']] });
    a.use(A1, 'stun.fire', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true);
  });

  it('Ivory Step: Immune and an Explosion', () => {
    const a = arena({ p0: [['dance.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.fire').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'immune')]).toEqual([90, 90, true]);
  });

  it('Flamethirst: target ally gains Flameborn for 2 turns', () => {
    const a = arena({ p0: [['heal.fire'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal.fire', A2).end();
    expect(a.has(A2, 'flameborn')).toBe(true);
    a.pass(3);
    expect(a.has(A2, 'flameborn')).toBe(false);
  });

  it('Burning Blood: +2 Might for the rest of the turn only', () => {
    const a = arena({ p0: [['bless.fire'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.fire', A2).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect(a.has(A2, 'might')).toBe(false);
  });

  it('Overheat Metal: 1 Weakness and 1 Vulnerable for 2 turns', () => {
    const a = arena({ p0: [['curse.fire']], p1: [['shot']] });
    a.use(A1, 'curse.fire', B1).end();
    expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable')]).toEqual([1, 1]);
  });

  it('Searing Brand: 15; 2 Weakness if the target was Ignited', () => {
    const a = arena({ p0: [['smite.fire'], ['strike.fire']], p1: [['shot']] });
    a.use(A1, 'smite.fire', B1).end();
    expect(a.has(B1, 'weakness')).toBe(false);
    a.pass(3).use(A2, 'strike.fire', B1).use(A1, 'smite.fire', B1).end();
    expect(a.stacks(B1, 'weakness')).toBe(2);
  });

  it('Searing Aegis: 10 Shield and Flameborn for all allies', () => {
    const a = arena({ p0: [['prayer.fire'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.fire').end();
    for (const u of [A1, A2]) {
      expect(a.has(u, 'flameborn')).toBe(true);
      expect(a.effects(u).find((e) => e.defId === 'shield')?.value).toBe(10);
    }
  });

  it('Blastwave: 10 to the target and a random other enemy; Ignited ones Explode', () => {
    const a = arena({ p0: [['cleave.fire'], ['strike.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.fire', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(3).use(A2, 'strike.fire', B1).use(A1, 'cleave.fire', B1).end();
    // B1: 25 + 10 + Explosion 10 + tick 5; B2: 10 + Explosion 10.
    expect([a.hp(B1), a.hp(B2)]).toEqual([90 - 50, 90 - 20]);
  });

  it('Blistering Cry: Ignites; on an Ignited target the user gains Flameborn', () => {
    const a = arena({ p0: [['shout.fire']], p1: [['shot']] });
    a.use(A1, 'shout.fire', B1).end();
    expect([a.has(B1, 'ignite'), a.has(A1, 'flameborn')]).toEqual([true, false]);
    a.pass(5).use(A1, 'shout.fire', B1).end();
    expect(a.has(A1, 'flameborn')).toBe(true);
  });

  it('Ashen Barrier: 10 Shield per active Ignite or Scorch, +10 if Flameborn', () => {
    const a = arena({ p0: [['withstand.fire']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite').give(B2, 'ignite').give(B2, 'scorched').give(A1, 'flameborn');
    a.use(A1, 'withstand.fire').end();
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(40);
  });

  it('Ring of Fire: Taunt; a Harmful skill Ignites the target, otherwise Scorch for 2 turns', () => {
    const a = arena({ p0: [['taunt.fire']], p1: [['shot']] });
    a.use(A1, 'taunt.fire', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.has(B1, 'ignite'), a.has(B1, 'scorched')]).toEqual([true, false]);
    const b = arena({ p0: [['taunt.fire']], p1: [['shot']] });
    b.use(A1, 'taunt.fire', B1).end().end();
    expect([b.has(B1, 'ignite'), b.has(B1, 'scorched')]).toEqual([false, true]);
    b.pass(3);
    expect(b.has(B1, 'scorched')).toBe(true); // covers the enemy's next 2 turns (granted after this turn's countdown)
    b.pass(1);
    expect(b.has(B1, 'scorched')).toBe(false);
  });

  it('Wraith in White: +1 Might per Ignite, +1 Armor per Scorch, Immune if Flameborn', () => {
    const a = arena({ p0: [['titan.fire']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite').give(B2, 'ignite').give(B1, 'scorched').give(A1, 'flameborn');
    a.use(A1, 'titan.fire').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([2, 1, true]);
  });
});
