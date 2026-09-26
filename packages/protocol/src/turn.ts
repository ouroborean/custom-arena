// Turn bundles: the client's planned turn as one message (GDD §11.7 "local-first planning").

import {
  applyCommand,
  CommandError,
  type Command,
  type ContentBundle,
  type Energy,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '@arena/engine';
import type { TurnBundle } from './index.js';

/** The bundle describing a planning state's current queue (client side). */
export function bundleFromState(state: GameState, player: PlayerId, allocation?: Energy): TurnBundle {
  const ps = state.players[player];
  return {
    turn: state.turn,
    queue: ps.queue.map((q) => ({ actor: q.actor, slot: q.slot, targets: [...q.targets] })),
    ...(ps.tickOrder ? { tickOrder: [...ps.tickOrder] } : {}),
    ...(allocation ? { allocation } : {}),
  };
}

export interface AppliedTurn {
  state: GameState;
  events: GameEvent[];
  /** The engine commands the bundle expanded to, for the replay log. */
  commands: Command[];
}

/**
 * Applies a bundle atomically (server side): queue each action in order, set the tick order, end
 * the turn. Throws CommandError on the first invalid step; the input state is never modified.
 */
export function applyTurnBundle(content: ContentBundle, state: GameState, player: PlayerId, bundle: TurnBundle): AppliedTurn {
  if (state.phase === 'finished') throw new CommandError('finished', 'The match is over');
  if (state.activePlayer !== player) throw new CommandError('not_your_turn', "It isn't your turn");
  if (bundle.turn !== state.turn) throw new CommandError('stale_turn', `That plan was for turn ${bundle.turn}; it's turn ${state.turn}`);
  const commands: Command[] = [
    ...bundle.queue.map((q): Command => ({ t: 'queue', actor: q.actor, slot: q.slot, targets: q.targets })),
    ...(bundle.tickOrder ? [{ t: 'setTickOrder', order: bundle.tickOrder } as Command] : []),
    bundle.allocation ? { t: 'endTurn', allocation: bundle.allocation } : { t: 'endTurn' },
  ];
  let s = state;
  const events: GameEvent[] = [];
  for (const cmd of commands) {
    const r = applyCommand(content, s, player, cmd);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events, commands };
}
