import { describe, expect, it } from 'vitest';
import { greedyBot, planningState, randomConfig } from '@arena/ai';
import { applyCommand, CommandError, createMatch, stateFingerprint, viewFor, type GameState } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { applyTurnBundle, bundleFromState, parseClientMessage, PROTOCOL_VERSION } from '../src/index.js';

const content = loadContentOrThrow();

describe('parseClientMessage', () => {
  it('accepts valid messages and rejects junk', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, contentVersion: content.version }))).toMatchObject({ t: 'hello' });
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'queue.join', mode: 'arena' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'ping', at: 1, extra: true }))).toBeNull();
    expect(parseClientMessage('x'.repeat(20_000))).toBeNull();
  });
});

describe('turn bundles', () => {
  /** Plays `turns` turns two ways: bot commands applied directly, and via bundles planned on views. */
  function playBoth(seed: number, turns: number): { direct: GameState; bundled: GameState } {
    const config = randomConfig(content, seed);
    let direct = createMatch(content, config).state;
    let bundled = structuredClone(direct);
    const bots = [greedyBot(seed), greedyBot(seed)];
    for (let i = 0; i < turns && direct.phase !== 'finished'; i++) {
      const p = direct.activePlayer;
      const cmds = bots[p]!.planTurn(content, viewFor(content, direct, p));
      for (const cmd of cmds) direct = applyCommand(content, direct, p, cmd).state;

      // The client side: rehearse the same queue on a planning copy of the redacted view.
      let plan = planningState(viewFor(content, bundled, p));
      for (const cmd of cmds.filter((c) => c.t !== 'endTurn')) plan = applyCommand(content, plan, p, cmd).state;
      bundled = applyTurnBundle(content, bundled, p, bundleFromState(plan, p)).state;
    }
    return { direct, bundled };
  }

  it('a bundle planned on the redacted view reproduces direct play exactly', () => {
    for (const seed of [1, 2, 3]) {
      const { direct, bundled } = playBoth(seed, 12);
      expect(stateFingerprint(bundled)).toBe(stateFingerprint(direct));
    }
  });

  it('rejects stale turns and the wrong player, and never mutates the input', () => {
    const state = createMatch(content, randomConfig(content, 5)).state;
    const before = stateFingerprint(state);
    const bundle = { turn: state.turn, queue: [] };
    expect(() => applyTurnBundle(content, state, 1, bundle)).toThrow(CommandError);
    expect(() => applyTurnBundle(content, state, 0, { ...bundle, turn: 7 })).toThrow(/turn 7/);
    expect(() => applyTurnBundle(content, state, 0, { turn: state.turn, queue: [{ actor: 'p1c0', slot: 0, targets: [] }] })).toThrow(CommandError);
    expect(stateFingerprint(state)).toBe(before);
    expect(applyTurnBundle(content, state, 0, bundle).state.activePlayer).toBe(1);
  });
});
