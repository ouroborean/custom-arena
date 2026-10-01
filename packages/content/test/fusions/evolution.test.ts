// Spec-driven tests for Evolution (Poison + Poison): the Evolve keyword and all 30 skills, plus minion skills.
// Sources: each skill's in-game description, docs/rules.md §21.6, and the "Fusion Spec Kits" kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Toxin ticks (5 Affliction per stack) at the end of the applier's turn.

import { describe, expect, it } from 'vitest';
import { evaluateNamedCondition, viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const isPrey = (a: Arena, id: string) => evaluateNamedCondition(content, a.state, 'prey', id);
const visibleTo = (a: Arena, player: 0 | 1, bearer: string) =>
  viewFor(content, a.state, player).effects.filter((e) => e.bearer === bearer).length;
const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.defId === defId);
const living = (a: Arena, defId: string) => minions(a, defId).filter((u) => u.alive);
const shieldOn = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => n + ((e.defId === 'shield' || e.inline?.shield) ? e.value : 0), 0);

/** Passes turns until it's `actor`'s owner's turn and `skill` is off cooldown. */
function ready(a: Arena, actor: string, skill: string): Arena {
  for (let i = 0; i < 40 && (a.active !== a.unit(actor).owner || a.cooldown(actor, skill) > 0); i++) a.pass(1);
  return a;
}

/**
 * Uses `skill` until it reaches `stage` (1 = I, 2 = II, 3 = III), then wipes the board back to a clean state
 * (full HP, no skill-applied effects) and waits until the skill is ready again.
 */
function evolveTo(a: Arena, actor: string, skill: string, stage: number, target?: string): Arena {
  for (let i = 1; i < stage; i++) {
    ready(a, actor, skill);
    a.use(actor, skill, target).end();
  }
  ready(a, actor, skill);
  for (const u of a.state.units) if (u.alive && u.kind === 'character') u.hp = u.maxHp;
  a.state.effects = a.state.effects.filter((e) => !e.sourceSkill);
  return a;
}

describe('Evolution: Evolve', () => {
  it('a skill starts at Stage I, goes up one stage per use, and stays at III (Corrosive Glob)', () => {
    // Glob's stages are easy to read: I converts 1 Armor, II all Armor, III also dissolves Shield.
    const a = arena({ p0: [['bolt.evolution']], p1: [['shot']], hp: 1000 });
    const stageSeen: string[] = [];
    for (let i = 0; i < 4; i++) {
      ready(a, A1, 'bolt.evolution');
      a.state.effects = a.state.effects.filter((e) => e.bearer !== B1);
      a.give(B1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 100 });
      a.use(A1, 'bolt.evolution', B1).end();
      const armorLeft = a.stacks(B1, 'armor');
      const shield = shieldOn(a, B1);
      stageSeen.push(armorLeft === 2 ? 'I' : armorLeft === 0 && shield > 0 ? 'II' : armorLeft === 0 && shield === 0 ? 'III' : '?');
    }
    expect(stageSeen).toEqual(['I', 'II', 'III', 'III']);
  });

  it("stages are per user: one character's uses don't evolve another's copy", () => {
    const a = arena({ p0: [['bolt.evolution'], ['bolt.evolution']], p1: [['shot']], hp: 1000 });
    a.use(A1, 'bolt.evolution', B1).end();
    ready(a, A1, 'bolt.evolution');
    a.state.effects = [];
    a.give(B1, 'armor', { stacks: 3 });
    a.use(A2, 'bolt.evolution', B1).end(); // A2's first use: Stage I, only 1 Armor converts
    expect(a.stacks(B1, 'armor')).toBe(2);
  });
});

