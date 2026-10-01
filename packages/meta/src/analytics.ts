// Pick and win rates from finished matches (GDD Phase 8 analytics). Pure: the server's analytics
// CLI feeds it recorded match configs; the balance simulator could feed it bot games.
//
// Counting is per team side: a class (element, skill, item) is "picked" by a side when any of its
// characters has it, at most once per side per match. Win rate = wins / picks, a draw counting
// half. Pick rate = picks / sides played (two per match).

import type { CharacterSpec, ContentBundle, PlayerId } from '@arena/engine';

export interface MatchSample {
  teams: [CharacterSpec[], CharacterSpec[]];
  winner: PlayerId | null;
}

export interface RateRow {
  id: string;
  name: string;
  picks: number;
  wins: number;
  pickRate: number;
  winRate: number;
}

export interface Analytics {
  matches: number;
  draws: number;
  /** Wins by the side that moved first (seat 0), as a share of decided matches. */
  firstSeatWinRate: number;
  classes: RateRow[];
  elements: RateRow[];
  /** By skill id (elemental variants separately). */
  skills: RateRow[];
  /** By equipped item id (matches recorded with loadouts). */
  items: RateRow[];
}

type Tally = Map<string, { picks: number; wins: number }>;

function add(t: Tally, ids: Iterable<string>, score: number): void {
  for (const id of new Set(ids)) {
    const row = t.get(id) ?? { picks: 0, wins: 0 };
    row.picks += 1;
    row.wins += score;
    t.set(id, row);
  }
}

function rows(t: Tally, sides: number, name: (id: string) => string): RateRow[] {
  return [...t.entries()]
    .map(([id, r]) => ({ id, name: name(id), picks: r.picks, wins: r.wins, pickRate: sides ? r.picks / sides : 0, winRate: r.picks ? r.wins / r.picks : 0 }))
    .sort((a, b) => b.picks - a.picks || b.winRate - a.winRate || (a.id < b.id ? -1 : 1));
}

export function analyzeMatches(content: ContentBundle, samples: readonly MatchSample[]): Analytics {
  const classes: Tally = new Map();
  const elements: Tally = new Map();
  const skills: Tally = new Map();
  const items: Tally = new Map();
  let draws = 0;
  let firstWins = 0;
  for (const m of samples) {
    if (m.winner === null) draws++;
    else if (m.winner === 0) firstWins++;
    m.teams.forEach((team, side) => {
      const score = m.winner === null ? 0.5 : m.winner === side ? 1 : 0;
      add(classes, team.flatMap((c) => (c.classId ? [c.classId] : [])), score);
      add(elements, team.flatMap((c) => (c.element && c.element !== 'None' ? [c.element] : [])), score);
      add(skills, team.flatMap((c) => c.skills), score);
      add(items, team.flatMap((c) => c.items ?? []), score);
    });
  }
  const sides = samples.length * 2;
  const decided = samples.length - draws;
  return {
    matches: samples.length,
    draws,
    firstSeatWinRate: decided ? firstWins / decided : 0,
    classes: rows(classes, sides, (id) => content.classes[id]?.name ?? id),
    elements: rows(elements, sides, (id) => id),
    skills: rows(skills, sides, (id) => content.skills[id]?.name ?? id),
    items: rows(items, sides, (id) => content.items[id]?.name ?? id),
  };
}

/** A plain-text table of rows with at least `minPicks` picks (for the CLI). */
export function formatRates(title: string, list: readonly RateRow[], minPicks = 1): string {
  const shown = list.filter((r) => r.picks >= minPicks);
  const pct = (n: number) => `${(100 * n).toFixed(1).padStart(5)}%`;
  const lines = shown.map((r) => {
    const flag = r.picks >= 20 && r.winRate > 0.55 ? '  ▲' : r.picks >= 20 && r.winRate < 0.45 ? '  ▼' : '';
    return `  ${r.name.padEnd(28)} win ${pct(r.winRate)}  pick ${pct(r.pickRate)}  (n=${r.picks})${flag}`;
  });
  return [`${title} (${shown.length})`, ...lines].join('\n');
}
