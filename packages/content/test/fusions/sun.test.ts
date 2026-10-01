// Spec-driven tests for Sun (Fire + Earth): Corona, Solar Flare, Sun's Heart and all 30 skills.
// Sources: skill/status descriptions, docs/rules.md §21.16, and the fire-pairs.md kit table.
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

const minions = (a: Arena, owner: 0 | 1, defId?: string) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (!defId || u.defId === defId));
const seedlings = (a: Arena, owner: 0 | 1) =>
  a.state.units.filter((u) => u.alive && u.owner === owner && u.kind === 'minion' && (u.defId === 'seedling' || u.defId === 'sunflower'));
const corona = (a: Arena, id: string) => a.stacks(id, 'corona');
const coronaDuration = (a: Arena, id: string) => a.effects(id).find((e) => e.defId === 'corona')?.duration ?? null;
const shieldValue = (a: Arena, id: string) =>
  a.effects(id).filter((e) => e.defId === 'shield' || e.inline?.id === 'kiln_wall').reduce((n, e) => n + e.value, 0);

describe('Sun keywords', () => {
  it('Corona: at the end of the applier\'s turn every enemy takes 5 Affliction per stack and every ally heals 5 per stack', () => {
    const a = arena({ p0: [['strike.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50).give(B2, 'armor', { stacks: 3 }).give(B2, 'shield', { value: 50 });
    a.use(A1, 'strike.sun', B1).end();
    expect(corona(a, A1)).toBe(1);
    // B1: 20 from the hit, 5 from Corona; B2's Armor and Shield don't stop Affliction.
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([75, 95, 55]);
  });

  it('Corona: allies are not damaged and enemies are not healed; it does not tick on the enemy\'s turn', () => {
    const a = arena({ p0: [['strike.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 50);
    a.use(A1, 'strike.sun', B1).end();
    expect([a.hp(A1), a.hp(A2), a.hp(B2)]).toEqual([100, 100, 45]);
    const before = [a.hp(B1), a.hp(B2)];
    a.pass(1); // the enemy's turn
    expect([a.hp(B1), a.hp(B2)]).toEqual(before);
  });

  it('Corona: 2 stacks tick for 10 each', () => {
    const a = arena({ p0: [['strike.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.sun', B1).end().pass(1).use(A1, 'strike.sun', B1).end();
    expect(corona(a, A1)).toBe(2);
    // B2: 5 (first tick) + 10 (second tick).
    expect(a.hp(B2)).toBe(85);
  });

  it('Corona: max 3 stacks', () => {
    const a = arena({ p0: [['strike.sun']], p1: [['shot']], hp: 400 });
    for (let i = 0; i < 4; i++) a.use(A1, 'strike.sun', B1).end().pass(1);
    expect(corona(a, A1)).toBe(3);
  });

  it('Corona: lasts 3 turns (three ticks), then expires', () => {
    const a = arena({ p0: [['strike.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.sun', B1).end(); // tick 1
    a.pass(4); // ticks 2 (turn 3) and 3 (turn 5)
    expect(corona(a, A1)).toBe(1);
    a.pass(1); // it runs out at the end of the 3rd enemy turn
    expect(a.hp(B2)).toBe(85);
    expect(corona(a, A1)).toBe(0);
    a.pass(2);
    expect(a.hp(B2)).toBe(85);
  });

  it('Corona: gaining more refreshes its duration', () => {
    const a = arena({ p0: [['strike.sun']], p1: [['shot']] });
    a.use(A1, 'strike.sun', B1).end().pass(1);
    const before = coronaDuration(a, A1)!;
    a.use(A1, 'strike.sun', B1).end();
    expect(coronaDuration(a, A1)!).toBeGreaterThan(before - 1);
    // Without the refresh it would be gone after 4 more turns; it lasts.
    a.pass(3);
    expect(corona(a, A1)).toBe(2);
  });

  it('Corona: a minion can carry it (the Sunflower\'s Corona heals allies and burns enemies)', () => {
    const a = arena({ p0: [['companion.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'companion.sun').end();
    const sf = minions(a, 0, 'sunflower')[0]!;
    expect(corona(a, sf.id)).toBe(1);
    expect([a.hp(B1), a.hp(B2), a.hp(A2)]).toEqual([95, 95, 55]);
  });

  it('Solar Flare: a Flare spends all the user\'s Corona', () => {
    const a = arena({ p0: [['shot.sun']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 3, duration: 6 });
    a.use(A1, 'shot.sun', B1).end();
    expect(corona(a, A1)).toBe(0);
  });

  it('Sun\'s Heart: indirect damage (Corona ticks) does not count as dealing direct damage', () => {
    const a = arena({ p0: [['shot', 'ravage.sun', 'strike.sun']], p1: [['shot']], passives: { p0c0: ['sun_heart'] } });
    a.use(A1, 'shot', B1).end().pass(1); // direct damage on turn 1
    a.use(A1, 'strike.sun', B1).end().pass(1); // direct on turn 3 (its Corona then ticks)
    a.pass(2); // turn 5 idle (Corona ticks again, indirect)
    const hp = a.hp(B1);
    a.use(A1, 'ravage.sun', B1).end();
    // Turn 7: 2 user turns since turn 3 → 20 + 20, plus 5 from the Corona tick.
    expect(hp - a.hp(B1)).toBe(45);
  });
});

describe('Sun skills', () => {
  it('Daybreak Blow: 20 damage and the user gains 1 Corona', () => {
    const a = arena({ p0: [['strike.sun']], p1: [['shot']] });
    a.use(A1, 'strike.sun', B1);
    a.end();
    expect(corona(a, A1)).toBe(1);
    expect(a.hp(B1)).toBe(75); // 20 + 5 Corona tick
  });

  it('Scorched Earth: 20 to the target and 10 to their allies', () => {
    const a = arena({ p0: [['smash.sun']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash.sun', B1).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([80, 90, 90]);
  });

  it('Scorched Earth: Scorched enemies hit by it have their Shield halved at the end of the user\'s turns; un-Scorched ones don\'t', () => {
    const a = arena({ p0: [['smash.sun']], p1: [['shot'], ['shot'], ['shot']] });
    a.give(B2, 'scorched').give(B2, 'shield', { value: 50 }).give(B3, 'shield', { value: 50 });
    a.use(A1, 'smash.sun', B1).end();
    // B2: 50 − 10 = 40, halved to 20. B3 isn't Scorched: 40.
    expect([shieldValue(a, B2), shieldValue(a, B3)]).toEqual([20, 40]);
    a.pass(1);
    expect(shieldValue(a, B2)).toBe(20); // not on the enemy's turn
    a.pass(1);
    expect(shieldValue(a, B2)).toBe(10); // the user's next turn
  });

  it('Scorched Earth: the Shield halving lasts 2 turns', () => {
    const a = arena({ p0: [['smash.sun']], p1: [['shot'], ['shot']] });
    a.give(B2, 'scorched').give(B2, 'shield', { value: 90 });
    a.use(A1, 'smash.sun', B1).end(); // 80 → 40
    a.pass(2); // 20
    a.pass(2); // the 2 turns are over
    a.pass(2);
    expect(shieldValue(a, B2)).toBe(20);
  });

  it('Rolling Sunstone: 10 damage and a 45 HP Sunstone (a Boulder)', () => {
    const a = arena({ p0: [['charge.sun']], p1: [['shot']] });
    a.use(A1, 'charge.sun', B1).end();
    const st = minions(a, 0, 'sunstone')[0]!;
    expect([a.hp(B1), st.hp, st.maxHp]).toEqual([90, 45, 45]);
    expect(content.minions.sunstone!.tags).toContain('boulder');
  });

  it('Rolling Sunstone: the Sunstone Explodes (10 to every enemy) when destroyed', () => {
    const a = arena({ p0: [['charge.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.sun', B1).end();
    const st = minions(a, 0, 'sunstone')[0]!;
    a.setHp(st.id, 5);
    a.use(B1, 'shot', st.id).end();
    expect(a.unit(st.id).alive).toBe(false);
    expect([a.hp(B1), a.hp(B2), a.hp(A1), a.hp(A2)]).toEqual([80, 90, 100, 100]);
  });

  it('Rolling Sunstone: the Sunstone Explodes when launched', () => {
    const a = arena({ p0: [['charge.sun', 'shot.earth']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.sun', B1).end().pass(1);
    const st = minions(a, 0, 'sunstone')[0]!;
    a.setHp(st.id, 20);
    const before = a.hp(B1) + a.hp(B2);
    a.use(A1, 'shot.earth', st.id).end();
    expect(a.unit(st.id).alive).toBe(false);
    // 20 from the launch to a random enemy, plus a 10 Explosion to each enemy.
    expect(before - a.hp(B1) - a.hp(B2)).toBe(20 + 10 + 10);
    expect(Math.min(a.hp(B1), a.hp(B2))).toBeLessThan(Math.max(a.hp(B1), a.hp(B2)));
  });

  it('Sunspot: counters the first Harmful skill on the user; its user takes 15 Affliction per Corona', () => {
    const a = arena({ p0: [['riposte.sun', 'strike.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'strike.sun', B1).end().pass(1).use(A1, 'strike.sun', B1).end().pass(1);
    expect(corona(a, A1)).toBe(2);
    a.use(A1, 'riposte.sun').end();
    a.give(B1, 'armor', { stacks: 5 });
    const [b1, b2] = [a.hp(B1), a.hp(B2)];
    a.use(B1, 'shot', A1).use(B2, 'shot', A1).end();
    expect(b1 - a.hp(B1)).toBe(30); // countered: 15 × 2 Corona, Armor doesn't help
    expect(b2 - a.hp(B2)).toBe(0); // only the first is countered
    expect(a.hp(A1)).toBe(85); // B2's shot lands
  });

  // BUG: "the user's Corona is refreshed" — after the counter (enemy turn 4) the Corona only lasts through turn 8
  // (2 more ticks), not a fresh 3 turns like gaining Corona gives.
  it.fails('Sunspot: the user\'s Corona is refreshed (to a full 3 turns) when it counters', () => {
    const a = arena({ p0: [['riposte.sun', 'strike.sun']], p1: [['shot']] });
    a.use(A1, 'strike.sun', B1).end().pass(1).use(A1, 'riposte.sun').end();
    const before = coronaDuration(a, A1)!;
    a.use(B1, 'shot', A1).end();
    expect(coronaDuration(a, A1)!).toBeGreaterThan(before - 1);
    a.pass(4);
    expect(corona(a, A1)).toBe(1); // would have run out without the refresh
  });

  it('Sunspot: is Invisible, and does not catch Helpful skills', () => {
    const a = arena({ p0: [['riposte.sun']], p1: [['heal'], ['shot']] });
    expect(content.skills['riposte.sun']!.tags).toContain('Invisible');
    a.use(A1, 'riposte.sun').end();
    a.setHp(B1, 50);
    a.use(B1, 'heal', B1).use(B2, 'shot', A1).end();
    // The Heal isn't Harmful (B1 heals); the Shot is countered (0 Corona, so no damage back).
    expect([a.hp(B1), a.hp(A1)]).toEqual([75, 100]);
  });

  it('Solar Maximum: Immune for 3 turns and gains 1 Corona at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['rage.sun']], p1: [['curse']] });
    a.use(A1, 'rage.sun').end();
    expect(corona(a, A1)).toBe(0);
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    expect(corona(a, A1)).toBe(1);
    a.pass(2);
    expect(corona(a, A1)).toBe(2);
  });

  it('Solar Maximum: can hold up to 5 Corona; when it ends, Corona drops to 3', () => {
    const a = arena({ p0: [['rage.sun', 'strike.sun']], p1: [['shot']], hp: 400 });
    a.use(A1, 'rage.sun').end().pass(1); // turn 3: +1
    expect(corona(a, A1)).toBe(1);
    a.use(A1, 'strike.sun', B1).end().pass(1); // 2; turn 5: +1 → 3
    expect(corona(a, A1)).toBe(3);
    a.give(A1, 'corona', { stacks: 2, duration: 20 }); // 5
    a.use(A1, 'strike.sun', B1).end(); // would be 6
    expect(corona(a, A1)).toBe(5);
  });

  it('Solar Maximum: when it ends, Corona drops to 3', () => {
    const a = arena({ p0: [['rage.sun', 'strike.sun']], p1: [['shot']], hp: 400 });
    a.use(A1, 'rage.sun').end().pass(1);
    a.use(A1, 'strike.sun', B1).end().pass(1).use(A1, 'strike.sun', B1).end(); // 4
    expect(corona(a, A1)).toBe(4);
    a.pass(1); // turn 6 ends: Solar Maximum is over
    expect(a.has(A1, 'immune')).toBe(false);
    expect(corona(a, A1)).toBe(3);
  });

  it('Solar Maximum: without it, Corona stays capped at 3', () => {
    const a = arena({ p0: [['strike.sun']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 3, duration: 20 });
    a.use(A1, 'strike.sun', B1).end();
    expect(corona(a, A1)).toBe(3);
  });

  it('Noon Ray: with no Corona, 15 damage and the user gains 1', () => {
    const a = arena({ p0: [['shot.sun']], p1: [['shot']] });
    a.use(A1, 'shot.sun', B1).end();
    expect([a.hp(B1), corona(a, A1)]).toEqual([80, 1]); // 15 + 5 tick
  });

  it('Noon Ray: with Corona it Flares for 10 more per Corona (and gains none)', () => {
    const a = arena({ p0: [['shot.sun']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 2, duration: 6 });
    a.use(A1, 'shot.sun', B1).end();
    expect([a.hp(B1), corona(a, A1)]).toEqual([65, 0]); // 15 + 20, no tick
  });

  it('Zenith Spear: 45 damage on the following turn, hidden target', () => {
    const a = arena({ p0: [['snipe.sun']], p1: [['shot']] });
    expect(content.skills['snipe.sun']!.tags).toEqual(expect.arrayContaining(['Channeled', 'HiddenTarget']));
    a.use(A1, 'snipe.sun', B1).end();
    expect(a.hp(B1)).toBe(100);
    a.pass(1);
    expect(a.hp(B1)).toBe(55);
  });

  it('Zenith Spear: Flare — when it lands, every ally heals 10 per Corona spent', () => {
    const a = arena({ p0: [['snipe.sun'], ['shot'], ['shot']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 2, duration: 6 });
    a.setHp(A2, 40).setHp(A3, 40);
    a.use(A1, 'snipe.sun', B1).end();
    const [a2, a3] = [a.hp(A2), a.hp(A3)];
    a.pass(1); // it lands
    expect([a.hp(A2) - a2, a.hp(A3) - a3]).toEqual([20, 20]);
    expect(corona(a, A1)).toBe(0);
  });

  it('Zenith Spear: with no Corona, nobody heals when it lands', () => {
    const a = arena({ p0: [['snipe.sun'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 40);
    a.use(A1, 'snipe.sun', B1).end().pass(1);
    expect(a.hp(A2)).toBe(40);
  });

  it('Zenith Spear: stunning the user before it lands stops it (Channeled)', () => {
    const a = arena({ p0: [['snipe.sun']], p1: [['stun']] });
    a.use(A1, 'snipe.sun', B1).end().use(B1, 'stun', A1).end();
    expect(a.hp(B1)).toBe(100);
  });

  it('Sunlit Furrow: each Harmful skill the target uses deals 10 to them and makes the user a Seedling', () => {
    const a = arena({ p0: [['trap.sun']], p1: [['shot', 'heal']] });
    expect(content.skills['trap.sun']!.tags).toContain('Invisible');
    a.use(A1, 'trap.sun', B1).end();
    a.use(B1, 'shot', A1).end();
    expect([a.hp(B1), seedlings(a, 0).length]).toEqual([90, 1]);
    expect(minions(a, 0, 'seedling')[0]!.summonedBy).toBe(A1);
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(B1), seedlings(a, 0).length]).toEqual([80, 2]);
  });

  it('Sunlit Furrow: Helpful skills don\'t trigger it, and it ends after 3 turns', () => {
    const a = arena({ p0: [['trap.sun']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap.sun', B1).end();
    a.use(B1, 'heal', B1).end();
    expect([a.hp(B1), seedlings(a, 0).length]).toEqual([100, 0]);
    a.pass(4); // turns 3–6 pass; the trap is over
    a.pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(B1), seedlings(a, 0).length]).toEqual([100, 0]);
  });

  it('Sunlit Furrow: three Harmful skills over its 3 turns make 3 Seedlings (its maximum)', () => {
    const a = arena({ p0: [['trap.sun']], p1: [['shot']] });
    a.use(A1, 'trap.sun', B1).end();
    a.use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect([a.hp(B1), minions(a, 0, 'seedling').length]).toEqual([70, 3]);
  });

  it('Horizon: Invulnerable for 1 turn', () => {
    const a = arena({ p0: [['maneuver.sun']], p1: [['shot']] });
    a.use(A1, 'maneuver.sun').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
  });

  it('Horizon: rising gives 1 Corona and Ignites only the enemies who used a Harmful skill meanwhile', () => {
    const a = arena({ p0: [['maneuver.sun'], ['shot']], p1: [['shot'], ['heal'], ['shot']] });
    a.use(A1, 'maneuver.sun').end();
    expect(corona(a, A1)).toBe(0);
    a.use(B1, 'shot', A2).use(B2, 'heal', B2).end();
    expect(corona(a, A1)).toBe(1);
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite'), a.has(B3, 'ignite')]).toEqual([true, false, false]);
  });

  it('Sunflower: a permanent 40 HP Seedling-type minion with a Corona that never runs out', () => {
    const a = arena({ p0: [['companion.sun']], p1: [['shot']] });
    a.use(A1, 'companion.sun').end();
    const sf = minions(a, 0, 'sunflower')[0]!;
    expect([sf.hp, sf.maxHp]).toEqual([40, 40]);
    expect(content.minions.sunflower!.tags).toContain('seedling');
    a.pass(12);
    expect([a.unit(sf.id).alive, corona(a, sf.id)]).toEqual([true, 1]);
  });

  it('Sunflower / Scatter Seeds: the Sunflower loses 10 HP and creates a Seedling', () => {
    const a = arena({ p0: [['companion.sun']], p1: [['shot']] });
    a.use(A1, 'companion.sun').end().pass(1);
    const sf = minions(a, 0, 'sunflower')[0]!;
    a.use(sf.id, 'sunflower_scatter_seeds').end();
    expect(a.hp(sf.id)).toBe(35); // 40 − 10, then its own Corona heals it 5
    const sd = minions(a, 0, 'seedling');
    expect(sd).toHaveLength(1);
    expect(sd[0]!.summonedBy).toBe(sf.id);
  });

  it('Ripening Vine: 20 damage; each allied Seedling uses Channel Earth (its summoner gains Might and Armor), then loses 5 HP', () => {
    const a = arena({ p0: [['bolt.sun', 'trap.sun']], p1: [['shot']] });
    a.use(A1, 'trap.sun', B1).end().use(B1, 'shot', A1).end();
    const sd = minions(a, 0, 'seedling')[0]!;
    expect(sd.summonedBy).toBe(A1);
    const b1 = a.hp(B1);
    a.use(A1, 'bolt.sun', B1).end();
    expect(b1 - a.hp(B1)).toBe(20);
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor'), a.hp(sd.id)]).toEqual([1, 1, 10]);
  });

  it('Ripening Vine: the Sunflower counts as a Seedling and ripens too', () => {
    const a = arena({ p0: [['bolt.sun', 'companion.sun']], p1: [['shot']] });
    a.use(A1, 'companion.sun').end().pass(1);
    const sf = minions(a, 0, 'sunflower')[0]!;
    a.use(A1, 'bolt.sun', B1).end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'armor'), a.hp(sf.id)]).toEqual([1, 1, 40]); // −5, then its own Corona heals 5
  });

  it('Ripening Vine: with no Seedlings, just 20 damage', () => {
    const a = arena({ p0: [['bolt.sun']], p1: [['shot']] });
    a.use(A1, 'bolt.sun', B1).end();
    expect([a.hp(B1), a.stacks(A1, 'might'), a.stacks(A1, 'armor')]).toEqual([80, 0, 0]);
  });

  it('Noonburst: 25 to all enemies; no Corona means no Flare and no Scorch', () => {
    const a = arena({ p0: [['blast.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast.sun').end();
    expect([a.hp(B1), a.hp(B2), a.has(A1, 'scorched')]).toEqual([75, 75, false]);
  });

  it('Noonburst: Flare — 10 more to each per Corona, and the user is Scorched for 1 turn per Corona spent', () => {
    const a = arena({ p0: [['blast.sun']], p1: [['shot'], ['shot']] });
    a.give(A1, 'corona', { stacks: 2, duration: 6 });
    a.use(A1, 'blast.sun').end();
    expect([a.hp(B1), a.hp(B2), corona(a, A1)]).toEqual([55, 55, 0]);
    expect(a.has(A1, 'scorched')).toBe(true);
    a.pass(2);
    expect(a.has(A1, 'scorched')).toBe(true); // 2 turns
    a.pass(1);
    expect(a.has(A1, 'scorched')).toBe(false);
  });

  it('Noonburst: 1 Corona spent Scorches for only 1 turn', () => {
    const a = arena({ p0: [['blast.sun']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 1, duration: 6 });
    a.use(A1, 'blast.sun').end();
    expect(a.hp(B1)).toBe(65);
    a.pass(1);
    expect(a.has(A1, 'scorched')).toBe(false);
  });

  it('Lingering Light: 5 damage healing the user for it; gains 1 Corona', () => {
    const a = arena({ p0: [['consume.sun']], p1: [['shot']] });
    a.setHp(A1, 50);
    a.use(A1, 'consume.sun', B1).end();
    // 5 drained + 5 Corona tick.
    expect([a.hp(A1), a.hp(B1), corona(a, A1)]).toEqual([60, 90, 1]);
  });

  // "healing the user for it, 10 more if the target is Ignited": the 10 more is healing.
  it('Lingering Light: heals 10 more against an Ignited target', () => {
    const a = arena({ p0: [['consume.sun']], p1: [['shot']] });
    a.setHp(A1, 50).give(B1, 'ignite', { source: B1 });
    a.use(A1, 'consume.sun', B1).end();
    expect([a.hp(A1), a.hp(B1)]).toEqual([70, 90]); // 5 + 10 healing, 5 tick each
  });

  it('Lingering Light: all the user\'s Corona lasts 2 turns longer', () => {
    const plain = arena({ p0: [['strike.sun']], p1: [['shot']] });
    plain.use(A1, 'strike.sun', B1).end().pass(5);
    expect(corona(plain, A1)).toBe(0);
    const a = arena({ p0: [['consume.sun']], p1: [['shot']] });
    a.use(A1, 'consume.sun', B1).end().pass(5);
    expect(corona(a, A1)).toBe(1);
    a.pass(4);
    expect(corona(a, A1)).toBe(0);
  });

  it('Sunseed: summons a 20 HP Sunseed with 1 Corona for 3 turns', () => {
    const a = arena({ p0: [['summon.sun']], p1: [['shot']] });
    a.use(A1, 'summon.sun').end();
    const ss = minions(a, 0, 'sunseed')[0]!;
    expect([ss.hp, corona(a, ss.id)]).toEqual([20, 1]);
    a.pass(5);
    expect(a.unit(ss.id).alive).toBe(false);
  });

  it('Sunseed / Brighten: the Sunseed gains 1 Corona; when it expires its creator gains its Corona', () => {
    const a = arena({ p0: [['summon.sun']], p1: [['shot']] });
    a.use(A1, 'summon.sun').end().pass(1);
    const ss = minions(a, 0, 'sunseed')[0]!;
    a.use(ss.id, 'sunseed_brighten').end();
    expect(corona(a, ss.id)).toBe(2);
    expect(corona(a, A1)).toBe(0);
    a.pass(3); // the Sunseed's 3 turns run out
    expect(a.unit(ss.id).alive).toBe(false);
    expect(corona(a, A1)).toBe(2);
  });

  it('Sunseed: when killed, its creator gains its Corona', () => {
    const a = arena({ p0: [['summon.sun']], p1: [['shot']] });
    a.use(A1, 'summon.sun').end();
    const ss = minions(a, 0, 'sunseed')[0]!;
    a.setHp(ss.id, 5).use(B1, 'shot', ss.id).end();
    expect([a.unit(ss.id).alive, corona(a, A1)]).toEqual([false, 1]);
  });

  it('Long Summer: the user gains 1 Corona at the end of each of their turns while it channels', () => {
    const a = arena({ p0: [['channel.sun']], p1: [['shot']] });
    a.use(A1, 'channel.sun').end();
    expect(corona(a, A1)).toBe(1);
    a.pass(2);
    expect(corona(a, A1)).toBe(2);
    a.pass(2);
    expect(corona(a, A1)).toBe(3);
  });

  it('Long Summer: while it channels, Corona deals double to Ignited enemies (only)', () => {
    const a = arena({ p0: [['channel.sun']], p1: [['shot'], ['shot']] });
    a.give(B1, 'ignite', { source: B2 }); // burns on the enemy's turn, not ours
    a.use(A1, 'channel.sun').end().pass(1); // the first Corona arrives at the end of turn 1
    const [b1, b2] = [a.hp(B1), a.hp(B2)];
    a.pass(1); // turn 3: it ticks
    const [d1, d2] = [b1 - a.hp(B1), b2 - a.hp(B2)];
    expect(d2).toBeGreaterThan(0);
    expect(d1).toBe(2 * d2);
  });

  it('Long Summer: once the channel is over, Ignited enemies take normal Corona damage', () => {
    const a = arena({ p0: [['channel.sun', 'strike.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel.sun').end().pass(5); // channel over at the end of turn 6
    a.give(B1, 'ignite', { source: B2 });
    const [b1, b2] = [a.hp(B1), a.hp(B2)];
    a.use(A1, 'strike.sun', B2).end();
    expect(b1 - a.hp(B1)).toBe(b2 - a.hp(B2) - 20);
  });

  it('Long Summer: stunning the user ends the channel (no more Corona)', () => {
    const a = arena({ p0: [['channel.sun']], p1: [['stun']] });
    a.use(A1, 'channel.sun').end().use(B1, 'stun', A1).end().pass(1);
    expect(corona(a, A1)).toBe(1);
  });

  it('Tinder Spike: 10 damage, or 20 at or below 60 HP', () => {
    const a = arena({ p0: [['stab.sun']], p1: [['shot'], ['shot']] });
    a.setHp(B2, 60);
    a.use(A1, 'stab.sun', B1).end();
    expect(a.hp(B1)).toBe(90);
    a.pass(1).use(A1, 'stab.sun', B2).end();
    expect(a.hp(B2)).toBe(40);
  });

  it('Tinder Spike: the next Ignite put on the target before the user\'s next turn burns once as it lands', () => {
    const a = arena({ p0: [['stab.sun'], ['stun.sun']], p1: [['shot']] });
    a.use(A1, 'stab.sun', B1).use(A2, 'stun.sun', B1).end();
    // 10 + 5 (immediate burn) + 5 (the Ignite's normal tick).
    expect(a.hp(B1)).toBe(80);
    const ctl = arena({ p0: [['shot'], ['stun.sun']], p1: [['shot']] });
    ctl.use(A1, 'shot', B1).use(A2, 'stun.sun', B1).end();
    expect(ctl.hp(B1)).toBe(80); // 15 + 5 tick: no extra burn without the Spike
  });

  it('Tinder Spike: an Ignite applied after the user\'s next turn starts doesn\'t burn on landing', () => {
    const a = arena({ p0: [['stab.sun'], ['stun.sun']], p1: [['shot']] });
    a.use(A1, 'stab.sun', B1).end().pass(1);
    a.use(A2, 'stun.sun', B1).end();
    expect(a.hp(B1)).toBe(85); // 10 + the normal tick only
  });

  it('Upwelling Magma: 20 Piercing (Armor doesn\'t reduce it) right after dealing direct damage', () => {
    const a = arena({ p0: [['ravage.sun', 'shot']], p1: [['shot']], passives: { p0c0: ['sun_heart'] } });
    a.give(B1, 'armor', { stacks: 2 });
    a.use(A1, 'shot', B1).end().pass(1);
    const hp = a.hp(B1);
    a.use(A1, 'ravage.sun', B1).end();
    expect(hp - a.hp(B1)).toBe(30); // 1 user turn since (half the turn count): +10
  });

  it('Upwelling Magma: +10 per user turn since the user last dealt direct damage', () => {
    const a = arena({ p0: [['ravage.sun', 'shot']], p1: [['shot']], passives: { p0c0: ['sun_heart'] } });
    a.use(A1, 'shot', B1).end().pass(3); // turn 3 idle
    const hp = a.hp(B1);
    a.use(A1, 'ravage.sun', B1).end();
    expect(hp - a.hp(B1)).toBe(40); // turn 5: (5 − 1) / 2 = 2 user turns since → +20
  });

  it('Upwelling Magma: the bonus is capped at +30', () => {
    const a = arena({ p0: [['ravage.sun', 'shot']], p1: [['shot']], passives: { p0c0: ['sun_heart'] } });
    a.use(A1, 'shot', B1).end().pass(11);
    const hp = a.hp(B1);
    a.use(A1, 'ravage.sun', B1).end();
    expect(hp - a.hp(B1)).toBe(50);
  });

  it('Blinding Noon: counters the target\'s Harmful skill and Blinds them for 1 turn per Corona', () => {
    const a = arena({ p0: [['mislead.sun'], ['shot']], p1: [['shot'], ['shot']] });
    expect(content.skills['mislead.sun']!.tags).toContain('Invisible');
    a.give(A1, 'corona', { stacks: 2, duration: 20 });
    a.use(A1, 'mislead.sun', B1).end();
    const a2 = a.hp(A2);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(a2);
    expect([a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([true, false]);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(true); // 2 turns
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Blinding Noon: at least 1 turn of Blind with no Corona', () => {
    const a = arena({ p0: [['mislead.sun'], ['shot']], p1: [['shot']] });
    a.use(A1, 'mislead.sun', B1).end().use(B1, 'shot', A2).end();
    expect([a.hp(A2), a.has(B1, 'blinded')]).toEqual([100, true]);
    a.pass(2);
    expect(a.has(B1, 'blinded')).toBe(false);
  });

  it('Blinding Noon: Helpful skills and other enemies are not countered', () => {
    const a = arena({ p0: [['mislead.sun'], ['shot']], p1: [['heal'], ['shot']] });
    a.setHp(B1, 50);
    a.use(A1, 'mislead.sun', B1).end().use(B1, 'heal', B1).use(B2, 'shot', A2).end();
    expect([a.hp(B1), a.hp(A2), a.has(B1, 'blinded'), a.has(B2, 'blinded')]).toEqual([75, 85, false, false]);
  });

  it('Sunstroke: Stuns for 1 turn and Ignites', () => {
    const a = arena({ p0: [['stun.sun']], p1: [['shot']] });
    a.use(A1, 'stun.sun', B1).end();
    expect([a.has(B1, 'ignite'), a.reject(() => a.use(B1, 'shot', A1))]).toEqual([true, 'cannot_act']);
    a.pass(2);
    a.use(B1, 'shot', A1); // free again
  });

  it('Sunstroke: Flare — 1 more turn of Stun per 2 Corona (1 Corona adds none but is still spent)', () => {
    const a = arena({ p0: [['stun.sun']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 2, duration: 6 });
    a.use(A1, 'stun.sun', B1).end().pass(2);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    const b = arena({ p0: [['stun.sun']], p1: [['shot']] });
    b.give(A1, 'corona', { stacks: 1, duration: 6 });
    b.use(A1, 'stun.sun', B1).end();
    expect(corona(b, A1)).toBe(0);
    b.pass(2);
    b.use(B1, 'shot', A1);
  });

  it('Basking: 1 Swiftness and 1 Corona now', () => {
    const a = arena({ p0: [['dance.sun']], p1: [['stun']] });
    a.use(A1, 'dance.sun').end();
    expect([a.stacks(A1, 'swiftness'), corona(a, A1)]).toEqual([1, 1]);
    a.use(B1, 'stun', A1).end();
    expect(a.has(A1, 'stun')).toBe(false);
  });

  it('Basking: each Corona tick gives 1 Might for 1 turn', () => {
    const a = arena({ p0: [['dance.sun']], p1: [['shot']] });
    a.use(A1, 'dance.sun').end();
    expect(a.stacks(A1, 'might')).toBe(1);
    a.pass(1);
    expect(a.stacks(A1, 'might')).toBe(0);
    a.pass(1);
    expect(a.stacks(A1, 'might')).toBe(1); // ticked again
  });

  it('Basking: without it, Corona ticks give no Might', () => {
    const a = arena({ p0: [['strike.sun']], p1: [['shot']] });
    a.use(A1, 'strike.sun', B1).end();
    expect(a.stacks(A1, 'might')).toBe(0);
  });

  it('Sunlit Mending: heals 20', () => {
    const a = arena({ p0: [['heal.sun'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'heal.sun', A2).end();
    expect([a.hp(A2), corona(a, A1), corona(a, A2)]).toEqual([70, 0, 0]);
  });

  it('Sunlit Mending: each Ignite or Scorch on the target is removed and becomes 1 Corona', () => {
    const a = arena({ p0: [['heal.sun']], p1: [['shot']] });
    a.setHp(A1, 50).give(A1, 'ignite', { source: B1 }).give(A1, 'scorched', { source: B1 });
    a.use(A1, 'heal.sun', A1).end();
    expect([a.has(A1, 'ignite'), a.has(A1, 'scorched'), corona(a, A1)]).toEqual([false, false, 2]);
  });

  it('Heliotrope: target ally gains +5 direct damage (as 1 Might) and heals 5 each turn (as 1 Renew)', () => {
    const a = arena({ p0: [['bless.sun'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50);
    a.use(A1, 'bless.sun', A2).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect(a.hp(A2)).toBe(55);
  });

  it('Heliotrope: at the start of the user\'s turns it moves to the ally with the least HP', () => {
    const a = arena({ p0: [['bless.sun'], ['shot'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.sun', A2).end();
    a.setHp(A3, 30);
    a.pass(1); // turn 3 starts: the light moves to A3
    a.use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85 - 0);
    a.pass(1).use(A3, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85 - 20);
  });

  it('Heliotrope: it lasts 3 turns', () => {
    const a = arena({ p0: [['bless.sun'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bless.sun', A2).end().pass(5);
    const hp = a.hp(B1);
    a.use(A2, 'shot', B1).end();
    expect(hp - a.hp(B1)).toBe(15);
  });

  it('Drought: Scorched for 2 turns', () => {
    const a = arena({ p0: [['curse.sun']], p1: [['shot']] });
    a.use(A1, 'curse.sun', B1).end();
    expect(a.has(B1, 'scorched')).toBe(true);
    a.pass(2);
    expect(a.has(B1, 'scorched')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'scorched')).toBe(false);
  });

  it('Drought: the healing the Scorch denies goes to a random ally of the user', () => {
    const a = arena({ p0: [['curse.sun']], p1: [['shot'], ['heal']] });
    a.setHp(A1, 50).setHp(B1, 40);
    a.use(A1, 'curse.sun', B1).end();
    a.use(B2, 'heal', B1).end();
    // Heal 25 → Scorched lets 15 through. Ruling §21.16: "whatever healing the bearer gets also goes to a
    // random ally of the user (the denied half)", so A1 (the only ally) heals 15 as well.
    expect([a.hp(B1), a.hp(A1)]).toEqual([55, 65]);
  });

  it('Drought: a plain Scorch (not Drought) gives nothing to the enemy', () => {
    const a = arena({ p0: [['shot']], p1: [['shot'], ['heal']] });
    a.setHp(A1, 50).setHp(B1, 40).give(B1, 'scorched', { source: A1 });
    a.pass(1).use(B2, 'heal', B1).end();
    expect([a.hp(B1), a.hp(A1)]).toEqual([55, 50]);
  });

  it('Pillar of Noon: 20 damage; with no Corona, allies hitting the target gain nothing', () => {
    const a = arena({ p0: [['smite.sun'], ['shot']], p1: [['shot']] });
    a.use(A1, 'smite.sun', B1).use(A2, 'shot', B1).end();
    expect([a.hp(B1), corona(a, A2)]).toEqual([65, 0]);
  });

  it('Pillar of Noon: Flare — for 1 turn per Corona spent, allies who damage the target gain 1 Corona', () => {
    const a = arena({ p0: [['smite.sun'], ['shot'], ['shot']], p1: [['shot'], ['shot']] });
    a.give(A1, 'corona', { stacks: 2, duration: 6 });
    a.use(A1, 'smite.sun', B1).use(A2, 'shot', B1).use(A3, 'shot', B2).end();
    expect([corona(a, A1), corona(a, A2), corona(a, A3)]).toEqual([0, 1, 0]);
    a.pass(1).use(A3, 'shot', B1).end();
    expect(corona(a, A3)).toBe(1); // still within 2 turns
    a.pass(3).use(A2, 'shot', B1).end();
    expect(corona(a, A2)).toBe(0); // over (A2's first Corona ran out too)
  });

  it('Hymn to the Sun: all allies heal 20', () => {
    const a = arena({ p0: [['prayer.sun'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50);
    a.use(A1, 'prayer.sun').end();
    expect([a.hp(A1), a.hp(A2), corona(a, A2)]).toEqual([70, 70, 0]);
  });

  it('Hymn to the Sun: Flare — every ally gains 1 Corona per 2 Corona spent, rounded up', () => {
    const a = arena({ p0: [['prayer.sun'], ['shot']], p1: [['shot']] });
    a.give(A1, 'corona', { stacks: 3, duration: 6 });
    a.use(A1, 'prayer.sun').end();
    expect([corona(a, A1), corona(a, A2)]).toEqual([2, 2]);
    const b = arena({ p0: [['prayer.sun'], ['shot']], p1: [['shot']] });
    b.give(A1, 'corona', { stacks: 1, duration: 6 });
    b.use(A1, 'prayer.sun').end();
    expect([corona(b, A1), corona(b, A2)]).toEqual([1, 1]);
  });

  it('Stubble Burn: 20 to the target and 15 to another enemy; no Seedlings, no Ignite', () => {
    const a = arena({ p0: [['cleave.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave.sun', B1).end();
    expect([a.hp(B1), a.hp(B2), a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([80, 85, false, false]);
  });

  it('Stubble Burn: every allied Seedling dies; both enemies are Ignited and burn once now per Seedling', () => {
    const a = arena({ p0: [['cleave.sun', 'trap.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'trap.sun', B1).end().use(B1, 'shot', A1).end().pass(1).use(B1, 'shot', A1).end();
    expect(seedlings(a, 0)).toHaveLength(2);
    const [b1, b2] = [a.hp(B1), a.hp(B2)];
    a.use(A1, 'cleave.sun', B1).end();
    expect(seedlings(a, 0)).toHaveLength(0);
    expect([a.has(B1, 'ignite'), a.has(B2, 'ignite')]).toEqual([true, true]);
    // 20 / 15, two burns of 5 now, then the Ignite's own tick at the end of the turn.
    expect([b1 - a.hp(B1), b2 - a.hp(B2)]).toEqual([20 + 10 + 5, 15 + 10 + 5]);
  });

  it('Stubble Burn: the Sunflower (a Seedling) is burned off too', () => {
    const a = arena({ p0: [['cleave.sun', 'companion.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'companion.sun').end().pass(1);
    const sf = minions(a, 0, 'sunflower')[0]!;
    a.use(A1, 'cleave.sun', B1).end();
    expect([a.unit(sf.id).alive, a.has(B1, 'ignite')]).toEqual([false, true]);
  });

  it('Dawn Chorus: all enemies are Intimidated for 2 turns', () => {
    const a = arena({ p0: [['shout.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'shout.sun').end();
    expect([a.has(B1, 'intimidated'), a.has(B2, 'intimidated')]).toEqual([true, true]);
    a.pass(2);
    expect(a.has(B1, 'intimidated')).toBe(true);
    a.pass(1);
    expect(a.has(B1, 'intimidated')).toBe(false);
  });

  // BUG: "it ticks once now" — the immediate tick deals 0 damage and heals 0; only the end-of-turn tick lands.
  it.fails('Dawn Chorus: every allied minion gains 1 Corona and it ticks once now', () => {
    const a = arena({ p0: [['shout.sun', 'charge.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'charge.sun', B1).end().pass(1);
    const st = minions(a, 0, 'sunstone')[0]!;
    const b2 = a.hp(B2);
    a.use(A1, 'shout.sun').end();
    expect(corona(a, st.id)).toBe(1);
    expect(b2 - a.hp(B2)).toBe(10); // ticks now, and again at the end of the turn
  });

  it('Dawn Chorus: with no minions, no Corona is gained', () => {
    const a = arena({ p0: [['shout.sun']], p1: [['shot']] });
    a.use(A1, 'shout.sun').end();
    expect([corona(a, A1), a.hp(B1)]).toEqual([0, 100]);
  });

  it('Kiln Wall: 25 Shield; damage it absorbs is baked into an allied Boulder (max HP and HP)', () => {
    const a = arena({ p0: [['withstand.sun', 'charge.sun']], p1: [['shot']] });
    a.use(A1, 'charge.sun', B1).end().pass(1);
    const st = minions(a, 0, 'sunstone')[0]!;
    a.use(A1, 'withstand.sun').end();
    expect(shieldValue(a, A1)).toBe(25);
    a.use(B1, 'shot', A1).end();
    expect([a.hp(A1), a.unit(st.id).maxHp, a.hp(st.id)]).toEqual([100, 60, 60]);
  });

  it('Kiln Wall: lasts 2 turns', () => {
    const a = arena({ p0: [['withstand.sun']], p1: [['shot']] });
    a.use(A1, 'withstand.sun').end().pass(2);
    a.use(B1, 'shot', A1).end(); // turn 4: still up
    expect(a.hp(A1)).toBe(100); // absorbed, then it expires at the end of turn 4
    const b = arena({ p0: [['withstand.sun']], p1: [['shot']] });
    b.use(A1, 'withstand.sun').end().pass(4);
    b.use(B1, 'shot', A1).end(); // turn 6: gone
    expect(b.hp(A1)).toBe(85);
  });

  it('High Noon: the target is Taunted by the user; no other enemy can target the user', () => {
    const a = arena({ p0: [['taunt.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.sun', B1).end();
    expect(a.has(B1, 'taunt')).toBe(true);
    expect(a.reject(() => a.use(B2, 'shot', A1))).toBe('bad_target');
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target'); // Taunted onto the user
    a.use(B1, 'shot', A1).use(B2, 'shot', A2).end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([85, 85]);
  });

  it('High Noon: other enemies can\'t damage the user, even with AoE', () => {
    const a = arena({ p0: [['taunt.sun'], ['shot']], p1: [['shot'], ['blast']] });
    a.use(A1, 'taunt.sun', B1).end().use(B2, 'blast').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([100, 65]);
  });

  it('High Noon: lasts 2 turns', () => {
    const a = arena({ p0: [['taunt.sun'], ['shot']], p1: [['shot'], ['shot']] });
    a.use(A1, 'taunt.sun', B1).end().pass(4);
    a.use(B2, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });

  it('Red Giant: Immune; gains 15 max HP and heals 15 at the start of each of the user\'s turns', () => {
    const a = arena({ p0: [['titan.sun']], p1: [['curse']] });
    a.use(A1, 'titan.sun').end();
    a.use(B1, 'curse', A1).end();
    expect(a.has(A1, 'confusion')).toBe(false);
    expect([a.unit(A1).maxHp, a.hp(A1)]).toEqual([115, 115]);
    a.pass(2);
    expect([a.unit(A1).maxHp, a.hp(A1)]).toEqual([130, 130]);
  });

  it('Red Giant: when it ends, the user loses that max HP and every enemy takes as much damage', () => {
    const a = arena({ p0: [['titan.sun']], p1: [['shot'], ['shot']] });
    a.use(A1, 'titan.sun').end().pass(4); // starts of turns 3 and 5: +30
    expect(a.unit(A1).maxHp).toBe(130);
    a.pass(1); // ends at the end of turn 6
    expect([a.unit(A1).maxHp, a.has(A1, 'immune')]).toEqual([100, false]);
    expect([a.hp(B1), a.hp(B2)]).toEqual([70, 70]);
  });
});

describe('Sun costs and cooldowns (kit table)', () => {
  const kit: Record<string, [string, number]> = {
    strike: ['W', 0], smash: ['Sr', 2], charge: ['S', 2], riposte: ['r', 2], rage: ['SS', 4],
    shot: ['r', 0], snipe: ['Sr', 2], trap: ['A', 3], maneuver: ['r', 3], companion: ['I', 1],
    bolt: ['Ir', 1], blast: ['Irr', 2], consume: ['W', 2], summon: ['S', 1], channel: ['Ir', 3],
    stab: ['r', 0], ravage: ['Wr', 2], mislead: ['S', 2], stun: ['Ar', 3], dance: ['Ar', 4],
    heal: ['r', 1], bless: ['r', 2], curse: ['r', 2], smite: ['W', 1], prayer: ['Srr', 2],
    cleave: ['S', 1], shout: ['S', 3], withstand: ['r', 3], taunt: ['r', 3], titan: ['WW', 4],
  };
  it.each(Object.entries(kit))('%s.sun', (arch, [cost, cd]) => {
    const s = content.skills[`${arch}.sun`]!;
    expect([formatCost(s.cost), s.cooldown]).toEqual([cost, cd]);
  });
  it('minion skills: Scatter Seeds and Brighten cost r', () => {
    expect(formatCost(content.skills.sunflower_scatter_seeds!.cost)).toBe('r');
    expect(formatCost(content.skills.sunseed_brighten!.cost)).toBe('r');
  });
});
