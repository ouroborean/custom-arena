// What the battle UI needs from a match, whoever runs it: LocalMatch (bots, hotseat, sandbox),
// RemoteMatch (online, server-authoritative) or ReplaySession (a finished match played back).

import type {
  Command,
  ContentBundle,
  GameEvent,
  MatchConfig,
  MatchRecord,
  MatchResult,
  PlayerId,
  PlayerView,
  SkillAvailability,
} from '@arena/engine';
import type { MatchKind, MatchReward, RatingChange } from '@arena/protocol';

export type BotKind = 'greedy' | 'random';

export type MatchMode =
  | { kind: 'vsBot'; bot: BotKind; human: PlayerId }
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

  /** Remote sessions push server events (and the view to play them back from) through this. */
  onUpdate?: ((events: GameEvent[], before: PlayerView | null, instant?: boolean) => void) | undefined;
  /** Non-event changes (presence, timer, rejection) that should re-render the UI. */
  onChange?: ((toast?: string) => void) | undefined;
  dispose?(): void;
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
