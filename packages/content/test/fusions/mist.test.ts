// Spec-driven scenarios for Mist (Water + Wind): Fog (redirects and condensing) and all 30 variants.
// Sources: in-game descriptions, docs/rules.md §21.29, and the kit table in water-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor, type Cost } from '@arena/engine';
import { arena, content, type Arena, type ArenaOptions } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const three = (s: string[] = ['shot']) => [s, ['shot'], ['shot']];

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

/** How many effects on `bearer` the opponent (player 2) can see. */
const seenByB = (a: Arena, bearer: string) =>
  viewFor(content, a.state, 1).effects.filter((e) => e.bearer === bearer).length;

/** Runs `setup` for seeds 1..80 and returns the first arena for which `pred` holds. */
function firstSeed(o: Omit<ArenaOptions, 'seed'>, setup: (a: Arena) => void, pred: (a: Arena) => boolean): Arena {
  for (let seed = 1; seed <= 80; seed++) {
    const a = arena({ ...o, seed });
    setup(a);
    if (pred(a)) return a;
  }
  throw new Error('no seed found');
}

const sideHp = (a: Arena, ids: string[]) => ids.map((id) => a.hp(id));

/**
 * Whether the unit has Fog: the Fog status itself or one of its variants (Heron, Will-o'-Mist, Mercy, Marid…),
 * i.e. any effect carrying the unconditional `fogged` modifier.
 */
const fogged = (a: Arena, id: string) =>
  a.effects(id).some((e) => {
    const def = e.inline ?? content.statuses[e.defId];
    return (def?.modifiers ?? []).some((m) => m.mod === 'fogged' && !('if' in m && m.if));
  });

describe('Mist keyword: Fog', () => {
  it('Fog is a unique Buff', () => {
    expect(content.statuses.fog?.kind).toBe('Buff');
    const a = arena({ p0: [['shot.mist']], p1: three() });
    a.use(A1, 'shot.mist', B1).end().pass(1).use(A1, 'shot.mist', B1).end();
    expect(a.stacks(A1, 'fog')).toBe(1);
  });

  it('a single-target enemy skill aimed at a Fogged unit lands on exactly one unit of that side', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: three(), p1: three(), seed });
      a.give(A1, 'fog', { source: A1 }).end().use(B1, 'shot', A1).end();
      const lost = sideHp(a, [A1, A2, A3]).map((h) => 100 - h);
      expect(lost.filter((x) => x > 0)).toEqual([15]);
    }
  });

  it('sometimes the redirect lands on another unit of that side, which takes the hit instead', () => {
    const a = firstSeed(
      { p0: three(), p1: three() },
      (x) => x.give(A1, 'fog', { source: A1 }).end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 100,
    );
    expect(a.hp(A2) + a.hp(A3)).toBe(185);
  });

  it('with no one else on that side, the skill still lands on the Fogged unit', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['shot']], p1: three(), seed });
      a.give(A1, 'fog', { source: A1 }).end().use(B1, 'shot', A1).end();
      expect(a.hp(A1)).toBe(85);
    }
  });

  it('Fog doesn\'t redirect an ally\'s Helpful skill', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['shot'], ['heal'], ['shot']], p1: three(), seed });
      a.setHp(A1, 50).setHp(A3, 50).give(A1, 'fog', { source: A1 }).use(A2, 'heal', A1).end();
      expect([a.hp(A1), a.hp(A3)]).toEqual([75, 50]);
    }
  });

  it('Fog doesn\'t stop skills that hit everyone', () => {
    const a = arena({ p0: three(), p1: [['blast'], ['shot'], ['shot']] });
    a.give(A1, 'fog', { source: A1 }).end().use(B1, 'blast').end();
    expect(sideHp(a, [A1, A2, A3])).toEqual([65, 65, 65]);
  });

  it('when Fog ends, it condenses into 2 Renew', () => {
    const a = arena({ p0: [['shot.mist']], p1: three() });
    a.use(A1, 'shot.mist', B1).end();
    expect([fogged(a, A1), a.stacks(A1, 'renew')]).toEqual([true, 0]);
    a.end();
    expect([fogged(a, A1), a.stacks(A1, 'renew')]).toEqual([false, 2]);
  });
});

