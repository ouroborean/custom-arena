// Spec tests for Brimstone (Fire + Poison): Sulfur / Erupt and all 30 variants.
// Sources: skill/status descriptions, docs/rules.md §21.15, fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Erupt: 10 Affliction per Sulfur to the bearer, 5 per Sulfur to each allied character of theirs, then the
// stacks become Toxin. It's set off by Ignite damage or an Explosion hitting the bearer.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition, viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type A = ReturnType<typeof arena>;
const isPrey = (a: A, id: string) => evaluateNamedCondition(content, a.state, 'prey', id);
const sulfur = (a: A, id: string) => a.stacks(id, 'sulfur');
const toxin = (a: A, id: string) => a.stacks(id, 'toxin');
const shieldOf = (a: A, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.shield).reduce((n, e) => n + e.value, 0);
const energy = (a: A, p: 0 | 1) => Object.values(a.state.players[p].energy).reduce((n, v) => n + v, 0);

describe('Brimstone: Sulfur and Eruptions', () => {
  it('an Explosion makes Sulfur Erupt: 10 per stack to the bearer, 5 per stack to their allies, stacks become Toxin', () => {
    const a = arena({ p0: [['dance.fire']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 2, source: A1 }).use(A1, 'dance.fire').end();
    expect([sulfur(a, B1), toxin(a, B1)]).toEqual([0, 2]);
    expect(a.hp(B2)).toBe(100 - 10 - 10);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 10 - 20);
  });

  it('Ignite damage makes Sulfur Erupt', () => {
    const a = arena({ p0: [['strike.fire']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 2, source: A1 }).use(A1, 'strike.fire', B1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 2, 90]);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 25 - 5 - 20);
  });

  it('Sulfur does nothing on its own, and other damage does not set it off', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 3, source: A1 }).pass(4).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2), sulfur(a, B1)]).toEqual([85, 100, 3]);
  });

  it('Sulfur caps at 4', () => {
    const a = arena({ p0: [['shout.brimstone'], ['shout.brimstone'], ['shout.brimstone']], p1: [['shot']] });
    a.use(A1, 'shout.brimstone').use(A2, 'shout.brimstone').use(A3, 'shout.brimstone').end().pass(3);
    a.use(A1, 'shout.brimstone').use(A2, 'shout.brimstone').end();
    expect(sulfur(a, B1)).toBe(4);
  });

  it('the splash hits allied characters only, not minions', () => {
    const a = arena({ p0: [['dance.fire']], p1: [['companion'], ['shot']] });
    a.pass(1).use(B1, 'companion').end();
    const wolf = a.state.units.find((u) => u.owner === 1 && u.defId === 'wolf')!;
    a.give(B1, 'sulfur', { stacks: 2, source: A1 }).use(A1, 'dance.fire').end();
    expect(a.hp(wolf.id)).toBe(30 - 10); // the Explosion only
    expect(a.hp(B2)).toBe(100 - 10 - 10);
  });
});

