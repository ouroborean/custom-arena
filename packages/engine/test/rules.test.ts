// Rule-level tests for decisions Q1–Q17 / R1–R10 that the base skills alone don't exercise.

import { describe, expect, it } from 'vitest';
import { redactEvents, viewFor, type EffectDef } from '../src/index.js';
import { bundle, Match, skill } from './fixture.js';

const hit = (n: number, type?: 'Normal' | 'Piercing' | 'Affliction') =>
  skill(`hit${n}${type ?? ''}`, 'enemy', [{ op: 'damage', to: 'primary', amount: n, ...(type ? { type } : {}) }]);
const noop = skill('noop', 'self', []);

describe('turn flow and energy', () => {
  it('gives 1 energy on the first turn, then 1 per living character (not minions)', () => {
    const m = new Match(bundle([noop]), [[['noop'], ['noop'], ['noop']], [['noop'], ['noop']]]);
    const gains = () => m.events.filter((e) => e.t === 'energyGained');
    const total = (e: (typeof m.events)[number]) =>
      e.t === 'energyGained' ? e.gained.S + e.gained.A + e.gained.I + e.gained.W : 0;
    expect(total(gains()[0]!)).toBe(1);
    m.end();
    expect(total(gains()[1]!)).toBe(2);
    m.end();
    expect(total(gains()[2]!)).toBe(3);
  });

  it('energy persists between turns with no cap (Q2)', () => {
    const m = new Match(bundle([noop]), [[['noop']], [['noop']]]);
    m.state.players[0].energy = { S: 30, A: 0, I: 0, W: 0 };
    m.end().end();
    expect(m.state.players[0].energy.S).toBeGreaterThanOrEqual(30);
  });

  it('draws at the turn limit (R3)', () => {
    const m = new Match(bundle([noop]), [[['noop']], [['noop']]]);
    m.state.settings.turnLimitPerPlayer = 2;
    m.end().end().end().end();
    expect(m.state.result).toEqual({ winner: null, reason: 'turnLimit' });
  });

  it('surrender ends the match for the other player', () => {
    const m = new Match(bundle([noop]), [[['noop']], [['noop']]]);
    m.cmd(1, { t: 'surrender' });
    expect(m.state.result).toEqual({ winner: 0, reason: 'surrender' });
  });

  it('mutual elimination is a draw (Q9)', () => {
    const riposte: EffectDef = {
      id: 'thorns',
      name: 'Thorns',
      kind: 'Buff',
      triggers: [{ on: 'damaged', do: [{ op: 'damage', to: 'eventSource', amount: 100 }] }],
    };
    const c = bundle([hit(100)], { statuses: { thorns: riposte } });
    const m = new Match(c, [[['hit100']], [['hit100']]]);
    m.give('p1c0', 'thorns');
    m.use('p0c0', 0, 'p1c0').end();
    expect(m.state.result).toEqual({ winner: null, reason: 'draw' });
  });
});

describe('cooldowns (Q15)', () => {
  it('CD n locks the next n own turns; CD 0 is usable every turn', () => {
    const c = bundle([skill('cd2', 'self', [], { cd: 2 }), skill('cd0', 'self', [])]);
    const m = new Match(c, [[['cd2'], ['cd0']], [['cd2']]]);
    m.use('p0c0', 0).use('p0c1', 0).end(); // T1
    m.end(); // T2
    expect(() => m.use('p0c0', 0)).toThrow(/cooldown/); // T3 locked
    m.use('p0c1', 0).end(); // cd0 fine
    m.end();
    expect(() => m.use('p0c0', 0)).toThrow(/cooldown/); // T5 locked
    m.end().end();
    m.use('p0c0', 0); // T7 usable
  });
});

