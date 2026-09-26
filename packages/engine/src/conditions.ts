// Evaluates content-defined named conditions (e.g. Poison's "prey") outside of a skill, for UI badges.

import { makeCtx } from './ctx.js';
import type { ContentBundle } from './defs.js';
import { evalCond } from './ops.js';
import type { GameState } from './types.js';
import type { PlayerView } from './view.js';

/** True if `unitId` satisfies the named condition. Works on a full state or a player view. */
export function evaluateNamedCondition(content: ContentBundle, state: GameState | PlayerView, name: string, unitId: string): boolean {
  const cond = content.conditions[name];
  if (!cond) return false;
  const ctx = makeCtx(state as GameState, content);
  return evalCond(ctx, cond, {
    actor: unitId,
    targets: [],
    it: unitId,
    vars: {},
    lastDamage: 0,
    lastDamaged: [],
    direct: false,
    bypass: false,
  });
}
