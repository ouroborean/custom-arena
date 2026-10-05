// Spec-driven scenarios for the Curse fusion (Unholy + Shadow): Hexes, Lingering and all 30 variants.
// Sources: in-game descriptions, docs/rules.md §21.55, and the Holy & Unholy pairs kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { parseCost, skillAvailability, viewFor } from '@arena/engine';
import { arena, content } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

type Arena = ReturnType<typeof arena>;

const HEXES = ['hex_pain', 'hex_silence', 'hex_ruin'] as const;
const hexes = (a: Arena, id: string) => HEXES.filter((h) => a.has(id, h));
const hexDuration = (a: Arena, id: string, hex: string) => a.effects(id).find((e) => e.defId === hex)?.duration;

const minion = (a: Arena, defId: string) => a.state.units.find((u) => u.defId === defId)!;

const costOf = (a: Arena, actor: string, skill: string) =>
  skillAvailability(content, a.state, a.unit(actor).owner).find((s) => s.actor === actor && s.skill === skill)!.cost;

const sees = (a: Arena, viewer: 0 | 1, bearer: string, source?: string) =>
  viewFor(content, a.state, viewer).effects.some((e) => e.bearer === bearer && (!source || e.source === source));

const shieldOn = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => {
    const def = e.inline ?? content.statuses[e.defId];
    return n + (def && 'shield' in def && def.shield ? e.value : 0);
  }, 0);

describe('Curse: costs and cooldowns match the kit table', () => {
  const table: [string, string, number | null][] = [
    ['strike.curse', 'S', 0],
    ['smash.curse', 'SS', 3],
    ['charge.curse', 'S', 2],
    ['riposte.curse', 'A', 3],
    ['rage.curse', 'SA', 4],
    ['shot.curse', 'r', 0],
    ['snipe.curse', 'AS', 2],
    ['trap.curse', 'A', 3],
    ['maneuver.curse', 'r', 4],
    ['companion.curse', 'I', 1],
    ['bolt.curse', 'Ir', 1],
    ['blast.curse', 'Irr', 2],
    ['consume.curse', 'r', 2],
    ['summon.curse', 'S', 1],
    ['channel.curse', 'Ar', 3],
    ['stab.curse', 'r', 0],
    ['ravage.curse', 'AS', 2],
    ['mislead.curse', 'r', 3],
    ['stun.curse', 'A', 4],
    ['dance.curse', 'A', 3],
    ['heal.curse', 'r', 1],
    ['bless.curse', 'r', 2],
    ['curse.curse', 'r', 2],
    ['smite.curse', 'S', 1],
    ['prayer.curse', 'Wrr', 2],
    ['cleave.curse', 'Sr', 1],
    ['shout.curse', 'Sr', 3],
    ['withstand.curse', 'A', 2],
    ['taunt.curse', 'r', 3],
    ['titan.curse', 'SW', 4],
    // Minion skills: the kit lists costs only.
    ['cat_scratch', 'r', null],
    ['shade_whisper', 'r', null],
  ];
  it.each(table)('%s costs %s (cooldown %s)', (id, cost, cd) => {
    const s = content.skills[id]!;
    expect(s.cost).toEqual(parseCost(cost));
    if (cd !== null) expect(s.cooldown).toBe(cd);
  });

  it('every Curse variant is in the table', () => {
    const ids = Object.values(content.skills)
      .filter((s) => s.element === 'Curse')
      .map((s) => s.id)
      .sort();
    expect(ids).toEqual(table.map((t) => t[0]).sort());
  });

  it('tags: Invisible, Channeled and hidden-target skills', () => {
    for (const id of ['riposte.curse', 'trap.curse', 'mislead.curse']) expect(content.skills[id]!.tags).toContain('Invisible');
    expect(content.skills['snipe.curse']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    expect(content.skills['channel.curse']!.tags).toContain('Channeled');
  });
});

describe('Curse: Hexes', () => {
  it('the three Hexes are Debuffs (Immune blocks them)', () => {
    for (const h of HEXES) expect(content.statuses[h]!.kind).toBe('Debuff');
    const a = arena({ p0: [['curse.curse']], p1: [['shot']] });
    a.give(B1, 'immune').use(A1, 'curse.curse', B1).end();
    expect(hexes(a, B1)).toEqual([]);
  });

  it('Hex of Pain: whenever the bearer deals direct damage, they take 10 Affliction', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }).give(B1, 'shield', { value: 50 });
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 90]);
  });

  it("Hex of Pain: Helpful skills don't hurt", () => {
    const a = arena({ p0: [['shot']], p1: [['heal']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }).setHp(B1, 50).pass(1).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it("Hex of Silence: the bearer's Strategic skills cost 1 more random energy; others don't", () => {
    const a = arena({ p0: [['shot']], p1: [['curse', 'shot', 'maneuver']] });
    a.give(B1, 'hex_silence', { source: A1, duration: 10 }).pass(1);
    expect(costOf(a, B1, 'curse')).toEqual(parseCost('rr'));
    expect(costOf(a, B1, 'maneuver')).toEqual(parseCost('rr'));
    expect(costOf(a, B1, 'shot')).toEqual(parseCost('r'));
  });

  it('Hex of Ruin: whenever the bearer gains a Buff, they take 10 Affliction', () => {
    const a = arena({ p0: [['shot']], p1: [['charge']] });
    a.give(B1, 'hex_ruin', { source: A1, duration: 10 }).give(B1, 'shield', { value: 50 });
    a.pass(1).use(B1, 'charge', A1).end(); // gains Focus
    expect(a.hp(B1)).toBe(90);
  });

  it("Hex of Ruin: gaining a Debuff doesn't hurt", () => {
    const a = arena({ p0: [['curse']], p1: [['shot']] });
    a.give(B1, 'hex_ruin', { source: A1, duration: 10 }).use(A1, 'curse', B1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Lingering: when a Hexed unit dies, the Hex jumps to an ally with its remaining duration', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hex_ruin', { source: A1, duration: 8 }).setHp(B1, 10);
    a.use(A1, 'shot', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    expect(hexes(a, B2)).toEqual(['hex_ruin']);
    expect(hexDuration(a, B2, 'hex_ruin')).toBe(7); // 8, ticked once at the end of the turn
  });

  it('Lingering: a cleansed Hex jumps to an ally of the bearer', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['prayer.vigilante']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }).give(B1, 'anointed');
    a.pass(1).use(B2, 'prayer.vigilante').end(); // Anointed B1 cleanses all Debuffs
    expect(hexes(a, B1)).toEqual([]);
    expect(hexes(a, B2)).toEqual(['hex_pain']);
  });

  it("Lingering: a Hex that runs out doesn't jump", () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 2 }).pass(2);
    expect([hexes(a, B1), hexes(a, B2)]).toEqual([[], []]);
  });

  it("Lingering: other effects don't linger", () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'weakness', { source: A1, duration: 8 }).setHp(B1, 10).use(A1, 'shot', B1).end();
    expect(a.has(B2, 'weakness')).toBe(false);
  });
});

