// Enumerates legal queue commands for the current planning state. Used by bots and UI affordances.

import { makeCtx, skillDef } from './ctx.js';
import { checkQueue } from './commands.js';
import type { ContentBundle } from './defs.js';
import type { Command, GameState, PlayerId } from './types.js';

export type QueueCommand = Extract<Command, { t: 'queue' }>;

export function legalQueueCommands(content: ContentBundle, state: GameState, player: PlayerId): QueueCommand[] {
  if (state.phase !== 'planning' || state.activePlayer !== player) return [];
  const ctx = makeCtx(state, content);
  const out: QueueCommand[] = [];
  for (const u of state.units) {
    if (u.owner !== player || !u.alive) continue;
    u.skills.forEach((slot, i) => {
      const def = skillDef(content, slot.defId);
      const options: string[][] =
        def.target === 'enemy'
          ? state.units.filter((t) => t.alive && t.owner !== player).map((t) => [t.id])
          : def.target === 'ally'
            ? state.units.filter((t) => t.alive && t.owner === player).map((t) => [t.id])
            : [[]];
      for (const targets of options) {
        const cmd: QueueCommand = { t: 'queue', actor: u.id, slot: i, targets };
        if (checkQueue(ctx, player, cmd) === null) out.push(cmd);
      }
    });
  }
  return out;
}
