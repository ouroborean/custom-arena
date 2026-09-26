import { makeCtx, type Ctx } from './ctx.js';
import type { ContentBundle } from './defs.js';
import { emptyEnergy } from './energy.js';
import { seedRng } from './rng.js';
import { startTurn } from './turn.js';
import type { ApplyResult, GameState, MatchConfig, MatchSettings, PlayerId, Unit } from './types.js';

export const ENGINE_VERSION = '0.1.0';

export const DEFAULT_SETTINGS: MatchSettings = {
  turnLimitPerPlayer: 50, // R3
  minionCap: 4, // R5
};

export const DEFAULT_HP = 100; // R4
export const MAX_SKILLS = 5;

export function createMatch(content: ContentBundle, config: MatchConfig): ApplyResult {
  const units: Unit[] = [];
  config.teams.forEach((team, p) => {
    if (team.length < 1 || team.length > 3) throw new Error(`Team ${p} must have 1–3 characters`);
    team.forEach((spec, i) => {
      if (spec.skills.length < 1 || spec.skills.length > MAX_SKILLS) {
        throw new Error(`${spec.name} must have 1–${MAX_SKILLS} skills`);
      }
      for (const id of spec.skills) if (!content.skills[id]) throw new Error(`Unknown skill ${id} on ${spec.name}`);
      const hp = spec.hp ?? DEFAULT_HP;
      units.push({
        id: `p${p}c${i}`,
        owner: p as PlayerId,
        kind: 'character',
        defId: spec.classId ?? 'none',
        name: spec.name,
        hp,
        maxHp: hp,
        alive: true,
        skills: spec.skills.map((defId) => ({ defId, cooldown: 0 })),
        counters: {},
      });
    });
  });

  const state: GameState = {
    engineVersion: ENGINE_VERSION,
    contentVersion: content.version,
    turn: 1,
    activePlayer: config.firstPlayer ?? 0,
    phase: 'planning',
    result: null,
    rng: seedRng(config.seed),
    players: [
      { energy: emptyEnergy(), queue: [], tickOrder: null, turnsTaken: 0 },
      { energy: emptyEnergy(), queue: [], tickOrder: null, turnsTaken: 0 },
    ],
    units,
    effects: [],
    settings: { ...DEFAULT_SETTINGS, ...config.settings },
    seq: 0,
  };
  const ctx: Ctx = makeCtx(state, content);
  startTurn(ctx);
  return { state, events: ctx.events };
}
