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
    ['maneuver.curse', 'r', 3],
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
    ['cleave.curse', 'S', 1],
    ['shout.curse', 'Sr', 3],
    ['withstand.curse', 'A', 2],
    ['taunt.curse', 'r', 2],
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

  it('Crushing Malediction: 25 and 15 to their allies; each Hex on the target is copied to an ally for 2 turns', () => {
    const a = arena({ p0: [['smash.curse']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hex_silence', { source: A1, duration: 20 }).give(B1, 'hex_ruin', { source: A1, duration: 20 });
    a.use(A1, 'smash.curse', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
    expect(hexes(a, B1)).toEqual(['hex_silence', 'hex_ruin']); // the target keeps them
    expect(hexes(a, B2)).toEqual(['hex_silence', 'hex_ruin']);
    a.pass(2);
    expect(hexes(a, B2)).toHaveLength(2);
    a.pass(1);
    expect(hexes(a, B2)).toHaveLength(0);
  });

  it('Crushing Malediction: no Hexes on the target, nothing copied', () => {
    const a = arena({ p0: [['smash.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.curse', B1).end();
    expect(hexes(a, B2)).toEqual([]);
  });

  it("Somnambulant Rush: 15 without waking a Sleeping target", () => {
    const a = arena({ p0: [['charge.curse']], p1: [['shot']] });
    a.give(B1, 'sleep', { source: A1, duration: 4 }).use(A1, 'charge.curse', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([85, true]);
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

  // SPEC: the description counters "every Harmful skill … by a Hexed enemy, and the first one from anyone else";
  // the ruling says one from an un-Hexed enemy ends the ward. Tested per the description.
  it.fails('Hex Ward: a Hexed enemy is still countered after an un-Hexed one was', () => {
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

  it("Familiar's Cover: Invulnerable for 1 turn", () => {
    const a = arena({ p0: [['maneuver.curse']], p1: [['shot']] });
    a.use(A1, 'maneuver.curse').end();
    expect(a.has(A1, 'invulnerable')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.end();
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  // BUG: "their Lifesteal also heals them for damage their minions deal" — the Cat's Scratch heals the Lifesteal user nothing
  it.fails("Familiar's Cover: the user's Lifesteal also heals them for their minions' damage", () => {
    const a = arena({ p0: [['companion.curse', 'maneuver.curse']], p1: [['shot']] });
    a.use(A1, 'companion.curse').end().pass(1);
    const cat = minion(a, 'black_cat');
    a.give(A1, 'lifesteal').setHp(A1, 50).use(A1, 'maneuver.curse').use(cat.id, 'cat_scratch', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 60]);
  });

  it("Familiar's Cover: no Lifesteal, no healing; and it lasts 2 turns", () => {
    const a = arena({ p0: [['companion.curse', 'maneuver.curse']], p1: [['shot']] });
    a.use(A1, 'companion.curse').end().pass(1);
    const cat = minion(a, 'black_cat');
    a.setHp(A1, 50).use(A1, 'maneuver.curse').use(cat.id, 'cat_scratch', B1).end();
    expect(a.hp(A1)).toBe(50);
    const b = arena({ p0: [['companion.curse', 'maneuver.curse']], p1: [['shot']] });
    b.use(A1, 'companion.curse').end().pass(1);
    const cat2 = minion(b, 'black_cat');
    b.give(A1, 'lifesteal').use(A1, 'maneuver.curse').end().pass(3);
    b.setHp(A1, 50).use(cat2.id, 'cat_scratch', B1).end();
    expect(b.hp(A1)).toBe(50);
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

  it('Soul Eclipse: 25 to all enemies; with no fragments, no Blind', () => {
    const a = arena({ p0: [['blast.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.curse').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([75, 75, false, false]);
  });

  it('Soul Eclipse: spends up to 3 fragments, each Blinding a random enemy for 2 turns', () => {
    const a = arena({ p0: [['blast.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 5 }).use(A1, 'blast.curse').end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
    const blinded = () => [B1, B2, B3].filter((b) => a.has(b, 'blinded')).length;
    expect(blinded()).toBeGreaterThanOrEqual(1);
    a.pass(2);
    expect(blinded()).toBeGreaterThanOrEqual(1);
    a.pass(1);
    expect(blinded()).toBe(0);
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

  it('Cursed Dagger: 10, or 20 at or below 60 HP; an un-Hexed target gains no Hex', () => {
    const a = arena({ p0: [['stab.curse'], ['stab.curse']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 70).setHp(B2, 60).use(A1, 'stab.curse', B1).use(A2, 'stab.curse', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 40]);
    expect([hexes(a, B1), hexes(a, B2)]).toEqual([[], []]);
  });

  it('Cursed Dagger: a Hexed target gains a random Hex for 2 turns (ruling)', () => {
    const a = arena({ p0: [['stab.curse']], p1: [['shot']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 2 }).use(A1, 'stab.curse', B1).end().pass(1);
    expect(hexes(a, B1).length).toBeGreaterThanOrEqual(1); // the original Pain alone would be gone by now
  });

  it('Rend the Wards: spends up to 3 fragments, a random Buff lost for each, then 30 Piercing', () => {
    const a = arena({ p0: [['ravage.curse']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).give(B1, 'might').give(B1, 'swiftness').give(B1, 'focus');
    a.use(A1, 'ravage.curse', B1).end();
    expect(['might', 'swiftness', 'focus'].filter((k) => a.has(B1, k))).toHaveLength(1);
    expect([a.stacks(A1, 'soul_fragment'), a.hp(B1)]).toEqual([0, 70]);
  });

  it('Rend the Wards: at most 3 fragments are spent', () => {
    const a = arena({ p0: [['ravage.curse']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 5 }).give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.curse', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(2);
    expect(a.hp(B1)).toBe(60); // 30 Piercing + 2 remaining fragments
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

  it("Blind Man's Toll: 20; each skill the target uses while Blinded drains a fragment for the user", () => {
    const a = arena({ p0: [['smite.curse']], p1: [['shot']] });
    a.give(B1, 'blinded', { source: A1, duration: 10 }).use(A1, 'smite.curse', B1).end();
    expect(a.hp(B1)).toBe(80);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it("Blind Man's Toll: not Blinded, no fragment; other Blinded enemies don't pay", () => {
    const a = arena({ p0: [['smite.curse']], p1: [['shot'], ['shot']] });
    a.give(B2, 'blinded', { source: A1, duration: 10 }).use(A1, 'smite.curse', B1).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(0);
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

  it('Spreading Dread: 25 and 15 to a random other enemy', () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.curse', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect([a.hp(B2), a.hp(B3)].sort()).toEqual([100, 85].sort());
  });

  it('Spreading Dread: Horrified on either one spreads to the other, for 2 turns', () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot']] });
    a.give(B1, 'horrified', { source: A1 }).use(A1, 'cleave.curse', B1).end();
    expect(a.has(B2, 'horrified')).toBe(true);
    a.pass(3);
    expect(a.has(B2, 'horrified')).toBe(false);
    const b = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot']] });
    b.give(B2, 'horrified', { source: A1 }).use(A1, 'cleave.curse', B1).end();
    expect(b.has(B1, 'horrified')).toBe(true);
  });

  it('Spreading Dread: no Horrified, nothing spreads', () => {
    const a = arena({ p0: [['cleave.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.curse', B1).end();
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([false, false]);
  });

  it('Ill Wind: all enemies Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.curse']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.curse').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.pass(2);
    expect(a.has(B1, 'intimidated')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  it("Ill Wind: meanwhile their Hexes can't be removed (other Debuffs still can)", () => {
    const a = arena({ p0: [['shout.curse']], p1: [['shot'], ['prayer.vigilante']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 20 }).give(B1, 'weakness', { source: A1 }).give(B1, 'anointed');
    a.use(A1, 'shout.curse').end();
    a.use(B2, 'prayer.vigilante').end();
    expect([a.has(B1, 'hex_pain'), a.has(B1, 'weakness'), a.has(B2, 'hex_pain')]).toEqual([true, false, false]);
  });

  it('Shrouded Ward: 20 Shield for 1 turn', () => {
    const a = arena({ p0: [['withstand.curse']], p1: [['shot']] });
    a.use(A1, 'withstand.curse').end();
    expect(shieldOn(a, A1)).toBe(20);
    a.end();
    expect(shieldOn(a, A1)).toBe(0);
  });

  // BUG: "While any of it remains, their skills don't end their Stealth" — using Shrouded Ward itself (Shield up) ends the Stealth
  it.fails("Shrouded Ward: while the Shield holds, the user's skills don't end their Stealth", () => {
    const a = arena({ p0: [['bless.shadow', 'withstand.curse']], p1: [['shot']] });
    a.use(A1, 'bless.shadow', A1).end().pass(1).use(A1, 'withstand.curse').end();
    expect(a.has(A1, 'stealth')).toBe(true);
    const b = arena({ p0: [['bless.shadow', 'withstand']], p1: [['shot']] });
    b.use(A1, 'bless.shadow', A1).end().pass(1).use(A1, 'withstand').end();
    expect(b.has(A1, 'stealth')).toBe(false); // control: a plain Withstand ends it
  });

  it('Poppet: a 10 HP Poppet Taunts the target for 1 turn; damage it takes hits them as Affliction', () => {
    const a = arena({ p0: [['taunt.curse'], ['shot']], p1: [['stab']] });
    a.give(B1, 'shield', { value: 50 }).use(A1, 'taunt.curse', B1).end();
    const p = minion(a, 'poppet');
    expect([p.owner, p.hp]).toEqual([0, 10]);
    expect(a.reject(() => a.use(B1, 'stab', A1))).toBe('bad_target');
    a.use(B1, 'stab', p.id).end(); // 20: the Poppet is at or below 60 HP
    expect(a.unit(p.id).alive).toBe(false);
    expect(a.hp(B1)).toBe(80); // the whole hit is passed on, Shield ignored
  });

  it('Poppet: the Taunt lasts 1 turn', () => {
    const a = arena({ p0: [['taunt.curse'], ['shot']], p1: [['stab']] });
    a.use(A1, 'taunt.curse', B1).end().pass(2);
    a.use(B1, 'stab', A1).end();
    expect(a.hp(A1)).toBe(90);
  });

  it('The Accursed: 2 Armor and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan.curse']], p1: [['shot']] });
    a.use(A1, 'titan.curse').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([2, true]);
    a.pass(4);
    expect(a.has(A1, 'immune')).toBe(true);
    a.pass(1);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, false]);
  });

  it('The Accursed: at the end of each user turn, each Hex on enemies deals its bearer 5 Affliction', () => {
    const a = arena({ p0: [['titan.curse']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'hex_pain', { source: A1, duration: 30 }).give(B1, 'hex_ruin', { source: A1, duration: 30 });
    a.give(B2, 'hex_silence', { source: A1, duration: 30 }).give(B1, 'shield', { value: 50 });
    a.use(A1, 'titan.curse').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 95, 100]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 90]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 85]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 85]);
  });
});
