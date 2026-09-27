// Single-player (GDD §2.2): encounters become match configs; story progress decides what's
// unlocked; achievements count finished matches. Pure functions over content data.

import { variantId, type AchievementDef, type CharacterSpec, type ContentBundle, type EncounterDef, type EncounterUnitDef, type MatchConfig } from '@arena/engine';

/** The human always sits in seat 0 in single-player; the encounter's AI plays seat 1. */
export const HUMAN_SEAT = 0;

/**
 * The AI's seed for a single-player match. Client and server must agree: the server re-derives the
 * AI's moves from it when it verifies a finished attempt.
 */
export function singlePlayerBotSeed(matchSeed: number): number {
  return (matchSeed + 101) >>> 0;
}

/**
 * An encounter character as engine input. Without explicit `skills`, the kit is the class's
 * signatures then affinity skills (up to `skillCount`, default 4), each infused with the unit's
 * element where a variant exists.
 */
export function encounterUnitSpec(content: ContentBundle, u: EncounterUnitDef): CharacterSpec {
  const cls = content.classes[u.classId];
  if (!cls) throw new Error(`Unknown class ${u.classId}`);
  const element = u.element ?? 'None';
  const skills =
    u.skills ??
    [...cls.signatures, ...cls.affinity]
      .slice(0, u.skillCount ?? 4)
      .map((s) => (element !== 'None' && content.skills[variantId(s, element)] ? variantId(s, element) : s));
  return {
    name: u.name,
    classId: u.classId,
    element,
    skills,
    ...(u.hp ? { hp: u.hp } : {}),
    ...(u.passives?.length ? { passives: u.passives } : {}),
  };
}

/** The match for an encounter: the player's team (or the encounter's fixed one) against its enemies. */
export function encounterConfig(content: ContentBundle, enc: EncounterDef, seed: number, playerTeam?: CharacterSpec[]): MatchConfig {
  const player = enc.playerTeam ? enc.playerTeam.map((u) => encounterUnitSpec(content, u)) : playerTeam;
  if (!player?.length) throw new Error(`${enc.name} needs the player's team`);
  return {
    seed,
    teams: [player, enc.enemies.map((u) => encounterUnitSpec(content, u))],
    firstPlayer: enc.first === 'enemy' ? 1 : 0,
    ...(enc.settings ? { settings: enc.settings } : {}),
  };
}

// ---------------------------------------------------------------- story progress

export interface EncounterStatus {
  id: string;
  unlocked: boolean;
  cleared: boolean;
}

export interface ChapterStatus {
  id: string;
  unlocked: boolean;
  /** Every encounter cleared at least once. */
  complete: boolean;
  encounters: EncounterStatus[];
}

/**
 * What the player can play, given the encounters they've cleared: a chapter opens when the one it
 * requires is complete; inside it, each encounter opens when the previous one is cleared.
 */
export function storyStatus(content: ContentBundle, cleared: ReadonlySet<string>): ChapterStatus[] {
  const out: ChapterStatus[] = [];
  for (const c of Object.values(content.chapters)) {
    const complete = c.encounters.every((e) => cleared.has(e));
    const unlocked = !c.requires || !!out.find((x) => x.id === c.requires)?.complete || c.encounters.some((e) => cleared.has(e));
    out.push({
      id: c.id,
      unlocked,
      complete,
      encounters: c.encounters.map((id, i) => ({
        id,
        cleared: cleared.has(id),
        unlocked: unlocked && (i === 0 || cleared.has(c.encounters[i - 1]!)),
      })),
    });
  }
  return out;
}

/** The chapter an encounter belongs to (the first that lists it). */
export function chapterOf(content: ContentBundle, encounterId: string): string | undefined {
  return Object.values(content.chapters).find((c) => c.encounters.includes(encounterId))?.id;
}

// ---------------------------------------------------------------- achievements

/** A finished match, as achievements see it (from the player's side). */
export interface MatchFact {
  mode: string;
  outcome: 'win' | 'loss' | 'draw';
  turns: number;
  /** Classes and base elements on the player's team. */
  classes: string[];
  elements: string[];
  encounter?: string;
  chapter?: string;
}

export interface AchievementProgress {
  /** Counting matches so far (the current run, for streaks). */
  count: number;
  done: boolean;
}

/** Whether a finished match counts towards an achievement. */
export function countsFor(a: AchievementDef, f: MatchFact): boolean {
  const w = a.when;
  if (w.modes && !w.modes.includes(f.mode)) return false;
  if (w.outcome && w.outcome !== f.outcome) return false;
  if (w.withClass && !f.classes.includes(w.withClass)) return false;
  if (w.withElement && !f.elements.includes(w.withElement)) return false;
  if (w.encounter && w.encounter !== f.encounter) return false;
  if (w.chapter && w.chapter !== f.chapter) return false;
  if (w.maxTurns !== undefined && f.turns > w.maxTurns) return false;
  return true;
}

/**
 * Progress after one more finished match. Streaks reset on a match of the same modes that doesn't
 * count; a finished achievement stays finished.
 */
export function advanceAchievement(a: AchievementDef, prev: AchievementProgress | undefined, f: MatchFact): AchievementProgress {
  const p = prev ?? { count: 0, done: false };
  if (p.done) return p;
  if (countsFor(a, f)) {
    const count = p.count + 1;
    return { count, done: count >= a.count };
  }
  const sameModes = !a.when.modes || a.when.modes.includes(f.mode);
  return a.streak && sameModes ? { count: 0, done: false } : p;
}
