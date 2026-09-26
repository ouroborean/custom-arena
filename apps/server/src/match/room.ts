// One multiplayer match (GDD §10.4 "Room = authoritative engine state + timer + redaction").
//
// The room owns the only full GameState. Each player gets their own redacted event log with
// sequence numbers, so a reconnecting client can ask for exactly what it missed. Turns arrive as
// bundles (local-first planning) and are applied atomically; drafts let a timeout auto-commit the
// player's current plan (GDD §9.2).

import {
  applyCommand,
  CommandError,
  createMatch,
  redactEvents,
  viewFor,
  type Command,
  type ContentBundle,
  type GameEvent,
  type GameState,
  type MatchConfig,
  type MatchResult,
  type PlayerId,
} from '@arena/engine';
import { applyTurnBundle, type MatchKind, type OpponentInfo, type RatingChange, type SeqEvent, type ServerMessage, type TurnBundle } from '@arena/protocol';
import type { Clock, Timer } from './clock.js';

/** How long a disconnected player has to come back before forfeiting. */
export const DISCONNECT_GRACE_MS = 60_000;
/** Consecutive turn timeouts that count as abandoning the match. */
export const MAX_TIMEOUTS = 3;

export interface RoomPlayer {
  userId: string;
  displayName: string;
  /** Shown to the opponent in ranked. */
  rating?: number;
}

export interface Connection {
  send(msg: ServerMessage): void;
}

export type EndReason = MatchResult['reason'] | 'disconnect' | 'afk';

/** Persistence the room needs; the server backs it with Postgres, tests with memory. */
export interface RoomStore {
  appendActions(matchId: string, actions: { seq: number; player: PlayerId; command: Command }[]): Promise<void>;
  /** Records the result and applies rating changes; returns them for ranked matches. */
  finish(
    matchId: string,
    r: { winner: PlayerId | null; endReason: EndReason; turns: number },
  ): Promise<[RatingChange, RatingChange] | null>;
}

export interface RoomOptions {
  id: string;
  kind: MatchKind;
  content: ContentBundle;
  config: MatchConfig;
  players: [RoomPlayer, RoomPlayer];
  /** Seconds per turn, or null for no timer. */
  timerSeconds: number | null;
  clock: Clock;
  store: RoomStore;
  /** Called once when the match has ended and been persisted. */
  onEnd?: (room: MatchRoom) => void;
  log?: (msg: string, err?: unknown) => void;
}

export class MatchRoom {
  readonly id: string;
  readonly kind: MatchKind;
  readonly players: [RoomPlayer, RoomPlayer];
  private state: GameState;
  private readonly logs: [SeqEvent[], SeqEvent[]] = [[], []];
  private readonly conns: [Connection | null, Connection | null] = [null, null];
  private readonly drafts: [TurnBundle | null, TurnBundle | null] = [null, null];
  private readonly timeouts: [number, number] = [0, 0];
  private readonly forfeitTimers: [Timer | null, Timer | null] = [null, null];
  private readonly forfeitAt: [number | null, number | null] = [null, null];
  private turnTimer: Timer | null = null;
  private deadline: number | null = null;
  private actionSeq = 0;
  private writes: Promise<void> = Promise.resolve();
  private ended = false;
  /** Why the match ended, once it has. */
  endReason: EndReason | null = null;
  /** The seat that forfeited (surrender, disconnect or afk), if any. */
  forfeitedBy: PlayerId | null = null;
  /** Resolves once the result is persisted (tests await it). */
  finished: Promise<void> | null = null;

  constructor(private readonly o: RoomOptions) {
    this.id = o.id;
    this.kind = o.kind;
    this.players = o.players;
    const r = createMatch(o.content, o.config);
    this.state = r.state;
    this.record(r.events);
    this.armTimer();
  }

  get active(): PlayerId {
    return this.state.activePlayer;
  }

  get isOver(): boolean {
    return this.ended;
  }

  get turn(): number {
    return this.state.turn;
  }

  seat(userId: string): PlayerId | null {
    if (this.players[0].userId === userId) return 0;
    if (this.players[1].userId === userId) return 1;
    return null;
  }

  isConnected(p: PlayerId): boolean {
    return this.conns[p] !== null;
  }

  private opponentInfo(p: PlayerId): OpponentInfo {
    const o = this.players[p === 0 ? 1 : 0];
    return { displayName: o.displayName, ...(this.kind === 'ranked' && o.rating !== undefined ? { rating: Math.round(o.rating) } : {}) };
  }

  /** Connects (or reconnects) a player and sends them everything after `lastSeq`. */
  attach(p: PlayerId, conn: Connection, lastSeq = 0): void {
    this.conns[p] = conn;
    this.forfeitTimers[p]?.cancel();
    this.forfeitTimers[p] = null;
    this.forfeitAt[p] = null;
    const other: PlayerId = p === 0 ? 1 : 0;
    conn.send({
      t: 'match.sync',
      matchId: this.id,
      kind: this.kind,
      you: p,
      opponent: this.opponentInfo(p),
      timer: this.o.timerSeconds,
      view: viewFor(this.o.content, this.state, p),
      events: this.logs[p].filter((e) => e.seq > lastSeq),
      seq: this.logs[p].length,
      deadline: this.deadline,
      opponentConnected: this.isConnected(other),
    });
    this.conns[other]?.send({ t: 'match.presence', matchId: this.id, opponentConnected: true, forfeitAt: null });
  }

