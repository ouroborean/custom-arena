// Scenarios for the Earth element (Boulders, Seedlings, Worldsprouts, Channel Growth, all 30 variants).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content, type Arena } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));

describe('Earth minions', () => {
  it('Channel Growth: Seedlings (and Forest Stalkers) get +10 max HP and heal 10', () => {
    const a = arena({ p0: [['summon.earth', 'heal.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1);
    const [s1] = minions(a, 0, 'seedling');
    a.unit(s1!.id).hp = 5;
    a.use(A1, 'heal.earth', A2).end();
    expect([a.unit(s1!.id).maxHp, a.unit(s1!.id).hp]).toEqual([25, 15]);
  });

  it('Channel Earth: the Seedling\'s creator gains 1 Might and 1 Armor', () => {
    const a = arena({ p0: [['summon.earth']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1);
    a.use(minions(a, 0, 'seedling')[0]!.id, 'seedling_channel_earth').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([1, 1]);
  });
});

describe('Earth skills', () => {
  it('Worldfist: 15 +5 per allied minion', () => {
    const a = arena({ p0: [['strike.earth', 'summon.earth']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'strike.earth', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Worldquake: 15 / 10; 1 GEN cheaper per allied minion', () => {
    const a = arena({ p0: [['smash.earth', 'summon.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'smash.earth', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(1);
    a.end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([85, 90]);
  });

  it('Rolling Crash: 10 and a 45 HP Boulder', () => {
    const a = arena({ p0: [['charge.earth']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end();
    expect([a.hp(B1), minions(a, 0, 'boulder')[0]?.hp]).toEqual([90, 45]);
  });

  it('Shale Guard: counters once, 10 Piercing to the attacker', () => {
    const a = arena({ p0: [['riposte.earth']], p1: [['shot']] });
    a.use(A1, 'riposte.earth').end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([100, 90]);
  });

  it('Nature\'s Wrath: 2 Seedlings and Immune', () => {
    const a = arena({ p0: [['rage.earth']], p1: [['shot']] });
    a.use(A1, 'rage.earth').end();
    expect([minions(a, 0, 'seedling').length, a.has(A1, 'immune')]).toEqual([2, true]);
  });

  it('Launch Stone: 15 to an enemy, or launches an allied Boulder for its HP', () => {
    const a = arena({ p0: [['shot.earth', 'charge.earth']], p1: [['shot']] });
    a.use(A1, 'shot.earth', B1).end();
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(A1, 'charge.earth', B1).end().pass(1);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.unit(boulder.id).hp = 30;
    expect(a.reject(() => a.use(A1, 'shot.earth', A1))).toBe('bad_target');
    a.use(A1, 'shot.earth', boulder.id).end();
    expect([a.hp(B1), a.unit(boulder.id).alive]).toEqual([45, false]); // 85 − 10 (Crash) − 30
  });

  it('Tunnelmaker: 65 in 2 turns, or 1 turn by consuming a Boulder', () => {
    const a = arena({ p0: [['snipe.earth']], p1: [['shot']] });
    a.use(A1, 'snipe.earth', B1).end().pass(2);
    expect(a.hp(B1)).toBe(100);
    a.pass(2);
    expect(a.hp(B1)).toBe(35);
    const b = arena({ p0: [['snipe.earth', 'charge.earth']], p1: [['shot']] });
    b.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'snipe.earth', B1).end().pass(2);
    expect([b.hp(B1), minions(b, 0, 'boulder').length]).toEqual([25, 0]);
  });

  it('Boulder Trap: the target\'s new minion is destroyed and the trapper gets a Boulder', () => {
    const a = arena({ p0: [['trap.earth']], p1: [['summon.earth']] });
    a.use(A1, 'trap.earth', B1).end().use(B1, 'summon.earth').end();
    expect([minions(a, 1).length, minions(a, 0, 'boulder').length]).toEqual([0, 2]);
  });

  it('Burrow: Invulnerable and Ghosted', () => {
    const a = arena({ p0: [['maneuver.earth']], p1: [['shot']] });
    a.use(A1, 'maneuver.earth').end();
    expect([a.has(A1, 'invulnerable'), a.has(A1, 'ghosted')]).toEqual([true, true]);
  });

  it('Forest Stalker: 50 HP, counts as a Seedling; Rootlash is free 10 Piercing', () => {
    const a = arena({ p0: [['companion.earth', 'heal.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'companion.earth').end().pass(1);
    const st = minions(a, 0, 'forest_stalker')[0]!;
    expect(st.hp).toBe(50);
    a.give(B1, 'armor', { stacks: 2 }).use(st.id, 'stalker_rootlash', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1).use(A1, 'heal.earth', A2).end();
    expect(a.unit(st.id).maxHp).toBe(60);
  });

  it('Vine Lash: 25, plus a Seedling if the user has none', () => {
    const a = arena({ p0: [['bolt.earth']], p1: [['shot']] });
    a.use(A1, 'bolt.earth', B1).end().pass(3).use(A1, 'bolt.earth', B1).end();
    expect([a.hp(B1), minions(a, 0, 'seedling').length]).toEqual([50, 1]);
  });

  it('Verdant Burst: Channel Growth, then 25 to all enemies', () => {
    const a = arena({ p0: [['blast.earth', 'summon.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'blast.earth').end();
    expect([a.hp(B1), a.hp(B2), minions(a, 0, 'seedling')[0]?.maxHp]).toEqual([75, 75, 25]);
  });

  it('Worldmarch: every Seedling becomes a Worldsprout', () => {
    const a = arena({ p0: [['consume.earth', 'summon.earth']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'consume.earth').end();
    expect([minions(a, 0, 'seedling').length, minions(a, 0, 'worldsprout').length]).toEqual([0, 2]);
  });

  it('Worldmarch: with no Seedlings, the user creates 2 Seedlings instead', () => {
    const a = arena({ p0: [['consume.earth']], p1: [['shot']] });
    a.use(A1, 'consume.earth').end();
    expect([minions(a, 0, 'seedling').length, minions(a, 0, 'worldsprout').length]).toEqual([2, 0]);
  });

  it('Worldcaller: a Worldsprout each turn; Vitality Transfer trades it for healing', () => {
    const a = arena({ p0: [['channel.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'channel.earth').end();
    expect(minions(a, 0, 'worldsprout').length).toBe(1);
    a.pass(2);
    expect(minions(a, 0, 'worldsprout').length).toBe(2);
    const ws = minions(a, 0, 'worldsprout')[0]!;
    a.setHp(A2, 40).pass(1).use(ws.id, 'worldsprout_vitality_transfer', A2).end();
    expect([a.hp(A2), a.unit(ws.id).alive]).toEqual([75, false]);
  });

  it('Stonepierce: 10, or 20 against Shield or Armor', () => {
    const a = arena({ p0: [['stab.earth']], p1: [['shot'], ['shot']] });
    a.give(B2, 'armor').use(A1, 'stab.earth', B1).end().pass(1).use(A1, 'stab.earth', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 85]); // 20 − 5 Armor
  });

  it('Stone Drill: 25 Piercing, +20 with 3+ total Armor and Might', () => {
    const a = arena({ p0: [['ravage.earth']], p1: [['shot']] });
    a.give(A1, 'armor', { stacks: 2 }).give(A1, 'might').use(A1, 'ravage.earth', B1).end();
    expect(a.hp(B1)).toBe(50); // 45 + 5 Might
  });

  it('Pitfall: counters a Harmful skill; Stun and Isolated', () => {
    const a = arena({ p0: [['mislead.earth']], p1: [['shot']] });
    a.use(A1, 'mislead.earth', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'stun'), a.has(B1, 'isolated')]).toEqual([100, true, true]);
  });

  it('Earthwrap: the enemy gets 25 Shield and a 2-turn Stun', () => {
    const a = arena({ p0: [['stun.earth']], p1: [['shot']] });
    a.use(A1, 'stun.earth', B1).end().pass(2);
    expect([a.effects(B1).find((e) => e.defId === 'shield')?.value, a.has(B1, 'stun')]).toEqual([25, true]);
  });

  it('Landslide: 10 Shield; a Boulder when used again while it holds', () => {
    const a = arena({ p0: [['dance.earth']], p1: [['shot']] });
    a.use(A1, 'dance.earth').end();
    expect(minions(a, 0, 'boulder').length).toBe(0);
    a.pass(1).use(A1, 'dance.earth').end();
    expect(minions(a, 0, 'boulder').length).toBe(1);
  });

  it('Grovetender: Channel Growth, then heals 15', () => {
    const a = arena({ p0: [['heal.earth'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.earth', A2).end();
    expect(a.hp(A2)).toBe(65);
  });

  it('Infuse Earth: free; 1 Might or 1 Armor', () => {
    const a = arena({ p0: [['bless.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.earth', A2).end();
    expect(a.stacks(A2, 'might') + a.stacks(A2, 'armor')).toBe(1);
  });

  it('Worldmute: the ally gains 1 Might for 4 turns, then a random enemy Weakness per Might they have', () => {
    const a = arena({ p0: [['curse.earth'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A2, 'might', { stacks: 2 }).use(A1, 'curse.earth', A2).end();
    expect([a.stacks(A2, 'might'), a.stacks(B1, 'weakness') + a.stacks(B2, 'weakness')]).toEqual([3, 3]);
    const b = arena({ p0: [['curse.earth'], ['shot']], p1: [['shot'], ['shot']] });
    b.use(A1, 'curse.earth', A2).end();
    expect([b.stacks(A2, 'might'), b.stacks(B1, 'weakness') + b.stacks(B2, 'weakness')]).toEqual([1, 1]);
    b.pass(6);
    expect(b.has(A2, 'might')).toBe(true);
    b.pass(2);
    expect(b.has(A2, 'might')).toBe(false); // the Might wears off; the Weakness stays
    expect(b.stacks(B1, 'weakness') + b.stacks(B2, 'weakness')).toBe(1);
  });

  it('Earth Pillar: 20; a Boulder hit within 1 turn Stuns', () => {
    const a = arena({ p0: [['smite.earth'], ['charge.earth'], ['shot.earth']], p1: [['shot']] });
    a.use(A2, 'charge.earth', B1).end().pass(1);
    const boulder = minions(a, 0, 'boulder')[0]!;
    a.use(A1, 'smite.earth', B1).use('p0c2', 'shot.earth', boulder.id).end();
    expect(a.has(B1, 'stun')).toBe(true);
  });

  it('Verse of Nurturing: Growth twice, heals 25 and 2 Renew', () => {
    const a = arena({ p0: [['prayer.earth', 'summon.earth'], ['shot']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1);
    a.setHp(A2, 50).use(A1, 'prayer.earth').end();
    expect(minions(a, 0, 'seedling')[0]?.maxHp).toBe(35);
    expect(a.has(A2, 'renew')).toBe(true);
    expect(a.hp(A2)).toBeGreaterThanOrEqual(75);
  });

  it('Vine Whirl: 5 to all; launches a random allied Boulder', () => {
    const a = arena({ p0: [['cleave.earth', 'charge.earth']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1).use(A1, 'cleave.earth').end();
    expect([a.hp(B1), minions(a, 0, 'boulder').length]).toEqual([40, 0]); // 10 + 5 + 45
  });

  it('Vine Whirl: with no allied Boulder, the user creates one', () => {
    const a = arena({ p0: [['cleave.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.earth').end();
    expect([a.hp(B1), a.hp(B2), minions(a, 0, 'boulder').length]).toEqual([95, 95, 1]);
    a.pass(3).use(A1, 'cleave.earth').end(); // the next one launches it
    expect([a.hp(B1) + a.hp(B2), minions(a, 0, 'boulder').length]).toEqual([90 + 90 - 45, 0]);
  });

  it('Awakener\'s Roar: creates a Boulder; Boulders gain Armor and heal to full', () => {
    const a = arena({ p0: [['shout.earth', 'charge.earth']], p1: [['shot']] });
    a.use(A1, 'charge.earth', B1).end().pass(1);
    const b = minions(a, 0, 'boulder')[0]!;
    a.unit(b.id).hp = 10;
    a.use(A1, 'shout.earth').end();
    expect([a.hp(b.id), a.stacks(b.id, 'armor')]).toEqual([45, 1]);
    const made = minions(a, 0, 'boulder').filter((m) => m.id !== b.id);
    expect(made.map((m) => [m.hp, a.stacks(m.id, 'armor')])).toEqual([[45, 1]]);
  });

  it('Rampart: 30 Shield, or doubles existing Shield', () => {
    const a = arena({ p0: [['withstand.earth']], p1: [['shot']] });
    a.use(A1, 'withstand.earth').end();
    expect(a.effects(A1).find((e) => e.defId === 'shield')?.value).toBe(30);
    const b = arena({ p0: [['withstand.earth']], p1: [['shot']] });
    b.give(A1, 'shield', { value: 12 }).use(A1, 'withstand.earth').end();
    expect(b.effects(A1).filter((e) => e.defId === 'shield').map((e) => e.value)).toEqual([24]);
  });

  it('Ancient Grudge: permanent Taunt on one enemy at a time', () => {
    const a = arena({ p0: [['taunt.earth'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.earth', B1).end().pass(6); // player 2's turn, several turns later
    expect(a.has(B1, 'ancient_grudge')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(1).use(A1, 'taunt.earth', B2).end();
    expect([a.has(B1, 'ancient_grudge'), a.has(B2, 'ancient_grudge')]).toEqual([false, true]);
  });

  it('Treant Form: creates a Seedling and a Boulder, then Might per Seedling and 5 Shield per Boulder', () => {
    const a = arena({ p0: [['titan.earth', 'summon.earth']], p1: [['shot']] });
    a.use(A1, 'summon.earth').end().pass(1).use(A1, 'titan.earth').end();
    expect([minions(a, 0, 'seedling').length, minions(a, 0, 'boulder').length]).toEqual([3, 1]);
    expect([a.stacks(A1, 'might'), a.effects(A1).find((e) => e.defId === 'shield')?.value]).toEqual([3, 5]);
    const b = arena({ p0: [['titan.earth'], ['charge.earth']], p1: [['shot']] });
    b.use(A2, 'charge.earth', B1).end().pass(1).use(A1, 'titan.earth').end();
    expect([b.stacks(A1, 'might'), b.effects(A1).find((e) => e.defId === 'shield')?.value]).toEqual([1, 10]);
  });

  it('Treant Form: alone, 1 Might and 5 Shield for 4 turns', () => {
    const a = arena({ p0: [['titan.earth']], p1: [['shot']] });
    a.use(A1, 'titan.earth').end();
    expect([a.stacks(A1, 'might'), a.effects(A1).find((e) => e.defId === 'shield')?.value]).toEqual([1, 5]);
    a.pass(6);
    expect(a.has(A1, 'might')).toBe(true);
    a.pass(2);
    expect([a.has(A1, 'might'), a.has(A1, 'shield')]).toEqual([false, false]);
  });
});
