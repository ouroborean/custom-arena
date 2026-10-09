// Typed client for the API server (apps/server). Requests are same-origin (/api, proxied by Vite in
// development) so the httpOnly session cookie rides along automatically.

import type { CharacterSpec, MatchConfig, MatchRecord, PlayerId } from '@arena/engine';
import type { CharacterSkill, LevelState, Loadout, LootRoll, ResolvedLoadout, XpGain } from '@arena/meta';

export interface User {
  id: string;
  email: string;
  displayName: string;
  /** Can use the admin tool. */
  isAdmin?: boolean;
}

/** The admin tool's headline counts and who's online. */
export interface AdminOverview {
  registered: number;
  newToday: number;
  newThisWeek: number;
  activeToday: number;
  activeNow: number;
  matchesToday: number;
  inMatch: number;
  online: { id: string; name: string; inMatch: boolean }[];
}

export interface AdminPlayerRow {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
  level: number;
  gold: number | null;
  characters: number;
  online: boolean;
}

export interface AdminPlayer {
  account: { id: string; displayName: string; email: string; createdAt: string; lastSeenAt: string | null; online: boolean; inMatch: boolean };
  progress: { level: number; xp: number; needed: number; total: number; unopenedBoxes: number };
  wallet: Wallet;
  characters: (Character & { resolved: ResolvedLoadout })[];
  team: string[];
  inventory: { id: string; itemId: string; source: string; acquiredAt: string; equippedOn: string | null }[];
  ranked: { season: string; rating: number; display: number; games: number; wins: number; tier: string | null } | null;
  casual: { games: number; wins: number };
  story: { cleared: number; clears: { id: string; clears: number }[]; chapters: string[] };
  arcadeBest: number;
  achievements: string[];
  guides: string[];
  recentMatches: { id: string; kind: string; status: string; opponent: string; outcome: 'win' | 'loss' | 'draw' | null; endReason: string | null; turns: number; startedAt: string }[];
}

export interface Character {
  id: string;
  name: string;
  classId: string;
  element: string;
  portraitId: string;
  skills: CharacterSkill[];
  loadout: Loadout;
  contentVersion: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  source: string;
  acquiredAt: string;
  equippedOn: string | null;
}

/** Balances by currency id (content economy). */
export type Wallet = Record<string, number>;

/** What a match paid (docs/equipment.md §3), with its experience (§4.1). */
export interface Reward {
  currency: Record<string, number>;
  items: string[];
  xp?: XpGain;
  /** Loot boxes a fixed grant paid (tutorial lessons, menu guides), by box id. */
  boxes?: string[];
}

/** One place on a leaderboard; `value` is null for a place filled by registration order. */
export interface LeaderboardEntry {
  name: string;
  value: number | null;
  /** The ranked tier (or "Placement"). */
  detail?: string;
}

export interface Leaderboards {
  winstreak: LeaderboardEntry[];
  rank: LeaderboardEntry[];
  season: { id: string; name: string } | null;
}

/** An unopened loot box: its kind, and the level and bubble that paid it. */
export interface LootBox {
  id: string;
  box: string;
  /** What paid it: level (a bubble on the bar), tutorial, guide, … */
  source: string;
  level: number | null;
  at: number | null;
  createdAt: string;
}

/** The player's level, progress into it and unopened loot boxes. */
export interface Progress extends LevelState {
  boxes: LootBox[];
}

export type { LootRoll, XpGain };

export interface EncounterStatus {
  id: string;
  unlocked: boolean;
  cleared: boolean;
}

export interface ChapterStatus {
  id: string;
  unlocked: boolean;
  complete: boolean;
  encounters: EncounterStatus[];
}

export interface AchievementStatus {
  id: string;
  count: number;
  done: boolean;
  completedAt: string | null;
}

/** Where the player's arcade run stands. */
export interface ArcadeStatus {
  /** The stage the run plays next (1 after a loss or a cleared ladder). */
  stage: number;
  stages: number;
  bot: 'easy' | 'normal' | 'hard';
  /** The highest stage ever cleared (0 for none). */
  best: number;
  dropsToday: number;
  dailyDropCap: number;
}

