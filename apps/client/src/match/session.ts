// What the battle UI needs from a match, whoever runs it: LocalMatch (bots, hotseat, sandbox),
// RemoteMatch (online, server-authoritative) or ReplaySession (a finished match played back).

import {
  viewFor,
  type ApplyResult,
  type Command,
  type ContentBundle,
  type GameEvent,
  type GameState,
  type MatchConfig,
  type MatchRecord,
  type MatchResult,
  type PlayerId,
  type PlayerView,
  type SkillAvailability,
} from '@arena/engine';
import type { MatchKind, MatchReward, RatingChange } from '@arena/protocol';

/** Bot difficulty (GDD §11.9, packages/ai/src/search.ts). */
export type BotKind = 'easy' | 'normal' | 'hard';

/** A story attempt the server issued (the result is submitted for verification when it ends). */
export interface StoryTag {
  encounter: string;
  attemptId: string;
}

export type MatchMode =
  /** With `story`, the encounter's own AI plays instead of `bot`. */
  | { kind: 'vsBot'; bot: BotKind; human: PlayerId; story?: StoryTag }
  | { kind: 'hotseat' }
  | { kind: 'watch'; bots: [BotKind, BotKind] }
  | { kind: 'online'; you: PlayerId; opponent: string; matchKind: MatchKind; timer: number | null }
  /** `endReason`: the server's recorded reason (e.g. disconnect), which the engine result can't show. */
  | { kind: 'replay'; seat: PlayerId; opponent: string; endReason?: string };

export interface MatchSession {
  readonly content: ContentBundle;
  readonly mode: MatchMode;
  /** Events from match creation (remote sessions deliver theirs through onUpdate instead). */
  readonly initialEvents: GameEvent[];
  readonly active: PlayerId;
  readonly finished: boolean;
  readonly result: MatchResult | null;
  readonly turn: number;
  /** Local matches: the config (rematch) and command record (download). */
  readonly config?: MatchConfig;
  readonly record?: MatchRecord;

  isHuman(p: PlayerId): boolean;
  /** Whether that player can plan and end a turn right now. */
  canAct(p: PlayerId): boolean;
  view(p: PlayerId): PlayerView;
  availability(p: PlayerId): SkillAvailability[];
  /** Applies a command; throws CommandError when it's illegal. Remote sessions return []. */
  command(p: PlayerId, cmd: Command): GameEvent[];
  runBots(): GameEvent[];
  runBotTurn(): GameEvent[];

  /**
   * The board at a `checkpoint` event, as `viewer` sees it (null if unknown), so playback can show
   * each skill's outcome as it happens rather than all at the end.
   */
  checkpointView?(n: number, viewer: PlayerId): PlayerView | null;

  /** Remote sessions push server events (and the view to play them back from) through this. */
  onUpdate?: ((events: GameEvent[], before: PlayerView | null, instant?: boolean) => void) | undefined;
  /** Non-event changes (presence, timer, rejection) that should re-render the UI. */
  onChange?: ((toast?: string) => void) | undefined;
  dispose?(): void;
}

/**
 * Board snapshots for playback, by checkpoint number. Local sessions keep engine states (either
 * player's view can be made from them); online ones keep the views the server sent. Only the latest
 * few hundred are kept: playback only ever needs the current turn's.
 */
export class Checkpoints {
  private next = 0;
  private readonly kept = new Map<number, { state: GameState } | { view: PlayerView; viewer: PlayerId }>();

  constructor(private readonly content: ContentBundle) {}

  /** A command's events with its checkpoints numbered for this session (and their states kept). */
  take(r: ApplyResult): GameEvent[] {
    if (!r.checkpoints) return r.events;
    const base = this.next;
    r.checkpoints.forEach((state, i) => this.keep(base + i, { state }));
    this.next += r.checkpoints.length;
    return r.events.map((e) => (e.t === 'checkpoint' ? { ...e, n: e.n + base } : e));
  }

  /** A checkpoint event for a view received from the server. */
  add(view: PlayerView, viewer: PlayerId): GameEvent {
    const n = this.next++;
    this.keep(n, { view, viewer });
    return { t: 'checkpoint', n };
  }

  view(n: number, viewer: PlayerId): PlayerView | null {
    const k = this.kept.get(n);
    if (!k) return null;
    if ('state' in k) return viewFor(this.content, k.state, viewer);
    return k.viewer === viewer ? k.view : null;
  }

  private keep(n: number, entry: { state: GameState } | { view: PlayerView; viewer: PlayerId }): void {
    this.kept.set(n, entry);
    for (const old of this.kept.keys()) {
      if (this.kept.size <= 300) break;
      this.kept.delete(old);
    }
  }
}

/** Extra state an online session exposes to the UI. */
export interface OnlineInfo {
  deadline: number | null;
  opponentConnected: boolean;
  forfeitAt: number | null;
  rating: RatingChange | null;
  /** What this match paid, once it's over (online kinds with rewards). */
  reward: MatchReward | null;
  endReason: string | null;
  /** True between submitting a turn and the server's answer. */
  awaiting: boolean;
}
