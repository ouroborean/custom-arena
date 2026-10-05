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

  it('Sulfur Sting: against Prey, it all Erupts', () => {
    const a = arena({ p0: [['shot.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'prey', { source: A1 });
    a.use(A1, 'shot.brimstone', B1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 1, 95]);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 5 - 10);
  });

  it('Sulfur Sting: if they already had Sulfur, it all Erupts', () => {
    const a = arena({ p0: [['shot.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 1, source: A1 });
    a.use(A1, 'shot.brimstone', B1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 2, 90]);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 5 - 20);
  });

  it('Sulfur Sting: a second Sting sets off the Sulfur the first one left', () => {
    const a = arena({ p0: [['shot.brimstone']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.brimstone', B1).end();
    expect([sulfur(a, B1), a.hp(B2)]).toEqual([1, 100]);
    a.pass(3).use(A1, 'shot.brimstone', B1).end();
    expect([sulfur(a, B1), toxin(a, B1), a.hp(B2)]).toEqual([0, 2, 90]);
  });

  it('Pitch Javelin: on the following turn, the target gains 2 Sulfur and it Erupts; hidden target', () => {
    const a = arena({ p0: [['snipe.brimstone']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.brimstone', B1).end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === A1).every((e) => e.targets.length === 0)).toBe(true);
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([100, 0]);
    a.end();
    // 2 Sulfur Erupt: 20 to them, 10 to their ally; the Sulfur turned into 2 Toxin.
    expect([a.hp(B1), a.hp(B2), sulfur(a, B1), toxin(a, B1)]).toEqual([80, 90, 0, 2]);
  });

  it('Pitch Javelin: Sulfur they already had Erupts with it', () => {
    const a = arena({ p0: [['snipe.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 1, source: A1 }).use(A1, 'snipe.brimstone', B1).end().end();
    expect([a.hp(B1), a.hp(B2), toxin(a, B1)]).toEqual([70, 85, 3]);
  });

  it('Pitch Javelin: Channeled (a Stun stops it) and Uncounterable', () => {
    const a = arena({ p0: [['snipe.brimstone']], p1: [['stun'], ['shot']] });
    a.use(A1, 'snipe.brimstone', B1).end().use(B1, 'stun', A1).end();
    expect([a.hp(B1), sulfur(a, B1)]).toEqual([100, 0]);
    const b = arena({ p0: [['snipe.brimstone']], p1: [['riposte']] });
    b.pass(1).use(B1, 'riposte').end();
    b.use(A1, 'snipe.brimstone', B1).end().end();
    expect([b.hp(A1), b.hp(B1)]).toEqual([100, 80]);
  });

  it('Brimstone Pit: Invisible; the target\'s first Helpful skill gives each of its targets 2 Sulfur, and it Erupts', () => {
    const a = arena({ p0: [['trap.brimstone']], p1: [['heal', 'shot'], ['shot'], ['shot']] });
    a.use(A1, 'trap.brimstone', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    // B2 healed 25 to 75, then 2 Sulfur Erupt: 20 to B2, 10 to each of their allies.
    expect([a.hp(B2), a.hp(B1), a.hp(B3), sulfur(a, B2), toxin(a, B2)]).toEqual([55, 90, 90, 0, 2]);
  });

  it('Brimstone Pit: Harmful skills don\'t set it off, and only the first Helpful one does', () => {
    const a = arena({ p0: [['trap.brimstone']], p1: [['heal', 'bless', 'shot'], ['shot']] });
    a.use(A1, 'trap.brimstone', B1).end();
    a.use(B1, 'shot', A1).end().end();
    expect([sulfur(a, B1), a.hp(B2)]).toEqual([0, 100]);
    a.setHp(B2, 50).use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(55);
    a.end().use(B1, 'bless', B2).end(); // a second Helpful skill, still within the 3 turns
    expect([sulfur(a, B2), a.has(B2, 'might')]).toEqual([0, true]);
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

  it('Consumed by Fire: an Ignite for 2 turns that burns for 10, and the user heals for every burn', () => {
    const a = arena({ p0: [['consume.brimstone']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.brimstone', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'consumed_by_fire')]).toEqual([90, 60, true]);
    a.end().end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 70]);
    a.end().end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'consumed_by_fire')]).toEqual([80, 70, false]);
  });

  it('Consumed by Fire: it counts as an Ignite, so its burn makes their Sulfur Erupt', () => {
    const a = arena({ p0: [['consume.brimstone']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sulfur', { stacks: 2, source: A1 }).setHp(A1, 50).use(A1, 'consume.brimstone', B1).end();
    // 10 from the burn, then the Eruption: 20 to them and 10 to their ally; the user heals the burn's 10.
    expect([a.hp(B1), a.hp(B2), sulfur(a, B1), a.hp(A1)]).toEqual([70, 90, 0, 60]);
    expect(toxin(a, B1)).toBe(2);
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

  it('Stokers: with no Sulfur on any enemy, a Stoker gives one 1 Sulfur instead (and the other Ignites them)', () => {
    const a = arena({ p0: [['summon.brimstone']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.brimstone').end();
    const lit = [B1, B2].filter((u) => sulfur(a, u) === 1);
    expect(lit).toHaveLength(1);
    expect(a.has(lit[0]!, 'ignite')).toBe(true);
    a.pass(2); // the Ignite burns at the end of the next turn, setting the Sulfur off
    expect([sulfur(a, lit[0]!), toxin(a, lit[0]!)]).toEqual([0, 1]);
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

  it('Strike the Match: 10 damage; above 40 HP afterwards, nothing more', () => {
    const a = arena({ p0: [['stab.brimstone']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 51).use(A1, 'stab.brimstone', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([41, 100]);
  });

  it('Strike the Match: if it leaves them at or below 40 HP, the user Explodes (setting off Sulfur)', () => {
    const a = arena({ p0: [['stab.brimstone']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 50).give(B2, 'sulfur', { stacks: 1, source: A1 }).use(A1, 'stab.brimstone', B1).end();
    // B1: 50 − 10 − 10 (Explosion) − 5 (B2's Eruption splash); B2: 10 (Explosion) + 10 (Eruption).
    expect(a.hp(B1)).toBe(25);
    expect([a.hp(B2), sulfur(a, B2), toxin(a, B2)]).toEqual([75, 0, 1]); // and its new Toxin ticks for 5
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

  it('Sulfur Dance: for 3 turns, at the end of each of the user\'s turns, a random enemy gains 1 Sulfur and the user 1 Swiftness', () => {
    const a = arena({ p0: [['dance.brimstone']], p1: [['shot']] });
    a.use(A1, 'dance.brimstone').end();
    expect([sulfur(a, B1), a.stacks(A1, 'swiftness'), a.hp(B1)]).toEqual([1, 1, 100]);
    a.pass(2);
    expect([sulfur(a, B1), a.stacks(A1, 'swiftness')]).toEqual([2, 2]);
    a.pass(2);
    expect([sulfur(a, B1), a.stacks(A1, 'swiftness')]).toEqual([3, 3]);
  });

  it('Sulfur Dance: when it ends, the user Explodes, and the Swiftness goes with it', () => {
    const a = arena({ p0: [['dance.brimstone']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.brimstone').end().pass(4);
    const [s1, s2] = [sulfur(a, B1), sulfur(a, B2)];
    expect(s1 + s2).toBe(3);
    a.pass(1); // the end of the opponent's 3rd turn
    expect([sulfur(a, B1), sulfur(a, B2), a.stacks(A1, 'swiftness')]).toEqual([0, 0, 0]);
    expect([toxin(a, B1), toxin(a, B2)]).toEqual([s1, s2]);
    // 10 from the Explosion, 10 per own Sulfur and 5 per Sulfur on the ally.
    expect(a.hp(B1)).toBe(100 - 10 - 10 * s1 - 5 * s2);
    expect(a.hp(B2)).toBe(100 - 10 - 10 * s2 - 5 * s1);
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

  it('Pit Lord: Immune for 3 turns, and no Armor', () => {
    const a = arena({ p0: [['titan.brimstone'], ['shot']], p1: [['shot'], ['curse'], ['shot']] });
    a.use(A1, 'titan.brimstone').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, true]);
    a.use(B2, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(4);
    expect([a.has(A1, 'immune'), a.has(A1, 'pit_lord')]).toEqual([false, false]);
  });

  it('Pit Lord: each enemy who deals the user direct damage gains 1 Sulfur and is Ignited', () => {
    const a = arena({ p0: [['titan.brimstone'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'titan.brimstone').end();
    a.use(B1, 'shot', A1).use(B3, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70); // no Armor
    expect([sulfur(a, B1), a.has(B1, 'ignite'), sulfur(a, B3), a.has(B3, 'ignite')]).toEqual([1, true, 1, true]);
    expect([sulfur(a, B2), a.has(B2, 'ignite')]).toEqual([0, false]);
    a.end();
    // At the end of the user's turn each Ignite burns (5) and Erupts: 10 to its bearer, 5 to each of their allies.
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 90, 80]);
    expect([toxin(a, B1), toxin(a, B3)]).toEqual([1, 1]);
  });

  it('Pit Lord: damage to an ally, or after the form, burns no one', () => {
    const a = arena({ p0: [['titan.brimstone'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.brimstone').end().use(B1, 'shot', A2).end();
    expect([sulfur(a, B1), a.has(B1, 'ignite')]).toEqual([0, false]);
    a.pass(5).use(B2, 'shot', A1).end();
    expect([sulfur(a, B2), a.has(B2, 'ignite')]).toEqual([0, false]);
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
    stab: ['r', 1],
    ravage: ['Ar', 1],
    mislead: ['W', 2],
    stun: ['A', 3],
    dance: ['S', 3],
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
