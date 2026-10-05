// Spec-driven scenarios for Moon (Earth + Shadow): the Lunar Cycle and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.52, and the design kit (poison-earth-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// A Moon character's own turns 1, 2, 3, 4 (game turns 1, 3, 5, 7) are New, Waxing, Full and Waning.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena, type ArenaOptions } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const NEW = 0;
const WAXING = 1;
const FULL = 2;
const WANING = 3;

/** A match where A1 is a Moon character (carries the Lunar Cycle). */
const moon = (o: ArenaOptions) => arena({ ...o, passives: { p0c0: ['lunar_cycle'], ...o.passives } });
const phase = (a: Arena, id = A1) => a.unit(id).counters['c:phase'] ?? 0;
/** Sets the phase directly (for skills that only read it; Full Moon triggers are reached by playing turns). */
const setPhase = (a: Arena, p: number, id = A1) => {
  a.unit(id).counters['c:phase'] = p;
  return a;
};
const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const costLetters = (id: string) => {
  const c = content.skills[id]!.cost as unknown as Record<string, number>;
  return ['S', 'A', 'I', 'W', 'r'].map((k) => k.repeat(c[k] ?? 0)).join('') || 'nc';
};
const sortLetters = (s: string) => (s === 'nc' ? s : [...s].sort().join(''));

describe('Moon: cost and cooldown match the design kit', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['A', 3], rage: ['WA', 4],
    shot: ['r', 0], snipe: ['Ar', 2], trap: ['r', 2], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['Ar', 1], blast: ['Irr', 2], consume: ['r', 2], summon: ['I', 1], channel: ['Wr', 3],
    stab: ['r', 0], ravage: ['Ar', 1], mislead: ['W', 2], stun: ['A', 2], dance: ['A', 1],
    heal: ['r', 1], bless: ['r', 2], curse: ['A', 3], smite: ['Wr', 1], prayer: ['Wrr', 2],
    cleave: ['S', 1], shout: ['Wr', 3], withstand: ['r', 3], taunt: ['r', 2], titan: ['AW', 4],
  };
  it.each(Object.entries(kit))('%s.moon', (arch, [cost, cd]) => {
    const id = `${arch}.moon`;
    expect([sortLetters(costLetters(id)), content.skills[id]!.cooldown]).toEqual([sortLetters(cost), cd]);
  });

  it('minion skills: Moonfang r, Flutter r', () => {
    expect(['wolf_moonfang', 'moth_flutter'].map(costLetters)).toEqual(['r', 'r']);
  });

  it('tags: Prowl, Eclipse Stealthy; Shadowed Face, Dreaming Stones, False Moonlight Invisible', () => {
    for (const id of ['charge.moon', 'maneuver.moon']) expect(content.skills[id]!.tags).toContain('Stealthy');
    for (const id of ['riposte.moon', 'trap.moon', 'mislead.moon']) expect(content.skills[id]!.tags).toContain('Invisible');
  });
});

describe('Lunar Cycle', () => {
  it('starts at New Moon and advances at the end of each of the character\'s own turns', () => {
    const a = moon({ p0: [['shot']], p1: [['shot']] });
    const seen = [phase(a)];
    for (let i = 0; i < 4; i++) {
      a.end();
      seen.push(phase(a));
      a.end(); // the enemy's turn doesn't advance it
      seen.push(phase(a));
    }
    expect(seen).toEqual([NEW, WAXING, WAXING, FULL, FULL, WANING, WANING, NEW, NEW]);
  });

  it('a character without a Moon skill has no cycle', () => {
    const a = moon({ p0: [['strike.moon'], ['shot']], p1: [['shot']] });
    a.pass(2);
    expect([a.has(A2, 'lunar_cycle'), a.has(A1, 'lunar_cycle')]).toEqual([false, true]);
  });

  it('the phase rider applies to Moon skills only', () => {
    const a = moon({ p0: [['strike.moon', 'shot']], p1: [['shot']] });
    setPhase(a, WANING).setHp(A1, 50).use(A1, 'shot', B1).end();
    expect(a.hp(A1)).toBe(50);
  });
});

