// Stronger bots (GDD §11.9): Easy (damage-weighted random), Normal (one-turn simulation with a
// heuristic evaluation, built one action at a time) and Hard (Normal's best plans played one round
// deep against the opponent's reply, over a few guesses at the hidden information). Like every bot they plan from a PlayerView only:
// what they can't see is guessed ("determinized"), never read from the real state.

import {
  applyCommand,
  COLORS,
  effectDefinition,
  legalQueueCommands,
  nextInt,
  nextU32,
  seedRng,
  viewFor,
  type Command,
  type ContentBundle,
  type EffectDef,
  type GameState,
  type Op,
  type PlayerId,
  type PlayerView,
  type QueueCommand,
  type RngState,
} from '@arena/engine';
import { planningState, scoreOption, type Bot } from './bots.js';

// ---------------------------------------------------------------- determinization

/**
 * A full state consistent with the view: our side as seen, the opponent's hidden bank guessed
 * (players spend most of their energy, so 0–1 per living character; their next income comes on
 * top), their hidden effects left out, and a fresh random stream.
 */
export function determinize(view: PlayerView, rng: RngState): GameState {
  const s = planningState(view);
  s.rng = seedRng(nextU32(rng));
  const opp = view.viewer === 0 ? 1 : 0;
  const living = s.units.filter((u) => u.alive && u.owner === opp && u.kind === 'character').length;
  const energy = { S: 0, A: 0, I: 0, W: 0 };
  const banked = nextInt(rng, living + 1);
  for (let i = 0; i < banked; i++) energy[COLORS[nextInt(rng, COLORS.length)]!] += 1;
  s.players[opp] = { ...s.players[opp], energy, queue: [], tickOrder: null };
  return s;
}

// ---------------------------------------------------------------- evaluation

/** Damage an op list will eventually deal, roughly (numbers and simple if/else only). */
function pendingDamage(ops: readonly Op[] | undefined): number {
  let n = 0;
  for (const op of ops ?? []) {
    if (op.op === 'damage') {
      if (typeof op.amount === 'number') n += op.amount;
      else if ('if' in op.amount && typeof op.amount.else === 'number') n += op.amount.else;
    }
    if (op.op === 'if') n += Math.max(pendingDamage(op.then), pendingDamage(op.else));
  }
  return n;
}

/** Tunable weights of the evaluation (the tiers share the planner and differ in these and search). */
export interface EvalWeights {
  /** Per living character, on top of its Health. */
  character: number;
  /** Per point of a minion's Health, and per living minion. */
  minionHp: number;
  minion: number;
  /** Per stack of a Buff or Debuff (times its remaining turns, halved). */
  status: number;
  /** A full stun on a unit. */
  stun: number;
  /** Per point of Shield. */
  shield: number;
  /** Share of delayed or ticking damage we've set up. */
  pending: number;
  /** Per banked energy. */
  energy: number;
  /** Extra weight on enemy characters' Health over our own (0: damage dealt = damage taken). */
  aggression: number;
}

export const NORMAL_WEIGHTS: EvalWeights = {
  character: 120,
  minionHp: 0.5,
  minion: 25,
  status: 6,
  stun: 25,
  shield: 0.8,
  pending: 0.6,
  energy: 2,
  aggression: 0,
};

function effectWorth(w: EvalWeights, def: EffectDef, stacks: number, value: number, duration: number | null): number {
  if (def.shield) return value * w.shield;
  const turns = duration === null ? 4 : Math.min(4, Math.ceil(duration / 2));
  let v = w.status * Math.min(stacks, 3) * Math.max(1, turns / 2);
  if ((def.modifiers ?? []).some((m) => m.mod === 'cannotUseSkills' && !m.archetypes)) v += w.stun;
  return v;
}

/**
 * How good `s` is for `me`: living characters and their Health dominate; minions, Shields and
 * statuses add; delayed and ticking damage we've set up counts at a discount.
 */
