// Plays back a finished match from its record (seed + teams + commands), one turn at a time, from
// the viewer's seat (their redacted perspective). The battle UI treats it like watching bots.

import {
  applyCommand,
  CommandError,
  createMatch,
  viewFor,
  type Command,
  type ContentBundle,
  type GameEvent,
  type GameState,
  type MatchRecord,
  type MatchResult,
  type PlayerId,
  type PlayerView,
  type SkillAvailability,
} from '@arena/engine';
import { Checkpoints, type MatchMode, type MatchSession } from './session.js';

export class ReplaySession implements MatchSession {
  readonly initialEvents: GameEvent[];
  private state: GameState;
  /** Commands grouped into turns (each ends with endTurn or surrender). */
  private readonly turns: { player: PlayerId; cmd: Command }[][] = [];
  private next = 0;
  private readonly checkpoints: Checkpoints;

  constructor(
    readonly content: ContentBundle,
    readonly record: MatchRecord,
    readonly mode: Extract<MatchMode, { kind: 'replay' }>,
  ) {
    const r = createMatch(content, record.config);
    this.state = r.state;
    this.initialEvents = r.events;
    this.checkpoints = new Checkpoints(content);
    let current: { player: PlayerId; cmd: Command }[] = [];
    for (const c of record.commands) {
      current.push(c);
      if (c.cmd.t === 'endTurn' || c.cmd.t === 'surrender') {
        this.turns.push(current);
        current = [];
      }
    }
    if (current.length) this.turns.push(current);
  }

  get config() {
    return this.record.config;
  }

  get active(): PlayerId {
    return this.state.activePlayer;
  }

  get finished(): boolean {
    return this.state.phase === 'finished' || this.next >= this.turns.length;
  }

  get result(): MatchResult | null {
    return this.state.result;
  }

  get turn(): number {
    return this.state.turn;
  }

  isHuman(): boolean {
    return false;
  }

  canAct(): boolean {
    return false;
  }

  view(): PlayerView {
    return viewFor(this.content, this.state, this.mode.seat);
  }

  availability(): SkillAvailability[] {
    return [];
  }

  command(): GameEvent[] {
    throw new CommandError('replay', 'This is a replay');
  }

  checkpointView(n: number, viewer: PlayerId): PlayerView | null {
    return this.checkpoints.view(n, viewer);
  }

  runBots(): GameEvent[] {
    return [];
  }

  /** Applies the next recorded turn. */
  runBotTurn(): GameEvent[] {
    const turn = this.turns[this.next++];
    if (!turn) return [];
    const out: GameEvent[] = [];
    for (const { player, cmd } of turn) {
      const r = applyCommand(this.content, this.state, player, cmd, { checkpoints: true });
      this.state = r.state;
      out.push(...this.checkpoints.take(r));
    }
    return out;
  }
}
