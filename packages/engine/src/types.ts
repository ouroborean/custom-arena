// Core runtime types for the Custom Arena rules engine.
// Everything here is plain JSON-serializable data so states can be cloned, hashed, stored and replayed.

export type PlayerId = 0 | 1;
export type UnitId = string;
export type EffectId = string;

export type Color = 'S' | 'A' | 'I' | 'W';
export const COLORS: readonly Color[] = ['S', 'A', 'I', 'W'];

export type Energy = Record<Color, number>;

/** A skill cost: specific colors plus `r` (random / GEN, payable by any color). */
export interface Cost {
  S: number;
  A: number;
  I: number;
  W: number;
  r: number;
}

export type DamageType = 'Normal' | 'Piercing' | 'Affliction';

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface SkillSlot {
  defId: string;
  /** Internal cooldown counter (GDD §3.5): usable when 0. */
  cooldown: number;
}

export interface Unit {
  id: UnitId;
  owner: PlayerId;
  kind: 'character' | 'minion';
  /** Class id for characters, minion def id for minions. */
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  skills: SkillSlot[];
  summonedBy?: UnitId;
  /** Base element (characters): drives default infusions and presentation. */
  element?: string;
  /** Generic per-unit resource store (e.g. future Soul Fragments, Charge). */
  counters: Record<string, number>;
}

export interface EffectInstance {
  id: EffectId;
  /** Named status id, or `<skillId>:<inlineId>` for effects defined inline in a skill. */
  defId: string;
  /** Present when the effect is defined inline by a skill or minion rather than as a named status. */
  inline?: import('./defs.js').EffectDef;
  source: UnitId;
  /** Owner of the applier, kept even if the source unit dies (ticks fire at the end of this player's turn). */
  sourceOwner: PlayerId;
  sourceSkill?: string;
  sourceArchetype?: string;
  bearer: UnitId;
  stacks: number;
  /** Numeric payload: shield pool, Trap X damage, etc. */
  value: number;
  /** Remaining internal duration in player turns (GDD §3.8); null = permanent. */
  duration: number | null;
  /** Units remembered by the effect (Snipe target, channel targets). */
  targets: UnitId[];
  revealed: boolean;
  /** Ends when the bearer next uses a skill (optionally only Harmful ones). */
  until?: import('./defs.js').UntilSpec;
  data: Record<string, number | boolean | string>;
  seq: number;
}

export interface QueuedAction {
  actor: UnitId;
  slot: number;
  targets: UnitId[];
  /** Cost locked in at queue time (after modifiers). */
  cost: Cost;
  /** Exact colors paid at commit (specific costs + allocated r), used for refunds. */
  paid?: Energy;
}

export interface PlayerState {
  energy: Energy;
  queue: QueuedAction[];
  /** Optional player-chosen order for their own ticking effects this turn. */
  tickOrder: EffectId[] | null;
  turnsTaken: number;
}

export type ResultReason = 'elimination' | 'draw' | 'surrender' | 'turnLimit';

export interface MatchResult {
  winner: PlayerId | null;
  reason: ResultReason;
}

export interface MatchSettings {
  turnLimitPerPlayer: number;
  minionCap: number;
}

export interface GameState {
  engineVersion: string;
  contentVersion: string;
  /** Global turn counter, starting at 1. Each player's turn is one turn. */
  turn: number;
  activePlayer: PlayerId;
  phase: 'planning' | 'finished';
  result: MatchResult | null;
  rng: RngState;
  players: [PlayerState, PlayerState];
  units: Unit[];
  effects: EffectInstance[];
  settings: MatchSettings;
  seq: number;
}

// ---------------------------------------------------------------- match setup

export interface CharacterSpec {
  name: string;
  classId?: string;
  /** Base element, for presentation; infused skills are listed by variant id in `skills`. */
  element?: string;
  hp?: number;
  /** Skill def ids (base or elemental variants), 1–5 of them. */
  skills: string[];
  /** Status ids applied permanently at match start (equipment passives). */
  passives?: string[];
}

export interface MatchConfig {
  seed: number;
  teams: [CharacterSpec[], CharacterSpec[]];
  firstPlayer?: PlayerId;
  settings?: Partial<MatchSettings>;
}

// ---------------------------------------------------------------- commands

export type Command =
  | { t: 'queue'; actor: UnitId; slot: number; targets: UnitId[] }
  | { t: 'unqueue'; index: number }
  | { t: 'reorder'; order: number[] }
  | { t: 'setTickOrder'; order: EffectId[] }
  | { t: 'endTurn'; allocation?: Energy }
  | { t: 'surrender' };

export interface CommandRecord {
  player: PlayerId;
  cmd: Command;
}

export interface MatchRecord {
  engineVersion: string;
  contentVersion: string;
  config: MatchConfig;
  commands: CommandRecord[];
}

// ---------------------------------------------------------------- events

export type RemoveReason = 'expired' | 'consumed' | 'died' | 'interrupted' | 'depleted' | 'removed';

export type EventBody =
  | { t: 'turnStart'; turn: number; player: PlayerId }
  | { t: 'energyGained'; player: PlayerId; gained: Energy }
  /** `stealthFrom`: that player only learns that a Stealthed unit acted (R6). */
  | { t: 'skillUsed'; actor: UnitId; skill: string; targets: UnitId[]; secretFrom?: PlayerId; stealthFrom?: PlayerId }
  | { t: 'skillFailed'; actor: UnitId; skill: string; reason: string; refunded: boolean }
  | { t: 'skillCountered'; actor: UnitId; skill: string; by: UnitId; effect: string; reflected: boolean }
  | {
      t: 'damage';
      source: UnitId;
      target: UnitId;
      amount: number;
      absorbed: number;
      type: DamageType;
      direct: boolean;
      hp: number;
      /** Breakdown for tooltips: base + bonus (Might/Weakness/Vulnerable…) + armor (≤ 0), floored at 0. */
      base: number;
      bonus: number;
      armor: number;
    }
  | { t: 'damageBlocked'; source: UnitId; target: UnitId; reason: string }
  | { t: 'heal'; source: UnitId; target: UnitId; amount: number; hp: number }
  | {
      t: 'effectApplied';
      effect: EffectId;
      defId: string;
      bearer: UnitId;
      source: UnitId;
      stacks: number;
      value: number;
      duration: number | null;
    }
  | { t: 'effectBlocked'; defId: string; bearer: UnitId; reason: string }
  | { t: 'effectRemoved'; effect: EffectId; defId: string; bearer: UnitId; reason: RemoveReason }
  | { t: 'effectRevealed'; effect: EffectId; defId: string; bearer: UnitId; source: UnitId }
  | { t: 'summoned'; unit: UnitId; defId: string; by: UnitId }
  | { t: 'died'; unit: UnitId }
  | { t: 'turnEnd'; turn: number; player: PlayerId }
  | { t: 'gameOver'; result: MatchResult };

/** An event plus its visibility: `visibleTo` undefined = both players. */
export type GameEvent = EventBody & { visibleTo?: PlayerId };

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}
