// Spec-driven scenarios for the Anointment fusion (Water + Holy): Unction, Chrism and all 30 variants.
// Sources: skill/status descriptions, docs/rules.md §21.32, and the design-doc kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { parseCost, viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const kindOf = (e: Arena['state']['effects'][number]) => (e.inline ? e.inline.kind : content.statuses[e.defId]?.kind);
const debuffs = (a: Arena, id: string) => a.effects(id).filter((e) => kindOf(e) === 'Debuff').length;
const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId);
const unctionOn = (a: Arena, ids: string[]) => ids.reduce((n, id) => n + a.stacks(id, 'unction'), 0);
const shieldValue = (a: Arena, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);

describe('Anointment: cost and cooldown match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike.anointment', 'S', 1],
    ['smash.anointment', 'Ar', 2],
    ['charge.anointment', 'I', 2],
    ['riposte.anointment', 'r', 3],
    ['rage.anointment', 'S', 4],
    ['shot.anointment', 'r', 0],
    ['snipe.anointment', 'Arr', 2],
    ['trap.anointment', 'A', 3],
    ['maneuver.anointment', 'I', 3],
    ['companion.anointment', 'I', 1],
    ['bolt.anointment', 'I', 1],
    ['blast.anointment', 'IA', 2],
    ['consume.anointment', 'r', 2],
    ['summon.anointment', 'I', 1],
    ['channel.anointment', 'rr', 3],
    ['stab.anointment', 'A', 0],
    ['ravage.anointment', 'Wr', 1],
    ['mislead.anointment', 'A', 2],
    ['stun.anointment', 'r', 2],
    ['dance.anointment', 'AI', 5],
    ['heal.anointment', 'W', 1],
    ['bless.anointment', 'r', 2],
    ['curse.anointment', 'A', 2],
    ['smite.anointment', 'I', 1],
    ['prayer.anointment', 'WW', 3],
    ['cleave.anointment', 'Sr', 1],
    ['shout.anointment', 'W', 3],
    ['withstand.anointment', 'r', 2],
    ['taunt.anointment', 'r', 3],
    ['titan.anointment', 'AI', 4],
    ['sacred_koi_golden_leap', 'r', 0],
    ['sacred_koi_tail_slap', 'nc', 0],
    ['baptismal_font_pour', 'nc', 0],
  ];
  it.each(table)('%s costs %s with cooldown %i', (id, cost, cd) => {
    const s = content.skills[id];
    expect(s).toBeDefined();
    expect(s!.cost).toEqual(parseCost(cost));
    expect(s!.cooldown).toBe(cd);
  });

  it('Invisible and HiddenTarget tags match the descriptions', () => {
    for (const id of ['riposte.anointment', 'trap.anointment', 'mislead.anointment'])
      expect(content.skills[id]!.tags).toContain('Invisible');
    expect(content.skills['snipe.anointment']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    expect(content.skills['channel.anointment']!.tags).toContain('Channeled');
  });

  it('Unction and Chrism are Buffs with glossary entries', () => {
    expect(content.statuses.unction!.kind).toBe('Buff');
    expect(content.statuses.chrism!.kind).toBe('Buff');
    expect(content.glossary.unction?.status).toBe('unction');
    expect(content.glossary.chrism?.status).toBe('chrism');
  });
});

describe('Anointment keywords: Unction', () => {
  it('at the end of the applier’s turn one stack removes one Debuff and heals 10', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'confusion').give(A2, 'weakness').give(A2, 'unction', { stacks: 3, source: A1 });
    a.end();
    expect([a.hp(A2), a.stacks(A2, 'unction'), debuffs(a, A2)]).toEqual([60, 2, 1]);
  });

  it('does not work at the end of the opponent’s turn', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.end(); // p0's turn ends with no Unction around
    a.setHp(A2, 50).give(A2, 'confusion').give(A2, 'unction', { stacks: 2, source: A1 });
    a.end(); // p1's turn
    expect([a.hp(A2), a.stacks(A2, 'unction'), debuffs(a, A2)]).toEqual([50, 2, 1]);
    a.end(); // the applier's turn
    expect([a.hp(A2), a.stacks(A2, 'unction'), debuffs(a, A2)]).toEqual([60, 1, 0]);
  });

  it('with no Debuffs it still heals 10 and uses up a stack', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A2, 'unction', { stacks: 2, source: A1 });
    a.end();
    expect([a.hp(A2), a.stacks(A2, 'unction')]).toEqual([60, 1]);
  });

  it('only one stack is used per turn, so stacks drain one at a time', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).give(A2, 'unction', { stacks: 2, source: A1 });
    a.end();
    expect(a.hp(A2)).toBe(50);
    a.pass(2);
    expect([a.hp(A2), a.stacks(A2, 'unction')]).toEqual([60, 0]);
    a.pass(2);
    expect(a.hp(A2)).toBe(60); // spent: no more healing
  });

  it('removes only the bearer’s Debuffs, not other allies’', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'confusion').give(A2, 'confusion').give(A2, 'unction', { source: A1 });
    a.end();
    expect([debuffs(a, A1), debuffs(a, A2)]).toEqual([1, 0]);
  });

  it('merges: several applications are one stacking instance', () => {
    const a = arena({ p0: [['heal.anointment'], ['shot']], p1: [['shot']] });
    a.give(A2, 'unction', { stacks: 2, source: A1 });
    a.give(A2, 'confusion').give(A2, 'weakness');
    a.use(A1, 'heal.anointment', A2).end();
    // 2 + (1 + 2 Debuffs) = 5, then one is used at the end of the turn
    expect(a.stacks(A2, 'unction')).toBe(4);
    expect(a.effects(A2).filter((e) => e.defId === 'unction')).toHaveLength(1);
  });
});