describe('Brimstone skills', () => {
  it('Fuming Blow: 20 and 1 Sulfur', () => {
    const a = arena({ p0: [['strike.brimstone']], p1: [['shot']] });
    a.use(A1, 'strike.brimstone', B1).end();
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([80, 1]);
  });

  it('Fuming Blow: reaching 4 Sulfur Erupts at once', () => {
    const a = arena({ p0: [['strike.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 3, source: A1 }).use(A1, 'strike.brimstone', B1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 4, 80]);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 20 - 40);
  });

  it('Brimquake: 25 + 15; for 2 turns Explosions deal 10 more to each enemy it hit', () => {
    const a = arena({ p0: [['smash.brimstone'], ['dance.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.brimstone', B1).use(A2, 'dance.fire').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100 - 25 - 20, 100 - 15 - 20]);
    a.pass(5).use(A2, 'dance.fire').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([45, 55]); // over after 2 turns
  });

  it('Choking Lunge: 10 and 1 Focus for the next skill', () => {
    const a = arena({ p0: [['charge.brimstone', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.brimstone', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'focus')]).toEqual([90, 1]);
    a.pass(1).use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
  });

  it("Choking Lunge: until the user's next turn, the target's Toxin also ticks at the start of their turn", () => {
    const a = arena({ p0: [['charge.brimstone']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: A1 }).use(A1, 'charge.brimstone', B1).end();
    expect(a.hp(B1)).toBe(100 - 10 - 10 - 10); // end of A's turn, then the start of B's
    a.end().end();
    expect(a.hp(B1)).toBe(70 - 10); // only the normal tick: the extra one is over
  });

  it('Brimstone Hide: counters every Harmful skill on the user; attackers gain 2 Sulfur', () => {
    const a = arena({ p0: [['riposte.brimstone']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.brimstone').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), sulfur(a, B1), sulfur(a, B2)]).toEqual([100, 2, 2]);
  });

  it('Brimstone Hide: an Ignited attacker Erupts at once and the user heals as much as it deals them', () => {
    const a = arena({ p0: [['riposte.brimstone']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).give(B1, 'ignite', { source: B1 }).use(A1, 'riposte.brimstone').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), toxin(a, B1)]).toEqual([100 - 20 - 5, 90, 70, 2]);
  });

  it('Scent of Cinders: 1 Might and Immune for 3 turns; Ignited or Scorched enemies count as Prey', () => {
    const a = arena({ p0: [['rage.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'scorched', { source: A1 });
    expect(isPrey(a, B1)).toBe(false);
    a.use(A1, 'rage.brimstone').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune'), isPrey(a, B1), isPrey(a, B2)]).toEqual([1, true, true, false]);
    a.pass(6);
    expect([a.has(A1, 'might'), isPrey(a, B1)]).toEqual([false, false]);
  });

  it('Sulfur Sting: 5 Piercing and 1 Sulfur', () => {
    const a = arena({ p0: [['shot.brimstone']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'shot.brimstone', B1).end();
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([95, 1]);
  });

  it('Sulfur Sting: against Prey, their Sulfur Erupts', () => {
    const a = arena({ p0: [['shot.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'prey', { source: A1 }).give(B1, 'sulfur', { stacks: 1, source: A1 });
    a.use(A1, 'shot.brimstone', B1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 2, 90]);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 5 - 20);
  });

  it('Pitch Javelin: next turn, 25 Affliction and 2 Sulfur; hidden target', () => {
    const a = arena({ p0: [['snipe.brimstone']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'snipe.brimstone', B1).end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === A1).every((e) => e.targets.length === 0)).toBe(true);
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([75, 2]);
  });

  it('Pitch Javelin: the next Eruption is doubled (bearer and splash), only the next', () => {
    const a = arena({ p0: [['snipe.brimstone'], ['dance.fire']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.brimstone', B1).end().end();
    a.use(A2, 'dance.fire').end();
    expect(a.hp(B1)).toBeLessThanOrEqual(75 - 10 - 40);
    expect(a.hp(B2)).toBe(100 - 10 - 20);
  });

  it('Pitch Javelin: Uncounterable', () => {
    const a = arena({ p0: [['snipe.brimstone']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'snipe.brimstone', B1).end().end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 75]);
  });

  it('Brimstone Pit: each Strategic skill gives 1 Sulfur; the first damaging skill makes it Erupt', () => {
    const a = arena({ p0: [['trap.brimstone']], p1: [['curse', 'shot'], ['shot']] });
    a.use(A1, 'trap.brimstone', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'curse', A1).end();
    expect(sulfur(a, B1)).toBe(1);
    a.end().use(B1, 'shot', A1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 1, 95]);
  });

  it('Choking Pall: Unstunnable; Invulnerable for 1 turn, and every other unit is Blinded for 1 turn', () => {
    const a = arena({ p0: [['maneuver.brimstone'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stun', { source: B1 }).use(A1, 'maneuver.brimstone').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'blinded')]).toEqual([true, false]);
    expect([A2, B1, B2].map((u) => a.has(u, 'blinded'))).toEqual([true, true, true]);
    a.pass(2);
    expect([A2, B1, B2].some((u) => a.has(u, 'blinded'))).toBe(false);
  });

  it('Belching Toad: 30 HP, permanent; moves a Debuff from an ally onto an enemy each turn', () => {
    const a = arena({ p0: [['companion.brimstone']], p1: [['shot']] });
    a.give(A1, 'weakness', { source: B1 }).use(A1, 'companion.brimstone').end().pass(2);
    const toad = a.state.units.find((u) => u.owner === 0 && u.defId === 'belching_toad')!;
    expect(toad.hp).toBe(30);
    expect([a.has(A1, 'weakness'), a.has(B1, 'weakness')]).toEqual([false, true]);
    a.pass(10);
    expect(a.unit(toad.id).alive).toBe(true);
  });

  it('Acrid Orb: 20 and Mark for 1 turn; Prey until the Mark is spent', () => {
    const a = arena({ p0: [['bolt.brimstone'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.brimstone', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), isPrey(a, B1)]).toEqual([80, true, true]);
    a.end().use(A2, 'shot', B1).end();
    expect(isPrey(a, B1)).toBe(false);
  });

  it('Acrid Orb: spending the Mark ends the Prey', () => {
    const a = arena({ p0: [['bolt.brimstone'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.brimstone', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), isPrey(a, B1)]).toEqual([80 - 25, false, false]);
  });

  it("Burning Downpour: 15 to all; each one's Ignite ticks once per 2 Toxin (max 3)", () => {
    const a = arena({ p0: [['blast.brimstone']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B1 }).give(B1, 'toxin', { stacks: 4, source: B1 });
    a.give(B2, 'ignite', { source: B2 }).give(B2, 'toxin', { stacks: 9, source: B2 });
    a.give(B3, 'toxin', { stacks: 4, source: B3 });
    a.use(A1, 'blast.brimstone').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([100 - 15 - 10, 100 - 15 - 15, 85]);
  });

  it('Burning Downpour: those extra ticks set off Sulfur', () => {
    const a = arena({ p0: [['blast.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B1 }).give(B1, 'toxin', { stacks: 2, source: B1 }).give(B1, 'sulfur', { stacks: 1, source: A1 });
    a.use(A1, 'blast.brimstone').end();
    expect([sulfur(a, B1), a.hp(B2)]).toEqual([0, 100 - 15 - 5]);
  });

  it('Consumed by Fire: their Sulfur Erupts; below 15 HP afterwards they are executed', () => {
    const a = arena({ p0: [['consume.brimstone']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 40).give(B1, 'sulfur', { stacks: 3, source: A1 }).use(A1, 'consume.brimstone', B1).end();
    expect([a.unit(B1).alive, a.hp(B2)]).toEqual([false, 85]);
    const b = arena({ p0: [['consume.brimstone']], p1: [['shot'], ['shot']] });
    b.setHp(B1, 60).give(B1, 'sulfur', { stacks: 3, source: A1 }).use(A1, 'consume.brimstone', B1).end();
    expect([b.unit(B1).alive, b.hp(B1) <= 30, b.hp(B1) >= 15]).toEqual([true, true, true]);
  });

  it('Consumed by Fire: minions are executed below 30 HP', () => {
    const a = arena({ p0: [['consume.brimstone']], p1: [['companion'], ['shot']] });
    a.pass(1).use(B1, 'companion').end();
    const wolf = a.state.units.find((u) => u.owner === 1 && u.defId === 'wolf')!;
    a.setHp(wolf.id, 29).use(A1, 'consume.brimstone', wolf.id).end();
    expect(a.unit(wolf.id).alive).toBe(false);
  });

  it('Stokers: two 10 HP Stokers for 2 turns; each turn they Ignite an enemy with Sulfur', () => {
    const a = arena({ p0: [['summon.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 1, source: A1 }).use(A1, 'summon.brimstone').end();
    const st = a.state.units.filter((u) => u.owner === 0 && u.defId === 'stoker');
    expect(st.map((s) => s.hp)).toEqual([10, 10]);
    a.pass(1);
    expect(a.has(B1, 'ignite')).toBe(true);
    a.pass(4);
    expect(a.state.units.filter((u) => u.owner === 0 && u.defId === 'stoker' && u.alive)).toHaveLength(0);
  });

  it('Hellmouth: 5 Affliction to all enemies and 1 Sulfur to a random one each turn', () => {
    const a = arena({ p0: [['channel.brimstone', 'heal']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'channel.brimstone').end();
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([95, 1]);
    a.pass(2);
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([90, 2]);
  });

  it("Hellmouth: when it's broken, every enemy's Sulfur Erupts", () => {
    const a = arena({ p0: [['channel.brimstone', 'heal']], p1: [['shot'], ['shot']] });
    a.give(B2, 'sulfur', { stacks: 1, source: A1 });
    a.use(A1, 'channel.brimstone').end().pass(1);
    const before = [sulfur(a, B1), sulfur(a, B2)];
    expect(before[0]! + before[1]!).toBe(2);
    a.use(A1, 'heal', A1).end(); // using another skill ends the channel
    expect([sulfur(a, B1), sulfur(a, B2)]).toEqual([0, 0]);
    expect([toxin(a, B1), toxin(a, B2)]).toEqual(before);
  });

  it('Hellmouth: lasts up to 8 turns, then Erupts everything', () => {
    const a = arena({ p0: [['channel.brimstone']], p1: [['shot']], hp: 500 });
    a.use(A1, 'channel.brimstone').end().pass(13);
    expect(sulfur(a, B1)).toBe(4);
    a.pass(2);
    expect(sulfur(a, B1)).toBe(0);
    expect(toxin(a, B1)).toBeGreaterThan(0);
  });

  it('Strike the Match: 5 Piercing and Ignite', () => {
    const a = arena({ p0: [['stab.brimstone']], p1: [['shot']] });
    const e0 = energy(a, 0);
    a.use(A1, 'stab.brimstone', B1).end();
    expect([a.has(B1, 'ignite'), a.hp(B1), energy(a, 0)]).toEqual([true, 90, e0 - 1]);
  });

  it('Strike the Match: with Sulfur for the Ignite to set off, the user gains 1 random energy', () => {
    const a = arena({ p0: [['stab.brimstone']], p1: [['shot']] });
    const e0 = energy(a, 0);
    a.give(B1, 'sulfur', { stacks: 1, source: A1 }).use(A1, 'stab.brimstone', B1).end();
    expect(energy(a, 0)).toBe(e0);
  });

  it('Caustic Flame: 20 Affliction +10 per Toxin, then the Toxin is burned away', () => {
    const a = arena({ p0: [['ravage.brimstone']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 3, source: B1 }).give(B1, 'shield', { value: 100 });
    a.use(A1, 'ravage.brimstone', B1).end();
    expect([a.hp(B1), toxin(a, B1)]).toEqual([50, 0]);
  });

  it('Choking Fumes: a Harmful skill is countered and its user gains 1 Sulfur per energy it cost', () => {
    const a = arena({ p0: [['mislead.brimstone']], p1: [['smash']] });
    a.use(A1, 'mislead.brimstone', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'smash', A1).end();
    expect([a.hp(A1), sulfur(a, B1)]).toEqual([100, 2]);
  });

  it('Choking Fumes: Helpful skills are not countered', () => {
    const a = arena({ p0: [['mislead.brimstone']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'mislead.brimstone', B1).end().use(B1, 'heal', B1).end();
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([75, 0]);
  });

  it('Asphyxiate: 10 and a 1-turn Stun that Swiftness and Immune do not stop; Bypass', () => {
    const a = arena({ p0: [['stun.brimstone']], p1: [['shot']] });
    a.give(B1, 'swiftness').give(B1, 'immune').give(B1, 'invulnerable');
    a.use(A1, 'stun.brimstone', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'swiftness')]).toEqual([90, 1]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Asphyxiate: Unstunnable skills are stopped too', () => {
    const a = arena({ p0: [['stun.brimstone']], p1: [['maneuver.brimstone']] });
    a.use(A1, 'stun.brimstone', B1).end();
    expect(a.reject(() => a.use(B1, 'maneuver.brimstone'))).toBe('cannot_act');
  });

  it('Sulfur Dance: Immune for 1 turn and Explodes; every enemy with Sulfur Erupts', () => {
    const a = arena({ p0: [['dance.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 2, source: A1 }).use(A1, 'dance.brimstone').end();
    expect([a.has(A1, 'immune'), sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([true, 0, 2, 100 - 10 - 10]);
    a.pass(2);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Sulfur Tonic: heals 20; the Toxin is drawn off and an enemy gains that much Sulfur', () => {
    const a = arena({ p0: [['heal.brimstone'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'toxin', { stacks: 3, source: B1 }).use(A1, 'heal.brimstone', A2).end();
    expect([a.hp(A2), toxin(a, A2), sulfur(a, B1)]).toEqual([70, 0, 3]);
  });

  it('Brimfire Crest: 1 Might and Flameborn for 3 turns', () => {
    const a = arena({ p0: [['bless.brimstone'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.brimstone', A2).end();
    expect([a.stacks(A2, 'might'), a.has(A2, 'flameborn')]).toEqual([1, true]);
    a.pass(5);
    expect([a.has(A2, 'might'), a.has(A2, 'flameborn')]).toEqual([false, false]);
  });

  // §21.15 narrows the text's "all the Affliction damage" to "all indirect damage the bearer deals to enemies".
  it('Brimfire Crest: the ally heals for the indirect damage they deal (Toxin tick)', () => {
    const a = arena({ p0: [['bless.brimstone'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(B1, 'toxin', { stacks: 2, source: A2 }).use(A1, 'bless.brimstone', A2).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([90, 60]);
  });

  it('Brimfire Crest: the ally still heals for their own Ignite ticks', () => {
    const a = arena({ p0: [['bless.brimstone'], ['strike.fire']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.brimstone', A2).use(A2, 'strike.fire', B1).end();
    expect(a.hp(A2)).toBe(55);
  });

  it('Sulfurous Miasma: Toxin turns into Sulfur stack for stack (max 4), and Confused for 2 turns', () => {
    const a = arena({ p0: [['curse.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 3, source: B1 }).use(A1, 'curse.brimstone', B1).end();
    expect([toxin(a, B1), sulfur(a, B1), a.stacks(B1, 'confusion')]).toEqual([0, 3, 1]);
    const b = arena({ p0: [['curse.brimstone']], p1: [['shot']] });
    b.give(B1, 'toxin', { stacks: 6, source: B1 }).use(A1, 'curse.brimstone', B1).end();
    expect(sulfur(b, B1)).toBe(4);
    b.pass(4);
    expect(b.has(B1, 'confusion')).toBe(false);
  });

  it('Brand of Sulfur: 15 and 2 Sulfur; for 1 turn allies who damage them heal 5 per Sulfur', () => {
    const a = arena({ p0: [['smite.brimstone'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.brimstone', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), sulfur(a, B1), a.hp(A2)]).toEqual([70, 2, 60]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(60);
  });

  it('Hellsong: allies heal 15 and gain Flameborn for 2 turns', () => {
    const a = arena({ p0: [['prayer.brimstone'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.brimstone').end();
    expect([a.hp(A1), a.hp(A2), a.has(A2, 'flameborn')]).toEqual([65, 65, true]);
    a.pass(4);
    expect(a.has(A2, 'flameborn')).toBe(false);
  });

  it("Hellsong: the Flameborn also heals 10 per Eruption the side causes", () => {
    const a = arena({ p0: [['prayer.brimstone'], ['dance.fire']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).give(B1, 'sulfur', { stacks: 1, source: A1 });
    a.use(A1, 'prayer.brimstone').use(A2, 'dance.fire').end();
    expect(a.hp(A1)).toBe(50 + 15 + 10 + 10); // +10 the Explosion (Flameborn), +10 the Eruption
  });

  it('Burning Tail: 20 + 15; the other enemy gains as much Sulfur as the target has', () => {
    const a = arena({ p0: [['cleave.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 3, source: A1 }).use(A1, 'cleave.brimstone', B1).end();
    expect([a.hp(B1), a.hp(B2), sulfur(a, B1), sulfur(a, B2)]).toEqual([80, 85, 3, 3]);
  });

  it('Stench of Sulfur: all enemies gain 1 Sulfur', () => {
    const a = arena({ p0: [['shout.brimstone']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.brimstone').end();
    expect([sulfur(a, B1), sulfur(a, B2)]).toEqual([1, 1]);
  });

  it("Stench of Sulfur: for 2 turns, the user's Sulfur cleansed away deals its bearer 10 Affliction", () => {
    const a = arena({ p0: [['shout.brimstone']], p1: [['rage.wind'], ['shot']] });
    a.use(A1, 'shout.brimstone').end().use(B1, 'rage.wind').end();
    expect([sulfur(a, B1), a.hp(B1), a.hp(B2)]).toEqual([0, 90, 100]);
  });

  it('Cinder Mantle: 25 Shield for 1 turn; an enemy breaking it makes the user Flameborn for 2 turns', () => {
    const a = arena({ p0: [['withstand.brimstone']], p1: [['smash']] });
    a.use(A1, 'withstand.brimstone').end();
    expect(shieldOf(a, A1)).toBe(25);
    a.use(B1, 'smash', A1).end();
    expect(a.has(A1, 'flameborn')).toBe(true);
    a.pass(4);
    expect(a.has(A1, 'flameborn')).toBe(false);
  });

  it('Cinder Mantle: a Shield that holds gives no Flameborn', () => {
    const a = arena({ p0: [['withstand.brimstone']], p1: [['shot']] });
    a.use(A1, 'withstand.brimstone').end().use(B1, 'shot', A1).end();
    expect(a.has(A1, 'flameborn')).toBe(false);
  });

  it('Lure of the Pit: Taunts for 2 turns', () => {
    const a = arena({ p0: [['taunt.brimstone'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.brimstone', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B2, 'shot', A2).end().end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });

  it('Lure of the Pit: when another enemy uses a Helpful skill, the Taunt jumps to them (for 1 turn)', () => {
    const a = arena({ p0: [['taunt.brimstone'], ['shot']], p1: [['shot'], ['heal', 'shot']] });
    a.use(A1, 'taunt.brimstone', B1).end().use(B2, 'heal', B2).end().end();
    a.use(B1, 'shot', A2);
    expect(a.reject(() => a.use(B2, 'shot', A2))).toBe('bad_target');
  });

  it('Pit Lord: 3 Armor and Immune for 3 turns; enemies using Harmful skills on the user gain 1 Sulfur', () => {
    const a = arena({ p0: [['titan.brimstone'], ['shot']], p1: [['shot'], ['curse'], ['shot']] });
    a.use(A1, 'titan.brimstone').end();
    a.use(B1, 'shot', A1).use(B2, 'curse', A1).use(B3, 'shot', A2).end();
    expect([a.hp(A1), a.has(A1, 'confusion'), sulfur(a, B1), sulfur(a, B2), sulfur(a, B3)]).toEqual([100, false, 1, 1, 0]);
    a.pass(5);
    expect([a.has(A1, 'armor'), a.has(A1, 'immune')]).toEqual([false, false]);
  });
});

describe('Brimstone costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0],
    smash: ['Sr', 2],
    charge: ['S', 1],
    riposte: ['W', 2],
    rage: ['S', 4],
    shot: ['r', 1],
    snipe: ['Ar', 1],
    trap: ['W', 2],
    maneuver: ['S', 2],
    companion: ['I', 1],
    bolt: ['I', 1],
    blast: ['Wr', 2],
    consume: ['I', 2],
    summon: ['S', 1],
    channel: ['Irr', 8],
    stab: ['r', 0],
    ravage: ['Ar', 1],
    mislead: ['W', 2],
    stun: ['A', 3],
    dance: ['S', 1],
    heal: ['W', 1],
    bless: ['W', 2],
    curse: ['r', 2],
    smite: ['W', 1],
    prayer: ['Sr', 2],
    cleave: ['S', 1],
    shout: ['r', 1],
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
  it.each(Object.entries(kit))('%s.brimstone matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.brimstone`]!;
    expect([norm(s.cost), s.cooldown]).toEqual([norm(cost), cd]);
  });
});
