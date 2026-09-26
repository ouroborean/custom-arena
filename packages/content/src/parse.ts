// Browser-safe: turns YAML file texts into RawContent. Files are grouped by name prefix
// (skills*, statuses*, minions*, classes*).

import type { ContentBundle } from '@arena/engine';
import { parse } from 'yaml';
import { buildBundle, ContentError, type RawContent } from './bundle.js';

export interface ContentFile {
  path: string;
  text: string;
}

const CATEGORIES = ['skills', 'statuses', 'minions', 'classes', 'macros', 'conditions', 'items', 'economy', 'encounters', 'story', 'achievements'] as const;

export function rawFromYamlFiles(files: readonly ContentFile[]): RawContent {
  const raw: RawContent = {
    skills: {},
    statuses: {},
    minions: {},
    classes: {},
    macros: {},
    conditions: {},
    items: {},
    economy: {},
    encounters: {},
    story: {},
    achievements: {},
  };
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const base = file.path.split(/[\\/]/).pop() ?? file.path;
    const category = CATEGORIES.find((c) => base.startsWith(c));
    if (!category) {
      throw new Error(`Can't tell what ${file.path} contains (name it skills*, statuses*, minions*, classes*, macros*, conditions*, items*, economy*, encounters*, story* or achievements*)`);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = (parse(file.text) ?? {}) as Record<string, unknown>;
    } catch (e) {
      throw new Error(`${file.path}: ${(e as Error).message}`);
    }
    for (const [id, entry] of Object.entries(parsed)) {
      if (id in raw[category]) throw new Error(`Duplicate ${category} id "${id}" in ${file.path}`);
      raw[category][id] = entry;
    }
  }
  return raw;
}

/** Builds a bundle from YAML texts and throws on any error (warnings are allowed). */
export function bundleFromYamlFiles(files: readonly ContentFile[]): ContentBundle {
  const { bundle, issues } = buildBundle(rawFromYamlFiles(files));
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) throw new ContentError(errors);
  return bundle;
}
