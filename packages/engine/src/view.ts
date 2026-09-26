// Per-player redaction (GDD §3.11, §11.7). Clients and bots only ever see a PlayerView.

import type { ContentBundle } from './defs.js';
import type { EffectInstance, GameEvent, GameState, PlayerId, PlayerState } from './types.js';

export interface PlayerView extends Omit<GameState, 'rng' | 'players'> {
  viewer: PlayerId;
  players: [PlayerState | OpponentState, PlayerState | OpponentState];
}

/** The opponent's energy pool, queue and tick order are hidden (Q12). */
export interface OpponentState {
  energy: null;
  queue: [];
  tickOrder: null;
  turnsTaken: number;
}

/** The definition behind an effect instance (inline or named status), or undefined if unknown. */
export function effectDefinition(content: ContentBundle, e: EffectInstance): import('./defs.js').EffectDef | undefined {
  return e.inline ?? content.statuses[e.defId];
}

function effectVisibility(content: ContentBundle, e: EffectInstance): 'public' | 'hidden' | 'hiddenTarget' {
  const def = e.inline ?? content.statuses[e.defId];
  return def?.visibility ?? 'public';
}

export function viewFor(content: ContentBundle, state: GameState, viewer: PlayerId): PlayerView {
  const s = structuredClone(state);
  const players = s.players.map((p, i) =>
    i === viewer ? p : ({ energy: null, queue: [], tickOrder: null, turnsTaken: p.turnsTaken } satisfies OpponentState),
  ) as PlayerView['players'];
  const effects = s.effects
    .filter((e) => !(effectVisibility(content, e) === 'hidden' && !e.revealed && e.sourceOwner !== viewer))
    .map((e) => (effectVisibility(content, e) === 'hiddenTarget' && e.sourceOwner !== viewer ? { ...e, targets: [] } : e));
  const { rng: _rng, players: _players, ...rest } = s;
  return { ...rest, viewer, players, effects };
}

export function redactEvents(events: readonly GameEvent[], viewer: PlayerId): GameEvent[] {
  return events
    .filter((e) => e.visibleTo === undefined || e.visibleTo === viewer)
    .map((e) => (e.t === 'skillUsed' && e.secretFrom === viewer ? { ...e, targets: [] } : e));
}
