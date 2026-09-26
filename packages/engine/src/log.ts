// Human-readable battle log lines for events.

import type { ContentBundle, EffectDef, Op } from './defs.js';
import { formatCost } from './energy.js';
import { COLORS, type Energy, type GameEvent, type Unit } from './types.js';

function findInline(ops: readonly Op[], id: string): EffectDef | undefined {
  for (const op of ops) {
    if (op.op === 'apply' && typeof op.effect !== 'string' && op.effect.id === id) return op.effect;
    if (op.op === 'if') return findInline(op.then, id) ?? findInline(op.else ?? [], id);
    if (op.op === 'forEach') return findInline(op.do, id);
  }
  return undefined;
}

export function effectName(content: ContentBundle, defId: string): string {
  const named = content.statuses[defId];
  if (named) return named.name;
  const [owner, inlineId] = defId.split(':');
  if (owner && inlineId) {
    const skill = content.skills[owner];
    const def = skill ? findInline(skill.ops, inlineId) : undefined;
    if (def) return def.name;
    for (const m of Object.values(content.minions)) {
      for (const p of m.passives) if (typeof p !== 'string' && p.id === inlineId) return p.name;
    }
    if (inlineId === 'lifetime') return 'Summoned';
    return inlineId;
  }
  return defId;
}

function energyText(e: Energy): string {
  return COLORS.map((c) => c.repeat(e[c])).join('') || 'nothing';
}

export function formatEvent(content: ContentBundle, units: readonly Unit[], e: GameEvent): string {
  const name = (id: string) => units.find((u) => u.id === id)?.name ?? id;
  const skill = (id: string) => content.skills[id]?.name ?? id;
  switch (e.t) {
    case 'turnStart':
      return `— Turn ${e.turn}: Player ${e.player + 1} —`;
    case 'energyGained':
      return `Player ${e.player + 1} gains ${energyText(e.gained)}`;
    case 'skillUsed': {
      const cost = content.skills[e.skill] ? ` [${formatCost(content.skills[e.skill]!.cost)}]` : '';
      const on = e.targets.length ? ` on ${e.targets.map(name).join(', ')}` : '';
      return `${name(e.actor)} uses ${skill(e.skill)}${cost}${on}`;
    }
    case 'skillFailed':
      return `${name(e.actor)}'s ${skill(e.skill)} fails (${e.reason})${e.refunded ? ', refunded' : ''}`;
    case 'skillCountered':
      return `${name(e.actor)}'s ${skill(e.skill)} is ${e.reflected ? 'reflected' : 'countered'} by ${name(e.by)}'s ${effectName(content, e.effect)}`;
    case 'damage': {
      const kind = [e.direct ? '' : 'indirect', e.type === 'Normal' ? '' : e.type].filter(Boolean).join(' ');
      const abs = e.absorbed ? ` (${e.absorbed} absorbed)` : '';
      return `${name(e.source)} deals ${e.amount}${kind ? ` ${kind}` : ''} damage to ${name(e.target)}${abs} → ${e.hp} HP`;
    }
    case 'damageBlocked':
      return `${name(e.target)} is unaffected by ${name(e.source)} (${e.reason})`;
    case 'heal':
      return `${name(e.target)} heals ${e.amount} → ${e.hp} HP`;
    case 'effectApplied': {
      const stacks = e.stacks > 1 ? ` ×${e.stacks}` : '';
      const value = e.value ? ` (${e.value})` : '';
      const dur = e.duration === null ? '' : ` [${e.duration}]`;
      return `${name(e.bearer)} gains ${effectName(content, e.defId)}${stacks}${value}${dur}`;
    }
    case 'effectBlocked':
      return `${effectName(content, e.defId)} on ${name(e.bearer)} is blocked (${e.reason})`;
    case 'effectRemoved':
      return `${name(e.bearer)}'s ${effectName(content, e.defId)} ends (${e.reason})`;
    case 'effectRevealed':
      return `${name(e.source)}'s hidden ${effectName(content, e.defId)} on ${name(e.bearer)} is revealed!`;
    case 'summoned':
      return `${name(e.by)} summons ${name(e.unit)}`;
    case 'died':
      return `${name(e.unit)} is defeated`;
    case 'turnEnd':
      return `Player ${e.player + 1} ends turn ${e.turn}`;
    case 'gameOver':
      return e.result.winner === null ? `Match drawn (${e.result.reason})` : `Player ${e.result.winner + 1} wins (${e.result.reason})`;
  }
}
