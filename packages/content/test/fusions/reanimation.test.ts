// Spec-driven scenarios for Reanimation (Lightning + Unholy): Galvanized, Reanimated and all 30 skills.
// Sources: in-game descriptions, docs/rules.md §21.39, and the design doc kit table (lightning-pairs.md).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import type { Cost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.alive && u.kind === 'minion' && u.defId === defId);
const shieldOf = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId === 'shield').reduce((n, e) => n + e.value, 0);

/** Galvanizes A1 (via a given status), then has B1 strike them down on B's turn. Returns at the start of turn 3. */
function reanimateA1(a: Arena): Arena {
  a.give(A1, 'galvanized', { source: A1 }).setHp(A1, 10).end().use(B1, 'shot', A1).end();
  return a;
}

function parseCost(s: string): Cost {
  const c: Cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s === 'nc') return c;
  for (const ch of s) c[ch as keyof Cost] += 1;
  return c;
}

const kit: [string, string, number][] = [
  ['strike', 'S', 1], ['smash', 'SI', 2], ['charge', 'r', 2], ['riposte', 'S', 3], ['rage', 'Sr', 4],
  ['shot', 'r', 0], ['snipe', 'AS', 2], ['trap', 'r', 2], ['maneuver', 'I', 2], ['companion', 'S', 1],
  ['bolt', 'Ir', 1], ['blast', 'SIr', 2], ['consume', 'I', 2], ['summon', 'S', 1], ['channel', 'r', 2],
  ['stab', 'r', 0], ['ravage', 'AS', 2], ['mislead', 'r', 3], ['stun', 'AI', 2], ['dance', 'SA', 5],
  ['heal', 'S', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'Sr', 1], ['prayer', 'Wrr', 4],
  ['cleave', 'I', 1], ['shout', 'S', 3], ['withstand', 'S', 3], ['taunt', 'S', 3], ['titan', 'SW', 4],
];

describe('Reanimation kit table', () => {
  it.each(kit)('%s.reanimation costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.reanimation`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
    expect(s.element).toBe('Reanimation');
  });

  it('minion skills: Slam S, Gnash r', () => {
    expect(content.skills.flesh_golem_slam!.cost).toEqual(parseCost('S'));
    expect(content.skills.patchwork_revenant_gnash!.cost).toEqual(parseCost('r'));
  });
});

describe('Galvanized and Reanimated', () => {
  it('Galvanized: struck down, the bearer returns at the end of that turn with 30 HP, Reanimated', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'galvanized', { source: A1 }).setHp(A1, 10).end();
    a.use(B1, 'shot', A1).end();
    expect([a.unit(A1).alive, a.hp(A1), a.has(A1, 'reanimated'), a.has(A1, 'galvanized')]).toEqual([true, 30, true, false]);
  });

  it('Galvanized: while Reanimating, the unit can\'t be targeted or damaged', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'galvanized', { source: A1 }).setHp(A1, 10).end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(30);
  });

  it('Galvanized: a hit that does not bring them down does nothing special', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.give(A1, 'galvanized', { source: A1 }).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'reanimated'), a.has(A1, 'galvanized')]).toEqual([85, false, true]);
  });

  it('without Galvanized, a killing blow kills', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 10).end().use(B1, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  it('Galvanized: only once per match', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot', 'strike'], ['shot']] });
    reanimateA1(a);
    a.give(A1, 'galvanized', { source: A1 }).end().use(B1, 'strike', A1).use(B2, 'shot', A1).end();
    expect(a.unit(A1).alive).toBe(false);
  });

  it('Reanimated: 5 HP lost at the end of each of their own turns, not the enemy\'s', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    reanimateA1(a);
    a.end();
    expect(a.hp(A1)).toBe(25);
    a.end();
    expect(a.hp(A1)).toBe(25);
  });

  it('Reanimated: can\'t be healed or gain Renew', () => {
    const a = arena({ p0: [['shot'], ['heal', 'bless']], p1: [['shot']] });
    reanimateA1(a);
    a.use(A2, 'heal', A1).end().pass(1);
    expect(a.hp(A1)).toBe(25); // no heal, 5 lost
    a.use(A2, 'bless', A1).end();
    expect(a.has(A1, 'renew')).toBe(false);
  });
});

