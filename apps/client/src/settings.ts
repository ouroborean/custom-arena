// Per-device preferences (GDD §9.1 Settings): motion, default battle speed, sound, language and
// keyword explanations.
// They live in localStorage, which can be unavailable (private windows, blocked storage), so every
// read and write is guarded and the defaults always work.

import { create } from 'zustand';

export type MotionPref = 'system' | 'reduce' | 'full';

/** When tooltips explain their keywords: 'auto' is Alt with a mouse, always on touch screens. */
export type KeywordHelpPref = 'auto' | 'alt' | 'always' | 'off';

export interface Settings {
  motion: MotionPref;
  /** Battle playback speed a new match starts at (0 = instant). */
  speed: 0 | 1 | 2;
  /** Sound effects volume, 0–1; `muted` silences them without losing the level. */
  volume: number;
  muted: boolean;
  /** UI language (BCP 47); 'auto' follows the browser. */
  locale: string;
  keywordHelp: KeywordHelpPref;
}

export const DEFAULT_SETTINGS: Settings = { motion: 'system', speed: 1, volume: 0.6, muted: false, locale: 'auto', keywordHelp: 'auto' };

const KEY = 'arena.settings.v1';

function load(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: Settings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: settings last for this visit only.
  }
}

/** Whether animations should be cut down: the explicit setting, or the OS preference. */
export function reducedMotion(s: Settings): boolean {
  if (s.motion !== 'system') return s.motion === 'reduce';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How keyword explanations show: holding Alt, always, or never ('auto' decides by the device). */
export function keywordHelpMode(s: Settings): 'alt' | 'always' | 'off' {
  if (s.keywordHelp !== 'auto') return s.keywordHelp;
  // No hover and usually no keyboard: there's no Alt to hold.
  return typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches ? 'always' : 'alt';
}

/** Mirrors the motion preference onto <html data-motion>, which the stylesheet honors. */
function applyToDocument(s: Settings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.motion = reducedMotion(s) ? 'reduce' : 'full';
}

interface SettingsState extends Settings {
  update(patch: Partial<Settings>): void;
  reset(): void;
}

export const useSettings = create<SettingsState>((set, get) => {
  const initial = load();
  applyToDocument(initial);
  const commit = (next: Settings) => {
    save(next);
    applyToDocument(next);
    set(next);
  };
  return {
    ...initial,
    update(patch) {
      const { update: _u, reset: _r, ...current } = get();
      commit({ ...current, ...patch });
    },
    reset() {
      commit(DEFAULT_SETTINGS);
    },
  };
});

// Follow OS changes while the setting says "system".
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => applyToDocument(useSettings.getState()));
}
