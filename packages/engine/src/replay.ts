// Replays: a match is fully described by its config (seed + teams) and its command log.

import { applyCommand } from './commands.js';
import type { ContentBundle } from './defs.js';
import { createMatch, ENGINE_VERSION } from './match.js';
import type { GameEvent, GameState, MatchRecord } from './types.js';

export function replay(content: ContentBundle, record: MatchRecord): { state: GameState; events: GameEvent[] } {
  if (record.contentVersion !== content.version) {
    throw new Error(`Replay needs content ${record.contentVersion}, got ${content.version}`);
  }
  if (record.engineVersion !== ENGINE_VERSION) {
    throw new Error(`Replay needs engine ${record.engineVersion}, running ${ENGINE_VERSION}`);
  }
  let { state, events } = createMatch(content, record.config);
  const all = [...events];
  for (const { player, cmd } of record.commands) {
    ({ state, events } = applyCommand(content, state, player, cmd));
    all.push(...events);
  }
  return { state, events: all };
}

/** Stable JSON used to compare states byte-for-byte. */
export function stateFingerprint(state: GameState): string {
  return JSON.stringify(state);
}
