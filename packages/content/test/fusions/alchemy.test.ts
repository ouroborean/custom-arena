// Spec tests for Alchemy (Fire + Water): Catalyst, Transmute and all 30 variants.
// Sources: skill/status descriptions, glossary, docs/rules.md §21.12, fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Reminders: Renew heals 5 per stack at the end of its applier's turn, then loses a stack; Ignite ticks
// 5 Affliction at the end of its applier's turn. Statuses placed with `give` use the given source.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const shieldOf = (a: ReturnType<typeof arena>, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.shield).reduce((n, e) => n + e.value, 0);
const minion = (a: ReturnType<typeof arena>, defId: string) =>
  a.state.units.find((u) => u.owner === 0 && u.defId === defId)!;

describe('Alchemy: Catalyst', () => {
  it('on an enemy it is a Debuff that doubles the next skill’s damage on them, then ends', () => {
    const a = arena({ p0: [['bolt.alchemy'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.alchemy', B1).end();
    expect([a.hp(B1), a.has(B1, 'catalyst_debuff'), a.has(B1, 'catalyst')]).toEqual([80, true, false]);
    expect(content.statuses.catalyst_debuff?.kind).toBe('Debuff');
    a.pass(1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'catalyst_debuff')]).toEqual([80 - 30 - 15, false]);
  });

  it('on an ally it is a Buff that doubles healing', () => {
    const a = arena({ p0: [['summon.alchemy'], ['heal']], p1: [['shot']] });
    a.use(A1, 'summon.alchemy').end().pass(1);
    const alembic = minion(a, 'alembic');
    a.setHp(A2, 20).use(alembic.id, 'alembic_brew', A2).use(A2, 'heal', A2).end();
    expect(a.has(A2, 'catalyst')).toBe(false); // spent
    expect(a.hp(A2)).toBe(20 + 50);
  });

  it('doubles the stacks of what the skill applies', () => {
    const a = arena({ p0: [['bolt.alchemy'], ['curse']], p1: [['shot']] });
    a.use(A1, 'bolt.alchemy', B1).use(A2, 'curse', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(2);
  });

  it('doubles the duration of what the skill applies', () => {
    const a = arena({ p0: [['bolt.alchemy'], ['curse']], p1: [['shot']] });
    a.use(A1, 'bolt.alchemy', B1).use(A2, 'curse', B1).end();
    a.pass(4); // a plain Curse's 2 turns are over
    expect(a.has(B1, 'confusion')).toBe(true);
    a.pass(4);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('lasts 2 turns if unspent', () => {
    const a = arena({ p0: [['bolt.alchemy']], p1: [['shot']] });
    a.use(A1, 'bolt.alchemy', B1).end().pass(2);
    expect(a.has(B1, 'catalyst_debuff')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'catalyst_debuff')).toBe(false);
  });

  it('only the next skill is doubled', () => {
    const a = arena({ p0: [['summon.alchemy'], ['heal'], ['heal']], p1: [['shot']] });
    a.use(A1, 'summon.alchemy').end().pass(1);
    a.setHp(A1, 10).use(minion(a, 'alembic').id, 'alembic_brew', A1).use(A2, 'heal', A1).use(A3, 'heal', A1).end();
    expect(a.hp(A1)).toBe(10 + 50 + 25);
  });
});

describe('Alchemy: Transmute (enemy recipes, via Gold into Lead)', () => {
  it('Might → Weakness, Armor → Vulnerable, Focus → Confusion, Renew → Weakness, stack for stack', () => {
    const a = arena({ p0: [['curse.alchemy']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 2 }).give(B1, 'armor').give(B1, 'focus').give(B1, 'renew', { stacks: 3, source: B1 });
    a.use(A1, 'curse.alchemy', B1).end();
    expect(['might', 'armor', 'focus', 'renew'].map((s) => a.has(B1, s))).toEqual([false, false, false, false]);
    expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable'), a.stacks(B1, 'confusion')]).toEqual([5, 1, 1]);
  });

  it('keeps the time left on the converted effect', () => {
    const a = arena({ p0: [['curse.alchemy']], p1: [['shot']] });
    a.give(B1, 'might', { duration: 3 }).use(A1, 'curse.alchemy', B1).end();
    expect(a.has(B1, 'weakness')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'weakness')).toBe(false);
  });
});

describe('Alchemy skills', () => {
  it('Calcining Blow: 20 with no Ignite to tick', () => {
    const a = arena({ p0: [['strike.alchemy']], p1: [['shot']] });
    a.give(B1, 'might').give(B1, 'focus').use(A1, 'strike.alchemy', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Calcining Blow: the Ignite ticks at once, plus once more per Buff', () => {
    const a = arena({ p0: [['strike.alchemy']], p1: [['shot']] });
    a.give(B1, 'ignite', { source: B1 }).give(B1, 'might').give(B1, 'focus');
    a.use(A1, 'strike.alchemy', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 5 - 10);
  });

  it('Calcining Blow: at most 3 extra ticks', () => {
    const a = arena({ p0: [['strike.alchemy']], p1: [['shot']] });
    a.give(B1, 'ignite', { source: B1 });
    for (const s of ['might', 'focus', 'swiftness', 'immune', 'ghosted']) a.give(B1, s);
    a.use(A1, 'strike.alchemy', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 5 - 15);
  });

  it('Kiln Crash: 25 to the target; their allies take no damage but each gains Catalyst (2 turns)', () => {
    const a = arena({ p0: [['smash.alchemy'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.alchemy', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 100, 100]);
    expect([a.has(B1, 'catalyst_debuff'), a.has(B2, 'catalyst_debuff'), a.has(B3, 'catalyst_debuff')]).toEqual([false, true, true]);
    a.pass(1).use(A2, 'shot', B2).end(); // the Catalyst doubles the next hit
    expect([a.hp(B2), a.has(B2, 'catalyst_debuff')]).toEqual([70, false]);
  });

  it('Kiln Crash: a Catalyst already on the target doubles the crash itself', () => {
    const a = arena({ p0: [['smash.alchemy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'catalyst_debuff', { source: A1, duration: 4 }).use(A1, 'smash.alchemy', B1).end();
    expect(a.hp(B1)).toBe(50);
  });

  it('Steam Rush: 15 and 1 Focus for the next skill', () => {
    const a = arena({ p0: [['charge.alchemy', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.alchemy', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'focus')]).toEqual([85, 1]);
    a.pass(1).use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
  });

  it('Steam Rush: 1 Renew per Ignited enemy', () => {
    const a = arena({ p0: [['charge.alchemy']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B1 }).give(B3, 'ignite', { source: B3 });
    a.setHp(A1, 50).use(A1, 'charge.alchemy', B2).end();
    // 2 Renew, ticking once at the end of the user's turn: +10 and one stack left
    expect([a.hp(A1), a.stacks(A1, 'renew')]).toEqual([60, 1]);
    const b = arena({ p0: [['charge.alchemy']], p1: [['shot']] });
    b.use(A1, 'charge.alchemy', B1).end();
    expect(b.has(A1, 'renew')).toBe(false);
  });

  it('Reactive Flask: Invisible; counters the first Harmful skill on the user; its user gains Catalyst', () => {
    const a = arena({ p0: [['riposte.alchemy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.alchemy').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'catalyst_debuff'), a.has(B2, 'catalyst_debuff')]).toEqual([85, true, false]); // only the first
  });

  it("Reactive Flask: the attacker's Might, Armor, Focus and Renew are Transmuted; other Buffs stay", () => {
    const a = arena({ p0: [['riposte.alchemy']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 2 }).give(B1, 'armor').give(B1, 'swiftness');
    a.use(A1, 'riposte.alchemy').end();
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable'), a.has(B1, 'might'), a.has(B1, 'armor'), a.has(B1, 'swiftness')]).toEqual([2, 1, false, false, true]);
  });

  it('Magnum Opus: 2 Might for 3 turns, and Catalyst at the start of each of the user’s turns', () => {
    const a = arena({ p0: [['rage.alchemy']], p1: [['shot']] });
    a.use(A1, 'rage.alchemy').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'catalyst')]).toEqual([2, false]);
    a.end();
    expect(a.has(A1, 'catalyst')).toBe(true);
    a.pass(4);
    expect(a.has(A1, 'might')).toBe(false);
  });

  it('Vial Toss: 15 and Ignite', () => {
    const a = arena({ p0: [['shot.alchemy']], p1: [['shot']] });
    a.use(A1, 'shot.alchemy', B1).end();
    expect([a.hp(B1), a.has(B1, 'ignite')]).toEqual([80, true]);
  });

  it('Vial Toss: if that Ignite is removed within 2 turns, they Explode (on the bearer’s side)', () => {
    const a = arena({ p0: [['shot.alchemy'], ['ravage.apocalypse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.alchemy', B1).end().end();
    const before = a.hp(B1);
    a.use(A2, 'ravage.apocalypse', B1).end(); // Twofold Ruin removes the Ignite (20 + 10 for it)
    expect([before - a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([30 + 10, 90, 100, 100]);
  });

  it('Vial Toss: a cleanse that removes the Ignite also sets off the Explosion', () => {
    const a = arena({ p0: [['shot.alchemy'], ['shot']], p1: [['rage.wind'], ['shot']] });
    a.use(A1, 'shot.alchemy', B1).end();
    a.use(B1, 'rage.wind').end(); // cleanses the Ignite
    expect(a.has(B1, 'ignite')).toBe(false);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([70, 90, 100, 100]);
  });

  it('Vial Toss: no Explosion while the Ignite stays', () => {
    const a = arena({ p0: [['shot.alchemy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shot.alchemy', B1).end().pass(2);
    expect(a.hp(B2)).toBe(100);
  });

  it('Vial Toss: removing the Ignite after the 2 turns causes no Explosion', () => {
    const a = arena({ p0: [['shot.alchemy']], p1: [['rage.wind'], ['shot']] });
    a.use(A1, 'shot.alchemy', B1).end().pass(4);
    a.use(B1, 'rage.wind').end().end();
    expect(a.hp(B2)).toBe(100);
  });

  it('Distilled Arrow: 40 on the following turn, hidden target', () => {
    const a = arena({ p0: [['snipe.alchemy']], p1: [['shot']] });
    a.use(A1, 'snipe.alchemy', B1).end();
    expect(viewFor(content, a.state, 1).effects.filter((e) => e.bearer === A1).every((e) => e.targets.length === 0)).toBe(true);
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Distilled Arrow: plus the healing the target received in the meantime', () => {
    const a = arena({ p0: [['snipe.alchemy']], p1: [['heal']] });
    a.setHp(B1, 50).use(A1, 'snipe.alchemy', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(50 + 25 - 40 - 25);
  });

  it('Volatile Compound: using a skill gives the target Catalyst', () => {
    const a = arena({ p0: [['trap.alchemy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.alchemy', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'shot', A1).end();
    expect([a.has(B1, 'catalyst_debuff'), a.hp(A1), a.hp(B2)]).toEqual([true, 85, 100]);
  });

  it('Volatile Compound: if they already had Catalyst, it reacts: they Explode on their own side', () => {
    const a = arena({ p0: [['trap.alchemy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.alchemy', B1).end();
    a.use(B1, 'shot', A1).end().end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B2)).toBe(90);
    expect(a.hp(B1)).toBeLessThanOrEqual(90);
    expect(a.hp(A1)).toBe(70); // the Explosion doesn't touch the trap owner's side
  });

  it('Volatile Compound: lasts 2 turns', () => {
    const a = arena({ p0: [['trap.alchemy']], p1: [['shot']] });
    a.use(A1, 'trap.alchemy', B1).end().pass(4);
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'catalyst_debuff')).toBe(false);
  });

  it('Sublimate: Invulnerable for 1 turn; Debuffs removed, a random enemy gains Catalyst for each', () => {
    const a = arena({ p0: [['maneuver.alchemy']], p1: [['shot']] });
    a.give(A1, 'weakness', { source: B1 }).give(A1, 'scorched', { source: B1 });
    a.use(A1, 'maneuver.alchemy').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'weakness'), a.has(A1, 'scorched')]).toEqual([true, false, false]);
    expect(a.has(B1, 'catalyst_debuff')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  it('Sublimate: one Debuff gives Catalyst to exactly one enemy; none gives none', () => {
    const a = arena({ p0: [['maneuver.alchemy']], p1: [['shot'], ['shot']] });
    a.give(A1, 'weakness', { source: B1 }).use(A1, 'maneuver.alchemy').end();
    expect([B1, B2].filter((u) => a.has(u, 'catalyst_debuff'))).toHaveLength(1);
    const b = arena({ p0: [['maneuver.alchemy']], p1: [['shot'], ['shot']] });
    b.use(A1, 'maneuver.alchemy').end();
    expect([B1, B2].filter((u) => b.has(u, 'catalyst_debuff'))).toHaveLength(0);
  });

  it('Homunculus: 30 HP, permanent; each of your turns one enemy Might stack is Transmuted and an ally gains Renew', () => {
    const a = arena({ p0: [['companion.alchemy']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 3 }).use(A1, 'companion.alchemy').end().pass(2);
    const h = minion(a, 'homunculus');
    expect(h.hp).toBe(30);
    const w = a.stacks(B1, 'weakness');
    expect(w).toBeGreaterThanOrEqual(1);
    expect(a.stacks(B1, 'might') + w).toBe(3); // one stack at a time
    expect(a.log().some((l) => /gains Renew/.test(l))).toBe(true);
    a.pass(10);
    expect(a.unit(h.id).alive).toBe(true);
  });

  it('Homunculus: Buffs without a recipe are left alone', () => {
    const a = arena({ p0: [['companion.alchemy']], p1: [['shot']] });
    a.give(B1, 'swiftness').use(A1, 'companion.alchemy').end().pass(2);
    expect([a.has(B1, 'swiftness'), a.has(B1, 'weakness')]).toEqual([true, false]);
  });

  it('Quicksilver Bolt: 20, and an enemy without Catalyst gains it', () => {
    const a = arena({ p0: [['bolt.alchemy']], p1: [['shot']] });
    a.use(A1, 'bolt.alchemy', B1).end();
    expect([a.hp(B1), a.has(B1, 'catalyst_debuff')]).toEqual([80, true]);
  });

  it('Quicksilver Bolt: against Catalyst, the doubled hit Transmutes one Buff (and gives no new Catalyst)', () => {
    const a = arena({ p0: [['bolt.alchemy'], ['bolt.alchemy']], p1: [['shot']] });
    a.give(B1, 'might');
    a.use(A1, 'bolt.alchemy', B1).use(A2, 'bolt.alchemy', B1).end();
    expect([a.hp(B1), a.has(B1, 'might'), a.stacks(B1, 'weakness'), a.has(B1, 'catalyst_debuff')]).toEqual([
      40,
      false,
      1,
      false,
    ]);
  });

  it('Chain Reaction: 20 to all; each enemy with Catalyst Explodes', () => {
    const a = arena({ p0: [['blast.alchemy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'catalyst_debuff', { source: A1, duration: 4 });
    a.use(A1, 'blast.alchemy').end();
    expect(a.hp(B2)).toBe(100 - 20 - 10);
    expect(a.hp(B1)).toBeLessThanOrEqual(100 - 40 - 10); // its own hit doubled by the Catalyst
  });

  it('Chain Reaction: no Catalyst, no Explosion', () => {
    const a = arena({ p0: [['blast.alchemy']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.alchemy').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Essence Extraction: 5 and heals as much; 10 max HP moves from the enemy to the user', () => {
    const a = arena({ p0: [['consume.alchemy']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.alchemy', B1).end();
    expect([a.hp(A1), a.unit(A1).maxHp, a.unit(B1).maxHp]).toEqual([55, 110, 90]);
    expect(a.hp(B1)).toBe(90); // 95, capped at the new max
  });

  it('Essence Extraction: up to 30 per enemy, and the cap is per enemy', () => {
    const a = arena({ p0: [['consume.alchemy']], p1: [['shot'], ['shot']] });
    for (let i = 0; i < 4; i++) a.use(A1, 'consume.alchemy', B1).end().pass(5);
    expect([a.unit(A1).maxHp, a.unit(B1).maxHp]).toEqual([130, 70]);
    a.use(A1, 'consume.alchemy', B2).end();
    expect([a.unit(A1).maxHp, a.unit(B2).maxHp]).toEqual([140, 90]);
  });

  it('Alembic: 15 HP for 3 turns; Brew (no cost) gives Catalyst to an ally (Buff) or an enemy (Debuff)', () => {
    const a = arena({ p0: [['summon.alchemy'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.alchemy').end().pass(1);
    const al = minion(a, 'alembic');
    expect(al.hp).toBe(15);
    expect(Object.values(content.skills.alembic_brew?.cost ?? {}).reduce((n, v) => n + Number(v), 0)).toBe(0);
    a.use(al.id, 'alembic_brew', A2).end().pass(1);
    expect(a.has(A2, 'catalyst')).toBe(true);
    a.use(al.id, 'alembic_brew', B1).end();
    expect(a.has(B1, 'catalyst_debuff')).toBe(true);
    a.pass(3);
    expect(a.unit(al.id).alive).toBe(false);
  });

  it('Slow Distillation: nothing while it brews; run its course (3 turns), it releases 30 to every enemy and 15 healing to every ally', () => {
    const a = arena({ p0: [['channel.alchemy'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'channel.alchemy').end().pass(4);
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([100, 100, 50]);
    a.pass(1); // the 3rd turn's countdown ends it
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([70, 70, 65, 65]);
    a.pass(4);
    expect(a.hp(B1)).toBe(70); // once
  });

  it('Slow Distillation: using another skill breaks it early and releases what has brewed so far', () => {
    const a = arena({ p0: [['channel.alchemy', 'shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'channel.alchemy').end().pass(3); // 2 turns brewed
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([100 - 20 - 15, 60]);
  });

  it('Slow Distillation: Channeled: a Stun breaks it early too', () => {
    const a = arena({ p0: [['channel.alchemy']], p1: [['stun']] });
    a.use(A1, 'channel.alchemy').end();
    a.use(B1, 'stun', A1).end(); // 1 turn brewed
    expect(a.hp(B1)).toBe(90);
  });

  it('Probing Lancet: a target with no more Buffs than Debuffs takes 20 (the weak spot)', () => {
    const a = arena({ p0: [['stab.alchemy'], ['stab.alchemy']], p1: [['shot'], ['shot']] });
    a.give(B2, 'might').give(B2, 'weakness').use(A1, 'stab.alchemy', B1).use(A2, 'stab.alchemy', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'might')]).toEqual([80, 80, true]);
  });

  it('Probing Lancet: with more Buffs than Debuffs, 10 and one Buff is Transmuted (or removed, with no recipe)', () => {
    const a = arena({ p0: [['stab.alchemy'], ['stab.alchemy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'might', { stacks: 2 }).give(B2, 'swiftness');
    a.use(A1, 'stab.alchemy', B1).use(A2, 'stab.alchemy', B2).end();
    expect([a.hp(B1), a.has(B1, 'might'), a.stacks(B1, 'weakness')]).toEqual([90, false, 2]);
    expect([a.hp(B2), a.has(B2, 'swiftness')]).toEqual([90, false]);
  });

  it('Probing Lancet: can be countered now', () => {
    expect(content.skills['stab.alchemy']!.tags).not.toContain('Uncounterable');
  });

  it("Boiling Point: 25 Piercing; boils off the user's Renew, ticking the target's Ignite once per stack", () => {
    const a = arena({ p0: [['ravage.alchemy']], p1: [['shot']] });
    a.give(A1, 'renew', { stacks: 3, source: B1 }).give(B1, 'ignite', { source: B1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.alchemy', B1).end();
    expect([a.hp(B1), a.has(A1, 'renew')]).toEqual([100 - 25 - 15, false]);
  });

  it('Boiling Point: at most 4 ticks; without an Ignite the Renew still boils off', () => {
    const a = arena({ p0: [['ravage.alchemy']], p1: [['shot'], ['shot']] });
    a.give(A1, 'renew', { stacks: 6, source: B1 }).give(B1, 'ignite', { source: B1 });
    a.use(A1, 'ravage.alchemy', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 20);
    const b = arena({ p0: [['ravage.alchemy']], p1: [['shot']] });
    b.give(A1, 'renew', { stacks: 2, source: B1 }).use(A1, 'ravage.alchemy', B1).end();
    expect([b.hp(B1), b.has(A1, 'renew')]).toEqual([75, false]);
  });

  it('Inversion Circle: a Helpful skill on the target is countered (Invisible until then)', () => {
    const a = arena({ p0: [['mislead.alchemy']], p1: [['heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.alchemy', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBeLessThanOrEqual(50);
  });

  it('Inversion Circle: a Helpful skill is countered; its targets take 15 Affliction and are Weakened for 1 turn', () => {
    const a = arena({ p0: [['mislead.alchemy']], p1: [['heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.alchemy', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
    a.use(B1, 'heal', B2).end();
    expect([a.hp(B2), a.stacks(B2, 'weakness')]).toEqual([35, 1]);
    a.pass(2); // applied on their own turn, it lasts through their next one (rules §8.1)
    expect(a.has(B2, 'weakness')).toBe(false);
  });

  it('Inversion Circle: Harmful skills are unaffected, and it lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.alchemy']], p1: [['heal', 'shot']] });
    a.use(A1, 'mislead.alchemy', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    const b = arena({ p0: [['mislead.alchemy']], p1: [['heal']] });
    b.setHp(B1, 50).use(A1, 'mislead.alchemy', B1).end().pass(2);
    b.use(B1, 'heal', B1).end();
    expect(b.hp(B1)).toBe(75);
  });

  it('Flash Powder: 15 and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.alchemy']], p1: [['shot']] });
    a.use(A1, 'stun.alchemy', B1).end();
    expect([a.hp(B1), a.has(B1, 'confusion')]).toEqual([85, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('Flash Powder: Swiftness cannot stop it; each Swiftness becomes 1 Confusion', () => {
    const a = arena({ p0: [['stun.alchemy']], p1: [['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).use(A1, 'stun.alchemy', B1).end();
    expect([a.has(B1, 'swiftness'), a.stacks(B1, 'confusion')]).toEqual([false, 2]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Quickening Draught: Catalyst now; next turn 1 Might, 2 Swiftness, 1 Focus, doubled if the Catalyst is unspent', () => {
    const a = arena({ p0: [['dance.alchemy']], p1: [['shot']] });
    a.use(A1, 'dance.alchemy').end();
    expect([a.has(A1, 'catalyst'), a.has(A1, 'might')]).toEqual([true, false]);
    a.end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([2, 4, 2]);
  });

  it('Quickening Draught: if the Catalyst was spent, the boons are not doubled; they last 3 turns', () => {
    const a = arena({ p0: [['dance.alchemy']], p1: [['shot']] });
    a.use(A1, 'dance.alchemy').end();
    a.use(B1, 'shot', A1).end(); // the Catalyst doubles this hit and is spent
    expect(a.hp(A1)).toBe(70);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 2, 1]);
    a.pass(5);
    expect([a.has(A1, 'might'), a.has(A1, 'swiftness'), a.has(A1, 'focus')]).toEqual([false, false, false]);
  });

  it('Panacea: heals 15; each Debuff becomes 2 Renew', () => {
    const a = arena({ p0: [['heal.alchemy'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'scorched', { source: B1 }).give(A2, 'stun', { source: B1 });
    a.use(A1, 'heal.alchemy', A2).end();
    expect([a.has(A2, 'scorched'), a.has(A2, 'stun')]).toEqual([false, false]);
    // 15 healing (Debuffs leave first, or the heal is halved), then 4 Renew tick once: +20, 3 left
    expect(a.stacks(A2, 'renew')).toBe(3);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(50 + 10 + 20);
  });

  it('Panacea: no Debuffs, no Renew', () => {
    const a = arena({ p0: [['heal.alchemy']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'heal.alchemy', A1).end();
    expect([a.hp(A1), a.has(A1, 'renew')]).toEqual([65, false]);
  });

  it('Universal Solvent: 1 Might for 3 turns, and the ally’s Normal damage becomes Piercing', () => {
    const a = arena({ p0: [['bless.alchemy'], ['shot']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'bless.alchemy', A2).use(A2, 'shot', B1).end();
    expect([a.stacks(A2, 'might'), a.hp(B1)]).toEqual([1, 80]);
    a.pass(5);
    expect(a.has(A2, 'might')).toBe(false);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80); // back to Normal: 15 - 15 Armor
  });

  it('Gold into Lead: Buffs without a recipe are removed; Debuffs are untouched', () => {
    const a = arena({ p0: [['curse.alchemy']], p1: [['shot']] });
    a.give(B1, 'swiftness').give(B1, 'immune').give(B1, 'scorched', { source: A1 });
    a.use(A1, 'curse.alchemy', B1).end();
    expect([a.has(B1, 'swiftness'), a.has(B1, 'immune'), a.has(B1, 'scorched')]).toEqual([false, false, true]);
  });

  it('Reagent Brand: 15 and Catalyst, which its own hit does not spend', () => {
    const a = arena({ p0: [['smite.alchemy']], p1: [['shot']] });
    a.use(A1, 'smite.alchemy', B1).end();
    expect([a.hp(B1), a.has(B1, 'catalyst_debuff')]).toEqual([85, true]);
  });

  it('Reagent Brand: 15 and Catalyst; for 1 turn each ally skill that damages them gives Catalyst again', () => {
    const a = arena({ p0: [['smite.alchemy'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.alchemy', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'catalyst_debuff')]).toEqual([100 - 15 - 30 - 30, true]);
  });

  it('Reagent Brand: the re-Catalyst rider is over after 1 turn', () => {
    const a = arena({ p0: [['smite.alchemy'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.alchemy', B1).end().pass(1);
    a.use(A2, 'shot', B1).end();
    expect(a.has(B1, 'catalyst_debuff')).toBe(false);
    expect(a.hp(B1)).toBe(100 - 15 - 30); // the brand's own Catalyst doubles this hit
  });

  it('Equivalent Exchange: allies heal 15; enemy Renew becomes Weakness; 1 Renew per 2 stacks to each ally', () => {
    const a = arena({ p0: [['prayer.alchemy'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'renew', { stacks: 3, source: B1 }).give(B2, 'renew', { stacks: 1, source: B2 });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.alchemy').end();
    expect([a.has(B1, 'renew'), a.stacks(B1, 'weakness'), a.stacks(B2, 'weakness')]).toEqual([false, 3, 1]);
    // 4 converted → 2 Renew each, ticking once at the end of the turn: +10, 1 left
    expect([a.hp(A1), a.hp(A2), a.stacks(A2, 'renew')]).toEqual([75, 75, 1]);
  });

  it('Splash Potion: 20 to the target, who is Weakened for 1 turn; with only that Debuff, 5 to every other enemy', () => {
    const a = arena({ p0: [['cleave.alchemy']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.alchemy', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp('p1c2'), a.stacks(B1, 'weakness')]).toEqual([80, 95, 95, 1]);
    a.end();
    expect(a.has(B1, 'weakness')).toBe(false); // 1 turn
  });

  it('Splash Potion: 5 to every other enemy per Debuff on the target', () => {
    const a = arena({ p0: [['cleave.alchemy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'scorched', { source: A1, duration: 4 }).use(A1, 'cleave.alchemy', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
  });

  it('Splash Potion: up to 15', () => {
    const a = arena({ p0: [['cleave.alchemy']], p1: [['shot'], ['shot']] });
    a.give(B1, 'scorched', { source: A1, duration: 4 }).give(B1, 'vulnerable', { source: A1, duration: 4 }).give(B1, 'confusion', { source: A1, duration: 4 });
    a.use(A1, 'cleave.alchemy', B1).end();
    expect(a.hp(B2)).toBe(85);
  });

  it('Souring Vapors: for 1 turn, every Buff an enemy gains is Transmuted on arrival', () => {
    const a = arena({ p0: [['shout.alchemy']], p1: [['strike'], ['shot']] });
    a.use(A1, 'shout.alchemy').end();
    a.use(B1, 'strike', A1).end();
    expect([a.has(B1, 'might'), a.stacks(B1, 'weakness')]).toEqual([false, 1]);
    a.end().use(B1, 'strike', A1).end();
    expect(a.stacks(B1, 'might')).toBe(1);
  });

  it('Steam Barrier: 25 Shield for 1 turn; what is left becomes Renew, 1 per 5', () => {
    const a = arena({ p0: [['withstand.alchemy']], p1: [['shot']] });
    a.use(A1, 'withstand.alchemy').end();
    expect(shieldOf(a, A1)).toBe(25);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), shieldOf(a, A1), a.stacks(A1, 'renew')]).toEqual([100, 0, 2]);
  });

  it('Steam Barrier: a broken Shield leaves no Renew', () => {
    const a = arena({ p0: [['withstand.alchemy']], p1: [['smash']] });
    a.use(A1, 'withstand.alchemy').end().use(B1, 'smash', A1).end();
    expect(a.has(A1, 'renew')).toBe(false);
  });

  it('Lure Flask: Taunts for 2 turns; the user heals half of each hit from the Taunted enemy', () => {
    const a = arena({ p0: [['taunt.alchemy'], ['shot']], p1: [['strike'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'taunt.alchemy', B1).end();
    expect(a.reject(() => a.use(B1, 'strike', A2))).toBe('bad_target');
    a.use(B1, 'strike', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(50 - 20 + 10 - 15);
    a.pass(3);
    a.use(B1, 'strike', A2);
    expect(a.state.players[1].queue).toHaveLength(1);
  });

  it('The Great Work: 2 Armor and Immune for the rest of the match, and no other Buff', () => {
    const a = arena({ p0: [['titan.alchemy', 'strike']], p1: [['curse']] });
    a.use(A1, 'titan.alchemy').end().use(B1, 'curse', A1).end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), a.has(A1, 'confusion')]).toEqual([2, true, false]);
    a.use(A1, 'strike', B1).end();
    expect(a.has(A1, 'might')).toBe(false);
    a.pass(20);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([2, true]);
  });
});

describe('Alchemy costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['I', 0],
    smash: ['Sr', 2],
    charge: ['S', 2],
    riposte: ['r', 3],
    rage: ['SS', 4],
    shot: ['r', 1],
    snipe: ['Ir', 2],
    trap: ['A', 3],
    maneuver: ['I', 3],
    companion: ['S', 1],
    bolt: ['I', 1],
    blast: ['II', 2],
    consume: ['r', 2],
    summon: ['S', 1],
    channel: ['rr', 3],
    stab: ['r', 0],
    ravage: ['Ir', 1],
    mislead: ['A', 2],
    stun: ['S', 2],
    dance: ['AA', 4],
    heal: ['W', 1],
    bless: ['S', 2],
    curse: ['r', 3],
    smite: ['I', 1],
    prayer: ['Wrr', 2],
    cleave: ['Sr', 1],
    shout: ['I', 2],
    withstand: ['r', 2],
    taunt: ['S', 3],
    titan: ['SW', 4],
  };
  const norm = (c: unknown) => {
    if (typeof c === 'string') return c.split('').sort().join('');
    return Object.entries((c ?? {}) as Record<string, number>)
      .flatMap(([k, n]) => Array<string>(n).fill(k))
      .sort()
      .join('');
  };
  it.each(Object.entries(kit))('%s.alchemy matches the kit', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.alchemy`]!;
    expect([norm(s.cost), s.cooldown]).toEqual([norm(cost), cd]);
  });
});

