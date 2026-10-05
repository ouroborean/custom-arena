// Spec tests for Mechanic (Fire + Wind): Contraptions, Upgrade and all 30 variants.
// Sources: skill/status descriptions, glossary, docs/rules.md §21.14, fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type A = ReturnType<typeof arena>;
const mins = (a: A, defId: string | RegExp, owner = 0) =>
  a.state.units.filter(
    (u) => u.owner === owner && u.alive && (typeof defId === 'string' ? u.defId === defId : defId.test(u.defId ?? '')),
  );
const turrets = (a: A, owner = 0) => mins(a, /turret/, owner);
const lvl = (a: A, id: string) => a.stacks(id, 'upgraded');
const shieldOf = (a: A, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.shield).reduce((n, e) => n + e.value, 0);

describe('Mechanic: Contraptions', () => {
  it("Turrets are Contraptions: they can't be healed or gain Renew", () => {
    const a = arena({ p0: [['charge.mechanic'], ['heal'], ['bless']], p1: [['shot']] });
    a.use(A1, 'charge.mechanic', B1).end().pass(1);
    const t = turrets(a)[0]!;
    a.setHp(t.id, 5).use(A2, 'heal', t.id).use(A3, 'bless', t.id).end();
    expect([a.hp(t.id), a.has(t.id, 'renew'), a.stacks(t.id, 'might')]).toEqual([5, false, 1]);
  });

  it('Contraptions ignore Stun and Confusion', () => {
    const a = arena({ p0: [['charge.mechanic']], p1: [['stun'], ['curse']] });
    a.use(A1, 'charge.mechanic', B1).end();
    const t = turrets(a)[0]!;
    a.use(B1, 'stun', t.id).use(B2, 'curse', t.id).end();
    expect([a.has(t.id, 'stun'), a.has(t.id, 'confusion')]).toEqual([false, false]);
  });

  it('a Turret has 20 HP and deals 10 to a random enemy at the end of each of your turns', () => {
    const a = arena({ p0: [['charge.mechanic']], p1: [['shot']] });
    a.use(A1, 'charge.mechanic', B1).end().pass(1);
    expect(turrets(a)[0]!.hp).toBe(20);
    const before = a.hp(B1);
    a.pass(1);
    expect(before - a.hp(B1)).toBe(10);
  });
});

describe('Mechanic: Upgrade', () => {
  it('+10 max HP and 10 HP, and +5 damage per level', () => {
    const a = arena({ p0: [['charge.mechanic'], ['strike.mechanic']], p1: [['shot']] });
    a.use(A1, 'charge.mechanic', B1).use(A2, 'strike.mechanic', B1).end().pass(1);
    const t = turrets(a)[0]!;
    expect([lvl(a, t.id), a.unit(t.id).maxHp]).toEqual([1, 30]);
    const before = a.hp(B1);
    a.pass(1);
    expect(before - a.hp(B1)).toBe(15);
  });

  it('caps at level 3', () => {
    const a = arena({ p0: [['companion'], ['heal.mechanic']], p1: [['shot']] });
    a.use(A1, 'companion').end().pass(1);
    const wolf = mins(a, 'wolf')[0]!;
    a.use(A2, 'heal.mechanic', wolf.id).end().pass(3).use(A2, 'heal.mechanic', wolf.id).end();
    expect([lvl(a, wolf.id), a.unit(wolf.id).maxHp]).toEqual([3, 30 + 30]);
  });

  it("characters can't be Upgraded (without a Mech Suit)", () => {
    const a = arena({ p0: [['shout.mechanic'], ['shot']], p1: [['shot']] });
    a.use(A1, 'shout.mechanic').end();
    expect([lvl(a, A1), lvl(a, A2), a.unit(A1).maxHp]).toEqual([0, 0, 100]);
  });
});

