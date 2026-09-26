// Node-only: reads YAML content files from disk. Every *.yaml file under a content directory is
// merged by category (file name prefix: skills*, statuses*, minions*, classes*).

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle } from '@arena/engine';
import { buildBundle, ContentError, type ContentIssue } from './bundle.js';
import { rawFromYamlFiles, type ContentFile } from './parse.js';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? yamlFiles(join(dir, d.name)) : d.name.endsWith('.yaml') ? [join(dir, d.name)] : []))
    .sort();
}

export function readContentFiles(dir = DATA_DIR): ContentFile[] {
  return yamlFiles(dir).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

export function loadContent(dir = DATA_DIR): { bundle: ContentBundle; issues: ContentIssue[] } {
  return buildBundle(rawFromYamlFiles(readContentFiles(dir)));
}

/** Loads content and throws if there are any errors (warnings are allowed). */
export function loadContentOrThrow(dir = DATA_DIR): ContentBundle {
  const { bundle, issues } = loadContent(dir);
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) throw new ContentError(errors);
  return bundle;
}