describe('Anointment keywords: Chrism', () => {
  it('counts as Anointed (Flood of Grace counts a Chrism bearer)', () => {
    const a = arena({ p0: [['blast.anointment'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'chrism').use(A1, 'blast.anointment').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });

  it('a Helpful skill its bearer uses on an ally Anoints that ally until the end of their next turn', () => {
    const a = arena({ p0: [['heal'], ['shot']], p1: [['shot']] });
    a.give(A1, 'chrism').use(A1, 'heal', A2).end();
    expect(a.has(A2, 'anointed')).toBe(true);
    a.end(); // opponent's turn
    expect(a.has(A2, 'anointed')).toBe(true);
    a.end(); // A2's next turn ends
    expect(a.has(A2, 'anointed')).toBe(false);
  });

  it('works with a Helpful skill on several allies at once (Sin-Eater’s Prayer)', () => {
    const a = arena({ p0: [['prayer.anointment'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'chrism').use(A1, 'prayer.anointment').end();
    expect([a.has(A2, 'anointed'), a.has(A3, 'anointed')]).toEqual([true, true]);
  });

  it('Harmful skills don’t Anoint anyone, and a Helpful skill on oneself doesn’t add a mark', () => {
    const a = arena({ p0: [['shot', 'withstand'], ['shot']], p1: [['shot']] });
    a.give(A1, 'chrism').use(A1, 'shot', B1).end();
    expect([a.has(B1, 'anointed'), a.has(A2, 'anointed')]).toEqual([false, false]);
    a.pass().use(A1, 'withstand').end();
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('without Chrism a Helpful skill Anoints no one', () => {
    const a = arena({ p0: [['heal'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal', A2).end();
    expect(a.has(A2, 'anointed')).toBe(false);
  });

  it('an ally’s Helpful skill doesn’t use the bearer’s Chrism', () => {
    const a = arena({ p0: [['shot'], ['heal'], ['shot']], p1: [['shot']] });
    a.give(A1, 'chrism').use(A2, 'heal', A3).end();
    expect(a.has(A3, 'anointed')).toBe(false);
  });
});

describe('Anointment skills', () => {
  it('Wave of Blessing: 20 damage, and every ally of the user gains 1 Might for 1 turn', () => {
    const a = arena({ p0: [['strike.anointment'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.anointment', B1).use(A2, 'shot', B2).end();
    expect(a.hp(B1)).toBe(80);
    expect(a.hp(B2)).toBe(80); // A2's Shot gets the fresh Might
    expect([a.stacks(A1, 'might'), a.stacks(A2, 'might'), a.stacks(A3, 'might')]).toEqual([1, 1, 1]);
    expect(a.stacks(B1, 'might') + a.stacks(B2, 'might')).toBe(0);
    a.end();
    expect([a.stacks(A1, 'might'), a.stacks(A2, 'might'), a.stacks(A3, 'might')]).toEqual([0, 0, 0]);
  });

  describe('Cascade of Grace', () => {
    const setup = (opts: { enemies: number; status?: 'anointed' | 'chrism' }) => {
      const p1 = Array.from({ length: opts.enemies }, () => ['shot']);
      const a = arena({ p0: [['smash.anointment', 'taunt']], p1 });
      a.use(A1, 'taunt', B1).end().pass(1); // taunt: remaining 3 at the start of turn 3
      if (opts.status) a.give(A1, opts.status);
      a.use(A1, 'smash.anointment', B1).end();
      return a;
    };

    it('25 damage to the target and 10 to their allies', () => {
      const a = arena({ p0: [['smash.anointment']], p1: [['shot'], ['shot'], ['shot']] });
      a.use(A1, 'smash.anointment', B1).end();
      expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 90, 90]);
    });

    it('un-Anointed: other cooldowns are untouched', () => {
      const a = setup({ enemies: 3 });
      expect(a.cooldown(A1, 'taunt')).toBe(2);
    });

    it('Anointed with 2+ enemies hit: spends it and cuts other cooldowns by 2', () => {
      const a = setup({ enemies: 3, status: 'anointed' });
      expect(a.cooldown(A1, 'taunt')).toBe(0);
      expect(a.has(A1, 'anointed')).toBe(false);
      expect(a.cooldown(A1, 'smash.anointment')).toBe(2); // its own cooldown is not cut
    });

    it('Anointed with only 1 enemy hit: cuts by 1', () => {
      const a = setup({ enemies: 1, status: 'anointed' });
      expect(a.cooldown(A1, 'taunt')).toBe(1);
    });

    it('Chrism counts as Anointed and is spent', () => {
      const a = setup({ enemies: 2, status: 'chrism' });
      expect(a.cooldown(A1, 'taunt')).toBe(0);
      expect(a.has(A1, 'chrism')).toBe(false);
    });
  });

  describe("Pilgrim's Rush", () => {
    it('15 damage, and the user has Chrism until the end of their next turn', () => {
      const a = arena({ p0: [['charge.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'charge.anointment', B1).end();
      expect(a.hp(B1)).toBe(85);
      expect(a.has(A1, 'chrism')).toBe(true);
      a.end();
      expect(a.has(A1, 'chrism')).toBe(true);
      a.end();
      expect(a.has(A1, 'chrism')).toBe(false);
    });

    it('its Chrism counts as Anointed for allies acting after it the same turn', () => {
      const a = arena({ p0: [['charge.anointment'], ['blast.anointment']], p1: [['shot']] });
      a.use(A1, 'charge.anointment', B1).use(A2, 'blast.anointment').end();
      expect(a.hp(B1)).toBe(100 - 15 - 30);
    });

    it('an ally Anointed through it (on the user’s next turn) also gets 1 Focus', () => {
      const a = arena({ p0: [['charge.anointment', 'heal'], ['shot']], p1: [['shot']] });
      a.use(A1, 'charge.anointment', B1).end().pass(1);
      a.use(A1, 'heal', A2).end();
      expect([a.has(A2, 'anointed'), a.stacks(A2, 'focus')]).toEqual([true, 1]);
    });
  });

  describe('Calm Waters', () => {
    it('is Invisible: the opponent can’t see the counter', () => {
      const a = arena({ p0: [['riposte.anointment']], p1: [['shot']] });
      a.use(A1, 'riposte.anointment').end();
      expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    });

    it('counters a Harmful skill on the user, who gains Flow for 2 turns', () => {
      const a = arena({ p0: [['riposte.anointment']], p1: [['shot']] });
      a.use(A1, 'riposte.anointment').end();
      a.use(B1, 'shot', A1).end();
      expect(a.hp(A1)).toBe(100);
      expect(a.has(A1, 'flow')).toBe(true);
      a.pass(3);
      expect(a.has(A1, 'flow')).toBe(true);
      a.pass(2);
      expect(a.has(A1, 'flow')).toBe(false);
    });

    it('protects an Anointed ally, and only the protected one gains Flow', () => {
      const a = arena({ p0: [['riposte.anointment'], ['shot']], p1: [['shot']] });
      a.give(A2, 'anointed').use(A1, 'riposte.anointment').end();
      a.use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(100);
      expect([a.has(A2, 'flow'), a.has(A1, 'flow')]).toEqual([true, false]);
    });

    it('a Chrism bearer counts as Anointed', () => {
      const a = arena({ p0: [['riposte.anointment'], ['shot']], p1: [['shot']] });
      a.give(A2, 'chrism').use(A1, 'riposte.anointment').end();
      a.use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(100);
    });

    it('doesn’t protect an un-Anointed ally', () => {
      const a = arena({ p0: [['riposte.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'riposte.anointment').end();
      a.use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(85);
    });

    it('counters only the first Harmful skill (across the user and Anointed allies)', () => {
      const a = arena({ p0: [['riposte.anointment'], ['shot']], p1: [['shot'], ['shot']] });
      a.give(A2, 'anointed').use(A1, 'riposte.anointment').end();
      a.use(B1, 'shot', A2).use(B2, 'shot', A1).end();
      expect([a.hp(A2), a.hp(A1)]).toEqual([100, 85]);
    });

    it('ignores Helpful skills and expires after 1 turn', () => {
      const a = arena({ p0: [['riposte.anointment']], p1: [['heal'], ['shot']] });
      a.use(A1, 'riposte.anointment').end();
      a.use(B1, 'heal', B1).end();
      a.pass(1);
      a.use(B2, 'shot', A1).end();
      expect(a.hp(A1)).toBe(85);
    });
  });

  describe('Chrismation', () => {
    it('the user gains Chrism for 3 turns', () => {
      const a = arena({ p0: [['rage.anointment']], p1: [['shot']] });
      a.use(A1, 'rage.anointment').end();
      expect(a.has(A1, 'chrism')).toBe(true);
      a.pass(4); // through the opponent's 3rd turn... minus the last one
      expect(a.has(A1, 'chrism')).toBe(true);
      a.pass(1); // end of the opponent's 3rd turn
      expect(a.has(A1, 'chrism')).toBe(false);
    });

    it('1 Might per ally Anointed with it, and the Might ends with it', () => {
      const a = arena({ p0: [['rage.anointment', 'heal', 'bless'], ['shot'], ['shot']], p1: [['shot']] });
      a.use(A1, 'rage.anointment').end().pass(1);
      expect(a.stacks(A1, 'might')).toBe(0);
      a.use(A1, 'heal', A2).end().pass(1);
      expect(a.stacks(A1, 'might')).toBe(1);
      a.use(A1, 'bless', A3).end();
      expect(a.stacks(A1, 'might')).toBe(2);
      a.end(); // Chrismation's 3 turns are over
      expect([a.has(A1, 'chrism'), a.stacks(A1, 'might')]).toEqual([false, 0]);
    });

    it('caps at 3 Might (4 allies Anointed at once by a Prayer)', () => {
      const a = arena({
        p0: [['rage.anointment', 'prayer.anointment'], ['companion.anointment'], ['summon.anointment']],
        p1: [['shot']],
      });
      a.use(A1, 'rage.anointment').use(A2, 'companion.anointment').use(A3, 'summon.anointment').end().pass(1);
      a.use(A1, 'prayer.anointment').end(); // A2, A3, the Koi and the Font
      const helped = [A2, A3, minions(a, 'sacred_koi')[0]!.id, minions(a, 'baptismal_font')[0]!.id];
      expect(helped.every((id) => a.has(id, 'anointed'))).toBe(true);
      expect(a.stacks(A1, 'might')).toBe(3);
    });

    it('helping only oneself gives no Might', () => {
      const a = arena({ p0: [['rage.anointment', 'withstand'], ['shot']], p1: [['shot']] });
      a.use(A1, 'rage.anointment').end().pass(1);
      a.use(A1, 'withstand').end();
      expect(a.stacks(A1, 'might')).toBe(0);
    });
  });

  describe('Holy Sprinkle', () => {
    it('without Unction: 15 damage and the user gains 1 Unction', () => {
      const a = arena({ p0: [['shot.anointment']], p1: [['shot']] });
      a.setHp(A1, 50).use(A1, 'shot.anointment', B1).end();
      expect(a.hp(B1)).toBe(85);
      expect(a.has(B1, 'condemned')).toBe(false);
      // The gained stack is the user's own, so it may already have been used at the end of the turn.
      expect(a.stacks(A1, 'unction') + (a.hp(A1) - 50) / 10).toBe(1);
    });

    it('with Unction: flings 1 stack for 10 more damage and Condemns the target', () => {
      const a = arena({ p0: [['shot.anointment']], p1: [['shot']] });
      a.give(A1, 'unction', { stacks: 3, source: A1 }).use(A1, 'shot.anointment', B1).end();
      expect(a.hp(B1)).toBe(75);
      expect(a.has(B1, 'condemned')).toBe(true);
      expect(a.stacks(A1, 'unction')).toBe(1); // 1 flung, 1 used at the end of the turn
    });
  });

  describe('Lance of the Font', () => {
    it('hits on the following turn for 30, +10 per Debuff, and washes those Debuffs away', () => {
      const a = arena({ p0: [['snipe.anointment']], p1: [['shot']] });
      a.give(B1, 'confusion').give(B1, 'intimidated');
      a.use(A1, 'snipe.anointment', B1).end();
      expect(a.hp(B1)).toBe(100);
      a.end();
      expect(a.hp(B1)).toBe(50);
      expect(debuffs(a, B1)).toBe(0);
    });

    it('with no Debuffs it deals 30', () => {
      const a = arena({ p0: [['snipe.anointment']], p1: [['shot']] });
      a.use(A1, 'snipe.anointment', B1).pass(2);
      expect(a.hp(B1)).toBe(70);
    });

    it('is interrupted by a Stun before it lands', () => {
      const a = arena({ p0: [['snipe.anointment']], p1: [['stun']] });
      a.use(A1, 'snipe.anointment', B1).end();
      a.use(B1, 'stun', A1).end();
      expect(a.hp(B1)).toBe(100);
    });
  });

  describe('Font Ward', () => {
    it('when the target gives an ally a Debuff, they take 15 and that ally gains 1 Unction', () => {
      const a = arena({ p0: [['trap.anointment'], ['shot']], p1: [['curse']] });
      a.use(A1, 'trap.anointment', B1).end();
      expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false); // Invisible
      a.use(B1, 'curse', A2).end();
      expect(a.hp(B1)).toBe(85);
      expect(a.stacks(A2, 'unction')).toBe(1);
      expect(a.stacks(A2, 'confusion')).toBe(1);
    });

    it('fires every time while it lasts (not once), and stops after 3 turns', () => {
      const a = arena({ p0: [['trap.anointment'], ['shot']], p1: [['curse', 'stun']] });
      a.use(A1, 'trap.anointment', B1).end();
      a.use(B1, 'curse', A2).end().pass(1);
      a.use(B1, 'stun', A2).end();
      expect(a.hp(B1)).toBe(70);
      a.pass(3);
      a.use(B1, 'curse', A2).end(); // turn 8: the ward has expired
      expect(a.hp(B1)).toBe(70);
    });

    it('doesn’t fire on Harmful skills that give no Debuff, nor for other enemies', () => {
      const a = arena({ p0: [['trap.anointment'], ['shot']], p1: [['shot'], ['curse']] });
      a.use(A1, 'trap.anointment', B1).end();
      a.use(B1, 'shot', A2).use(B2, 'curse', A2).end();
      expect([a.hp(B1), a.hp(B2), a.stacks(A2, 'unction')]).toEqual([100, 100, 0]);
    });
  });

  describe('Immersion', () => {
    it('the user is Invulnerable for 1 turn', () => {
      const a = arena({ p0: [['maneuver.anointment']], p1: [['shot']] });
      a.use(A1, 'maneuver.anointment').end();
      expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
      a.pass(2);
      a.use(B1, 'shot', A1).end();
      expect(a.hp(A1)).toBe(85);
    });

    it('every enemy who uses a Harmful skill during it is Condemned; Helpful users are not', () => {
      const a = arena({ p0: [['maneuver.anointment'], ['shot']], p1: [['shot'], ['heal'], ['shot']] });
      a.use(A1, 'maneuver.anointment').end();
      a.use(B1, 'shot', A2).use(B2, 'heal', B2).end();
      expect([a.has(B1, 'condemned'), a.has(B2, 'condemned'), a.has(B3, 'condemned')]).toEqual([true, false, false]);
    });

    it('after it ends, Harmful skills no longer Condemn', () => {
      const a = arena({ p0: [['maneuver.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'maneuver.anointment').end().pass(2);
      a.use(B1, 'shot', A2).end();
      expect(a.has(B1, 'condemned')).toBe(false);
    });
  });

  describe('Sacred Koi', () => {
    const koiArena = () => {
      const a = arena({ p0: [['companion.anointment'], ['shot'], ['shot']], p1: [['shot']] });
      a.use(A1, 'companion.anointment').end().pass(1);
      const koi = minions(a, 'sacred_koi')[0]!;
      return { a, koi: koi.id };
    };

    it('summons a 35 HP Sacred Koi permanently', () => {
      const { a, koi } = koiArena();
      expect(a.unit(koi).hp).toBe(35);
      expect(a.unit(koi).owner).toBe(0);
      a.pass(12);
      expect(a.unit(koi).alive).toBe(true);
    });

    it('Golden Leap: an un-Anointed ally is Anointed until the end of their next turn', () => {
      const { a, koi } = koiArena();
      a.use(koi, 'sacred_koi_golden_leap', A2).end();
      expect([a.has(A2, 'anointed'), a.has(A2, 'chrism')]).toEqual([true, false]);
      a.end();
      expect(a.has(A2, 'anointed')).toBe(true);
      a.end();
      expect(a.has(A2, 'anointed')).toBe(false);
    });

    it('Golden Leap: an already Anointed ally gains Chrism for as long instead', () => {
      const { a, koi } = koiArena();
      a.give(A2, 'anointed').use(koi, 'sacred_koi_golden_leap', A2).end();
      expect(a.has(A2, 'chrism')).toBe(true);
      a.pass(2);
      expect(a.has(A2, 'chrism')).toBe(false);
    });

    it('Tail Slap: 10 damage', () => {
      const { a, koi } = koiArena();
      a.use(koi, 'sacred_koi_tail_slap', B1).end();
      expect(a.hp(B1)).toBe(90);
    });
  });

  describe('Vial of Holy Water', () => {
    it('20 damage and the target is Sanctified for 1 turn', () => {
      const a = arena({ p0: [['bolt.anointment']], p1: [['shot']] });
      a.use(A1, 'bolt.anointment', B1).end();
      expect([a.hp(B1), a.has(B1, 'sanctify')]).toEqual([80, true]);
      a.end();
      expect(a.has(B1, 'sanctify')).toBe(false);
    });

    it('if already Sanctified it bursts instead: every ally heals 15 and gains 1 Unction', () => {
      const a = arena({ p0: [['bolt.anointment'], ['shot'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 50).setHp(A3, 50).setHp(B1, 50).give(B1, 'sanctify', { source: A1 });
      a.use(A1, 'bolt.anointment', B1).end();
      expect(a.hp(B1)).toBe(30);
      expect(a.has(B1, 'sanctify')).toBe(false);
      // +15 from the burst, and the Unction (theirs from the user) is used at the end of the turn for +10
      for (const id of [A2, A3]) expect(a.stacks(id, 'unction') + (a.hp(id) - 65) / 10).toBe(1);
      expect(a.hp(B1)).toBe(30); // the enemy doesn't heal
    });
  });

  describe('Flood of Grace', () => {
    it('20 damage to all enemies with no Anointed allies', () => {
      const a = arena({ p0: [['blast.anointment'], ['shot']], p1: [['shot'], ['shot']] });
      a.use(A1, 'blast.anointment').end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
    });

    it('+10 per Anointed ally, the user included; Anointed enemies don’t count', () => {
      const a = arena({ p0: [['blast.anointment'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
      a.give(A1, 'anointed').give(A3, 'anointed').give(B2, 'anointed');
      a.use(A1, 'blast.anointment').end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([60, 60]);
    });
  });

  it('Communion: 10 damage; the user and every Anointed ally heal for the damage dealt', () => {
    const a = arena({ p0: [['consume.anointment'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    for (const id of [A1, A2, A3, B2]) a.setHp(id, 50);
    a.give(A2, 'anointed').give(B2, 'anointed');
    a.use(A1, 'consume.anointment', B1).end();
    expect([a.hp(B1), a.hp(A1), a.hp(A2), a.hp(A3), a.hp(B2)]).toEqual([90, 60, 60, 50, 50]);
  });

  describe('Baptismal Font', () => {
    const fontArena = () => {
      const a = arena({ p0: [['summon.anointment', 'curse'], ['shot']], p1: [['curse'], ['shot'], ['curse']] });
      a.use(A1, 'summon.anointment').end();
      return a;
    };

    it('summons a 25 HP Font that lasts 3 turns', () => {
      const a = fontArena();
      const font = minions(a, 'baptismal_font');
      expect(font).toHaveLength(1);
      expect(font[0]!.hp).toBe(25);
      a.pass(4);
      expect(minions(a, 'baptismal_font')).toHaveLength(1);
      a.pass(1); // end of the opponent's 3rd turn
      expect(minions(a, 'baptismal_font')).toHaveLength(0);
    });

    it('while it stands, no unit on either side can gain Debuffs', () => {
      const a = fontArena();
      a.use(B1, 'curse', A2).end();
      expect(a.stacks(A2, 'confusion')).toBe(0);
      a.use(A1, 'curse', B2).end();
      expect(a.stacks(B2, 'confusion')).toBe(0);
    });

    it('once it’s destroyed, Debuffs land again', () => {
      const a = fontArena();
      const font = minions(a, 'baptismal_font')[0]!.id;
      a.setHp(font, 10);
      a.use(B2, 'shot', font).use(B1, 'curse', A2).end();
      expect(a.unit(font).alive).toBe(false);
      expect(a.stacks(A2, 'confusion')).toBe(1);
    });

    it('after it expires, Debuffs land again', () => {
      const a = fontArena();
      a.pass(5);
      a.use(A1, 'curse', B2).end();
      expect(a.stacks(B2, 'confusion')).toBe(1);
    });

    it('Pour: target ally heals 10', () => {
      const a = fontArena();
      const font = minions(a, 'baptismal_font')[0]!.id;
      a.pass(1).setHp(A2, 50).use(font, 'baptismal_font_pour', A2).end();
      expect(a.hp(A2)).toBe(60);
    });
  });

  describe('Consecrated Rain', () => {
    it('5 damage to all enemies at the end of each of the user’s turns, for up to 4 turns', () => {
      const a = arena({ p0: [['channel.anointment'], ['shot']], p1: [['shot'], ['shot']] });
      a.use(A1, 'channel.anointment').end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([95, 95]);
      a.pass(6);
      expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
      a.pass(2);
      expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
    });

    it('each enemy loses a Buff per tick, and each Buff washed away gives a random ally 1 Unction', () => {
      const a = arena({ p0: [['channel.anointment'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
      for (const id of [A1, A2, A3]) a.setHp(id, 50);
      a.give(B1, 'might').give(B1, 'focus').give(B2, 'focus');
      a.use(A1, 'channel.anointment').end();
      // B1 loses 1 of its 2 Buffs, B2 its only one: 2 Unction handed out (some may already be used: +10 each)
      expect([a.stacks(B1, 'might') + a.stacks(B1, 'focus'), a.stacks(B2, 'focus')]).toEqual([1, 0]);
      const handed = (a: Arena) => unctionOn(a, [A1, A2, A3]) + [A1, A2, A3].reduce((n, id) => n + (a.hp(id) - 50) / 10, 0);
      expect(handed(a)).toBe(2);
    });

    it('is Channeled: a Stun on the user ends it', () => {
      const a = arena({ p0: [['channel.anointment']], p1: [['stun']] });
      a.use(A1, 'channel.anointment').end();
      a.use(B1, 'stun', A1).end().pass(2);
      expect(a.hp(B1)).toBe(95);
    });

    it('enemies without Buffs give no Unction', () => {
      const a = arena({ p0: [['channel.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A1, 50).setHp(A2, 50).use(A1, 'channel.anointment').end();
      expect([a.hp(A1), a.hp(A2), unctionOn(a, [A1, A2])]).toEqual([50, 50, 0]);
    });
  });

  describe('Brine Needle', () => {
    it('10 damage, or 20 at or below 60 HP', () => {
      const a = arena({ p0: [['stab.anointment'], ['stab.anointment']], p1: [['shot'], ['shot']] });
      a.setHp(B2, 60).use(A1, 'stab.anointment', B1).use(A2, 'stab.anointment', B2).end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
    });

    it('each Weakness on the target lasts 1 turn longer; other Debuffs don’t', () => {
      const run = (stab: boolean) => {
        const a = arena({ p0: [['stab.anointment', 'shot']], p1: [['shot']] });
        a.give(B1, 'weakness', { duration: 3 }).give(B1, 'weakness', { duration: 5 }).give(B1, 'vulnerable', { duration: 3 });
        a.use(A1, stab ? 'stab.anointment' : 'shot', B1).end();
        return a.effects(B1).map((e) => [e.defId, e.duration]);
      };
      expect(run(true)).toEqual([
        ['weakness', 4],
        ['weakness', 6],
        ['vulnerable', 2],
      ]);
      expect(run(false)).toEqual([
        ['weakness', 2],
        ['weakness', 4],
        ['vulnerable', 2],
      ]);
    });
  });

  describe('Scouring Current', () => {
    it('25 Piercing damage (ignores Armor)', () => {
      const a = arena({ p0: [['ravage.anointment']], p1: [['shot']] });
      a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.anointment', B1).end();
      expect(a.hp(B1)).toBe(75);
    });

    it('for 2 turns, while the user has Flow, enemies they hit are Shattered for 1 turn (from the next hit on)', () => {
      const a = arena({ p0: [['ravage.anointment', 'shot']], p1: [['shot'], ['shot']] });
      a.give(A1, 'flow').use(A1, 'ravage.anointment', B1).end();
      expect(a.has(B1, 'shattered')).toBe(false);
      a.pass(1).use(A1, 'shot', B2).end();
      expect(a.has(B2, 'shattered')).toBe(true);
      a.pass(1); // the Shatter lasts 1 turn
      expect(a.has(B2, 'shattered')).toBe(false);
    });

    it('without Flow, hits don’t Shatter', () => {
      const a = arena({ p0: [['ravage.anointment', 'shot']], p1: [['shot']] });
      a.use(A1, 'ravage.anointment', B1).end().pass(1);
      a.use(A1, 'shot', B1).end();
      expect(a.has(B1, 'shattered')).toBe(false);
    });

    it('after 2 turns, Flow hits no longer Shatter', () => {
      const a = arena({ p0: [['ravage.anointment', 'shot']], p1: [['shot']] });
      a.give(A1, 'flow').use(A1, 'ravage.anointment', B1).end().pass(3);
      a.use(A1, 'shot', B1).end();
      expect(a.has(B1, 'shattered')).toBe(false);
    });
  });

  describe('Turned to Grace', () => {
    it('is Invisible and counters the target’s Harmful skill', () => {
      const a = arena({ p0: [['mislead.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 50).use(A1, 'mislead.anointment', B1).end();
      expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
      a.use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBeGreaterThanOrEqual(50);
      expect(a.log().some((l) => l.includes('countered by'))).toBe(true);
    });

    it('the countered skill’s target heals 20 instead', () => {
      const a = arena({ p0: [['mislead.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 50).use(A1, 'mislead.anointment', B1).end();
      a.use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(70);
    });

    it('an AoE countered heals every target 20', () => {
      const a = arena({ p0: [['mislead.anointment'], ['shot']], p1: [['blast']] });
      a.setHp(A1, 50).setHp(A2, 50).use(A1, 'mislead.anointment', B1).end();
      a.use(B1, 'blast').end();
      expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
    });

    it('Helpful skills go through, and it lasts only 1 turn', () => {
      const a = arena({ p0: [['mislead.anointment'], ['shot']], p1: [['heal', 'shot']] });
      a.use(A1, 'mislead.anointment', B1).end();
      a.setHp(B1, 50).use(B1, 'heal', B1).end();
      expect(a.hp(B1)).toBe(75);
      a.pass(1).use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(85);
    });
  });

  describe('Submission', () => {
    it('Stuns the target for 1 turn', () => {
      const a = arena({ p0: [['stun.anointment']], p1: [['shot']] });
      a.use(A1, 'stun.anointment', B1).end();
      expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    });

    it('while Stunned, Anointed allies deal 10 more to them; others and other enemies are unaffected', () => {
      const a = arena({ p0: [['stun.anointment'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
      a.give(A2, 'anointed').give(A3, 'anointed');
      a.use(A1, 'stun.anointment', B1).use(A2, 'shot', B1).use(A3, 'shot', B2).end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    });

    it('an un-Anointed ally gets no bonus', () => {
      const a = arena({ p0: [['stun.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'stun.anointment', B1).use(A2, 'shot', B1).end();
      expect(a.hp(B1)).toBe(85);
    });

    it('a Chrism bearer counts as Anointed', () => {
      const a = arena({ p0: [['stun.anointment'], ['shot']], p1: [['shot']] });
      a.give(A2, 'chrism').use(A1, 'stun.anointment', B1).use(A2, 'shot', B1).end();
      expect(a.hp(B1)).toBe(75);
    });

    it('once the Stun is over, the bonus is gone', () => {
      const a = arena({ p0: [['stun.anointment'], ['shot']], p1: [['shot']] });
      a.give(A2, 'anointed').use(A1, 'stun.anointment', B1).end().pass(1);
      a.use(A2, 'shot', B1).end();
      expect(a.hp(B1)).toBe(85);
    });
  });

  describe('River of Grace', () => {
    it('for 3 turns, the user gains Chrism and 2 Swiftness', () => {
      const a = arena({ p0: [['dance.anointment']], p1: [['shot']] });
      a.use(A1, 'dance.anointment').end();
      expect([a.has(A1, 'chrism'), a.stacks(A1, 'swiftness')]).toEqual([true, 2]);
      a.pass(6);
      expect([a.has(A1, 'chrism'), a.stacks(A1, 'swiftness')]).toEqual([false, 0]);
    });

    it('allies Anointed through it also gain Chrism until the end of their next turn', () => {
      const a = arena({ p0: [['dance.anointment', 'heal'], ['shot']], p1: [['shot']] });
      a.use(A1, 'dance.anointment').end().pass(1);
      a.use(A1, 'heal', A2).end();
      expect([a.has(A2, 'anointed'), a.has(A2, 'chrism')]).toEqual([true, true]);
      a.pass(1);
      expect(a.has(A2, 'chrism')).toBe(true);
      a.pass(1);
      expect(a.has(A2, 'chrism')).toBe(false);
    });

    it('its Swiftness stops a Stun', () => {
      const a = arena({ p0: [['dance.anointment']], p1: [['stun']] });
      a.use(A1, 'dance.anointment').end();
      a.use(B1, 'stun', A1).end();
      expect([a.has(A1, 'stun'), a.stacks(A1, 'swiftness')]).toEqual([false, 1]);
    });
  });

  describe('Anointing Oil', () => {
    it('target ally heals 15 and gains 1 Unction', () => {
      const a = arena({ p0: [['heal.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 50).use(A1, 'heal.anointment', A2).end();
      expect(a.stacks(A2, 'unction') + (a.hp(A2) - 65) / 10).toBe(1);
    });

    it('+1 Unction per Debuff they have', () => {
      const a = arena({ p0: [['heal.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 50).give(A2, 'confusion').give(A2, 'weakness');
      a.use(A1, 'heal.anointment', A2).end();
      // 3 Unction; one used at the end of the turn (one Debuff removed, +10)
      expect([a.hp(A2), a.stacks(A2, 'unction'), debuffs(a, A2)]).toEqual([75, 2, 1]);
    });

    it('can target the user', () => {
      const a = arena({ p0: [['heal.anointment']], p1: [['shot']] });
      a.setHp(A1, 50).use(A1, 'heal.anointment', A1).end();
      expect(a.hp(A1)).toBeGreaterThanOrEqual(65);
    });
  });

  describe('Holy Oil', () => {
    it('for 2 turns the ally can’t gain Debuffs, and each Harmful skill on them gives 1 Unction', () => {
      const a = arena({ p0: [['bless.anointment'], ['shot']], p1: [['curse'], ['shot']] });
      a.use(A1, 'bless.anointment', A2).end();
      a.use(B1, 'curse', A2).use(B2, 'shot', A2).end();
      expect(a.stacks(A2, 'confusion')).toBe(0);
      expect(a.stacks(A2, 'unction')).toBe(2);
      expect(a.hp(A2)).toBe(85); // the damage still lands
    });

    it('Helpful skills on them give nothing, and it ends after 2 turns', () => {
      const a = arena({ p0: [['bless.anointment', 'heal'], ['shot']], p1: [['curse']] });
      a.use(A1, 'bless.anointment', A2).end().pass(1);
      a.use(A1, 'heal', A2).end();
      expect(a.stacks(A2, 'unction')).toBe(0);
      a.pass(2); // Holy Oil ended with the opponent's 2nd turn
      a.use(B1, 'curse', A2).end();
      expect(a.stacks(A2, 'confusion')).toBe(1);
    });
  });

  describe('Offertory', () => {
    const pool = (a: Arena) => { const e = a.state.players[0].energy; return e.S + e.A + e.I + e.W; };

    it('Confuses the target for 2 turns', () => {
      const a = arena({ p0: [['curse.anointment']], p1: [['shot']] });
      a.use(A1, 'curse.anointment', B1).end();
      expect(a.stacks(B1, 'confusion')).toBe(1);
      a.pass(4);
      expect(a.stacks(B1, 'confusion')).toBe(0);
    });

    it('each skill they use while Confused gives the user’s player 1 energy per Confusion', () => {
      const run = (extraConfusion: number, act: boolean) => {
        const a = arena({ p0: [['curse.anointment']], p1: [['shot']] });
        a.use(A1, 'curse.anointment', B1).end();
        if (extraConfusion) a.give(B1, 'confusion', { stacks: extraConfusion });
        if (act) a.use(B1, 'shot', A1);
        const before = pool(a);
        a.cmd(a.active, { t: 'endTurn' }); // no top-up, so p0's pool is exact
        return pool(a) - before - 1; // minus p0's 1 start-of-turn energy (one living character)
      };
      expect([run(0, true), run(1, true), run(0, false)]).toEqual([1, 2, 0]);
    });
  });

  describe('Flowing Brand', () => {
    it('20 damage; un-Anointed, nothing flows', () => {
      const a = arena({ p0: [['smite.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 30).use(A1, 'smite.anointment', B1).end();
      expect([a.hp(B1), a.has(A2, 'chrism')]).toEqual([80, false]);
    });

    it('Anointed: it leaves the user, and the ally with the least HP gains Chrism until the end of their next turn', () => {
      const a = arena({ p0: [['smite.anointment'], ['shot'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 70).setHp(A3, 40).give(A1, 'anointed');
      a.use(A1, 'smite.anointment', B1).end();
      expect([a.has(A1, 'anointed'), a.has(A3, 'chrism'), a.has(A2, 'chrism')]).toEqual([false, true, false]);
      a.end();
      expect(a.has(A3, 'chrism')).toBe(true);
      a.end();
      expect(a.has(A3, 'chrism')).toBe(false);
    });

    it('a Chrism user counts as Anointed and its Chrism flows away', () => {
      const a = arena({ p0: [['smite.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A2, 40).give(A1, 'chrism');
      a.use(A1, 'smite.anointment', B1).end();
      expect([a.has(A1, 'chrism'), a.has(A2, 'chrism')]).toEqual([false, true]);
    });
  });

  describe("Sin-Eater's Prayer", () => {
    it('all allies heal 20, and every ally’s Debuffs move onto the user (enemies untouched)', () => {
      const a = arena({ p0: [['prayer.anointment'], ['shot'], ['shot']], p1: [['shot']] });
      for (const id of [A1, A2, A3]) a.setHp(id, 50);
      a.give(A2, 'confusion').give(A3, 'intimidated').give(B1, 'weakness');
      a.use(A1, 'prayer.anointment').end();
      expect([a.hp(A2), a.hp(A3)]).toEqual([70, 70]);
      expect([debuffs(a, A2), debuffs(a, A3)]).toEqual([0, 0]);
      expect(a.stacks(B1, 'weakness')).toBe(1);
      expect(a.log().some((l) => l.includes('A1 gains Intimidated'))).toBe(true);
      expect(a.log().some((l) => l.includes('A1 gains Confusion'))).toBe(true);
    });

    it('all allies heal 20; the user takes on their Debuffs and gains 1 Unction for each', () => {
      const a = arena({ p0: [['prayer.anointment'], ['shot'], ['shot']], p1: [['shot']] });
      for (const id of [A1, A2, A3]) a.setHp(id, 50);
      a.give(A2, 'confusion').give(A2, 'intimidated').give(A3, 'vulnerable').give(B1, 'weakness');
      a.use(A1, 'prayer.anointment').end();
      expect([a.hp(A2), a.hp(A3)]).toEqual([70, 70]);
      expect([debuffs(a, A2), debuffs(a, A3)]).toEqual([0, 0]);
      // 3 Debuffs moved, 3 Unction; at the end of the turn one is used (one Debuff gone, +10)
      expect([a.hp(A1), a.stacks(A1, 'unction'), debuffs(a, A1)]).toEqual([80, 2, 2]);
      expect(a.stacks(B1, 'weakness')).toBe(1); // enemies are untouched
    });

    it('with no Debuffs around, no Unction', () => {
      const a = arena({ p0: [['prayer.anointment'], ['shot']], p1: [['shot']] });
      a.setHp(A1, 50).use(A1, 'prayer.anointment').end();
      expect([a.hp(A1), a.stacks(A1, 'unction')]).toEqual([70, 0]);
    });
  });

  describe('Sweeping Grace', () => {
    it('25 damage to the target and 15 to a random other enemy', () => {
      const a = arena({ p0: [['cleave.anointment']], p1: [['shot'], ['shot']] });
      a.use(A1, 'cleave.anointment', B1).end();
      expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    });

    it('Sanctify and Condemned on the first flow onto the second; other Debuffs stay', () => {
      const a = arena({ p0: [['cleave.anointment']], p1: [['shot'], ['shot']] });
      a.give(B1, 'sanctify', { source: A1 }).give(B1, 'condemned', { source: A1 }).give(B1, 'confusion');
      a.use(A1, 'cleave.anointment', B1).end();
      expect([a.has(B1, 'sanctify'), a.has(B1, 'condemned'), a.has(B1, 'confusion')]).toEqual([false, false, true]);
      expect([a.has(B2, 'sanctify'), a.has(B2, 'condemned'), a.has(B2, 'confusion')]).toEqual([true, true, false]);
    });
  });

  describe('General Absolution', () => {
    it('every unit on both sides loses all Debuffs, then all enemies are Intimidated for 2 turns', () => {
      const a = arena({ p0: [['shout.anointment'], ['shot']], p1: [['shot'], ['shot']] });
      a.give(A1, 'weakness').give(A2, 'confusion', { stacks: 2 }).give(B1, 'vulnerable').give(B2, 'condemned');
      a.use(A1, 'shout.anointment').end();
      expect([debuffs(a, A1), debuffs(a, A2)]).toEqual([0, 0]);
      expect([a.has(B1, 'vulnerable'), a.has(B2, 'condemned')]).toEqual([false, false]);
      expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated'), a.has(A1, 'intimidated')]).toEqual([true, true, false]);
      a.pass(4);
      expect(a.has(B1, 'intimidated')).toBe(false);
    });

    it('Buffs are kept', () => {
      const a = arena({ p0: [['shout.anointment']], p1: [['shot']] });
      a.give(B1, 'might').give(A1, 'armor');
      a.use(A1, 'shout.anointment').end();
      expect([a.stacks(B1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
    });
  });

  describe('Shield of the Font', () => {
    it('gains 2 Unction, then all Unction works at once: a Debuff removed and 15 Shield per stack, no healing', () => {
      const a = arena({ p0: [['withstand.anointment']], p1: [['shot']] });
      a.setHp(A1, 50).give(A1, 'unction', { source: A1 }).give(A1, 'confusion').give(A1, 'weakness');
      a.use(A1, 'withstand.anointment').end();
      expect(a.stacks(A1, 'unction')).toBe(0);
      expect(debuffs(a, A1)).toBe(0);
      expect(shieldValue(a, A1)).toBe(45);
      expect(a.hp(A1)).toBe(50);
    });

    it('removes only as many Debuffs as there were stacks', () => {
      const a = arena({ p0: [['withstand.anointment']], p1: [['shot']] });
      a.give(A1, 'confusion').give(A1, 'weakness').give(A1, 'intimidated');
      a.use(A1, 'withstand.anointment').end();
      expect(debuffs(a, A1)).toBe(1);
      expect(shieldValue(a, A1)).toBe(30);
    });

    it('the Shield lasts 1 turn', () => {
      const a = arena({ p0: [['withstand.anointment']], p1: [['shot']] });
      a.use(A1, 'withstand.anointment').end().pass(1);
      expect(shieldValue(a, A1)).toBe(0);
    });
  });

  describe('Call of the Font', () => {
    it('Taunts the target for 2 turns', () => {
      const a = arena({ p0: [['taunt.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'taunt.anointment', B1).end();
      expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
      a.pass(2);
      expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
      a.pass(2);
      a.use(B1, 'shot', A2).end();
      expect(a.hp(A2)).toBe(85);
    });

    it('when the Taunted enemy damages the user, the user gains Chrism', () => {
      const a = arena({ p0: [['taunt.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'taunt.anointment', B1).end();
      a.use(B1, 'shot', A1).end();
      expect(a.has(A1, 'chrism')).toBe(true);
    });

    it('that Chrism ends at the end of the user’s next turn', () => {
      const a = arena({ p0: [['taunt.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'taunt.anointment', B1).end();
      a.use(B1, 'shot', A1).end();
      a.end(); // the user's next turn
      expect(a.has(A1, 'chrism')).toBe(false);
    });

    it('after the Taunt is over, damage from them gives no Chrism', () => {
      const a = arena({ p0: [['taunt.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'taunt.anointment', B1).end().pass(4);
      a.use(B1, 'shot', A1).end();
      expect(a.has(A1, 'chrism')).toBe(false);
    });

    it('damage from another enemy gives no Chrism', () => {
      const a = arena({ p0: [['taunt.anointment'], ['shot']], p1: [['shot'], ['shot']] });
      a.use(A1, 'taunt.anointment', B1).end();
      a.use(B2, 'shot', A1).end();
      expect(a.has(A1, 'chrism')).toBe(false);
    });
  });

  describe('Living Font', () => {
    it('for 3 turns the user has 2 Armor', () => {
      const a = arena({ p0: [['titan.anointment']], p1: [['shot']] });
      a.use(A1, 'titan.anointment').end();
      expect(a.stacks(A1, 'armor')).toBe(2);
      a.use(B1, 'shot', A1).end();
      expect(a.hp(A1)).toBe(95);
    });

    it('gains 1 Unction at the start of each of their turns, and it cleanses and heals every ally', () => {
      const a = arena({ p0: [['titan.anointment'], ['shot'], ['shot']], p1: [['shot']] });
      a.use(A1, 'titan.anointment').end();
      for (const id of [A1, A2, A3]) a.setHp(id, 50);
      a.give(A2, 'confusion').give(A3, 'weakness');
      a.end(); // opponent's turn; then the user's turn starts
      expect(a.stacks(A1, 'unction')).toBe(1);
      a.end();
      expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([60, 60, 60]);
      expect([debuffs(a, A2), debuffs(a, A3)]).toEqual([0, 0]);
    });

    it('after 3 turns, no more Unction and no more Armor', () => {
      const a = arena({ p0: [['titan.anointment']], p1: [['shot']] });
      a.use(A1, 'titan.anointment').end().pass(7);
      expect([a.stacks(A1, 'armor'), a.stacks(A1, 'unction')]).toEqual([0, 0]);
    });

    it('another ally’s own Unction still heals only them', () => {
      const a = arena({ p0: [['titan.anointment'], ['shot']], p1: [['shot']] });
      a.use(A1, 'titan.anointment').end().pass(1);
      a.setHp(A1, 50).setHp(A2, 50).give(A2, 'unction', { source: A2 });
      a.cmd(a.active, { t: 'endTurn' });
      // A1's own Unction heals everyone 10; A2's Unction heals only A2 10 more
      expect([a.hp(A1), a.hp(A2)]).toEqual([60, 70]);
    });
  });
});
