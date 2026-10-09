// Character portraits from the repo's character_images/ folder (GDD §7.4). Files are named
// "<element><class>prof.png", all lowercase, no spaces: firewarriorprof.png, shadowpaladinprof.png.
// The Vite plugin (vite.config.ts) serves them at /assets/portraits/ and builds the portrait
// manifest from whatever is there, so adding a file is all it takes; characters without one keep
// the generated monogram portrait. `npm run assets:check` reports files it can't place.

import { existsSync, readdirSync } from 'node:fs';

export const PORTRAIT_DIR = new URL('../../character_images/', import.meta.url);

export const PORTRAIT_ELEMENTS = ['fire', 'ice', 'wind', 'lightning', 'water', 'earth', 'poison', 'shadow', 'holy', 'unholy'] as const;
export const PORTRAIT_CLASSES = ['warrior', 'knight', 'druid', 'ranger', 'monk', 'mage', 'warlock', 'rogue', 'priest', 'paladin'] as const;

const FILE = /^([a-z]+)prof\.(png|webp|jpe?g)$/;

/** The manifest key ('<class>.<element>') a file name stands for, or null if it doesn't follow the format. */
export function portraitKeyOfFile(file: string): string | null {
  const m = FILE.exec(file);
  if (!m) return null;
  const name = m[1]!;
  // Longest element first, so a longer name never loses to a shorter one it starts with.
  for (const el of [...PORTRAIT_ELEMENTS].sort((a, b) => b.length - a.length)) {
    if (!name.startsWith(el)) continue;
    const cls = name.slice(el.length);
    if ((PORTRAIT_CLASSES as readonly string[]).includes(cls)) return `${cls}.${el}`;
  }
  return null;
}

export interface PortraitScan {
  /** Manifest entries: key → [file]. */
  portraits: Record<string, string[]>;
  /** Image files whose names don't follow the format. */
  unrecognized: string[];
}

export function scanPortraits(dir: URL = PORTRAIT_DIR): PortraitScan {
  const portraits: Record<string, string[]> = {};
  const unrecognized: string[] = [];
  if (!existsSync(dir)) return { portraits, unrecognized };
  for (const file of readdirSync(dir).sort()) {
    if (!/\.(png|webp|jpe?g)$/i.test(file)) continue;
    const key = portraitKeyOfFile(file);
    if (key) (portraits[key] ??= []).push(file);
    else unrecognized.push(file);
  }
  return { portraits, unrecognized };
}

/** The size of the web copies the build makes (the largest portrait on screen is ~160 CSS px). */
export const PORTRAIT_WEB_SIZE = 320;

/** The web copy's file name: the original's, as WebP. */
export const webFileName = (file: string) => file.replace(/\.(png|webp|jpe?g)$/i, '.webp');

/**
 * The manifest the client loads from /assets/portraits/manifest.json. `rename` maps each source file
 * to the file served (the build serves WebP copies; development serves the originals).
 */
export function portraitManifest(scan: PortraitScan = scanPortraits(), rename: (file: string) => string = (f) => f): string {
  return JSON.stringify({
    _comment:
      "Generated from character_images/ (apps/client/portraits.ts). Keys: '<class>.<element>'; source files are '<element><class>prof.png'. Characters without a file keep the generated monogram portrait.",
    portraits: Object.fromEntries(Object.entries(scan.portraits).map(([k, files]) => [k, files.map(rename)])),
  });
}
