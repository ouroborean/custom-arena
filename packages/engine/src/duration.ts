// Duration compilation (GDD §3.8, decision Q1).
//
// Every effect's internal duration drops by 1 at the end of EVERY player turn, and the effect is
// removed when it reaches 0. Authors write intent; this turns it into the tick count, based on
// whether the applier's side is the one currently taking its turn.

import type { DurationSpec } from './defs.js';
import type { PlayerId } from './types.js';

export function compileDuration(
  spec: DurationSpec | undefined,
  applierOwner: PlayerId,
  activePlayer: PlayerId,
): number | null {
  if (spec === undefined || spec === 'permanent') return null;
  if ('raw' in spec) return spec.raw;
  if ('thisTurn' in spec) return 1;
  const applierIsActive = applierOwner === activePlayer;
  if ('enemyTurns' in spec) {
    // Applied on own turn: rest of this turn + N enemy turns = 2N.
    // Applied on the enemy's turn: rest of it + N more enemy turns = 2N + 1.
    return applierIsActive ? 2 * spec.enemyTurns : 2 * spec.enemyTurns + 1;
  }
  // ownTurns: N more of the applier's own turns.
  return applierIsActive ? 2 * spec.ownTurns + 1 : 2 * spec.ownTurns;
}