export function evaluate(content: ContentBundle, s: GameState, me: PlayerId, w: EvalWeights = NORMAL_WEIGHTS): number {
  if (s.phase === 'finished') {
    const w = s.result?.winner;
    return w === null || w === undefined ? 0 : w === me ? 100_000 : -100_000;
  }
  let v = 0;
  for (const u of s.units) {
    if (!u.alive) continue;
    const sign = u.owner === me ? 1 : -1;
    if (u.kind === 'character') v += sign * ((sign < 0 ? 1 + w.aggression : 1) * u.hp + w.character);
    else v += sign * (w.minionHp * u.hp + w.minion);
  }
  for (const e of s.effects) {
    const def = effectDefinition(content, e);
    const bearer = s.units.find((u) => u.id === e.bearer);
    if (!def || !bearer?.alive) continue;
    const onMine = bearer.owner === me;
    if (def.kind === 'Buff' || def.shield) v += (onMine ? 1 : -1) * effectWorth(w, def, e.stacks, e.value, e.duration);
    else if (def.kind === 'Debuff') v += (onMine ? -1 : 1) * effectWorth(w, def, e.stacks, e.value, e.duration);
    // Delayed payloads (Snipe) and ticking damage (Channel, Toxin) we control are worth part of their damage.
    const mine = e.sourceOwner === me;
    const delayed = pendingDamage(def.onExpire);
    const ticking = pendingDamage((def.triggers ?? []).filter((t) => t.on === 'turnEnd').flatMap((t) => t.do ?? []));
    const future = delayed + ticking * Math.min(3, e.duration === null ? 3 : Math.ceil(e.duration / 2));
    if (future) v += (mine ? 1 : -1) * w.pending * future * Math.max(1, e.stacks);
  }
  const mine = s.players[me].energy;
  v += w.energy * (mine.S + mine.A + mine.I + mine.W);
  return v;
}

// ---------------------------------------------------------------- one-turn planning

/** The value of ending the turn now, from the rehearsed planning state. */
function valueOfEnding(content: ContentBundle, s: GameState, me: PlayerId, w: EvalWeights = NORMAL_WEIGHTS): number {
  return evaluate(content, applyCommand(content, s, me, { t: 'endTurn' }).state, me, w);
}

/**
 * Builds a queue one action at a time: each step simulates the turn for every legal option (and for
 * stopping) and keeps the best. Returns the queue with its final value; `beam` keeps the top plans
 * (by the value after their first action) for Hard's look-ahead.
 */
function planGreedily(
  content: ContentBundle,
  base: GameState,
  me: PlayerId,
  first?: QueueCommand,
  w: EvalWeights = NORMAL_WEIGHTS,
): { queue: QueueCommand[]; value: number } {
  let s = base;
  const queue: QueueCommand[] = [];
  if (first) {
    s = applyCommand(content, s, me, first).state;
    queue.push(first);
  }
  let best = valueOfEnding(content, s, me, w);
  for (let guard = 0; guard < 8; guard++) {
    let pick: { cmd: QueueCommand; state: GameState; value: number } | null = null;
    for (const cmd of legalQueueCommands(content, s, me)) {
      const next = applyCommand(content, s, me, cmd).state;
      const value = valueOfEnding(content, next, me, w);
      if (!pick || value > pick.value) pick = { cmd, state: next, value };
    }
    if (!pick || pick.value <= best) break;
    s = pick.state;
    queue.push(pick.cmd);
    best = pick.value;
  }
  return { queue, value: best };
}

/** Normal: the best one-turn plan by simulation (GDD §11.9 "heuristic scorer"). */
export function normalBot(seed: number, w: EvalWeights = NORMAL_WEIGHTS): Bot {
  const rng = seedRng(seed);
  return {
    name: 'normal',
    planTurn(content, view) {
      const base = determinize(view, rng);
      const { queue } = planGreedily(content, base, view.viewer, undefined, w);
      return [...queue, { t: 'endTurn' }];
    },
  };
}

/**
 * Hard: a one-round look-ahead (GDD §11.9's determinized search, at depth 2). Candidate plans are
 * stopping, each of the top first actions alone, and Normal's plan grown from each of them. Each is played out, then
 * the opponent's reply (Normal-strength, planned from their own view) is simulated, over a few
 * guessed worlds shared by every candidate; the best average wins.
 */
