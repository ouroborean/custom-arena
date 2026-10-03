// Spec tests for the Assassin fusion (Poison + Shadow): Death Mark and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.49, and the kit table in poison-earth-pairs.md.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const marked = (a: Arena, id: string) => a.has(id, 'death_mark');
const threshold = (a: Arena, id: string) => a.effects(id).find((e) => e.defId === 'death_mark')?.value;
const alive = (a: Arena, id: string) => a.unit(id).alive;

const parseCost = (c: string) => {
  const cost = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (c !== 'nc') for (const ch of c) cost[ch as keyof typeof cost] += 1;
  return cost;
};

describe('Assassin: cost and cooldown match the kit table', () => {
  const table: [string, string, number][] = [
    ['strike', 'S', 0], ['smash', 'Sr', 2], ['charge', 'S', 2], ['riposte', 'A', 3], ['rage', 'WA', 4],
    ['shot', 'r', 0], ['snipe', 'Ar', 2], ['trap', 'I', 3], ['maneuver', 'r', 3], ['companion', 'W', 1],
    ['bolt', 'Ir', 1], ['blast', 'Irr', 2], ['consume', 'r', 2], ['summon', 'W', 1], ['channel', 'Ar', 3],
    ['stab', 'r', 0], ['ravage', 'Ar', 1], ['mislead', 'W', 2], ['stun', 'A', 2], ['dance', 'A', 3],
    ['heal', 'r', 1], ['bless', 'W', 2], ['curse', 'A', 2], ['smite', 'W', 1], ['prayer', 'Wrr', 2],
    ['cleave', 'S', 1], ['shout', 'Wr', 3], ['withstand', 'r', 3], ['taunt', 'r', 3], ['titan', 'AW', 4],
  ];
  it.each(table)('%s.assassin costs %s with cooldown %i', (arch, cost, cd) => {
    const s = content.skills[`${arch}.assassin`]!;
    expect(s.cost).toEqual(parseCost(cost));
    expect(s.cooldown).toBe(cd);
  });
  it('Stealthy skills are tagged as the kit says', () => {
    for (const arch of ['smash', 'charge', 'rage', 'cleave', 'taunt']) {
      expect(content.skills[`${arch}.assassin`]!.tags).toContain('Stealthy');
    }
  });
  it('minion skills: Venom Fang (r), Seek the Mark (rr), Shank (r)', () => {
    expect(content.skills.viper_venom_fang!.cost).toEqual(parseCost('r'));
    expect(content.skills.viper_seek_the_mark!.cost).toEqual(parseCost('rr'));
    expect(content.skills.blade_shank!.cost).toEqual(parseCost('r'));
  });
});

