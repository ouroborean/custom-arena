// Typed client for the API server (apps/server). Requests are same-origin (/api, proxied by Vite in
// development) so the httpOnly session cookie rides along automatically.

import type { CharacterSpec, MatchConfig, MatchRecord, PlayerId } from '@arena/engine';
import type { CharacterSkill, Loadout, ResolvedLoadout } from '@arena/meta';

export interface User {
  id: string;
  email: string;
  displayName: string;
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

/** What a match paid (docs/equipment.md §3). */
export interface Reward {
  currency: Record<string, number>;
  items: string[];
}

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

/** The server's verdict on a finished story attempt or practice match. */
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
  register: (email: string, password: string, displayName: string) =>
    call<{ user: User }>('POST', '/auth/register', { email, password, displayName }),
  login: (email: string, password: string) => call<{ user: User }>('POST', '/auth/login', { email, password }),
  logout: () => call<void>('POST', '/auth/logout'),

  characters: () => call<{ characters: Character[]; maxRoster: number }>('GET', '/characters'),
  roll: () => call<{ character: Character; wallet: Wallet }>('POST', '/characters/roll'),
  rename: (id: string, name: string) => call<{ character: Character }>('PATCH', `/characters/${id}`, { name }),
  retire: (id: string) => call<void>('DELETE', `/characters/${id}`),

  activeTeam: () => call<{ team: { id: string; name: string; characterIds: string[] } | null }>('GET', '/teams/active'),
  setActiveTeam: (characterIds: string[]) => call<{ team: { characterIds: string[] } }>('PUT', '/teams/active', { characterIds }),
  teamSpecs: () => call<{ specs: CharacterSpec[] }>('GET', '/teams/active/specs'),

  inventory: () => call<{ items: InventoryItem[]; wallet: Wallet }>('GET', '/inventory'),
  forge: (base: string, addition: string) => call<{ item: InventoryItem; wallet: Wallet }>('POST', '/forge', { base, addition }),
  split: (id: string) => call<{ items: InventoryItem[]; wallet: Wallet }>('POST', `/inventory/${id}/split`),
  salvage: (id: string) => call<{ paid: Record<string, number>; wallet: Wallet }>('POST', `/inventory/${id}/salvage`),
  saveLoadout: (id: string, loadout: Loadout) =>
    call<{ loadout: Loadout; resolved: ResolvedLoadout }>('PUT', `/characters/${id}/loadout`, { loadout }),
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
  startPractice: (bot: string, seat: PlayerId) => call<{ attemptId: string; config: MatchConfig }>('POST', '/practice/start', { bot, seat }),
  finishPractice: (attemptId: string, commands: MatchRecord['commands']) =>
    call<StoryResult>('POST', `/practice/attempts/${attemptId}/finish`, { commands }),
  achievements: () => call<{ achievements: AchievementStatus[] }>('GET', '/achievements'),
};