describe('Reanimation skills', () => {
  it('Deadhand: 20 damage', () => {
    const a = arena({ p0: [['strike.reanimation']], p1: [['shot']] });
    a.use(A1, 'strike.reanimation', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Deadhand: a Reanimated user deals 10 more and skips their next 5 HP loss', () => {
    const a = arena({ p0: [['strike.reanimation'], ['shot']], p1: [['shot']] });
    reanimateA1(a);
    a.use(A1, 'strike.reanimation', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([70, 30]);
    a.pass(2);
    expect(a.hp(A1)).toBe(25);
  });

  it('Death Current: 25 and 15; if it kills any, the user is Galvanized for 2 turns', () => {
    const a = arena({ p0: [['smash.reanimation']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.reanimation', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'galvanized')]).toEqual([75, 85, false]);
    a.setHp(B3, 10).pass(5).use(A1, 'smash.reanimation', B1).end();
    expect([a.unit(B3).alive, a.has(A1, 'galvanized')]).toEqual([false, true]);
    a.pass(4);
    expect(a.has(A1, 'galvanized')).toBe(false);
  });

  it('Spark of Life: 10 damage; the user loses 10 HP and gains 3 Charge', () => {
    const a = arena({ p0: [['charge.reanimation']], p1: [['shot']] });
    a.use(A1, 'charge.reanimation', B1).end();
    expect([a.hp(B1), a.hp(A1), a.stacks(A1, 'charged')]).toEqual([90, 90, 3]);
  });

  it('Dead Man\'s Switch: counters the next Harmful skill on the user', () => {
    const a = arena({ p0: [['riposte.reanimation']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.reanimation').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 100]);
  });

  it('Dead Man\'s Switch: if Galvanized, it\'s spent to Reflect the skill instead', () => {
    const a = arena({ p0: [['riposte.reanimation']], p1: [['shot']] });
    a.give(A1, 'galvanized', { source: A1 }).use(A1, 'riposte.reanimation').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(A1, 'galvanized')]).toEqual([100, 85, false]);
  });

  it('Dead Man\'s Switch: Invisible', () => {
    expect(content.skills['riposte.reanimation']!.tags).toContain('Invisible');
  });

  it('Soul Dynamo: Stormborn for 3 turns', () => {
    const a = arena({ p0: [['rage.reanimation']], p1: [['shot']] });
    a.use(A1, 'rage.reanimation').end();
    expect(a.has(A1, 'stormborn')).toBe(true);
    a.pass(6);
    expect(a.has(A1, 'stormborn')).toBe(false);
  });

  it('Soul Dynamo: Charge reaching 3 also gives a Soul Fragment; below 3 it doesn\'t', () => {
    const a = arena({ p0: [['rage.reanimation']], p1: [['shot']] });
    a.give(A1, 'charged', { stacks: 1 }).use(A1, 'rage.reanimation').end();
    a.use(B1, 'shot', A1).end();
    expect([a.stacks(A1, 'charged'), a.has(A1, 'soul_fragment')]).toEqual([2, false]);
    a.end().use(B1, 'shot', A1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Bone Zap: 15 and Marked for 1 turn; when the Mark is spent, the user drains a Soul Fragment', () => {
    const a = arena({ p0: [['shot.reanimation'], ['shot']], p1: [['shot']] });
    a.use(A1, 'shot.reanimation', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark'), a.has(A1, 'soul_fragment')]).toEqual([85, true, false]);
    const b = arena({ p0: [['shot.reanimation'], ['shot']], p1: [['shot']] });
    b.use(A1, 'shot.reanimation', B1).use(A2, 'shot', B1).end();
    expect([b.hp(B1), b.has(B1, 'mark'), b.stacks(A1, 'soul_fragment'), b.has(A2, 'soul_fragment')]).toEqual([60, false, 1, false]);
  });

  it('Dying Current: on the following turn, 30 plus half the HP the user is missing', () => {
    const a = arena({ p0: [['snipe.reanimation']], p1: [['strike']] });
    a.setHp(A1, 40).use(A1, 'snipe.reanimation', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.use(B1, 'strike', A1).end(); // the user is at 20: missing 80
    expect(a.hp(B1)).toBe(30);
  });

  it('Dying Current: the user is Immortal until it lands', () => {
    const a = arena({ p0: [['snipe.reanimation']], p1: [['strike']] });
    a.setHp(A1, 10).use(A1, 'snipe.reanimation', B1).end().use(B1, 'strike', A1).end();
    expect([a.unit(A1).alive, a.hp(A1)]).toEqual([true, 5]);
    expect(a.has(A1, 'immortal')).toBe(false);
  });

  it('Dying Current: Channeled with a hidden target', () => {
    expect(content.skills['snipe.reanimation']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
  });

  it('Death Coil: the target\'s first Harmful skill deals them 15 and gives them Reanimated\'s drawbacks for 2 turns', () => {
    const a = arena({ p0: [['trap.reanimation']], p1: [['shot'], ['heal']] });
    a.use(A1, 'trap.reanimation', B1).end().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
    a.end(); // 5 HP lost each turn (it ticks at the end of the applier's turns)
    expect(a.hp(B1)).toBe(80);
    a.use(B2, 'heal', B1).end();
    expect(a.hp(B1)).toBe(80); // no healing
    a.end().pass(2);
    expect(a.hp(B1)).toBe(75); // it ran 2 turns, then stopped
  });

  it('Death Coil: Helpful skills don\'t trigger it; it is Invisible', () => {
    expect(content.skills['trap.reanimation']!.tags).toContain('Invisible');
    const a = arena({ p0: [['trap.reanimation']], p1: [['heal']] });
    a.use(A1, 'trap.reanimation', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Galvanic Twitch: Invulnerable; usable while Stunned, and the Stun jumps to a random enemy', () => {
    const a = arena({ p0: [['maneuver.reanimation']], p1: [['shot']] });
    a.give(A1, 'stun', { source: B1, duration: 3 }).use(A1, 'maneuver.reanimation').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'stun'), a.has(B1, 'stun')]).toEqual([true, false, true]);
  });

  it('Galvanic Twitch: with no Stun, no enemy is Stunned', () => {
    const a = arena({ p0: [['maneuver.reanimation']], p1: [['shot']] });
    a.use(A1, 'maneuver.reanimation').end();
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Flesh Golem: a permanent 40 HP minion; Slam deals 15 and Saps', () => {
    const a = arena({ p0: [['companion.reanimation']], p1: [['shot']] });
    a.use(A1, 'companion.reanimation').end();
    const g = minions(a, 'flesh_golem')[0]!;
    expect(g.hp).toBe(40);
    a.pass(1).use(g.id, 'flesh_golem_slam', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped')]).toEqual([85, 1]);
    a.pass(10);
    expect(minions(a, 'flesh_golem')).toHaveLength(1);
  });

  it('Flesh Golem: the first time it dies, it returns with 20 HP, Reanimated; the second time it stays dead', () => {
    const a = arena({ p0: [['companion.reanimation']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.reanimation').end();
    const g = minions(a, 'flesh_golem')[0]!;
    a.setHp(g.id, 5).use(B1, 'shot', g.id).end();
    expect([a.unit(g.id).alive, a.hp(g.id), a.has(g.id, 'reanimated')]).toEqual([true, 20, true]);
    a.end().use(B1, 'shot', g.id).use(B2, 'shot', g.id).end();
    expect(a.unit(g.id).alive).toBe(false);
  });

  it('Necrobolt: 20 and Marked for 1 turn', () => {
    const a = arena({ p0: [['bolt.reanimation']], p1: [['shot']] });
    a.use(A1, 'bolt.reanimation', B1).end();
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([80, true]);
  });

  it('Necrobolt: a Reanimated user deals 10 more per turn back, up to 30', () => {
    const a = arena({ p0: [['bolt.reanimation'], ['shot']], p1: [['shot'], ['shot']] });
    reanimateA1(a);
    a.pass(2).use(A1, 'bolt.reanimation', B2).end(); // one round back
    expect(a.hp(B2)).toBe(70);
    const b = arena({ p0: [['bolt.reanimation'], ['shot']], p1: [['shot'], ['shot']] });
    reanimateA1(b);
    b.setHp(A1, 100).pass(10).use(A1, 'bolt.reanimation', B2).end();
    expect(b.hp(B2)).toBe(50);
  });

  it('Soul Surge: 25 to all, +10 per Galvanized or Reanimated unit on the user\'s team', () => {
    const a = arena({ p0: [['blast.reanimation'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.reanimation').end();
    expect(a.hp(B1)).toBe(75);
    const b = arena({ p0: [['blast.reanimation'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    b.give(A2, 'galvanized', { source: A2 }).give(A3, 'reanimated');
    b.use(A1, 'blast.reanimation').end();
    expect([b.hp(B1), b.hp(B2)]).toEqual([55, 55]);
  });

  it('Life Siphon: 10 damage and the user heals 10, +10 if the target is Horrified', () => {
    const a = arena({ p0: [['consume.reanimation']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.reanimation', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([90, 60]);
    a.give(B2, 'horrified', { source: A1 }).pass(5).use(A1, 'consume.reanimation', B2).end();
    expect(a.hp(A1)).toBe(80);
  });

  it('Life Siphon: a Reanimated user gains the healing as Shield instead', () => {
    const a = arena({ p0: [['consume.reanimation'], ['shot']], p1: [['shot']] });
    reanimateA1(a);
    a.use(A1, 'consume.reanimation', B1).end();
    expect([a.hp(A1), shieldOf(a, A1)]).toEqual([25, 10]);
  });

  it('Patchwork Revenant: a 25 HP minion for 3 turns; Gnash deals 10 Affliction', () => {
    const a = arena({ p0: [['summon.reanimation']], p1: [['shot']] });
    a.use(A1, 'summon.reanimation').end();
    const r = minions(a, 'patchwork_revenant')[0]!;
    expect(r.hp).toBe(25);
    a.give(B1, 'shield', { value: 50 }).pass(1).use(r.id, 'patchwork_revenant_gnash', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(3);
    expect(minions(a, 'patchwork_revenant')).toHaveLength(0);
  });

  it('Life Current: 10 to all enemies at the end of each of the user\'s turns, up to 3; Galvanized while channeling', () => {
    const a = arena({ p0: [['channel.reanimation']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.reanimation').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'galvanized')]).toEqual([90, 90, true]);
    a.pass(4);
    expect(a.hp(B1)).toBe(70);
    a.pass(2);
    expect([a.hp(B1), a.has(A1, 'galvanized')]).toEqual([70, false]);
  });

  it('Autopsy Blade: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.reanimation']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.reanimation', B1).end().pass(1).use(A1, 'stab.reanimation', B2).end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'soul_fragment')]).toEqual([90, 40, false]);
  });

  it('Autopsy Blade: a user at or below 40 HP drains a Soul Fragment', () => {
    const a = arena({ p0: [['stab.reanimation']], p1: [['shot']] });
    a.setHp(A1, 40).use(A1, 'stab.reanimation', B1).end();
    expect(a.stacks(A1, 'soul_fragment')).toBe(1);
  });

  it('Electrocution: 35 Piercing', () => {
    const a = arena({ p0: [['ravage.reanimation']], p1: [['shot']] });
    a.setHp(B1, 60).give(B1, 'armor', { stacks: 2 }).use(A1, 'ravage.reanimation', B1).end();
    expect(a.hp(B1)).toBe(25);
  });

  it('Electrocution: a Reanimated user executes a target left at or below 25 HP, but not above', () => {
    const a = arena({ p0: [['ravage.reanimation'], ['shot']], p1: [['shot'], ['shot']] });
    reanimateA1(a);
    a.setHp(B1, 60).setHp(B2, 61).use(A1, 'ravage.reanimation', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    a.pass(5).use(A1, 'ravage.reanimation', B2).end();
    expect(a.hp(B2)).toBe(26);
  });

  it('Lazarus Trick: counters the target\'s Harmful skill; other enemies are unaffected', () => {
    const a = arena({ p0: [['mislead.reanimation'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.reanimation', B1).end().use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect([a.hp(A2), a.hp(A3)]).toEqual([100, 85]);
  });

  // BUG: "each ally it targeted is Galvanized for 2 turns" — the skill is countered, but no ally is Galvanized.
  it.fails('Lazarus Trick: counters the target\'s Harmful skill; each ally it targeted is Galvanized for 2 turns', () => {
    const a = arena({ p0: [['mislead.reanimation'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'mislead.reanimation', B1).end().use(B1, 'shot', A2).use(B2, 'shot', A3).end();
    expect([a.hp(A2), a.has(A2, 'galvanized'), a.hp(A3), a.has(A3, 'galvanized')]).toEqual([100, true, 85, false]);
    a.pass(4);
    expect(a.has(A2, 'galvanized')).toBe(false);
  });

  it('Lazarus Trick: Invisible; Helpful skills pass', () => {
    expect(content.skills['mislead.reanimation']!.tags).toContain('Invisible');
    const a = arena({ p0: [['mislead.reanimation']], p1: [['heal']] });
    a.use(A1, 'mislead.reanimation', B1).end().setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Nerve Shock: 15 and Stunned for 1 turn; while Stunned, each Sapped gained counts twice', () => {
    const a = arena({ p0: [['stun.reanimation'], ['bolt.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.reanimation', B1).use(A2, 'bolt.storm', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun'), a.stacks(B1, 'sapped')]).toEqual([65, true, 2]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Nerve Shock: an un-Stunned enemy gains Sapped normally', () => {
    const a = arena({ p0: [['stun.reanimation'], ['bolt.storm']], p1: [['shot'], ['shot']] });
    a.use(A1, 'stun.reanimation', B1).use(A2, 'bolt.storm', B2).end();
    expect(a.stacks(B2, 'sapped')).toBe(1);
  });

  it('Twitching Dance: 1 Might, 2 Swiftness and Lifesteal for 3 turns', () => {
    const a = arena({ p0: [['dance.reanimation', 'shot']], p1: [['shot']] });
    a.use(A1, 'dance.reanimation').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.has(A1, 'lifesteal')]).toEqual([1, 2, true]);
  });

  it('Twitching Dance: a hit dealt at full HP gives 1 Charge; when hurt, the Lifesteal heals instead', () => {
    const a = arena({ p0: [['dance.reanimation', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.reanimation').end().pass(1).use(A1, 'shot', B1).end();
    expect(a.stacks(A1, 'charged')).toBe(1);
    a.pass(1).setHp(A1, 50).use(A1, 'shot', B2).end();
    expect([a.stacks(A1, 'charged'), a.hp(A1)]).toEqual([1, 70]);
  });

  it('Clear!: the ally heals 20 and gains 1 Charge', () => {
    const a = arena({ p0: [['heal.reanimation'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.reanimation', A2).end();
    expect([a.hp(A2), a.stacks(A2, 'charged'), a.has(A2, 'galvanized')]).toEqual([70, 1, false]);
  });

  it('Clear!: reaching 3 Charge also Galvanizes them for 2 turns', () => {
    const a = arena({ p0: [['heal.reanimation'], ['shot']], p1: [['shot']] });
    a.give(A2, 'charged', { stacks: 2 }).use(A1, 'heal.reanimation', A2).end();
    expect([a.stacks(A2, 'charged'), a.has(A2, 'galvanized')]).toEqual([3, true]);
  });

  it('Jolt of Life: Galvanized for 3 turns', () => {
    const a = arena({ p0: [['bless.reanimation'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.reanimation', A2).end();
    expect(a.has(A2, 'galvanized')).toBe(true);
    a.pass(5);
    expect(a.has(A2, 'galvanized')).toBe(false);
  });

  it('Death Rattle: Horrified for 2 turns', () => {
    const a = arena({ p0: [['curse.reanimation']], p1: [['rage']] });
    a.use(A1, 'curse.reanimation', B1).end().use(B1, 'rage').end();
    expect([a.has(B1, 'horrified'), a.has(B1, 'might')]).toEqual([true, false]);
  });

  it('Death Rattle: if they die before it ends, every ally of the user gains 1 Soul Fragment', () => {
    const a = arena({ p0: [['curse.reanimation'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 10).use(A1, 'curse.reanimation', B1).use(A2, 'shot', B1).end();
    expect([a.unit(B1).alive, a.stacks(A1, 'soul_fragment'), a.stacks(A2, 'soul_fragment'), a.stacks(A3, 'soul_fragment')]).toEqual([false, 1, 1, 1]);
  });

  it('Soul Spark: 20; for 1 turn allies who damage them gain 10 Shield, or 20 if Reanimated', () => {
    const a = arena({ p0: [['smite.reanimation'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A3, 'reanimated').use(A1, 'smite.reanimation', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.hp(B1), shieldOf(a, A2), shieldOf(a, A3)]).toEqual([50, 10, 20]);
  });

  it('Raise the Fallen: every dead ally returns with 30 HP, Reanimated; living allies heal 15', () => {
    const a = arena({ p0: [['prayer.reanimation'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 10).end().use(B1, 'shot', A2).end();
    expect(a.unit(A2).alive).toBe(false);
    a.setHp(A1, 50).use(A1, 'prayer.reanimation').end();
    expect([a.unit(A2).alive, a.hp(A2), a.has(A2, 'reanimated'), a.hp(A1)]).toEqual([true, 25, true, 65]); // back at 30, then Reanimated's 5 at the end of the turn
  });

  it('Chain of Souls: 20 to the target and a random other enemy', () => {
    const a = arena({ p0: [['cleave.reanimation']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.reanimation', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
  });

  it('Chain of Souls: a kill makes it jump to another random enemy for 20', () => {
    const a = arena({ p0: [['cleave.reanimation']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 10).use(A1, 'cleave.reanimation', B1).end();
    expect(a.unit(B1).alive).toBe(false);
    expect(200 - a.hp(B2) - a.hp(B3)).toBe(40); // the random other enemy, then the jump
  });

  it('Wail of Lightning: all enemies Intimidated for 2 turns; any death fills the user\'s Charge to 3', () => {
    const a = arena({ p0: [['shout.reanimation'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.reanimation').end();
    expect([a.has(B1, 'intimidated'), a.has(A1, 'charged')]).toEqual([true, false]);
    a.end().setHp(B2, 10).use(A2, 'shot', B2).end();
    expect(a.stacks(A1, 'charged')).toBe(3);
  });

  it('Ribcage: 25 Shield for 1 turn; if it breaks, Galvanized for 2 turns', () => {
    const a = arena({ p0: [['withstand.reanimation']], p1: [['strike'], ['shot']] });
    a.use(A1, 'withstand.reanimation').end().use(B1, 'strike', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(A1, 'galvanized')]).toEqual([90, true]);
    const b = arena({ p0: [['withstand.reanimation']], p1: [['shot']] });
    b.use(A1, 'withstand.reanimation').end().use(B1, 'shot', A1).end();
    expect(b.has(A1, 'galvanized')).toBe(false);
  });

  it('Lure the Living: Taunted for 2 turns', () => {
    const a = arena({ p0: [['taunt.reanimation'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt.reanimation', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBeTruthy();
  });

  it('Lure the Living: if the user truly dies meanwhile, the enemy is Horrified for 2 turns', () => {
    const a = arena({ p0: [['taunt.reanimation'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 10).use(A1, 'taunt.reanimation', B1).end().use(B1, 'shot', A1).end();
    expect([a.unit(A1).alive, a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([false, true, false]);
  });

  it('The Monster Lives: 2 Armor, Immune and Galvanized for 3 turns', () => {
    const a = arena({ p0: [['titan.reanimation']], p1: [['shot'], ['curse']] });
    a.use(A1, 'titan.reanimation').end().use(B1, 'shot', A1).use(B2, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion'), a.has(A1, 'galvanized')]).toEqual([95, false, true]);
  });

  it('The Monster Lives: returning during it gives Stormborn and 1 Might for the rest of the match', () => {
    const a = arena({ p0: [['titan.reanimation'], ['shot']], p1: [['shot']] });
    a.use(A1, 'titan.reanimation').end();
    a.setHp(A1, 1).use(B1, 'shot', A1).end();
    expect([a.has(A1, 'reanimated'), a.has(A1, 'stormborn'), a.stacks(A1, 'might')]).toEqual([true, true, 1]);
    a.setHp(A1, 100).pass(10);
    expect([a.has(A1, 'stormborn'), a.stacks(A1, 'might')]).toEqual([true, 1]);
  });
});
