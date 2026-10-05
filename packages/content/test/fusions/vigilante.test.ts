// Spec-driven scenarios for the Vigilante fusion (Holy + Shadow): Exposed and all 30 variants.
// Sources: in-game descriptions, docs/rules.md §21.54, and the Holy & Unholy pairs kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { parseCost, viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type Arena = ReturnType<typeof arena>;

const condemnDebuffs = (a: Arena, id: string) =>
  a.stacks(id, 'weakness') + a.stacks(id, 'vulnerable') + a.stacks(id, 'confusion');

const minion = (a: Arena, defId: string) => a.state.units.find((u) => u.defId === defId)!;

/** Does `viewer` see any effect on `bearer` applied by `source`? */
const sees = (a: Arena, viewer: 0 | 1, bearer: string, source?: string) =>
  viewFor(content, a.state, viewer).effects.some((e) => e.bearer === bearer && (!source || e.source === source));

const shieldOn = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => {
    const def = e.inline ?? content.statuses[e.defId];
    return n + (def && 'shield' in def && def.shield ? e.value : 0);
  }, 0);

describe('Vigilante: costs and cooldowns match the kit table', () => {
  const table: [string, string, number | null][] = [
    ['strike.vigilante', 'S', 0],
    ['smash.vigilante', 'Sr', 2],
    ['charge.vigilante', 'S', 2],
    ['riposte.vigilante', 'A', 3],
    ['rage.vigilante', 'WA', 4],
    ['shot.vigilante', 'r', 0],
    ['snipe.vigilante', 'Ar', 2],
    ['trap.vigilante', 'r', 2],
    ['maneuver.vigilante', 'r', 4],
    ['companion.vigilante', 'I', 1],
    ['bolt.vigilante', 'Ar', 1],
    ['blast.vigilante', 'Irr', 2],
    ['consume.vigilante', 'r', 2],
    ['summon.vigilante', 'I', 1],
    ['channel.vigilante', 'A', 3],
    ['stab.vigilante', 'r', 0],
    ['ravage.vigilante', 'Ar', 1],
    ['mislead.vigilante', 'A', 2],
    ['stun.vigilante', 'A', 2],
    ['dance.vigilante', 'A', 1],
    ['heal.vigilante', 'W', 1],
    ['bless.vigilante', 'r', 2],
    ['curse.vigilante', 'A', 2],
    ['smite.vigilante', 'W', 1],
    ['prayer.vigilante', 'Wrr', 2],
    ['cleave.vigilante', 'S', 1],
    ['shout.vigilante', 'Wr', 3],
    ['withstand.vigilante', 'A', 2],
    ['taunt.vigilante', 'r', 2],
    ['titan.vigilante', 'AW', 4],
    // Minion skills: the kit lists costs only.
    ['bloodhound_run_down', 'r', null],
    ['bloodhound_scent', 'r', null],
    ['informant_tip_off', 'r', null],
  ];
  it.each(table)('%s costs %s (cooldown %s)', (id, cost, cd) => {
    const s = content.skills[id]!;
    expect(s.cost).toEqual(parseCost(cost));
    if (cd !== null) expect(s.cooldown).toBe(cd);
  });

  it('every Vigilante variant is in the table', () => {
    const ids = Object.values(content.skills)
      .filter((s) => s.element === 'Vigilante')
      .map((s) => s.id)
      .sort();
    expect(ids).toEqual(table.map((t) => t[0]).sort());
  });

  it('tags: Invisible, Stealthy, Channeled and hidden-target skills', () => {
    for (const id of ['riposte.vigilante', 'trap.vigilante', 'stab.vigilante', 'mislead.vigilante', 'bless.vigilante'])
      expect(content.skills[id]!.tags).toContain('Invisible');
    expect(content.skills['snipe.vigilante']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    expect(content.skills['channel.vigilante']!.tags).toContain('Channeled');
  });
});

describe('Vigilante: Exposed', () => {
  it('is a Debuff (Immune blocks it)', () => {
    expect(content.statuses.exposed!.kind).toBe('Debuff');
    const a = arena({ p0: [['curse.vigilante']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'curse.vigilante', B1).end();
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it('Vigilante skills deal 10 more to the bearer', () => {
    const a = arena({ p0: [['smite.vigilante'], ['smite.vigilante']], p1: [['shot'], ['shot']] });
    a.give(B1, 'exposed', { source: A1 }).use(A1, 'smite.vigilante', B1).use(A2, 'smite.vigilante', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('non-Vigilante skills get no bonus', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'exposed', { source: A1 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('existing Stealth and Invulnerable end when Exposed lands', () => {
    const a = arena({ p0: [['blast.vigilante']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'stealth').give(B2, 'invulnerable');
    a.use(A1, 'blast.vigilante').end();
    expect([a.has(B1, 'exposed'), a.has(B1, 'stealth')]).toEqual([true, false]);
    expect([a.has(B2, 'exposed'), a.has(B2, 'invulnerable')]).toEqual([true, false]);
  });

  it("the bearer can't become Stealthed or Invulnerable", () => {
    const a = arena({ p0: [['curse.vigilante'], ['curse.vigilante']], p1: [['bless.shadow'], ['maneuver']] });
    a.use(A1, 'curse.vigilante', B1).use(A2, 'curse.vigilante', B2).end();
    a.use(B1, 'bless.shadow', B1).use(B2, 'maneuver').end();
    expect([a.has(B1, 'stealth'), a.has(B2, 'invulnerable')]).toEqual([false, false]);
  });

  it('the Invisible effects the bearer owns are revealed', () => {
    const a = arena({ p0: [['curse.vigilante'], ['shot']], p1: [['trap']] });
    a.pass(1).use(B1, 'trap', A2).end();
    expect(sees(a, 0, A2, B1)).toBe(false); // hidden before
    a.use(A1, 'curse.vigilante', B1).end();
    expect(sees(a, 0, A2, B1)).toBe(true);
  });
});

describe('Vigilante skills', () => {
  it('Street Justice: 20; the last enemy to damage the user is Exposed first, for 30', () => {
    const a = arena({ p0: [['strike.vigilante']], p1: [['shot'], ['shot']] });
    a.pass(1).use(B2, 'shot', A1).use(B1, 'shot', A1).end(); // B1 hit last
    a.use(A1, 'strike.vigilante', B1).end();
    expect([a.hp(B1), a.has(B1, 'exposed')]).toEqual([70, true]);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false); // 1 turn
  });

  it('Street Justice: an enemy who wasn\'t the last to hit the user takes 20 and isn\'t Exposed', () => {
    const a = arena({ p0: [['strike.vigilante']], p1: [['shot'], ['shot']] });
    a.pass(1).use(B2, 'shot', A1).use(B1, 'shot', A1).end();
    a.use(A1, 'strike.vigilante', B2).end();
    expect([a.hp(B2), a.has(B2, 'exposed')]).toEqual([80, false]);
  });

  it('Round Up the Gang: 25, and 25 to each other enemy carrying a Buff', () => {
    const a = arena({ p0: [['smash.vigilante']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'might').use(A1, 'smash.vigilante', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 75, 100]);
  });

  it("Pursuit: not Stealthed, 15 and the user gains Stealth (the target isn't Exposed)", () => {
    const a = arena({ p0: [['charge.vigilante']], p1: [['shot']] });
    a.use(A1, 'charge.vigilante', B1).end();
    expect([a.hp(B1), a.has(B1, 'exposed'), a.has(A1, 'stealth')]).toEqual([85, false, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Pursuit: from Stealth, the target is Exposed for 2 turns first (25 in all), and the Stealth is spent', () => {
    const a = arena({ p0: [['charge.vigilante']], p1: [['shot']] });
    a.give(A1, 'stealth').use(A1, 'charge.vigilante', B1).end();
    expect([a.hp(B1), a.has(B1, 'exposed'), a.has(A1, 'stealth')]).toEqual([75, true, false]);
    a.pass(2);
    expect(a.has(B1, 'exposed')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it('Pursuit: the Stealth it gives sets up the next ambush (kept by Stealthy skills meanwhile)', () => {
    const a = arena({ p0: [['charge.vigilante', 'charge.shadow', 'shot.shadow']], p1: [['shot']] });
    a.use(A1, 'charge.vigilante', B1).end().pass(1); // 85, Stealthed
    a.use(A1, 'charge.shadow', B1).end().pass(1); // Long Shadow is Stealthy, and so is the next skill
    a.use(A1, 'shot.shadow', B1).end().pass(1);
    expect(a.has(A1, 'stealth')).toBe(true);
    const before = a.hp(B1);
    a.use(A1, 'charge.vigilante', B1).end();
    expect([before - a.hp(B1), a.has(B1, 'exposed')]).toEqual([25, true]);
  });

  it("Caught Red-Handed: Invisible; the first Harmful skill an enemy uses on one of the user's allies is countered, and its user is Exposed for 2 turns", () => {
    const a = arena({ p0: [['riposte.vigilante'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'riposte.vigilante').end();
    expect([sees(a, 1, A2), sees(a, 1, A3)]).toEqual([false, false]);
    a.use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect([a.hp(A2), a.hp(A3)]).toEqual([100, 85]); // only the first one
    expect([a.has(B1, 'exposed'), a.has(B2, 'exposed')]).toEqual([true, false]);
    a.pass(3);
    expect(a.has(B1, 'exposed')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it("Caught Red-Handed: the user keeps watch instead of covering themselves", () => {
    const a = arena({ p0: [['riposte.vigilante'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.vigilante').end().use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 100]);
    expect([a.has(B1, 'exposed'), a.has(B2, 'exposed')]).toEqual([false, true]);
    // Alone, there's no one to watch over.
    const b = arena({ p0: [['riposte.vigilante']], p1: [['shot']] });
    b.use(A1, 'riposte.vigilante').end().use(B1, 'shot', A1).end();
    expect(b.hp(A1)).toBe(85);
  });

  it('Caught Red-Handed: a skill aimed at the whole side is countered too', () => {
    const a = arena({ p0: [['riposte.vigilante'], ['shot'], ['shot']], p1: [['blast'], ['shot'], ['shot']] });
    a.use(A1, 'riposte.vigilante').end().use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3), a.has(B1, 'exposed')]).toEqual([100, 100, 100, true]);
  });

  it('Caught Red-Handed: lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.vigilante'], ['shot']], p1: [['shot']] });
    a.use(A1, 'riposte.vigilante').end().pass(2).use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'exposed')]).toEqual([85, false]);
  });

  it('The Hunt Begins: 1 Might for 3 turns', () => {
    const a = arena({ p0: [['rage.vigilante']], p1: [['shot']] });
    a.use(A1, 'rage.vigilante').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([1, 0]);
    a.pass(4);
    expect(a.stacks(A1, 'might')).toBe(1);
    a.pass(1);
    expect(a.stacks(A1, 'might')).toBe(0);
  });

  it('The Hunt Begins: each enemy the user damages is Exposed for 2 turns', () => {
    const a = arena({ p0: [['rage.vigilante', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.vigilante').end().pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'exposed'), a.has(B2, 'exposed')]).toEqual([true, false]);
    a.pass(2);
    expect(a.has(B1, 'exposed')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it('The Hunt Begins: 5 more to Exposed enemies, so the second hit on the quarry pays off', () => {
    const a = arena({ p0: [['rage.vigilante', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.vigilante').end().pass(1);
    a.use(A1, 'shot', B1).end().pass(1);
    expect(a.hp(B1)).toBe(100 - 20); // Shot 15 + Might 5; not Exposed yet
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80 - 25); // now Exposed: 5 more
  });

  it('Searchlight: 10 to a random enemy, Stealthed ones included; a Stealthed one is Exposed', () => {
    let stealthedHit = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['shot.vigilante']], p1: [['shot'], ['shot']], seed });
      a.give(B1, 'stealth').use(A1, 'shot.vigilante').end();
      if (a.hp(B1) < 100) {
        stealthedHit++;
        // Whether the fresh Exposed already adds its +10 isn't specified (Floodlight says "first"; this doesn't).
        expect([80, 90]).toContain(a.hp(B1));
        expect([a.has(B1, 'exposed'), a.has(B1, 'stealth')]).toEqual([true, false]);
      } else {
        expect([a.hp(B2), a.has(B2, 'exposed')]).toEqual([90, false]);
      }
    }
    expect(stealthedHit).toBeGreaterThan(0);
  });

  it('Searchlight: usable when the only enemy is Stealthed', () => {
    const a = arena({ p0: [['shot.vigilante']], p1: [['shot']] });
    a.give(B1, 'stealth').use(A1, 'shot.vigilante').end();
    expect(a.has(B1, 'exposed')).toBe(true);
  });

  it('Searchlight: an un-Stealthed enemy just takes 10', () => {
    const a = arena({ p0: [['shot.vigilante']], p1: [['shot']] });
    a.use(A1, 'shot.vigilante').end();
    expect([a.hp(B1), a.has(B1, 'exposed')]).toEqual([90, false]);
  });

  it('Searchlight: exactly one enemy is hit', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = arena({ p0: [['shot.vigilante']], p1: [['shot'], ['shot'], ['shot']], seed });
      a.give(B2, 'stealth').use(A1, 'shot.vigilante').end();
      expect([B1, B2, B3].filter((b) => a.hp(b) < 100)).toHaveLength(1);
    }
  });

  it('From the Rooftops: 40 on the following turn, target hidden', () => {
    const a = arena({ p0: [['snipe.vigilante']], p1: [['shot']] });
    a.use(A1, 'snipe.vigilante', B1).end();
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1 && e.targets.length)?.targets).toBeUndefined();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.has(B1, 'exposed')]).toEqual([60, false]);
  });

  it('From the Rooftops: if the target used an Invisible skill meanwhile, 20 more and Exposed', () => {
    const a = arena({ p0: [['snipe.vigilante']], p1: [['riposte']] });
    a.use(A1, 'snipe.vigilante', B1).end();
    a.use(B1, 'riposte').end();
    expect(a.has(B1, 'exposed')).toBe(true);
    expect(a.hp(B1)).toBeLessThanOrEqual(40);
  });

  it('From the Rooftops: if the target gained Stealth meanwhile, 20 more and Exposed', () => {
    const a = arena({ p0: [['snipe.vigilante']], p1: [['bless.shadow']] });
    a.use(A1, 'snipe.vigilante', B1).end();
    a.use(B1, 'bless.shadow', B1).end();
    expect(a.has(B1, 'exposed')).toBe(true);
    expect(a.hp(B1)).toBeLessThanOrEqual(40);
  });

  it('Sting Operation: Invisible; a Stealthy skill is countered and its user Exposed', () => {
    const a = arena({ p0: [['trap.vigilante']], p1: [['charge.shadow']] });
    a.use(A1, 'trap.vigilante', B1).end();
    expect(sees(a, 1, B1, A1)).toBe(false);
    a.use(B1, 'charge.shadow', A1).end();
    expect([a.hp(A1), a.has(B1, 'exposed')]).toEqual([100, true]);
  });

  it('Sting Operation: an Invisible skill (even a Helpful one) is countered', () => {
    const a = arena({ p0: [['trap.vigilante', 'shot']], p1: [['riposte.shadow']] });
    a.use(A1, 'trap.vigilante', B1).end();
    a.use(B1, 'riposte.shadow').end();
    expect(a.has(B1, 'exposed')).toBe(true);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85); // no Riposte was set up
  });

  it('Sting Operation: ordinary skills go through', () => {
    const a = arena({ p0: [['trap.vigilante']], p1: [['shot']] });
    a.use(A1, 'trap.vigilante', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'exposed')]).toEqual([85, false]);
  });

  it('Safe Passage: the user and target ally are Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.vigilante'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.vigilante', A2).end();
    expect([a.has(A1, 'invulnerable'), a.has(A2, 'invulnerable'), a.has(A3, 'invulnerable')]).toEqual([true, true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end();
    expect([a.has(A1, 'invulnerable'), a.has(A2, 'invulnerable')]).toEqual([false, false]);
  });

  it("Safe Passage: the user can't use Harmful skills on their next turn (Helpful ones are fine)", () => {
    const a = arena({ p0: [['maneuver.vigilante', 'shot', 'heal'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.vigilante', A2).end().pass(1);
    a.reject(() => a.use(A1, 'shot', B1));
    a.use(A1, 'heal', A1).end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Bloodhound: a permanent 30 HP minion; Run Down is 10 Piercing', () => {
    const a = arena({ p0: [['companion.vigilante']], p1: [['shot']] });
    a.use(A1, 'companion.vigilante').end().pass(1);
    const h = minion(a, 'bloodhound');
    expect([h.owner, h.hp]).toEqual([0, 30]);
    a.give(B1, 'armor', { stacks: 3 }).use(h.id, 'bloodhound_run_down', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(12);
    expect(a.unit(h.id).alive).toBe(true);
  });

  it('Bloodhound: Scent Exposes the target while the hound lives, until it uses Scent again', () => {
    const a = arena({ p0: [['companion.vigilante']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.vigilante').end().pass(1);
    const h = minion(a, 'bloodhound');
    a.use(h.id, 'bloodhound_scent', B1).end().pass(7);
    expect(a.has(B1, 'exposed')).toBe(true);
    a.use(h.id, 'bloodhound_scent', B2).end();
    expect([a.has(B1, 'exposed'), a.has(B2, 'exposed')]).toEqual([false, true]);
    a.setHp(h.id, 5).use(B1, 'shot', h.id).end();
    expect([a.unit(h.id).alive, a.has(B2, 'exposed')]).toEqual([false, false]);
  });

  it("Cover Fire: 20, and the user's other ally with the least HP gains Stealth if they haven't acted yet", () => {
    const a = arena({ p0: [['bolt.vigilante'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 10).setHp(A2, 80).setHp(A3, 50).use(A1, 'bolt.vigilante', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([a.has(A1, 'stealth'), a.has(A2, 'stealth'), a.has(A3, 'stealth')]).toEqual([false, false, true]);
    expect(a.reject(() => a.use(B1, 'shot', A3))).toBe('bad_target');
  });

  it('Cover Fire: an ally who already acted this turn gets no Stealth', () => {
    const a = arena({ p0: [['bolt.vigilante'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 80).setHp(A3, 50).use(A3, 'shot', B1).use(A1, 'bolt.vigilante', B1).end();
    expect([a.hp(B1), a.has(A2, 'stealth'), a.has(A3, 'stealth')]).toEqual([65, false, false]);
  });

  it('Cover Fire: an ally who acts after it loses the Stealth at once', () => {
    const a = arena({ p0: [['bolt.vigilante'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 80).setHp(A3, 50).use(A1, 'bolt.vigilante', B1).use(A3, 'shot', B1).end();
    expect(a.has(A3, 'stealth')).toBe(false);
  });

  it('Floodlight: 25 to all; Stealthed and Invulnerable enemies are Exposed first and take 10 more', () => {
    const a = arena({ p0: [['blast.vigilante']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'stealth').give(B2, 'invulnerable').use(A1, 'blast.vigilante').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([65, 65, 75]);
    expect([a.has(B1, 'exposed'), a.has(B2, 'exposed'), a.has(B3, 'exposed')]).toEqual([true, true, false]);
    a.pass(2);
    expect(a.has(B1, 'exposed')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it('Shakedown: 5, and the user takes a random Buff of theirs (and no heal)', () => {
    const a = arena({ p0: [['consume.vigilante']], p1: [['shot']] });
    a.give(B1, 'might').setHp(A1, 50).use(A1, 'consume.vigilante', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 50]);
    expect([a.has(B1, 'might'), a.has(A1, 'might')]).toEqual([false, true]);
  });

  it('Shakedown: with no Buff to take, the user heals 15 instead', () => {
    const a = arena({ p0: [['consume.vigilante']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.vigilante', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 65]);
  });

  it('Informant: 15 HP for 3 turns; whoever damages it is Exposed for 2 turns', () => {
    const a = arena({ p0: [['summon.vigilante']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.vigilante').end();
    const i = minion(a, 'informant');
    expect([i.owner, i.hp]).toEqual([0, 15]);
    a.use(B1, 'shot', i.id).end();
    expect([a.has(B1, 'exposed'), a.has(B2, 'exposed')]).toEqual([true, false]);
  });

  it('Informant: leaves after 3 turns', () => {
    const a = arena({ p0: [['summon.vigilante']], p1: [['shot']] });
    a.use(A1, 'summon.vigilante').end();
    const i = minion(a, 'informant');
    a.pass(4);
    expect(a.unit(i.id).alive).toBe(true);
    a.pass(1);
    expect(a.unit(i.id).alive).toBe(false);
  });

  it("Informant: Tip Off makes its creator's next skill Stealthy", () => {
    const a = arena({ p0: [['summon.vigilante', 'dance.vigilante', 'shot']], p1: [['shot']] });
    a.use(A1, 'summon.vigilante').end().pass(1).use(A1, 'dance.vigilante').end().pass(1);
    const i = minion(a, 'informant');
    a.use(i.id, 'informant_tip_off').use(A1, 'shot', B1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Night Patrol: the first tick spares enemies who have used nothing', () => {
    const a = arena({ p0: [['channel.vigilante'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.vigilante').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'exposed')]).toEqual([100, 100, false]);
  });

  it('Night Patrol: each user turn, enemies who used a Harmful skill since take 10 and are Exposed 1 turn', () => {
    const a = arena({ p0: [['channel.vigilante'], ['shot']], p1: [['shot'], ['heal']] });
    a.use(A1, 'channel.vigilante').end().pass(1); // let any first-tick Exposed run out
    const [b1, b2] = [a.hp(B1), a.hp(B2)];
    a.end(); // turn 3 ticks: nobody has acted
    expect([a.hp(B1), a.hp(B2)]).toEqual([b1, b2]);
    a.use(B1, 'shot', A2).use(B2, 'heal', B2).end();
    const b2healed = a.hp(B2);
    a.end(); // turn 5 ticks
    expect([a.hp(B1), a.has(B1, 'exposed')]).toEqual([b1 - 10, true]);
    expect([a.hp(B2), a.has(B2, 'exposed')]).toEqual([b2healed, false]);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false); // 1 turn
  });

  it("Night Patrol: it ends after 3 of the user's turns", () => {
    const a = arena({ p0: [['channel.vigilante'], ['shot']], p1: [['shot']] });
    a.use(A1, 'channel.vigilante').end().pass(4); // ticks on turns 1, 3, 5
    const b1 = a.hp(B1);
    a.use(B1, 'shot', A2).end().end(); // turn 7
    expect(a.hp(B1)).toBe(b1);
  });

  it("Quiet Verdict: Invisible; 10 damage at the end of the user's next turn", () => {
    const a = arena({ p0: [['stab.vigilante']], p1: [['shot']] });
    a.use(A1, 'stab.vigilante', B1).end();
    expect(sees(a, 1, B1, A1)).toBe(false);
    a.pass(1);
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it("Quiet Verdict: 25 if they're at or below 60 HP when it lands (checked then, not when used)", () => {
    const a = arena({ p0: [['stab.vigilante']], p1: [['shot']] });
    a.use(A1, 'stab.vigilante', B1).end().pass(1);
    a.setHp(B1, 60).end(); // B1 dropped to 60 meanwhile
    expect(a.hp(B1)).toBe(35);
    const b = arena({ p0: [['stab.vigilante']], p1: [['shot']] });
    b.setHp(B1, 50).use(A1, 'stab.vigilante', B1).end().pass(1);
    b.setHp(B1, 70).end(); // healed above 60 by then
    expect(b.hp(B1)).toBe(60);
  });

  it('Take Down: 25 Piercing', () => {
    const a = arena({ p0: [['ravage.vigilante']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'ravage.vigilante', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun')]).toEqual([75, false]);
  });

  it('Take Down: an Exposed target loses Exposed and is Stunned for 1 turn', () => {
    const a = arena({ p0: [['ravage.vigilante']], p1: [['shot']] });
    a.give(B1, 'exposed', { source: A1 }).use(A1, 'ravage.vigilante', B1).end();
    expect([a.has(B1, 'exposed'), a.has(B1, 'stun')]).toEqual([false, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Setup: Invisible; the target\'s Harmful skill is countered and they\'re Condemned', () => {
    const a = arena({ p0: [['mislead.vigilante']], p1: [['shot']] });
    a.use(A1, 'mislead.vigilante', B1).end();
    expect(sees(a, 1, B1, A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'condemned')]).toEqual([100, true]);
  });

  it('Setup: then, an ally of theirs who gives them a Buff is Exposed for 2 turns', () => {
    const a = arena({ p0: [['mislead.vigilante']], p1: [['shot'], ['bless']] });
    a.use(A1, 'mislead.vigilante', B1).end();
    a.use(B1, 'shot', A1).end().pass(1);
    a.use(B2, 'bless', B1).end();
    expect(a.has(B2, 'exposed')).toBe(true);
  });

  it('Setup: no Harmful skill, no counter, no Condemn, no watch', () => {
    const a = arena({ p0: [['mislead.vigilante']], p1: [['heal'], ['bless']] });
    a.use(A1, 'mislead.vigilante', B1).end();
    a.use(B1, 'heal', B1).use(B2, 'bless', B1).end();
    expect([a.has(B1, 'condemned'), a.has(B2, 'exposed')]).toEqual([false, false]);
  });

  it('Chokehold: 10 and Asleep for 1 turn', () => {
    const a = arena({ p0: [['stun.vigilante']], p1: [['shot']] });
    a.use(A1, 'stun.vigilante', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep'), a.has(B1, 'stun')]).toEqual([90, true, false]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it("Chokehold: an Exposed target is Stunned for 2 turns instead, which damage doesn't end", () => {
    const a = arena({ p0: [['stun.vigilante'], ['shot']], p1: [['shot']] });
    a.give(B1, 'exposed', { source: A1 }).use(A1, 'stun.vigilante', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep'), a.has(B1, 'stun')]).toEqual([65, false, true]);
    a.pass(2);
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Mask On: Stealth and 1 Swiftness', () => {
    const a = arena({ p0: [['dance.vigilante']], p1: [['shot']] });
    a.use(A1, 'dance.vigilante').end();
    expect([a.has(A1, 'stealth'), a.stacks(A1, 'swiftness')]).toEqual([true, 1]);
  });

  it('Mask On: while Stealthed, the user\'s skills deal 10 more to Exposed enemies', () => {
    const a = arena({ p0: [['dance.vigilante', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.vigilante').end().pass(1);
    a.give(B1, 'exposed', { source: A1 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
    const b = arena({ p0: [['dance.vigilante', 'shot']], p1: [['shot'], ['shot']] });
    b.use(A1, 'dance.vigilante').end().pass(1).use(A1, 'shot', B2).end();
    expect(b.hp(B2)).toBe(85); // not Exposed: no bonus
  });

  it('Mask On: once the Stealth is gone, no bonus', () => {
    const a = arena({ p0: [['dance.vigilante', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.vigilante').end().pass(1).use(A1, 'shot', B1).end().pass(1); // Stealth ends
    a.give(B1, 'exposed', { source: A1 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Witness Statement: the last enemy to damage the ally takes 10, and the ally heals 10 plus the damage dealt', () => {
    const a = arena({ p0: [['heal.vigilante'], ['shot']], p1: [['shot'], ['shot']] });
    a.pass(1).use(B2, 'shot', A2).use(B1, 'shot', A2).end(); // B1 hit A2 last
    a.setHp(A2, 50).use(A1, 'heal.vigilante', A2).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([90, 100, 70]);
  });

  it("Witness Statement: only the ally's own last attacker pays, not someone else's", () => {
    const a = arena({ p0: [['heal.vigilante'], ['shot']], p1: [['shot'], ['shot']] });
    a.pass(1).use(B1, 'shot', A2).use(B2, 'shot', A1).end(); // B2 last hit A1, not A2
    a.setHp(A2, 50).use(A1, 'heal.vigilante', A2).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([90, 100, 70]);
  });

  it('Witness Statement: if no enemy has damaged the ally, they heal 15 instead', () => {
    const a = arena({ p0: [['heal.vigilante'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.vigilante', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([65, 100]);
  });

  it('Watcher in the Dark: Invisible; the first damage taken gives 25 Shield and 2 Might, once', () => {
    const a = arena({ p0: [['bless.vigilante'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bless.vigilante', A2).end();
    expect(sees(a, 1, A2, A1)).toBe(false);
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85); // second shot absorbed
    expect([a.stacks(A2, 'might'), shieldOn(a, A2)]).toEqual([2, 10]);
  });

  it('Watcher in the Dark: the Might lasts 2 turns', () => {
    const a = arena({ p0: [['bless.vigilante'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.vigilante', A2).end().use(B1, 'shot', A2).end();
    expect(a.stacks(A2, 'might')).toBe(2);
    a.pass(3);
    expect(a.stacks(A2, 'might')).toBe(2);
    a.pass(1);
    expect(a.stacks(A2, 'might')).toBe(0);
  });

  it('Most Wanted: Exposed for 3 turns; the first ally to damage them gains Stealth', () => {
    const a = arena({ p0: [['curse.vigilante'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'curse.vigilante', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.has(A2, 'stealth'), a.has(A3, 'stealth')]).toEqual([true, false]);
    a.pass(4);
    expect(a.has(B1, 'exposed')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it('Full Sentence: 15', () => {
    const a = arena({ p0: [['smite.vigilante']], p1: [['shot']] });
    a.use(A1, 'smite.vigilante', B1).end();
    expect([a.hp(B1), a.has(B1, 'full_sentence')]).toEqual([85, true]);
  });

  it('Full Sentence: after each Harmful skill they use, each of its targets heals 10', () => {
    const a = arena({ p0: [['smite.vigilante'], ['shot'], ['shot']], p1: [['blast', 'heal']] });
    a.use(A1, 'smite.vigilante', B1).end();
    a.use(B1, 'blast').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([75, 75, 75]);
  });

  it('Full Sentence: Helpful skills owe nothing, and it lasts 2 turns', () => {
    const a = arena({ p0: [['smite.vigilante']], p1: [['shot', 'heal'], ['shot']] });
    a.use(A1, 'smite.vigilante', B1).end();
    a.setHp(B1, 50).setHp(A1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 50]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(45);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(30);
  });

  it('Dawn Vigil: all allies heal 20 and gain 10 Shield; Anointed allies spend it to cleanse all Debuffs', () => {
    const a = arena({ p0: [['prayer.vigilante'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50);
    a.give(A2, 'anointed').give(A2, 'weakness', { source: B1 }).give(A2, 'confusion', { source: B1 });
    a.give(A3, 'weakness', { source: B1 });
    a.use(A1, 'prayer.vigilante').end();
    expect([a.hp(A1), a.hp(A2), shieldOn(a, A1), shieldOn(a, A3)]).toEqual([70, 70, 10, 10]);
    expect([a.has(A2, 'anointed'), a.has(A2, 'weakness'), a.has(A2, 'confusion')]).toEqual([false, false, false]);
    expect([a.has(A3, 'weakness')]).toEqual([true]);
  });

  it('Sweep the Streets: 20, and 15 to each other Exposed enemy (25 with the Exposed bonus)', () => {
    const a = arena({ p0: [['cleave.vigilante']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'exposed', { source: A1 }).give(B3, 'exposed', { source: A1 }).use(A1, 'cleave.vigilante', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 75, 75]);
  });

  it('Sweep the Streets: with no other enemy Exposed, a random other takes 15 and is Exposed for 1 turn', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const a = arena({ p0: [['cleave.vigilante']], p1: [['shot'], ['shot'], ['shot']], seed });
      a.give(B1, 'exposed', { source: A1 }).use(A1, 'cleave.vigilante', B1).end(); // the target's own Exposed doesn't count
      expect(a.hp(B1)).toBe(70);
      const hit = [B2, B3].filter((b) => a.hp(b) === 85);
      expect(hit).toHaveLength(1);
      expect(a.has(hit[0]!, 'exposed')).toBe(true);
      expect([B2, B3].filter((b) => a.hp(b) === 100)).toHaveLength(1);
      a.pass(1);
      expect(a.has(hit[0]!, 'exposed')).toBe(false);
    }
  });

  it('Hue and Cry: all enemies, Stealthed ones included, are Exposed for 1 turn', () => {
    const a = arena({ p0: [['shout.vigilante']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'stealth').use(A1, 'shout.vigilante').end();
    expect([B1, B2, B3].map((b) => a.has(b, 'exposed'))).toEqual([true, true, true]);
    expect(a.has(B2, 'stealth')).toBe(false);
    a.pass(1);
    expect(a.has(B1, 'exposed')).toBe(false);
  });

  it('Hue and Cry: for 2 turns, the first Harmful skill each enemy uses Condemns them once it resolves', () => {
    const a = arena({ p0: [['shout.vigilante']], p1: [['shot'], ['shot', 'heal']] });
    a.use(A1, 'shout.vigilante').end();
    a.use(B1, 'shot', A1).use(B2, 'heal', B2).end();
    expect([a.has(B1, 'condemned'), condemnDebuffs(a, B1), a.has(B2, 'condemned')]).toEqual([true, 0, false]);
    a.pass(1).use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'condemned'), condemnDebuffs(a, B1)]).toEqual([false, 1]); // its next skill set it off
    expect([a.has(B2, 'condemned'), a.has(B2, 'hue_and_cry')]).toEqual([true, false]); // only the first
  });

  it('Hue and Cry: after 2 turns, no more Condemns', () => {
    const a = arena({ p0: [['shout.vigilante']], p1: [['shot']] });
    a.use(A1, 'shout.vigilante').end().pass(4).use(B1, 'shot', A1).end();
    expect([a.has(B1, 'condemned'), a.has(B1, 'hue_and_cry')]).toEqual([false, false]);
  });

  it('Reinforced Trenchcoat: 25 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.vigilante']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.vigilante').end();
    expect(shieldOn(a, A1)).toBe(25);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95);
  });

  it('Reinforced Trenchcoat: an enemy Debuff is prevented and costs 10 of the Shield', () => {
    const a = arena({ p0: [['withstand.vigilante']], p1: [['curse'], ['shot']] });
    a.use(A1, 'withstand.vigilante').end();
    a.use(B1, 'curse', A1).use(B2, 'shot', A1).end();
    expect([a.has(A1, 'confusion'), a.hp(A1)]).toEqual([false, 100]);
    expect(shieldOn(a, A1)).toBe(0);
  });

  it('Reinforced Trenchcoat: once the Shield is gone, Debuffs land', () => {
    const a = arena({ p0: [['withstand.vigilante']], p1: [['shot'], ['shot'], ['curse']] });
    a.use(A1, 'withstand.vigilante').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).use(B3, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(true);
  });

  it('Bait and Switch: Taunts the target for 2 turns', () => {
    const a = arena({ p0: [['taunt.vigilante'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.vigilante', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Bait and Switch: their first hit on the user ends the Taunt, Stealths the user and Exposes them', () => {
    const a = arena({ p0: [['taunt.vigilante'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.vigilante', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    expect([a.has(B1, 'taunt'), a.has(B1, 'exposed'), a.has(A1, 'stealth')]).toEqual([false, true, true]);
  });

  it('Nightwarden: 2 Armor for 3 turns (no Immune)', () => {
    const a = arena({ p0: [['titan.vigilante']], p1: [['shot']] });
    a.use(A1, 'titan.vigilante').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([2, false]);
    a.pass(4);
    expect(a.stacks(A1, 'armor')).toBe(2);
    a.pass(1);
    expect(a.stacks(A1, 'armor')).toBe(0);
  });

  it("Nightwarden: each enemy who damages the user is Exposed for 1 turn, and Exposed enemies can't target them", () => {
    const a = arena({ p0: [['titan.vigilante'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'titan.vigilante').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'exposed')]).toEqual([95, true]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B1, 'shot', A2).end(); // other targets are fine
    expect(a.hp(A2)).toBe(85);
    a.pass(1); // the Exposed has run out
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it("Nightwarden: an enemy Exposed by anything can't damage the user", () => {
    const a = arena({ p0: [['titan.vigilante']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.vigilante').end();
    a.give(B2, 'exposed', { source: A1 });
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('bad_target');
  });

});