describe('Moon skills', () => {
  it('Moonstone Fist: 20', () => {
    const a = moon({ p0: [['strike.moon']], p1: [['shot']] });
    a.use(A1, 'strike.moon', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Moonstone Fist: at New Moon it is Stealthy (Stealth stays)', () => {
    const a = moon({ p0: [['strike.moon']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'strike.moon', B1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Moonstone Fist: outside New Moon, it ends Stealth', () => {
    const a = moon({ p0: [['strike.moon']], p1: [['shot']] });
    setPhase(a, WAXING).give(A1, 'stealth', { duration: 4 }).use(A1, 'strike.moon', B1).end();
    expect(a.has(A1, 'stealth')).toBe(false);
  });

  it('Moonstone Fist: Waning, the user heals half the damage dealt', () => {
    const a = moon({ p0: [['strike.moon']], p1: [['shot']] });
    setPhase(a, WANING).setHp(A1, 50).use(A1, 'strike.moon', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 60]);
  });

  it('Moonfall: at the New Moon, 15 to the target and 10 to their allies; the cycle then advances as usual', () => {
    const a = moon({ p0: [['smash.moon'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.moon', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([85, 90, 100]);
    expect(phase(a)).toBe(WAXING);
  });

  it('Moonfall: 5 more to each per phase since the New Moon (Waning: 30 and 25)', () => {
    const hit = (p: number) => {
      const a = moon({ p0: [['smash.moon']], p1: [['shot'], ['shot']] });
      setPhase(a, p).use(A1, 'smash.moon', B1).end();
      return [100 - a.hp(B1), 100 - a.hp(B2)];
    };
    expect([hit(WAXING), hit(FULL), hit(WANING)]).toEqual([
      [20, 15],
      [25, 20],
      [30, 25],
    ]);
  });

  it('Moonfall: then the Lunar Cycle falls back to New Moon (so it advances to Waxing, not onward)', () => {
    const a = moon({ p0: [['smash.moon']], p1: [['shot']] });
    setPhase(a, FULL).use(A1, 'smash.moon', B1);
    a.end();
    expect(phase(a)).toBe(WAXING); // Full → New, then the end-of-turn advance
    const b = moon({ p0: [['smash.moon']], p1: [['shot']] });
    setPhase(b, WANING).use(A1, 'smash.moon', B1).end();
    expect(phase(b)).toBe(WAXING); // the New Moon it fell to is spent at once
  });

  it('Prowl: 10 damage, and the user gains Stealth', () => {
    const a = moon({ p0: [['charge.moon']], p1: [['shot']] });
    setPhase(a, FULL).use(A1, 'charge.moon', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([90, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Prowl: the Lunar Cycle holds this turn instead of advancing, then moves on as usual', () => {
    const a = moon({ p0: [['charge.moon']], p1: [['shot']] });
    setPhase(a, FULL).use(A1, 'charge.moon', B1).end();
    expect(phase(a)).toBe(FULL);
    a.pass(2);
    expect(phase(a)).toBe(WANING);
  });

  it('Prowl: Stealthy, so an existing Stealth is kept', () => {
    const a = moon({ p0: [['charge.moon']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'charge.moon', B1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Shadowed Face: hidden; counters only the first Harmful skill', () => {
    const a = moon({ p0: [['riposte.moon']], p1: [['shot'], ['shot']] });
    setPhase(a, WAXING).use(A1, 'riposte.moon').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1 && e.defId !== 'lunar_cycle')).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Shadowed Face: at New Moon it counters every Harmful skill', () => {
    const a = moon({ p0: [['riposte.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.moon').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Turn Beast: the cycle leaps to the Full Moon at once, and it rises (a Lunar Wolf howls)', () => {
    const a = moon({ p0: [['rage.moon', 'companion.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.moon').end().pass(1); // Waxing
    const w = minions(a, 0, 'lunar_wolf')[0]!;
    a.setHp(w.id, 10).use(A1, 'rage.moon');
    a.end();
    expect(a.hp(w.id)).toBe(30);
    expect([B1, B2].filter((u) => a.effects(u).some((e) => e.defId === 'taunt' && e.source === w.id)).length).toBe(1);
  });

  it('Turn Beast: the Full Moon holds for 3 turns (this one and the user\'s next two), then the cycle moves on', () => {
    const a = moon({ p0: [['rage.moon']], p1: [['shot']] });
    a.use(A1, 'rage.moon').end(); // New → Full, held
    expect(phase(a)).toBe(FULL);
    a.pass(1);
    a.end(); // the user's next turn: still Full, held again
    expect(phase(a)).toBe(FULL);
    a.pass(1);
    a.end(); // the third: Full during it, advancing at its end
    expect(phase(a)).toBe(WANING);
  });

  it('Turn Beast: already at the Full Moon, it doesn\'t rise again (no howl), it only holds', () => {
    const a = moon({ p0: [['rage.moon', 'companion.moon']], p1: [['shot']] });
    a.use(A1, 'companion.moon').end().pass(1);
    const w = minions(a, 0, 'lunar_wolf')[0]!;
    setPhase(a, FULL).setHp(w.id, 10).use(A1, 'rage.moon').end();
    expect([a.hp(w.id), phase(a)]).toEqual([10, FULL]);
  });

  it('Turn Beast: for 3 turns, direct hits deal 10 more and heal the user for half the damage dealt', () => {
    const a = moon({ p0: [['rage.moon', 'shot']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'rage.moon').end().pass(1);
    a.use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 62]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([50, 74]);
    a.pass(1).use(A1, 'shot', B1).end(); // over: a plain 15, no heal
    expect([a.hp(B1), a.hp(A1)]).toEqual([35, 74]);
  });

  it('Turn Beast: for as long, the user\'s Strategic skills are Stunned', () => {
    const a = moon({ p0: [['rage.moon', 'shot', 'withstand']], p1: [['shot']] });
    a.use(A1, 'rage.moon').end().pass(1);
    expect(a.reject(() => a.use(A1, 'withstand'))).toBe('cannot_act');
    a.use(A1, 'shot', B1).end().pass(1); // non-Strategic skills still work
    expect(a.reject(() => a.use(A1, 'withstand'))).toBe('cannot_act');
    a.pass(2).use(A1, 'withstand').end();
    expect(a.has(A1, 'shield')).toBe(true);
  });

  it('Moonshard: 10 Piercing', () => {
    const a = moon({ p0: [['shot.moon']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'shot.moon', B1).end().pass(6);
    expect(a.hp(B1)).toBe(90); // not Waxing: no shard
  });

  it('Moonshard: Waxing, the shard lodges and deals 15 more at the start of the next Full Moon', () => {
    const a = moon({ p0: [['shot.moon']], p1: [['shot']] });
    a.pass(2).use(A1, 'shot.moon', B1);
    expect(phase(a)).toBe(WAXING);
    a.end(); // the Full Moon starts at the end of this turn
    expect(a.hp(B1)).toBe(75);
    a.pass(8);
    expect(a.hp(B1)).toBe(75); // once
  });

  it("Hunter's Moon: on the following turn, 30 to the stalked enemy", () => {
    const a = moon({ p0: [['snipe.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.moon', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'hunted')]).toEqual([70, 100, false]);
  });

  it("Hunter's Moon: 10 more for each hit the user's allies land on them before it lands", () => {
    const a = moon({ p0: [['snipe.moon'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'snipe.moon', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end().end();
    expect(a.hp(B1)).toBe(100 - 15 - 15 - 50);
  });

  it("Hunter's Moon: at most 60", () => {
    const a = moon({ p0: [['snipe.moon']], p1: [['shot']] });
    a.use(A1, 'snipe.moon', B1).end();
    a.effects(B1).find((e) => e.inline?.id === 'hunted')!.stacks = 7; // six hits
    a.end();
    expect(a.hp(B1)).toBe(40);
  });

  it("Hunter's Moon: Channeled; a Stun on the user before it lands stops the shot", () => {
    const a = moon({ p0: [['snipe.moon']], p1: [['stun']] });
    a.use(A1, 'snipe.moon', B1).end().use(B1, 'stun', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Dreaming Stones: hidden; their first Harmful skill puts them to Sleep and Isolates them for 1 turn', () => {
    const a = moon({ p0: [['trap.moon'], ['shot']], p1: [['shot'], ['heal']] });
    a.use(A1, 'trap.moon', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false);
    a.use(B1, 'shot', A2).end();
    expect([a.has(B1, 'sleep'), a.has(B1, 'isolated')]).toEqual([true, true]);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    expect(a.reject(() => a.use(B2, 'heal', B1))).toBe('bad_target');
    a.pass(1);
    expect([a.has(B1, 'sleep'), a.has(B1, 'isolated')]).toEqual([false, false]); // 1 turn
  });

  it("Dreaming Stones: only the first Harmful skill springs it; Helpful skills don't", () => {
    const a = moon({ p0: [['trap.moon'], ['shot']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap.moon', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(a.has(B1, 'sleep')).toBe(false);
    a.pass(1).use(B1, 'shot', A2).end();
    expect(a.has(B1, 'sleep')).toBe(true);
    a.pass(3);
    a.use(B1, 'shot', A2).end();
    expect(a.has(B1, 'sleep')).toBe(false); // spent
  });

  it('Dreaming Stones: lasts 2 turns', () => {
    const a = moon({ p0: [['trap.moon']], p1: [['shot']] });
    a.use(A1, 'trap.moon', B1).end().pass(4);
    a.use(B1, 'shot', A1).end();
    expect(a.has(B1, 'sleep')).toBe(false);
  });

  it('Eclipse: Invulnerable for 1 turn; the cycle advances one extra phase', () => {
    const a = moon({ p0: [['maneuver.moon']], p1: [['shot']] });
    a.use(A1, 'maneuver.moon').end();
    expect([a.has(A1, 'invulnerable'), phase(a)]).toEqual([true, FULL]);
    a.pass(2);
    expect([a.has(A1, 'invulnerable'), phase(a)]).toEqual([false, WANING]); // back to one phase a turn
  });

  it('Eclipse: Stealthy (keeps Stealth)', () => {
    const a = moon({ p0: [['maneuver.moon']], p1: [['shot']] });
    setPhase(a, WAXING).give(A1, 'stealth', { duration: 4 }).use(A1, 'maneuver.moon').end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Lunar Wolf: 35 HP, permanent; Moonfang 10 Piercing', () => {
    const a = moon({ p0: [['companion.moon']], p1: [['shot']] });
    a.use(A1, 'companion.moon').end().pass(1);
    const w = minions(a, 0, 'lunar_wolf')[0]!;
    expect(w.hp).toBe(35);
    a.give(B1, 'armor', { stacks: 2 }).use(w.id, 'wolf_moonfang', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(12);
    expect(a.unit(w.id).alive).toBe(true);
  });

  it('Lunar Wolf: at the start of each Full Moon it heals 20 and a random enemy is Taunted by it for 1 turn', () => {
    const a = moon({ p0: [['companion.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.moon').end().pass(1);
    const w = minions(a, 0, 'lunar_wolf')[0]!;
    a.setHp(w.id, 10).end(); // Full Moon begins
    expect(a.hp(w.id)).toBe(30);
    const taunted = [B1, B2].filter((u) => a.effects(u).some((e) => e.defId === 'taunt' && e.source === w.id));
    expect(taunted.length).toBe(1);
    a.pass(2);
    expect(a.has(taunted[0]!, 'taunt')).toBe(false);
  });

  it('Lunar Wolf: no howl outside the start of the Full Moon', () => {
    const a = moon({ p0: [['companion.moon']], p1: [['shot']] });
    a.use(A1, 'companion.moon').end();
    const w = minions(a, 0, 'lunar_wolf')[0]!;
    a.setHp(w.id, 10).pass(1);
    expect([a.hp(w.id), a.has(B1, 'taunt')]).toEqual([10, false]);
  });

  it('Moonless Bolt: 15 damage, and Blinded for 4 turns at the New Moon', () => {
    const a = moon({ p0: [['bolt.moon']], p1: [['shot']] });
    a.use(A1, 'bolt.moon', B1).end();
    expect([a.hp(B1), a.has(B1, 'blinded')]).toEqual([85, true]);
    a.pass(6);
    expect(a.has(B1, 'blinded')).toBe(true); // through their 4th turn
    a.pass(1);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Moonless Bolt: the brighter the moon, the shorter: 3 turns Waxing, 2 Full, 1 Waning', () => {
    const lasts = (p: number) => {
      const a = moon({ p0: [['bolt.moon']], p1: [['shot']] });
      setPhase(a, p).use(A1, 'bolt.moon', B1).end();
      let n = 0;
      while (a.has(B1, 'blinded')) {
        a.pass(1);
        n += 1;
      }
      return n; // turns ended after its own: 2N − 1 for N turns
    };
    expect([lasts(NEW), lasts(WAXING), lasts(FULL), lasts(WANING)]).toEqual([7, 5, 3, 1]);
  });

  it('Moonburst: 25 to all enemies', () => {
    const a = moon({ p0: [['blast.moon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'blinded', { source: A1, duration: 4 }).use(A1, 'blast.moon').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'sleep')]).toEqual([75, 75, false]);
  });

  it('Moonburst: Full Moon, Blinded enemies fall Asleep after the hit (others don\'t)', () => {
    const a = moon({ p0: [['blast.moon']], p1: [['shot'], ['shot']] });
    setPhase(a, FULL).give(B1, 'blinded', { source: A1, duration: 4 }).use(A1, 'blast.moon').end();
    expect([a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([true, false]);
  });

  it('Moonburst: Waning, the user heals 5 per enemy hit', () => {
    const a = moon({ p0: [['blast.moon']], p1: [['shot'], ['shot'], ['shot']] });
    setPhase(a, WANING).setHp(A1, 50).use(A1, 'blast.moon').end();
    expect(a.hp(A1)).toBe(65);
  });

  it('Drink the Moonlight: 10, healing the user for it', () => {
    const a = moon({ p0: [['consume.moon']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.moon', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([90, 100, 60]);
  });

  it('Drink the Moonlight: Waning, it drains every enemy', () => {
    const a = moon({ p0: [['consume.moon']], p1: [['shot'], ['shot']] });
    setPhase(a, WANING).setHp(A1, 50).use(A1, 'consume.moon', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(A1)]).toEqual([90, 90, 70]);
  });

  it('Moon Moths: 2 Moths (10 HP) for 3 turns; Flutter 10', () => {
    const a = moon({ p0: [['summon.moon']], p1: [['shot']] });
    a.use(A1, 'summon.moon').end().pass(1);
    const m = minions(a, 0, 'moon_moth');
    expect(m.map((u) => u.hp)).toEqual([10, 10]);
    a.use(m[0]!.id, 'moth_flutter', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(4);
    expect(minions(a, 0, 'moon_moth').length).toBe(0);
  });

  it('Moon Moths: every Blinded enemy is Taunted by a Moth for 1 turn; others aren\'t', () => {
    const a = moon({ p0: [['summon.moon']], p1: [['shot'], ['shot']] });
    a.give(B1, 'blinded', { source: A1, duration: 4 }).use(A1, 'summon.moon').end();
    const moths = minions(a, 0, 'moon_moth').map((u) => u.id);
    expect(a.effects(B1).some((e) => e.defId === 'taunt' && moths.includes(e.source))).toBe(true);
    expect(a.has(B2, 'taunt')).toBe(false);
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Lunar Lullaby: 10 to all enemies each turn; reaching the New Moon, every enemy falls Asleep', () => {
    const a = moon({ p0: [['channel.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.moon').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(6); // New Moon again at the end of game turn 7
    expect([a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([true, true]);
    const left = a.hp(B1);
    a.pass(2);
    expect(a.hp(B1)).toBe(left); // it's over
  });

  it('Lunar Lullaby: from New Moon it ticks on 4 turns', () => {
    const a = moon({ p0: [['channel.moon']], p1: [['shot']] });
    a.use(A1, 'channel.moon').end().pass(6);
    expect(a.hp(B1)).toBe(60);
  });

  it('Lunar Lullaby: started at the Full Moon, it ticks on 2 turns', () => {
    const a = moon({ p0: [['channel.moon']], p1: [['shot']] });
    a.pass(4).use(A1, 'channel.moon').end().pass(4);
    expect(a.hp(B1)).toBe(80);
  });

  it('Lunar Lullaby: interrupted before the New Moon, no Sleep', () => {
    const a = moon({ p0: [['channel.moon', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel.moon').end().pass(1).use(A1, 'shot', B1).end().pass(4);
    expect(a.has(B1, 'sleep')).toBe(false);
  });

  it('Silver Severance: 10, or 20 at or below 60 HP', () => {
    const a = moon({ p0: [['stab.moon']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.moon', B1).end().pass(1).use(A1, 'stab.moon', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Silver Severance: their Blind ends, and they are Isolated for 2 turns instead', () => {
    const a = moon({ p0: [['stab.moon']], p1: [['shot'], ['heal']] });
    a.give(B1, 'blinded', { source: A1, duration: 4 }).use(A1, 'stab.moon', B1).end();
    expect([a.has(B1, 'blinded'), a.has(B1, 'isolated')]).toEqual([false, true]);
    expect(a.reject(() => a.use(B2, 'heal', B1))).toBe('bad_target');
    a.pass(4);
    expect(a.has(B1, 'isolated')).toBe(false);
  });

  // "Their Blind ends, and they're Isolated … instead": read with the kit (Isolated for the turns the Blind had left), so
  // a target with no Blind isn't Isolated.
  it('Silver Severance: an un-Blinded target is not Isolated', () => {
    const a = moon({ p0: [['stab.moon']], p1: [['shot']] });
    a.use(A1, 'stab.moon', B1).end();
    expect(a.has(B1, 'isolated')).toBe(false);
  });

  it('Feral Maw: 35 Piercing damage (Armor doesn\'t reduce it)', () => {
    const a = moon({ p0: [['ravage.moon']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.moon', B1).end();
    expect(a.hp(B1)).toBe(65);
  });

  it('Feral Maw: the frenzy Blinds the user through their next turn', () => {
    const a = moon({ p0: [['ravage.moon']], p1: [['shot']] });
    a.use(A1, 'ravage.moon', B1).end();
    expect(a.has(A1, 'blinded')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'blinded')).toBe(true); // still, on their next turn
    a.end();
    expect(a.has(A1, 'blinded')).toBe(false);
  });

  it('False Moonlight: hidden; a Harmful skill is countered, and every enemy is Blinded for 1 turn', () => {
    const a = moon({ p0: [['mislead.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.moon', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.source === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([100, true, true]);
    a.pass(1);
    expect(a.has(B2, 'blinded')).toBe(true); // through their next turn
    a.pass(1);
    expect(a.has(B2, 'blinded')).toBe(false);
  });

  it('False Moonlight: a Helpful skill passes, and it lasts 1 turn', () => {
    const a = moon({ p0: [['mislead.moon']], p1: [['shot', 'heal']] });
    a.use(A1, 'mislead.moon', B1).end().use(B1, 'heal', B1).end().pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'blinded')]).toEqual([85, false]);
  });

  it('Lunacy: 10 to the target, then they and a random ally of theirs are Asleep for 1 turn', () => {
    const a = moon({ p0: [['stun.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.moon', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([90, 100, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('cannot_act');
    a.pass(2).use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70);
  });

  it('Lunacy: damage that wakes either one wakes both', () => {
    const a = moon({ p0: [['stun.moon'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.moon', B1).use(A2, 'shot', B2).end();
    expect([a.has(B1, 'sleep'), a.has(B2, 'sleep')]).toEqual([false, false]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(70);
  });

  it('Lunacy: with no ally to share it, the target sleeps alone', () => {
    const a = moon({ p0: [['stun.moon']], p1: [['shot']] });
    a.use(A1, 'stun.moon', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([90, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Dance of Phases: 1 Swiftness and the phase\'s gift (New: Stealth)', () => {
    const a = moon({ p0: [['dance.moon']], p1: [['shot']] });
    a.use(A1, 'dance.moon').end();
    expect([a.has(A1, 'swiftness'), a.has(A1, 'stealth')]).toEqual([true, true]);
  });

  it('Dance of Phases: Waxing 2 Armor, Full 2 Might, Waning 2 Renew', () => {
    const gift = (p: number) => {
      const a = moon({ p0: [['dance.moon']], p1: [['shot']] });
      setPhase(a, p).use(A1, 'dance.moon').end();
      return [a.stacks(A1, 'armor'), a.stacks(A1, 'might'), a.has(A1, 'renew'), a.has(A1, 'stealth')];
    };
    expect([gift(WAXING), gift(FULL), gift(WANING)]).toEqual([
      [2, 0, false, false],
      [0, 2, false, false],
      [0, 0, true, false],
    ]);
  });

  it('Dance of Phases: Waning, 2 Renew (heals 5 per stack, then loses a stack)', () => {
    const a = moon({ p0: [['dance.moon']], p1: [['shot']] });
    setPhase(a, WANING).setHp(A1, 50).use(A1, 'dance.moon').end();
    expect(a.hp(A1)).toBe(60);
    a.pass(2);
    expect(a.hp(A1)).toBe(65);
    a.pass(2);
    expect(a.hp(A1)).toBe(65);
  });

  it('Dance of Phases: lasts 2 turns', () => {
    const a = moon({ p0: [['dance.moon']], p1: [['shot']] });
    setPhase(a, WAXING).use(A1, 'dance.moon').end().pass(4);
    expect([a.has(A1, 'swiftness'), a.stacks(A1, 'armor')]).toEqual([false, 0]);
  });

  it('Borrowed Moonlight: heals 40; 3 turns later they lose 20 HP', () => {
    const a = moon({ p0: [['heal.moon'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.moon', A2).end();
    expect(a.hp(A2)).toBe(90);
    a.pass(8);
    expect(a.hp(A2)).toBe(70);
  });

  it('Borrowed Moonlight: the loss can\'t kill them', () => {
    const a = moon({ p0: [['heal.moon'], ['shot']], p1: [['shot']] });
    a.use(A1, 'heal.moon', A2).end().setHp(A2, 10).pass(8);
    expect([a.unit(A2).alive, a.hp(A2)]).toEqual([true, 1]);
  });

  it('Moonveil: the ally is Asleep and Invulnerable through their next turn', () => {
    const a = moon({ p0: [['bless.moon'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.moon', A2).end();
    expect([a.has(A2, 'sleep'), a.has(A2, 'invulnerable')]).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end();
    expect(a.reject(() => a.use(A2, 'shot', B1))).toBe('cannot_act');
    a.end();
    expect([a.has(A2, 'sleep'), a.has(A2, 'invulnerable')]).toEqual([false, false]);
  });

  it('Moonveil: when they wake, 2 Might for 2 turns and 3 Renew', () => {
    const a = moon({ p0: [['bless.moon'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.moon', A2).end().pass(2);
    expect([a.stacks(A2, 'might'), a.stacks(A2, 'renew')]).toEqual([2, 3]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
    a.pass(4);
    expect(a.stacks(A2, 'might')).toBe(0);
  });

  it('Tidal Lock: non-Strategic skills Stunned on their 1st and 3rd turns, Strategic on their 2nd', () => {
    const a = moon({ p0: [['curse.moon']], p1: [['shot', 'curse', 'taunt']] });
    a.use(A1, 'curse.moon', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.use(B1, 'curse', A1).end().pass(1); // Strategic is free on their 1st
    expect(a.reject(() => a.use(B1, 'taunt', A1))).toBe('cannot_act');
    a.use(B1, 'shot', A1).end().pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1).end(); // their 4th turn: free
  });

  it('Moonlight Covenant: 20; every unit on both sides is Sanctified for 2 turns', () => {
    const a = moon({ p0: [['smite.moon'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smite.moon', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect([A1, A2, B1, B2].map((u) => a.has(u, 'sanctify'))).toEqual([true, true, true, true]);
    a.pass(4);
    expect(a.has(B2, 'sanctify')).toBe(false);
  });

  it('Lunar Hymn: all allies heal 20; New Moon, Stealth', () => {
    const a = moon({ p0: [['prayer.moon'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'prayer.moon').end();
    expect([a.hp(A2), a.has(A2, 'stealth'), a.has(A1, 'stealth')]).toEqual([70, true, true]);
  });

  it('Lunar Hymn: Waxing 2 Renew; Full 1 Might; Waning every enemy 1 Weakness', () => {
    const run = (p: number) => {
      const a = moon({ p0: [['prayer.moon'], ['shot']], p1: [['shot'], ['shot']] });
      setPhase(a, p).use(A1, 'prayer.moon').end();
      return [a.stacks(A2, 'renew') > 0, a.stacks(A2, 'might'), a.stacks(B1, 'weakness') + a.stacks(B2, 'weakness'), a.has(A2, 'stealth')];
    };
    expect([run(WAXING), run(FULL), run(WANING)]).toEqual([
      [true, 0, 0, false],
      [false, 1, 0, false],
      [false, 0, 2, false],
    ]);
  });

  it('Shattered Crescent: 10 to the target, and a Moonshard lodges in each other enemy', () => {
    const a = moon({ p0: [['cleave.moon']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'cleave.moon', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([90, 100, 100]);
    expect([B1, B2, B3].map((u) => a.has(u, 'moonshard'))).toEqual([false, true, true]);
  });

  it('Shattered Crescent: each shard deals 15 at the start of the next Full Moon, once', () => {
    const a = moon({ p0: [['cleave.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.moon', B1).end().pass(1); // New → Waxing
    expect(a.hp(B2)).toBe(100);
    a.end(); // Waxing → Full
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 85]);
    a.pass(8);
    expect(a.hp(B2)).toBe(85);
  });

  it('Shattered Crescent: from the Full Moon, the shards wait the whole cycle for the next one', () => {
    const a = moon({ p0: [['cleave.moon']], p1: [['shot'], ['shot']] });
    setPhase(a, FULL).use(A1, 'cleave.moon', B1).end().pass(5); // Waning, New, Waxing
    expect([phase(a), a.hp(B2)]).toEqual([WAXING, 100]);
    a.end();
    expect([phase(a), a.hp(B2)]).toEqual([FULL, 85]);
  });

  it('Howl at the Moon: the user heals 20, and every enemy is Taunted by them for 1 turn', () => {
    const a = moon({ p0: [['shout.moon'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'shout.moon').end();
    expect(a.hp(A1)).toBe(70);
    expect([B1, B2].map((u) => a.effects(u).some((e) => e.defId === 'taunt' && e.source === A1))).toEqual([true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.end();
    expect([a.has(B1, 'taunt'), a.has(B2, 'taunt'), a.has(B1, 'intimidated')]).toEqual([false, false, false]);
  });

  it('Cairn Ward: 25 Shield for 1 turn; what\'s left becomes a Boulder with that much HP', () => {
    const a = moon({ p0: [['withstand.moon']], p1: [['shot']] });
    a.use(A1, 'withstand.moon').end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(minions(a, 0, 'boulder').map((u) => u.hp)).toEqual([10]);
  });

  it('Cairn Ward: unbroken, a 25 HP Boulder; fully broken, none', () => {
    const a = moon({ p0: [['withstand.moon']], p1: [['shot']] });
    a.use(A1, 'withstand.moon').end().pass(1);
    expect(minions(a, 0, 'boulder').map((u) => u.hp)).toEqual([25]);
    const b = moon({ p0: [['withstand.moon']], p1: [['smash']] });
    b.use(A1, 'withstand.moon').end().use(B1, 'smash', A1).end();
    expect(minions(b, 0, 'boulder').length).toBe(0);
  });

  it('Wandering Light: Taunts for 2 turns', () => {
    const a = moon({ p0: [['taunt.moon'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.moon', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });

  it('Wandering Light: when an ally of the user damages them, the Taunt passes to that ally', () => {
    const a = moon({ p0: [['taunt.moon'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.moon', B1).use(A2, 'shot', B1).end();
    expect(a.effects(B1).filter((e) => e.defId === 'taunt').map((e) => e.source)).toEqual([A2]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Face of the Moon: each enemy who hits the user is Blinded for 2 turns', () => {
    const a = moon({ p0: [['titan.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.moon').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([85, true, false]);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Face of the Moon: while Blinded, they deal the user 10 less damage', () => {
    const a = moon({ p0: [['titan.moon']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.moon').end().use(B1, 'shot', A1).end().pass(1);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end(); // B1 Blinded: 5; B2's first hit: 15
    expect([a.hp(A1), a.has(B2, 'blinded')]).toEqual([65, true]);
  });

  it('Face of the Moon: lasts 3 turns', () => {
    const a = moon({ p0: [['titan.moon']], p1: [['shot']] });
    a.use(A1, 'titan.moon').end().pass(4).use(B1, 'shot', A1).end(); // the third enemy turn: still on
    expect(a.has(B1, 'blinded')).toBe(true);
    const b = moon({ p0: [['titan.moon']], p1: [['shot']] });
    b.use(A1, 'titan.moon').end().pass(6).use(B1, 'shot', A1).end();
    expect(b.has(B1, 'blinded')).toBe(false);
  });

});

