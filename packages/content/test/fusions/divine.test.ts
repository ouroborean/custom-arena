// Spec-driven scenarios for the Divine fusion (Holy + Holy): Radiant, Exalted and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.8, and the pure-fusions design doc kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2 (even turns).

import { describe, expect, it } from 'vitest';
import { parseCost, viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type A = ReturnType<typeof arena>;

const debuffCount = (a: A, id: string) => a.stacks(id, 'weakness') + a.stacks(id, 'vulnerable') + a.stacks(id, 'confusion');
/** Sanctify plus the Divine variants that count as Sanctify. */
const sanctified = (a: A, id: string) => a.has(id, 'sanctify') || a.has(id, 'spear_sanctify') || a.has(id, 'karmic_light');
const minion = (a: A, defId: string) => {
  const m = a.state.units.find((u) => u.defId === defId);
  if (!m) throw new Error(`No ${defId}`);
  return m;
};
const hiddenFromB = (a: A, bearer: string) => !viewFor(content, a.state, 1).effects.some((e) => e.bearer === bearer);

describe('Divine: cost, cooldown and tags', () => {
  // From the design doc kit table (Cost · CD).
  const kit: [string, string, number][] = [
    ['strike.divine', 'S', 0],
    ['smash.divine', 'Wr', 2],
    ['charge.divine', 'S', 2],
    ['riposte.divine', 'A', 3],
    ['rage.divine', 'S', 4],
    ['shot.divine', 'r', 0],
    ['snipe.divine', 'Arr', 2],
    ['trap.divine', 'r', 2],
    ['maneuver.divine', 'r', 2],
    ['companion.divine', 'IW', 4],
    ['bolt.divine', 'I', 1],
    ['blast.divine', 'IW', 1],
    ['consume.divine', 'r', 2],
    ['summon.divine', 'I', 1],
    ['channel.divine', 'A', 3],
    ['stab.divine', 'A', 0],
    ['ravage.divine', 'Wr', 1],
    ['mislead.divine', 'A', 2],
    ['stun.divine', 'r', 1],
    ['dance.divine', 'AA', 5],
    ['heal.divine', 'nc', 6],
    ['bless.divine', 'r', 2],
    ['curse.divine', 'A', 2],
    ['smite.divine', 'W', 1],
    ['prayer.divine', 'WW', 3],
    ['cleave.divine', 'S', 1],
    ['shout.divine', 'W', 3],
    ['withstand.divine', 'r', 3],
    ['taunt.divine', 'A', 3],
    ['titan.divine', 'Wr', 4],
  ];
  it.each(kit)('%s costs %s with cooldown %i', (id, cost, cd) => {
    const s = content.skills[id]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
  });

  it('minion skills: Burning Light and Trumpet cost W', () => {
    expect(content.skills['seraph_burning_light']!.cost).toEqual(parseCost('W'));
    expect(content.skills['harbinger_trumpet']!.cost).toEqual(parseCost('W'));
  });

  it('Radiant skills are tagged Radiant, target any unit, and are neither Harmful nor Helpful', () => {
    const radiant = ['strike.divine', 'shot.divine', 'stab.divine', 'mislead.divine', 'stun.divine', 'bless.divine', 'curse.divine', 'cleave.divine'];
    for (const id of radiant) {
      const s = content.skills[id]!;
      expect(s.tags, id).toContain('Radiant');
      expect(s.tags, id).not.toContain('Harmful');
      expect(s.tags, id).not.toContain('Helpful');
      expect(s.target, id).toBe('any');
    }
  });

  it('tags named in the descriptions: Invisible, Channeled, hidden target, Bypass', () => {
    for (const id of ['riposte.divine', 'trap.divine', 'mislead.divine']) expect(content.skills[id]!.tags, id).toContain('Invisible');
    for (const id of ['snipe.divine', 'channel.divine']) expect(content.skills[id]!.tags, id).toContain('Channeled');
    expect(content.skills['snipe.divine']!.tags).toContain('HiddenTarget');
    expect(content.skills['shout.divine']!.tags).toContain('Bypass');
  });
});

describe('Divine keywords', () => {
  it('Radiant: one skill can target an enemy (damage) or an ally (heal)', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'strike.divine', B1).end();
    expect(a.hp(B1)).toBe(80);
    const b = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 50).use(A1, 'strike.divine', A2).end();
    expect([b.hp(A2), b.hp(B1)]).toEqual([70, 100]);
  });

  it('Radiant: Harmful on an enemy, so a Mislead-type counter catches it', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['mislead']] });
    a.pass(1).use(B1, 'mislead', A1).end();
    a.use(A1, 'strike.divine', B1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Radiant: Helpful on an ally, so a Mislead-type counter does not catch it', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['mislead']] });
    a.setHp(A2, 50).pass(1).use(B1, 'mislead', A1).end();
    a.use(A1, 'strike.divine', A2).end();
    expect(a.hp(A2)).toBe(70);
  });

  it('Radiant: a Trap fires on an enemy use but not on an ally use', () => {
    const a = arena({ p0: [['shot.divine'], ['shot']], p1: [['trap']] });
    a.pass(1).use(B1, 'trap', A1).end();
    a.use(A1, 'shot.divine', A2).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1).use(A1, 'shot.divine', B1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Radiant: a Riposte-type counter on the enemy catches it', () => {
    const a = arena({ p0: [['strike.divine']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.use(A1, 'strike.divine', B1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Radiant (simplified): "can\'t use Harmful skills" does not block Radiant skills', () => {
    const a = arena({ p0: [['shout.divine'], ['shot']], p1: [['strike.divine', 'shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'shout.divine').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.use(B1, 'strike.divine', A1).end();
    expect(a.hp(A1)).toBe(80);
  });

  it('Exalted counts as Anointed (a Holy skill gets its Anointed bonus)', () => {
    const a = arena({ p0: [['strike.holy']], p1: [['shot']] });
    a.give(A1, 'exalted').use(A1, 'strike.holy', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Exalted: a Radiant skill on an enemy also gives its ally part to the ally with the least HP', () => {
    const a = arena({ p0: [['strike.divine'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 70).give(A1, 'exalted');
    a.use(A1, 'strike.divine', B1).end();
    expect([a.hp(B1), a.hp(A2), a.hp(A3)]).toEqual([80, 70, 70]);
  });

  it('Exalted: a Radiant skill on an ally also gives its enemy part to a random enemy', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(A1, 'exalted');
    a.use(A1, 'strike.divine', A2).end();
    expect(a.hp(A2)).toBe(70);
    expect([a.hp(B1), a.hp(B2)].sort()).toEqual([100, 80]);
  });

  it('Exalted: without it, a Radiant skill only affects its own side', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'strike.divine', B1).end();
    expect(a.hp(A2)).toBe(50);
    const b = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot']] });
    b.setHp(A2, 50).use(A1, 'strike.divine', A2).end();
    expect(b.hp(B1)).toBe(100);
  });

  it('Exalted: non-Radiant skills do not reach the other side', () => {
    const a = arena({ p0: [['bolt.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).give(A1, 'exalted').use(A1, 'bolt.divine', B1).end();
    expect(a.hp(A2)).toBe(50);
  });

  it('Exalted is a Buff (Miracle keeps it while removing Debuffs)', () => {
    expect(content.statuses['exalted']!.kind).toBe('Buff');
  });
});

describe('Divine skills', () => {
  it('Hand of Heaven: first use has no bonus; repeating the same side has no bonus', () => {
    const a = arena({ p0: [['strike.divine']], p1: [['shot']] });
    a.use(A1, 'strike.divine', B1).end().pass(1);
    expect([a.hp(B1), a.has(A1, 'anointed')]).toEqual([80, false]);
    a.use(A1, 'strike.divine', B1).end();
    expect([a.hp(B1), a.has(A1, 'anointed')]).toEqual([60, false]);
  });

  it('Hand of Heaven: switching sides adds 10 and Anoints the user until the end of their next turn', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'strike.divine', B1).end().pass(1); // enemy side
    a.use(A1, 'strike.divine', A2).end(); // ally side: 30 heal
    expect([a.hp(A2), a.has(A1, 'anointed')]).toEqual([80, true]);
    a.pass(1);
    expect(a.has(A1, 'anointed')).toBe(true);
    a.use(A1, 'strike.divine', B1).end(); // switching back: 30 damage
    expect(a.hp(B1)).toBe(50);
  });

  it('Hand of Heaven: the Anointed from switching ends after the user\'s next turn', () => {
    const a = arena({ p0: [['strike.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'strike.divine', B1).end().pass(1);
    a.use(A1, 'strike.divine', A2).end().pass(1); // Anointed (turn 3)
    a.pass(1); // turn 5: user's next turn ends
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it("Heaven's Hammer: 25 to the target and 15 to their allies; no healing without Exalted", () => {
    const a = arena({ p0: [['smash.divine'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'smash.divine', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), a.hp(A1), a.hp(A2)]).toEqual([75, 85, 85, 50, 50]);
  });

  it("Heaven's Hammer: if Exalted, it's spent and every ally also heals 25", () => {
    const a = arena({ p0: [['smash.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 40).give(A1, 'exalted').use(A1, 'smash.divine', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([75, 85, 75, 65]);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it("Crusader's Advance: 15 damage and 1 Focus for the user's next skill", () => {
    const a = arena({ p0: [['charge.divine', 'shot.divine']], p1: [['shot']] });
    a.use(A1, 'charge.divine', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'focus')]).toEqual([85, 1]);
    expect(a.has(A1, 'anointed')).toBe(false); // not Condemned: no Anoint
    a.pass(1).use(A1, 'shot.divine', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0);
    a.end();
    expect(a.has(A1, 'focus')).toBe(false);
  });

  it("Crusader's Advance: a Condemned target's Condemn triggers now, and the user is Anointed until the end of their next turn", () => {
    const a = arena({ p0: [['charge.divine']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 }).use(A1, 'charge.divine', B1).end();
    expect(a.has(B1, 'condemned')).toBe(false);
    expect(debuffCount(a, B1)).toBe(1);
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(2);
    expect(a.has(A1, 'anointed')).toBe(false);
  });

  it('Absolution: counters the first Harmful skill used on the user; the weakest ally heals 20 (simplified)', () => {
    const a = arena({ p0: [['riposte.divine'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 40).setHp(A3, 60).use(A1, 'riposte.divine').end();
    expect(hiddenFromB(a, A1)).toBe(true); // Invisible
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85); // only the first is countered
    expect([a.hp(A2), a.hp(A3)]).toEqual([60, 60]);
  });

  it('Absolution: ignores Helpful skills and lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.divine'], ['shot']], p1: [['shot', 'heal']] });
    a.setHp(A2, 40).use(A1, 'riposte.divine').end();
    a.pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 40]);
  });

  it('Apotheosis: Exalted for 3 turns', () => {
    const a = arena({ p0: [['rage.divine']], p1: [['shot']] });
    a.use(A1, 'rage.divine').end().pass(4);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Apotheosis: damaging an enemy heals the ally with the least HP 10', () => {
    const a = arena({ p0: [['rage.divine', 'shot'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'rage.divine').end().pass(1);
    a.setHp(A2, 50).setHp(A3, 70).use(A1, 'shot', B1).end();
    // 15 from the shot, then that heal is itself a heal the user does: 10 more (indirect, so it stops).
    expect([a.hp(B1), a.hp(A2), a.hp(A3)]).toEqual([75, 60, 70]);
  });

  it('Apotheosis: healing an ally deals 10 to a random enemy (indirect, so no loop)', () => {
    const a = arena({ p0: [['rage.divine', 'heal'], ['shot']], p1: [['shot']] });
    a.use(A1, 'rage.divine').end().pass(1);
    a.setHp(A2, 50).use(A1, 'heal', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([75, 90]);
  });

  it("Apotheosis: other allies' damage doesn't trigger it", () => {
    const a = arena({ p0: [['rage.divine'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'rage.divine').end().pass(1);
    a.setHp(A3, 50).use(A2, 'shot', B1).end();
    expect(a.hp(A3)).toBe(50);
  });

  it('Lightray (enemy): 15 damage; until the user\'s next turn, allies who damage them heal 5', () => {
    const a = arena({ p0: [['shot.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'shot.divine', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([70, 55]);
    a.pass(1).use(A2, 'shot', B1).end(); // the user's next turn: over
    expect(a.hp(A2)).toBe(55);
  });

  it('Lightray (ally): heals 15; until the user\'s next turn, enemies who damage them are Condemned', () => {
    const a = arena({ p0: [['shot.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).use(A1, 'shot.divine', A2).end();
    expect(a.hp(A2)).toBe(65);
    a.use(B1, 'shot', A2).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'condemned'), a.has(B2, 'condemned')]).toEqual([true, false]);
    a.pass(1).use(B2, 'shot', A2).end();
    expect(a.has(B2, 'condemned')).toBe(false);
  });

  it('Spear of Heaven: 45 on the following turn, target hidden, Sanctified', () => {
    const a = arena({ p0: [['snipe.divine']], p1: [['shot']] });
    a.use(A1, 'snipe.divine', B1).end();
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1)?.targets).toEqual([]);
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(55);
    expect(sanctified(a, B1)).toBe(true);
  });

  it('Spear of Heaven: each ally healed by its Sanctify heals 15 and is Anointed until the end of their next turn', () => {
    const a = arena({ p0: [['snipe.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'snipe.divine', B1).end().end();
    a.setHp(A2, 50).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2), a.has(A2, 'anointed')]).toEqual([40, 65, true]);
    a.pass(2);
    expect(a.has(A2, 'anointed')).toBe(false);
  });

  it('Spear of Heaven: stunning the user before it fires stops it (Channeled)', () => {
    const a = arena({ p0: [['snipe.divine']], p1: [['stun']] });
    a.use(A1, 'snipe.divine', B1).end();
    a.use(B1, 'stun', A1).end();
    expect([a.hp(B1), sanctified(a, B1)]).toEqual([100, false]);
  });

  it('Spear of Heaven: its Sanctify lasts 2 turns', () => {
    const a = arena({ p0: [['snipe.divine']], p1: [['shot']] });
    a.use(A1, 'snipe.divine', B1).end().end();
    a.pass(3);
    expect(sanctified(a, B1)).toBe(true);
    a.pass(2);
    expect(sanctified(a, B1)).toBe(false);
  });

  it("Sacred Tithe: the enemy's first Helpful skill lands on the user's weakest ally instead", () => {
    const a = arena({ p0: [['trap.divine'], ['shot'], ['shot']], p1: [['heal', 'prayer'], ['shot']] });
    a.setHp(A2, 50).setHp(A3, 70).setHp(B2, 50).use(A1, 'trap.divine', B1).end();
    expect(hiddenFromB(a, B1)).toBe(true); // Invisible
    a.use(B1, 'heal', B2).end();
    expect([a.hp(B2), a.hp(A2), a.hp(A3)]).toEqual([50, 75, 70]);
    a.pass(1).use(B1, 'prayer').end(); // only the first is diverted
    expect(a.hp(B2)).toBe(80);
  });

  it("Sacred Tithe: the enemy's Harmful skills are untouched", () => {
    const a = arena({ p0: [['trap.divine'], ['shot']], p1: [['shot', 'heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'trap.divine', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.pass(1).use(B1, 'heal', B2).end(); // still the first Helpful skill: diverted
    expect(a.hp(B2)).toBe(50);
  });

  it('Seclusion: Invulnerable for 1 turn; without Anointed, no Exalted', () => {
    const a = arena({ p0: [['maneuver.divine']], p1: [['shot']] });
    a.use(A1, 'maneuver.divine').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    expect(a.has(A1, 'exalted')).toBe(false);
    a.end().end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it("Seclusion: if Anointed, it's spent and the user is Exalted until the end of their next turn", () => {
    const a = arena({ p0: [['maneuver.divine']], p1: [['shot']] });
    a.give(A1, 'anointed').use(A1, 'maneuver.divine').end();
    expect([a.has(A1, 'anointed'), a.has(A1, 'exalted')]).toEqual([false, true]);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Seraph: summons a permanent 40 HP Seraph; Burning Light deals 15 and Condemns', () => {
    const a = arena({ p0: [['companion.divine']], p1: [['shot']] });
    a.use(A1, 'companion.divine').end().pass(1);
    const s = minion(a, 'seraph');
    expect([s.hp, s.owner, s.alive]).toEqual([40, 0, true]);
    a.use(s.id, 'seraph_burning_light', B1).end();
    expect([a.hp(B1), a.has(B1, 'condemned')]).toEqual([85, true]);
    a.pass(10);
    expect(a.unit(s.id).alive).toBe(true);
  });

  it("Seraph: when a Condemn it applied triggers, it Sanctifies that enemy for 1 turn", () => {
    const a = arena({ p0: [['companion.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.divine').end().pass(1);
    const s = minion(a, 'seraph');
    a.use(s.id, 'seraph_burning_light', B1).end();
    expect(sanctified(a, B1)).toBe(false);
    a.use(B1, 'shot', A1).end(); // Condemn triggers
    expect(sanctified(a, B1)).toBe(true);
    a.setHp(A2, 50).use(A2, 'shot', B1).end();
    expect(a.hp(A2)).toBe(65);
    a.pass(1);
    expect(sanctified(a, B1)).toBe(false);
  });

  it("Seraph: another source's Condemn triggering doesn't make it Sanctify", () => {
    const a = arena({ p0: [['companion.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.divine').end();
    a.give(B1, 'condemned', { source: A2 }).use(B1, 'shot', A1).end();
    expect(sanctified(a, B1)).toBe(false);
  });

  it('Revelation: 20 damage and a Mark for 1 turn', () => {
    const a = arena({ p0: [['bolt.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt.divine', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(55); // 20, then 15 + 10 from the Mark
    const b = arena({ p0: [['bolt.divine'], ['shot']], p1: [['shot']] });
    b.use(A1, 'bolt.divine', B1).end();
    expect(b.has(B1, 'mark')).toBe(true);
    b.pass(1).use(A2, 'shot', B1).end(); // expired after 1 turn
    expect(b.hp(B1)).toBe(65);
  });

  it("Revelation: every Invisible effect on both sides ends, the user's own included; visible ones stay", () => {
    const a = arena({ p0: [['bolt.divine'], ['riposte.divine'], ['shot']], p1: [['trap']] });
    a.pass(1).use(B1, 'trap', A3).end();
    a.give(B1, 'sanctify');
    a.use(A2, 'riposte.divine').use(A1, 'bolt.divine', B1).end();
    expect(a.has(A3, 'trap')).toBe(false);
    expect(a.has(A2, 'absolution')).toBe(false);
    expect(a.has(B1, 'sanctify')).toBe(true);
  });

  it('Glory: 25 Piercing to all enemies (ignores Armor)', () => {
    const a = arena({ p0: [['blast.divine']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 5 }).use(A1, 'blast.divine').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 75]);
  });

  it('Glory: Exalted for 1 turn when no enemy ends below half HP', () => {
    const a = arena({ p0: [['blast.divine']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 76).use(A1, 'blast.divine').end();
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Glory: +1 turn per enemy left below half HP', () => {
    const a = arena({ p0: [['blast.divine']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 70).use(A1, 'blast.divine').end(); // B1 at 45
    a.pass(2);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Glory: capped at 3 turns', () => {
    const a = arena({ p0: [['blast.divine']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 60).setHp(B2, 60).setHp(B3, 60).use(A1, 'blast.divine').end();
    a.pass(4);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  // SPEC: "If they're Sanctified … otherwise they're Sanctified": read as the target (as in Holy's Ascension); the
  // implementation checks and Sanctifies the user instead.
  it.fails('Ascend: 5 damage, the user heals 10, and an un-Sanctified target is Sanctified for 2 turns', () => {
    const a = arena({ p0: [['consume.divine']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.divine', B1).end();
    expect([a.hp(B1), a.hp(A1), sanctified(a, B1), a.has(A1, 'exalted')]).toEqual([95, 60, true, false]);
    a.pass(2);
    expect(sanctified(a, B1)).toBe(true);
    a.pass(2);
    expect(sanctified(a, B1)).toBe(false);
  });

  // SPEC: same question as above ("they" = the target): a Sanctified target's Sanctify isn't spent and no Exalted.
  it.fails("Ascend: a Sanctified target's Sanctify is spent and the user is Exalted for 2 turns", () => {
    const a = arena({ p0: [['consume.divine']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'sanctify').use(A1, 'consume.divine', B1).end();
    expect(a.hp(B1)).toBe(95);
    expect(a.hp(A1)).toBeGreaterThanOrEqual(60);
    expect([sanctified(a, B1), a.has(A1, 'exalted')]).toEqual([false, true]);
    a.pass(2);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Harbinger: summons a 20 HP Harbinger; while it lives, the user is Exalted; Trumpet hits all enemies for 10', () => {
    const a = arena({ p0: [['summon.divine']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.divine').end();
    const h = minion(a, 'harbinger');
    expect([h.hp, a.has(A1, 'exalted')]).toEqual([20, true]);
    a.pass(1).use(h.id, 'harbinger_trumpet').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
  });

  it('Harbinger: the user stops being Exalted when it dies', () => {
    const a = arena({ p0: [['summon.divine']], p1: [['smash']] });
    a.use(A1, 'summon.divine').end();
    const h = minion(a, 'harbinger');
    a.use(B1, 'smash', h.id).end();
    expect([a.unit(h.id).alive, a.has(A1, 'exalted')]).toEqual([false, false]);
  });

  it('Harbinger: leaves after 3 turns, taking the Exalted with it', () => {
    const a = arena({ p0: [['summon.divine']], p1: [['shot']] });
    a.use(A1, 'summon.divine').end().pass(4);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(2);
    const h = a.state.units.find((u) => u.defId === 'harbinger');
    expect(h?.alive ?? false).toBe(false);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Unending Light: hits the only un-Sanctified enemy for 10, Sanctifies them, then allies heal 5 per Sanctified enemy', () => {
    const a = arena({ p0: [['channel.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B2, 'sanctify').setHp(A1, 50).setHp(A2, 50).use(A1, 'channel.divine').end();
    expect([a.hp(B1), a.hp(B2), sanctified(a, B1)]).toEqual([90, 100, true]);
    expect([a.hp(A1), a.hp(A2)]).toEqual([60, 60]);
  });

  it('Unending Light: with every enemy Sanctified, no damage but allies still heal', () => {
    const a = arena({ p0: [['channel.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sanctify').give(B2, 'sanctify').setHp(A2, 50).use(A1, 'channel.divine').end();
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([100, 100, 60]);
  });

  it("Unending Light: its Sanctify lasts 1 turn, and it ticks for 2 of the user's turns only", () => {
    const a = arena({ p0: [['channel.divine']], p1: [['shot']] });
    a.use(A1, 'channel.divine').end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1);
    expect(sanctified(a, B1)).toBe(false);
    a.pass(1); // 2nd tick
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
  });

  it('Even Scales (enemy): 10, or 20 if they have more HP than the user', () => {
    const a = arena({ p0: [['stab.divine'], ['stab.divine']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(B2, 50);
    a.use(A1, 'stab.divine', B1).use(A2, 'stab.divine', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 40]); // 100 > 50; 50 is not more than 100
  });

  it('Even Scales (enemy): equal HP is not "more"', () => {
    const a = arena({ p0: [['stab.divine']], p1: [['shot']] });
    a.use(A1, 'stab.divine', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Even Scales (ally): heals 10, or 20 if they have less HP than the user', () => {
    const a = arena({ p0: [['stab.divine'], ['stab.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 60).setHp(A2, 70).setHp(A3, 30);
    a.use(A1, 'stab.divine', A3).use(A2, 'stab.divine', A1).end();
    // A1 (60) heals A3 (30 < 60): 20. Then A2 (70) heals A1 (60 < 70): 20.
    expect([a.hp(A3), a.hp(A1)]).toEqual([50, 80]);
    const b = arena({ p0: [['stab.divine'], ['shot']], p1: [['shot']] });
    b.setHp(A1, 50).setHp(A2, 80).use(A1, 'stab.divine', A2).end();
    expect(b.hp(A2)).toBe(90);
  });

  it('Unfailing Grace: 25 Piercing damage', () => {
    const a = arena({ p0: [['ravage.divine']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 5 }).use(A1, 'ravage.divine', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it("Unfailing Grace: until the end of the user's next turn, their skills don't spend their Anointed", () => {
    const a = arena({ p0: [['ravage.divine', 'shot.holy']], p1: [['shot']] });
    a.give(A1, 'anointed').use(A1, 'ravage.divine', B1).end().pass(1);
    a.setHp(A1, 50).use(A1, 'shot.holy', B1).end(); // Sunbeam: heal 15 with Anointed
    expect([a.hp(A1), a.has(A1, 'anointed')]).toEqual([65, true]);
    a.pass(1).use(A1, 'shot.holy', B1).end(); // protection over: spent
    expect([a.hp(A1), a.has(A1, 'anointed')]).toEqual([80, false]);
  });

  it('Divine Intervention (enemy): their Harmful skill is countered and they are Condemned; Invisible', () => {
    const a = arena({ p0: [['mislead.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.divine', B1).end();
    expect(hiddenFromB(a, B1)).toBe(true);
    a.use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'condemned')]).toEqual([100, true]);
  });

  it('Divine Intervention (enemy): Helpful skills pass, and it lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.divine'], ['shot']], p1: [['shot', 'heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'mislead.divine', B1).end();
    a.use(B1, 'heal', B2).end();
    expect([a.hp(B2), a.has(B1, 'condemned')]).toEqual([75, false]);
    a.pass(1).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Divine Intervention (ally): the first Harmful skill used on them is countered and its user Condemned', () => {
    const a = arena({ p0: [['mislead.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.divine', A2).end();
    a.use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
    expect([a.has(B1, 'condemned'), a.has(B2, 'condemned')]).toEqual([true, false]);
  });

  it('Awe (enemy): Condemned if not already', () => {
    const a = arena({ p0: [['stun.divine']], p1: [['shot']] });
    a.use(A1, 'stun.divine', B1).end();
    expect([a.has(B1, 'condemned'), a.has(B1, 'stun')]).toEqual([true, false]);
  });

  it('Awe (enemy): Stunned for 1 turn if Condemned', () => {
    const a = arena({ p0: [['stun.divine']], p1: [['shot']] });
    a.give(B1, 'condemned', { source: A1 }).use(A1, 'stun.divine', B1).end();
    expect(a.has(B1, 'stun')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.end().end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Awe (ally): loses all Stuns, and is not Condemned', () => {
    const a = arena({ p0: [['stun.divine'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stun').give(A2, 'stun_ns').give(A2, 'weakness');
    a.use(A1, 'stun.divine', A2).end();
    expect([a.has(A2, 'stun'), a.has(A2, 'stun_ns'), a.has(A2, 'condemned'), a.has(A2, 'weakness')]).toEqual([false, false, false, true]);
  });

  it('Transfiguration: Invulnerable and Immune, healing doubled, only Helpful skills', () => {
    const a = arena({ p0: [['dance.divine', 'heal', 'shot'], ['shot']], p1: [['curse', 'shot']] });
    a.use(A1, 'dance.divine').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.give(B1, 'ghosted').use(B1, 'curse', A1).end(); // Ghosted reaches them; Immune blocks the Confusion
    expect(a.has(A1, 'confusion')).toBe(false);
    expect(a.reject(() => a.use(A1, 'shot', B1))).toBeTruthy();
    a.setHp(A2, 40).use(A1, 'heal', A2).end();
    expect(a.hp(A2)).toBe(90);
  });

  it('Transfiguration: lasts 2 turns', () => {
    const a = arena({ p0: [['dance.divine', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.divine').end().pass(3);
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Miracle: target ally heals to full HP and loses all Debuffs, but keeps Buffs', () => {
    const a = arena({ p0: [['heal.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 10).give(A2, 'weakness', { stacks: 2 }).give(A2, 'vulnerable').give(A2, 'might');
    a.use(A1, 'heal.divine', A2).end();
    expect([a.hp(A2), a.has(A2, 'weakness'), a.has(A2, 'vulnerable'), a.has(A2, 'might')]).toEqual([100, false, false, true]);
  });

  it('Miracle: can target the user', () => {
    const a = arena({ p0: [['heal.divine']], p1: [['shot']] });
    a.setHp(A1, 30).use(A1, 'heal.divine', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Consecrate (ally): Exalted until the end of their next turn, and 1 Might for 3 turns', () => {
    const a = arena({ p0: [['bless.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.divine', A2).end();
    expect([a.has(A2, 'exalted'), a.stacks(A2, 'might')]).toEqual([true, 1]);
    a.pass(1);
    expect(a.has(A2, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A2, 'exalted')).toBe(false);
    a.pass(2);
    expect(a.stacks(A2, 'might')).toBe(1);
    a.pass(1);
    expect(a.stacks(A2, 'might')).toBe(0);
  });

  it('Consecrate (enemy): loses Anointed and Exalted; other enemies keep theirs', () => {
    const a = arena({ p0: [['bless.divine']], p1: [['shot'], ['shot']] });
    a.give(B1, 'anointed').give(B1, 'exalted').give(B2, 'anointed');
    a.use(A1, 'bless.divine', B1).end();
    expect([a.has(B1, 'anointed'), a.has(B1, 'exalted'), a.has(B2, 'anointed')]).toEqual([false, false, true]);
  });

  it("Consecrate (enemy): can't gain Anointed or Exalted for 2 turns", () => {
    const a = arena({ p0: [['bless.divine']], p1: [['shot'], ['bless.holy'], ['bless.holy']] });
    a.use(A1, 'bless.divine', B1).end();
    a.use(B2, 'bless.holy', B1).end(); // Holy Favor: Anoint
    expect(a.has(B1, 'anointed')).toBe(false);
    a.pass(3);
    a.use(B3, 'bless.holy', B1).end(); // turn 6: the 2 turns are over
    expect(a.has(B1, 'anointed')).toBe(true);
  });

  it('Anathema (enemy): Condemned and Sanctified for 2 turns', () => {
    const a = arena({ p0: [['curse.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'curse.divine', B1).end();
    expect([a.has(B1, 'condemned'), sanctified(a, B1)]).toEqual([true, true]);
    a.pass(2);
    expect(sanctified(a, B1)).toBe(true);
    a.pass(1);
    expect(sanctified(a, B1)).toBe(false);
  });

  // SPEC: does "Condemned and Sanctified for 2 turns" give the Condemn the 2-turn duration too? It stays after 2 turns.
  it.fails('Anathema (enemy): an unused Condemn also ends after 2 turns', () => {
    const a = arena({ p0: [['curse.divine']], p1: [['shot']] });
    a.use(A1, 'curse.divine', B1).end().pass(3);
    expect(a.has(B1, 'condemned')).toBe(false);
  });

  it('Anathema (ally): loses Condemn, Weakness, Vulnerable and Confusion, but not other Debuffs', () => {
    const a = arena({ p0: [['curse.divine'], ['shot']], p1: [['shot']] });
    a.give(A2, 'condemned').give(A2, 'weakness').give(A2, 'vulnerable').give(A2, 'confusion').give(A2, 'stun');
    a.use(A1, 'curse.divine', A2).end();
    expect(debuffCount(a, A2) + (a.has(A2, 'condemned') ? 1 : 0)).toBe(0);
    expect(a.has(A2, 'stun')).toBe(true);
    expect(sanctified(a, A2)).toBe(false);
  });

  it('Karmic Light: 15 damage and Sanctified; its healing goes to the weakest ally, not the damager', () => {
    const a = arena({ p0: [['smite.divine'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).setHp(A3, 80).use(A1, 'smite.divine', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A3), a.hp(A2)]).toEqual([70, 80, 65]);
  });

  it('Karmic Light: its Sanctify lasts 2 turns', () => {
    const a = arena({ p0: [['smite.divine']], p1: [['shot']] });
    a.use(A1, 'smite.divine', B1).end().pass(2);
    expect(sanctified(a, B1)).toBe(true);
    a.pass(1);
    expect(sanctified(a, B1)).toBe(false);
  });

  it('Benediction: all allies heal 20 and gain 10 Shield', () => {
    const a = arena({ p0: [['prayer.divine'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 60).use(A1, 'prayer.divine').end();
    expect([a.hp(A1), a.hp(A2), a.hp(B1)]).toEqual([70, 80, 100]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(75);
  });

  it("Benediction: healing past max HP deals that much damage to a random enemy", () => {
    const a = arena({ p0: [['prayer.divine'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 90).setHp(A3, 50).use(A1, 'prayer.divine').end();
    // A1 overflows 20, A2 overflows 10, A3 none: 30 to the only enemy.
    expect([a.hp(A2), a.hp(A3), a.hp(B1)]).toEqual([100, 70, 70]);
  });

  it('Twin Radiance (enemy target): 15 to the target, and a unit on the user\'s side heals 15', () => {
    const a = arena({ p0: [['cleave.divine']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'cleave.divine', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([85, 100, 65]);
  });

  it('Twin Radiance (ally target): heals 15, and one random enemy takes 15', () => {
    const a = arena({ p0: [['cleave.divine'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).use(A1, 'cleave.divine', A2).end();
    expect(a.hp(A2)).toBe(65);
    expect([a.hp(B1), a.hp(B2)].sort()).toEqual([100, 85]);
  });

  it('Truce of God: for 1 turn no unit can use Harmful skills; Helpful skills still work', () => {
    const a = arena({ p0: [['shout.divine', 'shot'], ['shot']], p1: [['shot', 'heal'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'shout.divine').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
    a.use(B1, 'heal', B2).end();
    expect(a.hp(B2)).toBe(75);
    a.use(A2, 'shot', B1).end(); // over
    expect(a.hp(B1)).toBe(85);
  });

  it("Truce of God: Bypass, so it reaches Invulnerable units", () => {
    const a = arena({ p0: [['shout.divine']], p1: [['shot']] });
    a.give(B1, 'invulnerable').use(A1, 'shout.divine').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBeTruthy();
  });

  it('Aegis of Faith: 25 Shield and Anointed while any of it remains', () => {
    const a = arena({ p0: [['withstand.divine']], p1: [['shot'], ['shot']] });
    a.use(A1, 'withstand.divine').end();
    expect(a.has(A1, 'anointed')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'anointed')]).toEqual([100, true]);
    a.pass(1).use(B2, 'shot', A1).end(); // 10 left absorbed, 5 through
    expect([a.hp(A1), a.has(A1, 'anointed')]).toEqual([95, false]);
  });

  it('Aegis of Faith: the Shield lasts 2 turns, and the Anointed ends with it', () => {
    const a = arena({ p0: [['withstand.divine']], p1: [['shot']] });
    a.use(A1, 'withstand.divine').end().pass(2);
    expect(a.has(A1, 'anointed')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'anointed')).toBe(false);
    a.pass(1).use(B1, 'shot', A1).end(); // no Shield left
    expect(a.hp(A1)).toBe(85);
  });

  it('Beacon: Taunts the target for 2 turns', () => {
    const a = arena({ p0: [['taunt.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.divine', B1).end();
    expect(a.has(A1, 'exalted')).toBe(false);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 100]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // turn 4: still Taunted
    a.pass(2).use(B1, 'shot', A2).end(); // turn 6: over
    expect(a.hp(A2)).toBe(85);
  });

  // BUG: Beacon's "each time they damage the user, the user is Exalted" never fires (no Exalted after the hit).
  it.fails('Beacon: each time the Taunted enemy damages the user, the user is Exalted until the end of their next turn', () => {
    const a = arena({ p0: [['taunt.divine'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.divine', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it("Beacon: other enemies' damage doesn't Exalt the user", () => {
    const a = arena({ p0: [['taunt.divine']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.divine', B1).end();
    a.use(B2, 'shot', A1).end();
    expect(a.has(A1, 'exalted')).toBe(false);
  });

  it('Avatar: Exalted and 2 Armor for 3 turns', () => {
    const a = arena({ p0: [['titan.divine']], p1: [['shot']] });
    a.use(A1, 'titan.divine').end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'exalted')]).toEqual([95, true]);
    a.pass(3);
    expect(a.has(A1, 'exalted')).toBe(true);
    a.pass(1);
    expect([a.has(A1, 'exalted'), a.stacks(A1, 'armor')]).toEqual([false, 0]);
  });

  it('Avatar: condemning an enemy Anoints a random ally until the end of their next turn', () => {
    const a = arena({ p0: [['titan.divine', 'stun.divine', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'titan.divine').end().pass(1);
    a.use(A1, 'stun.divine', B1).end(); // Awe: Condemns
    expect(a.has(B1, 'condemned')).toBe(true);
    const anointed = [A1, A2].filter((u) => a.has(u, 'anointed'));
    expect(anointed).toHaveLength(1);
    a.pass(2);
    expect(a.has(anointed[0]!, 'anointed')).toBe(false);
  });

  it("Avatar: skills that don't Condemn don't Anoint anyone", () => {
    const a = arena({ p0: [['titan.divine', 'shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'titan.divine').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect([a.has(A1, 'anointed'), a.has(A2, 'anointed')]).toEqual([false, false]);
  });
});
