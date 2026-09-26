// One scenario per base skill, written from its sheet description (GDD §12.3).
// Units: A1..A3 = p0c0..p0c2 (player 1, acts on odd turns), B1..B3 = p1c0..p1c2.

import { describe, expect, it } from 'vitest';
import { viewFor } from '@arena/engine';
import { arena, content } from './harness.js';

const A1 = 'p0c0';
const A2 = 'p0c1';
const B1 = 'p1c0';
const B2 = 'p1c1';
const B3 = 'p1c2';

describe('Strike', () => {
  it('deals 20 and grants 1 permanent Might, which boosts later direct damage', () => {
    const a = arena({ p0: [['strike']], p1: [['shot']] });
    a.use(A1, 'strike', B1).end();
    expect(a.hp(B1)).toBe(80);
    expect(a.stacks(A1, 'might')).toBe(1);
    a.pass().use(A1, 'strike', B1).end();
    expect(a.hp(B1)).toBe(55); // 20 + 5 Might
    expect(a.stacks(A1, 'might')).toBe(2);
    a.pass(10);
    expect(a.stacks(A1, 'might')).toBe(2); // no stated duration → permanent (Q16)
  });
});

describe('Smash', () => {
  it('deals 25 to the target and 15 to each of its allies', () => {
    const a = arena({ p0: [['smash']], p1: [['shot'], ['shot'], ['shot']] });
    a.use(A1, 'smash', B2).end();
    expect([a.hp(B1), a.hp(B2), a.hp(B3)]).toEqual([85, 75, 85]);
  });
});

describe('Charge', () => {
  it('deals 15 and gives Focus that discounts the next skill, then ends', () => {
    const a = arena({ p0: [['charge', 'shot']], p1: [['shot']] });
    a.use(A1, 'charge', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.stacks(A1, 'focus')).toBe(1);
    a.pass();
    a.use(A1, 'shot', B1);
    expect(a.state.players[0].queue[0]?.cost.r).toBe(0); // r reduced by Focus
    a.end();
    expect(a.has(A1, 'focus')).toBe(false);
  });
});

describe('Riposte', () => {
  it('counters every Harmful skill used on the user for the enemy turn, dealing 15 each', () => {
    const a = arena({ p0: [['riposte']], p1: [['strike'], ['shot']] });
    a.use(A1, 'riposte').end();
    // Hidden from the opponent until triggered.
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === A1)).toBe(false);
    a.use(B1, 'strike', A1).use('p1c1', 'shot', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.hp(B1)).toBe(85);
    expect(a.hp('p1c1')).toBe(85);
    expect(a.cooldown(B1, 'strike')).toBe(0); // countered skills still start their cooldown (cd 0 → 1 → ticked)
    expect(a.has(A1, 'riposte')).toBe(false); // expired at the end of the enemy turn
    expect(a.events.some((e) => e.t === 'effectRevealed')).toBe(true);
  });

  it('lets Helpful skills through and expires untriggered with a public notice', () => {
    const a = arena({ p0: [['riposte']], p1: [['shot']] });
    a.use(A1, 'riposte').end().end();
    const removed = a.events.find((e) => e.t === 'effectRemoved' && e.defId === 'riposte:riposte');
    expect(removed?.visibleTo).toBeUndefined();
  });
});

describe('Rage', () => {
  it('grants 2 Might and Immune for 3 turns', () => {
    const a = arena({ p0: [['rage', 'shot']], p1: [['stun']] });
    a.use(A1, 'rage').end();
    expect(a.stacks(A1, 'might')).toBe(2);
    a.use(B1, 'stun', A1).end();
    expect(a.hp(A1)).toBe(85);
    expect(a.has(A1, 'stun')).toBe(false); // Immune blocked the Stun
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(75); // 15 + 10 Might
    a.pass(2); // turns 4, 5
    expect(a.has(A1, 'might')).toBe(true);
    a.pass(); // turn 6 ends: 6 ticks elapsed
    expect(a.has(A1, 'might')).toBe(false);
    expect(a.has(A1, 'immune')).toBe(false);
  });
});

