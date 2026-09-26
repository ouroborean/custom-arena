// Node-only: reads YAML content files from disk. Every *.yaml file under a content directory is
// merged by category (file name prefix: skills*, statuses*, minions*, classes*).

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle } from '@arena/engine';
import { parse } from 'yaml';
import { buildBundle, ContentError, type ContentIssue, type RawContent } from './bundle.js';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

const CATEGORIES = ['skills', 'statuses', 'minions', 'classes'] as const;

function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? yamlFiles(join(dir, d.name)) : d.name.endsWith('.yaml') ? [join(dir, d.name)] : []))
    .sort();
}

export function readRawContent(dir = DATA_DIR): RawContent {
  const raw: RawContent = { skills: {}, statuses: {}, minions: {}, classes: {} };
  for (const file of yamlFiles(dir)) {
    const category = CATEGORIES.find((c) => basename(file).startsWith(c));
    if (!category) throw new Error(`Can't tell what ${file} contains (name it skills*, statuses*, minions* or classes*)`);
    const parsed = (parse(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>;
    for (const [id, entry] of Object.entries(parsed)) {
      if (id in raw[category]) throw new Error(`Duplicate ${category} id "${id}" in ${file}`);
      raw[category][id] = entry;
    }
  }
  return raw;
}

export function loadContent(dir = DATA_DIR): { bundle: ContentBundle; issues: ContentIssue[] } {
  return buildBundle(readRawContent(dir));
}

/** Loads content and throws if there are any errors (warnings are allowed). */
export function loadContentOrThrow(dir = DATA_DIR): ContentBundle {
  const { bundle, issues } = loadContent(dir);
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) throw new ContentError(errors);
  return bundle;
}
