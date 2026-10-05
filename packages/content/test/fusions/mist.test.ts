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
 * Whether the unit has Fog: the Fog status itself or one of its variants (Heron, Mercy, Marid…),
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
    const a = arena({ p0: [['dance.mist', 'maneuver.mist']], p1: three() });
    a.use(A1, 'dance.mist').end().pass(1).use(A1, 'maneuver.mist').end();
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
    const a = arena({ p0: [['maneuver.mist']], p1: three() });
    a.use(A1, 'maneuver.mist').end();
    expect([fogged(a, A1), a.stacks(A1, 'renew')]).toEqual([true, 0]);
    a.end();
    expect([fogged(a, A1), a.stacks(A1, 'renew')]).toEqual([false, 2]);
  });
});

describe('Mist skills', () => {
  it('Veiled Strike: 15, and the user gains Fog for 1 turn', () => {
    const a = arena({ p0: three(['strike.mist']), p1: three() });
    a.use(A1, 'strike.mist', B1).end();
    expect([a.hp(B1), fogged(a, A1)]).toEqual([85, true]);
  });

  it('Veiled Strike: its Fog condenses on the enemy instead of the user: 15 damage when it ends, and no Renew', () => {
    const a = arena({ p0: three(['strike.mist']), p1: three() });
    a.use(A1, 'strike.mist', B1).end().end();
    expect([fogged(a, A1), a.hp(B1), a.stacks(A1, 'renew')]).toEqual([false, 70, 0]);
    // A skill that lands on the user anyway isn't a redirect: still 15.
    const b = arena({ p0: [['strike.mist']], p1: three() });
    b.use(A1, 'strike.mist', B1).end().use(B2, 'shot', A1).end();
    expect([b.hp(A1), b.hp(B1)]).toEqual([85, 70]);
  });

  it('Veiled Strike: 25 instead if the Fog redirected a skill', () => {
    const a = firstSeed(
      { p0: three(['strike.mist']), p1: three() },
      (x) => x.use(A1, 'strike.mist', B1).end().use(B2, 'shot', A1).end(),
      (x) => x.hp(A1) === 100,
    );
    expect(a.hp(B1)).toBe(60); // 85 − 25
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

  it('Mistwalk: 10 to the target, and nothing more on its own', () => {
    const a = arena({ p0: three(['charge.mist']), p1: three() });
    a.use(A1, 'charge.mist', B1).end();
    expect(sideHp(a, [B1, B2, B3])).toEqual([90, 100, 100]);
    a.pass(4);
    expect(sideHp(a, [B1, B2, B3])).toEqual([90, 100, 100]);
    expect(fogged(a, A1)).toBe(false);
  });

  it('Mistwalk: the user\'s next direct hit on another enemy is echoed onto the target, once', () => {
    const a = arena({ p0: three(['charge.mist', 'shot']), p1: three() });
    a.use(A1, 'charge.mist', B1).end().pass(1);
    a.use(A1, 'shot', B2).end();
    expect(sideHp(a, [B1, B2, B3])).toEqual([75, 85, 100]);
    a.pass(1).use(A1, 'shot', B3).end();
    expect(sideHp(a, [B1, B2, B3])).toEqual([75, 85, 85]); // used up
  });

  it('Mistwalk: the echo is as much as the hit, up to 25', () => {
    const a = arena({ p0: three(['charge.mist', 'ravage']), p1: three() });
    a.use(A1, 'charge.mist', B1).end().pass(1);
    a.give(A1, 'might', { stacks: 2 }).use(A1, 'ravage', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 65]); // a 35 hit echoes for 25
  });

  it('Mistwalk: hitting the target itself doesn\'t spend it, and it\'s gone after the user\'s next turn', () => {
    const a = arena({ p0: three(['charge.mist', 'shot']), p1: three() });
    a.use(A1, 'charge.mist', B1).end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect(a.has(A1, 'mistwalk')).toBe(false); // over at the end of that turn
    a.pass(1).use(A1, 'shot', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    // An ally's hit doesn't wake it.
    const b = arena({ p0: three(['charge.mist']), p1: three() });
    b.use(A1, 'charge.mist', B1).end().pass(1).use(A2, 'shot', B2).end();
    expect([b.hp(B1), b.hp(B2)]).toEqual([90, 85]);
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

  it('Dew Shot: it lands on a random enemy instead: 20, or 10 if that turns out to be the target', () => {
    const hit = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const a = arena({ p0: [['shot.mist']], p1: three(), seed });
      a.use(A1, 'shot.mist', B1).end();
      const lost = sideHp(a, [B1, B2, B3]).map((h) => 100 - h);
      expect(lost.filter((x) => x > 0)).toHaveLength(1);
      if (lost[0]! > 0) expect(lost).toEqual([10, 0, 0]);
      else expect(lost[1]! + lost[2]!).toBe(20);
      hit.add(lost.join(','));
    }
    expect(hit).toEqual(new Set(['10,0,0', '0,20,0', '0,0,20']));
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
      expect(a.stacks(B1, 'confusion')).toBe(1); // from the first one
      a.pass(1).use(B1, 'shot', A1).end();
      expect(a.hp(A1)).toBe(before[0]! - 15);
      expect(a.stacks(B1, 'confusion')).toBe(0); // their next skill spent it; no new one
    }
  });

  it('Dissipate: the user gains Fog for 1 turn, not Invulnerable; it condenses as usual', () => {
    const a = arena({ p0: three(['maneuver.mist']), p1: three() });
    a.use(A1, 'maneuver.mist').end();
    expect([fogged(a, A1), a.has(A1, 'invulnerable')]).toEqual([true, false]);
    a.end();
    expect([fogged(a, A1), a.has(A1, 'invulnerable'), a.stacks(A1, 'renew')]).toEqual([false, false, 2]);
  });

  it('Dissipate: the first time the Fog sends a skill elsewhere, the user becomes Invulnerable for 1 turn', () => {
    const a = firstSeed(
      { p0: three(['maneuver.mist']), p1: three() },
      (x) => x.use(A1, 'maneuver.mist').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end(),
      (x) => x.hp(A2) + x.hp(A3) === 185,
    );
    // The first shot went elsewhere; the second couldn't reach the now-Invulnerable user.
    expect([a.hp(A1), a.has(A1, 'invulnerable')]).toEqual([100, true]);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy(); // still Invulnerable on the next enemy turn
    a.end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
    // A shot that lands on the user anyway isn't a redirect: no Invulnerable.
    const b = firstSeed(
      { p0: three(['maneuver.mist']), p1: three() },
      (x) => x.use(A1, 'maneuver.mist').end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 85,
    );
    expect(b.has(A1, 'invulnerable')).toBe(false);
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

  it('Mist Double: a Double for 2 turns; when it fades, the user gains Fog for 1 turn', () => {
    const a = arena({ p0: three(['summon.mist']), p1: three() });
    a.use(A1, 'summon.mist').end();
    expect(minions(a, 0, 'mist_double')).toHaveLength(1);
    expect(fogged(a, A1)).toBe(false);
    a.pass(2);
    expect(minions(a, 0, 'mist_double')).toHaveLength(1);
    a.pass(1);
    expect(minions(a, 0, 'mist_double')).toHaveLength(0);
    expect(a.has(A1, 'mist_double_decoy')).toBe(false);
    expect(fogged(a, A1)).toBe(true);
  });

  it('Mist Double: the first enemy single-target Harmful skill aimed at the user strikes the Double, which bursts: its user takes 10, and the user gains Fog for 1 turn', () => {
    const a = arena({ p0: three(['summon.mist']), p1: three() });
    a.use(A1, 'summon.mist').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), minions(a, 0, 'mist_double').length, fogged(a, A1)]).toEqual([100, 90, 0, true]);
    a.end().pass(1);
    expect(fogged(a, A1)).toBe(false);
    expect(a.stacks(A1, 'renew')).toBeGreaterThan(0); // that Fog condensed as usual
  });

  it('Mist Double: a skill that does no damage bursts it too: a Stun meant for the user is spent on it', () => {
    const a = arena({ p0: three(['summon.mist']), p1: [['stun'], ['shot'], ['shot']] });
    a.use(A1, 'summon.mist').end();
    a.use(B1, 'stun', A1).end();
    expect([a.has(A1, 'stun'), a.hp(A1), a.hp(B1), minions(a, 0, 'mist_double').length]).toEqual([false, 100, 90, 0]);
  });

  it('Mist Double: it can’t be hurt (a burn doesn’t touch it), and the user’s allies aren’t covered', () => {
    const a = arena({ p0: three(['summon.mist']), p1: three() });
    a.use(A1, 'summon.mist').end();
    const [d] = minions(a, 0, 'mist_double');
    a.give(d!.id, 'ignite', { source: B1 }).use(B3, 'shot', A2).end();
    expect([a.unit(d!.id).alive, a.unit(d!.id).hp, a.hp(A2), a.hp(B3)]).toEqual([true, 20, 85, 100]);
  });

  it('Mist Double: a skill that hits the user’s whole side bursts it as well', () => {
    const a = arena({ p0: three(['summon.mist']), p1: [['blast'], ['shot'], ['shot']] });
    a.use(A1, 'summon.mist').end().use(B1, 'blast').end();
    expect(sideHp(a, [A1, A2, A3])).toEqual([65, 65, 65]);
    expect(minions(a, 0, 'mist_double')).toHaveLength(0);
    expect(a.hp(B1)).toBe(90);
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

  it('Whisper Knife: 10 to the target; on its own, that\'s all', () => {
    const a = arena({ p0: [['stab.mist']], p1: three() });
    a.setHp(B1, 50).use(A1, 'stab.mist', B1).end();
    expect(a.hp(B1)).toBe(40);
  });

  it('Whisper Knife: the first direct hit from an ally while the target is at or below 60 HP brings 15 more, once', () => {
    const a = arena({ p0: [['stab.mist'], ['shot'], ['shot']], p1: three() });
    a.setHp(B1, 70).use(A1, 'stab.mist', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(15); // 70 − 10 − 15 − 15 (knife) − 15
  });

  it('Whisper Knife: a hit above 60 HP doesn\'t spring it, and it\'s gone by the user\'s next turn', () => {
    const a = arena({ p0: [['stab.mist'], ['shot'], ['shot']], p1: three() });
    a.use(A1, 'stab.mist', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75); // 100 − 10 − 15: above 60 when the shot landed
    const b = arena({ p0: [['stab.mist'], ['shot'], ['shot']], p1: three() });
    b.setHp(B1, 50).use(A1, 'stab.mist', B1).end();
    expect(b.has(B1, 'whisper_knife')).toBe(true);
    b.end();
    expect(b.has(B1, 'whisper_knife')).toBe(false);
    b.use(A2, 'shot', B1).end();
    expect(b.hp(B1)).toBe(25); // 40 − 15, no knife
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

  it('Lost in the Fog: Invisible; for 1 turn the target\'s Harmful skill is countered, and a single-target one lands on a random one of their own allies', () => {
    const hit = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: three(['mislead.mist']), p1: three(), seed });
      const seen = seenByB(a, B1);
      a.use(A1, 'mislead.mist', B1).end();
      expect(seenByB(a, B1)).toBe(seen); // Invisible
      a.use(B1, 'shot', A2).end();
      expect(sideHp(a, [A1, A2, A3])).toEqual([100, 100, 100]);
      expect(a.hp(B1)).toBe(100);
      expect(a.hp(B2) + a.hp(B3)).toBe(185);
      hit.add(a.hp(B2) === 85 ? B2 : B3);
      a.pass(1).use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(85); // over after 1 turn
    }
    expect(hit.size).toBe(2);
  });

  it('Lost in the Fog: an area skill is just countered; so is a single-target one with no allies to land on; Helpful skills go through', () => {
    const a = arena({ p0: three(['mislead.mist']), p1: [['blast'], ['shot'], ['shot']] });
    a.use(A1, 'mislead.mist', B1).end().use(B1, 'blast').end();
    expect([...sideHp(a, [A1, A2, A3]), ...sideHp(a, [B1, B2, B3])]).toEqual([100, 100, 100, 100, 100, 100]);
    const b = arena({ p0: three(['mislead.mist']), p1: [['shot']] });
    b.use(A1, 'mislead.mist', B1).end().use(B1, 'shot', A2).end();
    expect([b.hp(A2), b.hp(B1)]).toEqual([100, 100]);
    const c = arena({ p0: three(['mislead.mist']), p1: [['heal'], ['shot'], ['shot']] });
    c.setHp(B2, 50).use(A1, 'mislead.mist', B1).end().use(B1, 'heal', B2).end();
    expect(c.hp(B2)).toBe(75);
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

  it('Dewfall Ring: 20; each of the user\'s allies the target deals direct damage to gains Fog for 1 turn', () => {
    const a = arena({ p0: three(['smite.mist']), p1: three() });
    a.use(A1, 'smite.mist', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([false, false, false]);
    a.use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect(sideHp(a, [A2, A3])).toEqual([85, 85]);
    expect([A1, A2, A3].map((u) => fogged(a, u))).toEqual([false, true, false]); // only the ringed enemy's hits
    a.pass(1);
    expect(fogged(a, A2)).toBe(true); // through the enemy's next turn
    a.pass(1);
    expect([fogged(a, A2), a.stacks(A2, 'renew')]).toEqual([false, 2]);
  });

  it('Dewfall Ring: it lasts 2 turns', () => {
    const a = arena({ p0: three(['smite.mist']), p1: three() });
    a.use(A1, 'smite.mist', B1).end().pass(2).use(B1, 'shot', A3).end();
    expect([a.hp(A3), fogged(a, A3)]).toEqual([85, true]);
    const b = arena({ p0: three(['smite.mist']), p1: three() });
    b.use(A1, 'smite.mist', B1).end().pass(4).use(B1, 'shot', A3).end();
    expect([b.hp(A3), fogged(b, A3)]).toEqual([85, false]);
  });

  it('Mercy of the Mist: all allies heal 15 and gain Fog for 1 turn, which doesn\'t condense into Renew', () => {
    const a = arena({ p0: three(['prayer.mist']), p1: three() });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.mist').end();
    expect([a.hp(A1), a.hp(A2), fogged(a, A2)]).toEqual([65, 65, true]);
    a.end();
    expect([fogged(a, A2), a.stacks(A2, 'renew'), a.stacks(A3, 'renew')]).toEqual([false, 0, 0]);
  });

  it('Mercy of the Mist: meanwhile, each skill Fog redirects heals every ally 10', () => {
    const a = firstSeed(
      { p0: three(['prayer.mist']), p1: three() },
      (x) => x.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50).use(A1, 'prayer.mist').end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) !== 50,
    );
    expect(a.hp(A1)).toBe(75); // 65, and 10 when the Shot was redirected
    expect([a.hp(A2), a.hp(A3)].sort()).toEqual([60, 75]); // the one it landed on: 65 − 15 + 10
    const b = firstSeed(
      { p0: three(['prayer.mist']), p1: three() },
      (x) => x.setHp(A1, 50).setHp(A2, 50).setHp(A3, 50).use(A1, 'prayer.mist').end().use(B1, 'shot', A1).end(),
      (x) => x.hp(A1) === 50,
    );
    expect([b.hp(A2), b.hp(A3)]).toEqual([65, 65]); // landed as aimed: no redirect, no healing
  });

  it('Mistcutter: 20 to the target; without Fog, the mist gathers: a random other enemy takes 10, and the user gains Fog until the end of their next 2 turns', () => {
    const a = arena({ p0: three(['cleave.mist']), p1: three() });
    a.use(A1, 'cleave.mist', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.hp(B2), a.hp(B3)].sort((x, y) => x - y)).toEqual([90, 100]);
    expect(a.hp(A2) + a.hp(A3)).toBe(200);
    expect([fogged(a, A1), a.has(A1, 'renew')]).toEqual([true, false]);
    a.pass(2); // past the end of the user's next turn
    expect(fogged(a, A1)).toBe(true);
    a.pass(1); // their second turn: still there
    expect(fogged(a, A1)).toBe(true);
    a.pass(1); // the end of their second turn
    expect([fogged(a, A1), a.has(A1, 'renew')]).toEqual([false, true]); // unspent, it condensed as usual
  });

  it('Mistcutter: the random enemy is never the target', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: three(['cleave.mist']), p1: three(), seed });
      a.use(A1, 'cleave.mist', B2).end();
      expect(a.hp(B2)).toBe(80);
      expect(a.hp(B1) + a.hp(B3)).toBe(190);
    }
  });

  it('Mistcutter: with Fog, it condenses into the blade instead of Renew: the Fog ends, and every other enemy takes 15', () => {
    const a = arena({ p0: three(['cleave.mist']), p1: three() });
    a.use(A1, 'cleave.mist', B1).end().pass(1);
    expect(a.cooldown(A1, 'cleave.mist')).toBeGreaterThan(0); // cooldown 1: not ready the next turn
    a.pass(2);
    const before = sideHp(a, [B1, B2, B3]);
    a.use(A1, 'cleave.mist', B2).end(); // the gathered Fog is still there when it's ready again
    expect(sideHp(a, [B1, B2, B3])).toEqual([before[0]! - 15, before[1]! - 20, before[2]! - 15]);
    expect([fogged(a, A1), a.has(A1, 'renew')]).toEqual([false, false]);
  });

  it('Mistcutter: Fog from anywhere condenses into it, and the user’s side is untouched', () => {
    const a = arena({ p0: three(['cleave.mist']), p1: three() });
    a.give(A1, 'fog').use(A1, 'cleave.mist', B3).end();
    expect(sideHp(a, [B1, B2, B3, A2, A3])).toEqual([85, 85, 80, 100, 100]);
    expect([fogged(a, A1), a.has(A1, 'renew')]).toEqual([false, false]);
  });

  it('Foghorn: 3 times, a random enemy character is Intimidated for 2 turns; it can be the same one', () => {
    let doubled = false;
    for (let seed = 1; seed <= 20; seed++) {
      const a = arena({ p0: three(['shout.mist']), p1: three(), seed });
      a.use(A1, 'shout.mist').end();
      const s = [B1, B2, B3].map((b) => a.stacks(b, 'intimidated'));
      expect(s.reduce((n, x) => n + x, 0)).toBe(3);
      if (Math.max(...s) >= 2) doubled = true;
    }
    expect(doubled).toBe(true);
  });

  it('Foghorn: minions aren\'t picked, and it lasts 2 turns', () => {
    const total = (a: Arena) => [B1, B2, B3].reduce((n, b) => n + a.stacks(b, 'intimidated'), 0);
    const a = arena({ p0: three(['shout.mist']), p1: [['companion.mist'], ['shot'], ['shot']] });
    a.end().use(B1, 'companion.mist').end();
    const heron = minions(a, 1, 'mist_heron')[0]!;
    a.use(A1, 'shout.mist').end();
    expect([a.stacks(heron.id, 'intimidated'), total(a)]).toEqual([0, 3]);
    a.pass(2);
    expect(total(a)).toBe(3);
    a.pass(1);
    expect(total(a)).toBe(0);
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

  it('Marid Form: Immune and Fog for 3 turns, and no Armor', () => {
    const a = arena({ p0: [['titan.mist']], p1: three() });
    a.use(A1, 'titan.mist').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune'), fogged(a, A1)]).toEqual([0, true, true]);
    a.pass(4);
    expect([a.has(A1, 'immune'), fogged(a, A1)]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(A1, 'immune'), fogged(a, A1), a.has(A1, 'marid_form')]).toEqual([false, false, false]);
    expect(a.stacks(A1, 'renew')).toBe(2); // an ordinary Fog: it condenses into 2
  });

  it('Marid Form: each of the user\'s skills that deals direct damage also deals 10 to a random enemy', () => {
    const lost = (a: Arena) => 300 - a.hp(B1) - a.hp(B2) - a.hp(B3);
    const a = arena({ p0: [['titan.mist', 'shot', 'curse']], p1: three() });
    a.use(A1, 'titan.mist').end();
    expect(lost(a)).toBe(0);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(lost(a)).toBe(25); // 15 + 10
    a.pass(1).use(A1, 'curse', B2).end();
    expect(lost(a)).toBe(25); // no direct damage: no spill
  });
});

describe('Mist cost and cooldown (kit table)', () => {
  const table: Record<string, [string, number]> = {
    strike: ['I', 0], smash: ['Ar', 2], charge: ['S', 2], riposte: ['r', 3], rage: ['S', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['I', 2], blast: ['Ar', 2], consume: ['r', 2], summon: ['I', 2], channel: ['II', 3],
    stab: ['r', 0], ravage: ['A', 1], mislead: ['I', 3], stun: ['r', 2], dance: ['Ar', 5],
    heal: ['A', 1], bless: ['r', 2], curse: ['W', 2], smite: ['I', 1], prayer: ['Wrr', 2],
    cleave: ['Ar', 1], shout: ['I', 3], withstand: ['r', 1], taunt: ['r', 3], titan: ['SW', 4],
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
  it('minion skills: Spear Beak r; the Mist Double has none', () => {
    expect(content.skills.mist_heron_spear_beak!.cost).toEqual(parse('r'));
    expect(content.minions.mist_double!.skills).toEqual([]);
  });
});
