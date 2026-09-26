// Bots plan from a PlayerView only (never the full state), so they can't peek at hidden info
// (GDD §11.9). Queue commands don't consume the match RNG, so a bot can safely rehearse its queue
// on a planning copy built from its view.

import {
  applyCommand,
  legalQueueCommands,
  nextInt,
  seedRng,
  type Command,
  type ContentBundle,
  type GameState,
  type Op,
  type PlayerId,
  type PlayerView,
  type QueueCommand,
  type RngState,
  type SkillDef,
} from '@arena/engine';

export interface Bot {
  name: string;
  /** Returns the full command list for this turn, ending with endTurn. */
  planTurn(content: ContentBundle, view: PlayerView): Command[];
}

/** Rebuilds a state-shaped object from a view for rehearsing queue commands. */
export function planningState(view: PlayerView): GameState {
  const { viewer, players, ...rest } = view;
  const me = players[viewer];
  const blank = { energy: { S: 0, A: 0, I: 0, W: 0 }, queue: [], tickOrder: null, turnsTaken: 0 };
  if (me.energy === null) throw new Error('planningState: view has no own energy');
  const ps: GameState['players'] = viewer === 0 ? [structuredClone(me) as GameState['players'][0], blank] : [blank, structuredClone(me) as GameState['players'][1]];
  return { ...structuredClone(rest), players: ps, rng: { a: 0, b: 0, c: 0, d: 0 } };
}

function planWith(
  content: ContentBundle,
  view: PlayerView,
  choose: (options: QueueCommand[], s: GameState) => QueueCommand | null,
): Command[] {
  const me = view.viewer as PlayerId;
  let s = planningState(view);
  const out: Command[] = [];
  for (let guard = 0; guard < 16; guard++) {
    const options = legalQueueCommands(content, s, me);
    if (options.length === 0) break;
    const pick = choose(options, s);
    if (!pick) break;
    s = applyCommand(content, s, me, pick).state;
    out.push(pick);
  }
  out.push({ t: 'endTurn' });
  return out;
}

/** Uniformly random legal actions; stops early now and then. */
export function randomBot(seed: number): Bot {
  const rng: RngState = seedRng(seed);
  return {
    name: 'random',
    planTurn: (content, view) =>
      planWith(content, view, (options) => (nextInt(rng, 7) === 0 ? null : options[nextInt(rng, options.length)]!)),
  };
}

// ---------------------------------------------------------------- greedy ("Easy/Normal" tier seed)

function staticDamage(ops: readonly Op[]): number {
  let n = 0;
  for (const op of ops) {
    if (op.op === 'damage' && typeof op.amount === 'number') n += op.amount;
    if (op.op === 'damage' && typeof op.amount === 'object' && 'if' in op.amount) {
      const a = op.amount;
      n += typeof a.else === 'number' ? a.else : 0;
    }
    if (op.op === 'apply' && typeof op.effect !== 'string') n += staticDamage(op.effect.onExpire ?? []);
  }
  return n;
}

function score(content: ContentBundle, s: GameState, me: PlayerId, cmd: QueueCommand): number {
  const actor = s.units.find((u) => u.id === cmd.actor)!;
  const def: SkillDef = content.skills[actor.skills[cmd.slot]!.defId]!;
  const enemies = s.units.filter((u) => u.alive && u.owner !== me);
  const allies = s.units.filter((u) => u.alive && u.owner === me);
  const target = cmd.targets[0] ? s.units.find((u) => u.id === cmd.targets[0]) : undefined;
  let v = staticDamage(def.ops);
  if (def.target === 'allEnemies') v *= enemies.length;
  if (target && target.owner === me) v = -v; // damage aimed at our own side (Unholy Consume Lesser)
  if (target && target.owner !== me) {
    v += (100 - target.hp) / 4; // focus fire
    if (target.hp <= v) v += 40; // likely kill
  }
  if (def.tags.includes('Helpful')) {
    const hurt = allies.reduce((n, u) => n + (u.maxHp - u.hp), 0);
    v += def.archetype === 'Heal' || def.archetype === 'Prayer' ? Math.min(hurt, 30) : 12;
    if (target && target.owner === me && target.maxHp - target.hp < 15 && def.archetype === 'Heal') v -= 30;
  } else if (def.tags.includes('Strategic')) {
    v += 14;
  }
  const cost = def.cost.S + def.cost.A + def.cost.I + def.cost.W + def.cost.r;
  return v - cost * 3;
}

export function greedyBot(seed: number): Bot {
  const rng = seedRng(seed);
  return {
    name: 'greedy',
    planTurn: (content, view) =>
      planWith(content, view, (options, s) => {
        let best: QueueCommand | null = null;
        let bestScore = 0;
        for (const o of options) {
          const v = score(content, s, view.viewer, o) + nextInt(rng, 5);
          if (v > bestScore) {
            best = o;
            bestScore = v;
          }
        }
        return best;
      }),
  };
}
