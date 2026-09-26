// Scenario-test harness: builds small matches from skill ids and drives them turn by turn.

import {
  applyCommand,
  COLORS,
  createMatch,
  effectName,
  formatEvent,
  type Command,
  type ContentBundle,
  type Energy,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '@arena/engine';
import { loadContentOrThrow } from '../src/index.js';

export const content: ContentBundle = loadContentOrThrow();

export interface ArenaOptions {
  /** Skill ids per character, per side. Units are p0c0, p0c1, … and p1c0, p1c1, … */
  p0: string[][];
  p1: string[][];
  hp?: number;
  seed?: number;
  /** Give the active player plenty of every color at each of their turns (default true). */
  richEnergy?: boolean;
  /** Equipment passives (status ids) per unit id, applied at match start like a real loadout. */
  passives?: Record<string, string[]>;
}

export class Arena {
  state: GameState;
  events: GameEvent[] = [];
  /** Events produced by the most recent command. */
  last: GameEvent[] = [];
  private rich: boolean;

  constructor(o: ArenaOptions) {
    this.rich = o.richEnergy ?? true;
    const mk = (side: string[][], p: number) =>
      side.map((skills, i) => ({
        name: `${p === 0 ? 'A' : 'B'}${i + 1}`,
        skills,
        ...(o.hp ? { hp: o.hp } : {}),
        ...(o.passives?.[`p${p}c${i}`] ? { passives: o.passives[`p${p}c${i}`] } : {}),
      }));
    const r = createMatch(content, { seed: o.seed ?? 1, teams: [mk(o.p0, 0), mk(o.p1, 1)] });
    this.state = r.state;
    this.events.push(...r.events);
    this.last = r.events;
    this.topUp();
  }

  private topUp(): void {
    if (!this.rich || this.state.phase === 'finished') return;
    const p = this.state.players[this.state.activePlayer];
    for (const c of COLORS) p.energy[c] = Math.max(p.energy[c], 10);
  }

  get active(): PlayerId {
    return this.state.activePlayer;
  }

  cmd(player: PlayerId, c: Command): this {
    const r = applyCommand(content, this.state, player, c);
    this.state = r.state;
    this.last = r.events;
    this.events.push(...r.events);
    return this;
  }

  /** Queues `skillId` for `actor` (slot found by id) on an optional target. */
  use(actor: string, skillId: string, target?: string): this {
    const u = this.unit(actor);
    const slot = u.skills.findIndex((s) => s.defId === skillId);
    if (slot < 0) throw new Error(`${actor} has no skill ${skillId}`);
    return this.cmd(u.owner, { t: 'queue', actor, slot, targets: target ? [target] : [] });
  }

  /** Ends the active player's turn. */
  end(allocation?: Energy): this {
    this.cmd(this.active, allocation ? { t: 'endTurn', allocation } : { t: 'endTurn' });
    this.topUp();
    return this;
  }

  /** Ends `n` turns in a row without acting. */
  pass(n = 1): this {
    for (let i = 0; i < n; i++) this.end();
    return this;
  }

  unit(id: string) {
    const u = this.state.units.find((x) => x.id === id);
    if (!u) throw new Error(`No unit ${id}`);
    return u;
  }

  hp(id: string): number {
    return this.unit(id).hp;
  }

  setHp(id: string, hp: number): this {
    this.unit(id).hp = hp;
    return this;
  }

  /** Places a named status directly on a unit (permanent unless `duration` is given). */
  give(id: string, status: string, opts: { stacks?: number; value?: number; duration?: number | null; source?: string } = {}): this {
    const bearer = this.unit(id);
    const source = opts.source ? this.unit(opts.source) : bearer;
    this.state.seq += 1;
    this.state.effects.push({
      id: `g${this.state.seq}`,
      defId: status,
      source: source.id,
      sourceOwner: source.owner,
      bearer: id,
      stacks: opts.stacks ?? 1,
      value: opts.value ?? 0,
      duration: opts.duration ?? null,
      targets: [],
      revealed: false,
      data: {},
      seq: this.state.seq,
    });
    return this;
  }

  effects(id: string) {
    return this.state.effects.filter((e) => e.bearer === id);
  }

  /** Effect key: status id, or the inline id for skill-defined effects. */
  has(id: string, key: string): boolean {
    return this.effects(id).some((e) => (e.inline ? e.inline.id : e.defId) === key);
  }

  stacks(id: string, key: string): number {
    return this.effects(id)
      .filter((e) => (e.inline ? e.inline.id : e.defId) === key)
      .reduce((n, e) => n + e.stacks, 0);
  }

  cooldown(id: string, skillId: string): number {
    const s = this.unit(id).skills.find((x) => x.defId === skillId);
    if (!s) throw new Error(`${id} has no skill ${skillId}`);
    return s.cooldown;
  }

  /** Expects a command to be rejected, returning the error code. */
  reject(fn: () => unknown): string {
    try {
      fn();
    } catch (e) {
      return (e as { code?: string }).code ?? String(e);
    }
    throw new Error('Expected the command to be rejected');
  }

  log(events: readonly GameEvent[] = this.events): string[] {
    return events.map((e) => formatEvent(content, this.state.units, e));
  }

  effectName(defId: string): string {
    return effectName(content, defId);
  }
}

export function arena(o: ArenaOptions): Arena {
  return new Arena(o);
}