describe('Curse skills', () => {
  it('Woeblade: 20 and a random Hex for 2 turns (ruling)', () => {
    const a = arena({ p0: [['strike.curse']], p1: [['shot']] });
    a.use(A1, 'strike.curse', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect(hexes(a, B1)).toHaveLength(1);
    a.pass(2);
    expect(hexes(a, B1)).toHaveLength(1);
    a.pass(1);
    expect(hexes(a, B1)).toHaveLength(0);
  });

  it('Crushing Malediction: 35 to the target, who gains Hex of Pain for 2 turns; no one else is hit yet', () => {
    const a = arena({ p0: [['smash.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.curse', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([65, 100, 100]);
    expect(hexes(a, B1)).toEqual(['hex_pain']);
    expect([hexes(a, B2), hexes(a, B3)]).toEqual([[], []]);
    a.pass(2);
    expect(a.has(B1, 'hex_pain')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'hex_pain')).toBe(false);
  });

  it('Crushing Malediction: each time the Pain hurts the target, their allies take 10 Affliction too', () => {
    const a = arena({ p0: [['smash.curse'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.curse', B1).end();
    a.use(B1, 'shot', A2).end(); // the Pain: 10 to B1, and 10 to each ally
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([55, 90, 90]);
    a.pass(1).use(B1, 'shot', A2).end(); // and again on their second turn
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([45, 80, 80]);
  });

  it("Crushing Malediction: if they don't strike, their allies are spared; once the Pain is gone, so is the sharing", () => {
    const a = arena({ p0: [['smash.curse']], p1: [['shot'], ['heal']] });
    a.use(A1, 'smash.curse', B1).end().pass(4); // B1 deals no damage during it
    expect([a.hp(B2), a.has(B1, 'hex_pain')]).toEqual([100, false]);
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }); // a later Pain from elsewhere
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([55, 100]);
  });

  it('Crushing Malediction: a cleansed Pain ends the sharing, though the Pain itself Lingers', () => {
    const a = arena({ p0: [['smash.curse']], p1: [['shot'], ['prayer.vigilante', 'shot'], ['shot']] });
    a.use(A1, 'smash.curse', B1).end();
    a.give(B1, 'anointed').use(B2, 'prayer.vigilante').end(); // B1's Debuffs are cleansed
    const holder = [B2, B3].find((b) => a.has(b, 'hex_pain'))!;
    const other = holder === B2 ? B3 : B2;
    expect(a.has(B1, 'hex_pain')).toBe(false);
    const hp = [a.hp(B1), a.hp(holder), a.hp(other)];
    a.pass(1).use(holder, 'shot', A1).end(); // the jumped Pain hurts its new bearer only
    expect([a.hp(B1), a.hp(holder), a.hp(other)]).toEqual([hp[0], hp[1]! - 10, hp[2]]);
  });

  it('Crossed Path: 15, and the next Harmful skill gives each enemy it targets a random Hex for 2 turns', () => {
    const a = arena({ p0: [['charge.curse', 'blast']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'charge.curse', B1).end();
    expect([a.hp(B1), hexes(a, B1)]).toEqual([85, []]); // its own hit gives no Hex
    a.pass(1).use(A1, 'blast').end();
    expect([B1, B2, B3].map((b) => hexes(a, b).length)).toEqual([1, 1, 1]);
    a.pass(2);
    expect([B1, B2, B3].map((b) => hexes(a, b).length)).toEqual([1, 1, 1]);
    a.pass(1);
    expect([B1, B2, B3].map((b) => hexes(a, b).length)).toEqual([0, 0, 0]);
  });

  it('Crossed Path: only the next Harmful skill; Helpful skills don\u2019t spend it', () => {
    const a = arena({ p0: [['charge.curse', 'heal', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.curse', B1).end().pass(1).use(A1, 'heal', A1).end().pass(1);
    expect(hexes(a, B2)).toEqual([]);
    a.use(A1, 'shot', B2).end();
    expect(hexes(a, B2)).toHaveLength(1);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(hexes(a, B1)).toEqual([]); // spent
  });

  it('Hex Ward: Invisible; counters every Harmful skill from Hexed enemies', () => {
    const a = arena({ p0: [['riposte.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.curse').end();
    expect(sees(a, 1, A1)).toBe(false);
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }).give(B2, 'hex_ruin', { source: A1, duration: 10 });
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Hex Ward: only the first Harmful skill from un-Hexed enemies is countered', () => {
    const a = arena({ p0: [['riposte.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.curse').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Hex Ward: a Hexed enemy is still countered after an un-Hexed one was', () => {
    const a = arena({ p0: [['riposte.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.curse').end();
    a.give(B2, 'hex_pain', { source: A1, duration: 10 });
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Hex Ward: lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.curse']], p1: [['shot']] });
    a.use(A1, 'riposte.curse').end().pass(2).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Cursed Hunger: Lifesteal, and +5 damage per Hexed enemy', () => {
    const a = arena({ p0: [['rage.curse', 'shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'rage.curse').end().pass(1);
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }).give(B2, 'hex_ruin', { source: A1, duration: 10 });
    a.setHp(A1, 50).use(A1, 'shot', B3).end();
    expect([a.hp(B3), a.hp(A1)]).toEqual([75, 75]);
  });

  it('Cursed Hunger: with no Hexed enemy, no bonus', () => {
    const a = arena({ p0: [['rage.curse', 'shot']], p1: [['shot']] });
    a.use(A1, 'rage.curse').end().pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });

  it('Cursed Hunger: the bonus caps at 3 Hexed enemies (minions count)', () => {
    const a = arena({ p0: [['rage.curse', 'shot']], p1: [['companion'], ['shot'], ['shot']] });
    a.use(A1, 'rage.curse').end().use(B1, 'companion').end();
    const wolf = a.state.units.find((u) => u.owner === 1 && u.kind === 'minion')!;
    for (const u of [B1, B2, B3, wolf.id]) a.give(u, 'hex_silence', { source: A1, duration: 10 });
    a.use(A1, 'shot', B2).end();
    expect(a.hp(B2)).toBe(70);
  });

  it('Cursed Hunger: lasts 3 turns', () => {
    const a = arena({ p0: [['rage.curse']], p1: [['shot']] });
    a.use(A1, 'rage.curse').end().pass(4);
    expect(a.has(A1, 'lifesteal')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'lifesteal')).toBe(false);
  });

  it('Needle of Woe: 5 Piercing; each Hex on the target lasts longer', () => {
    const a = arena({ p0: [['shot.curse']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 })
      .give(B1, 'hex_pain', { source: A1, duration: 2 })
      .give(B1, 'hex_ruin', { source: A1, duration: 2 })
      .give(B2, 'hex_pain', { source: A1, duration: 2 });
    a.use(A1, 'shot.curse', B1).end().pass(1); // without the Needle they'd end with turn 2
    expect(a.hp(B1)).toBe(95);
    expect(hexes(a, B1)).toEqual(['hex_pain', 'hex_ruin']);
    expect(hexes(a, B2)).toEqual([]); // other enemies' Hexes are untouched
  });

  it('Needle of Woe: a target with no Hex gains a random Hex for 2 turns', () => {
    const a = arena({ p0: [['shot.curse']], p1: [['shot']] });
    a.use(A1, 'shot.curse', B1).end();
    expect([a.hp(B1), hexes(a, B1).length]).toEqual([95, 1]);
    a.pass(2);
    expect(hexes(a, B1).length).toBe(1);
    a.pass(1);
    expect(hexes(a, B1).length).toBe(0);
  });

  it('Doom: 40 on the following turn, target hidden', () => {
    const a = arena({ p0: [['snipe.curse']], p1: [['shot']] });
    a.use(A1, 'snipe.curse', B1).end();
    expect(viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1 && e.targets.length)).toBeUndefined();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect(a.hp(B1)).toBe(60);
  });

  it('Doom: consumes the Hexes for 15 more each', () => {
    const a = arena({ p0: [['snipe.curse']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hex_silence', { source: A1, duration: 20 }).give(B1, 'hex_ruin', { source: A1, duration: 20 });
    a.use(A1, 'snipe.curse', B1).end().end();
    expect([a.hp(B1), hexes(a, B1), hexes(a, B2)]).toEqual([30, [], []]);
  });

  it("Doom: consumed Hexes don't Linger, even when it kills", () => {
    const a = arena({ p0: [['snipe.curse']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hex_silence', { source: A1, duration: 20 }).give(B1, 'hex_ruin', { source: A1, duration: 20 });
    a.setHp(B1, 50).use(A1, 'snipe.curse', B1).end().end();
    expect(a.unit(B1).alive).toBe(false);
    expect(hexes(a, B2)).toEqual([]);
  });

  it("Cleanser's Snare: Invisible; cleansing it Stuns the target for 1 turn and gives Hex of Ruin for 3 turns", () => {
    const a = arena({ p0: [['trap.curse']], p1: [['shot'], ['prayer.vigilante']] });
    a.use(A1, 'trap.curse', B1).end();
    expect(sees(a, 1, B1, A1)).toBe(false);
    a.give(B1, 'anointed').use(B2, 'prayer.vigilante').end();
    expect([a.has(B1, 'stun'), a.has(B1, 'hex_ruin')]).toEqual([true, true]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it("Cleanser's Snare: left alone, nothing happens", () => {
    const a = arena({ p0: [['trap.curse']], p1: [['shot']] });
    a.use(A1, 'trap.curse', B1).end().pass(4);
    expect([a.has(B1, 'stun'), a.has(B1, 'hex_ruin')]).toEqual([false, false]);
  });

  it('Wretched Haven: the user is Invulnerable for 2 turns', () => {
    const a = arena({ p0: [['maneuver.curse']], p1: [['shot']] });
    a.use(A1, 'maneuver.curse').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect(a.has(A1, 'invulnerable')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Wretched Haven: but the user bears all three Hexes for 3 turns', () => {
    const a = arena({ p0: [['maneuver.curse']], p1: [['shot']] });
    a.use(A1, 'maneuver.curse').end();
    expect(hexes(a, A1)).toEqual([...HEXES]);
    expect(a.hp(A1)).toBe(100); // becoming Invulnerable isn't punished by the Ruin
    a.pass(4);
    expect(hexes(a, A1)).toEqual([...HEXES]); // still there after the Invulnerability ends
    a.pass(2);
    expect(hexes(a, A1)).toEqual([]);
  });

  it('Wretched Haven: the Hexes bite while the user hides (Pain on their hits, Silence on their Strategic skills)', () => {
    const a = arena({ p0: [['maneuver.curse', 'shot', 'curse']], p1: [['shot']] });
    a.use(A1, 'maneuver.curse').end().pass(1);
    expect(costOf(a, A1, 'curse')).toEqual(parseCost('rr'));
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([85, 90]);
  });

  it('Black Cat: a permanent 25 HP minion; Scratch is 10 Piercing', () => {
    const a = arena({ p0: [['companion.curse']], p1: [['shot']] });
    a.use(A1, 'companion.curse').end().pass(1);
    const cat = minion(a, 'black_cat');
    expect([cat.owner, cat.hp]).toEqual([0, 25]);
    a.give(B1, 'armor', { stacks: 3 }).use(cat.id, 'cat_scratch', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(12);
    expect(a.unit(cat.id).alive).toBe(true);
  });

  it('Black Cat: whoever damages it gains a random Hex for 2 turns', () => {
    const a = arena({ p0: [['companion.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.curse').end();
    const cat = minion(a, 'black_cat');
    a.use(B1, 'shot', cat.id).end();
    expect([hexes(a, B1).length, hexes(a, B2).length]).toEqual([1, 0]);
    a.pass(2);
    expect(hexes(a, B1)).toHaveLength(1);
    a.pass(2);
    expect(hexes(a, B1)).toHaveLength(0);
  });

  it('Malediction: 25 and Hex of Ruin for 2 turns; each Buff they have costs 10 Affliction', () => {
    const a = arena({ p0: [['bolt.curse']], p1: [['shot']] });
    a.give(B1, 'might').give(B1, 'swiftness').use(A1, 'bolt.curse', B1).end();
    expect([a.hp(B1), a.has(B1, 'hex_ruin')]).toEqual([55, true]);
    a.pass(3);
    expect(a.has(B1, 'hex_ruin')).toBe(false);
  });

  it('Malediction: no Buffs, just 25', () => {
    const a = arena({ p0: [['bolt.curse']], p1: [['shot']] });
    a.use(A1, 'bolt.curse', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Soul Eclipse: 25 to all enemies; each un-Hexed one gains a random Hex for 2 turns', () => {
    const a = arena({ p0: [['blast.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.curse').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([75, 75, false, false]);
    expect([hexes(a, B1).length, hexes(a, B2).length]).toEqual([1, 1]);
    a.pass(2);
    expect([hexes(a, B1).length, hexes(a, B2).length]).toEqual([1, 1]);
    a.pass(1);
    expect([hexes(a, B1).length, hexes(a, B2).length]).toEqual([0, 0]);
  });

  it('Soul Eclipse: each Hexed one is Blinded for 1 turn instead, and gains no new Hex', () => {
    const a = arena({ p0: [['blast.curse']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 10 }).use(A1, 'blast.curse').end();
    expect([a.has(B1, 'blinded'), hexes(a, B1), a.has(B2, 'blinded'), hexes(a, B2).length]).toEqual([
      true,
      ['hex_pain'],
      false,
      1,
    ]);
    a.end();
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Feed on Misery: 5, healing the user; each Hex is shortened and heals 10 more', () => {
    const a = arena({ p0: [['consume.curse']], p1: [['shot']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 2 }).give(B1, 'hex_ruin', { source: A1, duration: 2 });
    a.setHp(A1, 50).use(A1, 'consume.curse', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([95, 75]);
    expect(hexes(a, B1)).toEqual([]); // they'd have lasted through turn 2
  });

  it('Feed on Misery: no Hexes, just 5', () => {
    const a = arena({ p0: [['consume.curse']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.curse', B1).end();
    expect(a.hp(A1)).toBe(55);
  });

  it('Hex Shade: 15 HP for 3 turns; Whisper gives a random Hex for 2 turns', () => {
    const a = arena({ p0: [['summon.curse']], p1: [['shot']] });
    a.use(A1, 'summon.curse').end();
    const s = minion(a, 'hex_shade');
    expect([s.owner, s.hp]).toEqual([0, 15]);
    a.pass(1).use(s.id, 'shade_whisper', B1).end();
    expect(hexes(a, B1)).toHaveLength(1);
    a.pass(2);
    expect(a.unit(s.id).alive).toBe(true);
    a.pass(1);
    expect(a.unit(s.id).alive).toBe(false);
  });

  it('Litany of Curses: each user turn a random enemy gains a random Hex', () => {
    const a = arena({ p0: [['channel.curse']], p1: [['shot']] });
    a.use(A1, 'channel.curse').end();
    expect(hexes(a, B1)).toHaveLength(1);
    expect(a.hp(B1)).toBe(100);
  });

  it('Litany of Curses: a Hex they already have becomes 20 Affliction instead; 3 ticks', () => {
    const a = arena({ p0: [['channel.curse']], p1: [['shot']] });
    for (const h of HEXES) a.give(B1, h, { source: A1, duration: 30 });
    a.give(B1, 'shield', { value: 100 }).use(A1, 'channel.curse').end();
    expect(a.hp(B1)).toBe(80);
    a.pass(2);
    expect(a.hp(B1)).toBe(60);
    a.pass(2);
    expect(a.hp(B1)).toBe(40);
    a.pass(2);
    expect(a.hp(B1)).toBe(40);
  });

  it('Cursed Dagger: 15 damage, whatever their HP; an un-Hexed user passes nothing', () => {
    const a = arena({ p0: [['stab.curse'], ['stab.curse']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).give(B1, 'hex_ruin', { source: A1, duration: 10 }); // a Hexed target changes nothing
    a.use(A1, 'stab.curse', B1).use(A2, 'stab.curse', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 35]);
    expect([hexes(a, B1), hexes(a, B2)]).toEqual([['hex_ruin'], []]);
  });

  it("Cursed Dagger: a Hexed user's Hex passes into the wound, and the hit deals 25", () => {
    const a = arena({ p0: [['stab.curse'], ['shot']], p1: [['shot']] });
    a.give(A1, 'hex_silence', { source: B1, duration: 10 }).use(A1, 'stab.curse', B1).end();
    expect([a.hp(B1), hexes(a, A1), hexes(a, B1)]).toEqual([75, [], ['hex_silence']]);
    expect(hexDuration(a, B1, 'hex_silence')).toBe(9); // it keeps its time left (ticked once since)
    expect(hexes(a, A2)).toEqual([]); // a move isn't a cleanse: nothing Lingers
  });

  it('Cursed Dagger: only one Hex passes, chosen at random', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ seed, p0: [['stab.curse']], p1: [['shot']] });
      for (const h of HEXES) a.give(A1, h, { source: B1, duration: 10 });
      a.give(B1, 'shield', { value: 100 }).use(A1, 'stab.curse', B1).end();
      expect([hexes(a, A1).length, hexes(a, B1).length]).toEqual([2, 1]);
      seen.add(hexes(a, B1)[0]!);
    }
    expect([...seen].sort()).toEqual([...HEXES].sort());
  });

  it('Cursed Dagger: the next use after Wretched Haven pays off', () => {
    const a = arena({ p0: [['maneuver.curse', 'stab.curse']], p1: [['shot']] });
    a.use(A1, 'maneuver.curse').end().pass(1).use(A1, 'stab.curse', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect([hexes(a, A1).length, hexes(a, B1).length]).toEqual([2, 1]);
  });

  it('Rend the Wards: the target loses a random Buff, then takes 30 Piercing; no Fragments needed', () => {
    const a = arena({ p0: [['ravage.curse']], p1: [['shot']] });
    a.give(B1, 'might').give(B1, 'swiftness').give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.curse', B1).end();
    expect(['might', 'swiftness', 'armor'].filter((k) => a.has(B1, k))).toHaveLength(2);
    expect([a.hp(B1), a.has(B1, 'hex_ruin')]).toEqual([70, false]);
  });

  it('Rend the Wards: a target with no Buff gains Hex of Ruin for 2 turns instead', () => {
    const a = arena({ p0: [['ravage.curse']], p1: [['shot']] });
    a.use(A1, 'ravage.curse', B1).end();
    expect([a.hp(B1), hexes(a, B1)]).toEqual([70, ['hex_ruin']]);
    a.pass(2);
    expect(a.has(B1, 'hex_ruin')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'hex_ruin')).toBe(false);
  });

  it("Tongue-Tied: Invisible; the target's Harmful skill is countered and their Hexes last longer", () => {
    const a = arena({ p0: [['mislead.curse'], ['shot']], p1: [['shot']] });
    a.give(B1, 'hex_pain', { source: B1, duration: 3 }).use(A1, 'mislead.curse', B1).end();
    expect(sees(a, 1, B1, A1)).toBe(false);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(100);
    a.pass(1); // the Pain would have ended with turn 3
    expect(a.has(B1, 'hex_pain')).toBe(true);
  });

  it('Tongue-Tied: the user is Untargetable for 1 turn', () => {
    const a = arena({ p0: [['mislead.curse'], ['shot']], p1: [['heal', 'shot']] });
    a.use(A1, 'mislead.curse', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.has(A1, 'untargetable')).toBe(false);
  });

  it('Evil Eye: Stunned 1 turn; then the Stun passes to an enemy who hasn\'t had it, until all have', () => {
    const a = arena({ p0: [['stun.curse']], p1: [['shot'], ['shot'], ['shot']] });
    const stunned = () => [B1, B2, B3].filter((b) => a.has(b, 'stun'));
    const seen = new Set<string>();
    a.use(A1, 'stun.curse', B1).end();
    expect(stunned()).toEqual([B1]);
    for (let t = 0; t < 12; t++) {
      for (const b of stunned()) seen.add(b);
      expect(stunned().length).toBeLessThanOrEqual(1);
      a.pass(1);
    }
    expect([...seen].sort()).toEqual([B1, B2, B3]);
    expect(stunned()).toEqual([]);
  });

  it('Evil Eye: the next one in the chain really is Stunned on their turn', () => {
    const a = arena({ p0: [['stun.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.curse', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.has(B1, 'stun')).toBe(false);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
  });

  it('Envious Jig: 1 Swiftness; enemy Buffs are copied to the user and theirs last 1 turn less', () => {
    const a = arena({ p0: [['dance.curse']], p1: [['rage']] });
    a.use(A1, 'dance.curse').end();
    expect(a.stacks(A1, 'swiftness')).toBe(1);
    a.use(B1, 'rage').end();
    const control = arena({ p0: [['shot']], p1: [['rage']] });
    control.pass(1).use(B1, 'rage').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([2, true]);
    const d = (x: Arena) => x.effects(B1).find((e) => e.defId === 'might')!.duration!;
    expect(d(a)).toBe(d(control) - 2);
  });

  it('Envious Jig: lasts 3 turns', () => {
    const a = arena({ p0: [['dance.curse']], p1: [['rage']] });
    a.use(A1, 'dance.curse').end().pass(6).use(B1, 'rage').end();
    expect(a.has(A1, 'might')).toBe(false);
  });

  it('Pass the Curse: the ally heals 20; their Hexes and Debuffs move to one random enemy (ruling)', () => {
    const a = arena({ p0: [['heal.curse'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(A2, 'hex_pain', { source: B1, duration: 10 }).give(A2, 'weakness', { source: B1 });
    a.use(A1, 'heal.curse', A2).end();
    expect([a.hp(A2), a.has(A2, 'hex_pain'), a.has(A2, 'weakness')]).toEqual([70, false, false]);
    const got = [B1, B2].filter((b) => a.has(b, 'hex_pain') && a.has(b, 'weakness'));
    expect(got).toHaveLength(1);
    expect([hexes(a, A1), hexes(a, A3)]).toEqual([[], []]); // a move isn't a cleanse: no Lingering
  });

  it('Unhallowed Pact: 2 Might and Lifesteal for 3 turns, but Isolated as long', () => {
    const a = arena({ p0: [['bless.curse'], ['shot'], ['heal']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.curse', A2).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2)]).toEqual([75, 75]);
    expect(a.has(A2, 'isolated')).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(A3, 'heal', A2))).toBe('bad_target');
    a.pass(3);
    expect([a.stacks(A2, 'might'), a.has(A2, 'lifesteal'), a.has(A2, 'isolated')]).toEqual([2, true, true]);
    a.pass(1);
    expect([a.stacks(A2, 'might'), a.has(A2, 'lifesteal'), a.has(A2, 'isolated')]).toEqual([0, false, false]);
  });

  it('Bane: all three Hexes for 2 turns', () => {
    const a = arena({ p0: [['curse.curse']], p1: [['shot']] });
    a.use(A1, 'curse.curse', B1).end();
    expect(hexes(a, B1)).toEqual([...HEXES]);
    a.pass(2);
    expect(hexes(a, B1)).toHaveLength(3);
    a.pass(1);
    expect(hexes(a, B1)).toEqual([]);
  });

  it("Blind Man's Toll: 20, and the target is Blinded for 1 turn", () => {
    const a = arena({ p0: [['smite.curse']], p1: [['shot']] });
    a.use(A1, 'smite.curse', B1).end();
    expect([a.hp(B1), a.has(B1, 'blinded')]).toEqual([80, true]);
    a.end();
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it("Blind Man's Toll: each skill the target uses while Blinded drains a fragment from them for the user", () => {
    const a = arena({ p0: [['smite.curse']], p1: [['shot']] });
    a.give(B1, 'soul_fragment', { stacks: 2 }).use(A1, 'smite.curse', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(A1, 'soul_fragment'), a.stacks(B1, 'soul_fragment')]).toEqual([1, 1]);
  });

  it("Blind Man's Toll: lasts 2 turns; not Blinded, no fragment; other Blinded enemies don't pay", () => {
    const a = arena({ p0: [['smite.curse']], p1: [['shot'], ['shot']] });
    a.give(B2, 'blinded', { source: A1, duration: 10 }).use(A1, 'smite.curse', B1).end();
    a.use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
    a.pass(1).use(B1, 'shot', A1).end(); // their Blind has run out
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
    const b = arena({ p0: [['smite.curse']], p1: [['shot']] });
    b.give(B1, 'blinded', { source: A1, duration: 10 }).use(A1, 'smite.curse', B1).end().pass(2);
    b.use(B1, 'shot', A1).end(); // still Blinded on the second turn
    expect(b.stacks(A1, 'soul_fragment')).toBe(1);
    b.pass(1).use(B1, 'shot', A1).end(); // the Toll is over
    expect(b.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Vespers of Slumber: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.curse'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).setHp(A3, 95).use(A1, 'prayer.curse').end();
    expect([a.hp(A1), a.hp(A2), a.hp(A3)]).toEqual([70, 70, 100]);
  });

  it('Vespers of Slumber: the first killing hit leaves them at 1 HP and Asleep instead', () => {
    const a = arena({ p0: [['prayer.curse'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.curse').end();
    a.setHp(A2, 10).use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, a.hp(A2), a.has(A2, 'sleep')]).toEqual([true, 1, true]);
  });

  it('Vespers of Slumber: only the first; a second killing hit kills', () => {
    const a = arena({ p0: [['prayer.curse'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'prayer.curse').end();
    a.setHp(A2, 10).use(B1, 'shot', A2).use(B2, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
  });

  it('Vespers of Slumber: gone after 2 turns', () => {
    const a = arena({ p0: [['prayer.curse'], ['shot']], p1: [['shot']] });
    a.use(A1, 'prayer.curse').end().pass(4);
    a.setHp(A2, 10).use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
  });

  it("Grudging Cut: 20 damage to the target; the other enemy with the most HP takes Affliction equal to half the HP they have over the target (Shield doesn't stop it)", () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B2, 70).give(B3, 'shield', { value: 50 }).use(A1, 'cleave.curse', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 70, 90]); // B3: (100 - 80) / 2
    const b = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot'], ['shot']] });
    b.setHp(B1, 60).setHp(B2, 75).setHp(B3, 70).use(A1, 'cleave.curse', B1).end();
    expect([b.hp(B1), b.hp(B2), b.hp(B3)]).toEqual([40, 58, 70]); // B2: (75 - 40) / 2, rounded down
  });

  it('Grudging Cut: only one enemy takes it, even when two have the most HP', () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.curse', B1).end();
    expect([a.hp(B2), a.hp(B3)].sort((x, y) => x - y)).toEqual([90, 100]);
  });

  it('Grudging Cut: at least 5, at most 25', () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B2, 60).setHp(B3, 50).use(A1, 'cleave.curse', B1).end(); // they have less than the target
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 55, 50]);
    const b = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot']] });
    b.setHp(B1, 30).use(A1, 'cleave.curse', B1).end(); // (100 - 10) / 2 = 45
    expect([b.hp(B1), b.hp(B2)]).toEqual([10, 75]);
    const c = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot']] });
    c.setHp(B1, 15).use(A1, 'cleave.curse', B1).end(); // a slain target has nothing left
    expect([c.unit(B1).alive, c.hp(B2)]).toEqual([false, 75]);
  });

  it('Grudging Cut: with no other enemy, only the target is hit', () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot']] });
    a.use(A1, 'cleave.curse', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 100]);
  });

  it('Ill Wind: all enemies gain Hex of Silence for 2 turns, and no one is Intimidated yet', () => {
    const a = arena({ p0: [['shout.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.curse').end();
    expect([hexes(a, B1), hexes(a, B2)]).toEqual([['hex_silence'], ['hex_silence']]);
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([false, false]);
    a.pass(2);
    expect(a.has(B1, 'hex_silence')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'hex_silence')).toBe(false);
  });

  it('Ill Wind: the first Strategic skill each one uses leaves them Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.curse']], p1: [['curse', 'shot'], ['shot']] });
    a.use(A1, 'shout.curse').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // non-Strategic skills don't count
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([false, false]);
    a.pass(1).use(B1, 'curse', A1).end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, false]);
    a.pass(3);
    expect(a.has(B1, 'intimidated')).toBe(true); // through their next 2 turns
    a.pass(1);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it("Ill Wind: the Strategic skill that sets it off isn't slowed itself (ruling)", () => {
    const a = arena({ p0: [['shout.curse']], p1: [['curse']] });
    a.use(A1, 'shout.curse').end().use(B1, 'curse', A1).end();
    const b = arena({ p0: [['shot']], p1: [['curse']] });
    b.pass(1).use(B1, 'curse', A1).end();
    expect(a.cooldown(B1, 'curse')).toBe(b.cooldown(B1, 'curse'));
  });

  it('Ill Wind: only the first one; and not after the 2 turns', () => {
    const a = arena({ p0: [['shout.curse']], p1: [['curse', 'heal']] });
    a.use(A1, 'shout.curse').end().use(B1, 'curse', A1).end().pass(1).use(B1, 'heal', B1).end();
    expect(a.stacks(B1, 'intimidated')).toBe(1); // the second Strategic skill adds nothing
    const b = arena({ p0: [['shout.curse']], p1: [['curse', 'heal']] });
    b.use(A1, 'shout.curse').end().pass(4).use(B1, 'curse', A1).end();
    expect(b.has(B1, 'intimidated')).toBe(false); // the wind has passed
  });

  it('Shrouded Ward: 20 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.curse']], p1: [['shot']] });
    a.use(A1, 'withstand.curse').end();
    expect(shieldOn(a, A1)).toBe(20);
    a.end();
    expect(shieldOn(a, A1)).toBe(0);
  });

  it('Shrouded Ward: each enemy who damages it is Blinded for 1 turn', () => {
    const a = arena({ p0: [['withstand.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'withstand.curse').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded'), a.has(B3, 'blinded')]).toEqual([true, true, false]);
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(true); // through their next turn
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Shrouded Ward: once the Shield is gone, hits Blind no one', () => {
    const a = arena({ p0: [['withstand.curse']], p1: [['strike'], ['shot']] });
    a.use(A1, 'withstand.curse').end();
    a.use(B1, 'strike', A1).end(); // 20 breaks the 20 Shield
    expect([shieldOn(a, A1), a.has(B1, 'blinded')]).toEqual([0, true]);
    a.pass(1).use(B2, 'shot', A1).end();
    expect(a.has(B2, 'blinded')).toBe(false);
  });

  it('Shrouded Ward: Stealthy (keeps Stealth)', () => {
    const a = arena({ p0: [['bless.shadow', 'withstand.curse']], p1: [['shot']] });
    a.use(A1, 'bless.shadow', A1).end().pass(1).use(A1, 'withstand.curse').end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Geas: the target gains a random Hex for 2 turns and is Taunted by the user for 1 turn', () => {
    const a = arena({ p0: [['taunt.curse'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.curse', B1).end();
    expect(hexes(a, B1)).toHaveLength(1);
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(A1);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Geas: every other Hexed enemy is Taunted too; an un-Hexed one isn\'t', () => {
    const a = arena({ p0: [['taunt.curse'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'hex_ruin', { duration: 4, source: A1 }).use(A1, 'taunt.curse', B1).end();
    expect([a.has(B1, 'taunt'), a.has(B2, 'taunt'), a.has(B3, 'taunt')]).toEqual([true, true, false]);
    expect(a.reject(() => a.use(B2, 'shot', A2))).toBe('bad_target');
    a.use(B3, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Geas: the Taunt lasts 1 turn; the Hex lasts 2', () => {
    const a = arena({ p0: [['taunt.curse'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.curse', B1).end().pass(2);
    expect([a.has(B1, 'taunt'), hexes(a, B1).length]).toEqual([false, 1]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('The Accursed: Immune for 3 turns, and no Armor', () => {
    const a = arena({ p0: [['titan.curse']], p1: [['shot']] });
    a.use(A1, 'titan.curse').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, true]);
    a.pass(4);
    expect(a.has(A1, 'immune')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'immune')).toBe(false);
  });

  it('The Accursed: every enemy gains a random Hex for 2 turns', () => {
    const a = arena({ p0: [['titan.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'titan.curse').end();
    expect([B1, B2, B3].map((b) => hexes(a, b).length)).toEqual([1, 1, 1]);
    const b = arena({ p0: [['strike.curse']], p1: [['shot']] }); // a 2-turn Hex, for comparison
    b.use(A1, 'strike.curse', B1).end();
    expect(hexDuration(a, B1, hexes(a, B1)[0]!)).toBe(hexDuration(b, B1, hexes(b, B1)[0]!));
  });

  it('The Accursed: each enemy who hits the user takes 10 Affliction per Hex they bear', () => {
    const a = arena({ p0: [['titan.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.curse').end();
    const extra = HEXES.find((h) => !a.has(B1, h) && h !== 'hex_pain')!;
    a.give(B1, extra, { duration: 4, source: A1 });
    const pain = a.has(B1, 'hex_pain') ? 10 : 0; // Pain bites on its own when they hit
    a.use(B1, 'shot', A1).end();
    expect(hexes(a, B1)).toHaveLength(2);
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 100 - 20 - pain]);
  });

  it('The Accursed: an enemy with no Hex left hits for free, and it ends after 3 turns', () => {
    const a = arena({ p0: [['titan.curse']], p1: [['shot']] });
    a.use(A1, 'titan.curse').end().pass(4); // the enemy's third turn: their 2-turn Hex has run out
    expect(hexes(a, B1)).toEqual([]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1).give(B1, 'hex_silence', { duration: 4, source: A1 }).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

});
