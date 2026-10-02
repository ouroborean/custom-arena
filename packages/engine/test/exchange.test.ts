// The energy exchange (decided 2026-10-03): once per turn, a player may turn 2 energy of one color into
// 1 of another. It can't spend energy their queued skills need, and the opponent never sees it.

import { describe, expect, it } from 'vitest';
import { checkExchange, redactEvents, type Energy } from '../src/index.js';
import { bundle, Match, skill } from './fixture.js';

const noop = skill('noop', 'self', []);
const pricey = skill('pricey', 'self', [], { cost: 'SS' });
const random = skill('random', 'self', [], { cost: 'rr' });
const at = (m: Match, energy: Energy) => {
  m.state.players[m.state.activePlayer].energy = { ...energy };
  return m;
};

describe('exchanging energy', () => {
  it('turns 2 of one color into 1 of another', () => {
    const m = at(new Match(bundle([noop]), [[['noop']], [['noop']]]), { S: 3, A: 0, I: 0, W: 1 });
    m.cmd(0, { t: 'exchange', give: 'S', get: 'I' });
    expect(m.state.players[0].energy).toEqual({ S: 1, A: 0, I: 1, W: 1 });
  });

  it('once per turn, and again next turn', () => {
    const m = at(new Match(bundle([noop]), [[['noop']], [['noop']]]), { S: 6, A: 0, I: 0, W: 0 });
    m.cmd(0, { t: 'exchange', give: 'S', get: 'A' });
    expect(() => m.cmd(0, { t: 'exchange', give: 'S', get: 'W' })).toThrow(/once per turn/);
    m.end().end(); // the opponent's turn, then ours again
    at(m, { S: 6, A: 0, I: 0, W: 0 }).cmd(0, { t: 'exchange', give: 'S', get: 'W' });
    expect(m.state.players[0].energy.W).toBe(1);
  });

  it('needs 2 of the color given, a different color back, and your turn', () => {
    const m = at(new Match(bundle([noop]), [[['noop']], [['noop']]]), { S: 1, A: 2, I: 0, W: 0 });
    expect(() => m.cmd(0, { t: 'exchange', give: 'S', get: 'A' })).toThrow(/needs 2/);
    expect(() => m.cmd(0, { t: 'exchange', give: 'A', get: 'A' })).toThrow(/different/);
    expect(() => m.cmd(1, { t: 'exchange', give: 'A', get: 'S' })).toThrow(/not your turn/i);
    expect(m.state.players[0].energy).toEqual({ S: 1, A: 2, I: 0, W: 0 }); // nothing changed
  });

  it("can't spend energy a queued skill needs, specific or random", () => {
    const m = at(new Match(bundle([noop, pricey, random]), [[['pricey'], ['random']], [['noop']]]), { S: 3, A: 0, I: 0, W: 0 });
    m.use('p0c0', 0); // reserves SS
    expect(() => m.cmd(0, { t: 'exchange', give: 'S', get: 'A' })).toThrow(/queued skills/); // would leave 1 S
    const r = at(new Match(bundle([noop, pricey, random]), [[['pricey'], ['random']], [['noop']]]), { S: 2, A: 0, I: 0, W: 0 });
    r.use('p0c1', 0); // reserves 2 random: all the energy there is
    expect(() => r.cmd(0, { t: 'exchange', give: 'S', get: 'A' })).toThrow(/queued skills/); // would leave 1
    const ok = at(new Match(bundle([noop, pricey, random]), [[['pricey'], ['random']], [['noop']]]), { S: 2, A: 1, I: 0, W: 0 });
    ok.use('p0c1', 0).cmd(0, { t: 'exchange', give: 'S', get: 'A' }); // 3 → 2, still enough for 2 random
    expect(ok.state.players[0].energy).toEqual({ S: 0, A: 2, I: 0, W: 0 });
  });

  it('the exchanged energy pays for skills', () => {
    const m = at(new Match(bundle([noop, pricey]), [[['pricey']], [['noop']]]), { S: 1, A: 0, I: 0, W: 2 });
    expect(() => m.use('p0c0', 0)).toThrow(/energy/);
    m.cmd(0, { t: 'exchange', give: 'W', get: 'S' }).use('p0c0', 0).end();
    expect(m.state.players[0].energy.S).toBe(0);
  });

  it('the opponent never sees an exchange', () => {
    const m = at(new Match(bundle([noop]), [[['noop']], [['noop']]]), { S: 2, A: 0, I: 0, W: 0 });
    m.cmd(0, { t: 'exchange', give: 'S', get: 'I' });
    const e = m.events.filter((x) => x.t === 'energyExchanged');
    expect(e).toHaveLength(1);
    expect(redactEvents(e, 1)).toEqual([]);
    expect(redactEvents(e, 0)).toHaveLength(1);
  });

  it('checkExchange answers without changing anything', () => {
    const m = at(new Match(bundle([noop]), [[['noop']], [['noop']]]), { S: 2, A: 0, I: 0, W: 0 });
    expect(checkExchange(m.state, 0, 'S', 'A')).toBeNull();
    expect(checkExchange(m.state, 0, 'A', 'S')?.code).toBe('no_energy');
    expect(m.state.players[0].exchanged).toBeUndefined();
  });
});
