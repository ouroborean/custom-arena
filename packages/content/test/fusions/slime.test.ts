// Spec-driven scenarios for Slime (Water + Earth): Oozes (Split), Engulf and all 30 variants.
// Sources: in-game descriptions, docs/rules.md §21.31, and the kit table in water-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor, type Cost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const three = (s: string[] = ['shot']) => [s, ['shot'], ['shot']];

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const oozes = (a: Arena, owner: 0 | 1 = 0) => minions(a, owner, 'ooze');
const oozeHp = (a: Arena, owner: 0 | 1 = 0) => oozes(a, owner).map((u) => u.hp).sort((x, y) => x - y);

/** How many effects on `bearer` the opponent (player 2) can see. */
const seenByB = (a: Arena, bearer: string) =>
  viewFor(content, a.state, 1).effects.filter((e) => e.bearer === bearer).length;

const engulfed = (a: Arena, id: string) => a.has(id, 'engulfed');
/** Total Shield on a unit: every shield-type effect (base Shield or a skill's own Shield). */
const shieldOn = (a: Arena, id: string) =>
  a
    .effects(id)
    .filter((e) => (e.inline ?? content.statuses[e.defId])?.shield)
    .reduce((n, e) => n + e.value, 0);

/** Swallow Whole on B1: an Ooze (30 HP) that Engulfs them. Returns the Ooze's id. */
function swallow(a: Arena, actor = A1, target = B1): string {
  a.use(actor, 'stun.slime', target).end();
  return oozes(a)[0]!.id;
}

describe('Slime keywords: Oozes', () => {
  it('an Ooze has 20 HP and Slap (nc): 5 damage', () => {
    expect(content.minions.ooze?.hp).toBe(20);
    expect(content.skills.ooze_slap!.cost).toEqual({ S: 0, A: 0, I: 0, W: 0, r: 0 });
    const a = arena({ p0: [['blast.slime']], p1: three() });
    a.use(A1, 'blast.slime').end().pass(1);
    const o = oozes(a)[0]!;
    expect(o.hp).toBe(20);
    a.use(o.id, 'ooze_slap', B1).end();
    expect(a.hp(B1)).toBe(70); // 25 from Burst Bubble, 5 from Slap
  });

  it('Split: an Ooze that survives enemy damage with 10+ HP splits, the two sharing its HP', () => {
    const a = arena({ p0: [['blast.slime']], p1: [['shot.current'], ['shot'], ['shot']] });
    a.use(A1, 'blast.slime').end();
    a.use(B1, 'shot.current', oozes(a)[0]!.id).end();
    expect(oozeHp(a)).toEqual([5, 5]); // 20 − 10 = 10, shared
  });

  it('Split: odd HP is shared too (the new Ooze gets half, the old one keeps the rest)', () => {
    const a = arena({ p0: [['blast.slime']], p1: [['shot.current'], ['shot'], ['shot']] });
    a.use(A1, 'blast.slime').end();
    const o = oozes(a)[0]!;
    a.setHp(o.id, 25).use(B1, 'shot.current', o.id).end(); // 15 left
    const hp = oozeHp(a);
    expect(hp).toHaveLength(2);
    expect(hp[0]! + hp[1]!).toBe(15);
    expect(hp[1]! - hp[0]!).toBeLessThanOrEqual(1);
  });

  it('Split: no Split below 10 HP', () => {
    const a = arena({ p0: [['blast.slime']], p1: three() });
    a.use(A1, 'blast.slime').end().use(B1, 'shot', oozes(a)[0]!.id).end();
    expect(oozeHp(a)).toEqual([5]);
  });

  it('Split: no Split when the side already has 4 Oozes', () => {
    const a = arena({
      p0: [['blast.slime'], ['rage.slime'], ['snipe.slime', 'channel.slime']],
      p1: [['shot.current'], ['shot'], ['shot']],
    });
    a.use(A1, 'blast.slime').use(A2, 'rage.slime').use(A3, 'snipe.slime', B3).end().pass(1);
    a.use(A3, 'channel.slime').end();
    expect(oozes(a)).toHaveLength(4);
    const big = oozes(a).find((o) => o.hp >= 20)!;
    a.use(B1, 'shot.current', big.id).end();
    expect(oozes(a)).toHaveLength(4);
    expect(a.unit(big.id).hp).toBe(10); // kept all of it
  });

  it('Split: a fifth Ooze maker makes nothing at the cap of 4', () => {
    const a = arena({
      p0: [['blast.slime'], ['rage.slime'], ['snipe.slime', 'channel.slime', 'withstand.slime', 'stun.slime']],
      p1: three(),
    });
    a.use(A1, 'blast.slime').use(A2, 'rage.slime').use(A3, 'snipe.slime', B3).end().pass(1);
    a.use(A3, 'channel.slime').end().pass(1);
    a.use(A3, 'stun.slime', B1).end();
    expect(oozes(a)).toHaveLength(4);
    expect(oozes(a).some((o) => o.hp === 30)).toBe(false);
  });
});

