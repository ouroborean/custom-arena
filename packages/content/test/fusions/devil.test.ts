// Spec-driven tests for Devil (Fire + Unholy): Hellfire, Contracts, Devil's Ledger and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.18, and the fire-pairs.md kit table (with the
// 2026-10-05 evolution redesigns).
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { formatCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';
const LEDGER = { p0c0: ['devils_ledger'] };

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
/** Does the unit carry an effect that is, or counts as, `key`? */
const counts = (a: Arena, id: string, key: string) =>
  a.effects(id).some((e) => {
    const def = e.inline ?? content.statuses[e.defId];
    return e.defId === key || e.inline?.id === key || (def?.countsAs ?? []).includes(key);
  });
const contracts = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId === 'contract' || (e.inline?.countsAs ?? []).includes('contract')).length;
const sf = (a: Arena, id: string) => a.stacks(id, 'soul_fragment');
const energy = (a: Arena, p: 0 | 1) => Object.values(a.state.players[p].energy).reduce((n, v) => n + v, 0);
const tabs = (a: Arena, id: string) => a.effects(id).filter((e) => e.defId === 'devils_tab').length;
const queuedR = (a: Arena, p: 0 | 1 = 0) => a.state.players[p].queue[0]!.cost.r;
const shieldLeft = (a: Arena, id: string) =>
  a.effects(id).reduce((n, e) => n + (e.defId === 'shield' || e.inline?.id === 'bargained_aegis' ? e.value : 0), 0);

/** Summons an Imp Notary for A1 on turn 1; returns at turn 3 with its id. */
function withImp(a: Arena): string {
  a.use(A1, 'companion.devil').end().pass(1);
  return minions(a, 0, 'imp_notary')[0]!.id;
}