describe('Evolution skills', () => {
  // ---------------------------------------------------------------- Strike
  it('Mutant Fang I: 20 damage and 1 Toxin', () => {
    const a = arena({ p0: [['strike.evolution']], p1: [['shot']] });
    a.use(A1, 'strike.evolution', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([75, 1]); // 20 + 5 tick
    expect(a.has(A1, 'might')).toBe(false); // unlike base Strike, no Might
  });

  it('Mutant Fang II: still 1 Toxin, and the Toxin also ticks once now', () => {
    const a = arena({ p0: [['strike.evolution']], p1: [['shot']], hp: 200 });
    a.use(A1, 'strike.evolution', B1).end().pass(1); // I: 200 → 175, 1 Toxin
    const before = a.hp(B1);
    a.use(A1, 'strike.evolution', B1).end();
    // 20 damage, Toxin 1 → 2, ticks once now (10), then the end-of-turn tick (10).
    expect(a.stacks(B1, 'toxin')).toBe(2);
    expect(before - a.hp(B1)).toBe(20 + 10 + 10);
  });

  it('Mutant Fang III: 25 damage and two ticks now, then it returns to Stage I', () => {
    const a = arena({ p0: [['strike.evolution']], p1: [['shot']], hp: 500 });
    a.use(A1, 'strike.evolution', B1).end().pass(1);
    a.use(A1, 'strike.evolution', B1).end().pass(1);
    const before = a.hp(B1);
    a.use(A1, 'strike.evolution', B1).end();
    // Toxin 2 → 3; 25 damage, two ticks now (2 × 15), end-of-turn tick (15).
    expect(a.stacks(B1, 'toxin')).toBe(3);
    expect(before - a.hp(B1)).toBe(25 + 30 + 15);
    a.pass(1);
    const again = a.hp(B1);
    a.use(A1, 'strike.evolution', B1).end();
    // Back at Stage I: 20 damage, Toxin 3 → 4, only the end-of-turn tick (20).
    expect(a.stacks(B1, 'toxin')).toBe(4);
    expect(again - a.hp(B1)).toBe(20 + 20);
  });

  // ---------------------------------------------------------------- Smash
  it("Primal Stomp I: 25 to the target, 1 Toxin to each of the target's allies, none to the target", () => {
    const a = arena({ p0: [['smash.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 3, source: A1 });
    a.use(A1, 'smash.evolution', B1).end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin'), a.stacks(B3, 'toxin')]).toEqual([3, 1, 1]);
    expect(a.hp(B1)).toBe(100 - 25 - 15);
  });

  it("Primal Stomp II: the allies gain as much Toxin as the target has, at least 1", () => {
    const a = arena({ p0: [['smash.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    evolveTo(a, A1, 'smash.evolution', 2, B1);
    a.give(B1, 'toxin', { stacks: 3, source: A1 });
    a.use(A1, 'smash.evolution', B1).end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin'), a.stacks(B3, 'toxin')]).toEqual([3, 3, 3]);

    const b = arena({ p0: [['smash.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(b, A1, 'smash.evolution', 2, B1);
    b.use(A1, 'smash.evolution', B1).end(); // target has no Toxin: allies still gain 1
    expect(b.stacks(B2, 'toxin')).toBe(1);
  });

  it("Primal Stomp III: the target takes 5 more per Toxin on their allies, counted after the spread", () => {
    const a = arena({ p0: [['smash.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    evolveTo(a, A1, 'smash.evolution', 3, B1);
    a.give(B2, 'toxin', { stacks: 2, source: A1 });
    a.use(A1, 'smash.evolution', B1).end();
    // Allies gain 1 each (target has none): B2 3, B3 1 → 4 Toxin on the allies → +20.
    expect([a.stacks(B2, 'toxin'), a.stacks(B3, 'toxin')]).toEqual([3, 1]);
    expect(a.hp(B1)).toBe(100 - 25 - 20);
  });

  // ---------------------------------------------------------------- Charge
  it('Scent Trail: 10 damage; the next Toxin-giving skill also gives it to every Prey enemy, once', () => {
    const a = arena({ p0: [['charge.evolution', 'strike.evolution', 'shot']], p1: [['shot'], ['shot'], ['shot']], hp: 200 });
    a.give(B2, 'prey');
    a.use(A1, 'charge.evolution', B1).end();
    expect(a.hp(B1)).toBe(190);
    a.pass(1).use(A1, 'shot', B1).end(); // gives no Toxin: doesn't use it up
    expect(a.stacks(B2, 'toxin')).toBe(0);
    a.pass(1).use(A1, 'strike.evolution', B1).end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin'), a.stacks(B3, 'toxin')]).toEqual([1, 1, 0]);
    a.pass(1).use(A1, 'strike.evolution', B1).end(); // used up: no more spreading
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([2, 1]);
  });

  // ---------------------------------------------------------------- Riposte
  it('Molt I: invisible; the first direct hit within the turn heals the user 15', () => {
    const a = arena({ p0: [['riposte.evolution']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 60).use(A1, 'riposte.evolution').end();
    expect(visibleTo(a, 1, A1)).toBe(0);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(60 - 15 + 15 - 15);
  });

  it('Molt: lasts 1 turn (no heal on a later turn), and Stage I keeps Debuffs', () => {
    const a = arena({ p0: [['riposte.evolution']], p1: [['shot']] });
    a.give(A1, 'weakness').setHp(A1, 60).use(A1, 'riposte.evolution').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'weakness')]).toEqual([60, 1]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(45);
  });

  it('Molt II: the hit also strips the user’s Debuffs', () => {
    const a = arena({ p0: [['riposte.evolution']], p1: [['shot']] });
    evolveTo(a, A1, 'riposte.evolution', 2);
    a.give(A1, 'weakness').give(A1, 'vulnerable', { stacks: 2 }).setHp(A1, 60);
    a.use(A1, 'riposte.evolution').end();
    a.use(B1, 'shot', A1).end();
    expect([a.has(A1, 'weakness'), a.has(A1, 'vulnerable')]).toEqual([false, false]);
    expect(a.hp(A1)).toBe(60 - 25 + 15); // the shot took the 2 Vulnerable before they were removed
  });

  it('Molt III: the first Harmful skill is countered instead; the second gets through', () => {
    const a = arena({ p0: [['riposte.evolution']], p1: [['curse'], ['shot']] });
    evolveTo(a, A1, 'riposte.evolution', 3);
    a.use(A1, 'riposte.evolution').end();
    a.use(B1, 'curse', A1).use(B2, 'shot', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    expect(a.hp(A1)).toBe(85);
  });

  // ---------------------------------------------------------------- Rage
  it('Apex Predator I: all Might in the battle, the user’s included, becomes the same Weakness for 3 turns', () => {
    const a = arena({ p0: [['rage.evolution'], ['shot']], p1: [['shot']] });
    a.give(A1, 'might', { stacks: 2 }).give(A2, 'might').give(B1, 'might', { stacks: 3 });
    a.use(A1, 'rage.evolution').end();
    expect([a.has(A1, 'might'), a.has(A2, 'might'), a.has(B1, 'might')]).toEqual([false, false, false]);
    expect([a.stacks(A1, 'weakness'), a.stacks(A2, 'weakness'), a.stacks(B1, 'weakness')]).toEqual([2, 1, 3]);
    expect(a.has(A1, 'immune')).toBe(false);
    a.pass(4);
    expect(a.stacks(B1, 'weakness')).toBe(3);
    a.pass(1);
    expect(a.has(B1, 'weakness')).toBe(false);
  });

  it('Apex Predator II: the user’s own Might is spared and they gain Immune for 2 turns', () => {
    const a = arena({ p0: [['rage.evolution'], ['shot']], p1: [['shot']] });
    evolveTo(a, A1, 'rage.evolution', 2);
    a.give(A1, 'might', { stacks: 2 }).give(A2, 'might').give(B1, 'might');
    a.use(A1, 'rage.evolution').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'weakness'), a.stacks(A2, 'weakness'), a.stacks(B1, 'weakness')]).toEqual([2, false, 1, 1]);
    expect(a.has(A1, 'immune')).toBe(true);
    a.pass(2);
    expect(a.has(A1, 'immune')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('Apex Predator III: the user also gains 1 Might per stack converted, for 3 turns', () => {
    const a = arena({ p0: [['rage.evolution'], ['shot']], p1: [['shot']] });
    evolveTo(a, A1, 'rage.evolution', 3);
    a.give(A1, 'might', { stacks: 2 }).give(A2, 'might').give(B1, 'might', { stacks: 2 });
    a.use(A1, 'rage.evolution').end();
    expect(a.stacks(A1, 'might')).toBe(2 + 3); // own 2 spared, +3 for the converted stacks
    a.pass(6);
    expect(a.stacks(A1, 'might')).toBe(2); // the gained Might expired, the spared Might stays
  });

  // ---------------------------------------------------------------- Shot
  it('Telltale Venom: 5 Piercing (Armor ignored) and 1 Toxin', () => {
    const a = arena({ p0: [['shot.evolution']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'shot.evolution', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([90, 1]);
  });

  it("Telltale Venom: until the end of the user's next turn, every enemy with any Toxin is Prey", () => {
    const a = arena({ p0: [['shot.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'toxin', { source: A1 });
    expect(isPrey(a, B2)).toBe(false);
    a.use(A1, 'shot.evolution', B1).end();
    expect([isPrey(a, B1), isPrey(a, B2), isPrey(a, B3)]).toEqual([true, true, false]);
    a.give(B3, 'toxin', { source: A1 }); // B3 gains Toxin during the window
    expect(isPrey(a, B3)).toBe(true);
    a.pass(2);
    expect([isPrey(a, B1), isPrey(a, B2), isPrey(a, B3)]).toEqual([false, false, false]);
  });

  // ---------------------------------------------------------------- Snipe
  it('Barbed Quill I: 25 Affliction on the following turn (through Shield), hidden target', () => {
    const a = arena({ p0: [['snipe.evolution']], p1: [['shot']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'snipe.evolution', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1);
    expect(a.hp(B1)).toBe(75);
  });

  it('Barbed Quill: Uncounterable (a Riposte on the target doesn’t stop it)', () => {
    const a = arena({ p0: [['snipe.evolution']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'snipe.evolution', B1).end().pass(1);
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 75]);
  });

  it('Barbed Quill II: against Prey it lands at once (and only once)', () => {
    const a = arena({ p0: [['snipe.evolution']], p1: [['shot']] });
    evolveTo(a, A1, 'snipe.evolution', 2, B1);
    a.give(B1, 'prey').use(A1, 'snipe.evolution', B1).end();
    expect(a.hp(B1)).toBe(75);
    a.pass(2);
    expect(a.hp(B1)).toBe(75);
  });

  it('Barbed Quill III: also hits every other Prey enemy, not non-Prey ones', () => {
    const a = arena({ p0: [['snipe.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    evolveTo(a, A1, 'snipe.evolution', 3, B1);
    a.give(B1, 'prey').give(B2, 'prey').use(A1, 'snipe.evolution', B1).end().pass(2);
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 100]);
  });

  // ---------------------------------------------------------------- Trap
  it('Nesting Pit I: every Strategic skill the target uses gives them 1 Toxin; non-Strategic ones don’t', () => {
    const a = arena({ p0: [['trap.evolution']], p1: [['heal', 'curse', 'shot'], ['curse']], hp: 200 });
    a.use(A1, 'trap.evolution', B1).end();
    expect(visibleTo(a, 1, B1)).toBe(0);
    a.use(B1, 'heal', B1).use(B2, 'curse', A1).end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([1, 0]);
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.stacks(B1, 'toxin')).toBe(2);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'toxin')).toBe(2);
  });

  it('Nesting Pit I: lasts 3 turns, with no payoff when it ends', () => {
    const a = arena({ p0: [['trap.evolution']], p1: [['heal', 'curse']], hp: 200 });
    a.use(A1, 'trap.evolution', B1).end().pass(4);
    const hp = a.hp(B1);
    a.pass(1); // end of turn 6: the Pit ends
    expect(a.hp(B1)).toBe(hp);
    expect(a.has(B1, 'stun')).toBe(false);
    a.pass(1).use(B1, 'curse', A1).end();
    expect(a.stacks(B1, 'toxin')).toBe(0);
  });

  it('Nesting Pit II: when it ends, 10 Affliction per trigger', () => {
    const a = arena({ p0: [['trap.evolution']], p1: [['heal', 'curse']], hp: 300 });
    evolveTo(a, A1, 'trap.evolution', 2, B1);
    a.use(A1, 'trap.evolution', B1).end();
    a.use(B1, 'heal', B1).end().pass(1).use(B1, 'curse', A1).end().pass(1);
    const hp = a.hp(B1);
    a.pass(1); // B1's turn ends (no Toxin tick on B's turn): the Pit ends
    expect(hp - a.hp(B1)).toBe(20);
  });

  it('Nesting Pit III: if it never triggered, the target is Stunned for 1 turn when it ends', () => {
    const a = arena({ p0: [['trap.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'trap.evolution', 3, B1);
    a.use(A1, 'trap.evolution', B1).end().pass(5);
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.end().pass(1);
    expect(() => a.use(B1, 'shot', A1)).not.toThrow();
  });

  it('Nesting Pit III: no Stun if it triggered', () => {
    const a = arena({ p0: [['trap.evolution']], p1: [['heal']], hp: 300 });
    evolveTo(a, A1, 'trap.evolution', 3, B1);
    a.use(A1, 'trap.evolution', B1).end();
    a.use(B1, 'heal', B1).end().pass(4);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  // ---------------------------------------------------------------- Maneuver
  it('Slough Off I: Invulnerable for 1 turn and 1 Focus; Unstunnable; Toxin stays', () => {
    const a = arena({ p0: [['maneuver.evolution']], p1: [['shot']] });
    a.give(A1, 'stun').give(A1, 'toxin', { stacks: 2, source: B1 });
    a.pass(0).use(A1, 'maneuver.evolution').end();
    expect([a.has(A1, 'invulnerable'), a.stacks(A1, 'focus'), a.stacks(A1, 'toxin')]).toEqual([true, 1, 2]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  it('Slough Off II: the user’s Toxin moves onto the last enemy who damaged them; other Debuffs stay', () => {
    const a = arena({ p0: [['maneuver.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'maneuver.evolution', 2);
    a.end().use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // B2 hit last
    a.give(A1, 'toxin', { stacks: 3, source: B1 }).give(A1, 'weakness');
    a.use(A1, 'maneuver.evolution').end();
    expect([a.has(A1, 'toxin'), a.stacks(B2, 'toxin'), a.stacks(B1, 'toxin')]).toEqual([false, 3, 0]);
    expect(a.stacks(A1, 'weakness')).toBe(1);
  });

  it('Slough Off III: all their Debuffs move to the last enemy who damaged them', () => {
    const a = arena({ p0: [['maneuver.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'maneuver.evolution', 3);
    a.end().use(B2, 'shot', A1).end();
    a.give(A1, 'toxin', { stacks: 2, source: B1 }).give(A1, 'weakness').give(A1, 'vulnerable', { stacks: 2 });
    a.use(A1, 'maneuver.evolution').end();
    expect([a.has(A1, 'toxin'), a.has(A1, 'weakness'), a.has(A1, 'vulnerable')]).toEqual([false, false, false]);
    expect([a.stacks(B2, 'toxin'), a.stacks(B2, 'weakness'), a.stacks(B2, 'vulnerable')]).toEqual([2, 1, 2]);
    expect(a.has(B1, 'weakness')).toBe(false);
  });

  // ---------------------------------------------------------------- Companion
  it('Brood Parasite: a permanent 20-HP Parasite lodged in the target enemy; enemies can’t target it', () => {
    const a = arena({ p0: [['companion.evolution']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.evolution', B1).end();
    const [p] = minions(a, 'parasite');
    expect(p).toBeDefined();
    expect([p!.owner, p!.hp, a.has(B1, 'parasite_host'), a.has(B2, 'parasite_host')]).toEqual([0, 20, true, false]);
    expect(a.reject(() => a.use(B2, 'shot', p!.id))).toBe('bad_target');
    expect(a.reject(() => a.use(B1, 'shot', p!.id))).toBe('bad_target'); // simplified: not even the host
    a.end().pass(10);
    expect(a.unit(p!.id).alive).toBe(true);
  });

  it('Brood Parasite Feed: only the host can be targeted; it loses 10 HP (through Shield)', () => {
    const a = arena({ p0: [['companion.evolution'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.evolution', B1).end().pass(1);
    const p = minions(a, 'parasite')[0]!;
    expect(a.reject(() => a.use(p.id, 'parasite_feed', B2))).toBe('bad_target');
    a.give(B1, 'shield', { value: 50 }).use(p.id, 'parasite_feed', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Brood Parasite Feed: the summoner’s most-hurt ally heals 10', () => {
    const a = arena({ p0: [['companion.evolution'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.evolution', B1).end().pass(1);
    const p = minions(a, 'parasite')[0]!;
    a.setHp(A2, 50).setHp(A1, 70).use(p.id, 'parasite_feed', B1).end();
    expect([a.hp(A2), a.hp(A1)]).toEqual([60, 70]);
  });

  // BUG: "it dies with them": when the host dies, the Parasite stays alive (only Parasite Host ends).
  it.fails('Brood Parasite: dies with its host', () => {
    const a = arena({ p0: [['companion.evolution', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.evolution', B1).end().pass(1);
    const p = minions(a, 'parasite')[0]!;
    a.setHp(B1, 10).use(A1, 'shot', B1).end();
    expect([a.unit(B1).alive, a.unit(p.id).alive]).toEqual([false, false]);
  });

  // ---------------------------------------------------------------- Bolt
  it('Corrosive Glob I: 20 damage; 1 Armor turns into Vulnerable for 2 turns; Shield untouched', () => {
    const a = arena({ p0: [['bolt.evolution']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).give(B1, 'shield', { value: 50 });
    a.use(A1, 'bolt.evolution', B1).end();
    expect([a.stacks(B1, 'armor'), a.stacks(B1, 'vulnerable')]).toEqual([2, 1]);
    expect(shieldOn(a, B1)).toBe(50 - 5); // 20 − 15 Armor
    a.pass(2);
    expect(a.stacks(B1, 'vulnerable')).toBe(1);
    a.pass(1);
    expect(a.has(B1, 'vulnerable')).toBe(false);
  });

  it('Corrosive Glob II: all of their Armor turns into Vulnerable', () => {
    const a = arena({ p0: [['bolt.evolution']], p1: [['shot']] });
    evolveTo(a, A1, 'bolt.evolution', 2, B1);
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'bolt.evolution', B1).end();
    expect([a.has(B1, 'armor'), a.stacks(B1, 'vulnerable')]).toEqual([false, 3]);
  });

  it('Corrosive Glob III: their Shield dissolves too, 1 Toxin per 10 removed', () => {
    const a = arena({ p0: [['bolt.evolution']], p1: [['shot']] });
    evolveTo(a, A1, 'bolt.evolution', 3, B1);
    a.give(B1, 'shield', { value: 40 }).use(A1, 'bolt.evolution', B1).end();
    // 20 damage hits the Shield first (40 → 20), then the 20 left dissolves into 2 Toxin.
    expect(shieldOn(a, B1)).toBe(0);
    expect(a.stacks(B1, 'toxin')).toBe(2);
    expect(a.hp(B1)).toBe(100 - 10);
  });

  // ---------------------------------------------------------------- Blast
  it('Extinction Event: 30 Affliction to every unit below 60 HP, both sides, user and minions included', () => {
    const a = arena({ p0: [['blast.evolution'], ['shot'], ['shot']], p1: [['shot'], ['companion'], ['shot']] });
    a.pass(1).use(B2, 'companion').end();
    const wolf = minions(a, 'wolf')[0]!;
    a.setHp(A1, 50).setHp(A2, 60).setHp(A3, 59).setHp(B1, 100).setHp(B3, 30);
    a.give(A1, 'shield', { value: 50 });
    a.use(A1, 'blast.evolution').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3), a.hp(B1), a.hp(B2)]).toEqual([20, 60, 29, 100, 100]);
    expect([a.unit(B3).alive, a.unit(wolf.id).alive]).toEqual([false, false]);
  });

  // ---------------------------------------------------------------- Consume
  it('Cull the Weak: removes all Toxin; kills at HP ≤ 5 per stack', () => {
    const a = arena({ p0: [['consume.evolution']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 4, source: A1 }).setHp(B1, 20);
    a.use(A1, 'consume.evolution', B1).end();
    expect(a.unit(B1).alive).toBe(false);
  });

  it('Cull the Weak: otherwise the user heals 5 per stack removed', () => {
    const a = arena({ p0: [['consume.evolution']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 4, source: A1 }).setHp(B1, 21).setHp(A1, 50);
    a.use(A1, 'consume.evolution', B1).end();
    expect([a.unit(B1).alive, a.hp(B1), a.has(B1, 'toxin'), a.hp(A1)]).toEqual([true, 21, false, 70]);
  });

  // ---------------------------------------------------------------- Summon
  it('Larva Swarm I: 2 Larvae of 15 HP that last 3 turns', () => {
    const a = arena({ p0: [['summon.evolution']], p1: [['shot']] });
    a.use(A1, 'summon.evolution').end();
    const ls = living(a, 'larva');
    expect(ls.map((l) => [l.owner, l.hp])).toEqual([[0, 15], [0, 15]]);
    a.pass(4);
    expect(living(a, 'larva')).toHaveLength(2);
    a.pass(2);
    expect(living(a, 'larva')).toHaveLength(0);
  });

  it('Larva Nibble: 5 Piercing and 1 Toxin', () => {
    const a = arena({ p0: [['summon.evolution']], p1: [['shot']] });
    a.use(A1, 'summon.evolution').end().pass(1);
    const l = living(a, 'larva')[0]!;
    a.give(B1, 'armor', { stacks: 2 }).use(l.id, 'larva_nibble', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([90, 1]);
  });

  it('Larva Swarm: at Stage I killing a Larva gives no Toxin; at II the killer gains 2 Toxin', () => {
    const a = arena({ p0: [['summon.evolution']], p1: [['shot']] });
    a.use(A1, 'summon.evolution').end();
    a.use(B1, 'shot', living(a, 'larva')[0]!.id).end();
    expect(a.has(B1, 'toxin')).toBe(false);
    evolveTo(a, A1, 'summon.evolution', 2);
    a.use(A1, 'summon.evolution').end();
    const fresh = living(a, 'larva').filter((l) => l.hp === 15);
    a.use(B1, 'shot', fresh[0]!.id).end();
    expect(a.unit(fresh[0]!.id).alive).toBe(false);
    expect(a.stacks(B1, 'toxin')).toBe(2);
  });

  it('Larva Swarm II still expires after 3 turns; III Larvae no longer expire', () => {
    const a = arena({ p0: [['summon.evolution']], p1: [['shot']] });
    evolveTo(a, A1, 'summon.evolution', 2);
    for (const l of living(a, 'larva')) a.unit(l.id).alive = false;
    a.use(A1, 'summon.evolution').end().pass(5);
    expect(living(a, 'larva')).toHaveLength(0);
    ready(a, A1, 'summon.evolution').use(A1, 'summon.evolution').end().pass(12); // third use: Stage III
    expect(living(a, 'larva')).toHaveLength(2);
  });

  // ---------------------------------------------------------------- Channel
  it('Plague Strain: 5 Affliction to all enemies each user turn for up to 6 turns, then stops', () => {
    const a = arena({ p0: [['channel.evolution']], p1: [['shot'], ['shot']] });
    a.give(B1, 'immune').give(B2, 'immune'); // keep Toxin out of the count
    a.use(A1, 'channel.evolution').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 95]);
    a.pass(10); // 5 more user turns
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
    a.pass(4);
    expect(a.hp(B1)).toBe(70);
  });

  it('Plague Strain I: 1 Toxin to one random enemy per tick', () => {
    const a = arena({ p0: [['channel.evolution']], p1: [['shot'], ['shot'], ['shot']], seed: 7 });
    a.use(A1, 'channel.evolution').end();
    expect(a.stacks(B1, 'toxin') + a.stacks(B2, 'toxin') + a.stacks(B3, 'toxin')).toBe(1);
  });

  it('Plague Strain: using another skill ends the channel', () => {
    const a = arena({ p0: [['channel.evolution', 'riposte']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'channel.evolution').end().pass(1);
    a.use(A1, 'riposte').end().pass(3);
    expect(a.hp(B1)).toBe(95);
  });

  it('Plague Strain II (second tick): the Toxin goes to a non-Prey enemy', () => {
    const a = arena({ p0: [['channel.evolution']], p1: [['shot'], ['shot'], ['shot']], hp: 300 });
    a.use(A1, 'channel.evolution').end().pass(1);
    a.give(B1, 'prey').give(B2, 'prey');
    const before = [B1, B2, B3].map((b) => a.stacks(b, 'toxin'));
    a.end(); // second tick
    expect([B1, B2, B3].map((b) => a.stacks(b, 'toxin'))).toEqual([before[0], before[1], before[2]! + 1]);
  });

  it('Plague Strain III (third tick on): Prey enemies also gain 1 Weakness, others don’t', () => {
    const a = arena({ p0: [['channel.evolution']], p1: [['shot'], ['shot'], ['shot']], hp: 300 });
    a.give(B3, 'immune');
    a.use(A1, 'channel.evolution').end().pass(1);
    a.give(B1, 'prey');
    a.end().pass(1); // second tick: no Weakness yet
    expect(a.has(B1, 'weakness')).toBe(false);
    a.end(); // third tick
    expect(a.stacks(B1, 'weakness')).toBe(1);
    expect(a.has(B2, 'weakness') && !isPrey(a, B2)).toBe(false);
  });

  // ---------------------------------------------------------------- Stab
  it('Opportunist I: 5 Piercing; a random energy only against Prey', () => {
    const a = arena({ p0: [['stab.evolution']], p1: [['shot']] });
    const gains = () => a.last.filter((e) => e.t === 'energyGained' && e.player === 0).length;
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'stab.evolution', B1).end();
    expect(a.hp(B1)).toBe(95);
    expect(gains()).toBe(0);
    a.pass(1).give(B1, 'prey').use(A1, 'stab.evolution', B1).end();
    expect(gains()).toBe(1);
  });

  it('Opportunist II: 15 Piercing against targets at or below 40 HP', () => {
    const a = arena({ p0: [['stab.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'stab.evolution', 2, B1);
    a.setHp(B1, 40).use(A1, 'stab.evolution', B1).end();
    expect(a.hp(B1)).toBe(25);
    a.pass(1).setHp(B2, 41).use(A1, 'stab.evolution', B2).end();
    expect(a.hp(B2)).toBe(36);
  });

  it('Opportunist III: executes Prey at or below 14 HP, not at 15', () => {
    const a = arena({ p0: [['stab.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'stab.evolution', 3, B1);
    a.setHp(B1, 14).give(B1, 'shield', { value: 100 }).use(A1, 'stab.evolution', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    a.pass(1).setHp(B2, 15).give(B2, 'shield', { value: 100 }).use(A1, 'stab.evolution', B2).end();
    expect([a.unit(B2).alive, a.hp(B2)]).toEqual([true, 15]);
  });

  // ---------------------------------------------------------------- Ravage
  it('Envenomed Rend I: 25 Piercing, Bypassing Invulnerable; Prey targets gain 2 Toxin, others none', () => {
    const a = arena({ p0: [['ravage.evolution']], p1: [['shot'], ['shot']] });
    a.give(B1, 'invulnerable').give(B1, 'prey').use(A1, 'ravage.evolution', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([100 - 25 - 10, 2]);
    ready(a, A1, 'ravage.evolution').use(A1, 'ravage.evolution', B2).end();
    expect([a.hp(B2), a.has(B2, 'toxin')]).toEqual([75, false]);
  });

  it("Envenomed Rend II: a Stunned target's Toxin doubles instead of +2", () => {
    const a = arena({ p0: [['ravage.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'ravage.evolution', 2, B1);
    a.give(B1, 'stun').give(B1, 'toxin', { stacks: 3, source: A1 }); // 3 Toxin: Prey too
    a.use(A1, 'ravage.evolution', B1).end();
    expect(a.stacks(B1, 'toxin')).toBe(6);
  });

  it("Envenomed Rend III: every target's Toxin doubles, Stunned or not", () => {
    const a = arena({ p0: [['ravage.evolution']], p1: [['shot']] });
    evolveTo(a, A1, 'ravage.evolution', 3, B1);
    a.give(B1, 'toxin', { stacks: 1, source: A1 }).use(A1, 'ravage.evolution', B1).end();
    expect(a.stacks(B1, 'toxin')).toBe(2);
  });

  // ---------------------------------------------------------------- Mislead
  it("Warning Colors I: the target's Harmful skill is countered and they gain 1 Toxin; others unaffected", () => {
    const a = arena({ p0: [['mislead.evolution']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.evolution', B1).end();
    expect(visibleTo(a, 1, B1)).toBe(0);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([85, 1, 0]);
  });

  it('Warning Colors: Helpful skills aren’t countered, and it lasts only 1 turn', () => {
    const a = arena({ p0: [['mislead.evolution']], p1: [['heal', 'shot']] });
    a.use(A1, 'mislead.evolution', B1).end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.has(B1, 'toxin')]).toEqual([75, false]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Warning Colors II: 1 Toxin per energy the countered skill cost', () => {
    const a = arena({ p0: [['mislead.evolution']], p1: [['smash']] });
    evolveTo(a, A1, 'mislead.evolution', 2, B1);
    a.use(A1, 'mislead.evolution', B1).end();
    a.use(B1, 'smash', A1).end(); // Sr: 2 energy
    expect([a.hp(A1), a.stacks(B1, 'toxin')]).toEqual([100, 2]);
  });

  it("Warning Colors III: visible, and any enemy's Harmful skill triggers it", () => {
    const a = arena({ p0: [['mislead.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'mislead.evolution', 3, B1);
    a.use(A1, 'mislead.evolution', B1).end();
    expect(visibleTo(a, 1, B1)).toBeGreaterThan(0);
    a.use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(B2, 'toxin')]).toEqual([100, 1]);
  });

  // ---------------------------------------------------------------- Stun
  it('Paralytic Bite I: Stuns for 1 turn', () => {
    const a = arena({ p0: [['stun.evolution']], p1: [['shot']] });
    a.use(A1, 'stun.evolution', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.pass(2);
    expect(() => a.use(B1, 'shot', A1)).not.toThrow();
  });

  it('Paralytic Bite I: Stuns Prey for 2 turns', () => {
    const a = arena({ p0: [['stun.evolution']], p1: [['shot']] });
    a.give(B1, 'prey').use(A1, 'stun.evolution', B1).end().pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.pass(2);
    expect(() => a.use(B1, 'shot', A1)).not.toThrow();
  });

  it('Paralytic Bite I: no Prey while Stunned yet; II: the target counts as Prey while Stunned', () => {
    const a = arena({ p0: [['stun.evolution']], p1: [['shot']] });
    a.use(A1, 'stun.evolution', B1).end();
    expect(isPrey(a, B1)).toBe(false);
    evolveTo(a, A1, 'stun.evolution', 2, B1);
    a.use(A1, 'stun.evolution', B1).end();
    expect(isPrey(a, B1)).toBe(true);
    a.pass(1);
    expect([a.has(B1, 'stun'), isPrey(a, B1)]).toEqual([false, false]);
  });

  it('Paralytic Bite III: when the Stun ends, a random Prey ally of theirs is Stunned for 1 turn', () => {
    const a = arena({ p0: [['stun.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    evolveTo(a, A1, 'stun.evolution', 3, B1);
    a.give(B2, 'prey');
    a.use(A1, 'stun.evolution', B1).end().pass(1);
    expect([a.has(B1, 'stun'), a.has(B2, 'stun'), a.has(B3, 'stun')]).toEqual([false, true, false]);
    a.pass(1);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBeTruthy();
    expect(() => a.use(B1, 'shot', A1)).not.toThrow();
  });

  // ---------------------------------------------------------------- Dance
  it('Adaptive Hide: 1 Swiftness at the start of each of the user’s turns for 3 turns', () => {
    const a = arena({ p0: [['dance.evolution']], p1: [['shot']] });
    a.use(A1, 'dance.evolution').end();
    expect(a.has(A1, 'swiftness')).toBe(false);
    a.pass(1);
    expect(a.stacks(A1, 'swiftness')).toBeGreaterThanOrEqual(1);
  });

  it('Adaptive Hide: each damaging enemy skill learns 5 less per hit, kept for the match, per skill', () => {
    const a = arena({ p0: [['dance.evolution']], p1: [['shot', 'bolt']], hp: 500 });
    a.give(B1, 'might', { stacks: 3 }); // Shot deals 30
    a.use(A1, 'dance.evolution').end();
    const hits: number[] = [];
    for (let i = 0; i < 3; i++) {
      const hp = a.hp(A1);
      a.use(B1, 'shot', A1).end().pass(1);
      hits.push(hp - a.hp(A1));
    }
    expect(hits).toEqual([30, 25, 20]);
    // Hide over (3 turns): the 15 learned stays, but no more is learned.
    for (let i = 0; i < 2; i++) {
      const hp = a.hp(A1);
      a.use(B1, 'shot', A1).end().pass(1);
      hits.push(hp - a.hp(A1));
    }
    expect(hits.slice(3)).toEqual([15, 15]);
    const hp = a.hp(A1);
    a.use(B1, 'bolt', A1).end(); // a different skill learned nothing
    expect(hp - a.hp(A1)).toBe(40);
  });

  // ---------------------------------------------------------------- Heal
  it('Regenerate I: heals 20 and leaves Toxin', () => {
    const a = arena({ p0: [['heal.evolution'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'toxin', { stacks: 2, source: B1 }).use(A1, 'heal.evolution', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'toxin')]).toEqual([70, 2]);
  });

  it('Regenerate II: removes the Toxin and heals 10 more per stack', () => {
    const a = arena({ p0: [['heal.evolution'], ['shot']], p1: [['shot']] });
    evolveTo(a, A1, 'heal.evolution', 2, A2);
    a.setHp(A2, 30).give(A2, 'toxin', { stacks: 2, source: B1 }).use(A1, 'heal.evolution', A2).end();
    expect([a.hp(A2), a.has(A2, 'toxin')]).toEqual([70, false]);
  });

  it('Regenerate III: the same healing repeats at the start of their next turn, once', () => {
    const a = arena({ p0: [['heal.evolution'], ['shot']], p1: [['shot']] });
    evolveTo(a, A1, 'heal.evolution', 3, A2);
    a.setHp(A2, 10).give(A2, 'toxin', { stacks: 2, source: B1 }).use(A1, 'heal.evolution', A2).end();
    expect(a.hp(A2)).toBe(50);
    a.pass(1);
    expect(a.hp(A2)).toBe(90);
    a.setHp(A2, 10).pass(2);
    expect(a.hp(A2)).toBe(10);
  });

  // ---------------------------------------------------------------- Bless
  it('Hormesis: 1 Might, and Toxin heals instead of harming, for 3 turns', () => {
    const a = arena({ p0: [['bless.evolution'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'toxin', { stacks: 2, source: B1 });
    a.use(A1, 'bless.evolution', A2).end();
    expect(a.stacks(A2, 'might')).toBe(1);
    a.end();
    expect(a.hp(A2)).toBe(60);
    a.pass(4); // turns 4 and 6 still covered
    expect(a.hp(A2)).toBe(80);
    a.pass(2);
    expect([a.hp(A2), a.has(A2, 'hormesis'), a.has(A2, 'might')]).toEqual([70, false, false]);
  });

  it('Hormesis: only the blessed ally', () => {
    const a = arena({ p0: [['bless.evolution'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'toxin', { stacks: 2, source: B1 });
    a.use(A1, 'bless.evolution', A2).end().end();
    expect(a.hp(A1)).toBe(40);
  });

  // ---------------------------------------------------------------- Curse
  it('Delirium: 1 Confusion for 2 turns; meanwhile each Debuff stack counts as 2 toward Prey', () => {
    const a = arena({ p0: [['curse.evolution']], p1: [['shot'], ['shot']] });
    a.give(B1, 'weakness').give(B2, 'weakness').give(B2, 'confusion');
    expect(isPrey(a, B1)).toBe(false);
    a.use(A1, 'curse.evolution', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
    expect([isPrey(a, B1), isPrey(a, B2)]).toEqual([true, false]); // 2 stacks ×2 vs 2 stacks plain
    a.pass(3);
    expect(isPrey(a, B1)).toBe(false);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Delirium: a single Debuff stack (counts as 2) is not Prey', () => {
    const a = arena({ p0: [['curse.evolution']], p1: [['shot']] });
    a.use(A1, 'curse.evolution', B1).end();
    expect(isPrey(a, B1)).toBe(false);
  });

  // ---------------------------------------------------------------- Smite
  it('Stalking Mark I: 15 damage; for 1 turn, each ally hit on the target gives 1 Vulnerable (no Toxin)', () => {
    const a = arena({ p0: [['smite.evolution'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smite.evolution', B1).use(A2, 'shot', B1).use(A3, 'shot', B2).end();
    expect(a.hp(B1)).toBe(70);
    expect([a.stacks(B1, 'vulnerable'), a.has(B1, 'toxin'), a.has(B2, 'vulnerable')]).toEqual([1, false, false]);
    a.pass(1);
    const v = a.stacks(B1, 'vulnerable');
    a.use(A2, 'shot', B1).end(); // the mark is gone: no new Vulnerable
    expect(a.stacks(B1, 'vulnerable')).toBe(v);
  });

  it('Stalking Mark: evolves when it triggers, not when used', () => {
    const a = arena({ p0: [['smite.evolution'], ['shot']], p1: [['shot']], hp: 500 });
    a.use(A1, 'smite.evolution', B1).end(); // used, never triggered
    ready(a, A1, 'smite.evolution');
    a.use(A1, 'smite.evolution', B1).use(A2, 'shot', B1).end(); // still Stage I
    expect(a.has(B1, 'toxin')).toBe(false);
    ready(a, A1, 'smite.evolution');
    a.use(A1, 'smite.evolution', B1).use(A2, 'shot', B1).end(); // triggered once before: Stage II
    expect(a.stacks(B1, 'toxin')).toBe(1);
  });

  it('Stalking Mark III: the mark lasts 2 turns', () => {
    const a = arena({ p0: [['smite.evolution'], ['shot']], p1: [['shot']], hp: 500 });
    for (let i = 0; i < 2; i++) {
      ready(a, A1, 'smite.evolution');
      a.use(A1, 'smite.evolution', B1).use(A2, 'shot', B1).end();
    }
    ready(a, A1, 'smite.evolution');
    a.state.effects = a.state.effects.filter((e) => e.bearer !== B1 || e.defId.startsWith('smite') === false && e.defId !== 'vulnerable' && e.defId !== 'toxin');
    a.use(A1, 'smite.evolution', B1).end().pass(1);
    a.use(A2, 'shot', B1).end(); // the following own turn: still marked
    expect(a.stacks(B1, 'vulnerable')).toBe(1);
  });

  // ---------------------------------------------------------------- Prayer
  it('Symbiotic Song I: all allies gain 2 Renew, all enemies 1 Toxin', () => {
    const a = arena({ p0: [['prayer.evolution'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'prayer.evolution').end();
    expect([a.stacks(A1, 'renew'), a.stacks(A2, 'renew')]).toEqual([1, 1]); // 2, then ticked once
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([1, 1]);
  });

  it('Symbiotic Song II: for 2 turns, each enemy Toxin tick heals a random ally 5', () => {
    const total = (a: Arena) => a.hp(A1) + a.hp(A2);
    const base = arena({ p0: [['prayer.evolution'], ['shot']], p1: [['shot'], ['shot']] });
    base.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.evolution').end();
    expect(total(base)).toBe(100 + 20); // Stage I: Renew only

    const a = arena({ p0: [['prayer.evolution'], ['shot']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'prayer.evolution', 2);
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.evolution').end();
    expect(total(a)).toBe(100 + 20 + 10); // + two Toxin ticks
  });

  it("Symbiotic Song III: first, the allies' Toxin moves onto random enemies", () => {
    const a = arena({ p0: [['prayer.evolution'], ['shot']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'prayer.evolution', 3);
    a.give(A2, 'toxin', { stacks: 2, source: B1 }).use(A1, 'prayer.evolution').end();
    expect(a.has(A2, 'toxin')).toBe(false);
    expect(a.stacks(B1, 'toxin') + a.stacks(B2, 'toxin')).toBe(2 + 2);
  });

  // ---------------------------------------------------------------- Cleave
  it('Thrashing Tail I: 15 to all enemies; hitting Prey resets its cooldown', () => {
    const a = arena({ p0: [['cleave.evolution']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.evolution').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
    expect(a.cooldown(A1, 'cleave.evolution')).toBeGreaterThan(0);
    const b = arena({ p0: [['cleave.evolution']], p1: [['shot'], ['shot']] });
    b.give(B2, 'prey').use(A1, 'cleave.evolution').end();
    expect(b.cooldown(A1, 'cleave.evolution')).toBe(0);
  });

  it('Thrashing Tail II: if it hits no Prey, an enemy with Toxin becomes Prey for 1 turn', () => {
    const a = arena({ p0: [['cleave.evolution']], p1: [['shot'], ['shot'], ['shot']] });
    evolveTo(a, A1, 'cleave.evolution', 2);
    a.give(B2, 'toxin', { source: A1 }).use(A1, 'cleave.evolution').end();
    expect([isPrey(a, B1), isPrey(a, B2), isPrey(a, B3)]).toEqual([false, true, false]);
    a.pass(1);
    expect(isPrey(a, B2)).toBe(false);
  });

  it('Thrashing Tail III: Prey take 10 more', () => {
    const a = arena({ p0: [['cleave.evolution']], p1: [['shot'], ['shot']] });
    evolveTo(a, A1, 'cleave.evolution', 3);
    a.give(B1, 'prey').use(A1, 'cleave.evolution').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  // ---------------------------------------------------------------- Shout
  it('Festering Howl: all enemies Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.evolution']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.evolution').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.has(A1, 'intimidated')]).toEqual([true, true, false]);
    a.pass(3);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it("Festering Howl: meanwhile their Toxin can't be removed; afterwards it can", () => {
    const a = arena({ p0: [['shout.evolution'], ['consume.evolution']], p1: [['shot']], hp: 200 });
    a.give(B1, 'toxin', { stacks: 3, source: A1 });
    a.use(A1, 'shout.evolution').use(A2, 'consume.evolution', B1).end();
    expect(a.stacks(B1, 'toxin')).toBe(3);
    a.pass(4);
    ready(a, A2, 'consume.evolution').use(A2, 'consume.evolution', B1).end();
    expect(a.has(B1, 'toxin')).toBe(false);
  });

  // BUG: "can't be moved": Slough Off II leaves the protected Toxin on the bearer but still gives the attacker a copy.
  it.fails("Festering Howl: their Toxin can't be moved (Slough Off II)", () => {
    const a = arena({ p0: [['shout.evolution', 'shot']], p1: [['maneuver.evolution']] });
    a.use(A1, 'shot', B1).end(); // A1 is the last enemy who damaged B1
    a.use(B1, 'maneuver.evolution').end(); // B1's Slough Off is now at Stage II
    for (let i = 0; i < 2; i++) a.pass(2);
    a.give(B1, 'toxin', { stacks: 2, source: A1 }).use(A1, 'shout.evolution').end();
    a.state.effects = a.state.effects.filter((e) => !(e.bearer === B1 && e.defId === 'toxin') || e.stacks === 2);
    a.use(B1, 'maneuver.evolution').end();
    expect([a.stacks(B1, 'toxin'), a.has(A1, 'toxin')]).toEqual([2, false]);
  });

  // ---------------------------------------------------------------- Withstand
  it('Exoskeleton: 15 Shield and 1 Armor for 2 turns', () => {
    const a = arena({ p0: [['withstand.evolution']], p1: [['shot']] });
    a.use(A1, 'withstand.evolution').end();
    expect([shieldOn(a, A1), a.stacks(A1, 'armor')]).toEqual([15, 1]);
    a.pass(3);
    expect([shieldOn(a, A1), a.has(A1, 'armor')]).toEqual([0, false]);
  });

  it('Exoskeleton: each Weakness on the attacker lowers their damage by 10 instead of 5', () => {
    const eff = (a: Arena) => a.hp(A1) + shieldOn(a, A1);
    const plain = arena({ p0: [['withstand.evolution']], p1: [['bolt']] });
    plain.setHp(A1, 50).use(A1, 'withstand.evolution').end();
    plain.use(B1, 'bolt', A1).end();
    expect(eff(plain)).toBe(65 - (25 - 5)); // no Weakness: just Armor

    const a = arena({ p0: [['withstand.evolution']], p1: [['bolt']] });
    a.setHp(A1, 50).give(B1, 'weakness').use(A1, 'withstand.evolution').end();
    a.use(B1, 'bolt', A1).end();
    expect(eff(a)).toBe(65 - (25 - 10 - 5));
  });

  it('Exoskeleton: after it ends, Weakness is back to 5', () => {
    const a = arena({ p0: [['withstand.evolution']], p1: [['bolt']] });
    a.give(B1, 'weakness').use(A1, 'withstand.evolution').end().pass(4);
    a.use(B1, 'bolt', A1).end();
    expect(a.hp(A1)).toBe(80);
  });

  // ---------------------------------------------------------------- Taunt
  it('Hypnotic Hood: Taunted (can only target the user) and Prey for 2 turns', () => {
    const a = arena({ p0: [['taunt.evolution'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.evolution', B1).end();
    expect([a.has(B1, 'taunt'), isPrey(a, B1)]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // can only target the taunter
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.pass(2);
    expect([a.has(B1, 'taunt'), isPrey(a, B1)]).toEqual([false, false]);
  });

  it('Hypnotic Hood: a target who damaged the user does not fall Asleep', () => {
    const a = arena({ p0: [['taunt.evolution']], p1: [['shot']] });
    a.use(A1, 'taunt.evolution', B1).end();
    a.use(B1, 'shot', A1).end().pass(2);
    expect(a.has(B1, 'sleep')).toBe(false);
  });

  it("Hypnotic Hood: if they don't damage the user, they fall Asleep for 2 turns when it ends", () => {
    const a = arena({ p0: [['taunt.evolution']], p1: [['shot']] });
    a.use(A1, 'taunt.evolution', B1).end().pass(3);
    expect(a.has(B1, 'sleep')).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.end().pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.end().pass(1);
    expect(() => a.use(B1, 'shot', A1)).not.toThrow();
  });

  // ---------------------------------------------------------------- Titan
  it('Chrysalis: Stunned and Invulnerable through the user’s next turn, then 3 Armor, 2 Might and Immune', () => {
    const a = arena({ p0: [['titan.evolution', 'shot']], p1: [['shot', 'curse']] });
    a.use(A1, 'titan.evolution').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'stun')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBeTruthy();
    a.end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'stun')]).toEqual([false, false]);
    expect([a.stacks(A1, 'armor'), a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([3, 2, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.pass(10);
    expect([a.has(A1, 'armor'), a.has(A1, 'might'), a.has(A1, 'immune')]).toEqual([false, false, false]);
  });
});

describe('Evolution costs and cooldowns (kit table)', () => {
  const kit: [string, string, number][] = [
    ['strike', 'W', 0], ['smash', 'Sr', 2], ['charge', 'S', 1], ['riposte', 'W', 2], ['rage', 'S', 3],
    ['shot', 'r', 1], ['snipe', 'Ar', 1], ['trap', 'W', 2], ['maneuver', 'W', 2], ['companion', 'I', 1],
    ['bolt', 'I', 1], ['blast', 'II', 3], ['consume', 'W', 2], ['summon', 'W', 2], ['channel', 'Wrr', 5],
    ['stab', 'r', 0], ['ravage', 'Ar', 1], ['mislead', 'W', 2], ['stun', 'W', 3], ['dance', 'AA', 4],
    ['heal', 'W', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'Wr', 1], ['prayer', 'Wr', 2],
    ['cleave', 'S', 2], ['shout', 'W', 3], ['withstand', 'W', 2], ['taunt', 'r', 3], ['titan', 'W', 4],
  ];
  const parse = (s: string) => {
    const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    for (const ch of s) c[ch as keyof typeof c] += 1;
    return c;
  };
  it.each(kit)('%s.evolution costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.evolution`]!;
    expect(s.cost).toEqual(parse(cost));
    expect(s.cooldown).toBe(cd);
  });

  it('minion skills: Feed costs r, Nibble costs W', () => {
    expect(content.skills.parasite_feed!.cost).toEqual(parse('r'));
    expect(content.skills.larva_nibble!.cost).toEqual(parse('W'));
  });
});