describe('Mist skills', () => {
  it('Veiled Strike: 20, and the user gains Fog for 1 turn', () => {
    const a = arena({ p0: three(['strike.mist']), p1: three() });
    a.use(A1, 'strike.mist', B1).end();
    expect([a.hp(B1), fogged(a, A1)]).toEqual([80, true]);
    a.pass(1).use(A1, 'strike.mist', B1).end();
    expect(a.hp(B1)).toBe(60); // no redirect, no bonus
  });

  it('Veiled Strike: +15 if Fog redirected a skill away from the user since their last turn', () => {
    const a = firstSeed(
      { p0: three(['strike.mist']), p1: three() },
      (x) => x.use(A1, 'strike.mist', B1).end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 100,
    );
    a.use(A1, 'strike.mist', B1).end();
    expect(a.hp(B1)).toBe(45); // 80 − 35
  });

  it('Gale Spindle: 20 / 10; each Swiftness spent adds 10 to every hit', () => {
    const a = arena({ p0: [['smash.mist']], p1: three() });
    a.use(A1, 'smash.mist', B1).end();
    expect(sideHp(a, [B1, B2, B3])).toEqual([80, 90, 90]);
    const b = arena({ p0: [['smash.mist']], p1: three() });
    b.give(A1, 'swiftness', { stacks: 2 }).use(A1, 'smash.mist', B1).end();
    expect(sideHp(b, [B1, B2, B3])).toEqual([60, 70, 70]);
    expect(b.stacks(A1, 'swiftness')).toBe(0);
  });

  it('Mistwalk: 15, 1 Focus, and the ally with the lowest HP gains Fog for 1 turn', () => {
    const a = arena({ p0: three(['charge.mist']), p1: three() });
    a.setHp(A2, 30).setHp(A3, 50).use(A1, 'charge.mist', B1).end();
    expect([a.hp(B1), a.has(A1, 'focus')]).toEqual([85, true]);
    expect([fogged(a, A1), fogged(a, A2), fogged(a, A3)]).toEqual([false, true, false]);
    a.end();
    expect(fogged(a, A2)).toBe(false);
  });

  it('Fogbank: the user has Fog and counters the first Harmful skill used on them', () => {
    const a = arena({ p0: [['riposte.mist']], p1: three() });
    const seen = seenByB(a, A1);
    a.use(A1, 'riposte.mist').end();
    expect(fogged(a, A1)).toBe(true);
    expect(seenByB(a, A1)).toBe(seen + 1); // the Fog shows; the counter is Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // only the first is countered
  });

  it('Fogbank: also counters the first Harmful skill used on a Fogged ally', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['riposte.mist'], ['shot']], p1: three(), seed });
      a.give(A2, 'fog', { source: A2 }).use(A1, 'riposte.mist').end();
      a.use(B1, 'shot', A2).end();
      expect(sideHp(a, [A1, A2])).toEqual([100, 100]);
    }
  });

  it('Fogbank: doesn\'t protect an un-Fogged ally', () => {
    const a = arena({ p0: [['riposte.mist'], ['shot']], p1: three() });
    a.use(A1, 'riposte.mist').end().use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Riptide Fury: the user begins Rushing and gains 1 Might', () => {
    const a = arena({ p0: [['rage.mist']], p1: three() });
    a.use(A1, 'rage.mist').end();
    expect([a.has(A1, 'rushing'), a.stacks(A1, 'might')]).toEqual([true, 1]);
  });

  it('Riptide Fury: 2 Renew at the end of each turn the user is still Rushing; none once Rushing has ended', () => {
    const a = arena({ p0: [['rage.mist', 'shot']], p1: three() });
    a.setHp(A1, 30).use(A1, 'rage.mist').end();
    const r1 = a.stacks(A1, 'renew') + (a.hp(A1) - 30) / 5;
    expect(r1).toBeGreaterThanOrEqual(2);
    a.pass(1); // B
    a.pass(1); // A uses nothing: Rushing ends
    expect(a.has(A1, 'rushing')).toBe(false);
    a.pass(1);
    const before = a.stacks(A1, 'renew');
    a.use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'renew')).toBeLessThanOrEqual(before);
  });

  it('Dew Shot: 15, and the user gains Fog for 1 turn', () => {
    const a = arena({ p0: [['shot.mist']], p1: three() });
    a.use(A1, 'shot.mist', B1).end();
    expect([a.hp(B1), fogged(a, A1)]).toEqual([85, true]);
  });

  it('Dew Shot: an existing Fog lasts 1 turn longer instead', () => {
    const a = arena({ p0: [['shot.mist']], p1: three() });
    a.give(A1, 'fog', { source: A1, duration: 3 }).use(A1, 'shot.mist', B1).end().pass(2);
    expect([fogged(a, A1), a.stacks(A1, 'fog')]).toEqual([true, 1]);
    const b = arena({ p0: [['shot']], p1: three() });
    b.give(A1, 'fog', { source: A1, duration: 3 }).use(A1, 'shot', B1).end().pass(2);
    expect(fogged(b, A1)).toBe(false);
  });

  it('Mistpiercer: 45 on the following turn, and the user has Fog meanwhile', () => {
    const a = arena({ p0: [['snipe.mist']], p1: three() });
    a.use(A1, 'snipe.mist', B1).end();
    expect([a.hp(B1), fogged(a, A1)]).toEqual([100, true]);
    a.end();
    expect(a.hp(B1)).toBe(55);
  });

  it('Mistpiercer: if a hit lands on the user anyway, the shot deals 15 less', () => {
    const a = arena({ p0: [['snipe.mist']], p1: three() });
    a.use(A1, 'snipe.mist', B1).end().use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 70]);
  });

  it('Choking Fog: the target\'s first single-target Harmful skill lands on a random unit of its target\'s side, and they gain 1 Confusion', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: three(['trap.mist']), p1: three(), seed });
      const seen = seenByB(a, B1);
      a.use(A1, 'trap.mist', B1).end();
      expect(seenByB(a, B1)).toBe(seen); // Invisible
      a.use(B1, 'shot', A1).end();
      expect(sideHp(a, [A1, A2, A3]).filter((h) => h < 100)).toEqual([85]);
      expect(a.stacks(B1, 'confusion')).toBe(1);
    }
    const r = firstSeed(
      { p0: three(['trap.mist']), p1: three() },
      (x) => x.use(A1, 'trap.mist', B1).end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 100,
    );
    expect(r.hp(A2) + r.hp(A3)).toBe(185);
  });

  it('Choking Fog: only the first one; later skills land normally', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: three(['trap.mist']), p1: three(), seed });
      a.use(A1, 'trap.mist', B1).end().use(B1, 'shot', A1).end();
      const before = sideHp(a, [A1, A2, A3]);
      a.pass(1).use(B1, 'shot', A1).end();
      expect(a.hp(A1)).toBe(before[0]! - 15);
      expect(a.stacks(B1, 'confusion')).toBe(1);
    }
  });

  it('Dissipate: Invulnerable for 1 turn, and every ally has Fog until the user\'s next turn', () => {
    const a = arena({ p0: three(['maneuver.mist']), p1: three() });
    a.use(A1, 'maneuver.mist').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([true, true, true]);
    a.end();
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([false, false, false]);
    expect(a.stacks(A2, 'renew')).toBe(2); // it condensed
  });

  it('Mist Heron: a permanent 35 HP Heron that always has Fog', () => {
    const a = arena({ p0: [['companion.mist']], p1: three() });
    a.use(A1, 'companion.mist').end();
    const heron = minions(a, 0, 'mist_heron')[0]!;
    expect([heron.hp, fogged(a, heron.id)]).toEqual([35, true]);
    a.pass(12);
    expect([a.unit(heron.id).alive, fogged(a, heron.id)]).toEqual([true, true]);
  });

  it('Mist Heron: Spear Beak deals 15, +10 against an Immobile target', () => {
    const a = arena({ p0: [['companion.mist']], p1: [['shot'], ['charge'], ['shot']] });
    a.use(A1, 'companion.mist').end().pass(1);
    const heron = minions(a, 0, 'mist_heron')[0]!;
    a.use(heron.id, 'mist_heron_spear_beak', B1).end().pass(1);
    expect(a.hp(B1)).toBe(75); // only Shot: Immobile
    a.use(heron.id, 'mist_heron_spear_beak', B2).end();
    expect(a.hp(B2)).toBe(85); // has a Charge skill: not Immobile
  });

  it('Burst Spring: 20, and every ally\'s Renew heals once now without losing a stack', () => {
    const a = arena({ p0: three(['bolt.mist']), p1: three() });
    a.setHp(A2, 50).setHp(A3, 50).give(A2, 'renew', { stacks: 2, source: B1 });
    a.use(A1, 'bolt.mist', B1).end();
    expect([a.hp(B1), a.hp(A2), a.stacks(A2, 'renew'), a.hp(A3)]).toEqual([80, 60, 2, 50]);
  });

  it('Drowning Squall: 20 to all; for 2 turns each Confusion an enemy gains comes with 1 Intimidated', () => {
    const a = arena({ p0: [['blast.mist'], ['curse']], p1: three() });
    a.use(A1, 'blast.mist').use(A2, 'curse', B1).end();
    expect(sideHp(a, [B1, B2, B3])).toEqual([80, 80, 80]);
    expect([a.stacks(B1, 'confusion'), a.stacks(B1, 'intimidated'), a.stacks(B2, 'intimidated')]).toEqual([1, 1, 0]);
  });

  it('Drowning Squall: without it, Confusion comes alone; and the Intimidated lasts as long as the Confusion', () => {
    const a = arena({ p0: [['blast.mist'], ['curse']], p1: three() });
    a.use(A2, 'curse', B1).end();
    expect(a.has(B1, 'intimidated')).toBe(false);
    const b = arena({ p0: [['blast.mist'], ['curse']], p1: three() });
    b.use(A1, 'blast.mist').use(A2, 'curse', B1).end().pass(3);
    expect([b.has(B1, 'confusion'), b.has(B1, 'intimidated')]).toEqual([false, false]);
  });

  it('Condensation: 5 damage, healing the user for it', () => {
    const a = arena({ p0: [['consume.mist']], p1: three() });
    a.setHp(A1, 50).use(A1, 'consume.mist', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 55]);
  });

  it('Condensation: 20 more if that enemy was healed since the user\'s last turn', () => {
    const a = arena({ p0: [['consume.mist']], p1: [['shot'], ['heal'], ['shot']] });
    a.setHp(A1, 50).setHp(B1, 50).end().use(B2, 'heal', B1).end();
    a.use(A1, 'consume.mist', B1).end();
    expect(a.hp(A1)).toBe(75);
  });

  it('Will-o\'-Mists: two 10 HP Mists for 3 turns; while any stands, every ally has Fog', () => {
    const a = arena({ p0: three(['summon.mist']), p1: three() });
    a.use(A1, 'summon.mist').end();
    const mists = minions(a, 0, 'will_o_mist');
    expect(mists.map((m) => m.hp)).toEqual([10, 10]);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([true, true, true]);
    a.pass(5);
    expect(minions(a, 0, 'will_o_mist')).toHaveLength(0);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([false, false, false]);
  });

  it('Will-o\'-Mists: the Fog stays while one Mist stands, and goes when both are gone', () => {
    const a = arena({ p0: three(['summon.mist']), p1: [['blast'], ['blast'], ['shot']] });
    a.use(A1, 'summon.mist').end();
    const [, m2] = minions(a, 0, 'will_o_mist');
    a.setHp(m2!.id, 50); // survives one Blast
    a.use(B1, 'blast').end();
    expect(minions(a, 0, 'will_o_mist')).toHaveLength(1);
    expect(fogged(a, A2)).toBe(true);
    a.pass(1).use(B2, 'blast').end();
    expect(minions(a, 0, 'will_o_mist')).toHaveLength(0);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([false, false, false]);
  });

  it('Will-o\'-Mists: Pale Touch deals 5 Piercing', () => {
    const a = arena({ p0: [['summon.mist']], p1: three() });
    a.use(A1, 'summon.mist').end().pass(1);
    const m = minions(a, 0, 'will_o_mist')[0]!;
    a.give(B1, 'armor', { stacks: 2 }).use(m.id, 'will_o_mist_pale_touch', B1).end();
    expect(a.hp(B1)).toBe(95);
  });

  it('Rolling Fog: 10 to all enemies at the end of each of the user\'s turns, for 2 turns, and all allies have Fog meanwhile', () => {
    const a = arena({ p0: three(['channel.mist']), p1: three() });
    a.use(A1, 'channel.mist').end();
    expect(sideHp(a, [B1, B2, B3])).toEqual([90, 90, 90]);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([true, true, true]);
    a.pass(2);
    expect(sideHp(a, [B1, B2, B3])).toEqual([80, 80, 80]);
    a.pass(2);
    expect(sideHp(a, [B1, B2, B3])).toEqual([80, 80, 80]);
  });

  it('Rolling Fog: an enemy whose skill it redirects gains 1 Confusion', () => {
    const a = firstSeed(
      { p0: three(['channel.mist']), p1: three() },
      (x) => x.use(A1, 'channel.mist').end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 100,
    );
    expect(a.stacks(B1, 'confusion')).toBe(1);
    const b = arena({ p0: [['channel.mist']], p1: three() });
    b.use(A1, 'channel.mist').end().use(B1, 'shot', A1).end(); // nowhere else to go: not redirected
    expect(b.stacks(B1, 'confusion')).toBe(0);
  });

  it('Whisper Knife: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.mist']], p1: three() });
    a.use(A1, 'stab.mist', B1).end().pass(1).setHp(B2, 60).use(A1, 'stab.mist', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Whisper Knife: can\'t be countered', () => {
    const a = arena({ p0: [['stab.mist']], p1: [['riposte'], ['shot'], ['shot']] });
    a.end().use(B1, 'riposte').end().use(A1, 'stab.mist', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 100]);
  });

  it('Undertow Thrust: 25 Piercing +5 per Renew (max 20), then the user loses all Renew and Leaps', () => {
    const a = arena({ p0: [['ravage.mist']], p1: three() });
    a.give(B1, 'armor', { stacks: 2 }).give(A1, 'renew', { stacks: 2, source: B1 });
    a.use(A1, 'ravage.mist', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'renew'), a.has(A1, 'invulnerable'), a.has(A1, 'leaping')]).toEqual([65, 0, true, true]);
    const b = arena({ p0: [['ravage.mist']], p1: three() });
    b.give(A1, 'renew', { stacks: 6, source: B1 }).use(A1, 'ravage.mist', B1).end();
    expect(b.hp(B1)).toBe(55); // capped at +20
    const c = arena({ p0: [['ravage.mist']], p1: three() });
    c.use(A1, 'ravage.mist', B1).end();
    expect(c.hp(B1)).toBe(75);
  });

  it('Lost in the Fog: counters the target\'s Harmful skill; each unit it targeted gains Fog for 2 turns', () => {
    const a = arena({ p0: three(['mislead.mist']), p1: three() });
    const seen = seenByB(a, B1);
    a.use(A1, 'mislead.mist', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(100);
    expect([fogged(a, A1), fogged(a, A2), fogged(a, A3)]).toEqual([false, true, false]);
    a.pass(3);
    expect(fogged(a, A2)).toBe(true);
    a.pass(1);
    expect(fogged(a, A2)).toBe(false);
  });

  it('Lost in the Fog: Helpful skills aren\'t countered', () => {
    const a = arena({ p0: three(['mislead.mist']), p1: [['heal'], ['shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.mist', B1).end().use(B1, 'heal', B2).end();
    expect([a.hp(B2), fogged(a, B2)]).toEqual([75, false]);
  });

  it('Squall in the Fog: a random enemy takes 15 and is Stunned for 2 turns', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['stun.mist']], p1: three(), seed });
      a.use(A1, 'stun.mist').end();
      const hit = [B1, B2, B3].filter((b) => a.hp(b) < 100);
      expect(hit).toHaveLength(1);
      expect([a.hp(hit[0]!), a.has(hit[0]!, 'stun')]).toEqual([85, true]);
      expect([B1, B2, B3].filter((b) => a.has(b, 'stun'))).toEqual(hit);
      a.pass(2);
      expect(a.has(hit[0]!, 'stun')).toBe(true);
      a.pass(1);
      expect(a.has(hit[0]!, 'stun')).toBe(false);
    }
  });

  it('Rain Dance: the user has Fog for 4 turns', () => {
    const a = arena({ p0: [['dance.mist']], p1: three() });
    a.use(A1, 'dance.mist').end().pass(6);
    expect(fogged(a, A1)).toBe(true);
    a.pass(2);
    expect(fogged(a, A1)).toBe(false);
  });

  it('Rain Dance: each redirect gives the user 1 Swiftness and 1 Focus', () => {
    const a = firstSeed(
      { p0: three(['dance.mist']), p1: three() },
      (x) => x.use(A1, 'dance.mist').end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 100,
    );
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    const b = arena({ p0: [['dance.mist']], p1: three() });
    b.use(A1, 'dance.mist').end().use(B1, 'shot', A1).end(); // lands on the user: no redirect
    expect([b.stacks(A1, 'swiftness'), b.stacks(A1, 'focus')]).toEqual([0, 0]);
  });

  it('Morning Dew: heals 20; a Fog on the target condenses now into 4 Renew', () => {
    const a = arena({ p0: three(['heal.mist']), p1: three() });
    a.setHp(A2, 40).give(A2, 'fog', { source: A2 }).use(A1, 'heal.mist', A2).end();
    expect(fogged(a, A2)).toBe(false);
    // 40 + 20, then the 4 Renew ticks once at the end of the user's turn (20) and drops to 3
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([80, 3]);
  });

  it('Morning Dew: without Fog it\'s just the 20', () => {
    const a = arena({ p0: three(['heal.mist']), p1: three() });
    a.setHp(A2, 40).use(A1, 'heal.mist', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([60, 0]);
  });

  it('Cloak of Mist: the ally gains 1 Renew', () => {
    const a = arena({ p0: [['bless.mist'], ['shot']], p1: three() });
    a.setHp(A2, 50).use(A1, 'bless.mist', A2).end();
    expect(a.stacks(A2, 'renew') + (a.hp(A2) - 50) / 5).toBe(1);
  });

  /** Over 30 seeds, how many times B1's Shot aimed at A2 landed on someone else. */
  const redirects = (o: Omit<ArenaOptions, 'seed'>, setup: (a: Arena) => void) => {
    let n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const a = arena({ ...o, seed });
      setup(a);
      const before = a.hp(A2);
      a.use(B1, 'shot', A2).end();
      if (a.hp(A2) === before) n++;
    }
    return n;
  };

  it('Cloak of Mist: Fog (redirects) until the ally uses a Harmful skill', () => {
    const o = { p0: [['bless.mist'], ['heal', 'shot'], ['shot']], p1: three() };
    expect(redirects(o, (a) => a.use(A1, 'bless.mist', A2).end())).toBeGreaterThan(0);
    expect(redirects(o, (a) => a.use(A1, 'bless.mist', A2).end().pass(1).use(A2, 'heal', A3).end())).toBeGreaterThan(0);
    expect(redirects(o, (a) => a.use(A1, 'bless.mist', A2).end().pass(1).use(A2, 'shot', B2).end())).toBe(0);
    expect(redirects(o, (a) => a.end())).toBe(0); // no Cloak, no Fog
  });

  it('Cloak of Mist: the Fog lasts 3 turns at most', () => {
    const a = arena({ p0: [['bless.mist'], ['shot'], ['shot']], p1: three() });
    a.use(A1, 'bless.mist', A2).end();
    expect(fogged(a, A2)).toBe(true);
    a.pass(4);
    expect(fogged(a, A2)).toBe(true);
    a.pass(2);
    expect(fogged(a, A2)).toBe(false);
  });

  it('Heavy Air: the target counts as Immobile for 2 turns whatever they have, and gains 1 Weakness', () => {
    const a = arena({ p0: [['curse.mist'], ['companion.mist']], p1: [['charge'], ['shot'], ['shot']] });
    a.give(B1, 'swiftness', { stacks: 1 });
    a.use(A1, 'curse.mist', B1).use(A2, 'companion.mist').end().pass(1);
    expect(a.stacks(B1, 'weakness')).toBe(1);
    const heron = minions(a, 0, 'mist_heron')[0]!;
    a.use(heron.id, 'mist_heron_spear_beak', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Heavy Air: without it, the same enemy isn\'t Immobile', () => {
    const a = arena({ p0: [['curse.mist'], ['companion.mist']], p1: [['charge'], ['shot'], ['shot']] });
    a.give(B1, 'swiftness', { stacks: 1 });
    a.use(A2, 'companion.mist').end().pass(1);
    const heron = minions(a, 0, 'mist_heron')[0]!;
    a.use(heron.id, 'mist_heron_spear_beak', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Dewfall Ring: 20 and Sanctified; allies who damage them gain 3 Renew instead of healing 15', () => {
    const a = arena({ p0: [['smite.mist'], ['shot']], p1: three() });
    a.setHp(A2, 50).use(A1, 'smite.mist', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(65);
    // 3 Renew, which ticks once at the end of the turn (15) and drops to 2; no flat 15 on top
    expect([a.hp(A2), a.stacks(A2, 'renew')]).toEqual([65, 2]);
  });

  it('Dewfall Ring: the Sanctify lasts 1 turn', () => {
    const a = arena({ p0: [['smite.mist'], ['shot']], p1: three() });
    a.use(A1, 'smite.mist', B1).end().pass(1).use(A2, 'shot', B1).end();
    expect(a.stacks(A2, 'renew')).toBe(0);
  });

  it('Mercy of the Mist: all allies heal 20 and gain Fog for 1 turn, which condenses into 3 Renew', () => {
    const a = arena({ p0: three(['prayer.mist']), p1: three() });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.mist').end();
    expect([a.hp(A1), a.hp(A2), fogged(a, A2)]).toEqual([70, 70, true]);
    a.end();
    expect([fogged(a, A2), a.stacks(A2, 'renew'), a.stacks(A3, 'renew')]).toEqual([false, 3, 3]);
  });

  it('Stolen Wind: 25 / 15 to a random other enemy; the user takes all their mobility buffs', () => {
    const a = arena({ p0: [['cleave.mist']], p1: [['shot'], ['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).give(B2, 'rushing');
    a.use(A1, 'cleave.mist', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    expect([a.stacks(B1, 'swiftness'), a.has(B2, 'rushing')]).toEqual([0, false]);
    expect([a.stacks(A1, 'swiftness') >= 2, a.has(A1, 'rushing')]).toEqual([true, true]);
  });

  it('Foghorn: all enemies Intimidated for 2 turns; for 1 turn their Harmful skills on the user are turned back', () => {
    const a = arena({ p0: three(['shout.mist']), p1: three() });
    a.use(A1, 'shout.mist').end();
    expect([B1, B2, B3].map((b) => a.has(b, 'intimidated'))).toEqual([true, true, true]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(B1), a.hp(A2)]).toEqual([100, 85, 85]); // only skills aimed at the user
    a.pass(1).use(B3, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B3)]).toEqual([85, 100]); // over after 1 turn
  });

  it('Veil of Mist: 15 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.mist']], p1: three() });
    a.use(A1, 'withstand.mist').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Veil of Mist: a Fog condenses now: 15 more Shield and its 2 Renew', () => {
    const a = arena({ p0: [['withstand.mist']], p1: [['smash'], ['shot'], ['shot']] });
    a.give(A1, 'fog', { source: A1 }).use(A1, 'withstand.mist').end();
    expect(fogged(a, A1)).toBe(false);
    const shield = a.effects(A1).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);
    expect(shield).toBe(30);
    // 2 Renew; at full HP its first tick heals 0 and still costs a stack
    expect(a.stacks(A1, 'renew')).toBe(1);
    a.use(B2, 'shot', A1).use(B3, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100); // 30 Shield took both
  });

  it('Voice in the Fog: Invisible; for 2 turns the target\'s Harmful skills land on the user, then it ends', () => {
    const a = arena({ p0: three(['taunt.mist']), p1: three() });
    const seen = seenByB(a, B1);
    a.use(A1, 'taunt.mist', B1).end();
    expect(seenByB(a, B1)).toBe(seen); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A3).end();
    expect(sideHp(a, [A1, A2, A3])).toEqual([85, 100, 85]); // other enemies are unaffected
    a.pass(3).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85); // over
  });

  it('Voice in the Fog: a skill aimed at another ally is turned onto the user', () => {
    const a = arena({ p0: three(['taunt.mist']), p1: three() });
    a.use(A1, 'taunt.mist', B1).end().use(B1, 'shot', A2).end();
    expect(sideHp(a, [A1, A2])).toEqual([85, 100]);
  });

  it('Marid Form: 2 Armor, Immune and Fog for 3 turns; then the Fog condenses into 6 Renew', () => {
    const a = arena({ p0: [['titan.mist']], p1: three() });
    a.use(A1, 'titan.mist').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), fogged(a, A1)]).toEqual([2, true, true]);
    a.pass(4);
    expect(fogged(a, A1)).toBe(true);
    a.pass(1);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), fogged(a, A1)]).toEqual([0, false, false]);
    expect(a.stacks(A1, 'renew')).toBe(6);
  });
});