describe('Devil keywords', () => {
  it('Hellfire: 5 Affliction at the end of its applier\'s turn, and it counts as Ignite and Horrified', () => {
    const a = arena({ p0: [['strike.devil']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 5 });
    a.use(A1, 'strike.devil', B1).end();
    expect(a.has(B1, 'hellfire')).toBe(true);
    expect([counts(a, B1, 'ignite'), counts(a, B1, 'horrified')]).toEqual([true, true]);
    expect(a.hp(B1)).toBe(100 - 0 - 5); // Armor stops the 25 hit, not the Affliction burn
  });

  it('Hellfire: the bearer can\'t gain Buffs while it lasts', () => {
    const a = arena({ p0: [['strike.devil']], p1: [['shot'], ['bless']] });
    a.use(A1, 'strike.devil', B1).end().use(B2, 'bless', B1).end();
    expect([a.has(B1, 'might'), a.has(B1, 'renew')]).toEqual([false, false]);
  });

  it('Hellfire: it doesn\'t burn on the enemy\'s turn, and it ends after its duration', () => {
    const a = arena({ p0: [['strike.devil']], p1: [['shot']] });
    a.use(A1, 'strike.devil', B1).end(); // Hellfire for 1 turn
    const hp = a.hp(B1);
    a.pass(1);
    expect(a.hp(B1)).toBe(hp);
    expect(a.has(B1, 'hellfire')).toBe(false);
    a.pass(1);
    expect(a.hp(B1)).toBe(hp);
  });

  it('Contract: the benefit comes now and the price is collected when it expires', () => {
    const a = arena({ p0: [['withstand.devil']], p1: [['shot']] });
    a.use(A1, 'withstand.devil').end();
    expect([contracts(a, A1), shieldLeft(a, A1)]).toEqual([1, 40]);
    a.pass(2);
    expect(a.hp(A1)).toBe(100);
    a.pass(1); // 2 turns: it expires at the end of turn 4
    expect([contracts(a, A1), a.hp(A1)]).toEqual([0, 60]);
  });

  it('Devil\'s Ledger: when a unit holding this character\'s Contract dies, the character gains 2 Soul Fragments', () => {
    const a = arena({ p0: [['bless.devil'], ['shot']], p1: [['shot']], passives: LEDGER });
    a.use(A1, 'bless.devil', A2).end();
    a.setHp(A2, 10).use(B1, 'shot', A2).end();
    expect([a.unit(A2).alive, sf(a, A1)]).toEqual([false, 2]);
  });

  it('Devil\'s Ledger: a Contract that ran out (not held at death) gives nothing', () => {
    const a = arena({ p0: [['bless.devil'], ['shot']], p1: [['shot']], passives: LEDGER });
    a.use(A1, 'bless.devil', A2).end().pass(4);
    expect(contracts(a, A2)).toBe(0);
    a.setHp(A2, 10).use(B1, 'shot', A2).end();
    expect(sf(a, A1)).toBe(0);
  });

  it('Devil\'s Ledger: Contracts from the Imp Notary\'s Offer don\'t count', () => {
    const a = arena({ p0: [['companion.devil'], ['shot']], p1: [['shot']], passives: LEDGER });
    const imp = withImp(a);
    a.use(imp, 'imp_notary_offer', B1).end().pass(1);
    expect(contracts(a, B1)).toBe(1);
    a.setHp(B1, 10).use(A2, 'shot', B1).end();
    expect([a.unit(B1).alive, sf(a, A1)]).toEqual([false, 0]);
  });

  it('Contract: forced on an enemy, it is Neutral, so Horrified doesn\'t stop it (Fine Print on a Hellfired enemy)', () => {
    const a = arena({ p0: [['trap.devil'], ['strike.devil']], p1: [['heal']] });
    a.use(A2, 'strike.devil', B1).use(A1, 'trap.devil', B1).end();
    a.use(B1, 'heal', B1).end();
    expect(contracts(a, B1)).toBe(1);
  });
});

describe('Devil skills', () => {
  it('Infernal Edge: 25 damage; an un-Hellfired target gains Hellfire for 1 turn', () => {
    const a = arena({ p0: [['strike.devil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.devil', B1).end();
    expect([a.hp(B1), a.has(B1, 'hellfire'), a.has(B2, 'hellfire')]).toEqual([70, true, false]);
  });

  it('Infernal Edge: a Hellfired target spreads it to a random ally of theirs for 1 turn', () => {
    const a = arena({ p0: [['strike.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'hellfire', { source: A2 }).use(A1, 'strike.devil', B1).end();
    expect([a.has(B1, 'hellfire'), a.has(B2, 'hellfire')]).toEqual([true, true]);
    a.pass(1);
    expect(a.has(B2, 'hellfire')).toBe(false); // 1 turn
  });

  it('Infernal Crush: 40 damage; for each Buff on the target, a random ally of theirs gains Hellfire for 2 turns', () => {
    const a = arena({ p0: [['smash.devil']], p1: [['shot'], ['shot']] });
    a.give(B1, 'swiftness');
    a.use(A1, 'smash.devil', B1).end();
    expect([a.hp(B1), a.has(B2, 'hellfire'), a.has(B1, 'hellfire')]).toEqual([60, true, false]);
    a.pass(3);
    expect(a.has(B2, 'hellfire')).toBe(false);
  });

  it('Infernal Crush: no Buffs, no Hellfire', () => {
    const a = arena({ p0: [['smash.devil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'smash.devil', B1).end();
    expect([a.hp(B1), a.has(B2, 'hellfire')]).toEqual([60, false]);
  });

  it('Hellbent: free; the user loses 15 HP, deals 25, and gains 2 Focus for their next skill', () => {
    const a = arena({ p0: [['charge.devil', 'channel.devil']], p1: [['shot']] });
    expect(formatCost(content.skills['charge.devil']!.cost)).toBe('nc');
    a.use(A1, 'charge.devil', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 75]);
    a.pass(1).use(A1, 'channel.devil', B1);
    expect(queuedR(a)).toBe(0); // rr − 2
  });

  it('Devil\'s Due: counters every Harmful skill on the user for 1 turn; an attacker with Buffs hands over a random one, one without takes 15 Affliction', () => {
    const a = arena({ p0: [['riposte.devil'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    expect(content.skills['riposte.devil']!.tags).toContain('Invisible');
    a.give(B1, 'might', { stacks: 2 }).give(B1, 'armor', { stacks: 1 });
    a.use(A1, 'riposte.devil').end();
    a.use(B1, 'shot', A1).use(B3, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 85]); // B1's shot is countered; B3's, on A2, isn't
    // One of B1's two Buffs (the whole effect, stacks and all) moves to the user; the other stays.
    const moved = [a.has(A1, 'might'), a.has(A1, 'armor')];
    expect(moved.filter(Boolean)).toHaveLength(1);
    expect([a.has(B1, 'might'), a.has(B1, 'armor')]).toEqual(moved.map((m) => !m));
    if (moved[0]) expect(a.stacks(A1, 'might')).toBe(2);
    expect([a.hp(B1), a.hp(B3)]).toEqual([100, 100]);
    const b = arena({ p0: [['riposte.devil'], ['shot']], p1: [['shot'], ['shot']] });
    b.give(B2, 'armor', { stacks: 3 });
    b.use(A1, 'riposte.devil').end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([b.hp(A1), b.hp(B1), b.hp(B2), b.stacks(A1, 'armor')]).toEqual([100, 85, 100, 3]);
  });

  it('Devil\'s Due: it lasts 1 turn', () => {
    const a = arena({ p0: [['riposte.devil'], ['shot']], p1: [['shot']] });
    a.use(A1, 'riposte.devil').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([85, 100]);
  });

  it('Faustian Fury: a 3-turn Contract — 2 Might, Flameborn and Immortal now', () => {
    const a = arena({ p0: [['rage.devil']], p1: [['strike']] });
    a.use(A1, 'rage.devil').end();
    expect(contracts(a, A1)).toBe(1);
    expect([a.stacks(A1, 'might'), counts(a, A1, 'flameborn'), counts(a, A1, 'immortal')]).toEqual([2, true, true]);
    a.setHp(A1, 10).use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(5);
  });

  it('Faustian Fury: the price, when it expires, is 30 Affliction and Horrified for 2 turns', () => {
    const a = arena({ p0: [['rage.devil']], p1: [['shot']] });
    a.use(A1, 'rage.devil').end().pass(4);
    expect(a.hp(A1)).toBe(100);
    a.pass(1); // 3 turns: the end of turn 6
    expect([a.hp(A1), counts(a, A1, 'horrified'), contracts(a, A1)]).toEqual([70, true, 0]);
  });

  it('Faustian Fury: the price\'s Horrified lasts 2 turns', () => {
    const a = arena({ p0: [['rage.devil']], p1: [['shot']] });
    a.use(A1, 'rage.devil').end().pass(5);
    expect(counts(a, A1, 'horrified')).toBe(true);
    a.pass(4);
    expect(counts(a, A1, 'horrified')).toBe(false);
  });

  it('Infernal Coin: 15 damage; an Ignite on the target becomes Hellfire for 2 turns', () => {
    const a = arena({ p0: [['shot.devil']], p1: [['shot']] });
    a.give(B1, 'ignite', { source: B1 });
    a.use(A1, 'shot.devil', B1).end();
    expect([a.has(B1, 'ignite'), a.has(B1, 'hellfire')]).toEqual([false, true]);
    expect(a.hp(B1)).toBe(80); // 15 + its first burn
    a.pass(3);
    expect(a.has(B1, 'hellfire')).toBe(false);
  });

  it('Infernal Coin: no Ignite, no Hellfire and no fragment', () => {
    const a = arena({ p0: [['shot.devil']], p1: [['shot']] });
    a.use(A1, 'shot.devil', B1).end();
    expect([a.hp(B1), a.has(B1, 'hellfire'), sf(a, A1)]).toEqual([85, false, 0]);
  });

  it('Infernal Coin: if the target already had Hellfire, the user gains 1 Soul Fragment', () => {
    const a = arena({ p0: [['shot.devil'], ['strike.devil']], p1: [['shot']] });
    a.use(A2, 'strike.devil', B1).use(A1, 'shot.devil', B1).end();
    expect(sf(a, A1)).toBe(1);
  });

  it('Collection Day: 40 damage on the following turn', () => {
    const a = arena({ p0: [['snipe.devil']], p1: [['shot']] });
    expect(content.skills['snipe.devil']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    a.use(A1, 'snipe.devil', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1);
    expect(a.hp(B1)).toBe(60);
  });

  it('Collection Day: a Contract on the target has its price collected now, doubled (and not again later)', () => {
    const a = arena({ p0: [['companion.devil'], ['snipe.devil']], p1: [['shot']] });
    const imp = withImp(a);
    a.use(imp, 'imp_notary_offer', B1).use(A2, 'snipe.devil', B1).end().pass(1);
    expect([a.hp(B1), contracts(a, B1)]).toEqual([100 - 40 - 20, 0]);
    a.pass(4);
    expect(a.hp(B1)).toBe(40);
  });

  it('Fine Print: if the target uses any skill within 1 turn, they\'re bound by a Contract: 1 Swiftness now', () => {
    const a = arena({ p0: [['trap.devil']], p1: [['heal'], ['shot']] });
    expect(content.skills['trap.devil']!.tags).toContain('Invisible');
    a.use(A1, 'trap.devil', B1).end().use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    expect([contracts(a, B1), a.stacks(B1, 'swiftness'), contracts(a, B2)]).toEqual([1, 1, 0]);
  });

  it('Fine Print: the price (when the 2 turns are up) is a 1-turn Stun and 2 Weakness', () => {
    const a = arena({ p0: [['trap.devil']], p1: [['heal']] });
    a.use(A1, 'trap.devil', B1).end().use(B1, 'heal', B1).end();
    a.pass(4); // the Contract (taken on turn 2) expires at the end of turn 6
    expect([contracts(a, B1), a.stacks(B1, 'weakness')]).toEqual([0, 2]);
    a.pass(1); // turn 8: B1 can't act
    expect(a.reject(() => a.use(B1, 'heal', B1))).toBe('cannot_act');
  });

  it('Fine Print: no skill used, no Contract; it lasts only 1 turn', () => {
    const a = arena({ p0: [['trap.devil']], p1: [['heal']] });
    a.use(A1, 'trap.devil', B1).end().pass(2).use(B1, 'heal', B1).end();
    expect(contracts(a, B1)).toBe(0);
  });

  it('Put It on My Tab: for 1 turn, each hit on the user goes on their tab instead, each as its own Contract', () => {
    const a = arena({ p0: [['maneuver.devil'], ['shot']], p1: [['strike'], ['shot']] });
    expect(content.skills['maneuver.devil']!.tags).toContain('Invisible');
    a.use(A1, 'maneuver.devil').end();
    a.use(B1, 'strike', A1).use(B2, 'shot', A1).end(); // 20 + 15, both held
    expect([a.hp(A1), tabs(a, A1)]).toEqual([100, 2]);
    expect(content.statuses['devils_tab']!.countsAs).toContain('contract');
  });

  it('Put It on My Tab: the price, at the end of the user\'s next turn, is half of each hit as Affliction', () => {
    const a = arena({ p0: [['maneuver.devil'], ['shot']], p1: [['strike'], ['shot']] });
    a.give(A1, 'armor', { stacks: 5 }); // Affliction ignores Armor
    a.use(A1, 'maneuver.devil').end();
    a.use(B1, 'strike', A1).use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    a.pass(1); // the end of the user's next turn: 10 + 7
    expect([a.hp(A1), tabs(a, A1)]).toEqual([83, 0]);
  });

  it('Put It on My Tab: it lasts 1 turn; later hits land as normal', () => {
    const a = arena({ p0: [['maneuver.devil'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.devil').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), tabs(a, A1)]).toEqual([85, 0]);
  });

  it('Put It on My Tab: Hellfire on the user (no Buffs) doesn\'t stop the tab', () => {
    const a = arena({ p0: [['maneuver.devil'], ['shot']], p1: [['shot']] });
    a.give(A1, 'hellfire', { source: B1, duration: 4 });
    a.use(A1, 'maneuver.devil').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), tabs(a, A1)]).toEqual([100, 2]); // the shot and B1's Hellfire burn are both held
  });

  it('Imp Notary: a permanent 25 HP minion', () => {
    const a = arena({ p0: [['companion.devil']], p1: [['shot']] });
    const imp = withImp(a);
    expect(a.hp(imp)).toBe(25);
    a.pass(10);
    expect(a.unit(imp).alive).toBe(true);
  });

  it('Imp Notary / Offer: a 2-turn Contract — 1 Might now; price 10 Affliction', () => {
    const a = arena({ p0: [['companion.devil'], ['shot']], p1: [['shot']] });
    const imp = withImp(a);
    a.use(imp, 'imp_notary_offer', A2).end();
    expect([contracts(a, A2), a.stacks(A2, 'might')]).toEqual([1, 1]);
    a.pass(2);
    expect(a.hp(A2)).toBe(100);
    a.pass(1);
    expect([contracts(a, A2), a.hp(A2)]).toEqual([0, 90]);
  });

  it('Imp Notary / Sealing Wax: 10 Affliction; Hellfire for 1 turn only on a Contract holder', () => {
    const a = arena({ p0: [['companion.devil']], p1: [['shot'], ['shot']] });
    const imp = withImp(a);
    a.give(B1, 'armor', { stacks: 4 });
    a.use(imp, 'imp_notary_sealing_wax', B1).end();
    expect([a.hp(B1), a.has(B1, 'hellfire')]).toEqual([90, false]);
    const b = arena({ p0: [['companion.devil']], p1: [['shot'], ['shot']] });
    const imp2 = withImp(b);
    b.use(imp2, 'imp_notary_offer', B2).end().pass(1).use(imp2, 'imp_notary_sealing_wax', B2).end();
    expect(b.has(B2, 'hellfire')).toBe(true);
    b.pass(1);
    expect(b.has(B2, 'hellfire')).toBe(false); // 1 turn
  });

  it('Borrowed Fire: 35 damage on credit — a 2-turn Contract whose price is 15 Affliction', () => {
    const a = arena({ p0: [['bolt.devil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'armor', { stacks: 3 });
    a.use(A1, 'bolt.devil', B1).end();
    expect([a.hp(B1), contracts(a, A1)]).toEqual([65, 1]);
    a.pass(2);
    expect(a.hp(A1)).toBe(100);
    a.pass(1); // the end of turn 4
    expect([a.hp(A1), contracts(a, A1)]).toEqual([85, 0]);
  });

  it('Borrowed Fire: the price is waived if that enemy has died by then', () => {
    const a = arena({ p0: [['bolt.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'bolt.devil', B1).end().pass(1);
    a.setHp(B1, 10).use(A2, 'shot', B1).end().pass(1);
    expect([a.unit(B1).alive, contracts(a, A1), a.hp(A1)]).toEqual([false, 0, 100]);
  });

  it('Borrowed Fire: a Horrified user still owes the price', () => {
    const a = arena({ p0: [['bolt.devil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'horrified', { source: B1 }).use(A1, 'bolt.devil', B1).end().pass(3);
    expect(a.hp(A1)).toBe(85);
  });

  it('Hellstorm: 20 to all enemies; with no fragments, no Hellfire', () => {
    const a = arena({ p0: [['blast.devil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.devil').end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'hellfire')]).toEqual([80, 80, false]);
  });

  it('Hellstorm: spends all Soul Fragments (up to 3); every enemy gains Hellfire for 1 turn per fragment', () => {
    const a = arena({ p0: [['blast.devil']], p1: [['shot'], ['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 });
    a.use(A1, 'blast.devil').end();
    expect([sf(a, A1), a.has(B1, 'hellfire'), a.has(B2, 'hellfire')]).toEqual([0, true, true]);
    a.pass(2);
    expect(a.has(B1, 'hellfire')).toBe(true); // 2 turns
    a.pass(1);
    expect(a.has(B1, 'hellfire')).toBe(false);
  });

  it('Hellstorm: at most 3 fragments are spent', () => {
    const a = arena({ p0: [['blast.devil']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 5 });
    a.use(A1, 'blast.devil').end();
    expect(sf(a, A1)).toBe(2);
    a.pass(4);
    expect(a.has(B1, 'hellfire')).toBe(true); // 3 turns
    a.pass(1);
    expect(a.has(B1, 'hellfire')).toBe(false);
  });

  it('Collect: 5 damage, and the target is put in debt to the user (a Contract)', () => {
    const a = arena({ p0: [['consume.devil']], p1: [['shot']] });
    a.use(A1, 'consume.devil', B1).end();
    expect([a.hp(B1), contracts(a, B1), counts(a, B1, 'contract'), sf(a, A1)]).toEqual([95, 1, true, 0]);
  });

  it('Collect: the debt lasts 2 turns; its price is 20 Affliction damage, and the user heals as much', () => {
    const a = arena({ p0: [['consume.devil']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 3 });
    a.setHp(A1, 50).use(A1, 'consume.devil', B1).end().pass(2);
    expect([contracts(a, B1), a.hp(B1), a.hp(A1)]).toEqual([1, 100, 50]); // the Armor stopped the hit
    a.pass(1);
    expect([contracts(a, B1), a.hp(B1), a.hp(A1)]).toEqual([0, 80, 70]);
  });

  it('Collect: the user heals only what the price deals', () => {
    const a = arena({ p0: [['consume.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'consume.devil', B1).end().pass(1);
    a.setHp(B1, 10).pass(2); // the price comes due at the end of turn 4
    expect([a.unit(B1).alive, a.hp(A1)]).toEqual([false, 60]);
  });

  it('Collect: a Horrified (Hellfired) enemy still takes the debt', () => {
    const a = arena({ p0: [['consume.devil'], ['strike.devil']], p1: [['shot']] });
    a.use(A2, 'strike.devil', B1).use(A1, 'consume.devil', B1).end();
    expect(contracts(a, B1)).toBe(1);
  });

  it('Imp Captain: 25 HP for 3 turns; Ember Whip deals 10', () => {
    const a = arena({ p0: [['summon.devil']], p1: [['shot']] });
    a.use(A1, 'summon.devil').end().pass(1);
    const cap = minions(a, 0, 'imp_captain')[0]!;
    expect(cap.hp).toBe(25);
    a.use(cap.id, 'imp_captain_ember_whip', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(3);
    expect(a.unit(cap.id).alive).toBe(false);
  });

  it('Imp Captain: its hits deal 5 more per Soul Fragment of the user, without spending them', () => {
    const a = arena({ p0: [['summon.devil']], p1: [['shot']] });
    a.use(A1, 'summon.devil').end().pass(1);
    a.give(A1, 'soul_fragment', { stacks: 2 });
    a.use(minions(a, 0, 'imp_captain')[0]!.id, 'imp_captain_ember_whip', B1).end();
    expect([a.hp(B1), sf(a, A1)]).toEqual([80, 2]);
  });

  it('Soulburn: the target has Hellfire, and at the end of each of the user\'s turns it burns them for 10 more Affliction', () => {
    const a = arena({ p0: [['channel.devil']], p1: [['shot'], ['bless']] });
    expect(content.skills['channel.devil']!.tags).toContain('Channeled');
    a.give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'channel.devil', B1).end();
    expect([a.has(B1, 'hellfire'), a.hp(B1), a.hp(B2)]).toEqual([true, 85, 100]); // 5 burn + 10 more
    a.use(B2, 'bless', B1).end();
    expect([a.hp(B1), a.has(B1, 'might')]).toEqual([85, false]); // not on the enemy's turn; no Buffs
  });

  it('Soulburn: it burns up to 3 turns, then the Hellfire goes out with it', () => {
    const a = arena({ p0: [['channel.devil']], p1: [['shot']] });
    a.use(A1, 'channel.devil', B1).end().pass(3);
    expect([a.hp(B1), a.has(B1, 'hellfire')]).toEqual([70, true]);
    a.pass(1); // the end of the user's third turn
    expect([a.hp(B1), a.has(B1, 'hellfire')]).toEqual([55, false]);
    a.pass(2);
    expect(a.hp(B1)).toBe(55);
  });

  it('Soulburn: broken early, it stops burning and the Hellfire ends', () => {
    const a = arena({ p0: [['channel.devil']], p1: [['stun']] });
    a.use(A1, 'channel.devil', B1).end().use(B1, 'stun', A1).end();
    expect(a.has(B1, 'hellfire')).toBe(false);
    a.pass(4);
    expect(a.hp(B1)).toBe(85);
  });

  it('Pitchfork: 10 damage, and a random Buff of the target\'s burns away', () => {
    const a = arena({ p0: [['stab.devil']], p1: [['shot']] });
    a.give(B1, 'might').give(B1, 'swiftness').use(A1, 'stab.devil', B1).end();
    expect([a.hp(B1), Number(a.has(B1, 'might')) + Number(a.has(B1, 'swiftness'))]).toEqual([90, 1]);
  });

  it('Pitchfork: against a target with no Buffs, 20 damage', () => {
    const a = arena({ p0: [['stab.devil']], p1: [['shot']] });
    a.use(A1, 'stab.devil', B1).end();
    expect(a.hp(B1)).toBe(80);
  });

  it('Hellraze: 35 Piercing; the target\'s Buffs become a Contract: kept 1 turn, then 10 Affliction per Buff', () => {
    const a = arena({ p0: [['ravage.devil']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 1 }).give(B1, 'swiftness');
    a.use(A1, 'ravage.devil', B1).end();
    expect([a.hp(B1), contracts(a, B1), a.has(B1, 'armor'), a.has(B1, 'swiftness')]).toEqual([65, 1, true, true]);
    a.pass(1);
    expect([a.hp(B1), contracts(a, B1)]).toEqual([45, 0]);
  });

  it('Hellraze: the converted Buffs are gone once the Contract ends', () => {
    const a = arena({ p0: [['ravage.devil']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 1 }).give(B1, 'swiftness');
    a.use(A1, 'ravage.devil', B1).end().pass(1);
    expect([a.has(B1, 'armor'), a.has(B1, 'swiftness')]).toEqual([false, false]);
  });

  it('Hellraze: no Buffs, no Contract', () => {
    const a = arena({ p0: [['ravage.devil']], p1: [['shot']] });
    a.use(A1, 'ravage.devil', B1).end().pass(2);
    expect([a.hp(B1), contracts(a, B1)]).toEqual([65, 0]);
  });

  it('Soul Snare: counters the target\'s Harmful skill; a fragment per Ignite and Scorch they carry', () => {
    const a = arena({ p0: [['mislead.devil']], p1: [['shot']] });
    expect(content.skills['mislead.devil']!.tags).toContain('Invisible');
    a.give(B1, 'ignite', { source: B1 }).give(B1, 'scorched', { source: A1 });
    a.use(A1, 'mislead.devil', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), sf(a, A1)]).toEqual([100, 2]);
  });

  it('Soul Snare: a clean attacker is countered for no fragments; Helpful skills pass', () => {
    const a = arena({ p0: [['mislead.devil']], p1: [['shot']] });
    a.use(A1, 'mislead.devil', B1).end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), sf(a, A1)]).toEqual([100, 0]);
    const b = arena({ p0: [['mislead.devil']], p1: [['heal']] });
    b.setHp(B1, 50).give(B1, 'ignite', { source: B1 });
    b.use(A1, 'mislead.devil', B1).end().use(B1, 'heal', B1).end();
    expect([b.hp(B1), sf(b, A1)]).toEqual([70, 0]);
  });

  it('Hellbound: 10 damage, and the target gains Hellfire for 1 turn, Stunned while it lasts', () => {
    const a = arena({ p0: [['stun.devil']], p1: [['shot']] });
    a.use(A1, 'stun.devil', B1).end();
    expect([a.hp(B1), a.has(B1, 'hellfire')]).toEqual([85, true]); // 10 + its burn
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
    expect(a.has(B1, 'hellfire')).toBe(false);
    a.use(B1, 'shot', A1); // the Hellfire's gone, so they act
  });

  it('Hellbound: Swiftness doesn\'t stop it', () => {
    const a = arena({ p0: [['stun.devil']], p1: [['shot']] });
    a.give(B1, 'swiftness').use(A1, 'stun.devil', B1).end();
    expect([a.reject(() => a.use(B1, 'shot', A1)), a.stacks(B1, 'swiftness')]).toEqual(['cannot_act', 1]);
  });

  it('Hellbound: never on two of their turns in a row — Hellfire right after a Hellbound turn doesn\'t Stun them', () => {
    const a = arena({ p0: [['stun.devil', 'strike.devil']], p1: [['shot']] });
    a.use(A1, 'stun.devil', B1).end().pass(1);
    a.use(A1, 'strike.devil', B1).end(); // Hellfire again on turn 3
    expect(a.has(B1, 'hellfire')).toBe(true);
    a.use(B1, 'shot', A1).end(); // turn 4: free
    expect(a.hp(A1)).toBe(85);
  });

  it('Hellbound: within the 3 turns, Hellfire after a free turn Stuns them again', () => {
    const a = arena({ p0: [['stun.devil', 'strike.devil']], p1: [['shot']] });
    a.use(A1, 'stun.devil', B1).end().pass(3); // turn 4 is free (no Hellfire)
    a.use(A1, 'strike.devil', B1).end(); // turn 5
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Hellbound: after the 3 turns, Hellfire no longer Stuns them', () => {
    const a = arena({ p0: [['stun.devil', 'strike.devil']], p1: [['shot']] });
    a.use(A1, 'stun.devil', B1).end().pass(5);
    a.use(A1, 'strike.devil', B1).end(); // turn 7
    expect(a.has(B1, 'hellfire')).toBe(true);
    a.use(B1, 'shot', A1);
  });

  it('Dance with the Devil: 1 Swiftness and 1 Focus', () => {
    const a = arena({ p0: [['dance.devil']], p1: [['shot']] });
    a.use(A1, 'dance.devil').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
  });

  it('Dance with the Devil: the user\'s Ignites also burn at the start of each of their turns', () => {
    const a = arena({ p0: [['dance.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.devil').end();
    a.give(B1, 'ignite', { source: A1 }).give(B2, 'ignite', { source: A2 }); // B2's is an ally's, not the user's
    a.end(); // turn 3 starts
    expect([a.hp(B1), a.hp(B2)]).toEqual([95, 100]);
    a.end();
    expect(a.hp(B1)).toBe(90);
  });

  it('Dance with the Devil: without it, Ignites burn only at the end of the applier\'s turn', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.pass(1).give(B1, 'ignite', { source: A1 }).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Fair Trade: the ally and the enemy with the most HP are set to the average of the two', () => {
    const a = arena({ p0: [['heal.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 40).setHp(B2, 80).use(A1, 'heal.devil', A2).end();
    expect([a.hp(A2), a.hp(B1), a.hp(B2)]).toEqual([70, 70, 80]);
  });

  it('Fair Trade: the transfer ignores modifiers (a Scorched ally still gets the full amount)', () => {
    const a = arena({ p0: [['heal.devil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40).give(A2, 'scorched', { source: B1 }).use(A1, 'heal.devil', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([70, 70]);
  });

  it('Fair Trade: nothing happens if the enemy has less HP than the ally', () => {
    const a = arena({ p0: [['heal.devil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 60).setHp(B1, 40).use(A1, 'heal.devil', A2).end();
    expect([a.hp(A2), a.hp(B1)]).toEqual([60, 40]);
  });

  it('Pact of Flame: a 2-turn Contract — Lifesteal now; price 20 Affliction', () => {
    const a = arena({ p0: [['bless.devil'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.devil', A2).end();
    expect([contracts(a, A2), counts(a, A2, 'lifesteal')]).toEqual([1, true]);
    a.pass(3);
    expect([contracts(a, A2), a.hp(A2)]).toEqual([0, 80]);
  });

  it('Pact of Flame: the price is reduced by the HP healed meanwhile (Lifesteal included)', () => {
    const a = arena({ p0: [['bless.devil'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless.devil', A2).use(A2, 'shot', B1).end(); // steals 15
    expect(a.hp(A2)).toBe(65);
    a.pass(3);
    expect(a.hp(A2)).toBe(60); // 20 − 15
  });

  it('Double or Nothing: target enemy gains Hellfire for 1 turn, then a coin: heads — each Debuff gains 1 stack and lasts 2 turns longer; tails — the user gains 1 Soul Fragment', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['curse.devil']], p1: [['shot']], seed });
      a.give(B1, 'weakness', { source: A1, duration: 6 }).give(B1, 'vulnerable', { source: A1, duration: 6 });
      a.use(A1, 'curse.devil', B1).end();
      expect(a.has(B1, 'hellfire')).toBe(true);
      const w = a.effects(B1).filter((e) => e.defId === 'weakness');
      const hf = a.effects(B1).find((e) => e.defId === 'hellfire')!;
      if (sf(a, A1) === 1) {
        seen.add('tails');
        expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable')]).toEqual([1, 1]);
        expect(hf.duration).toBe(1); // 1 turn: the enemy's next turn
      } else {
        seen.add('heads');
        expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable'), sf(a, A1)]).toEqual([2, 2, 0]);
        // 6, minus the end of turn 1, plus 2 turns (4 ticks).
        expect(Math.max(...w.map((e) => e.duration!))).toBe(6 - 1 + 4);
        expect(hf.duration).toBe(1 + 4); // its own Hellfire lasts 3 turns
      }
    }
    expect([...seen].sort()).toEqual(['heads', 'tails']);
  });

  it('Double or Nothing: on a target with no Debuffs, heads still stretches its own Hellfire', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['curse.devil']], p1: [['shot']], seed });
      a.use(A1, 'curse.devil', B1).end().pass(2);
      seen.add(a.has(B1, 'hellfire') ? 'heads' : 'tails');
      expect(a.has(B1, 'hellfire')).toBe(sf(a, A1) === 0);
    }
    expect([...seen].sort()).toEqual(['heads', 'tails']);
  });

  it('Price on Their Head: 20 damage; if they die within 2 turns, the killer\'s cooldowns reset and the user\'s player gains 1 energy', () => {
    const run = (b1hp: number) => {
      const a = arena({ p0: [['smite.devil'], ['smash']], p1: [['shot'], ['shot']], passives: LEDGER });
      a.setHp(B1, b1hp).use(A1, 'smite.devil', B1).use(A2, 'smash', B1).end();
      return a;
    };
    const kill = run(40);
    const live = run(100);
    expect(kill.unit(B1).alive).toBe(false);
    expect(live.unit(B1).alive).toBe(true);
    expect([kill.cooldown(A2, 'smash'), live.cooldown(A2, 'smash') > 0]).toEqual([0, true]);
    expect(energy(kill, 0) - energy(live, 0)).toBe(1);
  });

  it('Price on Their Head: a death after the 2 turns gives nothing', () => {
    const a = arena({ p0: [['smite.devil'], ['smash']], p1: [['shot']], passives: LEDGER });
    a.use(A1, 'smite.devil', B1).end().pass(3); // turn 5: the 2 turns are over
    a.setHp(B1, 10).use(A2, 'smash', B1).end();
    expect([a.unit(B1).alive, a.cooldown(A2, 'smash') > 0]).toEqual([false, true]);
  });

  it('Choir of the Pit: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.devil'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.devil').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([70, 70]);
  });

  it('Choir of the Pit: all enemies are Horrified for 1 turn', () => {
    const a = arena({ p0: [['prayer.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'prayer.devil').end();
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([true, true]);
    a.pass(1);
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([false, false]);
  });

  it('Choir of the Pit: a Helpful skill used on a Horrified enemy fails and gives a random ally of the user 1 Might', () => {
    const a = arena({ p0: [['prayer.devil'], ['shot']], p1: [['shot'], ['bless']] });
    a.use(A1, 'prayer.devil').end().use(B2, 'bless', B1).end();
    expect(a.stacks(A1, 'might') + a.stacks(A2, 'might')).toBe(1);
    expect(a.has(B1, 'might')).toBe(false);
  });

  it('Choir of the Pit: once the Horrify is over, Helpful skills on enemies give nothing', () => {
    const a = arena({ p0: [['prayer.devil'], ['shot']], p1: [['shot'], ['bless']] });
    a.use(A1, 'prayer.devil').end().pass(2).use(B2, 'bless', B1).end();
    expect(a.stacks(A1, 'might') + a.stacks(A2, 'might')).toBe(0);
    expect(a.has(B1, 'might')).toBe(true);
  });

  it('Co-signed Debt: 20 to the target; a random other enemy co-signs a Contract (2 turns) whose price is half that hit, as Affliction', () => {
    const a = arena({ p0: [['cleave.devil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.devil', B1).end();
    expect([a.hp(B1), a.hp(B2), contracts(a, B2), contracts(a, B1)]).toEqual([80, 100, 1, 0]);
    a.pass(2);
    expect([a.hp(B2), contracts(a, B2)]).toEqual([100, 1]);
    a.pass(1); // due as the second enemy turn ends
    expect([a.hp(B2), contracts(a, B2)]).toEqual([90, 0]);
  });

  it('Co-signed Debt: every hit the target takes before the price is due adds half to it (rounded down to 5)', () => {
    const a = arena({ p0: [['cleave.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.devil', B1).use(A2, 'shot', B1).end().pass(1); // 35 so far
    a.use(A2, 'shot', B1).end().pass(1); // 50 in all
    expect([a.hp(B1), a.hp(B2)]).toEqual([50, 75]);
  });

  it('Co-signed Debt: with no other enemy, nobody co-signs', () => {
    const a = arena({ p0: [['cleave.devil']], p1: [['shot']] });
    a.use(A1, 'cleave.devil', B1).end();
    expect([a.hp(B1), contracts(a, B1)]).toEqual([80, 0]);
    a.pass(3);
    expect(a.hp(B1)).toBe(80);
  });

  it('Infernal Toll: for 2 turns, each skill an enemy uses deals them 5 Affliction per energy it cost', () => {
    const a = arena({ p0: [['shout.devil']], p1: [['strike', 'smash'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 });
    a.use(A1, 'shout.devil').end();
    a.use(B1, 'smash', A1).use(B2, 'shot', A1).end(); // Sr → 10; r → 5
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 95]);
    a.pass(1).use(B1, 'strike', A1).end(); // turn 4: S → 5
    expect(a.hp(B1)).toBe(85);
    a.pass(1).use(B2, 'shot', A1).end(); // turn 6: the 2 turns are over
    expect(a.hp(B2)).toBe(95);
  });

  it('Infernal Toll: a free skill costs nothing', () => {
    const a = arena({ p0: [['shout.devil']], p1: [['charge.devil']] });
    a.use(A1, 'shout.devil').end().use(B1, 'charge.devil', A1).end();
    expect(a.hp(B1)).toBe(85); // only Hellbent's own 15
  });

  it('Bargained Aegis: the price takes only the Shield that\'s left', () => {
    const a = arena({ p0: [['withstand.devil']], p1: [['shot']] });
    a.use(A1, 'withstand.devil').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), shieldLeft(a, A1)]).toEqual([100, 25]);
    a.pass(2);
    expect([a.hp(A1), shieldLeft(a, A1)]).toEqual([75, 0]);
  });

  it('Dare the Damned: Taunts target enemy for up to 3 turns', () => {
    const a = arena({ p0: [['taunt.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.devil', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.pass(4);
    expect(a.has(B1, 'taunt')).toBe(true); // nothing paid: still Taunted on turn 6
    a.pass(2);
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Dare the Damned: the Taunt ends once they\'ve dealt the user 30 damage in all', () => {
    const a = arena({ p0: [['taunt.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.devil', B1).end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(a.has(B1, 'taunt')).toBe(true); // 15 paid; B2's hit doesn't count for B1
    a.pass(1).use(B1, 'shot', A1).end(); // 30 paid
    expect(a.has(B1, 'taunt')).toBe(false);
    a.pass(1).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(85);
  });

  it('Dare the Damned: one big hit pays it off at once', () => {
    const a = arena({ p0: [['taunt.devil'], ['shot']], p1: [['smash.devil']] });
    a.use(A1, 'taunt.devil', B1).end().use(B1, 'smash.devil', A1).end(); // 40
    expect(a.has(B1, 'taunt')).toBe(false);
  });

  it('Archfiend: Immune and Lifesteal for 3 turns', () => {
    const a = arena({ p0: [['titan.devil'], ['shot']], p1: [['strike'], ['curse']] });
    a.use(A1, 'titan.devil').end();
    a.use(B1, 'strike', A1).use(B2, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion'), counts(a, A1, 'lifesteal')]).toEqual([80, false, true]);
    expect(a.has(B1, 'hellfire')).toBe(false); // it's who the user damages, not who damages them
    a.pass(4);
    expect([counts(a, A1, 'lifesteal'), a.has(A1, 'immune')]).toEqual([false, false]);
  });

  it('Archfiend: each enemy the user damages gains Hellfire for 1 turn (and the user steals its burn too)', () => {
    const a = arena({ p0: [['titan.devil', 'shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.devil').end().pass(1);
    a.setHp(A1, 50).use(A1, 'shot', B1).end();
    expect([a.has(B1, 'hellfire'), a.has(B2, 'hellfire')]).toEqual([true, false]);
    expect([a.hp(B1), a.hp(A1)]).toEqual([80, 70]); // 15 hit + 5 burn, all stolen
    a.pass(2);
    expect(a.has(B1, 'hellfire')).toBe(false);
  });
});

describe('Devil costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['S', 1], smash: ['SS', 3], charge: ['nc', 2], riposte: ['r', 3], rage: ['Sr', 4],
    shot: ['r', 1], snipe: ['AS', 2], trap: ['S', 3], maneuver: ['I', 2], companion: ['S', 1],
    bolt: ['Ir', 1], blast: ['SIr', 2], consume: ['S', 2], summon: ['S', 1], channel: ['rr', 3],
    stab: ['r', 0], ravage: ['AS', 2], mislead: ['r', 3], stun: ['AS', 3], dance: ['S', 2],
    heal: ['W', 3], bless: ['W', 2], curse: ['r', 2], smite: ['Sr', 1], prayer: ['Srr', 2],
    cleave: ['S', 1], shout: ['S', 3], withstand: ['r', 3], taunt: ['S', 3], titan: ['SW', 4],
  };
  const norm = (c: string) => (c === 'nc' ? c : [...c].sort((x, y) => 'SAIWr'.indexOf(x) - 'SAIWr'.indexOf(y)).join(''));
  it.each(Object.entries(kit))('%s.devil', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.devil`]!;
    expect([formatCost(s.cost), s.cooldown]).toEqual([norm(cost), cd]);
  });
  it('minion skills: Offer (I), Sealing Wax (r), Ember Whip (r)', () => {
    expect(['imp_notary_offer', 'imp_notary_sealing_wax', 'imp_captain_ember_whip'].map((id) => formatCost(content.skills[id]!.cost))).toEqual(['I', 'r', 'r']);
  });
});
