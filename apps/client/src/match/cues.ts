// Which sound a battle event makes (pure, so it's testable without audio). The viewer matters for
// the end of the match: their victory or defeat.

import { effectDefById, type ContentBundle, type GameEvent, type PlayerId } from '@arena/engine';

export type Cue = 'hit' | 'bigHit' | 'shieldHit' | 'heal' | 'buff' | 'debuff' | 'stun' | 'counter' | 'death' | 'skill' | 'turn' | 'victory' | 'defeat';

export const CUES: readonly Cue[] = ['hit', 'bigHit', 'shieldHit', 'heal', 'buff', 'debuff', 'stun', 'counter', 'death', 'skill', 'turn', 'victory', 'defeat'];

export function cueFor(content: ContentBundle, e: GameEvent, viewer: PlayerId): Cue | null {
  switch (e.t) {
    case 'damage':
      if (e.amount === 0 && e.absorbed > 0) return 'shieldHit';
      if (e.amount + e.absorbed === 0) return null;
      return e.amount + e.absorbed >= 30 ? 'bigHit' : 'hit';
    case 'heal':
      return e.amount > 0 ? 'heal' : null;
    case 'effectApplied': {
      const def = effectDefById(content, e.defId);
      if (!def) return null;
      if ((def.modifiers ?? []).some((m) => m.mod === 'cannotUseSkills' && !m.archetypes)) return 'stun';
      if (def.kind === 'Buff') return 'buff';
      if (def.kind === 'Debuff') return 'debuff';
      return null;
    }
    case 'skillCountered':
      return 'counter';
    case 'died':
      return 'death';
    case 'skillUsed':
      return 'skill';
    case 'turnStart':
      return e.player === viewer ? 'turn' : null;
    case 'gameOver':
      return e.result.winner === null ? 'defeat' : e.result.winner === viewer ? 'victory' : 'defeat';
    default:
      return null;
  }
}
