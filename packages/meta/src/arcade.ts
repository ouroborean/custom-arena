// Arcade mode (docs/single-player.md §Arcade): a ladder of bot teams whose kits grow on a fixed curve
// (economy.arcade.yaml). Pure and seeded: the server issues each stage's seed and team, and pays a
// stage's reward once it has replayed the win.

import { nextInt, sample, type ArcadeDef, type ArcadeStage, type CharacterSpec, type ContentBundle, type RngState } from '@arena/engine';
import { isForfeit, rollRewardSpec, type Outcome, type Reward } from './economy.js';
import { rollableClasses, rollableElements } from './generate.js';
import { infusedSkillId } from './loadout.js';
import { generateName } from './names.js';

/** The ladder, or throws if the content has none. */
export function arcadeDef(content: ContentBundle): ArcadeDef {
  const def = content.economy.arcade;
  if (!def) throw new Error('This content has no arcade ladder');
  return def;
}

/** A stage by its number (1-based). */
export function arcadeStage(content: ContentBundle, stage: number): ArcadeStage {
  const s = arcadeDef(content).stages[stage - 1];
  if (!s) throw new Error(`No arcade stage ${stage}`);
  return s;
}

/** The last finished stage of the player's arcade history, as the next one is worked out from it. */
export interface ArcadeLast {
  stage: number;
  outcome: Outcome;
}

/**
 * The stage the player plays next: the one after a win, stage 1 after a loss or a draw (the run is
 * over), and stage 1 again after clearing the last stage (a new run).
 */
export function arcadeNextStage(content: ContentBundle, last: ArcadeLast | undefined): number {
  const stages = arcadeDef(content).stages.length;
  if (!last || last.outcome !== 'win' || last.stage >= stages) return 1;
  return last.stage + 1;
}

/** Two elements for each of the three enemies: [first, second], related as the stage's `overlap` says. */
function teamElements(content: ContentBundle, stage: ArcadeStage, rng: RngState): [string, string][] {
  const elements = rollableElements(content);
  const pick = () => elements[nextInt(rng, elements.length)]!;
  if (stage.overlap === 'full') {
    const [a, b] = sample(rng, elements, 2) as [string, string];
    return [0, 1, 2].map(() => [a, b]);
  }
  if (stage.overlap === 'partial') {
    const firsts = sample(rng, elements, 3);
    return firsts.map((e, i) => [e, firsts[(i + 1) % 3]!]);
  }
  return [0, 1, 2].map(() => [pick(), pick()]);
}

/**
 * One enemy: its class's starter skill and more from the class pool, then the stage's infusions:
 * double skills take both its elements; each single infusion is one of its own elements with the
 * stage's `cohesion` chance, and any element otherwise.
 */
function arcadeEnemy(content: ContentBundle, stage: ArcadeStage, classId: string, own: [string, string], rng: RngState): CharacterSpec {
  const cls = content.classes[classId]!;
  const elements = rollableElements(content);
  const pool = [...cls.signatures, ...cls.affinity];
  const starter = cls.starter ?? pool[0]!;
  const bases = [starter, ...sample(rng, pool.filter((s) => s !== starter), stage.skills - 1)];
  // Before doubles and overlap the second element plays no part, so cohesive kits are one element.
  const mine = stage.doubles > 0 || stage.overlap !== 'none' ? own : [own[0]];
  const singles = stage.infusions - 2 * stage.doubles;
  const wanted: string[][] = [
    ...Array.from({ length: stage.doubles }, () => [...own]),
    ...Array.from({ length: singles }, () => {
      const cohesive = stage.cohesion >= 1 || (stage.cohesion > 0 && nextInt(rng, 1000) < Math.round(stage.cohesion * 1000));
      return [cohesive ? mine[nextInt(rng, mine.length)]! : elements[nextInt(rng, elements.length)]!];
    }),
  ];
  // Each infusion set goes on a random skill that has a variant for it (skipped if none does).
  const skills = [...bases];
  const free = sample(rng, bases.map((_, i) => i), bases.length);
  for (const infusions of wanted) {
    const at = free.findIndex((i) => infusedSkillId(content, bases[i]!, infusions) !== undefined);
    if (at < 0) continue;
    const i = free.splice(at, 1)[0]!;
    skills[i] = infusedSkillId(content, bases[i]!, infusions)!;
  }
  return { name: generateName(rng, cls.id, cls.name, own[0]), classId: cls.id, element: own[0], skills };
}

/** The bot team for a stage: three different classes, kits shaped by the stage. */
export function arcadeTeam(content: ContentBundle, stageNumber: number, rng: RngState): CharacterSpec[] {
  const stage = arcadeStage(content, stageNumber);
  const classes = sample(rng, rollableClasses(content), 3);
  const elements = teamElements(content, stage, rng);
  return classes.map((c, i) => arcadeEnemy(content, stage, c.id, elements[i]!, rng));
}

export interface ArcadeRewardInput {
  stage: number;
  outcome: Outcome;
  endReason: string;
  /** Arcade item drops the account has already had today. */
  dropsToday: number;
}

/**
 * What a finished stage pays: its `win` reward (plus `complete` for the last stage), or the `loss`
 * reward when the run ends in a played-out loss or a draw. A surrender pays nothing.
 */
export function arcadeReward(content: ContentBundle, input: ArcadeRewardInput, rng: RngState): Reward {
  const def = arcadeDef(content);
  const specs =
    input.outcome === 'win'
      ? [arcadeStage(content, input.stage).win, ...(input.stage === def.stages.length ? [def.complete] : [])]
      : isForfeit(input.endReason)
        ? []
        : [def.loss];
  const out: Reward = { currency: {}, items: [] };
  let dropsToday = input.dropsToday;
  for (const spec of specs) {
    const r = rollRewardSpec(content, spec, def.dailyDropCap, dropsToday, rng);
    for (const [k, n] of Object.entries(r.currency)) out.currency[k] = (out.currency[k] ?? 0) + n;
    out.items.push(...r.items);
    dropsToday += r.items.length;
  }
  return out;
}