describe('Shot', () => {
  it('deals 15', () => {
    const a = arena({ p0: [['shot']], p1: [['shot']] });
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(85);
  });
});

describe('Snipe', () => {
  it('hits for 50 at the end of the following turn, with the target hidden from the opponent', () => {
    const a = arena({ p0: [['snipe']], p1: [['shot']] });
    a.use(A1, 'snipe', B1).end();
    expect(a.hp(B1)).toBe(100);
    const seen = viewFor(content, a.state, 1).effects.find((e) => e.bearer === A1);
    expect(seen?.targets).toEqual([]);
    expect(a.state.effects.find((e) => e.bearer === A1)?.targets).toEqual([B1]);
    const used = a.events.find((e) => e.t === 'skillUsed' && e.skill === 'snipe');
    expect(used && used.t === 'skillUsed' && used.secretFrom).toBe(1);
    a.end();
    expect(a.hp(B1)).toBe(50);
  });

  it('is interrupted by a Stun before it fires', () => {
    const a = arena({ p0: [['snipe']], p1: [['stun']] });
    a.use(A1, 'snipe', B1).end();
    a.use(B1, 'stun', A1).end();
    expect(a.hp(B1)).toBe(100);
    expect(a.events.some((e) => e.t === 'effectRemoved' && e.reason === 'interrupted')).toBe(true);
  });

  it('cannot hit a target that became Invulnerable', () => {
    const a = arena({ p0: [['snipe']], p1: [['maneuver']] });
    a.use(A1, 'snipe', B1).end();
    a.use(B1, 'maneuver').end();
    expect(a.hp(B1)).toBe(100);
  });
});

describe('Trap', () => {
  it('damages the target for 15 the next time it uses a Harmful skill, which still resolves', () => {
    const a = arena({ p0: [['trap']], p1: [['shot', 'heal']] });
    a.use(A1, 'trap', B1).end();
    expect(viewFor(content, a.state, 1).effects.some((e) => e.bearer === B1)).toBe(false);
    a.use(B1, 'heal', B1).end(); // Helpful: no trigger
    expect(a.has(B1, 'trap')).toBe(true);
    a.pass().use(B1, 'shot', A1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.hp(A1)).toBe(85);
    expect(a.has(B1, 'trap')).toBe(false);
  });
});

describe('Maneuver', () => {
  it('makes the user Invulnerable through the enemy turn', () => {
    const a = arena({ p0: [['maneuver'], ['companion']], p1: [['shot'], ['blast']] });
    a.use(A1, 'maneuver').end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('bad_target');
    a.use('p1c1', 'blast').end();
    expect(a.hp(A1)).toBe(100); // excluded from AoE
    expect(a.hp(A2)).toBe(65);
    expect(a.has(A1, 'invulnerable')).toBe(false);
  });

  it('blocks indirect enemy damage but not Affliction', () => {
    const a = arena({ p0: [['companion']], p1: [['maneuver']] });
    a.pass(); // turn 1
    a.use(B1, 'maneuver').end(); // turn 2
    a.use(A1, 'companion').end(); // turn 3: wolf ticks at end of turn → blocked
    expect(a.hp(B1)).toBe(100);
  });
});

describe('Companion', () => {
  it('summons a permanent Wolf that bites a random enemy at the end of each owner turn', () => {
    const a = arena({ p0: [['companion']], p1: [['shot']] });
    a.use(A1, 'companion').end();
    expect(a.state.units.filter((u) => u.kind === 'minion' && u.alive)).toHaveLength(1);
    expect(a.hp(B1)).toBe(90);
    a.pass(2);
    expect(a.hp(B1)).toBe(80);
  });

  it('does not generate energy and respects the minion cap of 4', () => {
    const a = arena({ p0: [['companion']], p1: [['shot']], richEnergy: false, hp: 1000 });
    for (let i = 0; i < 6 && a.state.phase !== 'finished'; i++) {
      a.state.players[0].energy.A = 5;
      a.use(A1, 'companion').end();
      a.pass(3); // cd 1: locked on the next own turn, usable on the one after
    }
    const wolves = a.state.units.filter((u) => u.kind === 'minion' && u.owner === 0 && u.alive);
    expect(wolves).toHaveLength(4);
    expect(a.events.some((e) => e.t === 'effectBlocked' && e.reason === 'minion cap reached')).toBe(true);
    const gains = a.events.filter((e) => e.t === 'energyGained' && e.player === 0).slice(1);
    for (const g of gains) if (g.t === 'energyGained') expect(g.gained.S + g.gained.A + g.gained.I + g.gained.W).toBe(1);
  });
});

