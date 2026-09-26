// Typed client for the API server (apps/server). Requests are same-origin (/api, proxied by Vite in
// development) so the httpOnly session cookie rides along automatically.

import type { CharacterSpec, MatchRecord, PlayerId } from '@arena/engine';
import type { CharacterSkill, Loadout, RarityId, ResolvedLoadout } from '@arena/meta';

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
  rarity: RarityId;
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

export interface Ratings {
  season: string;
  ranked: { rating: number; rd: number; display: number; games: number; wins: number };
  casual: { games: number; wins: number };
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
  me: () => call<{ user: User; rollsSincePity: number }>('GET', '/me'),
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
  craft: (recipe: string, instanceIds: string[]) => call<{ item: InventoryItem; wallet: Wallet }>('POST', '/craft', { recipe, instanceIds }),
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
};