export function hardBot(seed: number, opts: { candidates?: number; samples?: number } = {}): Bot {
  const rng = seedRng(seed);
  const k = opts.candidates ?? 4;
  const samples = opts.samples ?? 2;
  return {
    name: 'hard',
    planTurn(content, view) {
      const me = view.viewer;
      const opp: PlayerId = me === 0 ? 1 : 0;
      const worlds = Array.from({ length: samples }, () => determinize(view, rng));
      const replySeeds = worlds.map(() => nextU32(rng));
      const base = worlds[0]!;
      const firsts = legalQueueCommands(content, base, me)
        .map((cmd) => ({ cmd, value: valueOfEnding(content, applyCommand(content, base, me, cmd).state, me) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, k);
      // Also the single actions on their own: holding the rest of the energy back is often right
      // once the reply is taken into account, which Normal can't see.
      const plans: QueueCommand[][] = [[], ...firsts.map((f) => [f.cmd]), ...firsts.map((f) => planGreedily(content, base, me, f.cmd).queue)];
      let best: { queue: QueueCommand[]; score: number } | null = null;
      for (const queue of plans) {
        let total = 0;
        worlds.forEach((world, i) => {
          let s = world;
          try {
            for (const cmd of queue) s = applyCommand(content, s, me, cmd).state;
          } catch {
            return; // not affordable in this guessed world
          }
          s = applyCommand(content, s, me, { t: 'endTurn' }).state;
          if (s.phase !== 'finished') {
            // The opponent answers from its own view, so it walks into our hidden Traps and
            // counters just as a real opponent would.
            const theirs = planningState(viewFor(content, s, opp));
            theirs.rng = seedRng(replySeeds[i]!);
            for (const cmd of planGreedily(content, theirs, opp).queue) s = applyCommand(content, s, opp, cmd).state;
            s = applyCommand(content, s, opp, { t: 'endTurn' }).state;
          }
          total += evaluate(content, s, me);
        });
        if (!best || total > best.score) best = { queue, score: total };
      }
      return [...(best?.queue ?? []), { t: 'endTurn' }];
    },
  };
}

/** Easy's choices from a planning state: weighted-random options until it stops. */
function easyPlan(content: ContentBundle, start: GameState, me: PlayerId, rng: RngState): QueueCommand[] {
  let s = start;
  const out: QueueCommand[] = [];
  for (let guard = 0; guard < 8; guard++) {
    const options = legalQueueCommands(content, s, me);
    if (options.length === 0 || nextInt(rng, 5) === 0) break;
    const weights = options.map((o) => Math.max(1, Math.round(scoreOption(content, s, me, o))));
    let roll = nextInt(rng, weights.reduce((a, b) => a + b, 0));
    const pick = options.find((_, i) => (roll -= weights[i]!) < 0)!;
    s = applyCommand(content, s, me, pick).state;
    out.push(pick);
  }
  return out;
}

/** Easy: random legal actions, weighted towards damaging ones, and it sometimes stops early. */
export function easyBot(seed: number): Bot {
  const rng = seedRng(seed);
  return {
    name: 'easy',
    planTurn: (content, view): Command[] => [...easyPlan(content, planningState(view), view.viewer, rng), { t: 'endTurn' }],
  };
}

/** Finishes a partly built queue at a tier's strength (scripted encounters); Hard continues like Normal. */
export function continuePlan(content: ContentBundle, s: GameState, me: PlayerId, tier: Difficulty, rng: RngState): QueueCommand[] {
  return tier === 'easy' ? easyPlan(content, s, me, rng) : planGreedily(content, s, me).queue;
}

/** Difficulty tiers by name (the client's and the story's `ai` field). */
export type Difficulty = 'easy' | 'normal' | 'hard';

export function botFor(difficulty: Difficulty, seed: number): Bot {
  return difficulty === 'hard' ? hardBot(seed) : difficulty === 'normal' ? normalBot(seed) : easyBot(seed);
}
