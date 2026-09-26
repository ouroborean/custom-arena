// WebSocket protocol between the client and the match service (GDD §10.4, §11.7, Phase 5).
//
// - Versioned: the client says which protocol and content version it speaks in `hello`; the server
//   refuses mismatches instead of letting two engines disagree.
// - Local-first planning: the client rehearses its queue on its own engine copy (from its redacted
//   view) and sends the finished turn as one bundle, validated and applied atomically.
// - Hidden information never leaves the server: views and events are redacted per player.
// - Every event a player receives has a per-player sequence number, so a reconnecting client asks
//   for exactly what it missed.

import type { Energy, GameEvent, MatchResult, PlayerId, PlayerView } from '@arena/engine';
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

export type QueueMode = 'casual' | 'ranked';
export type MatchKind = QueueMode | 'private';

// ---------------------------------------------------------------- client → server

const energy = z.strictObject({
  S: z.number().int().min(0),
  A: z.number().int().min(0),
  I: z.number().int().min(0),
  W: z.number().int().min(0),
});

/** One turn's decisions: the queue in resolution order, tick order and random-cost allocation. */
export const TurnBundleSchema = z.strictObject({
  /** The turn number this bundle is for; stale bundles are rejected. */
  turn: z.number().int().min(1),
  queue: z
    .array(
      z.strictObject({
        actor: z.string().max(16),
        slot: z.number().int().min(0).max(4),
        targets: z.array(z.string().max(16)).max(6),
      }),
    )
    .max(12),
  tickOrder: z.array(z.string().max(32)).max(64).optional(),
  allocation: energy.optional(),
});
export type TurnBundle = z.infer<typeof TurnBundleSchema>;

const id = z.string().min(1).max(64);

export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.strictObject({
    t: z.literal('hello'),
    v: z.number().int(),
    contentVersion: z.string().max(64),
  }),
  z.strictObject({ t: z.literal('queue.join'), mode: z.enum(['casual', 'ranked']) }),
  z.strictObject({ t: z.literal('queue.leave') }),
  /** `timer`: seconds per turn, or null for no timer (private matches only). */
  z.strictObject({ t: z.literal('private.create'), timer: z.number().int().min(15).max(600).nullable() }),
  z.strictObject({ t: z.literal('private.join'), code: z.string().min(4).max(12) }),
  z.strictObject({ t: z.literal('private.cancel') }),
  /** Latest planning state, kept by the server so a timeout can auto-commit it (GDD §9.2). */
  z.strictObject({ t: z.literal('turn.draft'), matchId: id, turn: TurnBundleSchema }),
  z.strictObject({ t: z.literal('turn.submit'), matchId: id, turn: TurnBundleSchema }),
  z.strictObject({ t: z.literal('surrender'), matchId: id }),
  /** Ask for the view plus every event after `lastSeq` (reconnection / resync). */
  z.strictObject({ t: z.literal('sync'), matchId: id, lastSeq: z.number().int().min(0) }),
  z.strictObject({ t: z.literal('ping'), at: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------- server → client

export type ErrorCode =
  | 'bad_message'
  | 'version_mismatch'
  | 'content_mismatch'
  | 'unauthorized'
  | 'not_in_match'
  | 'already_busy'
  | 'invalid_team'
  | 'no_such_code'
  | 'rate_limited'
  | 'turn_rejected';

export interface OpponentInfo {
  displayName: string;
  /** Shown for ranked matches. */
  rating?: number;
}

export interface SeqEvent {
  seq: number;
  event: GameEvent;
}

export interface RatingChange {
  before: number;
  after: number;
}

export type ServerMessage =
  | { t: 'welcome'; v: number; user: { id: string; displayName: string }; activeMatch: string | null; serverTime: number }
  | { t: 'error'; code: ErrorCode; message: string; problems?: string[] }
  | { t: 'queue.status'; mode: QueueMode; since: number }
  | { t: 'queue.left' }
  | { t: 'private.created'; code: string; timer: number | null }
  | { t: 'private.cancelled' }
  | {
      t: 'match.start';
      matchId: string;
      kind: MatchKind;
      you: PlayerId;
      opponent: OpponentInfo;
      /** Seconds per turn, or null. */
      timer: number | null;
    }
  /** Full resynchronisation: the current view and every event after the requested seq. */
  | {
      t: 'match.sync';
      matchId: string;
      kind: MatchKind;
      you: PlayerId;
      opponent: OpponentInfo;
      timer: number | null;
      view: PlayerView;
      events: SeqEvent[];
      seq: number;
      /** When the active player's turn times out (server epoch ms), or null. */
      deadline: number | null;
      opponentConnected: boolean;
    }
  /** New events (already redacted for this player) and the resulting view. */
  | { t: 'match.events'; matchId: string; events: SeqEvent[]; seq: number; view: PlayerView; deadline: number | null }
  | { t: 'match.presence'; matchId: string; opponentConnected: boolean; forfeitAt: number | null }
  | { t: 'match.turnRejected'; matchId: string; reason: string }
  | { t: 'match.end'; matchId: string; result: MatchResult; rating?: RatingChange }
  | { t: 'pong'; at: number; serverTime: number };

/** Parses a raw client frame; returns null when it isn't a valid message. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > 16_384) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = ClientMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}

/** Engine energy shape re-exported for bundle builders. */
export type { Energy };

export { applyTurnBundle, bundleFromState, type AppliedTurn } from './turn.js';
