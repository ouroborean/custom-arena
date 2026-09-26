// An online match. The server holds the real state; this client only ever sees its redacted view.
// Planning is local-first (GDD §11.7): queue commands run on a planning copy of that view, drafts
// go to the server as you plan (so a timeout can auto-commit them), and End Turn sends the whole
// plan as one bundle. Server events then play back exactly like local ones.

import { planningState } from '@arena/ai';
import {
  applyCommand,
  CommandError,
  skillAvailability,
  viewFor,
  type Command,
  type ContentBundle,
  type GameEvent,
  type GameState,
  type MatchResult,
  type PlayerId,
  type PlayerView,
  type SkillAvailability,
} from '@arena/engine';
import { bundleFromState, type ClientMessage, type RatingChange, type ServerMessage } from '@arena/protocol';
import type { MatchMode, MatchSession, OnlineInfo } from './session.js';

export interface Link {
  send(msg: ClientMessage): void;
}

type OnlineMode = Extract<MatchMode, { kind: 'online' }>;

const DRAFT_DELAY_MS = 400;

export class RemoteMatch implements MatchSession, OnlineInfo {
  /** Events that arrived before the battle screen was listening (e.g. the first sync). */
  private backlog: GameEvent[] = [];
  private serverView: PlayerView | null = null;
  private plan: GameState | null = null;
  /** Highest event sequence number received. */
  seq = 0;
  awaiting = false;
  deadline: number | null = null;
  opponentConnected = true;
  forfeitAt: number | null = null;
  rating: RatingChange | null = null;
  endReason: string | null = null;
  private ended: MatchResult | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  onUpdate?: MatchSession['onUpdate'];
  onChange?: MatchSession['onChange'];

  constructor(
    readonly content: ContentBundle,
    readonly matchId: string,
    readonly mode: OnlineMode,
    private readonly link: Link,
  ) {}

  /** Hands the buffered events to the battle screen once, when it starts showing this match. */
  get initialEvents(): GameEvent[] {
    const out = this.backlog;
    this.backlog = [];
    return out;
  }

  private deliver(events: GameEvent[], before: PlayerView | null, instant?: boolean): void {
    if (this.onUpdate) this.onUpdate(events, before, instant);
    else this.backlog.push(...events);
  }

  private get you(): PlayerId {
    return this.mode.you;
  }

  get ready(): boolean {
    return this.serverView !== null;
  }

  get active(): PlayerId {
    return (this.serverView?.activePlayer ?? 0) as PlayerId;
  }

  get turn(): number {
    return this.serverView?.turn ?? 1;
  }

  get finished(): boolean {
    return this.ended !== null || this.serverView?.phase === 'finished';
  }

  get result(): MatchResult | null {
    return this.ended ?? this.serverView?.result ?? null;
  }

  isHuman(): boolean {
    return true;
  }

  canAct(p: PlayerId): boolean {
    return p === this.you && this.plan !== null && !this.awaiting && !this.finished;
  }

  view(): PlayerView {
    if (this.plan) return viewFor(this.content, this.plan, this.you);
    if (!this.serverView) throw new Error('No view yet');
    return this.serverView;
  }

  availability(): SkillAvailability[] {
    return this.plan && !this.awaiting ? skillAvailability(this.content, this.plan, this.you) : [];
  }

  command(p: PlayerId, cmd: Command): GameEvent[] {
    if (cmd.t === 'surrender') {
      this.link.send({ t: 'surrender', matchId: this.matchId });
      return [];
    }
    if (!this.plan || p !== this.you || this.awaiting) throw new CommandError('not_your_turn', "It isn't your turn");
    if (cmd.t === 'endTurn') {
      this.clearDraft();
      this.awaiting = true;
      this.link.send({ t: 'turn.submit', matchId: this.matchId, turn: bundleFromState(this.plan, this.you, cmd.allocation) });
      return [];
    }
    this.plan = applyCommand(this.content, this.plan, this.you, cmd).state;
    this.scheduleDraft();
    return [];
  }

  runBots(): GameEvent[] {
    return [];
  }

  runBotTurn(): GameEvent[] {
    return [];
  }

  /** Server messages for this match. */
  handle(msg: ServerMessage): void {
    switch (msg.t) {
      case 'match.sync': {
        const before = this.serverView ? this.view() : null;
        const fresh = msg.events.filter((e) => e.seq > this.seq);
        this.accept(msg.view, msg.seq, msg.deadline);
        this.opponentConnected = msg.opponentConnected;
        // A resync shows the current state straight away rather than replaying history.
        this.deliver(
          fresh.map((e) => e.event),
          before,
          true,
        );
        return;
      }
      case 'match.events': {
        const before = this.serverView ? this.view() : null;
        const fresh = msg.events.filter((e) => e.seq > this.seq);
        this.accept(msg.view, msg.seq, msg.deadline);
        this.deliver(
          fresh.map((e) => e.event),
          before,
        );
        return;
      }
      case 'match.turnRejected':
        this.awaiting = false;
        this.resetPlan();
        this.onChange?.(`Turn rejected: ${msg.reason}`);
        return;
      case 'match.presence':
        this.opponentConnected = msg.opponentConnected;
        this.forfeitAt = msg.forfeitAt;
        this.onChange?.();
        return;
      case 'match.end':
        this.ended = msg.result;
        this.endReason = msg.reason;
        this.rating = msg.rating ?? null;
        this.deadline = null;
        this.plan = null;
        this.clearDraft();
        this.onChange?.();
        return;
      default:
        return;
    }
  }

  /** The server no longer knows this match (it ended while we were away). */
  abandon(): void {
    if (this.finished) return;
    this.ended = { winner: null, reason: 'surrender' };
    this.endReason = 'ended while you were away';
    this.plan = null;
    this.onChange?.();
  }

  private accept(view: PlayerView, seq: number, deadline: number | null): void {
    this.serverView = view;
    this.seq = Math.max(this.seq, seq);
    this.deadline = deadline;
    this.awaiting = false;
    this.resetPlan();
  }

  private resetPlan(): void {
    const v = this.serverView;
    this.plan = v && v.activePlayer === this.you && v.phase !== 'finished' ? planningState(v) : null;
  }

  private scheduleDraft(): void {
    this.clearDraft();
    this.draftTimer = setTimeout(() => {
      if (this.plan && !this.awaiting) this.link.send({ t: 'turn.draft', matchId: this.matchId, turn: bundleFromState(this.plan, this.you) });
    }, DRAFT_DELAY_MS);
  }

  private clearDraft(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
  }

  dispose(): void {
    this.clearDraft();
    this.onUpdate = undefined;
    this.onChange = undefined;
  }
}
