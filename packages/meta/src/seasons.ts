// Ranked seasons (GDD §2.2 "Ranked multiplayer: seasonal", docs/live-ops.md §4). Pure rules over a
// schedule the server loads from apps/server/seasons.json: which season is running, the soft reset
// that seeds a player's rating from their last season, and the reward tier a final rating earns.

import { pieceComponentIds, pieceProblems, type ContentBundle, type GrantSpec } from '@arena/engine';
import { DEFAULT_RATING, displayRating, type Rating } from './glicko2.js';

export interface Season {
  /** Also the ratings queue id (`ranked-s1`…); never reuse one. */
  id: string;
  name: string;
  /** ISO timestamps; a season runs from `start` up to (not including) `end`. */
  start: string;
  /** Only the last season may leave this out (it runs until the next one is scheduled). */
  end?: string;
}

export interface SeasonTier {
  id: string;
  name: string;
  /** Lowest final display rating (rating − 2·RD) for this tier. */
  min: number;
  reward?: Pick<GrantSpec, 'currency' | 'items'>;
}

export interface SeasonSchedule {
  seasons: Season[];
  /** A new season's starting rating: `keep` of the distance from 1500 carries over, RD rises to at least `rd`. */
  softReset: { keep: number; rd: number };
  /** Ranked games needed in a season to place in a tier. */
  minGames: number;
  /** Ascending by `min`. */
  tiers: SeasonTier[];
}

/** Before Phase 8 ranked had one open-ended season; servers without a schedule (and tests) keep that. */
export const OPEN_SCHEDULE: SeasonSchedule = {
  seasons: [{ id: 'ranked-s1', name: 'Season 1', start: '1970-01-01T00:00:00Z' }],
  softReset: { keep: 0.5, rd: 200 },
  minGames: 10,
  tiers: [],
};

const ms = (iso: string) => Date.parse(iso);

/** The season running at `at` (epoch ms), or null between seasons. */
export function seasonAt(s: SeasonSchedule, at: number): Season | null {
  return s.seasons.find((x) => ms(x.start) <= at && (x.end === undefined || at < ms(x.end))) ?? null;
}

/** The next season to start after `at`, if one is scheduled. */
export function nextSeason(s: SeasonSchedule, at: number): Season | null {
  return s.seasons.find((x) => ms(x.start) > at) ?? null;
}

/** Seasons before `id`, latest first (where a soft reset looks for a previous rating). */
export function earlierSeasons(s: SeasonSchedule, id: string): Season[] {
  const i = s.seasons.findIndex((x) => x.id === id);
  return i < 0 ? [] : s.seasons.slice(0, i).reverse();
}

export function seasonEnded(season: Season, at: number): boolean {
  return season.end !== undefined && at >= ms(season.end);
}

/** A returning player's starting rating in a new season. */
export function softReset(prev: Rating, rule: SeasonSchedule['softReset']): Rating {
  return {
    rating: DEFAULT_RATING.rating + (prev.rating - DEFAULT_RATING.rating) * rule.keep,
    rd: Math.min(DEFAULT_RATING.rd, Math.max(prev.rd, rule.rd)),
    vol: prev.vol,
  };
}

/** The tier a season's final rating places in; null below `minGames` or the lowest tier. */
export function seasonTier(s: SeasonSchedule, r: Rating & { games: number }): SeasonTier | null {
  if (r.games < s.minGames) return null;
  const d = displayRating(r);
  let tier: SeasonTier | null = null;
  for (const t of s.tiers) if (d >= t.min) tier = t;
  return tier;
}

/** Problems with a schedule: ordering, overlaps, ids, tiers, and rewards that don't exist in `content`. */
export function checkSchedule(s: SeasonSchedule, content?: ContentBundle): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  s.seasons.forEach((x, i) => {
    const where = `seasons[${i}] (${x.id})`;
    if (ids.has(x.id)) out.push(`${where}: duplicate id`);
    ids.add(x.id);
    if (x.id === 'casual') out.push(`${where}: "casual" is the casual queue's id`);
    if (Number.isNaN(ms(x.start))) out.push(`${where}: start isn't a date`);
    if (x.end !== undefined && Number.isNaN(ms(x.end))) out.push(`${where}: end isn't a date`);
    if (x.end !== undefined && ms(x.end) <= ms(x.start)) out.push(`${where}: ends before it starts`);
    const next = s.seasons[i + 1];
    if (next) {
      if (x.end === undefined) out.push(`${where}: only the last season may leave out its end`);
      else if (ms(next.start) < ms(x.end)) out.push(`${where}: overlaps ${next.id}`);
    }
  });
  if (!(s.softReset.keep >= 0 && s.softReset.keep <= 1)) out.push('softReset.keep must be between 0 and 1');
  s.tiers.forEach((t, i) => {
    const prev = s.tiers[i - 1];
    if (prev && t.min <= prev.min) out.push(`tiers[${i}] (${t.id}): min must be above ${prev.id}'s`);
    if (!content) return;
    for (const c of Object.keys(t.reward?.currency ?? {})) {
      if (!content.economy.currencies[c]) out.push(`tiers[${i}] (${t.id}): unknown currency ${c}`);
    }
    for (const it of t.reward?.items ?? []) if (pieceProblems(content, pieceComponentIds(it)).length) out.push(`tiers[${i}] (${t.id}): unknown item ${it}`);
  });
  return out;
}