describe('Bolt', () => {
  it('deals 25 and Marks; the next direct hit this turn triggers +10 and consumes the Mark', () => {
    const a = arena({ p0: [['bolt'], ['shot']], p1: [['shot']] });
    a.use(A1, 'bolt', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 25 - 15 - 10);
    expect(a.has(B1, 'mark')).toBe(false);
  });

  it("the Mark lasts through the enemy's turn only", () => {
    const a = arena({ p0: [['bolt']], p1: [['shot']] });
    a.use(A1, 'bolt', B1).end();
    expect(a.has(B1, 'mark')).toBe(true);
    a.end();
    expect(a.has(B1, 'mark')).toBe(false);
  });
});

describe('Blast', () => {
  it('deals 35 to all enemies', () => {
    const a = arena({ p0: [['blast']], p1: [['shot'], ['shot']] });
    a.use(A1, 'blast').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([65, 65]);
  });
});

describe('Consume', () => {
  it('deals 5 and heals the user for the damage dealt', () => {
    const a = arena({ p0: [['consume']], p1: [['shot']] });
    a.setHp(A1, 50).use(A1, 'consume', B1).end();
    expect(a.hp(B1)).toBe(95);
    expect(a.hp(A1)).toBe(55);
  });

  it('heals 10 more against a Marked target', () => {
    const a = arena({ p0: [['consume'], ['bolt']], p1: [['shot']] });
    a.setHp(A1, 50).use(A2, 'bolt', B1).use(A1, 'consume', B1).end();
    expect(a.hp(A1)).toBe(65);
    expect(a.hp(B1)).toBe(100 - 25 - 5 - 10);
  });

  it('heals 10 more against a target affected by a Curse skill', () => {
    const a = arena({ p0: [['consume'], ['curse']], p1: [['shot']] });
    a.setHp(A1, 50).use(A2, 'curse', B1).use(A1, 'consume', B1).end();
    expect(a.hp(A1)).toBe(65);
  });
});

describe('Summon', () => {
  it('summons an Arcane Familiar that hits for 15 on each of 3 owner turns, then leaves', () => {
    const a = arena({ p0: [['summon']], p1: [['shot']] });
    a.use(A1, 'summon').end();
    expect(a.hp(B1)).toBe(85);
    a.pass(4); // turns 2–5 → hits at the end of turns 3 and 5
    expect(a.hp(B1)).toBe(55);
    const fam = a.state.units.find((u) => u.kind === 'minion');
    expect(fam?.alive).toBe(true);
    a.pass(); // turn 6: lifetime ends
    expect(fam && a.unit(fam.id).alive).toBe(false);
  });
});