describe('Mist cost and cooldown (kit table)', () => {
  const table: Record<string, [string, number]> = {
    strike: ['I', 0], smash: ['Ar', 2], charge: ['nc', 1], riposte: ['r', 3], rage: ['S', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['I', 2], blast: ['Ar', 2], consume: ['r', 2], summon: ['r', 3], channel: ['II', 3],
    stab: ['r', 0], ravage: ['A', 1], mislead: ['I', 2], stun: ['r', 2], dance: ['Ar', 5],
    heal: ['A', 1], bless: ['r', 2], curse: ['W', 2], smite: ['I', 1], prayer: ['Wrr', 2],
    cleave: ['Ar', 1], shout: ['I', 2], withstand: ['r', 1], taunt: ['r', 3], titan: ['SW', 4],
  };
  const parse = (s: string): Cost => {
    const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
    if (s !== 'nc') for (const ch of s) c[ch as keyof Cost] += 1;
    return c;
  };
  for (const [arch, [cost, cd]] of Object.entries(table)) {
    it(`${arch}.mist costs ${cost}, cooldown ${cd}`, () => {
      const s = content.skills[`${arch}.mist`]!;
      expect([s.cost, s.cooldown]).toEqual([parse(cost), cd]);
    });
  }
  it('minion skills: Spear Beak r, Pale Touch nc', () => {
    expect(content.skills.mist_heron_spear_beak!.cost).toEqual(parse('r'));
    expect(content.skills.will_o_mist_pale_touch!.cost).toEqual(parse('nc'));
  });
});