/** An arcade stage the server issued (or reissued, when it was left unfinished). */
export interface ArcadeStart {
  attemptId: string;
  stage: number;
  bot: 'easy' | 'normal' | 'hard';
  config: MatchConfig;
  resumed: boolean;
}

/** The server's verdict on a finished story attempt, practice match or arcade stage. */
export interface StoryResult {
  outcome: 'win' | 'loss' | 'draw';
  turns: number;
  reward: Reward;
  chapterComplete: string | null;
  /** Characters rolled for free by the reward (the tutorial's starter character). */
  characters: Character[];
  achievements: { id: string; reward: Reward }[];
  chapters: ChapterStatus[];
  wallet: Wallet;
  /** Arcade stages: the stage played, whether it finished the ladder, and where the run goes next. */
  arcade?: { stage: number; ladderComplete: boolean; next: ArcadeStatus };
}

export interface Preset {
  id: string;
  name: string;
  loadout: Loadout;
}

export interface MatchSummary {
  id: string;
  kind: 'casual' | 'ranked' | 'private';
  status: 'active' | 'finished' | 'aborted';
  seat: PlayerId;
  opponent: string;
  outcome: 'win' | 'loss' | 'draw' | null;
  endReason: string | null;
  turns: number;
  startedAt: string;
  endedAt: string | null;
  rating: { before: number; after: number } | null;
  reward: Reward | null;
}

/** The running ranked season and the player's standing (docs/live-ops.md §4). */
export interface Ratings {
  /** Null between seasons. */
  season: { id: string; name: string; start: string; end: string | null } | null;
  next: { id: string; name: string; start: string } | null;
  ranked: {
    rating: number;
    rd: number;
    display: number;
    games: number;
    wins: number;
    placementGames: number;
    tier: { id: string; name: string } | null;
  } | null;
  casual: { games: number; wins: number };
  /** The latest season-end reward paid. */
  lastReward: { season: string; seasonName: string; tier: string; rating: number; currency: Record<string, number>; items: string[] } | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; problems?: string[] };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.problems ?? []);
  return data as T;
}

