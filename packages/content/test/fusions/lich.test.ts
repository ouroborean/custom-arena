// Spec-driven scenarios for the Lich fusion (Ice + Unholy): Phylactery, Soulfrost and all 30 skills,
// written from the in-game descriptions and docs/rules.md §21.26.
// Units: A1..A3 = p0c0..p0c2 (player 1, odd turns), B1..B3 = p1c0..p1c2.
// Reminder: each Soul Fragment adds 5 to its holder's direct damage.

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
const jar = (a: Arena) => minions(a, 0, 'phylactery')[0];

const seenByFoe = (a: Arena, bearer: string) => viewFor(content, a.state, 1).effects.filter((e) => e.bearer === bearer);
const sf = (a: Arena, id: string) => a.stacks(id, 'soul_fragment');
// Soulfrost, or a skill's own variant that counts as Soulfrost (Winter of Souls, Heart of Ice).
const soulfrosted = (a: Arena, id: string) =>
  a.effects(id).some((e) => e.defId === 'soulfrost' || (e.inline?.countsAs ?? []).includes('soulfrost'));

const cost = (s: string) => {
  const c = { S: 0, A: 0, I: 0, W: 0, r: 0 };
  if (s !== 'nc') for (const ch of s) c[ch as keyof typeof c] += 1;
  return c;
};

