// Art, audio and icon manifests (GDD §7.4 "use a manifest rather than path conventions alone"). All
// are optional static files under /assets; until art exists the client draws its generated portraits,
// synthesized sounds and letter codes, so a missing or broken manifest is never an error.

import { create } from 'zustand';

export interface PortraitManifest {
  portraits: Record<string, string[]>;
}

export interface AudioManifest {
  cues: Record<string, string>;
}

/** Glyph files under /assets/icons: by archetype (lowercase), by skill id (minion skills), by status id. */
export interface IconManifest {
  skills: Record<string, string>;
  skillsById: Record<string, string>;
  statuses: Record<string, string>;
}

interface AssetState {
  portraits: Record<string, string[]>;
  audio: Record<string, string>;
  icons: IconManifest;
}

export const useAssets = create<AssetState>(() => ({ portraits: {}, audio: {}, icons: { skills: {}, skillsById: {}, statuses: {} } }));

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Loads the manifests once at startup. */
export async function loadAssetManifests(): Promise<void> {
  const [p, a, i] = await Promise.all([
    fetchJson<PortraitManifest>('/assets/portraits/manifest.json'),
    fetchJson<AudioManifest>('/assets/audio/manifest.json'),
    fetchJson<IconManifest>('/assets/icons/manifest.json'),
  ]);
  useAssets.setState({
    portraits: p?.portraits ?? {},
    audio: a?.cues ?? {},
    icons: { skills: i?.skills ?? {}, skillsById: i?.skillsById ?? {}, statuses: i?.statuses ?? {} },
  });
}

/** The manifest key for a character (class + element) or a minion. */
export function portraitKey(u: { kind?: 'character' | 'minion'; classId?: string; defId?: string; element?: string }): string {
  if (u.kind === 'minion') return `minion.${u.defId}`;
  return `${u.classId ?? u.defId}.${(u.element ?? 'None').toLowerCase()}`;
}

/**
 * The image for a portrait key, or null to use the generated look. A portraitId ending in ".NN"
 * picks that variant when it exists, else the first.
 */
export function portraitUrl(portraits: Record<string, string[]>, key: string, portraitId?: string): string | null {
  const files = portraits[key];
  if (!files?.length) return null;
  const n = portraitId ? Number(portraitId.split('.').pop()) : NaN;
  const file = Number.isInteger(n) && n >= 1 && n <= files.length ? files[n - 1]! : files[0]!;
  return `/assets/portraits/${file}`;
}

/**
 * A skill's glyph, or null for its letter code. Most share their archetype's (elemental versions
 * included); minion skills, all of archetype Minion, have their own by skill id.
 */
export function skillIconUrl(icons: IconManifest, skill: { id?: string; archetype?: string }): string | null {
  const file = (skill.id && icons.skillsById[skill.id]) || (skill.archetype && icons.skills[skill.archetype.toLowerCase()]);
  return file ? `/assets/icons/${file}` : null;
}

/**
 * An effect's glyph: a named status has its own; an effect defined inside a skill shows that skill's
 * glyph. Null means the letter code.
 */
export function statusIconUrl(icons: IconManifest, e: { defId: string; inline?: unknown; sourceSkill?: string; sourceArchetype?: string }): string | null {
  if (e.inline) return skillIconUrl(icons, { id: e.sourceSkill, archetype: e.sourceArchetype });
  const file = icons.statuses[e.defId];
  return file ? `/assets/icons/${file}` : null;
}