describe('Slime keywords: Engulf', () => {
  it('Engulfed is a Debuff: the bearer is Stunned', () => {
    expect(content.statuses.engulfed?.kind).toBe('Debuff');
    const a = arena({ p0: [['stun.slime']], p1: [['shot', 'curse'], ['shot'], ['shot']] });
    swallow(a);
    expect(engulfed(a, B1)).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    expect(a.reject(() => a.use(B1, 'curse', A1))).toBe('cannot_act');
  });

  it('Engulf: 5 Affliction at the end of each of its owner\'s turns', () => {
    const a = arena({ p0: [['stun.slime']], p1: three() });
    a.give(B1, 'shield', { value: 50 });
    swallow(a);
    expect(a.hp(B1)).toBe(95);
    a.end();
    expect(a.hp(B1)).toBe(95); // not on B's turn
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Engulf: ends after 3 turns', () => {
    const a = arena({ p0: [['stun.slime']], p1: three() });
    swallow(a);
    a.pass(4);
    expect(engulfed(a, B1)).toBe(true);
    a.pass(1);
    expect(engulfed(a, B1)).toBe(false);
  });

  it('Engulf: ends when its Ooze dies, freeing them', () => {
    const a = arena({ p0: [['stun.slime']], p1: three() });
    const o = swallow(a);
    a.setHp(o, 5).use(B2, 'shot', o).end();
    expect([a.unit(o).alive, engulfed(a, B1)]).toEqual([false, false]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Engulf: Immune blocks it', () => {
    const a = arena({ p0: [['stun.slime']], p1: three() });
    a.give(B1, 'immune');
    swallow(a);
    expect(engulfed(a, B1)).toBe(false);
  });
});

describe('Slime skills', () => {
  it('Plunging Fist: 20; against a non-Engulfed target that\'s all', () => {
    const a = arena({ p0: [['strike.slime']], p1: three() });
    a.use(A1, 'strike.slime', B1).end();
    expect([a.hp(B1), oozes(a)]).toEqual([80, []]);
  });

  it('Plunging Fist: if Engulfed, the user\'s Oozes heal 10 and the Engulf lasts 1 turn longer', () => {
    const a = arena({ p0: [['stun.slime', 'strike.slime']], p1: three() });
    const o = swallow(a);
    a.pass(1);
    const dur = a.effects(B1).find((e) => e.defId === 'engulfed')!.duration!;
    a.setHp(o, 12);
    a.use(A1, 'strike.slime', B1).end();
    expect(a.hp(B1)).toBe(95 - 20 - 5);
    expect(a.unit(o).hp).toBe(22);
    expect(a.effects(B1).find((e) => e.defId === 'engulfed')!.duration).toBe(dur + 2 - 1);
  });

  it('Splatter: 25 / 10; if the target is Stunned, a new Ooze Engulfs them', () => {
    const a = arena({ p0: [['smash.slime']], p1: three() });
    a.give(B1, 'stun', { duration: 3, source: A1 }).use(A1, 'smash.slime', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([70, 90, 90]); // 25 + 5 Engulf
    expect([engulfed(a, B1), oozeHp(a)]).toEqual([true, [20]]);
  });

  it('Splatter: no Stun, no Ooze', () => {
    const a = arena({ p0: [['smash.slime']], p1: three() });
    a.use(A1, 'smash.slime', B1).end();
    expect([engulfed(a, B1), oozes(a)]).toEqual([false, []]);
  });

  it('Slime Roll: 15, creating an Ooze if the user has none; for 1 turn, damage aimed at the user hits an allied minion', () => {
    const a = arena({ p0: [['charge.slime']], p1: three() });
    a.use(A1, 'charge.slime', B1).end();
    expect([a.hp(B1), oozeHp(a)]).toEqual([85, [20]]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), oozeHp(a)]).toEqual([100, [5]]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // over
  });

  it('Slime Roll: with an Ooze already there, no new one', () => {
    const a = arena({ p0: [['charge.slime', 'blast.slime']], p1: three() });
    a.use(A1, 'blast.slime').end().pass(1).use(A1, 'charge.slime', B1).end();
    expect(oozes(a)).toHaveLength(1);
  });

  it('Gel Parry: counters the first Harmful skill on the user and makes an Ooze with 10 HP per energy it cost', () => {
    const a = arena({ p0: [['riposte.slime']], p1: [['smash'], ['shot'], ['shot']] });
    const seen = seenByB(a, A1);
    a.use(A1, 'riposte.slime').end();
    expect(seenByB(a, A1)).toBe(seen); // Invisible
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end();
    expect(oozes(a)).toHaveLength(1);
    expect(a.hp(A1)).toBe(85); // only the first is countered
  });

  it('Gel Parry: a 2-energy skill makes a 20 HP Ooze', () => {
    const a = arena({ p0: [['riposte.slime']], p1: [['smash'], ['shot'], ['shot']] });
    a.use(A1, 'riposte.slime').end().use(B1, 'smash', A1).end();
    expect(oozeHp(a)).toEqual([20]);
  });

  it('Gel Parry: a 1-energy skill makes a 10 HP Ooze', () => {
    const a = arena({ p0: [['riposte.slime']], p1: three() });
    a.use(A1, 'riposte.slime').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), oozeHp(a)]).toEqual([100, [10]]);
  });

  it('Mitosis: the user creates an Ooze and is Immune for 3 turns', () => {
    const a = arena({ p0: [['rage.slime']], p1: [['curse'], ['shot'], ['shot']] });
    a.use(A1, 'rage.slime').end();
    expect([oozeHp(a), a.has(A1, 'immune')]).toEqual([[20], true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Mitosis: 1 Might whenever an allied Ooze Splits', () => {
    const a = arena({ p0: [['rage.slime']], p1: [['shot.current'], ['shot'], ['shot']] });
    a.use(A1, 'rage.slime').end();
    expect(a.stacks(A1, 'might')).toBe(0);
    a.use(B1, 'shot.current', oozes(a)[0]!.id).end();
    expect([oozes(a).length, a.stacks(A1, 'might')]).toEqual([2, 1]);
  });

  it('Mitosis: at most 3 Might', () => {
    const a = arena({ p0: [['rage.slime']], p1: [['shot.current'], ['shot.current', 'shot'], ['shot.current']] });
    a.use(A1, 'rage.slime').end();
    const o = oozes(a)[0]!.id;
    a.setHp(o, 200);
    // Three Splits of the same big Ooze in one turn
    a.use(B1, 'shot.current', o).use(B2, 'shot.current', o).use(B3, 'shot.current', o).end();
    expect([oozes(a).length, a.stacks(A1, 'might')]).toEqual([4, 3]);
    a.pass(1);
    const byHp = oozes(a).sort((p, q) => p.hp - q.hp);
    a.use(B2, 'shot', byHp[0]!.id).use(B1, 'shot.current', byHp[3]!.id).end(); // room again: a 4th Split
    expect(oozes(a)).toHaveLength(4);
    expect(a.stacks(A1, 'might')).toBe(3);
  });

  it('Mud Ball: 15 and 1 Confusion for 2 turns', () => {
    const a = arena({ p0: [['shot.slime']], p1: three() });
    a.use(A1, 'shot.slime', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'confusion'), a.has(B1, 'stun')]).toEqual([85, 1, false]);
    a.pass(3);
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Mud Ball: at 3 Confusion they lose it all and are Stunned for 1 turn', () => {
    const a = arena({ p0: [['shot.slime']], p1: three() });
    a.give(B1, 'confusion', { stacks: 2, source: A1 }).use(A1, 'shot.slime', B1).end();
    expect([a.stacks(B1, 'confusion'), a.has(B1, 'stun')]).toEqual([0, true]);
    a.end();
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Ooze Mortar: an Ooze now; next turn an Ooze is hurled for 30 and Engulfs the target, keeping its HP', () => {
    const a = arena({ p0: [['snipe.slime']], p1: three() });
    a.use(A1, 'snipe.slime', B1).end();
    expect([oozeHp(a), a.hp(B1)]).toEqual([[20], 100]);
    a.end();
    expect([a.hp(B1), engulfed(a, B1), oozeHp(a)]).toEqual([70, true, [20]]);
  });

  it('Gel Snare: the next healing on the target is swallowed: an Ooze with that much HP Engulfs them', () => {
    const a = arena({ p0: [['trap.slime']], p1: [['shot'], ['heal'], ['shot']] });
    const seen = seenByB(a, B1);
    a.use(A1, 'trap.slime', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.setHp(B1, 50).use(B2, 'heal', B1).end();
    expect([a.hp(B1), engulfed(a, B1), oozeHp(a)]).toEqual([50, true, [25]]);
  });

  it('Gel Snare: only the next healing is swallowed', () => {
    const a = arena({ p0: [['trap.slime']], p1: [['shot'], ['heal'], ['heal']] });
    a.use(A1, 'trap.slime', B1).end();
    a.setHp(B1, 40).use(B2, 'heal', B1).use(B3, 'heal', B1).end();
    expect([oozeHp(a), a.hp(B1)]).toEqual([[25], 65]);
  });

  it('Clay Shell: Invulnerable for 1 turn; every 2 Renew become 1 permanent Armor', () => {
    const a = arena({ p0: [['maneuver.slime']], p1: three() });
    a.give(A1, 'renew', { stacks: 5, source: B1 }).use(A1, 'maneuver.slime').end();
    expect([a.has(A1, 'invulnerable'), a.stacks(A1, 'armor'), a.stacks(A1, 'renew')]).toEqual([true, 2, 1]);
    a.pass(8);
    expect(a.stacks(A1, 'armor')).toBe(2);
  });

  it('Great Ooze: permanent, 50 HP, and it doesn\'t Split', () => {
    const a = arena({ p0: [['companion.slime']], p1: [['shot.current'], ['shot'], ['shot']] });
    a.use(A1, 'companion.slime').end();
    const g = minions(a, 0, 'great_ooze')[0]!;
    expect(g.hp).toBe(50);
    a.use(B1, 'shot.current', g.id).end();
    expect([a.unit(g.id).hp, minions(a, 0).length]).toEqual([40, 1]);
    a.pass(20);
    expect(a.unit(g.id).alive).toBe(true);
  });

  it('Great Ooze: Swallow Engulfs the target, and it heals 10 at the end of each turn it holds them', () => {
    const a = arena({ p0: [['companion.slime']], p1: three() });
    a.use(A1, 'companion.slime').end().pass(1);
    const g = minions(a, 0, 'great_ooze')[0]!;
    a.setHp(g.id, 20).use(g.id, 'great_ooze_swallow', B1).end();
    expect(engulfed(a, B1)).toBe(true);
    expect(a.unit(g.id).hp).toBe(30);
  });

  it('Ooze Lash: 25; for 1 turn, the next time the target takes damage, the user creates an Ooze', () => {
    const a = arena({ p0: [['bolt.slime'], ['shot'], ['shot']], p1: three() });
    a.use(A1, 'bolt.slime', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), oozes(a).length]).toEqual([45, 1]);
  });

  it('Ooze Lash: no further damage, no Ooze', () => {
    const a = arena({ p0: [['bolt.slime'], ['shot']], p1: three() });
    a.use(A1, 'bolt.slime', B1).end().pass(3).use(A2, 'shot', B1).end();
    expect([a.hp(B1), oozes(a).length]).toEqual([60, 0]);
  });

  it('Burst Bubble: 25 to all and an Ooze; for 2 turns an allied Ooze that dies bursts for 10 to all enemies', () => {
    const a = arena({ p0: [['blast.slime']], p1: three() });
    a.use(A1, 'blast.slime').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), oozes(a).length]).toEqual([75, 75, 75, 1]);
    const o = oozes(a)[0]!;
    a.setHp(o.id, 5).use(B1, 'shot', o.id).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([65, 65, 65]);
  });

  it('Burst Bubble: after 2 turns, dying Oozes don\'t burst', () => {
    const a = arena({ p0: [['blast.slime']], p1: three() });
    a.use(A1, 'blast.slime').end().pass(4);
    const o = oozes(a)[0]!;
    a.setHp(o.id, 5).use(B1, 'shot', o.id).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
  });

  it('Digest: 5 damage, healing the user for it; a new 10 HP Ooze Engulfs the target for 1 turn', () => {
    const a = arena({ p0: [['consume.slime']], p1: three() });
    a.setHp(A1, 50).use(A1, 'consume.slime', B1).end();
    expect([a.hp(B1), a.hp(A1), engulfed(a, B1)]).toEqual([90, 55, true]); // 5, then the Engulf's 5 Affliction
    expect(oozeHp(a)).toEqual([10]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().end();
    expect(engulfed(a, B1)).toBe(false);
  });

  it('Digest: an Engulfed target is digested: 20 Affliction, healing the user as much', () => {
    const a = arena({ p0: [['stun.slime', 'consume.slime']], p1: three() });
    swallow(a);
    const before = oozes(a).length;
    a.pass(1).setHp(A1, 50).give(B1, 'shield', { value: 50 }).use(A1, 'consume.slime', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95 - 20 - 5, 70]);
    expect(oozes(a).length).toBe(before); // digested instead: no new Ooze
  });

  it('Slime Mother: 30 HP for 3 turns, no Split; Gloop deals 10', () => {
    const a = arena({ p0: [['summon.slime']], p1: [['shot.current'], ['shot'], ['shot']] });
    a.use(A1, 'summon.slime').end();
    const m = minions(a, 0, 'slime_mother')[0]!;
    expect(m.hp).toBe(30);
    a.use(B1, 'shot.current', m.id).end();
    expect([a.unit(m.id).hp, minions(a, 0).length]).toEqual([20, 1]);
    a.use(m.id, 'slime_mother_gloop', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Slime Mother: if she lasts all 3 turns, she leaves 2 Oozes', () => {
    const a = arena({ p0: [['summon.slime']], p1: three() });
    a.use(A1, 'summon.slime').end().pass(5);
    expect([minions(a, 0, 'slime_mother').length, oozeHp(a)]).toEqual([0, [20, 20]]);
  });

  it('Slime Mother: killed early, she leaves nothing', () => {
    const a = arena({ p0: [['summon.slime']], p1: three() });
    a.use(A1, 'summon.slime').end();
    const m = minions(a, 0, 'slime_mother')[0]!;
    a.setHp(m.id, 5).use(B1, 'shot', m.id).end().pass(6);
    expect(oozes(a)).toHaveLength(0);
  });

  it('Primordial Pool: an Ooze now, and 5 to all enemies at the end of each of the user\'s turns, for up to 4 turns', () => {
    const a = arena({ p0: [['channel.slime']], p1: three() });
    a.use(A1, 'channel.slime').end();
    expect([oozes(a).length, a.hp(B1), a.hp(B2)]).toEqual([1, 95, 95]);
    a.pass(8);
    expect([a.hp(B1), a.hp(B3)]).toEqual([80, 80]);
  });

  it('Primordial Pool: each allied Ooze that died since the last turn re-forms with 10 HP', () => {
    const a = arena({ p0: [['channel.slime']], p1: three() });
    a.use(A1, 'channel.slime').end();
    const o = oozes(a)[0]!;
    a.setHp(o.id, 5).use(B1, 'shot', o.id).end();
    expect(oozes(a)).toHaveLength(0);
    a.end();
    expect(oozeHp(a)).toEqual([10]);
  });

  it('Grit Shiv: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.slime']], p1: three() });
    a.use(A1, 'stab.slime', B1).end().pass(1).setHp(B2, 60).use(A1, 'stab.slime', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'confusion')]).toEqual([90, 40, false]);
  });

  it('Grit Shiv: 1 Confusion for 1 turn per allied Boulder', () => {
    const a = arena({ p0: [['stab.slime'], ['charge.earth']], p1: three() });
    a.use(A2, 'charge.earth', B2).end().pass(1).use(A1, 'stab.slime', B1).end();
    expect(a.stacks(B1, 'confusion')).toBe(1);
    a.end();
    expect(a.has(B1, 'confusion')).toBe(false);
  });

  it('Crushing Mass: 25 Piercing; against a Stunned target, 1 Might and 1 Armor for good', () => {
    const a = arena({ p0: [['ravage.slime']], p1: three() });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.slime', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([75, 0, 0]);
    a.pass(5).give(B2, 'stun', { duration: 3, source: A1 }).use(A1, 'ravage.slime', B2).end().pass(8);
    expect([a.hp(B2), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([75, 1, 1]);
  });

  it('Gulp: the target\'s Harmful skill is countered, and a new Ooze Engulfs them (10 HP for a 1-energy skill)', () => {
    const a = arena({ p0: [['mislead.slime']], p1: three() });
    const seen = seenByB(a, B1);
    a.use(A1, 'mislead.slime', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), engulfed(a, B1), oozeHp(a)]).toEqual([100, true, [10]]);
  });

  it('Gulp: a 2-energy skill makes a 20 HP Ooze', () => {
    const a = arena({ p0: [['mislead.slime']], p1: [['smash'], ['shot'], ['shot']] });
    a.use(A1, 'mislead.slime', B1).end().use(B1, 'smash', A1).end();
    expect([a.hp(A1), engulfed(a, B1), oozeHp(a)]).toEqual([100, true, [20]]);
  });

  it('Gulp: Helpful skills aren\'t countered', () => {
    const a = arena({ p0: [['mislead.slime']], p1: [['heal'], ['shot'], ['shot']] });
    a.use(A1, 'mislead.slime', B1).end().setHp(B2, 50).use(B1, 'heal', B2).end();
    expect([a.hp(B2), engulfed(a, B1)]).toEqual([75, false]);
  });

  it('Swallow Whole: a 30 HP Ooze Engulfs the target', () => {
    const a = arena({ p0: [['stun.slime']], p1: three() });
    swallow(a);
    expect([oozeHp(a), engulfed(a, B1), engulfed(a, B2)]).toEqual([[30], true, false]);
  });

  it('Slick Shimmy: 1 Might and 2 Swiftness for 3 turns', () => {
    const a = arena({ p0: [['dance.slime']], p1: three() });
    a.use(A1, 'dance.slime').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([1, 2]);
    a.pass(6);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([0, 0]);
  });

  it('Slick Shimmy: the user\'s Debuffs are removed at the end of each of their turns', () => {
    const a = arena({ p0: [['dance.slime']], p1: [['curse'], ['shot'], ['shot']] });
    a.use(A1, 'dance.slime').end().use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true);
    a.end();
    expect(a.has(A1, 'confusion')).toBe(false);
  });

  it('Irrigate: heals 20; for 3 turns, whenever an ally is healed, every allied Seedling and Boulder heals as much', () => {
    const a = arena({ p0: [['heal.slime'], ['charge.earth'], ['heal']], p1: three() });
    a.use(A2, 'charge.earth', B1).end().pass(1);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.setHp(boulder.id, 10).setHp(A3, 50).setHp(A2, 50);
    a.use(A1, 'heal.slime', A3).use(A3, 'heal', A2).end();
    expect([a.hp(A3), a.hp(A2), a.unit(boulder.id).hp]).toEqual([70, 75, 35]); // the later 25-heal echoes
  });

  it('Irrigate: wears off after 3 turns', () => {
    const a = arena({ p0: [['heal.slime'], ['charge.earth'], ['heal']], p1: three() });
    a.use(A2, 'charge.earth', B1).end().pass(1).use(A1, 'heal.slime', A3).end().pass(5);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.setHp(boulder.id, 10).setHp(A2, 50).use(A3, 'heal', A2).end();
    expect(a.unit(boulder.id).hp).toBe(10);
  });

  it('Fertile Silt: 2 Renew; for 3 turns each time the ally is healed, 1 Might (max 2)', () => {
    const a = arena({ p0: [['bless.slime'], ['shot'], ['heal']], p1: three() });
    a.setHp(A2, 30).use(A1, 'bless.slime', A2).use(A3, 'heal', A2).end(); // the heal, then the Renew tick
    expect(a.stacks(A2, 'might')).toBe(2);
    a.pass(3).use(A3, 'heal', A2).end(); // turn 5, still within the 3 turns: capped at 2
    expect(a.stacks(A2, 'might')).toBe(2);
  });

  it('Fertile Silt: the ally gains 2 Renew', () => {
    const a = arena({ p0: [['bless.slime'], ['shot']], p1: three() });
    a.setHp(A2, 30).use(A1, 'bless.slime', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([40, 1]); // ticked once: 2 × 5
  });

  it('Fertile Silt: one heal, one Might', () => {
    const a = arena({ p0: [['bless.slime'], ['shot']], p1: three() });
    a.setHp(A2, 30).use(A1, 'bless.slime', A2).end();
    expect(a.stacks(A2, 'might')).toBe(1); // the first Renew tick
  });

  it('Flypaper: 2 Confusion for 2 turns; every unit that uses a skill on them, from either side, gains 1 Confusion', () => {
    const a = arena({ p0: [['curse.slime'], ['shot'], ['shot']], p1: [['shot'], ['heal'], ['shot']] });
    a.use(A1, 'curse.slime', B1).use(A2, 'shot', B1).end();
    expect([a.stacks(B1, 'confusion'), a.stacks(A2, 'confusion'), a.stacks(A3, 'confusion')]).toEqual([2, 1, 0]);
    a.use(B2, 'heal', B1).end();
    expect(a.stacks(B2, 'confusion')).toBe(1);
  });

  it('Settling Silt: 20; for 2 turns Stuns on them can\'t be removed', () => {
    const a = arena({ p0: [['smite.slime']], p1: [['rage.wind'], ['shot'], ['shot']] });
    a.give(B1, 'stun', { duration: 4, source: A1 }).use(A1, 'smite.slime', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B1, 'rage.wind').end(); // removes all Debuffs, usable while Stunned
    expect(a.has(B1, 'stun')).toBe(true);
    const b = arena({ p0: [['smite']], p1: [['rage.wind'], ['shot'], ['shot']] });
    b.give(B1, 'stun', { duration: 4, source: A1 }).use(A1, 'smite', B1).end().use(B1, 'rage.wind').end();
    expect(b.has(B1, 'stun')).toBe(false);
  });

  it('Settling Silt: Swiftness still stops a new Stun', () => {
    const a = arena({ p0: [['smite.slime', 'stun']], p1: three() });
    a.give(B1, 'swiftness', { stacks: 1 }).use(A1, 'smite.slime', B1).end().pass(1).use(A1, 'stun', B1).end();
    expect([a.has(B1, 'stun'), a.stacks(B1, 'swiftness')]).toEqual([false, 0]);
  });

  it('Gel Mantle: allies heal 20 and gain 10 Shield; each allied Ooze melts in for 10 more Shield to every ally, and dies', () => {
    const a = arena({ p0: [['prayer.slime'], ['rage.slime'], ['blast.slime']], p1: three() });
    a.use(A2, 'rage.slime').use(A3, 'blast.slime').end().pass(1);
    expect(oozes(a)).toHaveLength(2);
    a.setHp(A1, 50).use(A1, 'prayer.slime').end();
    expect([a.hp(A1), shieldOn(a, A1), shieldOn(a, A2), shieldOn(a, A3), oozes(a).length]).toEqual([70, 30, 30, 30, 0]);
  });

  it('Gel Mantle: with no Oozes it\'s 10 Shield, for 2 turns', () => {
    const a = arena({ p0: three(['prayer.slime']), p1: three() });
    a.use(A1, 'prayer.slime').end();
    expect(shieldOn(a, A2)).toBe(10);
    a.pass(4);
    expect(shieldOn(a, A2)).toBe(0);
  });

  it('Mudguard Sweep: 25 / 15 to a random other enemy; until the user\'s next turn, their Armor reduces Piercing', () => {
    const a = arena({ p0: [['cleave.slime']], p1: [['ravage'], ['ravage']] });
    a.give(A1, 'armor', { stacks: 2 }).use(A1, 'cleave.slime', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    a.use(B1, 'ravage', A1).end();
    expect(a.hp(A1)).toBe(85); // 25 Piercing − 10
    a.pass(1).use(B2, 'ravage', A1).end();
    expect(a.hp(A1)).toBe(60); // back to normal
  });

  it('Quagmire: all enemies Intimidated for 2 turns, and their skills cost 1 more random energy', () => {
    const a = arena({ p0: [['shout.slime']], p1: three() });
    a.use(A1, 'shout.slime').end();
    expect([B1, B2, B3].map((b) => a.has(b, 'intimidated'))).toEqual([true, true, true]);
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue[0]?.cost.r).toBe(2);
  });

  it('Quagmire: wears off after 2 turns', () => {
    const a = arena({ p0: [['shout.slime']], p1: three() });
    a.use(A1, 'shout.slime').end().pass(4);
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue[0]?.cost.r).toBe(1);
  });

  it('Quivering Wall: 40 Shield with no time limit, melting by 10 at the end of each of the user\'s turns', () => {
    const a = arena({ p0: [['withstand.slime']], p1: three() });
    a.use(A1, 'withstand.slime').end();
    expect(shieldOn(a, A1)).toBe(30);
    a.end();
    expect(shieldOn(a, A1)).toBe(30);
    a.end();
    expect(shieldOn(a, A1)).toBe(20);
  });

  it('Sticky Bait: a 30 HP Ooze Taunts the target for 2 turns; if it still stands then, it Engulfs them', () => {
    const a = arena({ p0: [['taunt.slime']], p1: three() });
    a.use(A1, 'taunt.slime', B1).end();
    expect(oozeHp(a)).toEqual([30]);
    expect(['taunted', 'bad_target']).toContain(a.reject(() => a.use(B1, 'shot', A1)));
    a.use(B1, 'shot', oozes(a)[0]!.id);
    a.pass(3);
    expect(engulfed(a, B1)).toBe(true);
  });

  it('Sticky Bait: if the Ooze is gone when the Taunt ends, no Engulf', () => {
    const a = arena({ p0: [['taunt.slime']], p1: three() });
    a.use(A1, 'taunt.slime', B1).end();
    const o = oozes(a)[0]!;
    a.setHp(o.id, 5).use(B1, 'shot', o.id).end().pass(2);
    expect(engulfed(a, B1)).toBe(false);
  });

  it('Gelatinous Giant: a hit on the user splits off an Ooze with a quarter of their HP, which they lose', () => {
    const a = arena({ p0: [['titan.slime']], p1: three() });
    a.use(A1, 'titan.slime').end().use(B1, 'shot', A1).end();
    const o = oozes(a);
    expect(o).toHaveLength(1);
    expect(a.hp(A1) + o[0]!.hp).toBe(85);
    expect(Math.abs(o[0]!.hp - 85 / 4)).toBeLessThanOrEqual(1);
  });

  it('Gelatinous Giant: 1 Armor per allied Ooze', () => {
    const a = arena({ p0: [['titan.slime'], ['blast.slime']], p1: three() });
    a.use(A2, 'blast.slime').use(A1, 'titan.slime').end();
    a.use(B1, 'shot', A1).end(); // 1 Ooze: 15 − 5
    const after1 = a.hp(A1) + oozes(a).filter((o) => o.summonedBy === A1).reduce((n, o) => n + o.hp, 0);
    expect([after1, oozes(a).length]).toEqual([90, 2]);
    a.pass(1).use(B2, 'shot', A1).end(); // 2 Oozes: 15 − 10 (A1 is still above 20, so it Splits again)
    const after2 = a.hp(A1) + oozes(a).filter((o) => o.summonedBy === A1).reduce((n, o) => n + o.hp, 0);
    expect(after2).toBe(85);
  });

  it('Gelatinous Giant: no Split below 20 HP, and it ends after 4 turns', () => {
    const a = arena({ p0: [['titan.slime']], p1: three() });
    a.use(A1, 'titan.slime').end().setHp(A1, 30).use(B1, 'shot', A1).end();
    expect([a.hp(A1), oozes(a).length]).toEqual([15, 0]);
    const b = arena({ p0: [['titan.slime']], p1: three() });
    b.use(A1, 'titan.slime').end().pass(8).use(B1, 'shot', A1).end();
    expect([b.hp(A1), oozes(b).length]).toEqual([85, 0]);
  });
});

