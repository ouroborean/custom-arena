// Pure helpers that turn engine events into timed playback steps, floating numbers and log lines.

import { formatEvent, type ContentBundle, type GameEvent, type Unit } from '@arena/engine';

export type LogKind = 'turn' | 'skill' | 'damage' | 'heal' | 'effect' | 'death' | 'over' | 'info';

export interface LogLine {
  id: number;
  kind: LogKind;
  text: string;
  /** Damage breakdown, for the log tooltip. */
  detail?: string;
}

export interface FloatText {
  id: number;
  unit: string;
  text: string;
  kind: 'damage' | 'heal' | 'block' | 'shield';
}

export function logKind(e: GameEvent): LogKind {
  switch (e.t) {
    case 'turnStart':
    case 'turnEnd':
      return 'turn';
    case 'skillUsed':
    case 'skillFailed':
    case 'skillCountered':
      return 'skill';
    case 'damage':
    case 'damageBlocked':
      return 'damage';
    case 'heal':
      return 'heal';
    case 'died':
      return 'death';
    case 'gameOver':
      return 'over';
    case 'effectApplied':
    case 'effectRemoved':
    case 'effectBlocked':
    case 'effectRevealed':
    case 'summoned':
      return 'effect';
    default:
      return 'info';
  }
}

/**
 * Milliseconds to linger on an event at 1× speed (2× halves them). A skill use lingers longest, so its
 * action popup can be read before the results land.
 */
export function delayFor(e: GameEvent): number {
  switch (e.t) {
    case 'turnStart':
      return 800;
    case 'skillUsed':
    case 'skillCountered':
      return 1100;
    case 'damage':
      return 650;
    case 'heal':
      return 600;
    case 'died':
      return 1000;
    case 'effectRevealed':
      return 750;
    case 'gameOver':
      return 450;
    case 'energyGained':
    case 'turnEnd':
      return 180;
    case 'checkpoint':
      return 0;
    default:
      return 320;
  }
}

/** Whether an event is worth a line in the battle log. */
export function isLogged(e: GameEvent): boolean {
  if (e.t === 'turnEnd' || e.t === 'checkpoint') return false;
  if (e.t === 'effectRemoved' && e.reason === 'died') return false;
  if (e.t === 'heal' && e.amount === 0) return false;
  return true;
}

export function damageDetail(e: Extract<GameEvent, { t: 'damage' }>): string {
  const parts = [`${e.base} base`];
  if (e.bonus) parts.push(`${e.bonus > 0 ? '+' : '−'}${Math.abs(e.bonus)} modifiers`);
  if (e.armor) parts.push(`−${Math.abs(e.armor)} armor`);
  if (e.absorbed) parts.push(`${e.absorbed} absorbed by shield`);
  const type = e.type === 'Normal' ? '' : `${e.type}, `;
  return `${parts.join(' ')} (${type}${e.direct ? 'direct' : 'indirect'})`;
}

export function toLogLine(content: ContentBundle, units: readonly Unit[], e: GameEvent, id: number): LogLine {
  const line: LogLine = { id, kind: logKind(e), text: formatEvent(content, units, e) };
  if (e.t === 'damage') line.detail = damageDetail(e);
  return line;
}

/**
 * Keeps minions in stable bench slots: a minion keeps its slot until it leaves the board, and new
 * minions take the lowest free slot. Never reorders survivors, so nothing on screen shifts.
 */
export function assignBench(prev: readonly (string | null)[], present: readonly string[], size: number): (string | null)[] {
  const keep = new Set(present);
  const slots = Array.from({ length: size }, (_, i) => {
    const id = prev[i] ?? null;
    return id !== null && keep.has(id) ? id : null;
  });
  for (const id of present) {
    if (slots.includes(id)) continue;
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = id;
  }
  return slots;
}

export function toFloat(e: GameEvent, id: number): FloatText | null {
  if (e.t === 'damage') {
    if (e.amount === 0 && e.absorbed > 0) return { id, unit: e.target, text: `(${e.absorbed})`, kind: 'shield' };
    return { id, unit: e.target, text: `−${e.amount}`, kind: 'damage' };
  }
  if (e.t === 'heal' && e.amount > 0) return { id, unit: e.target, text: `+${e.amount}`, kind: 'heal' };
  if (e.t === 'damageBlocked') return { id, unit: e.target, text: 'Blocked', kind: 'block' };
  if (e.t === 'skillCountered') return { id, unit: e.actor, text: 'Countered!', kind: 'block' };
  return null;
}
