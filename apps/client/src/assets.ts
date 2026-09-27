// Art and audio manifests (GDD §7.4 "use a manifest rather than path conventions alone"). Both are
// optional static files under /assets; until art exists the client draws its generated portraits and
// synthesized sounds, so a missing or broken manifest is never an error.

import { create } from 'zustand';

export interface PortraitManifest {
  portraits: Record<string, string[]>;
}

export interface AudioManifest {
  cues: Record<string, string>;
}

interface AssetState {
  portraits: Record<string, string[]>;
  audio: Record<string, string>;
}

export const useAssets = create<AssetState>(() => ({ portraits: {}, audio: {} }));

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Loads both manifests once at startup. */
export async function loadAssetManifests(): Promise<void> {
  const [p, a] = await Promise.all([
    fetchJson<PortraitManifest>('/assets/portraits/manifest.json'),
    fetchJson<AudioManifest>('/assets/audio/manifest.json'),
  ]);
  useAssets.setState({ portraits: p?.portraits ?? {}, audio: a?.cues ?? {} });
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
