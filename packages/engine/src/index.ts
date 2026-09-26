export * from './types.js';
export * from './defs.js';
export { seedRng, nextInt, nextU32, pick, sample } from './rng.js';
export { compileDuration } from './duration.js';
export {
  parseCost,
  formatCost,
  costTotal,
  sumCosts,
  isPayable,
  isValidAllocation,
  autoAllocate,
  emptyEnergy,
  ZERO_COST,
} from './energy.js';
export { checkQueue } from './commands.js';
export { createMatch, ENGINE_VERSION, DEFAULT_SETTINGS, DEFAULT_HP, MAX_SKILLS } from './match.js';
export { applyCommand, CommandError } from './commands.js';
export { legalQueueCommands, skillAvailability, type QueueCommand, type SkillAvailability } from './legal.js';
export { viewFor, redactEvents, effectDefinition, type PlayerView, type OpponentState } from './view.js';
export { replay, stateFingerprint } from './replay.js';
export { formatEvent, effectName } from './log.js';
export { scripts, type ScriptFn, type Scope } from './ops.js';
export { evaluateNamedCondition } from './conditions.js';

import { applyCommand } from './commands.js';
import type { ContentBundle } from './defs.js';
import { legalQueueCommands } from './legal.js';
import { createMatch } from './match.js';
import { replay } from './replay.js';
import type { Command, GameState, MatchConfig, MatchRecord, PlayerId } from './types.js';
import { viewFor } from './view.js';

/** Convenience wrapper that binds a content bundle. */
export function createEngine(content: ContentBundle) {
  return {
    content,
    createMatch: (config: MatchConfig) => createMatch(content, config),
    apply: (state: GameState, player: PlayerId, cmd: Command) => applyCommand(content, state, player, cmd),
    legalQueueCommands: (state: GameState, player: PlayerId) => legalQueueCommands(content, state, player),
    viewFor: (state: GameState, player: PlayerId) => viewFor(content, state, player),
    replay: (record: MatchRecord) => replay(content, record),
  };
}

export type Engine = ReturnType<typeof createEngine>;
