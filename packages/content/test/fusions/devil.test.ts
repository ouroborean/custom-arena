// Spec-driven tests for Devil (Fire + Unholy): Hellfire, Contracts, Devil's Ledger and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.18, and the fire-pairs.md kit table.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { formatCost } from '@arena/engine';
import { arena, content, type Arena } from '../harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const A3 = 'p0c2';
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
    const a = arena({ p0: [['bolt.devil']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 4 });
    a.use(A1, 'bolt.devil', B1).end();
    expect(a.has(B1, 'hellfire')).toBe(true);
    expect([counts(a, B1, 'ignite'), counts(a, B1, 'horrified')]).toEqual([true, true]);
    expect(a.hp(B1)).toBe(100 - 0 - 5); // Armor stops the 20 hit, not the Affliction burn
  });

  it('Hellfire: the bearer can\'t gain Buffs while it lasts', () => {
    const a = arena({ p0: [['bolt.devil']], p1: [['shot'], ['bless']] });
    a.use(A1, 'bolt.devil', B1).end().use(B2, 'bless', B1).end();
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
    const a = arena({ p0: [['trap.devil'], ['bolt.devil']], p1: [['heal']] });
    a.use(A2, 'bolt.devil', B1).use(A1, 'trap.devil', B1).end();
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
    const a = arena({ p0: [['strike.devil'], ['bolt.devil']], p1: [['shot'], ['shot']] });
    a.use(A2, 'bolt.devil', B1).end().pass(1).use(A1, 'strike.devil', B1).end();
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

  it('Devil\'s Due: counters every Harmful skill on the user for 1 turn; each attacker gains Hellfire, the user 1 Soul Fragment per counter', () => {
    const a = arena({ p0: [['riposte.devil'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    expect(content.skills['riposte.devil']!.tags).toContain('Invisible');
    a.use(A1, 'riposte.devil').end();
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).use(B3, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2), sf(a, A1)]).toEqual([100, 85, 2]);
    expect([a.has(B1, 'hellfire'), a.has(B2, 'hellfire'), a.has(B3, 'hellfire')]).toEqual([true, true, false]);
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

  // BUG: the price's "Horrified for 2 turns" (given as the Contract expires at the end of turn 6) lasts through
  // turn 11 — one turn too long, because it's applied after that turn's duration tick.
  it.fails('Faustian Fury: the price\'s Horrified lasts 2 turns', () => {
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
    const a = arena({ p0: [['shot.devil'], ['bolt.devil']], p1: [['shot']] });
    a.use(A2, 'bolt.devil', B1).use(A1, 'shot.devil', B1).end();
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

  it('Loophole: Invulnerable for 1 turn; each ally at or below 30 HP becomes Immortal for as long', () => {
    const a = arena({ p0: [['maneuver.devil'], ['shot'], ['shot']], p1: [['shot']] });
    expect(content.skills['maneuver.devil']!.tags).toContain('Invisible');
    a.setHp(A2, 30).setHp(A3, 31).use(A1, 'maneuver.devil').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    expect([counts(a, A2, 'immortal'), counts(a, A3, 'immortal')]).toEqual([true, false]);
    a.setHp(A2, 10).use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(5);
    expect(counts(a, A2, 'immortal')).toBe(false);
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

  it('Hellbolt: 20 damage and Hellfire for 2 turns', () => {
    const a = arena({ p0: [['bolt.devil']], p1: [['shot']] });
    a.use(A1, 'bolt.devil', B1).end();
    expect([a.hp(B1), a.has(B1, 'hellfire')]).toEqual([75, true]);
    a.pass(2);
    expect(a.has(B1, 'hellfire')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'hellfire')).toBe(false);
  });

  it('Hellbolt: each Helpful skill used on the Hellfired target gives the user 1 Soul Fragment', () => {
    const a = arena({ p0: [['bolt.devil']], p1: [['shot'], ['bless'], ['heal']] });
    a.use(A1, 'bolt.devil', B1).end().use(B2, 'bless', B1).use(B3, 'heal', B1).end();
    expect(sf(a, A1)).toBe(2);
    expect(a.has(B1, 'might')).toBe(false);
  });

  it('Hellbolt: Helpful skills on other enemies don\'t count', () => {
    const a = arena({ p0: [['bolt.devil']], p1: [['shot'], ['bless']] });
    a.use(A1, 'bolt.devil', B1).end().use(B2, 'bless', B2).end();
    expect(sf(a, A1)).toBe(0);
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

  it('Collect: 5 damage; a Contract on the target ends now, its price is collected and the user gains 2 Soul Fragments', () => {
    const a = arena({ p0: [['companion.devil', 'consume.devil']], p1: [['shot']] });
    const imp = withImp(a);
    a.use(imp, 'imp_notary_offer', B1).use(A1, 'consume.devil', B1).end();
    expect([a.hp(B1), contracts(a, B1), sf(a, A1)]).toEqual([85, 0, 2]);
  });

  it('Collect: no Contract, just 5 damage', () => {
    const a = arena({ p0: [['consume.devil']], p1: [['shot']] });
    a.use(A1, 'consume.devil', B1).end();
    expect([a.hp(B1), sf(a, A1)]).toEqual([95, 0]);
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

  it('Soulburn: at the end of the user\'s turns, 10 damage and Hellfire for 1 turn to the target; the user heals 15', () => {
    const a = arena({ p0: [['channel.devil']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 50).use(A1, 'channel.devil', B1).end();
    expect([a.hp(A1), a.has(B1, 'hellfire'), a.hp(B2)]).toEqual([65, true, 100]);
    expect(a.hp(B1)).toBeLessThanOrEqual(90);
  });

  it('Soulburn: lasts up to 3 of the user\'s turns', () => {
    const a = arena({ p0: [['channel.devil']], p1: [['shot']] });
    a.setHp(A1, 10).use(A1, 'channel.devil', B1).end().pass(4);
    expect(a.hp(A1)).toBe(55);
    a.pass(2);
    expect(a.hp(A1)).toBe(55);
  });

  it('Toasting Fork: 10 damage, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.devil']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60).use(A1, 'stab.devil', B1).end().pass(1).use(A1, 'stab.devil', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
  });

  it('Toasting Fork: for 2 turns the user heals 5 at the end of their turns while the target is Ignited (whoever lit it)', () => {
    const a = arena({ p0: [['stab.devil']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'ignite', { source: B1 });
    a.use(A1, 'stab.devil', B1).end();
    expect(a.hp(A1)).toBe(55);
    a.pass(2);
    expect(a.hp(A1)).toBe(60);
    a.pass(2);
    expect(a.hp(A1)).toBe(60); // over
  });

  it('Toasting Fork: no Ignite, no healing', () => {
    const a = arena({ p0: [['stab.devil']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'stab.devil', B1).end();
    expect(a.hp(A1)).toBe(50);
  });

  it('Hellraze: 35 Piercing; the target\'s Buffs become a Contract: kept 1 turn, then 10 Affliction per Buff', () => {
    const a = arena({ p0: [['ravage.devil']], p1: [['shot']] });
    a.give(B1, 'armor', { stacks: 1 }).give(B1, 'swiftness');
    a.use(A1, 'ravage.devil', B1).end();
    expect([a.hp(B1), contracts(a, B1), a.has(B1, 'armor'), a.has(B1, 'swiftness')]).toEqual([65, 1, true, true]);
    a.pass(1);
    expect([a.hp(B1), contracts(a, B1)]).toEqual([45, 0]);
  });

  // SPEC: "those [Buffs] become a Contract: they keep them for 1 turn, then pay" — read as the Buffs being lost
  // when the Contract ends; the implementation leaves them in place after the price is paid. Which is intended?
  it.fails('Hellraze: the converted Buffs are gone once the Contract ends', () => {
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

  it('Binding Clause: 10 damage and a 1-turn Stun', () => {
    const a = arena({ p0: [['stun.devil']], p1: [['shot']] });
    a.use(A1, 'stun.devil', B1).end();
    expect([a.hp(B1), a.reject(() => a.use(B1, 'shot', A1))]).toEqual([90, 'cannot_act']);
    a.pass(2);
    a.use(B1, 'shot', A1);
  });

  it('Binding Clause: 2 turns of Stun on a Contract holder', () => {
    const a = arena({ p0: [['companion.devil', 'stun.devil']], p1: [['shot']] });
    const imp = withImp(a);
    a.use(imp, 'imp_notary_offer', B1).use(A1, 'stun.devil', B1).end().pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.pass(2);
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

  it('Double or Nothing: heads — each Debuff gains 1 stack and lasts 2 turns longer; tails — all are removed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const a = arena({ p0: [['curse.devil']], p1: [['shot']], seed });
      a.give(B1, 'weakness', { source: A1, duration: 6 }).give(B1, 'vulnerable', { source: A1, duration: 6 });
      a.use(A1, 'curse.devil', B1).end();
      const w = a.effects(B1).filter((e) => e.defId === 'weakness');
      const v = a.effects(B1).filter((e) => e.defId === 'vulnerable');
      if (w.length === 0 && v.length === 0) {
        seen.add('tails');
      } else {
        seen.add('heads');
        expect([a.stacks(B1, 'weakness'), a.stacks(B1, 'vulnerable')]).toEqual([2, 2]);
        // 6, minus the end of turn 1, plus 2 turns (4 ticks).
        expect(Math.max(...w.map((e) => e.duration!))).toBe(6 - 1 + 4);
      }
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

  it('Choir of the Pit: for 2 turns, a Helpful skill used on a Horrified enemy gives a random ally of the user 1 Might', () => {
    const a = arena({ p0: [['prayer.devil'], ['shot']], p1: [['shot'], ['bless']] });
    a.give(B1, 'horrified', { source: A1 });
    a.use(A1, 'prayer.devil').end().use(B2, 'bless', B1).end();
    expect(a.stacks(A1, 'might') + a.stacks(A2, 'might')).toBe(1);
    expect(a.has(B1, 'might')).toBe(false);
  });

  it('Choir of the Pit: Helpful skills on un-Horrified enemies give nothing', () => {
    const a = arena({ p0: [['prayer.devil'], ['shot']], p1: [['shot'], ['bless']] });
    a.use(A1, 'prayer.devil').end().use(B2, 'bless', B1).end();
    expect(a.stacks(A1, 'might') + a.stacks(A2, 'might')).toBe(0);
  });

  it('Pyre Swing: 25 and 15; an enemy it kills Explodes (10 Affliction to every enemy)', () => {
    const a = arena({ p0: [['cleave.devil']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 15).use(A1, 'cleave.devil', B1).end();
    expect([a.unit(B2).alive, a.hp(B1)]).toEqual([false, 65]);
  });

  it('Pyre Swing: no kill, no Explosion', () => {
    const a = arena({ p0: [['cleave.devil']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.devil', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });

  it('Infernal Shriek: all enemies Intimidated for 2 turns; Hellfired ones twice, and the user gains a fragment for each', () => {
    const a = arena({ p0: [['shout.devil'], ['bolt.devil']], p1: [['shot'], ['shot']] });
    a.use(A2, 'bolt.devil', B1).use(A1, 'shout.devil').end();
    expect([a.stacks(B1, 'intimidated'), a.stacks(B2, 'intimidated'), sf(a, A1)]).toEqual([2, 1, 1]);
    a.pass(3);
    expect(a.has(B2, 'intimidated')).toBe(false);
  });

  it('Bargained Aegis: the price takes only the Shield that\'s left', () => {
    const a = arena({ p0: [['withstand.devil']], p1: [['shot']] });
    a.use(A1, 'withstand.devil').end().use(B1, 'shot', A1).end();
    expect([a.hp(A1), shieldLeft(a, A1)]).toEqual([100, 25]);
    a.pass(2);
    expect([a.hp(A1), shieldLeft(a, A1)]).toEqual([75, 0]);
  });

  it('Dare the Damned: Taunts for 2 turns; the user is Immortal until their next turn', () => {
    const a = arena({ p0: [['taunt.devil'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.devil', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    expect(counts(a, A1, 'immortal')).toBe(true);
    a.pass(1);
    expect(counts(a, A1, 'immortal')).toBe(false);
  });

  it('Dare the Damned: each hit Immortal stops from killing the user causes an Explosion', () => {
    const a = arena({ p0: [['taunt.devil'], ['shot']], p1: [['strike'], ['shot']] });
    a.setHp(A1, 10).use(A1, 'taunt.devil', B1).end();
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(5);
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
  });

  it('Dare the Damned: a hit that wouldn\'t kill causes no Explosion', () => {
    const a = arena({ p0: [['taunt.devil'], ['shot']], p1: [['strike'], ['shot']] });
    a.use(A1, 'taunt.devil', B1).end().use(B1, 'strike', A1).end();
    expect([a.hp(A1), a.hp(B1), a.hp(B2)]).toEqual([80, 100, 100]);
  });

  it('Archfiend: 2 Armor and Immune for 3 turns; enemies who damage the user gain Hellfire for 1 turn', () => {
    const a = arena({ p0: [['titan.devil'], ['shot']], p1: [['strike'], ['shot'], ['curse']] });
    a.use(A1, 'titan.devil').end();
    a.use(B1, 'strike', A1).use(B2, 'shot', A2).use(B3, 'curse', A1).end();
    expect([a.hp(A1), a.has(A1, 'confusion'), a.stacks(A1, 'armor')]).toEqual([90, false, 2]);
    expect([a.has(B1, 'hellfire'), a.has(B2, 'hellfire'), a.has(B3, 'hellfire')]).toEqual([true, false, false]);
    a.pass(4);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'immune')]).toEqual([0, false]);
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