describe('Lich keywords', () => {
  it('Soulfrost: direct damage to the bearer gives its applier a Soul Fragment, once per turn', () => {
    const a = arena({ p0: [['strike.lich'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'strike.lich', B1).use(A2, 'shot', B1).use(A3, 'shot', B1).end();
    expect([a.has(B1, 'soulfrost'), sf(a, A1), sf(a, A2)]).toEqual([true, 1, 0]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect(sf(a, A1)).toBe(2);
  });

  it('Soulfrost: the applying hit itself yields nothing, and it lasts 2 turns', () => {
    const a = arena({ p0: [['strike.lich'], ['shot']], p1: [['shot']] });
    a.use(A1, 'strike.lich', B1).end();
    expect(sf(a, A1)).toBe(0);
    a.pass(2);
    expect(a.has(B1, 'soulfrost')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'soulfrost')).toBe(false);
  });

  it('Soulfrost: indirect damage gives no Soul Fragment', () => {
    const a = arena({ p0: [['strike.lich'], ['channel']], p1: [['shot']] });
    a.use(A1, 'strike.lich', B1).end().pass(1).use(A2, 'channel').end();
    expect([a.hp(B1), sf(a, A1)]).toEqual([70, 0]);
  });

  it('Phylactery: a 30 HP minion with 2 Armor; while it stands, its creator’s HP can’t drop below 1', () => {
    const a = arena({ p0: [['maneuver.lich']], p1: [['shot'], ['strike']] });
    a.use(A1, 'maneuver.lich').end();
    const p = jar(a)!;
    expect([p.hp, p.maxHp, a.has(A1, 'phylactery_bond')]).toEqual([30, 30, true]);
    a.use(B1, 'shot', p.id).end();
    expect(a.unit(p.id).hp).toBe(25); // 15 − 10 Armor
    a.pass(1).setHp(A1, 10).use(B2, 'strike', A1).end();
    expect([a.hp(A1), a.unit(A1).alive]).toEqual([1, true]);
  });

  it('Phylactery: once it breaks, the creator can die again', () => {
    const a = arena({ p0: [['titan.lich'], ['shot']], p1: [['ravage'], ['strike']] });
    a.use(A1, 'titan.lich').end();
    const p = jar(a)!;
    a.setHp(A1, 10).setHp(p.id, 5).use(B1, 'ravage', p.id).use(B2, 'strike', A1).end();
    expect([a.unit(p.id).alive, a.has(A1, 'phylactery_bond'), a.unit(A1).alive]).toEqual([false, false, false]);
  });

  it('Phylactery: a Lich keeps one; creating another restores it to full instead', () => {
    const a = arena({ p0: [['maneuver.lich', 'titan.lich']], p1: [['shot']] });
    a.use(A1, 'maneuver.lich').end().pass(1);
    a.setHp(jar(a)!.id, 7).use(A1, 'titan.lich').end();
    expect(minions(a, 0, 'phylactery').map((m) => m.hp)).toEqual([30]);
  });
});

describe('Lich skills', () => {
  it('Deathchill Blade: 20 to the target; the lowest-HP enemy is Soulfrosted for 2 turns', () => {
    const a = arena({ p0: [['strike.lich']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50).use(A1, 'strike.lich', B1).end();
    expect([a.hp(B1), a.has(B1, 'soulfrost'), a.has(B2, 'soulfrost')]).toEqual([80, false, true]);
    a.pass(2);
    expect(a.has(B2, 'soulfrost')).toBe(true);
    a.pass(1);
    expect(a.has(B2, 'soulfrost')).toBe(false);
  });

  it('Winter of Souls: 35 and Soulfrost; each Soul Fragment it yields hits their allies for 10', () => {
    const a = arena({ p0: [['smash.lich'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.lich', B1).end();
    expect([a.hp(B1), a.hp(B2), soulfrosted(a, B1), sf(a, A1)]).toEqual([65, 100, true, 0]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3), sf(a, A1)]).toEqual([50, 90, 90, 1]);
  });

  it('Chill Stride: 15 damage, and the user Soulfrosts themselves for 2 turns (not the target)', () => {
    const a = arena({ p0: [['charge.lich']], p1: [['shot']] });
    a.use(A1, 'charge.lich', B1).end();
    expect([a.hp(B1), a.has(B1, 'soulfrost')]).toEqual([85, false]);
    expect(a.effects(A1).some((e) => e.defId === 'soulfrost' && e.source === A1)).toBe(true);
    a.pass(2);
    expect(a.has(A1, 'soulfrost')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'soulfrost')).toBe(false);
  });

  it('Chill Stride: meanwhile, enemy hits on the user give the user a Soul Fragment, once per turn', () => {
    const a = arena({ p0: [['charge.lich']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.lich', B1).end().use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(sf(a, A1)).toBe(1);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(sf(a, A1)).toBe(2);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(sf(a, A1)).toBe(2); // it's over
  });

  it('Hidden Vessel: Invisible; counters every Harmful skill on the user and Soulfrosts its user', () => {
    const a = arena({ p0: [['riposte.lich']], p1: [['shot'], ['shot']] });
    a.use(A1, 'riposte.lich').end();
    expect(seenByFoe(a, A1)).toEqual([]);
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'soulfrost'), a.has(B2, 'soulfrost')]).toEqual([100, true, true]);
  });

  it('Hidden Vessel: also guards allied minions such as the Phylactery', () => {
    const a = arena({ p0: [['riposte.lich', 'maneuver.lich']], p1: [['shot']] });
    a.use(A1, 'maneuver.lich').end().pass(1).use(A1, 'riposte.lich').end();
    const p = jar(a)!;
    a.use(B1, 'shot', p.id).end();
    expect([a.unit(p.id).hp, a.has(B1, 'soulfrost')]).toEqual([30, true]);
  });

  it('Hidden Vessel: lasts 1 turn and ignores Helpful skills', () => {
    const a = arena({ p0: [['riposte.lich']], p1: [['shot', 'heal']] });
    a.use(A1, 'riposte.lich').end().pass(2).use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'soulfrost')]).toEqual([85, false]);
  });

  it('Frozen Undeath: 1 Might (+5 damage) for every 25 HP the user is missing', () => {
    const a = arena({ p0: [['rage.lich', 'shot']], p1: [['shot'], ['shot']] });
    a.setHp(A1, 45).use(A1, 'rage.lich').end().pass(1).use(A1, 'shot', B1).end(); // 55 missing: 2
    expect(a.hp(B1)).toBe(75);
    a.pass(1).setHp(A1, 100).use(A1, 'shot', B2).end(); // none missing
    expect(a.hp(B2)).toBe(85);
  });

  it('Frozen Undeath: Immortal for 3 turns', () => {
    const a = arena({ p0: [['rage.lich']], p1: [['ravage']] });
    a.use(A1, 'rage.lich').end();
    expect(a.has(A1, 'immortal')).toBe(true);
    a.setHp(A1, 10).use(B1, 'ravage', A1).end();
    expect([a.hp(A1), a.unit(A1).alive]).toEqual([5, true]);
    a.pass(3);
    expect(a.has(A1, 'immortal')).toBe(true);
    a.pass(1);
    expect(a.has(A1, 'immortal')).toBe(false);
  });

  it('Soul Icicle: 15 without a Soul Fragment, and no Soulfrost', () => {
    const a = arena({ p0: [['shot.lich']], p1: [['shot']] });
    a.use(A1, 'shot.lich', B1).end();
    expect([a.hp(B1), a.has(B1, 'soulfrost')]).toEqual([85, false]);
  });

  it('Soul Icicle: spends one Soul Fragment for 10 more, and Soulfrosts the target', () => {
    const a = arena({ p0: [['shot.lich']], p1: [['shot']] });
    a.give(A1, 'soul_fragment', { stacks: 2 }).use(A1, 'shot.lich', B1).end();
    expect([a.hp(B1), a.has(B1, 'soulfrost'), sf(a, A1)]).toEqual([100 - 25 - 5, true, 1]); // the kept fragment adds 5
  });

  it("Death's Icicle: 40 Piercing on the following turn", () => {
    const a = arena({ p0: [['snipe.lich']], p1: [['shot'], ['shot']] });
    a.give(B1, 'armor', { stacks: 3 }).use(A1, 'snipe.lich', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.end();
    expect([a.hp(B1), jar(a)]).toEqual([60, undefined]);
  });

  it("Death's Icicle: a kill makes the victim's soul the user's Phylactery, or restores it to full", () => {
    const a = arena({ p0: [['snipe.lich']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B1, 30).use(A1, 'snipe.lich', B1).end().end();
    expect([a.unit(B1).alive, jar(a)?.hp]).toEqual([false, 30]);
    a.setHp(jar(a)!.id, 5).pass(4).setHp(B2, 30).use(A1, 'snipe.lich', B2).end().end();
    expect([a.unit(B2).alive, minions(a, 0, 'phylactery').map((m) => m.hp)]).toEqual([false, [30]]);
  });

  it('Frozen Shackle: Invisible; first Harmful skill: Soulfrost; second: also Stunned for 1 turn', () => {
    const a = arena({ p0: [['trap.lich']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap.lich', B1).end();
    expect(seenByFoe(a, B1)).toEqual([]);
    a.use(B1, 'heal', B1).end().pass(1);
    expect(a.has(B1, 'soulfrost')).toBe(false); // Helpful doesn't trip it
    a.use(B1, 'shot', A1).end();
    expect([a.has(B1, 'soulfrost'), a.has(B1, 'stun')]).toEqual([true, false]);
    a.pass(1).use(B1, 'shot', A1).end();
    expect(a.has(B1, 'stun')).toBe(true);
    a.pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Frozen Shackle: ends after 3 turns', () => {
    const a = arena({ p0: [['trap.lich']], p1: [['shot']] });
    a.use(A1, 'trap.lich', B1).end().pass(6).use(B1, 'shot', A1).end();
    expect(a.has(B1, 'soulfrost')).toBe(false);
  });

  it('Retreat to the Vessel: creates a Phylactery and makes the user Invulnerable', () => {
    const a = arena({ p0: [['maneuver.lich']], p1: [['shot']] });
    a.use(A1, 'maneuver.lich').end();
    expect(jar(a)).toBeDefined();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.pass(2).use(B1, 'shot', A1).end(); // up to 2 turns
    expect(a.hp(A1)).toBe(85);
  });

  it('Retreat to the Vessel: damage to the Phylactery ends the Invulnerability', () => {
    const a = arena({ p0: [['maneuver.lich']], p1: [['shot'], ['shot']] });
    a.use(A1, 'maneuver.lich').end();
    a.use(B1, 'shot', jar(a)!.id).end().pass(1);
    a.use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Retreat to the Vessel: an existing Phylactery is kept (no second one)', () => {
    const a = arena({ p0: [['maneuver.lich', 'titan.lich']], p1: [['shot']] });
    a.use(A1, 'titan.lich').end().pass(1).use(A1, 'maneuver.lich').end();
    expect(minions(a, 0, 'phylactery')).toHaveLength(1);
  });

  it('Frost Wight: 30 HP, permanent; Rime Claw deals 15 and Soulfrosts', () => {
    const a = arena({ p0: [['companion.lich']], p1: [['shot']] });
    a.use(A1, 'companion.lich').end().pass(9);
    const w = minions(a, 0, 'frost_wight')[0]!;
    expect(w.hp).toBe(30);
    a.use(w.id, 'frost_wight_rime_claw', B1).end();
    expect([a.hp(B1), a.has(B1, 'soulfrost')]).toEqual([85, true]);
  });

  it("Frost Wight: a killing hit spends one of the user's Soul Fragments instead, leaving it at 1 HP", () => {
    const a = arena({ p0: [['companion.lich']], p1: [['strike']] });
    a.use(A1, 'companion.lich').end();
    const w = minions(a, 0, 'frost_wight')[0]!;
    a.give(A1, 'soul_fragment', { stacks: 2 }).setHp(w.id, 10).use(B1, 'strike', w.id).end();
    expect([a.unit(w.id).alive, a.unit(w.id).hp, sf(a, A1)]).toEqual([true, 1, 1]);
  });

  it('Frost Wight: with no Soul Fragment, it dies; a non-lethal hit spends nothing', () => {
    const a = arena({ p0: [['companion.lich']], p1: [['strike'], ['shot']] });
    a.use(A1, 'companion.lich').end();
    const w = minions(a, 0, 'frost_wight')[0]!;
    a.give(A1, 'soul_fragment').use(B2, 'shot', w.id).end();
    expect([a.unit(w.id).hp, sf(a, A1)]).toEqual([15, 1]);
    const b = arena({ p0: [['companion.lich']], p1: [['strike']] });
    b.use(A1, 'companion.lich').end();
    const w2 = minions(b, 0, 'frost_wight')[0]!;
    b.setHp(w2.id, 10).use(B1, 'strike', w2.id).end();
    expect(b.unit(w2.id).alive).toBe(false);
  });

  it('Deathfrost Bolt: 25; all Swiftness and Focus lost, Horrified 1 turn per stack (max 3)', () => {
    const a = arena({ p0: [['bolt.lich'], ['bolt.lich']], p1: [['shot'], ['shot']] });
    a.give(B1, 'swiftness', { stacks: 2 }).give(B1, 'focus', { stacks: 2 }).give(B2, 'focus');
    a.use(A1, 'bolt.lich', B1).use(A2, 'bolt.lich', B2).end();
    expect([a.hp(B1), a.has(B1, 'swiftness'), a.has(B1, 'focus'), a.has(B2, 'focus')]).toEqual([75, false, false, false]);
    a.pass(1);
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([true, false]); // 3 turns vs 1
    a.pass(4);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Deathfrost Bolt: nothing to lose, no Horrified', () => {
    const a = arena({ p0: [['bolt.lich']], p1: [['shot']] });
    a.use(A1, 'bolt.lich', B1).end();
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Soul Blizzard: 25 to all enemies; those left below 50 HP are Soulfrosted', () => {
    const a = arena({ p0: [['blast.lich']], p1: [['shot'], ['shot'], ['shot']] });
    a.setHp(B2, 74).setHp(B3, 75);
    a.use(A1, 'blast.lich').end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([75, 49, 50]);
    expect([a.has(B1, 'soulfrost'), a.has(B2, 'soulfrost'), a.has(B3, 'soulfrost')]).toEqual([false, true, false]);
  });

  it('Soul Siphon: 5 and drains a Soul Fragment', () => {
    const a = arena({ p0: [['consume.lich']], p1: [['shot']] });
    a.use(A1, 'consume.lich', B1).end();
    expect([a.hp(B1), sf(a, A1)]).toEqual([95, 1]);
  });

  it('Soul Siphon: on a Soulfrosted target the Soulfrost ends and 1 more is drained', () => {
    const a = arena({ p0: [['consume.lich'], ['shot']], p1: [['shot']] });
    a.give(B1, 'soulfrost', { source: A2 }).use(A1, 'consume.lich', B1).end();
    expect([a.has(B1, 'soulfrost'), sf(a, A1)]).toEqual([false, 2]);
  });

  it("Skeletal Mage: 25 HP for 3 turns; Bone Chill deals 10", () => {
    const a = arena({ p0: [['summon.lich']], p1: [['shot']] });
    a.use(A1, 'summon.lich').end().pass(1);
    const m = minions(a, 0, 'skeletal_mage')[0]!;
    expect(m.hp).toBe(25);
    a.use(m.id, 'skeletal_mage_bone_chill', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(3);
    expect(minions(a, 0, 'skeletal_mage')).toHaveLength(0);
  });

  it("Skeletal Mage: while it stands, enemies' Frost debuffs don't count down", () => {
    const a = arena({ p0: [['summon.lich', 'charge.lich'], ['strike.ice']], p1: [['shot'], ['shot']] });
    a.use(A1, 'summon.lich').use(A2, 'strike.ice', B1).end(); // Frostbitten for 2 turns
    a.pass(3);
    expect(a.has(B1, 'frostbitten')).toBe(true); // would have ended by now
    const control = arena({ p0: [['shot'], ['strike.ice']], p1: [['shot']] });
    control.use(A2, 'strike.ice', B1).end().pass(3);
    expect(control.has(B1, 'frostbitten')).toBe(false);
  });

  it("Drain Warmth: 10 each user turn for 3 turns; with no Phylactery, one is created at 10 HP, then grows", () => {
    const a = arena({ p0: [['channel.lich']], p1: [['shot']] });
    a.use(A1, 'channel.lich', B1).end();
    expect([a.hp(B1), jar(a)?.hp, jar(a)?.maxHp]).toEqual([90, 10, 10]);
    a.pass(2);
    expect([a.hp(B1), jar(a)?.hp, jar(a)?.maxHp]).toEqual([80, 20, 20]);
    a.pass(2);
    expect([a.hp(B1), jar(a)?.hp, jar(a)?.maxHp]).toEqual([70, 30, 30]);
    a.pass(2);
    expect(a.hp(B1)).toBe(70);
  });

  it('Drain Warmth: an existing Phylactery gains 10 max HP and heals 10 per tick', () => {
    const a = arena({ p0: [['channel.lich', 'maneuver.lich']], p1: [['shot']] });
    a.use(A1, 'maneuver.lich').end().pass(1);
    a.setHp(jar(a)!.id, 5).use(A1, 'channel.lich', B1).end();
    expect([jar(a)?.hp, jar(a)?.maxHp]).toEqual([15, 40]);
  });

  it('Deathly Pallor: 10, or 20 at or below 60 HP; for 2 turns they can’t be healed above 60', () => {
    const a = arena({ p0: [['stab.lich'], ['stab.lich']], p1: [['heal'], ['heal']] });
    a.setHp(B2, 60).use(A1, 'stab.lich', B1).use(A2, 'stab.lich', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 40]);
    a.setHp(B1, 50).use(B1, 'heal', B1).use(B2, 'heal', B2).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([60, 60]);
  });

  it('Deathly Pallor: the cap ends after 2 turns', () => {
    const a = arena({ p0: [['stab.lich']], p1: [['heal']] });
    a.use(A1, 'stab.lich', B1).end().pass(4).setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });

  it('Doomfrost: 25 Piercing, +10 per Frost debuff; they end and Horrify 1 turn per debuff', () => {
    const a = arena({ p0: [['ravage.lich'], ['ravage.lich']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B1, 'chilled', { source: A1 }).give(B1, 'soulfrost', { source: A2 });
    a.use(A2, 'ravage.lich', B2).use(A1, 'ravage.lich', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([45, 75]);
    expect(['frostbitten', 'chilled', 'soulfrost'].some((k) => a.has(B1, k))).toBe(false);
    expect([a.has(B1, 'horrified'), a.has(B2, 'horrified')]).toEqual([true, false]);
    a.pass(4);
    expect(a.has(B1, 'horrified')).toBe(true); // 3 turns
    a.pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Nightmare of Ice: Invisible; counters a Harmful skill and Horrifies them for 2 turns', () => {
    const a = arena({ p0: [['mislead.lich']], p1: [['shot']] });
    a.use(A1, 'mislead.lich', B1).end();
    expect(seenByFoe(a, B1)).toEqual([]);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.has(B1, 'horrified')]).toEqual([100, true]);
    a.pass(3);
    expect(a.has(B1, 'horrified')).toBe(true); // through their second turn
    a.pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
  });

  it('Nightmare of Ice: meanwhile, the user is Invulnerable to Horrified enemies (only)', () => {
    const a = arena({ p0: [['mislead.lich']], p1: [['shot', 'curse'], ['shot']] });
    a.use(A1, 'mislead.lich', B1).end();
    a.use(B1, 'curse', A1).end().pass(1);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Nightmare of Ice: if they use no Harmful skill, nothing happens', () => {
    const a = arena({ p0: [['mislead.lich']], p1: [['shot', 'heal']] });
    a.use(A1, 'mislead.lich', B1).end();
    a.use(B1, 'heal', B1).end().pass(1);
    expect(a.has(B1, 'horrified')).toBe(false);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Heart of Ice: 15 and Soulfrost; the first Soul Fragment it yields Stuns them for 1 turn', () => {
    const a = arena({ p0: [['stun.lich'], ['shot']], p1: [['shot']] });
    a.use(A1, 'stun.lich', B1).end();
    expect([a.hp(B1), soulfrosted(a, B1), a.has(B1, 'stun')]).toEqual([85, true, false]);
    a.pass(1).use(A2, 'shot', B1).end();
    expect([sf(a, A1), a.has(B1, 'stun')]).toEqual([1, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
  });

  it('Heart of Ice: no Soul Fragment, no Stun', () => {
    const a = arena({ p0: [['stun.lich']], p1: [['shot']] });
    a.use(A1, 'stun.lich', B1).end();
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Deathwaltz: 1 Swiftness and 1 Focus for 3 turns', () => {
    const a = arena({ p0: [['dance.lich']], p1: [['shot']] });
    a.use(A1, 'dance.lich').end();
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 1]);
    a.pass(5);
    expect([a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([0, 0]);
  });

  it('Deathwaltz: each death meanwhile resets all the user’s cooldowns', () => {
    const b = arena({ p0: [['dance.lich', 'smash.lich'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    b.use(A1, 'dance.lich').end().pass(1).use(A1, 'smash.lich', B1).end().pass(1);
    expect(b.cooldown(A1, 'smash.lich')).toBeGreaterThan(0);
    b.setHp(B3, 10).use(A2, 'shot', B3).end();
    expect([b.unit(B3).alive, b.cooldown(A1, 'smash.lich'), b.cooldown(A1, 'dance.lich')]).toEqual([false, 0, 0]);
  });

  it('Deathwaltz: no death, no reset', () => {
    const a = arena({ p0: [['dance.lich', 'smash.lich'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'dance.lich').end().pass(1).use(A1, 'smash.lich', B1).end().pass(1).use(A2, 'shot', B2).end();
    expect(a.cooldown(A1, 'smash.lich')).toBeGreaterThan(0);
  });

  it('Feed the Vessel: a character heals 20', () => {
    const a = arena({ p0: [['heal.lich'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.lich', A2).end();
    expect([a.hp(A2), a.has(A2, 'armor')]).toEqual([70, false]);
  });

  it('Feed the Vessel: a minion heals 40 instead and gains 1 Armor for 2 turns', () => {
    const a = arena({ p0: [['heal.lich', 'companion.lich']], p1: [['shot']] });
    a.use(A1, 'companion.lich').end().pass(1);
    const w = minions(a, 0, 'frost_wight')[0]!;
    a.setHp(w.id, 1).use(A1, 'heal.lich', w.id).end();
    expect([a.unit(w.id).hp, a.stacks(w.id, 'armor')]).toEqual([30, 1]);
    a.pass(2);
    expect(a.stacks(w.id, 'armor')).toBe(1);
    a.pass(1);
    expect(a.stacks(w.id, 'armor')).toBe(0);
  });

  it('Feed the Vessel: a Phylactery heals 40', () => {
    const a = arena({ p0: [['heal.lich', 'titan.lich']], p1: [['shot']] });
    a.use(A1, 'titan.lich').end().pass(1);
    a.setHp(jar(a)!.id, 1).use(A1, 'heal.lich', jar(a)!.id).end();
    expect([jar(a)!.hp, a.stacks(jar(a)!.id, 'armor')]).toEqual([30, 1]); // 40, capped at its 30 max
  });

  it("Embalm: 1 Might for 3 turns, and the ally's other Buffs don't count down meanwhile", () => {
    const a = arena({ p0: [['bless.lich'], ['shot']], p1: [['shot']] });
    a.give(A2, 'armor', { duration: 2 }).use(A1, 'bless.lich', A2).end();
    expect(a.stacks(A2, 'might')).toBe(1);
    a.pass(4);
    expect([a.stacks(A2, 'might'), a.has(A2, 'armor')]).toEqual([1, true]);
    a.pass(1);
    expect(a.stacks(A2, 'might')).toBe(0);
  });

  it('Touch of the Grave: for 2 turns they can’t gain Buffs; each Helpful skill on them gives the user a Soul Fragment', () => {
    const a = arena({ p0: [['curse.lich']], p1: [['rage', 'heal'], ['heal']] });
    a.use(A1, 'curse.lich', B1).end();
    a.use(B1, 'rage').use(B2, 'heal', B1).end();
    expect([a.has(B1, 'might'), sf(a, A1)]).toEqual([false, 2]);
  });

  it('Touch of the Grave: at most 3 Soul Fragments, and nothing after 2 turns', () => {
    const a = arena({ p0: [['curse.lich']], p1: [['bless', 'heal'], ['bless'], ['bless']] });
    a.setHp(B1, 50).use(A1, 'curse.lich', B1).end();
    a.use(B1, 'bless', B1).use(B2, 'bless', B1).use(B3, 'bless', B1).end().pass(1);
    a.use(B1, 'heal', B1).end();
    expect(sf(a, A1)).toBe(3);
    const b = arena({ p0: [['curse.lich']], p1: [['rage']] });
    b.use(A1, 'curse.lich', B1).end().pass(4).use(B1, 'rage').end();
    expect([b.has(B1, 'might'), sf(b, A1)]).toEqual([true, 0]);
  });

  it("Vessel's Due: 20 and Sanctified for 1 turn; each Sanctify heal also feeds the Phylactery 15 (created at 15)", () => {
    const a = arena({ p0: [['smite.lich'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite.lich', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), a.hp(A2), jar(a)?.hp]).toEqual([65, 65, 15]);
  });

  it("Vessel's Due: an existing Phylactery heals 15", () => {
    const a = arena({ p0: [['smite.lich', 'maneuver.lich'], ['shot']], p1: [['shot']] });
    a.use(A1, 'maneuver.lich').end().pass(1);
    a.setHp(jar(a)!.id, 5).use(A1, 'smite.lich', B1).use(A2, 'shot', B1).end();
    expect([minions(a, 0, 'phylactery').length, jar(a)?.hp]).toEqual([1, 20]);
  });

  it('Frostborn Litany: allies heal 20 and gain Frostborn for 1 turn, Invulnerable to Chilled and Numb enemies too', () => {
    const a = arena({ p0: [['prayer.lich'], ['shot']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B1, 'chilled', { source: A1 }).give(B2, 'numb', { source: A1 });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer.lich').end();
    expect([a.hp(A1), a.hp(A2), a.has(A1, 'frostborn'), a.has(A2, 'frostborn')]).toEqual([70, 70, true, true]);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    expect(a.reject(() => a.use(B2, 'shot', A2))).toBe('bad_target');
    a.use(B3, 'shot', A1).end();
    expect(a.hp(A1)).toBe(55);
    a.pass(1);
    expect(a.has(A1, 'frostborn')).toBe(false);
  });

  it('Spreading Rime: 25 and 15 to a random other enemy, who copies each Frost debuff on the target for 1 turn', () => {
    const a = arena({ p0: [['cleave.lich'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(B1, 'frostbitten', { source: A1 }).give(B1, 'soulfrost', { source: A2 });
    a.use(A1, 'cleave.lich', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B2, 'frostbitten'), a.has(B2, 'soulfrost'), a.has(B2, 'chilled')]).toEqual([75, 85, true, true, false]);
    a.pass(1);
    expect([a.has(B2, 'frostbitten'), a.has(B1, 'frostbitten')]).toEqual([false, true]);
  });

  it('Echo from the Tomb: all enemies Intimidated for 2 turns, and again 3 turns later', () => {
    const a = arena({ p0: [['shout.lich']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.lich').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.pass(3);
    expect(a.has(B1, 'intimidated')).toBe(false);
    a.pass(3);
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
  });

  it('Hoarded Life: 25 Shield for 1 turn; what it absorbed heals the Phylactery or creates one with that HP', () => {
    const a = arena({ p0: [['withstand.lich']], p1: [['strike']] });
    a.use(A1, 'withstand.lich').end();
    a.use(B1, 'strike', A1).end();
    expect([a.hp(A1), jar(a)?.hp]).toEqual([100, 20]);
  });

  it('Hoarded Life: at least 10, even if nothing was absorbed', () => {
    const a = arena({ p0: [['withstand.lich']], p1: [['shot']] });
    a.use(A1, 'withstand.lich').end().pass(2);
    expect(jar(a)?.hp).toBe(10);
  });

  it('Guarded Urn: Taunted for 2 turns by the Phylactery (created at 20 HP), and their damage to it is halved', () => {
    const a = arena({ p0: [['taunt.lich'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.lich', B1).end();
    const p = jar(a)!;
    expect(p.hp).toBe(20);
    expect(['bad_target', 'taunted']).toContain(a.reject(() => a.use(B1, 'shot', A1)));
    a.use(B1, 'shot', p.id).end();
    expect(a.unit(p.id).hp).toBeGreaterThan(20 - 5); // less than the 5 an unhalved shot would leave through its Armor
    a.pass(3);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Guarded Urn: other enemies hit the Phylactery normally', () => {
    const a = arena({ p0: [['taunt.lich']], p1: [['ravage'], ['ravage']] });
    a.use(A1, 'taunt.lich', B1).end();
    const p = jar(a)!;
    a.setHp(p.id, 30).use(B2, 'ravage', p.id).end();
    expect(a.unit(p.id).hp).toBe(5);
  });

  it('Archlich: a Phylactery; 2 Armor and Frostborn for 3 turns', () => {
    const a = arena({ p0: [['titan.lich']], p1: [['shot']] });
    a.use(A1, 'titan.lich').end();
    expect([jar(a)?.hp, a.stacks(A1, 'armor'), a.has(A1, 'frostborn')]).toEqual([30, 2, true]);
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(95);
    a.pass(4);
    expect([a.stacks(A1, 'armor'), a.has(A1, 'frostborn')]).toEqual([0, false]);
  });

  it('Archlich: enemies who damage the Phylactery meanwhile are Soulfrosted', () => {
    const a = arena({ p0: [['titan.lich']], p1: [['ravage'], ['shot']] });
    a.use(A1, 'titan.lich').end();
    a.use(B1, 'ravage', jar(a)!.id).use(B2, 'shot', A1).end();
    expect([a.has(B1, 'soulfrost'), a.has(B2, 'soulfrost')]).toEqual([true, false]);
  });

  it('Minion skills: Rime Claw (S) and Bone Chill (r) are Harmful single-target hits', () => {
    expect(content.skills.frost_wight_rime_claw!.cost).toEqual(cost('S'));
    expect(content.skills.skeletal_mage_bone_chill!.cost).toEqual(cost('r'));
  });
});

describe('Lich costs and cooldowns match the kit table', () => {
  const table: Record<string, [string, number]> = {
    strike: ['S', 1], smash: ['SS', 3], charge: ['S', 2], riposte: ['I', 3], rage: ['Sr', 4],
    shot: ['r', 1], snipe: ['AS', 2], trap: ['II', 3], maneuver: ['I', 2], companion: ['S', 1],
    bolt: ['Ir', 1], blast: ['SIr', 2], consume: ['I', 2], summon: ['I', 1], channel: ['rr', 3],
    stab: ['r', 0], ravage: ['AS', 2], mislead: ['r', 3], stun: ['AS', 3], dance: ['AI', 4],
    heal: ['W', 1], bless: ['W', 2], curse: ['r', 2], smite: ['Sr', 1], prayer: ['Irr', 2],
    cleave: ['S', 1], shout: ['S', 3], withstand: ['r', 3], taunt: ['S', 3], titan: ['IW', 4],
  };
  for (const [arch, [c, cd]] of Object.entries(table)) {
    it(`${arch}.lich: ${c} · ${cd}`, () => {
      const s = content.skills[`${arch}.lich`]!;
      expect([s.cost, s.cooldown]).toEqual([cost(c), cd]);
    });
  }
});