describe('Mechanic skills', () => {
  it('Piston Punch: 20 and a random allied minion is Upgraded', () => {
    const a = arena({ p0: [['strike.mechanic'], ['summon.mechanic']], p1: [['shot']] });
    a.use(A2, 'summon.mechanic').use(A1, 'strike.mechanic', B1).end();
    const ts = turrets(a);
    expect(ts.map((t) => lvl(a, t.id)).sort()).toEqual([0, 1]);
    expect(a.hp(B1)).toBeLessThanOrEqual(80);
  });

  it('Piston Punch: no minion, just the hit', () => {
    const a = arena({ p0: [['strike.mechanic']], p1: [['shot']] });
    a.use(A1, 'strike.mechanic', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Steam Hammer: 25 + 15 splash', () => {
    const a = arena({ p0: [['smash.mechanic']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.mechanic', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'ignite')]).toEqual([75, 85, false]);
  });

  it('Steam Hammer: while Rushing, it vents: Rushing ends, the splash is 30 and Ignites', () => {
    const a = arena({ p0: [['smash.mechanic']], p1: [['shot'], ['shot']] });
    a.give(A1, 'rushing').use(A1, 'smash.mechanic', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite'), a.hp(B2), a.has(B2, 'ignite'), a.has(A1, 'rushing')]).toEqual([
      75,
      false,
      100 - 30 - 5,
      true,
      false,
    ]);
  });

  it('Rocket Boots: 15; the user begins Rushing and leaves a Turret for 2 turns', () => {
    const a = arena({ p0: [['charge.mechanic']], p1: [['shot']] });
    a.use(A1, 'charge.mechanic', B1).end();
    expect([a.has(A1, 'rushing'), turrets(a)]).toEqual([true, expect.any(Array)]);
    expect(turrets(a)).toHaveLength(1);
    expect(a.hp(B1)).toBeLessThanOrEqual(85);
    a.pass(4);
    expect(turrets(a)).toHaveLength(0);
  });

  it('Spring Trap: counters only the first Harmful skill; the attacker is Isolated and the user builds a Turret', () => {
    const a = arena({ p0: [['riposte.mechanic']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.mechanic').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'isolated'), a.has(B2, 'isolated'), turrets(a).length]).toEqual([85, true, false, 1]);
    a.pass(2);
    expect(a.has(B1, 'isolated')).toBe(false);
  });

  it('Boiler Fury: 1 Might and Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.mechanic']], p1: [['curse']] });
    a.use(A1, 'rage.mechanic').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([1, true, false]);
    a.pass(4);
    expect([a.has(A1, 'might'), a.has(A1, 'immune')]).toEqual([false, false]);
  });

  it('Boiler Fury: +1 Might per Explosion their side causes, at most 3 more', () => {
    const a = arena({ p0: [['rage.mechanic'], ['dance.fire']], p1: [['shot']] });
    a.use(A1, 'rage.mechanic').use(A2, 'dance.fire').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    const b = arena({ p0: [['rage.mechanic'], ['smash.fire'], ['dance.fire']], p1: [['shot'], ['shot'], ['shot']] });
    for (const u of [B1, B2, B3]) b.give(u, 'ignite', { source: B1 });
    b.use(A1, 'rage.mechanic').use(A2, 'smash.fire', B1).use(A3, 'dance.fire').end(); // 4 Explosions
    expect(b.stacks(A1, 'might')).toBe(4);
  });

  it('Rivet Gun: if an allied minion damaged the target last, that minion is Upgraded', () => {
    const a = arena({ p0: [['shot.mechanic'], ['summon.mechanic']], p1: [['shot']] });
    a.use(A2, 'summon.mechanic').end().pass(1);
    a.use(A1, 'shot.mechanic', B1).end();
    expect(turrets(a).map((t) => lvl(a, t.id)).sort()).toEqual([0, 1]);
  });

  it('Rivet Gun: a character hit last means no Upgrade', () => {
    const a = arena({ p0: [['shot.mechanic'], ['summon.mechanic', 'shot']], p1: [['shot']] });
    a.use(A2, 'summon.mechanic').end().pass(1);
    a.use(A2, 'shot', B1).use(A1, 'shot.mechanic', B1).end();
    expect(turrets(a).map((t) => lvl(a, t.id))).toEqual([0, 0]);
  });

  it('Mortar: builds a 20 HP Mortar (Contraption); next turn it fires 25 Piercing at all enemies', () => {
    const a = arena({ p0: [['snipe.mechanic']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'snipe.mechanic').end();
    const m = mins(a, 'mortar')[0]!;
    expect([m.hp, a.has(m.id, 'contraption'), a.hp(B1)]).toEqual([20, true, 100]);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
  });

  it('Mortar: destroyed before it fires, nothing happens', () => {
    const a = arena({ p0: [['snipe.mechanic']], p1: [['strike'], ['shot']] });
    a.use(A1, 'snipe.mechanic').end();
    const m = mins(a, 'mortar')[0]!;
    a.use(B1, 'strike', m.id).end();
    expect([a.unit(m.id).alive, a.hp(B1), a.hp(B2)]).toEqual([false, 100, 100]);
  });

  it("Tripwire: the target's first skill Ignites them; after that each skill ticks the Ignite", () => {
    const a = arena({ p0: [['trap.mechanic']], p1: [['shot']] });
    a.use(A1, 'trap.mechanic', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).end();
    expect([a.has(B1, 'ignite'), a.hp(B1)]).toEqual([true, 100]);
    a.end(); // the Ignite's own tick at the end of A1's turn
    expect(a.hp(B1)).toBe(95);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Clockwork Hound: 30 HP Contraption, permanent; 10 to a random enemy each turn; Upgrades itself every other turn', () => {
    const a = arena({ p0: [['companion.mechanic']], p1: [['shot']], hp: 1000 });
    a.use(A1, 'companion.mechanic').end();
    const h = mins(a, 'clockwork_hound')[0]!;
    expect(a.has(h.id, 'contraption')).toBe(true);
    a.pass(1);
    expect(a.unit(h.id).maxHp).toBe(30 + 10 * lvl(a, h.id));
    const l1 = lvl(a, h.id);
    a.pass(4); // two more of the owner's turns
    expect(lvl(a, h.id)).toBe(l1 + 1);
    a.pass(10);
    expect([a.unit(h.id).alive, lvl(a, h.id)]).toEqual([true, 3]);
  });

  it('Grapnel Shot: 20 and Mark for 1 turn', () => {
    const a = arena({ p0: [['bolt.mechanic']], p1: [['shot']] });
    a.use(A1, 'bolt.mechanic', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([80, true]);
  });

  it("Grapnel Shot: until the end of their next turn they can't gain Invulnerable; after that they can", () => {
    const a = arena({ p0: [['bolt.mechanic'], ['shot']], p1: [['maneuver']] });
    a.use(A1, 'bolt.mechanic', B1).end().use(B1, 'maneuver').end();
    expect(a.has(B1, 'invulnerable')).toBe(false);
    a.use(A2, 'shot', B1).end().pass(6).use(B1, 'maneuver').end();
    expect(a.has(B1, 'invulnerable')).toBe(true);
  });

  it('Pressure Cascade: 20 to all, +10 per ally who used a skill earlier this turn', () => {
    const a = arena({ p0: [['blast.mechanic'], ['shot'], ['heal']], p1: [['shot'], ['shot']] });
    a.use(A2, 'shot', B1).use(A3, 'heal', A3).use(A1, 'blast.mechanic').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100 - 15 - 40, 60]);
    const b = arena({ p0: [['blast.mechanic'], ['shot']], p1: [['shot'], ['shot']] });
    b.use(A1, 'blast.mechanic').use(A2, 'shot', B1).end(); // the ally acts after: no bonus
    expect([b.hp(B1), b.hp(B2)]).toEqual([100 - 20 - 15, 80]);
  });

  it('Refuel: 10 and heals as much; all Swiftness burns for 10 more healing each', () => {
    const a = arena({ p0: [['consume.mechanic']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'swiftness', { stacks: 2 }).use(A1, 'consume.mechanic', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(A1, 'swiftness')]).toEqual([90, 80, false]);
  });

  it('Turret Drop: two Turrets for 3 turns', () => {
    const a = arena({ p0: [['summon.mechanic']], p1: [['shot']] });
    a.use(A1, 'summon.mechanic').end();
    expect(turrets(a).map((t) => t.hp)).toEqual([20, 20]);
    a.pass(5);
    expect(turrets(a)).toHaveLength(0);
  });

  it('Turret Drop: when one is destroyed, the other is Upgraded', () => {
    const a = arena({ p0: [['summon.mechanic']], p1: [['shot']] });
    a.use(A1, 'summon.mechanic').end();
    const [t1, t2] = turrets(a);
    a.setHp(t1!.id, 5).use(B1, 'shot', t1!.id).end();
    expect([a.unit(t1!.id).alive, lvl(a, t2!.id), a.unit(t2!.id).maxHp]).toEqual([false, 1, 30]);
  });

  it('Assembly Line: with no minion, builds a Turret; then Upgrades a random allied minion each turn', () => {
    const a = arena({ p0: [['channel.mechanic']], p1: [['shot']] });
    a.use(A1, 'channel.mechanic').end();
    expect(turrets(a)).toHaveLength(1);
    a.pass(2);
    expect([turrets(a).length, lvl(a, turrets(a)[0]!.id)]).toEqual([1, 1]);
    a.pass(2);
    expect(lvl(a, turrets(a)[0]!.id)).toBe(2);
    a.pass(2);
    expect(lvl(a, turrets(a)[0]!.id)).toBe(2); // 3 turns only
  });

  it('Dummy Bomb: a Harmful skill is countered and a 15 HP Dummy is built', () => {
    const a = arena({ p0: [['mislead.mechanic'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.mechanic', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'shot', A2).end();
    const d = mins(a, 'dummy')[0]!;
    expect([a.hp(A2), d.hp, a.has(d.id, 'contraption')]).toEqual([100, 15, true]);
  });

  it('Dummy Bomb: when the Dummy is destroyed, it Explodes', () => {
    const a = arena({ p0: [['mislead.mechanic'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.mechanic', B1).end().use(B1, 'shot', A2).end().pass(1);
    const d = mins(a, 'dummy')[0]!;
    a.use(B1, 'shot', d.id).end();
    expect([a.unit(d.id).alive, a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([false, 90, 90, 100]);
  });

  it('Concussion Grenade: lands at the start of the user’s next turn: 15 and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.mechanic']], p1: [['shot']] });
    a.use(A1, 'stun.mechanic', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([85, true]);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Concussion Grenade: a mobility skill in between dodges it', () => {
    const a = arena({ p0: [['stun.mechanic']], p1: [['charge']] });
    a.use(A1, 'stun.mechanic', B1).end().use(B1, 'charge', A1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([100, false]);
  });

  it('Repair Kit: heals a character 20', () => {
    const a = arena({ p0: [['heal.mechanic'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.mechanic', A2).end();
    expect([a.hp(A2), lvl(a, A2)]).toEqual([70, 0]);
  });

  it('Repair Kit: an allied minion is instead Upgraded twice', () => {
    const a = arena({ p0: [['heal.mechanic'], ['companion']], p1: [['shot']] });
    a.use(A2, 'companion').end().pass(1);
    const wolf = mins(a, 'wolf')[0]!;
    a.setHp(wolf.id, 10).use(A1, 'heal.mechanic', wolf.id).end();
    expect([lvl(a, wolf.id), a.unit(wolf.id).maxHp, a.hp(wolf.id)]).toEqual([2, 50, 30]);
  });

  it('Repair Kit: a Contraption is Repaired for 20 first, then Upgraded twice', () => {
    const a = arena({ p0: [['heal.mechanic'], ['summon.mechanic']], p1: [['shot']] });
    a.use(A2, 'summon.mechanic').end().pass(1);
    const t = turrets(a)[0]!;
    a.setHp(t.id, 5).use(A1, 'heal.mechanic', t.id).end();
    expect([lvl(a, t.id), a.unit(t.id).maxHp]).toEqual([2, 40]);
    expect(a.hp(t.id)).toBe(40); // 5 → 20 (repaired, capped at 20) → +10 per level
  });

  it('Tune-Up: 1 Might for 3 turns; damaging skills keep the Leap, taking damage ends it', () => {
    const a = arena({ p0: [['bless.mechanic'], ['shot']], p1: [['shot']] });
    a.give(A2, 'leaping').use(A1, 'bless.mechanic', A2).use(A2, 'shot', B1).end();
    expect([a.stacks(A2, 'might'), a.has(A2, 'leaping'), a.hp(B1)]).toEqual([1, true, 100 - 15 - 5 - 5]);
    a.use(B1, 'shot', A2).end();
    expect(a.has(A2, 'leaping')).toBe(false);
  });

  it('Sabotage: Confused for 2 turns; a mobility skill backfires: countered and Stunned for 1 turn', () => {
    const a = arena({ p0: [['curse.mechanic']], p1: [['charge', 'shot']] });
    a.use(A1, 'curse.mechanic', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
    a.use(B1, 'charge', A1).end();
    expect([a.hp(A1), a.has(B1, 'stun')]).toEqual([100, true]);
  });

  it('Sabotage: non-mobility skills are unaffected', () => {
    const a = arena({ p0: [['curse.mechanic']], p1: [['charge', 'shot']] });
    a.use(A1, 'curse.mechanic', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'stun')]).toEqual([85, false]);
  });

  it('Signal Flare: 20; for 1 turn each allied minion that damages them is Upgraded', () => {
    const a = arena({ p0: [['smite.mechanic'], ['summon.mechanic']], p1: [['shot']] });
    a.use(A2, 'summon.mechanic').end().pass(1);
    expect(turrets(a).map((t) => lvl(a, t.id))).toEqual([0, 0]); // they hit B1 last turn, no Flare
    a.use(A1, 'smite.mechanic', B1).end();
    expect(turrets(a).map((t) => lvl(a, t.id))).toEqual([1, 1]);
    a.pass(2);
    expect(turrets(a).map((t) => lvl(a, t.id))).toEqual([1, 1]); // over after 1 turn
  });

  it('Field Workshop: allies heal 20; each at or below half HP afterwards gets a Turret for 2 turns', () => {
    const a = arena({ p0: [['prayer.mechanic'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 20).setHp(A2, 60).use(A1, 'prayer.mechanic').end();
    expect([a.hp(A1), a.hp(A2), turrets(a).length]).toEqual([40, 80, 1]);
    a.pass(4);
    expect(turrets(a)).toHaveLength(0);
  });

  it('Red-Hot Blades: 25 + 15; the user is Ignited and deals 5 more direct damage while Ignited', () => {
    const a = arena({ p0: [['cleave.mechanic', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.mechanic', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'ignite')]).toEqual([75, 85, true]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75 - 20);
  });

  it('Red-Hot Blades: the bonus ends with the Ignite', () => {
    const a = arena({ p0: [['cleave.mechanic', 'shot', 'rage.wind']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.mechanic', B1).end().pass(1);
    a.use(A1, 'rage.wind').end().pass(1); // Chainbreaker cleanses the Ignite
    expect(a.has(A1, 'ignite')).toBe(false);
    a.use(A1, 'shot', B2).end();
    expect(a.hp(B2)).toBe(85 - 15);
  });

  it('Steam Whistle: enemies Intimidated for 2 turns; allied minions Upgraded, losing the level after 2 turns', () => {
    const a = arena({ p0: [['shout.mechanic'], ['summon.mechanic']], p1: [['shot'], ['shot']] });
    a.use(A2, 'summon.mechanic').use(A1, 'shout.mechanic').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    expect(turrets(a).map((t) => lvl(a, t.id))).toEqual([1, 1]);
    a.pass(4);
    expect(turrets(a).map((t) => lvl(a, t.id))).toEqual([0, 0]);
  });

  it('Steam Whistle: a level-3 minion is not Upgraded and loses nothing', () => {
    const a = arena({ p0: [['shout.mechanic'], ['companion']], p1: [['shot']] });
    a.use(A2, 'companion').end().pass(1);
    const wolf = mins(a, 'wolf')[0]!;
    a.give(wolf.id, 'upgraded', { stacks: 3 }).use(A1, 'shout.mechanic').end().pass(4);
    expect(lvl(a, wolf.id)).toBe(3);
  });

  it('Blast Shield: 25 Shield for 1 turn; with 10+ left when it ends, a Turret for 2 turns', () => {
    const a = arena({ p0: [['withstand.mechanic']], p1: [['shot']] });
    a.use(A1, 'withstand.mechanic').end();
    expect(shieldOf(a, A1)).toBe(25);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), turrets(a).length]).toEqual([100, 1]);
  });

  it('Blast Shield: under 10 left, no Turret', () => {
    const a = arena({ p0: [['withstand.mechanic']], p1: [['strike']] });
    a.use(A1, 'withstand.mechanic').end().use(B1, 'strike', A1).end();
    expect(turrets(a)).toHaveLength(0);
  });

  it('Scarecrow Bot: a 20 HP Decoy; an Immobile target is Taunted by it for 3 turns', () => {
    const a = arena({ p0: [['taunt.mechanic'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.mechanic', B1).end();
    const d = mins(a, 'decoy')[0]!;
    expect([d.hp, a.has(d.id, 'contraption')]).toEqual([20, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(4);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Scarecrow Bot: a mobile target is Taunted for 2 turns', () => {
    const a = arena({ p0: [['taunt.mechanic'], ['shot']], p1: [['shot', 'charge']] });
    a.use(A1, 'taunt.mechanic', B1).end().pass(4);
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

});

describe('Mechanic skills: evolutions', () => {
  it("Jetpack: Invulnerable for 2 turns, but the user can't use skills on their next turn", () => {
    const a = arena({ p0: [['maneuver.mechanic', 'shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.mechanic').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end(); // turn 3
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBe('cannot_act');
    a.end(); // turn 4: still Invulnerable
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end(); // turn 5
    a.use(A1, 'shot', B1);
  });

  it('Jetpack: when the flight ends, the user comes down with an Explosion', () => {
    const a = arena({ p0: [['maneuver.mechanic']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.mechanic').end().pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 100]);
    a.end(); // the end of turn 4: it lands
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'invulnerable')]).toEqual([90, 90, false]);
  });

  it('Drill Bit: no cost, usable while Stunned; 10 damage, 5 more for each earlier Drill Bit in them', () => {
    const a = arena({ p0: [['stab.mechanic'], ['stab.mechanic']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stun', { source: B1 });
    a.use(A1, 'stab.mechanic', B1).use(A2, 'stab.mechanic', B1).end();
    expect(a.hp(B1)).toBe(100 - 10 - 15);
    expect(Object.values(content.skills['stab.mechanic']!.cost ?? {}).reduce((n, v) => n + Number(v), 0)).toBe(0);
    a.pass(3).use(A1, 'stab.mechanic', B2).end();
    expect(a.hp(B2)).toBe(90); // the hole is in B1, not B2
  });

  it('Drill Bit: up to 10 more', () => {
    const a = arena({ p0: [['stab.mechanic'], ['stab.mechanic'], ['stab.mechanic']], p1: [['shot']], hp: 300 });
    a.use(A1, 'stab.mechanic', B1).use(A2, 'stab.mechanic', B1).use(A3, 'stab.mechanic', B1).end();
    expect(a.hp(B1)).toBe(300 - 10 - 15 - 20);
    a.pass(3).use(A1, 'stab.mechanic', B1).use(A2, 'stab.mechanic', B1).use(A3, 'stab.mechanic', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'drill_hole')]).toEqual([255 - 20 - 20 - 20, 2]);
  });

  it("Chainsaw: Piercing damage equal to a third of the target's current HP, at most 25", () => {
    const a = arena({ p0: [['ravage.mechanic']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.mechanic', B1).end();
    expect([a.hp(B1), a.has(B1, 'chainsaw')]).toEqual([75, false]); // a third of 100 is 33: 25, Armor or not
    const b = arena({ p0: [['ravage.mechanic']], p1: [['shot']] });
    b.setHp(B1, 60).use(A1, 'ravage.mechanic', B1).end();
    expect(b.hp(B1)).toBe(40);
    const c = arena({ p0: [['ravage.mechanic']], p1: [['shot']] });
    c.setHp(B1, 50).use(A1, 'ravage.mechanic', B1).end();
    expect(c.hp(B1)).toBe(34); // 16, rounded down
  });

  it('Chainsaw: at least 10', () => {
    const a = arena({ p0: [['ravage.mechanic']], p1: [['shot']] });
    a.setHp(B1, 24).use(A1, 'ravage.mechanic', B1).end();
    expect(a.hp(B1)).toBe(14);
  });

  it("Overclock: 1 Might for 3 turns; at the end of each of the user's turns, cooldowns tick 1 extra and the engine burns them 5", () => {
    const a = arena({ p0: [['dance.mechanic']], p1: [['shot']] });
    a.use(A1, 'dance.mechanic').end();
    expect([a.stacks(A1, 'might'), a.hp(A1), a.cooldown(A1, 'dance.mechanic')]).toEqual([1, 95, 4]); // 6 − 2
    a.pass(4); // turns 3 and 5 tick twice too
    expect([a.hp(A1), a.cooldown(A1, 'dance.mechanic')]).toEqual([85, 0]);
    a.pass(2);
    expect([a.stacks(A1, 'might'), a.hp(A1), a.has(A1, 'overclock')]).toEqual([0, 85, false]);
  });

  it('Mech Suit: Immune, and Upgraded at once (the user counts as a Contraption); ignores Stuns', () => {
    const a = arena({ p0: [['titan.mechanic']], p1: [['stun'], ['curse']] });
    a.use(A1, 'titan.mechanic').end();
    expect([a.has(A1, 'immune'), lvl(a, A1), a.unit(A1).maxHp, a.hp(A1)]).toEqual([true, 1, 110, 110]);
    a.use(B1, 'stun', A1).use(B2, 'curse', A1).end();
    expect([a.has(A1, 'stun'), a.has(A1, 'confusion')]).toEqual([false, false]);
    expect([lvl(a, A1), a.unit(A1).maxHp, a.hp(A1)]).toEqual([2, 120, 105]); // 15 taken, then Upgraded as turn 3 starts
  });

  it("Mech Suit: the user can't be healed in the suit", () => {
    const a = arena({ p0: [['titan.mechanic'], ['heal']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'titan.mechanic').use(A2, 'heal', A1).end();
    expect(a.hp(A1)).toBe(60); // only the Upgrade's 10
  });

  it('Mech Suit: Upgraded at the start of each turn up to level 3; when the suit comes off, so do its Upgrades', () => {
    const a = arena({ p0: [['titan.mechanic']], p1: [['shot']] });
    a.use(A1, 'titan.mechanic').end().pass(3); // turn 5 has started
    expect([lvl(a, A1), a.unit(A1).maxHp, a.hp(A1)]).toEqual([3, 130, 130]);
    a.pass(2); // the suit comes off as turn 6 ends
    expect([lvl(a, A1), a.unit(A1).maxHp, a.hp(A1), a.has(A1, 'mech_suit')]).toEqual([0, 100, 100, false]);
  });
});

describe('Mechanic costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0],
    smash: ['Sr', 2],
    charge: ['r', 2],
    riposte: ['r', 2],
    rage: ['A', 4],
    shot: ['r', 1],
    snipe: ['Ar', 2],
    trap: ['S', 3],
    maneuver: ['r', 3],
    companion: ['I', 1],
    bolt: ['I', 1],
    blast: ['Ar', 2],
    consume: ['r', 2],
    summon: ['r', 2],
    channel: ['SI', 3],
    stab: ['', 1],
    ravage: ['A', 1],
    mislead: ['A', 2],
    stun: ['S', 1],
    dance: ['AA', 5],
    heal: ['A', 1],
    bless: ['S', 2],
    curse: ['W', 2],
    smite: ['Wr', 1],
    prayer: ['Wrr', 2],
    cleave: ['Ar', 1],
    shout: ['S', 2],
    withstand: ['r', 3],
    taunt: ['r', 3],
    titan: ['SW', 4],
  };
  const norm = (c: unknown) => {
    if (typeof c === 'string') return c.split('').sort().join('');
    return Object.entries((c ?? {}) as Record<string, number>)
      .flatMap(([k, n]) => Array<string>(n).fill(k))
      .sort()
      .join('');
  };
  it.each(Object.entries(kit))('%s.mechanic matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.mechanic`]!;
    expect([norm(s.cost), s.cooldown]).toEqual([norm(cost), cd]);
  });
});