describe('damage types (Q5) and Shattered (Q10)', () => {
  const c = bundle([hit(30), hit(30, 'Piercing'), hit(30, 'Affliction')]);
  const fresh = () => {
    const m = new Match(c, [[['hit30', 'hit30Piercing', 'hit30Affliction']], [['hit30']]]);
    m.give('p1c0', 'armor', 2).give('p1c0', 'shield', 1, 10);
    return m;
  };

  it('Normal: reduced by Armor, then absorbed by Shield', () => {
    const m = fresh();
    m.use('p0c0', 0, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(100 - (30 - 10 - 10));
  });

  it('Piercing: ignores Armor, absorbed by Shield', () => {
    const m = fresh();
    m.use('p0c0', 1, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(100 - (30 - 10));
  });

  it('Affliction: ignores both', () => {
    const m = fresh();
    m.use('p0c0', 2, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(70);
  });

  it('Shattered: no benefit from Armor or Shield', () => {
    const m = fresh().give('p1c0', 'shattered');
    m.use('p0c0', 0, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(70);
  });

  it('Might boosts only direct damage', () => {
    const tick: EffectDef = {
      id: 'burn',
      name: 'Burn',
      kind: 'Debuff',
      triggers: [{ on: 'turnEnd', do: [{ op: 'damage', to: 'bearer', amount: 5 }] }],
    };
    const c2 = bundle(
      [hit(10), skill('burn', 'enemy', [{ op: 'apply', to: 'primary', effect: 'burn' }])],
      { statuses: { burn: tick } },
    );
    const m = new Match(c2, [[['hit10'], ['burn']], [['hit10']]]);
    m.give('p0c0', 'might', 2).give('p0c1', 'might', 2);
    m.use('p0c0', 0, 'p1c0').use('p0c1', 0, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(100 - 20 - 5); // tick is indirect: no Might
  });
});

describe('Invulnerable vs indirect damage (Q10, Q14)', () => {
  const dot = (type: 'Normal' | 'Affliction', respects = false): EffectDef => ({
    id: `dot${type}${respects ? 'R' : ''}`,
    name: 'Dot',
    kind: 'Debuff',
    ...(respects ? { respectsInvulnerable: true } : {}),
    triggers: [{ on: 'turnEnd', do: [{ op: 'damage', to: 'bearer', amount: 10, type }] }],
  });
  const defs = [dot('Normal'), dot('Affliction'), dot('Affliction', true)];
  const c = bundle(
    defs.map((d) => skill(d.id, 'enemy', [{ op: 'apply', to: 'primary', effect: d.id }])),
    { statuses: Object.fromEntries(defs.map((d) => [d.id, d])) },
  );

  it('blocks Normal ticks, lets Affliction through, except for effects flagged like Explode', () => {
    const m = new Match(c, [[['dotNormal'], ['dotAffliction'], ['dotAfflictionR']], [['dotNormal']]]);
    m.use('p0c0', 0, 'p1c0').use('p0c1', 0, 'p1c0').use('p0c2', 0, 'p1c0');
    // Make the target Invulnerable after the effects land but before ticks: give it now.
    m.give('p1c0', 'invulnerable');
    // Targeting an Invulnerable enemy is illegal, so apply the dots via state for this check.
    m.state.players[0].queue = [];
    for (const d of defs) {
      m.state.effects.push({
        id: `x${d.id}`,
        defId: d.id,
        source: 'p0c0',
        sourceOwner: 0,
        bearer: 'p1c0',
        stacks: 1,
        value: 0,
        duration: null,
        targets: [],
        revealed: false,
        data: {},
        seq: 99,
      });
    }
    m.end();
    expect(m.hp('p1c0')).toBe(90); // only the plain Affliction tick
  });
});

describe('pre-use failures (Q7, R1) and cost increases (§3.4)', () => {
  it('a unit stunned mid-resolution keeps its energy spent and starts no cooldown', () => {
    const stunAll: EffectDef = {
      id: 'stunback',
      name: 'Stunback',
      kind: 'Buff',
      triggers: [
        { on: 'damaged', do: [{ op: 'apply', to: 'allEnemies', effect: 'stun', duration: { enemyTurns: 1 } }] },
      ],
    };
    const c = bundle([hit(10), skill('big', 'enemy', [{ op: 'damage', to: 'primary', amount: 40 }], { cost: 'II', cd: 3 })], {
      statuses: { stunback: stunAll },
    });
    const m = new Match(c, [[['hit10'], ['big']], [['hit10']]]);
    m.give('p1c0', 'stunback');
    m.state.players[0].energy = { S: 0, A: 0, I: 2, W: 0 };
    m.use('p0c0', 0, 'p1c0').use('p0c1', 0, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(90);
    const big = m.state.units.find((u) => u.id === 'p0c1')!.skills[0]!;
    expect(big.cooldown).toBe(0);
    expect(m.events.some((e) => e.t === 'skillFailed' && e.reason === 'stunned' && !e.refunded)).toBe(true);
    expect(m.state.players[0].energy.I).toBe(0);
  });

  it('a skill whose cost rose before it resolved fails and is refunded', () => {
    const confuseAll: EffectDef = {
      id: 'confuseback',
      name: 'Confuseback',
      kind: 'Buff',
      triggers: [{ on: 'damaged', do: [{ op: 'apply', to: 'allEnemies', effect: 'confusion', duration: { enemyTurns: 1 } }] }],
    };
    const c = bundle([hit(10), skill('pricey', 'enemy', [{ op: 'damage', to: 'primary', amount: 40 }], { cost: 'r' })], {
      statuses: { confuseback: confuseAll },
    });
    const m = new Match(c, [[['hit10'], ['pricey']], [['hit10']]]);
    m.give('p1c0', 'confuseback');
    m.state.players[0].energy = { S: 0, A: 0, I: 0, W: 1 };
    m.use('p0c0', 0, 'p1c0').use('p0c1', 0, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(90);
    expect(m.events.some((e) => e.t === 'skillFailed' && e.refunded)).toBe(true);
    expect(m.state.players[0].energy.W).toBe(1);
  });
});

describe('Reflect (Q10)', () => {
  it('negates the skill and applies it to its user', () => {
    const mirror: EffectDef = {
      id: 'mirror',
      name: 'Mirror',
      kind: 'Buff',
      triggers: [{ on: 'skillTargeted', when: { harmful: true }, intercept: 'reflect' }],
    };
    const c = bundle([hit(20)], { statuses: { mirror } });
    const m = new Match(c, [[['hit20']], [['hit20']]]);
    m.give('p1c0', 'mirror');
    m.use('p0c0', 0, 'p1c0').end();
    expect(m.hp('p1c0')).toBe(100);
    expect(m.hp('p0c0')).toBe(80);
  });
});

describe('commands', () => {
  it('reorders the queue and validates allocations', () => {
    const c = bundle([hit(10), skill('rr', 'self', [], { cost: 'rr' })]);
    const m = new Match(c, [[['hit10'], ['rr']], [['hit10']]]);
    m.state.players[0].energy = { S: 1, A: 1, I: 0, W: 0 };
    m.use('p0c0', 0, 'p1c0').use('p0c1', 0);
    m.cmd(0, { t: 'reorder', order: [1, 0] });
    expect(m.state.players[0].queue[0]?.actor).toBe('p0c1');
    expect(() => m.cmd(0, { t: 'endTurn', allocation: { S: 2, A: 0, I: 0, W: 0 } })).toThrow(/allocation/);
    m.cmd(0, { t: 'endTurn', allocation: { S: 1, A: 1, I: 0, W: 0 } });
    expect(m.state.players[0].energy).toEqual({ S: 0, A: 0, I: 0, W: 0 });
  });

  it('rejects commands from the inactive player and after the match ends', () => {
    const m = new Match(bundle([noop]), [[['noop']], [['noop']]]);
    expect(() => m.cmd(1, { t: 'endTurn' })).toThrow(/not your turn/);
    m.cmd(0, { t: 'surrender' });
    expect(() => m.cmd(1, { t: 'endTurn' })).toThrow(/over/);
  });

  it('never mutates the input state', () => {
    const m = new Match(bundle([hit(10)]), [[['hit10']], [['hit10']]]);
    const before = JSON.stringify(m.state);
    const snapshot = m.state;
    m.use('p0c0', 0, 'p1c0').end();
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

describe('hidden information (§3.11, Q11, Q12)', () => {
  it('hides the opponent’s energy, queue, rng and Invisible effects', () => {
    const secret: EffectDef = { id: 'secret', name: 'Secret', kind: 'Buff', visibility: 'hidden' };
    const c = bundle([skill('hide', 'self', [{ op: 'apply', to: 'actor', effect: 'secret', duration: { enemyTurns: 1 } }], { tags: ['Helpful', 'Strategic', 'Invisible'] })], {
      statuses: { secret },
    });
    const m = new Match(c, [[['hide']], [['hide']]]);
    m.use('p0c0', 0);
    const opp = viewFor(c, m.state, 1);
    expect(opp.players[0].energy).toBeNull();
    expect(opp.players[0].queue).toEqual([]);
    expect('rng' in opp).toBe(false);
    m.end();
    expect(viewFor(c, m.state, 1).effects).toHaveLength(0);
    expect(viewFor(c, m.state, 0).effects).toHaveLength(1);
    const theirs = redactEvents(m.events, 1);
    expect(theirs.some((e) => e.t === 'skillUsed')).toBe(false);
    expect(theirs.some((e) => e.t === 'effectApplied')).toBe(false);
  });
});