export const api = {
  health: () => call<{ ok: boolean; engine: string; content: string }>('GET', '/health'),
  me: () => call<{ user: User }>('GET', '/me'),
  adminOverview: () => call<AdminOverview>('GET', '/admin/overview'),
  adminPlayers: (q: string, page: number) =>
    call<{ total: number; page: number; pageSize: number; players: AdminPlayerRow[] }>('GET', `/admin/players?q=${encodeURIComponent(q)}&page=${page}`),
  adminPlayer: (id: string) => call<AdminPlayer>('GET', `/admin/players/${id}`),
  register: (email: string, password: string, displayName: string) =>
    call<{ user: User }>('POST', '/auth/register', { email, password, displayName }),
  login: (email: string, password: string) => call<{ user: User }>('POST', '/auth/login', { email, password }),
  logout: () => call<void>('POST', '/auth/logout'),

  characters: () => call<{ characters: Character[]; maxRoster: number; infusedRecruits: number }>('GET', '/characters'),
  roll: () => call<{ character: Character; wallet: Wallet }>('POST', '/characters/roll'),
  /** An Infused Recruit: the chosen class and element, recruited already equipped. */
  recruitInfused: (classId: string, element: string) =>
    call<{ character: Character; infusedRecruits: number }>('POST', '/characters/recruit-infused', { classId, element }),
  reorderRoster: (ids: string[]) => call<{ ids: string[] }>('PUT', '/characters/order', { ids }),
  rename: (id: string, name: string) => call<{ character: Character }>('PATCH', `/characters/${id}`, { name }),
  retire: (id: string) => call<void>('DELETE', `/characters/${id}`),

  activeTeam: () => call<{ team: { id: string; name: string; characterIds: string[] } | null }>('GET', '/teams/active'),
  setActiveTeam: (characterIds: string[]) => call<{ team: { characterIds: string[] } }>('PUT', '/teams/active', { characterIds }),
  teamSpecs: () => call<{ specs: CharacterSpec[] }>('GET', '/teams/active/specs'),

  inventory: () => call<{ items: InventoryItem[]; wallet: Wallet }>('GET', '/inventory'),
  tradeIn: (ids: string[]) => call<{ item: InventoryItem; wallet: Wallet }>('POST', '/inventory/trade-in', { ids }),
  leaderboards: () => call<Leaderboards>('GET', '/leaderboards'),
  progress: () => call<Progress>('GET', '/progress'),
  guides: () => call<{ done: string[] }>('GET', '/guides'),
  completeGuide: (id: string) => call<{ reward: Reward | null; progress: Progress }>('POST', `/guides/${id}/complete`),
  openLootBox: (id: string) => call<{ box: string; rolls: LootRoll[]; wallet: Wallet; progress: Progress }>('POST', `/loot-boxes/${id}/open`),
  forge: (base: string, addition: string) => call<{ item: InventoryItem; wallet: Wallet }>('POST', '/forge', { base, addition }),
  split: (id: string) => call<{ items: InventoryItem[]; wallet: Wallet }>('POST', `/inventory/${id}/split`),
  salvage: (id: string) => call<{ paid: Record<string, number>; wallet: Wallet }>('POST', `/inventory/${id}/salvage`),
  /** `take`: instances worn by other characters that the player confirmed moving to this one. */
  saveLoadout: (id: string, loadout: Loadout, take: string[] = []) =>
    call<{ loadout: Loadout; resolved: ResolvedLoadout; moved: { characterId: string; name: string; loadout: Loadout }[] }>(
      'PUT',
      `/characters/${id}/loadout`,
      take.length ? { loadout, take } : { loadout },
    ),
  presets: (id: string) => call<{ presets: Preset[] }>('GET', `/characters/${id}/presets`),
  savePreset: (id: string, name: string, loadout: Loadout) =>
    call<{ preset: Preset }>('POST', `/characters/${id}/presets`, { name, loadout }),
  applyPreset: (id: string, presetId: string) =>
    call<{ loadout: Loadout }>('POST', `/characters/${id}/presets/${presetId}/apply`),
  deletePreset: (id: string, presetId: string) => call<void>('DELETE', `/characters/${id}/presets/${presetId}`),

  matches: () => call<{ matches: MatchSummary[] }>('GET', '/matches'),
  replay: (id: string) => call<{ record: MatchRecord; seat: PlayerId; playable: boolean }>('GET', `/matches/${id}/replay`),
  ratings: () => call<Ratings>('GET', '/ratings'),

  story: () => call<{ chapters: ChapterStatus[]; clears: Record<string, number> }>('GET', '/story'),
  startStory: (encounter: string) => call<{ attemptId: string; encounter: string; config: MatchConfig }>('POST', `/story/${encounter}/start`),
  finishStory: (attemptId: string, commands: MatchRecord['commands']) =>
    call<StoryResult>('POST', `/story/attempts/${attemptId}/finish`, { commands }),
  startPractice: (bot: string) => call<{ attemptId: string; config: MatchConfig }>('POST', '/practice/start', { bot }),
  finishPractice: (attemptId: string, commands: MatchRecord['commands']) =>
    call<StoryResult>('POST', `/practice/attempts/${attemptId}/finish`, { commands }),
  arcade: () => call<ArcadeStatus>('GET', '/arcade'),
  startArcade: () => call<ArcadeStart>('POST', '/arcade/start'),
  finishArcade: (attemptId: string, commands: MatchRecord['commands']) => call<StoryResult>('POST', `/arcade/attempts/${attemptId}/finish`, { commands }),
  achievements: () => call<{ achievements: AchievementStatus[] }>('GET', '/achievements'),
};