describe('Channel', () => {
  it('deals 10 to all enemies at the end of 2 of the user’s turns', () => {
    const a = arena({ p0: [['channel']], p1: [['shot'], ['shot']] });
    a.use(A1, 'channel').end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([90, 90]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
    a.pass(2);
    expect([a.hp(B1), a.hp(B2)]).toEqual([80, 80]);
    expect(a.has(A1, 'channel')).toBe(false);
  });

  it('extends by a turn if a damaged target is Marked', () => {
    const a = arena({ p0: [['channel'], ['bolt']], p1: [['shot']] });
    a.use(A2, 'bolt', B1).use(A1, 'channel').end(); // channel damage is indirect: the Mark stays
    a.pass(4);
    expect(a.hp(B1)).toBe(100 - 25 - 10 * 3);
  });

  it('ends when the user uses another skill', () => {
    const a = arena({ p0: [['channel', 'shot']], p1: [['shot']] });
    a.use(A1, 'channel').end().pass();
    a.use(A1, 'shot', B1).end();
    expect(a.hp(B1)).toBe(100 - 10 - 15);
  });
});

describe('Stab', () => {
  it('deals 10, or 20 against targets at or below 60 health', () => {
    const a = arena({ p0: [['stab']], p1: [['shot']] });
    a.use(A1, 'stab', B1).end().pass();
    expect(a.hp(B1)).toBe(90);
    a.setHp(B1, 60).use(A1, 'stab', B1).end();
    expect(a.hp(B1)).toBe(40);
  });
});

describe('Ravage', () => {
  it('deals 25 Piercing (ignores Armor), 40 against Stunned targets', () => {
    const a = arena({ p0: [['ravage'], ['stun']], p1: [['titan']] });
    a.pass();
    a.use(B1, 'titan').end();
    a.use(A1, 'ravage', B1).end();
    expect(a.hp(B1)).toBe(75); // Armor doesn't reduce Piercing
    const b = arena({ p0: [['ravage'], ['stun']], p1: [['shot']] });
    b.use(A2, 'stun', B1).use(A1, 'ravage', B1).end();
    expect(b.hp(B1)).toBe(100 - 15 - 40);
  });
});

describe('Mislead', () => {
  it("counters the target's Harmful skills for its next turn; costs and cooldowns are still spent", () => {
    const a = arena({ p0: [['mislead']], p1: [['bolt', 'heal']], richEnergy: false });
    a.state.players[0].energy.I = 1;
    a.use(A1, 'mislead', B1).end();
    a.state.players[1].energy = { S: 0, A: 0, I: 2, W: 0 };
    a.use(B1, 'bolt', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.state.players[1].energy.I).toBe(0 + 0); // paid; the new turn's energy goes to player 1 (index 0)
    expect(a.cooldown(B1, 'bolt')).toBe(1); // cd 1 → 2 → ticked once
    expect(a.events.some((e) => e.t === 'skillCountered')).toBe(true);
  });

  it('does not counter Helpful skills', () => {
    const a = arena({ p0: [['mislead']], p1: [['heal']] });
    a.use(A1, 'mislead', B1).end();
    a.setHp(B1, 50).use(B1, 'heal', B1).end();
    expect(a.hp(B1)).toBe(75);
  });
});

describe('Stun', () => {
  it('deals 15 and prevents the target from using skills on its next turn', () => {
    const a = arena({ p0: [['stun']], p1: [['shot']] });
    a.use(A1, 'stun', B1).end();
    expect(a.hp(B1)).toBe(85);
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('cannot_act');
    a.end().pass();
    a.use(B1, 'shot', A1).end(); // stun gone by turn 4
    expect(a.hp(A1)).toBe(85);
  });

  it('is negated by Swiftness', () => {
    const a = arena({ p0: [['stun']], p1: [['dance']] });
    a.pass();
    a.use(B1, 'dance').end();
    a.use(A1, 'stun', B1).end();
    expect(a.has(B1, 'stun')).toBe(false);
    expect(a.stacks(B1, 'swiftness')).toBe(1);
  });
});

describe('Dance', () => {
  it('grants 1 Might, 2 Swiftness and 1 Focus for 4 turns', () => {
    const a = arena({ p0: [['dance']], p1: [['shot']] });
    a.use(A1, 'dance').end();
    expect([a.stacks(A1, 'might'), a.stacks(A1, 'swiftness'), a.stacks(A1, 'focus')]).toEqual([1, 2, 1]);
    a.pass(7);
    expect(a.has(A1, 'might')).toBe(false);
  });
});

describe('Heal', () => {
  it('heals 25, capped at max HP', () => {
    const a = arena({ p0: [['heal'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 60).use(A1, 'heal', A2).end();
    expect(a.hp(A2)).toBe(85);
    expect(a.reject(() => a.pass().use(A1, 'heal', A2))).toBe('on_cooldown'); // cd 1: locked next own turn
    a.pass(2).use(A1, 'heal', A2).end();
    expect(a.hp(A2)).toBe(100);
  });
});

describe('Bless', () => {
  it('grants Might and Renew; Renew heals 5 at the end of the applier’s turn and decays', () => {
    const a = arena({ p0: [['bless'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'bless', A2).end();
    expect(a.hp(A2)).toBe(55);
    expect(a.has(A2, 'renew')).toBe(false);
    expect(a.stacks(A2, 'might')).toBe(1);
  });
});

describe('Curse', () => {
  it('Confuses the target: +1 GEN on its skills', () => {
    const a = arena({ p0: [['curse']], p1: [['shot']] });
    a.use(A1, 'curse', B1).end();
    a.use(B1, 'shot', A1);
    expect(a.state.players[1].queue[0]?.cost.r).toBe(2);
  });
});

describe('Smite', () => {
  it('deals 20 and Sanctifies: allies who damage the target heal 15', () => {
    const a = arena({ p0: [['smite'], ['shot']], p1: [['shot']] });
    a.setHp(A2, 50).use(A1, 'smite', B1).use(A2, 'shot', B1).end();
    expect(a.hp(B1)).toBe(65);
    expect(a.hp(A2)).toBe(65);
  });
});

describe('Prayer', () => {
  it('heals all allies 30 and grants them 10 Shield', () => {
    const a = arena({ p0: [['prayer'], ['shot']], p1: [['shot']] });
    a.setHp(A1, 50).setHp(A2, 50).use(A1, 'prayer').end();
    expect([a.hp(A1), a.hp(A2)]).toEqual([80, 80]);
    a.use(B1, 'shot', A2).end();
    expect(a.hp(A2)).toBe(75); // 10 absorbed
    expect(a.has(A2, 'shield')).toBe(false);
  });
});

describe('Cleave', () => {
  it('deals 25 to the target and 15 to a different random enemy', () => {
    const a = arena({ p0: [['cleave']], p1: [['shot'], ['shot']] });
    a.use(A1, 'cleave', B1).end();
    expect([a.hp(B1), a.hp(B2)]).toEqual([75, 85]);
  });
});

describe('Shout', () => {
  it('Intimidates all enemies: their cooldowns start 1 higher', () => {
    const a = arena({ p0: [['shout']], p1: [['shot'], ['bolt']] });
    a.use(A1, 'shout').end();
    a.use(B1, 'shot', A1).end();
    // Shot (cd 0) now locks for the next own turn.
    expect(a.cooldown(B1, 'shot')).toBe(1);
    a.end();
    expect(a.reject(() => a.use(B1, 'shot', A1))).toBe('on_cooldown');
  });
});

describe('Withstand', () => {
  it('grants 25 Shield through the enemy turn', () => {
    const a = arena({ p0: [['withstand']], p1: [['strike']] });
    a.use(A1, 'withstand').end();
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(100);
    expect(a.effects(A1).find((e) => e.defId === 'shield')).toBeUndefined(); // expired
  });
});

describe('Taunt', () => {
  it('forces the target to target the taunter', () => {
    const a = arena({ p0: [['taunt'], ['shot']], p1: [['shot']] });
    a.use(A1, 'taunt', B1).end();
    expect(a.reject(() => a.use(B1, 'shot', A2))).toBe('bad_target');
    a.use(B1, 'shot', A1).end();
    expect(a.hp(A1)).toBe(85);
  });
});

describe('Titan', () => {
  it('grants 3 Armor (−15 Normal damage) and Immune for 3 turns', () => {
    const a = arena({ p0: [['titan']], p1: [['strike', 'stun']] });
    a.use(A1, 'titan').end();
    a.use(B1, 'strike', A1).end();
    expect(a.hp(A1)).toBe(95);
    a.pass().use(B1, 'stun', A1).end();
    expect(a.hp(A1)).toBe(90); // 15 + 5 (B1's Might from Strike) − 15 Armor
    expect(a.has(A1, 'stun')).toBe(false);
  });
});