describe('Slime cost and cooldown (kit table)', () => {
  const table: Record<string, [string, number]> = {
    strike: ['W', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['r', 2], rage: ['SI', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['W', 3], maneuver: ['r', 4], companion: ['I', 1],
    bolt: ['Ir', 1], blast: ['Irr', 2], consume: ['W', 2], summon: ['I', 1], channel: ['Ir', 3],
    stab: ['r', 0], ravage: ['Wr', 2], mislead: ['A', 2], stun: ['Ar', 4], dance: ['AI', 4],
    heal: ['r', 1], bless: ['r', 2], curse: ['r', 2], smite: ['W', 1], prayer: ['Irr', 2],
    cleave: ['Sr', 1], shout: ['I', 3], withstand: ['r', 4], taunt: ['W', 3], titan: ['WW', 4],
  };
  const parse = (s: string): Cost => {
    const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof Cost] += 1;
    return c;
  };
  for (const [arch, [cost, cd]] of Object.entries(table)) {
    it(`${arch}.slime costs ${cost}, cooldown ${cd}`, () => {
      const s = content.skills[`${arch}.slime`]!;
      expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
    });
  }
  it('minion skills: Slap nc, Swallow r, Gloop nc', () => {
    expect(content.skills.ooze_slap!.cost).toEqual(parse('nc'));
    expect(content.skills.great_ooze_swallow!.cost).toEqual(parse('r'));
    expect(content.skills.slime_mother_gloop!.cost).toEqual(parse('nc'));
  });
});