describe('Death Mark', () => {
  it('is hidden from the enemy', () => {
    const a = arena({ p0: [['charge.assassin']], p1: [['shot']] });
    a.use(A1, 'charge.assassin', B1).end();
    expect(marked(a, B1)).toBe(true);
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1 && e.defId === 'death_mark')).toBe(false);
    expect(viewFor(content, a.state, 0).effects.some((e) => e.bearer === B1 && e.defId === 'death_mark')).toBe(true);
  });

  it('Assassin skills from the marker\'s side deal the bearer 10 more', () => {
    const a = arena({ p0: [['charge.assassin', 'strike.assassin'], ['shot']], p1: [['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.use(A1, 'strike.assassin', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85 - 30 - 15); // the base Shot gets no bonus
  });

  it('an Assassin hit that leaves the bearer at or below 25 HP executes them', () => {
    const a = arena({ p0: [['charge.assassin', 'strike.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.setHp(B1, 55).use(A1, 'strike.assassin', B1).end();
    expect(alive(a, B1)).toBe(false);
  });

  it("a non-Assassin hit that leaves the bearer at 25 or less doesn't execute", () => {
    const a = arena({ p0: [['charge.assassin'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.setHp(B1, 40).use(A2, 'shot', B1).end();
    expect([alive(a, B1), a.hp(B1)]).toEqual([true, 25]);
  });

  it('an Assassin hit that leaves them above 25 HP only adds the 10', () => {
    const a = arena({ p0: [['charge.assassin', 'strike.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.setHp(B1, 56).use(A1, 'strike.assassin', B1).end();
    expect([alive(a, B1), a.hp(B1)]).toEqual([true, 26]);
  });

  it('one Death Mark per side: placing one removes the other', () => {
    const a = arena({ p0: [['charge.assassin'], ['charge.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.assassin', B1).use(A2, 'charge.assassin', B2).end();
    expect([marked(a, B1), marked(a, B2)]).toEqual([false, true]);
  });
});

describe('Assassin skills', () => {
  it('Throatcut: 20; executing your Death Mark puts a new one on a random enemy', () => {
    const a = arena({ p0: [['charge.assassin', 'strike.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.setHp(B1, 40).use(A1, 'strike.assassin', B1).end();
    expect([alive(a, B1), marked(a, B2)]).toEqual([false, true]);
  });

  it('Throatcut: no execution, no new Mark', () => {
    const a = arena({ p0: [['strike.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.assassin', B1).end();
    expect([a.hp(B1), marked(a, B1), marked(a, B2)]).toEqual([80, false, false]);
  });

  it('Coordinated Strike: 20 / 10; each enemy hit gains 1 Toxin per Stealthed ally, and Stealth stays', () => {
    const a = arena({ p0: [['smash.assassin'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).give(A2, 'stealth', { duration: 4 });
    a.use(A1, 'smash.assassin', B1).end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([2, 2]);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 80]); // plus the Toxin's first tick
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Coordinated Strike: no Stealthed allies, no Toxin', () => {
    const a = arena({ p0: [['smash.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.assassin', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'toxin')]).toEqual([80, 90, false]);
  });

  it('Stalk: 15 and your Death Mark for 2 turns; Stealthy', () => {
    const a = arena({ p0: [['charge.assassin']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'charge.assassin', B1).end();
    expect([a.hp(B1), marked(a, B1), threshold(a, B1), a.has(A1, 'stealth')]).toEqual([85, true, 25, true]);
    a.pass(3);
    expect(marked(a, B1)).toBe(false);
  });

  it('Garrote Wire: counters the first Harmful skill; its user is Stunned for 1 turn', () => {
    const a = arena({ p0: [['riposte.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.assassin').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1);
  });

  it('Garrote Wire: 2 turns if the countered skill has a cooldown of 3 or more', () => {
    const a = arena({ p0: [['riposte.assassin']], p1: [['taunt', 'shot']] });
    a.use(A1, 'riposte.assassin').end().use(B1, 'taunt', A1).end().pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1);
  });

  it('Open Contract: 1 Might, 1 Swiftness, and a random enemy gains your Death Mark; Stealthy', () => {
    const a = arena({ p0: [['rage.assassin']], p1: [['shot'], ['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'rage.assassin').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.has(A1, 'stealth')]).toEqual([1, 1, true]);
    expect([B1, B2].filter((u) => marked(a, u))).toHaveLength(1);
  });

  it('Open Contract: each execution meanwhile gives 1 more Might and Swiftness for 2 turns', () => {
    const a = arena({ p0: [['rage.assassin', 'stab.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'rage.assassin').end().pass(1);
    const bearer = [B1, B2].find((u) => marked(a, u))!;
    a.setHp(bearer, 40).use(A1, 'stab.assassin', bearer).end();
    expect(alive(a, bearer)).toBe(false);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness')]).toEqual([2, 2]);
  });

  it("Blowdart: 10 Piercing and 1 Toxin; for 2 turns their Toxin, Weakness and Vulnerable can't be removed", () => {
    const a = arena({ p0: [['shot.assassin']], p1: [['maneuver.spore']] });
    a.give(B1, 'weakness', { source: A1 }).give(B1, 'confusion', { source: A1 });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'shot.assassin', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([85, 1]); // 10 Piercing + the Toxin's first tick
    a.use(B1, 'maneuver.spore').end(); // sheds Debuffs
    expect([a.has(B1, 'toxin'), a.has(B1, 'weakness'), a.has(B1, 'confusion')]).toEqual([true, true, false]);
  });

  it('The Long Shot: 40 on the following turn; an unmarked target gains your Death Mark', () => {
    const a = arena({ p0: [['snipe.assassin']], p1: [['shot']] });
    a.use(A1, 'snipe.assassin', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), marked(a, B1)]).toEqual([60, true]);
  });

  it('The Long Shot: against your Death Mark, it executes at 40 HP', () => {
    const a = arena({ p0: [['snipe.assassin'], ['charge.assassin']], p1: [['shot']] });
    a.use(A2, 'charge.assassin', B1).use(A1, 'snipe.assassin', B1).end().end();
    // 85 − (40 + 10) = 35: at or below 40
    expect(alive(a, B1)).toBe(false);
  });

  it('Tainted Well: for 3 turns, enemies take 5 Affliction whenever they use any skill', () => {
    const a = arena({ p0: [['trap.assassin']], p1: [['shot'], ['heal']] });
    a.use(A1, 'trap.assassin').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => content.statuses[e.defId]?.name === 'Tainted Well')).toBe(false);
    a.setHp(B2, 50).use(B1, 'shot', A1).use(B2, 'heal', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 70]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(3).use(B1, 'shot', A1).end(); // turn 8: over
    expect(a.hp(B1)).toBe(90);
  });

  it('Covering Smoke: Invulnerable; meanwhile Stealthed allies stay Stealthed whatever they use', () => {
    const a = arena({ p0: [['maneuver.assassin'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stealth', { duration: 4 });
    a.use(A1, 'maneuver.assassin').use(A2, 'shot', B1).end();
    expect([a.has(A1, 'invulnerable'), a.has(A2, 'stealth')]).toEqual([true, true]);
  });

  it('Covering Smoke: without it, a non-Stealthy skill ends Stealth', () => {
    const a = arena({ p0: [['shot'], ['shot']], p1: [['shot']] });
    a.give(A2, 'stealth', { duration: 4 }).use(A2, 'shot', B1).end();
    expect(a.has(A2, 'stealth')).toBe(false);
  });

  it("Covering Smoke: the user's other ally with the least HP gains Stealth for 1 turn, kept through their skills", () => {
    const a = arena({ p0: [['maneuver.assassin'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A3, 40).use(A1, 'maneuver.assassin').use(A3, 'shot', B1).end();
    expect([a.has(A2, 'stealth'), a.has(A3, 'stealth')]).toEqual([false, true]);
    expect(a.reject(() => a.use(B1, 'shot', A3))).toBe('bad_target');
  });

  it('Covering Smoke: the Stealth it gives lasts 1 turn', () => {
    const a = arena({ p0: [['maneuver.assassin'], ['shot'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).use(A1, 'maneuver.assassin').end();
    expect(a.has(A2, 'stealth')).toBe(true);
    a.end();
    expect(a.has(A2, 'stealth')).toBe(false);
  });

  it('Shadow Viper: a permanent 25 HP minion; Venom Fang deals 5 Piercing and 1 Toxin', () => {
    const a = arena({ p0: [['companion.assassin']], p1: [['shot']] });
    a.use(A1, 'companion.assassin').end().pass(7);
    const v = minions(a, 0, 'shadow_viper')[0]!;
    expect(v.hp).toBe(25);
    a.give(B1, 'armor', { stacks: 3 }).use(v.id, 'viper_venom_fang', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'toxin')]).toEqual([90, 1]);
  });

  it('Shadow Viper: Seek the Mark with no Mark out marks the target', () => {
    const a = arena({ p0: [['companion.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.assassin').end().pass(1);
    const v = minions(a, 0, 'shadow_viper')[0]!;
    a.use(v.id, 'viper_seek_the_mark', B1).end();
    expect([marked(a, B1), marked(a, B2)]).toEqual([true, false]);
  });

  it("Shadow Viper: Seek the Mark hits your Death Mark's bearer for 15 Piercing (+10), whoever was targeted", () => {
    const a = arena({ p0: [['companion.assassin'], ['charge.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.assassin').use(A2, 'charge.assassin', B2).end().pass(1);
    const v = minions(a, 0, 'shadow_viper')[0]!;
    a.give(B2, 'armor', { stacks: 3 }).use(v.id, 'viper_seek_the_mark', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100, 85 - 25]);
  });

  it('Whispered Names: 20 and a 2-turn Mark; when it is spent, a random other enemy is Marked', () => {
    const a = arena({ p0: [['bolt.assassin'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'bolt.assassin', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 20 - 15 - 10);
    expect(a.has(B1, 'mark')).toBe(false);
    expect([B2, B3].filter((u) => a.has(u, 'mark'))).toHaveLength(1);
  });

  it('Whispered Names: a passed Mark lasts only 1 turn', () => {
    const a = arena({ p0: [['bolt.assassin'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'bolt.assassin', B1).use(A2, 'shot', B1).end().pass(1);
    const second = [B2, B3].find((u) => a.has(u, 'mark'));
    expect(second).toBeUndefined(); // the passed Mark lasted 1 turn
  });

  it('Whispered Names: a passed Mark spent in the same turn passes again', () => {
    const a = arena({ p0: [['bolt.assassin'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'bolt.assassin', B1).use(A2, 'shot', B1);
    a.end();
    const x = [B2, B3].find((u) => a.has(u, 'mark'))!;
    const b = arena({ p0: [['bolt.assassin'], ['shot'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    b.use(A1, 'bolt.assassin', B1).use(A2, 'shot', B1).use(A3, 'shot', x).end();
    expect(b.hp(x)).toBe(75); // 15 + the passed Mark's 10
    expect([B1, B2, B3].filter((u) => u !== x && b.has(u, 'mark'))).toHaveLength(1);
  });

  it('Poison Smoke: 20 and 1 Toxin to all; your Death Mark moves to the enemy with the least HP', () => {
    const a = arena({ p0: [['blast.assassin'], ['charge.assassin']], p1: [['shot'], ['shot']] });
    a.use(A2, 'charge.assassin', B2).end().pass(1);
    a.setHp(B1, 50).use(A1, 'blast.assassin').end();
    expect([a.stacks(B1, 'toxin'), a.stacks(B2, 'toxin')]).toEqual([1, 1]);
    expect([marked(a, B1), marked(a, B2)]).toEqual([true, false]);
    expect(viewFor(content, a.state, 1).effects.some((e) => e.defId === 'death_mark')).toBe(false); // still hidden
  });

  it('Poison Smoke: a moved Mark resets to the 25 threshold', () => {
    const a = arena({ p0: [['blast.assassin'], ['curse.assassin']], p1: [['shot'], ['shot']] });
    a.give(B2, 'toxin', { stacks: 2, source: B2 });
    a.use(A2, 'curse.assassin', B2).end().pass(1);
    expect(threshold(a, B2)).toBe(35);
    a.setHp(B1, 50).use(A1, 'blast.assassin').end();
    expect(threshold(a, B1)).toBe(25);
  });

  it('Poison Smoke: no Mark out, none appears', () => {
    const a = arena({ p0: [['blast.assassin']], p1: [['shot'], ['shot']] });
    a.setHp(B1, 50).use(A1, 'blast.assassin').end();
    expect([marked(a, B1), marked(a, B2)]).toEqual([false, false]);
  });

  it('Fulfill the Contract: 5 lifesteal; leaving them at or below 15 executes them, and the kill heals 30 more and grants Stealth', () => {
    const a = arena({ p0: [['consume.assassin']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 40).setHp(B1, 20).use(A1, 'consume.assassin', B1).end();
    expect(alive(a, B1)).toBe(false);
    expect([a.hp(A1), a.has(A1, 'stealth')]).toEqual([75, true]);
  });

  it('Fulfill the Contract: above 15 after the hit, no execution', () => {
    const a = arena({ p0: [['consume.assassin']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 40).setHp(B1, 21).use(A1, 'consume.assassin', B1).end();
    expect([alive(a, B1), a.hp(B1), a.hp(A1), a.has(A1, 'stealth')]).toEqual([true, 16, 45, false]);
  });

  it('Fulfill the Contract: an execution through your Death Mark counts too', () => {
    const a = arena({ p0: [['charge.assassin', 'consume.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.setHp(A1, 40).setHp(B1, 35).use(A1, 'consume.assassin', B1).end();
    expect(alive(a, B1)).toBe(false);
    expect(a.has(A1, 'stealth')).toBe(true);
    expect(a.hp(A1)).toBeGreaterThanOrEqual(40 + 5 + 30);
  });

  it('Fulfill the Contract: it heals the damage actually dealt', () => {
    const a = arena({ p0: [['consume.assassin']], p1: [['shot']] });
    a.setHp(A1, 40).give(B1, 'armor', { stacks: 1 }).use(A1, 'consume.assassin', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([100, 40]);
  });

  it('Fulfill the Contract: without an execution, just the 5', () => {
    const a = arena({ p0: [['consume.assassin']], p1: [['shot']] });
    a.setHp(A1, 40).use(A1, 'consume.assassin', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(A1, 'stealth')]).toEqual([95, 45, false]);
  });

  it('Hired Blade: 20 HP for 3 turns; Shank deals 10 Affliction', () => {
    const a = arena({ p0: [['summon.assassin']], p1: [['shot']] });
    a.use(A1, 'summon.assassin').end().pass(1);
    const blade = minions(a, 0, 'hired_blade')[0]!;
    expect(blade.hp).toBe(20);
    a.give(B1, 'shield', { value: 50 }).use(blade.id, 'blade_shank', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(3);
    expect(minions(a, 0, 'hired_blade')).toHaveLength(0);
  });

  it('Hired Blade: whoever kills it gains your Death Mark', () => {
    const a = arena({ p0: [['summon.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.assassin').end();
    const blade = minions(a, 0, 'hired_blade')[0]!;
    a.use(B1, 'shot', blade.id).use(B2, 'shot', blade.id).end();
    expect([alive(a, blade.id), marked(a, B1), marked(a, B2)]).toEqual([false, false, true]);
  });

  it("Open Season: marks an enemy if none is marked; 10 to all enemies at the end of each of the user's turns", () => {
    const a = arena({ p0: [['channel.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.assassin').end();
    expect([B1, B2].filter((u) => marked(a, u))).toHaveLength(1);
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(6);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });

  it("Open Season: doesn't move a Mark that's already out", () => {
    const a = arena({ p0: [['channel.assassin'], ['charge.assassin']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A2, 'charge.assassin', B3).use(A1, 'channel.assassin').end();
    expect([marked(a, B1), marked(a, B2), marked(a, B3)]).toEqual([false, false, true]);
  });

  it('Open Season: meanwhile your Death Mark executes at 35 HP', () => {
    const a = arena({ p0: [['channel.assassin'], ['strike.assassin']], p1: [['shot']] });
    a.setHp(B1, 60).use(A1, 'channel.assassin').use(A2, 'strike.assassin', B1).end();
    expect(alive(a, B1)).toBe(false); // left at 30
  });

  it('Stiletto: 10, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.assassin']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.assassin', B1).end().pass(1).use(A1, 'stab.assassin', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it("Stiletto: against your Death Mark, the threshold rises by 5 before the hit", () => {
    const a = arena({ p0: [['charge.assassin', 'stab.assassin']], p1: [['shot']] });
    a.use(A1, 'charge.assassin', B1).end().pass(1);
    a.setHp(B1, 60).use(A1, 'stab.assassin', B1).end();
    expect(alive(a, B1)).toBe(false); // left at 30, threshold 30
  });

  it('Stiletto: the threshold never goes above 40', () => {
    const a = arena({ p0: [['curse.assassin'], ['stab.assassin'], ['stab.assassin']], p1: [['shot']], hp: 400 });
    a.use(A1, 'curse.assassin', B1).use(A2, 'stab.assassin', B1).use(A3, 'stab.assassin', B1).end();
    expect(threshold(a, B1)).toBe(35);
    a.pass(1).use(A2, 'stab.assassin', B1).use(A3, 'stab.assassin', B1).end();
    expect(threshold(a, B1)).toBe(40);
  });

  it('Unseen Knife: 25 Piercing; against a Blinded target the user slips into Stealth', () => {
    const a = arena({ p0: [['ravage.assassin']], p1: [['shot'], ['shot']] });
    a.give(B1, 'blinded', { source: A1 }).give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'ravage.assassin', B1).end();
    expect([a.hp(B1), a.has(A1, 'stealth')]).toEqual([75, true]);
  });

  it('Unseen Knife: against an un-Blinded, awake target, no Stealth', () => {
    const b = arena({ p0: [['ravage.assassin']], p1: [['shot']] });
    b.use(A1, 'ravage.assassin', B1).end();
    expect(b.has(A1, 'stealth')).toBe(false);
  });

  it('Unseen Knife: against a Sleeping target too', () => {
    const a = arena({ p0: [['ravage.assassin']], p1: [['shot']] });
    a.give(B1, 'sleep', { source: A1 }).use(A1, 'ravage.assassin', B1).end();
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Poisoned Lure: a Harmful skill is countered and its user gains your Death Mark', () => {
    const a = arena({ p0: [['mislead.assassin']], p1: [['shot']] });
    a.use(A1, 'mislead.assassin', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), marked(a, B1), a.has(B1, 'toxin')]).toEqual([100, true, false]);
  });

  it("Poisoned Lure: if they don't, they gain 2 Toxin when it runs out", () => {
    const a = arena({ p0: [['mislead.assassin']], p1: [['heal']] });
    a.use(A1, 'mislead.assassin', B1).end().use(B1, 'heal', B1).end();
    expect([a.stacks(B1, 'toxin'), marked(a, B1)]).toEqual([2, false]);
  });

  it('Knockout Poison: 10 and Asleep for 1 turn', () => {
    const a = arena({ p0: [['stun.assassin']], p1: [['shot']] });
    a.use(A1, 'stun.assassin', B1).end();
    expect([a.hp(B1), a.has(B1, 'sleep')]).toEqual([90, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    a.use(B1, 'shot', A1);
  });

  it('Knockout Poison: 2 turns with 4 or more Toxin', () => {
    const one = arena({ p0: [['stun.assassin']], p1: [['shot']] });
    one.give(B1, 'toxin', { stacks: 3, source: B1 }).use(A1, 'stun.assassin', B1).end();
    const two = arena({ p0: [['stun.assassin']], p1: [['shot']] });
    two.give(B1, 'toxin', { stacks: 4, source: B1 }).use(A1, 'stun.assassin', B1).end();
    const d = (a: Arena) => a.effects(B1).find((e) => e.defId === 'sleep')!.duration!;
    expect(d(two) - d(one)).toBe(2);
  });

  it("Dance of Knives: 1 Swiftness and 1 Focus; each skill the user uses also hits your Death Mark's bearer for 5 Piercing", () => {
    const a = arena({ p0: [['dance.assassin', 'shot'], ['charge.assassin']], p1: [['shot'], ['shot']] });
    a.use(A2, 'charge.assassin', B2).use(A1, 'dance.assassin').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    const after = a.hp(B2);
    a.pass(1).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect([5, 15]).toContain(after - a.hp(B2)); // 5, or 15 if the Mark's +10 applies
  });

  it('Dance of Knives: with no Mark out, no extra hit', () => {
    const a = arena({ p0: [['dance.assassin', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.assassin').end().pass(1).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 100]);
  });

  it('Blood Debt: heals 25; the enemy who last damaged them gains your Death Mark', () => {
    const a = arena({ p0: [['heal.assassin'], ['shot']], p1: [['shot'], ['shot']] });
    a.end().use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    a.setHp(A2, 50).use(A1, 'heal.assassin', A2).end();
    expect([a.hp(A2), marked(a, B1), marked(a, B2)]).toEqual([75, false, true]);
  });

  it('Subcontract: 1 Might; the ally\'s skills count as Assassin skills against your Death Mark', () => {
    const a = arena({ p0: [['bless.assassin'], ['shot'], ['charge.assassin', 'shot']], p1: [['shot']] });
    a.use(A1, 'bless.assassin', A2).use(A3, 'charge.assassin', B1).end().pass(1);
    expect(a.stacks(A2, 'might')).toBe(1);
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85 - 30); // 15 + 5 Might + 10
  });

  it('Subcontract: an ally without it gets no bonus', () => {
    const a = arena({ p0: [['bless.assassin'], ['shot'], ['charge.assassin', 'shot']], p1: [['shot']] });
    a.use(A1, 'bless.assassin', A2).use(A3, 'charge.assassin', B1).end().pass(1);
    a.use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(70);
  });

  it('Mark for Death: your Death Mark for 3 turns and Confused for 2', () => {
    const a = arena({ p0: [['curse.assassin']], p1: [['shot']] });
    a.use(A1, 'curse.assassin', B1).end();
    expect([marked(a, B1), threshold(a, B1), a.has(B1, 'confusion')]).toEqual([true, 25, true]);
    a.pass(3);
    expect([marked(a, B1), a.has(B1, 'confusion')]).toEqual([true, false]);
    a.pass(2);
    expect(marked(a, B1)).toBe(false);
  });

  it('Mark for Death: executes 5 HP higher per Toxin when placed (max 40)', () => {
    const a = arena({ p0: [['curse.assassin', 'strike.assassin']], p1: [['shot'], ['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: B1 }).give(B2, 'toxin', { stacks: 5, source: B2 });
    a.use(A1, 'curse.assassin', B1).end();
    expect(threshold(a, B1)).toBe(35);
    a.pass(1).setHp(B1, 65).use(A1, 'strike.assassin', B1).end();
    expect(alive(a, B1)).toBe(false); // left at 35
    const b = arena({ p0: [['curse.assassin']], p1: [['shot'], ['shot']] });
    b.give(B2, 'toxin', { stacks: 5, source: B2 }).use(A1, 'curse.assassin', B2).end();
    expect(threshold(b, B2)).toBe(40);
  });

  it('Souring Mark: 20; for 1 turn each ally who damages them turns 1 of their Buffs into 1 Vulnerable', () => {
    const a = arena({ p0: [['smite.assassin'], ['shot']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 1 });
    a.use(A1, 'smite.assassin', B1).use(A2, 'shot', B1).end();
    expect([a.has(B1, 'might'), a.stacks(B1, 'vulnerable')]).toEqual([false, 1]);
    expect(a.hp(B1)).toBe(65);
  });

  it("Souring Mark: the user's own opening hit doesn't sour anything", () => {
    const a = arena({ p0: [['smite.assassin']], p1: [['shot']] });
    a.give(B1, 'might', { stacks: 1 }).use(A1, 'smite.assassin', B1).end();
    expect([a.has(B1, 'might'), a.has(B1, 'vulnerable')]).toEqual([true, false]);
  });

  it("Serpent's Communion: all allies heal 20; for 2 turns their Toxin heals them instead", () => {
    const a = arena({ p0: [['prayer.assassin'], ['shot']], p1: [['shot']] });
    a.give(A1, 'toxin', { stacks: 2, source: B1 });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.assassin').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
    a.end();
    expect(a.hp(A1)).toBe(80);
  });

  it("Serpent's Communion: enemy Toxin still harms enemies", () => {
    const a = arena({ p0: [['prayer.assassin']], p1: [['shot']] });
    a.give(B1, 'toxin', { stacks: 2, source: A1 }).use(A1, 'prayer.assassin').end();
    expect(a.hp(B1)).toBe(90);
  });

  it("Fan of Knives: 20 and 10 to another enemy — always your Death Mark's bearer if it's out; Stealthy", () => {
    const a = arena({ p0: [['cleave.assassin'], ['charge.assassin']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A2, 'charge.assassin', B3).end().pass(1);
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'cleave.assassin', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 100, 85 - 20]);
    expect(a.has(A1, 'stealth')).toBe(true);
  });

  it('Pick the Target: all enemies Blinded for 2 turns; the Mark bearer is also Isolated', () => {
    const a = arena({ p0: [['shout.assassin'], ['charge.assassin']], p1: [['shot'], ['shot']] });
    a.use(A2, 'charge.assassin', B2).use(A1, 'shout.assassin').end();
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, true]);
    expect([a.has(B1, 'isolated'), a.has(B2, 'isolated')]).toEqual([false, true]);
    a.pass(3);
    expect([a.has(B1, 'blinded'), a.has(B2, 'isolated')]).toEqual([false, false]);
  });

  it('Pick the Target: with no Mark out, a random enemy is Isolated', () => {
    const a = arena({ p0: [['shout.assassin']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.assassin').end();
    expect([B1, B2].filter((u) => a.has(u, 'isolated'))).toHaveLength(1);
  });

  it('Hidden Mail: 25 Shield for 1 turn; each enemy skill that hits it has its cooldown raised by 1', () => {
    const base = arena({ p0: [['shot']], p1: [['smash']] });
    base.end().use(B1, 'smash', A1).end();
    const a = arena({ p0: [['withstand.assassin']], p1: [['smash']] });
    a.use(A1, 'withstand.assassin').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'smash', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.cooldown(B1, 'smash')).toBe(base.cooldown(B1, 'smash') + 1);
  });

  it('Whisper from the Dark: Taunted by the user for 1 turn even while Stealthed; Stealthy', () => {
    const a = arena({ p0: [['taunt.assassin'], ['shot']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'taunt.assassin', B1).end();
    expect([a.has(B1, 'taunt'), a.has(A1, 'stealth')]).toEqual([true, true]);
    expect(a.effects(B1).find((e) => e.defId === 'taunt')?.source).toBe(A1);
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it("Whisper from the Dark: while the Stealthed user can't be targeted, the Taunted enemy can't target anyone else", () => {
    const a = arena({ p0: [['taunt.assassin'], ['shot']], p1: [['shot']] });
    a.give(A1, 'stealth', { duration: 4 }).use(A1, 'taunt.assassin', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
  });

  it('Guildmaster: 1 Armor and Ghosted for 3 turns; every enemy gains a Death Mark from the user', () => {
    const a = arena({ p0: [['titan.assassin']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'titan.assassin').end();
    expect([a.stacks(A1, 'armor'), a.has(A1, 'ghosted')]).toEqual([1, true]);
    expect([marked(a, B1), marked(a, B2), marked(a, B3)]).toEqual([true, true, true]);
    a.pass(5);
    expect([a.has(A1, 'armor'), marked(a, B1)]).toEqual([false, false]);
  });
});