  /** A player's connection dropped: they have DISCONNECT_GRACE_MS to come back. */
  detach(p: PlayerId, conn: Connection): void {
    if (this.conns[p] !== conn) return;
    this.conns[p] = null;
    this.startGrace(p);
  }

  /** Starts the reconnection window for a seat nobody is connected to (e.g. paired while offline). */
  startGrace(p: PlayerId): void {
    if (this.ended || this.conns[p] || this.forfeitTimers[p]) return;
    this.forfeitAt[p] = this.o.clock.now() + DISCONNECT_GRACE_MS;
    this.forfeitTimers[p] = this.o.clock.after(DISCONNECT_GRACE_MS, () => this.forfeit(p, 'disconnect'));
    const other: PlayerId = p === 0 ? 1 : 0;
    this.conns[other]?.send({ t: 'match.presence', matchId: this.id, opponentConnected: false, forfeitAt: this.forfeitAt[p] });
  }

  draft(p: PlayerId, bundle: TurnBundle): void {
    if (!this.ended && p === this.active && bundle.turn === this.state.turn) this.drafts[p] = bundle;
  }

  /** Applies a submitted turn; tells the player why if it's rejected. */
  submit(p: PlayerId, bundle: TurnBundle): boolean {
    if (this.ended) return false;
    try {
      const applied = applyTurnBundle(this.o.content, this.state, p, bundle);
      this.timeouts[p] = 0;
      this.commit(p, applied.state, applied.events, applied.commands);
      return true;
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;
      this.conns[p]?.send({ t: 'match.turnRejected', matchId: this.id, reason: e.message });
      return false;
    }
  }

  surrender(p: PlayerId): void {
    this.forfeit(p, 'surrender');
  }

  private forfeit(p: PlayerId, reason: EndReason): void {
    if (this.ended) return;
    this.forfeitedBy = p;
    const cmd: Command = { t: 'surrender' };
    const r = applyCommand(this.o.content, this.state, p, cmd);
    this.commit(p, r.state, r.events, [cmd], reason);
  }

  private onTimeout(): void {
    if (this.ended) return;
    const p = this.active;
    this.timeouts[p]++;
    if (this.timeouts[p] >= MAX_TIMEOUTS) return this.forfeit(p, 'afk');
    const draft = this.drafts[p];
    const empty: TurnBundle = { turn: this.state.turn, queue: [] };
    for (const bundle of draft ? [draft, empty] : [empty]) {
      try {
        const a = applyTurnBundle(this.o.content, this.state, p, bundle);
        return this.commit(p, a.state, a.events, a.commands);
      } catch (e) {
        if (!(e instanceof CommandError)) throw e;
      }
    }
  }

  private commit(p: PlayerId, state: GameState, events: GameEvent[], commands: Command[], reason?: EndReason): void {
    this.state = state;
    const actions = commands.map((command) => ({ seq: ++this.actionSeq, player: p, command }));
    this.write(() => this.o.store.appendActions(this.id, actions));
    this.drafts[0] = this.drafts[1] = null;
    this.armTimer();
    this.record(events);
    if (state.phase === 'finished') this.end(reason ?? state.result?.reason ?? 'elimination');
  }

  /** Redacts new events per player, appends them to the logs and sends them out. */
  private record(events: GameEvent[]): void {
    for (const p of [0, 1] as const) {
      const mine: SeqEvent[] = [];
      for (const event of redactEvents(events, p)) {
        const e = { seq: this.logs[p].length + 1, event };
        this.logs[p].push(e);
        mine.push(e);
      }
      this.conns[p]?.send({
        t: 'match.events',
        matchId: this.id,
        events: mine,
        seq: this.logs[p].length,
        view: viewFor(this.o.content, this.state, p),
        deadline: this.deadline,
      });
    }
  }

  private armTimer(): void {
    this.turnTimer?.cancel();
    this.turnTimer = null;
    this.deadline = null;
    if (this.ended || this.state.phase === 'finished' || this.o.timerSeconds === null) return;
    const ms = this.o.timerSeconds * 1000;
    this.deadline = this.o.clock.now() + ms;
    this.turnTimer = this.o.clock.after(ms, () => this.onTimeout());
  }

  private end(reason: EndReason): void {
    if (this.ended) return;
    this.ended = true;
    this.endReason = reason;
    this.turnTimer?.cancel();
    for (const t of this.forfeitTimers) t?.cancel();
    const result = this.state.result!;
    this.finished = (async () => {
      await this.writes;
      let ratings: [RatingChange, RatingChange] | null = null;
      try {
        ratings = await this.o.store.finish(this.id, { winner: result.winner, endReason: reason, turns: this.state.turn });
      } catch (e) {
        this.o.log?.(`match ${this.id}: could not record the result`, e);
      }
      for (const p of [0, 1] as const) {
        this.conns[p]?.send({ t: 'match.end', matchId: this.id, result, reason, ...(ratings ? { rating: ratings[p] } : {}) });
      }
      this.o.onEnd?.(this);
    })();
  }

  /** Resolves when every pending write has been persisted. */
  idle(): Promise<void> {
    return this.writes;
  }

  /** Serializes persistence so actions land in order. */
  private write(fn: () => Promise<void>): void {
    this.writes = this.writes.then(fn).catch((e) => this.o.log?.(`match ${this.id}: write failed`, e));
  }
}
