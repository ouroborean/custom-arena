// Runs full matches between bots and records them as replayable MatchRecords.

import {
  applyCommand,
  createMatch,
  ENGINE_VERSION,
  nextInt,
  sample,
  seedRng,
  viewFor,
  type CharacterSpec,
  type ContentBundle,
  type GameEvent,
  type GameState,
  type MatchConfig,
  type MatchRecord,
  type PlayerId,
  type RngState,
  variantId,
} from '@arena/engine';
import type { Bot } from './bots.js';

export interface PlayedMatch {
  record: MatchRecord;
  state: GameState;
  events: GameEvent[];
}

export interface PlayOptions {
  /** Called after every command with the new state (for invariant checks). */
  onStep?: (state: GameState, events: GameEvent[]) => void;
}

export function playMatch(content: ContentBundle, config: MatchConfig, bots: [Bot, Bot], opts: PlayOptions = {}): PlayedMatch {
  let { state, events } = createMatch(content, config);
  const all = [...events];
  const record: MatchRecord = { engineVersion: ENGINE_VERSION, contentVersion: content.version, config, commands: [] };
  opts.onStep?.(state, events);
  while (state.phase !== 'finished') {
    const p = state.activePlayer as PlayerId;
    const cmds = bots[p].planTurn(content, viewFor(content, state, p));
    for (const cmd of cmds) {
      ({ state, events } = applyCommand(content, state, p, cmd));
      record.commands.push({ player: p, cmd });
      all.push(...events);
      opts.onStep?.(state, events);
      if (state.phase === 'finished') break;
    }
  }
  return { record, state, events: all };
}

/** Elements that have skill variants in this content (plus "None"). */
export function availableElements(content: ContentBundle): string[] {
  const els = new Set(Object.values(content.skills).map((s) => s.element).filter((e) => e !== 'None'));
  return ['None', ...[...els].sort()];
}

/**
 * A random character for simulations and the setup screen (full character generation is Phase 4):
 * - a random (or given) class; at least 2 of its 3 signatures and 3–5 native skills from its
 *   6-skill pool (GDD §6.2, §7.2)
 * - a random (or given) base element; 1–3 skills that have a variant in it are infused (§7.2)
 */
export function randomCharacter(
  content: ContentBundle,
  rng: RngState,
  name: string,
  classId?: string,
  element?: string,
): CharacterSpec {
  const classes = Object.values(content.classes);
  const cls = (classId ? content.classes[classId] : undefined) ?? classes[nextInt(rng, classes.length)]!;
  const native = 3 + nextInt(rng, 3);
  const sigs = sample(rng, cls.signatures, 2);
  const rest = [...cls.signatures, ...cls.affinity].filter((s) => !sigs.includes(s));
  const skills = [...sigs, ...sample(rng, rest, native - 2)];
  const elements = availableElements(content);
  const el = element ?? elements[nextInt(rng, elements.length)]!;
  if (el !== 'None') {
    const infusable = skills.filter((s) => content.skills[variantId(s, el)]);
    const infuse = new Set(sample(rng, infusable, Math.min(infusable.length, 1 + nextInt(rng, 3))));
    for (let i = 0; i < skills.length; i++) if (infuse.has(skills[i]!)) skills[i] = variantId(skills[i]!, el);
  }
  return { name, classId: cls.id, element: el, skills };
}

export function randomConfig(content: ContentBundle, seed: number): MatchConfig {
  const rng = seedRng(seed ^ 0x5bd1e995);
  const team = (p: number) =>
    [0, 1, 2].map((i) => {
      const c = randomCharacter(content, rng, '');
      const cls = content.classes[c.classId!]!.name;
      return { ...c, name: `${p === 0 ? 'Blue' : 'Red'} ${cls} ${i + 1}` };
    });
  return { seed, teams: [team(0), team(1)] };
}
