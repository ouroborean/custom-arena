// Spec-driven tests for the Thunder fusion (Lightning + Lightning), written from the in-game
// descriptions, docs/rules.md §21.4 and the "Pure fusions" design doc. Units: A1..A3 = p0c0..p0c2
// (player 1, odd turns), B1..B3 = p1c0..p1c2. A Resound echo lands at the end of the enemy's turn,
// just before the user's next turn.

import { describe, expect, it } from 'vitest';
import { effectDefinition, parseCost, viewFor } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

const channeling = (a: Arena, id: string) => a.effects(id).some((e) => effectDefinition(content, e)?.interruptible);
const minions = (a: Arena, defId: string) => a.state.units.filter((u) => u.defId === defId && u.alive);
const echoes = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId.startsWith('resound_echo'));
const lastGain = (a: Arena, player: 0 | 1) => {
  const ev = a.events.filter((e) => e.t === 'energyGained' && e.player === player).at(-1);
  return ev && ev.t === 'energyGained' ? ev.gained.S + ev.gained.A + ev.gained.I + ev.gained.W : NaN;
};

describe('Thunder keywords', () => {
  it('Resound: the echo deals half the damage again (rounded up to 5) before the user\'s next turn, for 1 Charge', () => {
    const a = arena({ p0: [['smash.thunder']], p1: [['shot']] });
    a.use(A1, 'smash.thunder', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([75, 0]);
    a.end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([60, 1]); // 12.5 → 15
  });

  it('Resound: the echo is indirect damage (it doesn\'t spend a Mark)', () => {
    const a = arena({ p0: [['strike.thunder']], p1: [['shot']] });
    a.use(A1, 'strike.thunder', B1).end();
    a.give(B1, 'mark', { source: A1, duration: 10 }).end();
    expect([a.hp(B1), a.has(B1, 'mark')]).toEqual([75, true]);
  });

  it('Deafened: the bearer\'s counters can\'t trigger', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte']] });
    a.pass(1).use(B1, 'riposte').end();
    a.give(B1, 'deafened', { source: A1, duration: 2 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([85, 100]);
  });

  it('Deafened: the bearer\'s Traps can\'t trigger', () => {
    const a = arena({ p0: [['shot']], p1: [['trap']] });
    a.pass(1).use(B1, 'trap', A1).end();
    a.give(B1, 'deafened', { source: A1, duration: 2 }).use(A1, 'shot', B1).end();
    expect(a.hp(A1)).toBe(100);
  });

  it('Deafened: counters on someone who isn\'t Deafened still work', () => {
    const a = arena({ p0: [['shot']], p1: [['riposte'], ['shot']] });
    a.pass(1).use(B1, 'riposte').end();
    a.give(B2, 'deafened', { source: A1, duration: 2 }).use(A1, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([100, 85]);
  });
});

describe('Thunder skills', () => {
  it('Clap: 15, and it Resounds twice, before each of the user\'s next 2 turns', () => {
    const a = arena({ p0: [['strike.thunder']], p1: [['shot']] });
    a.use(A1, 'strike.thunder', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([75, 1]);
    a.pass(2);
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([65, 2]);
    a.pass(2);
    expect(a.hp(B1)).toBe(65);
  });

  it('Rolling Thunder: 25; the echo also hits each of the target\'s allies', () => {
    const a = arena({ p0: [['smash.thunder']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.thunder', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 100, 100]);
    a.end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([60, 85, 85]);
  });

  it("Sonic Boom: 10, and the target is Deafened until the end of the user's next turn", () => {
    const a = arena({ p0: [['charge.thunder']], p1: [['shot']] });
    a.use(A1, 'charge.thunder', B1).end();
    expect([a.hp(B1), a.has(B1, 'deafened')]).toEqual([90, true]); // the boom doesn't land on Sonic Boom itself
    a.end();
    expect(a.has(B1, 'deafened')).toBe(true);
    a.end();
    expect(a.has(B1, 'deafened')).toBe(false);
  });

  it('Sonic Boom: when the user next uses a skill, every Deafened enemy takes 10', () => {
    const a = arena({ p0: [['charge.thunder', 'shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'charge.thunder', B1).end();
    a.give(B2, 'deafened', { source: A1, duration: 10 }).end();
    a.use(A1, 'shot', B3).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 90, 85]);
  });

  it('Sonic Boom: only the next skill brings the boom', () => {
    const a = arena({ p0: [['charge.thunder', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.thunder', B1).end().end();
    a.use(A1, 'shot', B1).end().end();
    expect(a.hp(B1)).toBe(65);
    a.give(B1, 'deafened', { source: A1, duration: 10 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(50);
  });

  it('Sonic Boom: if the user uses no skill by the end of their next turn, the boom is lost', () => {
    const a = arena({ p0: [['charge.thunder', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge.thunder', B1).end().pass(3);
    a.give(B1, 'deafened', { source: A1, duration: 10 }).use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Answering Peal: counters the first Harmful skill; its user is Deafened for 2 turns and Sapped', () => {
    const a = arena({ p0: [['riposte.thunder']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.thunder').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
    expect([a.has(B1, 'deafened'), a.stacks(B1, 'sapped'), a.has(B2, 'deafened')]).toEqual([true, 1, false]);
    a.pass(3);
    expect(a.has(B1, 'deafened')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'deafened')).toBe(false);
  });

  it('Heaven\'s Anger: 1 Might and Immune; each time the user gains Charge, a random enemy takes 10', () => {
    const a = arena({ p0: [['rage.thunder', 'charge.lightning']], p1: [['shot', 'curse']] });
    a.use(A1, 'rage.thunder').end();
    expect([a.stacks(A1, 'might'), a.has(A1, 'immune')]).toEqual([1, true]);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    a.use(A1, 'charge.lightning', B1).end(); // 10 + 5 Might, then 1 Charge → 10
    expect(a.hp(B1)).toBe(75);
  });

  it('Backflash: 15; the target loses all Sapped and the user gains 1 Charge per stack', () => {
    const a = arena({ p0: [['shot.thunder']], p1: [['shot']] });
    a.give(B1, 'sapped', { stacks: 2, source: A1 }).use(A1, 'shot.thunder', B1).end();
    expect([a.hp(B1), a.has(B1, 'sapped'), a.stacks(A1, 'charged')]).toEqual([85, false, 2]);
  });

  it('Thunderbolt: 10 now and Deafened for 1 turn; 40 Piercing on the following turn', () => {
    const a = arena({ p0: [['snipe.thunder']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).use(A1, 'snipe.thunder', B1).end();
    expect([a.hp(B1), a.has(B1, 'deafened'), channeling(a, A1)]).toEqual([100 - 0, true, true]);
    a.end();
    expect(a.hp(B1)).toBe(100 - 0 - 40);
  });

  it('Thunderbolt: the flash deals 10', () => {
    const a = arena({ p0: [['snipe.thunder']], p1: [['shot']] });
    a.use(A1, 'snipe.thunder', B1).end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Storm Snare: the target\'s first counter fails; they take 25 and are Deafened for 2 turns', () => {
    const a = arena({ p0: [['trap.thunder'], ['shot']], p1: [['riposte']] });
    a.use(A1, 'trap.thunder', B1).end();
    a.use(B1, 'riposte').end();
    a.use(A2, 'shot', B1).end();
    expect([a.hp(A2), a.hp(B1), a.has(B1, 'deafened')]).toEqual([100, 100 - 15 - 25, true]);
    expect(a.has(B1, 'sapped')).toBe(false);
  });

  it('Storm Snare: if nothing triggers it, the target is Sapped when it ends', () => {
    const a = arena({ p0: [['trap.thunder']], p1: [['shot']] });
    a.use(A1, 'trap.thunder', B1).end().pass(2);
    expect(a.has(B1, 'sapped')).toBe(false);
    a.pass(1);
    expect([a.stacks(B1, 'sapped'), a.hp(B1)]).toEqual([1, 100]);
  });

  it('Second Flash: Invulnerable for 1 turn, and the last skill used comes off cooldown', () => {
    const a = arena({ p0: [['smash', 'maneuver.thunder']], p1: [['shot']] });
    a.use(A1, 'smash', B1).end().pass(1);
    expect(a.cooldown(A1, 'smash')).toBeGreaterThan(0);
    a.use(A1, 'maneuver.thunder').end();
    expect([a.has(A1, 'invulnerable'), a.cooldown(A1, 'smash')]).toEqual([true, 0]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Thunderbird: 30 HP; Wingclap deals 10 to all enemies and Resounds', () => {
    const a = arena({ p0: [['companion.thunder']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.thunder').end().pass(1);
    const bird = minions(a, 'thunderbird')[0]!;
    expect(bird.hp).toBe(30);
    a.use(bird.id, 'thunderbird_wingclap').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 85]);
  });

  it('Thunderbird: when it dies, every enemy is Deafened for 1 turn', () => {
    const a = arena({ p0: [['companion.thunder']], p1: [['smash'], ['shot']] });
    a.use(A1, 'companion.thunder').end();
    const bird = minions(a, 'thunderbird')[0]!;
    a.setHp(bird.id, 10).use(B1, 'smash', bird.id).end();
    expect([a.has(B1, 'deafened'), a.has(B2, 'deafened')]).toEqual([true, true]);
  });

  it('Thundercrack: 15 and Resound, and the echo lands at once', () => {
    const a = arena({ p0: [['bolt.thunder']], p1: [['shot']] });
    a.use(A1, 'bolt.thunder', B1).end();
    expect([a.hp(B1), echoes(a, B1).length, a.stacks(A1, 'charged')]).toEqual([75, 0, 1]);
    a.end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Thundercrack: every Echo on the enemy side lands at once, whoever owns it', () => {
    const a = arena({ p0: [['bolt.thunder'], ['strike.thunder']], p1: [['shot'], ['shot']] });
    a.use(A2, 'strike.thunder', B2).use(A1, 'bolt.thunder', B1).end();
    expect([a.hp(B2), echoes(a, B2).length, a.stacks(A2, 'charged')]).toEqual([65, 0, 2]); // both of Clap's echoes
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([75, 1]);
    a.pass(4);
    expect(a.hp(B2)).toBe(65);
  });

  it('Skyquake: 20 to all, Resound; spends all Charge, and the echo repeats once more per Charge', () => {
    const a = arena({ p0: [['blast.thunder']], p1: [['shot'], ['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).use(A1, 'blast.thunder').end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'charged')]).toEqual([80, 80, 0]);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 60]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 50]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 50]);
  });

  it('Skyquake: without Charge, one echo', () => {
    const a = arena({ p0: [['blast.thunder']], p1: [['shot']] });
    a.use(A1, 'blast.thunder').end().pass(5);
    expect(a.hp(B1)).toBe(70);
  });

  it('Ground Out: 5; all enemy Charge is removed, and the user heals 10 per Charge', () => {
    const a = arena({ p0: [['consume.thunder'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).give(B1, 'charged', { stacks: 2 }).give(B2, 'charged', { stacks: 1 }).give(A2, 'charged');
    a.use(A1, 'consume.thunder', B1).end();
    expect([a.hp(B1), a.hp(A1), a.has(B1, 'charged'), a.has(B2, 'charged'), a.has(A2, 'charged')]).toEqual([
      95,
      80,
      false,
      false,
      true,
    ]);
  });

  it('Thunderhead: 25 HP for 3 turns; strikes the unit with the most Charge, either side, for 20', () => {
    const a = arena({ p0: [['summon.thunder'], ['shot']], p1: [['shot']] });
    a.give(A2, 'charged', { stacks: 2 }).give(B1, 'charged', { stacks: 1 });
    a.use(A1, 'summon.thunder').end();
    expect(minions(a, 'thunderhead').map((u) => u.hp)).toEqual([25]);
    expect([a.hp(A2), a.hp(B1)]).toEqual([80, 100]);
  });

  it('Thunderhead: with no Charge anywhere, it strikes a random enemy', () => {
    const a = arena({ p0: [['summon.thunder']], p1: [['shot']] });
    a.use(A1, 'summon.thunder').end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 80]);
    a.pass(6);
    expect(minions(a, 'thunderhead')).toHaveLength(0);
  });

  it('Drumroll: nothing lands while it channels; at the end, 10 per turn it lasted to every enemy, Resound', () => {
    const a = arena({ p0: [['channel.thunder']], p1: [['shot'], ['shot']], hp: 200 });
    a.use(A1, 'channel.thunder').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([200, 200]);
    a.pass(3);
    expect([a.hp(B1), a.hp(B2)]).toEqual([200, 200]);
    a.pass(6);
    expect([a.hp(B1), a.hp(B2)]).toEqual([200 - 30 - 15, 200 - 30 - 15]);
  });

  it('Drumroll: interrupted, nothing lands', () => {
    const a = arena({ p0: [['channel.thunder']], p1: [['stun']], hp: 200 });
    a.use(A1, 'channel.thunder').end().use(B1, 'stun', A1).end().pass(8);
    expect(a.hp(B1)).toBe(200);
  });

  it('Thunder Spike: 10, or 20 at or below 60 HP; discharges all Charge as 1 Sapped each', () => {
    const a = arena({ p0: [['stab.thunder']], p1: [['shot'], ['shot']] });
    a.give(A1, 'charged', { stacks: 2 }).setHp(B2, 60).use(A1, 'stab.thunder', B1).end();
    expect([a.hp(B1), a.stacks(B1, 'sapped'), a.stacks(A1, 'charged')]).toEqual([90, 2, 0]);
    a.pass(1).use(A1, 'stab.thunder', B2).end();
    expect([a.hp(B2), a.has(B2, 'sapped')]).toEqual([40, false]);
  });

  it('Leaking Rend: 25 Piercing; for 2 turns the target\'s Sapped takes effect at 2 stacks', () => {
    const a = arena({ p0: [['ravage.thunder']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 2 }).give(B1, 'sapped', { stacks: 2, source: A1 });
    a.use(A1, 'ravage.thunder', B1).end();
    expect(a.hp(B1)).toBe(75);
    expect(lastGain(a, 1)).toBe(2 - 1);
    expect(a.has(B1, 'sapped')).toBe(false);
  });

  it('Leaking Rend: without it, 2 Sapped does nothing', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'sapped', { stacks: 2, source: A1 }).use(A1, 'shot', B1).end();
    expect([lastGain(a, 1), a.stacks(B1, 'sapped')]).toEqual([2, 2]);
  });

  it('Hush: Invisible; the target is Deafened for 1 turn, and nothing is countered that turn', () => {
    const a = arena({ p0: [['mislead.thunder']], p1: [['shot']] });
    a.use(A1, 'mislead.thunder', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    expect(a.has(B1, 'deafened')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'deafened')]).toEqual([85, false]);
  });

  it('Hush: when that turn is over, the hush falls: their Harmful skill is countered, and the user gains 1 Charge', () => {
    const a = arena({ p0: [['mislead.thunder']], p1: [['shot', 'heal']] });
    a.use(A1, 'mislead.thunder', B1).end().pass(2);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.stacks(A1, 'charged')]).toEqual([100, 1]);
  });

  it('Hush: only Harmful skills are countered, and the hush lasts 1 turn', () => {
    const a = arena({ p0: [['mislead.thunder']], p1: [['shot', 'heal']] });
    a.use(A1, 'mislead.thunder', B1).end().pass(2);
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([75, 0]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it("Concussion: 15 and their Strategic skills are stunned for 1 turn; when the echo lands, they're fully Stunned", () => {
    const a = arena({ p0: [['stun.thunder']], p1: [['shot', 'heal']] });
    a.use(A1, 'stun.thunder', B1).end();
    expect([a.hp(B1), a.has(B1, 'stun_s'), a.has(B1, 'stun')]).toEqual([85, true, false]);
    expect(a.reject(() => a.use(B1, 'heal', B1))).toBe('cannot_act');
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1), a.has(B1, 'stun'), a.stacks(A1, 'charged')]).toEqual([85, 75, true, 1]);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end();
    expect(a.has(B1, 'stun')).toBe(false);
  });

  it('Deafening Cadence: 2 Swiftness and 1 Focus; each enemy the user damages is Deafened for 1 turn', () => {
    const a = arena({ p0: [['dance.thunder', 'shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.thunder').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([2, 1]);
    a.pass(1).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'deafened'), a.has(B2, 'deafened')]).toEqual([true, false]);
  });

  it('Deafening Cadence: each time a Deafened enemy\'s counter fails, the user gains 1 Charge', () => {
    const a = arena({ p0: [['dance.thunder', 'shot']], p1: [['riposte']] });
    a.use(A1, 'dance.thunder').end();
    a.use(B1, 'riposte').end();
    a.give(B1, 'deafened', { source: A1, duration: 2 }).use(A1, 'shot', B1).end();
    expect([a.hp(A1), a.stacks(A1, 'charged')]).toEqual([100, 1]);
  });

  it('Overcapacity: heals 20; Charge builds past 3, and at 5 gives 2 extra energy', () => {
    const a = arena({ p0: [['heal.thunder']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'heal.thunder', A1).end();
    expect(a.hp(A1)).toBe(70);
    a.give(A1, 'charged', { stacks: 3 }).end();
    expect([lastGain(a, 0), a.stacks(A1, 'charged')]).toEqual([1, 3]); // 3 no longer converts
    const b = arena({ p0: [['heal.thunder']], p1: [['shot']] });
    b.use(A1, 'heal.thunder', A1).end();
    b.give(A1, 'charged', { stacks: 5 }).end();
    expect([lastGain(b, 0), b.has(A1, 'charged')]).toEqual([1 + 2, false]);
  });

  it('Grounding Touch: each time the ally damages an enemy, one of the ally\'s Sapped moves onto them, or they gain 1', () => {
    const a = arena({ p0: [['bless.thunder'], ['shot']], p1: [['shot']] });
    a.give(A2, 'sapped', { stacks: 1, source: B1 });
    a.use(A1, 'bless.thunder', A2).use(A2, 'shot', B1).end();
    expect([a.has(A2, 'sapped'), a.stacks(B1, 'sapped')]).toEqual([false, 1]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(a.stacks(B1, 'sapped')).toBe(2);
    a.pass(3).use(A2, 'shot', B1).end(); // over
    expect(a.stacks(B1, 'sapped')).toBe(2);
  });

  it('Eardrum Burst: Deafened for 2 turns; 1 Sapped for each skill they use during it', () => {
    const a = arena({ p0: [['curse.thunder']], p1: [['shot', 'heal']] });
    a.use(A1, 'curse.thunder', B1).end();
    expect(a.has(B1, 'deafened')).toBe(true);
    a.use(B1, 'shot', A1).end();
    expect(a.stacks(B1, 'sapped')).toBe(1);
    a.pass(1).use(B1, 'heal', B1).end();
    expect(a.stacks(B1, 'sapped')).toBe(2);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.has(B1, 'deafened'), a.stacks(B1, 'sapped')]).toEqual([false, 2]);
  });

  it('Tolling Bolt: 20; for 1 turn, each time an ally damages the target, every enemy takes 5', () => {
    const a = arena({ p0: [['smite.thunder'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smite.thunder', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([100 - 20 - 15 - 5, 95]);
  });

  it('Rolling Hymn: all allies heal 15; until the user\'s next turn, each enemy skill heals all allies 10', () => {
    const a = arena({ p0: [['prayer.thunder'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.thunder').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([65, 65]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([65 - 15 + 20, 65 - 15 + 20]);
    a.pass(1).use(B1, 'shot', A1).end(); // over
    expect(a.hp(A1)).toBe(70 - 15);
  });

  it('Forked Peal: 25; the echo forks to a random other enemy at full strength', () => {
    const a = arena({ p0: [['cleave.thunder']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.thunder', B1).end().end();
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'charged')]).toEqual([75, 75, 1]); // the echo forks at full strength
  });

  it('Deafening Roar: all enemies Deafened for 2 turns; channeling enemies stop', () => {
    const a = arena({ p0: [['shout.thunder']], p1: [['shot'], ['channel']] });
    a.pass(1).use(B2, 'channel').end();
    a.use(A1, 'shout.thunder').end();
    expect([a.has(B1, 'deafened'), a.has(B2, 'deafened'), channeling(a, B2)]).toEqual([true, true, false]);
    a.pass(2);
    expect(a.has(B1, 'deafened')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'deafened')).toBe(false);
  });

  it('Thunder Cage: for 1 turn, direct hits on the user deal half damage', () => {
    const a = arena({ p0: [['withstand.thunder']], p1: [['strike', 'shot'], ['strike']] });
    a.use(A1, 'withstand.thunder').end();
    a.use(B1, 'strike', A1).use(B2, 'strike', A1).end();
    expect(a.hp(A1)).toBe(80);
    a.end().use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(60); // full damage again (15 + Strike's Might)
  });

  it('Thunder Cage: each hit Resounds back on its dealer for half of what it dealt, as their turn ends, for 1 Charge', () => {
    const a = arena({ p0: [['withstand.thunder']], p1: [['strike'], ['smash']] });
    a.use(A1, 'withstand.thunder').end();
    a.use(B1, 'strike', A1).use(B2, 'smash', A1).end();
    expect(a.hp(A1)).toBe(77); // 10 + 13 (25 halved, rounded)
    expect([a.hp(B1), a.hp(B2), a.stacks(A1, 'charged')]).toEqual([95, 90, 2]); // 5 and 10 (6.5 rounded up to 5)
  });

  it('Challenge Peal: Taunts the target until they damage the user, for up to 3 turns', () => {
    const a = arena({ p0: [['taunt.thunder'], ['shot']], p1: [['heal']] });
    a.use(A1, 'taunt.thunder', B1).end();
    a.pass(4);
    expect(a.has(B1, 'taunt')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Challenge Peal: that hit ends the Taunt and echoes back on them for half as their turn ends, for 1 Charge', () => {
    const a = arena({ p0: [['taunt.thunder'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.thunder', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'taunt')]).toEqual([85, false]);
    expect([a.hp(B1), a.stacks(A1, 'charged')]).toEqual([90, 1]); // the echo landed as their turn ended
    a.pass(1).use(B1, 'shot', A2).end(); // free again
    expect(a.hp(A2)).toBe(85);
  });

  it("Challenge Peal: ending it leaves a Taunt from anyone else in place", () => {
    const a = arena({ p0: [['taunt.thunder'], ['taunt'], ['shot']], p1: [['shot']] });
    a.use(A2, 'taunt', B1).use(A1, 'taunt.thunder', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.effects(B1).filter((e) => e.defId === 'taunt').map((e) => e.source)).toEqual([A2]);
    expect(a.reject(() => a.pass(1).use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Stormspire: 2 Armor and Immune; enemy skills that would hit several allies hit only the user', () => {
    const a = arena({ p0: [['titan.thunder'], ['shot']], p1: [['blast'], ['shot']] });
    a.use(A1, 'titan.thunder').end();
    expect(a.has(A1, 'immune')).toBe(true);
    a.use(B1, 'blast').use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([75, 85]); // single-target skills aren't redirected
  });
});

const KIT: [string, string, number][] = [
  ['strike', 'r', 0], ['smash', 'SI', 2], ['charge', 'r', 2], ['riposte', 'S', 3], ['rage', 'Sr', 4],
  ['shot', 'r', 0], ['snipe', 'AS', 2], ['trap', 'r', 2], ['maneuver', 'r', 3], ['companion', 'I', 1],
  ['bolt', 'I', 1], ['blast', 'Srr', 2], ['consume', 'r', 2], ['summon', 'I', 1], ['channel', 'r', 2],
  ['stab', 'r', 0], ['ravage', 'Ir', 1], ['mislead', 'A', 2], ['stun', 'AS', 2], ['dance', 'SA', 5],
  ['heal', 'I', 1], ['bless', 'W', 2], ['curse', 'r', 2], ['smite', 'S', 1], ['prayer', 'WW', 2],
  ['cleave', 'I', 1], ['shout', 'Sr', 2], ['withstand', 'S', 3], ['taunt', 'r', 3], ['titan', 'Wr', 4],
];

describe('Thunder costs and cooldowns (design doc kit table)', () => {
  it.each(KIT)('%s.thunder costs %s, cooldown %i', (base, cost, cd) => {
    const s = content.skills[`${base}.thunder`]!;
    expect([s.cost, s.cooldown]).toEqual([parseCost(cost), cd]);
  });
});
