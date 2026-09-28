// Checkpoints: opt-in snapshots of the state at points worth showing, so clients can play a turn
// back skill by skill.

import { describe, expect, it } from 'vitest';
import { applyCommand, type GameEvent } from '../src/index.js';
import { bundle, Match, skill } from './fixture.js';

const c = bundle([
  skill('confuse', 'enemy', [{ op: 'apply', to: 'primary', effect: 'confusion', duration: { enemyTurns: 2 } }]),
  skill('might', 'self', [{ op: 'apply', to: 'actor', effect: 'might', duration: { ownTurns: 2 } }]),
]);

describe('checkpoints', () => {
  it('snapshot the state after each skill and at the turn boundaries', () => {
    const m = new Match(c, [[['confuse'], ['might']], [['confuse']]]);
    m.use('p0c0', 0, 'p1c0').use('p0c1', 0);
    const r = applyCommand(c, m.state, 0, { t: 'endTurn' }, { checkpoints: true });
    const marks = r.events.filter((e): e is Extract<GameEvent, { t: 'checkpoint' }> => e.t === 'checkpoint');
    expect(marks.map((e) => e.n)).toEqual(r.checkpoints!.map((_, i) => i));

    // The first checkpoint follows the first skill: Confusion is on, Might isn't yet.
    const first = r.checkpoints![0]!;
    const has = (state: typeof first, defId: string) => state.effects.some((e) => e.defId === defId);
    expect(r.events.indexOf(marks[0]!)).toBeGreaterThan(r.events.findIndex((e) => e.t === 'effectApplied' && e.defId === 'confusion'));
    expect([has(first, 'confusion'), has(first, 'might')]).toEqual([true, false]);
    expect([has(r.checkpoints![1]!, 'confusion'), has(r.checkpoints![1]!, 'might')]).toEqual([true, true]);
    // The last one is the next player's turn start, which is the final state.
    expect(r.checkpoints![r.checkpoints!.length - 1]).toEqual(r.state);
  });

  it('are off by default: no markers, same events otherwise', () => {
    const m = new Match(c, [[['confuse']], [['confuse']]]);
    m.use('p0c0', 0, 'p1c0');
    const plain = applyCommand(c, m.state, 0, { t: 'endTurn' });
    const withCp = applyCommand(c, m.state, 0, { t: 'endTurn' }, { checkpoints: true });
    expect(plain.checkpoints).toBeUndefined();
    expect(plain.events.some((e) => e.t === 'checkpoint')).toBe(false);
    expect(withCp.events.filter((e) => e.t !== 'checkpoint')).toEqual(plain.events);
    expect(withCp.state).toEqual(plain.state);
  });
});
