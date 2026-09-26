// The authoritative match for local play. It owns the full GameState and hands the UI only
// per-player views, the same shape a networked client will get from the server in Phase 5.

import { greedyBot, randomBot, type Bot } from '@arena/ai';
import {
  applyCommand,
  createMatch,
  ENGINE_VERSION,
  skillAvailability,
  viewFor,
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

import type { BotKind, MatchMode, MatchSession } from './session.js';

export type { BotKind, MatchMode } from './session.js';

function makeBot(kind: BotKind, seed: number): Bot {
  return kind === 'greedy' ? greedyBot(seed) : randomBot(seed);
}

export class LocalMatch implements MatchSession {
  private state: GameState;
  readonly record: MatchRecord;
  readonly initialEvents: GameEvent[];
  private readonly bots: [Bot | null, Bot | null];

  constructor(
    readonly content: ContentBundle,
    readonly config: MatchConfig,
    readonly mode: MatchMode,
  ) {
    const r = createMatch(content, config);
    this.state = r.state;
    this.initialEvents = r.events;
    this.record = { engineVersion: ENGINE_VERSION, contentVersion: content.version, config, commands: [] };
    const botFor = (p: PlayerId): Bot | null => {
      if (mode.kind === 'vsBot') return p === mode.human ? null : makeBot(mode.bot, config.seed + 101);
      if (mode.kind === 'watch') return makeBot(mode.bots[p], config.seed + 101 + p);
      return null;
    };
    this.bots = [botFor(0), botFor(1)];
  }

  get active(): PlayerId {
    return this.state.activePlayer;
  }

  get finished(): boolean {
    return this.state.phase === 'finished';
  }

  get result(): MatchResult | null {
    return this.state.result;
  }

  get turn(): number {
    return this.state.turn;
  }

  isHuman(p: PlayerId): boolean {
    return this.bots[p] === null;
  }

  canAct(p: PlayerId): boolean {
    return !this.finished && this.active === p && this.isHuman(p);
  }

  view(p: PlayerId): PlayerView {
    return viewFor(this.content, this.state, p);
  }

  availability(p: PlayerId): SkillAvailability[] {
    return skillAvailability(this.content, this.state, p);
  }

  /** Applies a human player's command. Throws CommandError if it's illegal. */
  command(p: PlayerId, cmd: Command): GameEvent[] {
    if (!this.isHuman(p) && cmd.t !== 'surrender') throw new Error('That player is controlled by a bot');
    return this.apply(p, cmd);
  }

  private apply(p: PlayerId, cmd: Command): GameEvent[] {
    const r = applyCommand(this.content, this.state, p, cmd);
    this.state = r.state;
    this.record.commands.push({ player: p, cmd });
    return r.events;
  }

  /** Plays one full bot turn if the active player is a bot. */
  runBotTurn(): GameEvent[] {
    const p = this.active;
    const bot = this.bots[p];
    if (!bot || this.finished) return [];
    const out: GameEvent[] = [];
    for (const cmd of bot.planTurn(this.content, this.view(p))) {
      out.push(...this.apply(p, cmd));
      if (this.finished) break;
    }
    return out;
  }

  /** Plays bot turns until a human must act or the match ends. */
  runBots(): GameEvent[] {
    const out: GameEvent[] = [];
    while (!this.finished && !this.isHuman(this.active)) out.push(...this.runBotTurn());
    return out;
  }
}
