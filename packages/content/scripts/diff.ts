// Patch notes for a balance patch (docs/live-ops.md §2): compares the content at a git revision with
// the working tree and drafts Markdown patch notes.
//
//   npm run content:diff -- <git-ref> [--out notes.md]      e.g. npm run content:diff -- master

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { buildBundle, diffBundles, loadContentOrThrow, patchNotes, rawFromYamlFiles } from '../src/index.js';
import { DATA_DIR } from '../src/load.js';

const ref = process.argv[2];
if (!ref || ref.startsWith('--')) {
  console.error('Usage: npm run content:diff -- <git-ref> [--out notes.md]');
  process.exit(1);
}
const outAt = process.argv.indexOf('--out');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').trim();
const dataPath = relative(root, DATA_DIR).split(sep).join('/');

// --full-tree: the pathspec is from the repository root (npm runs this from packages/content).
const files = git('ls-tree', '-r', '--name-only', '--full-tree', ref, '--', dataPath)
  .split('\n')
  .filter((f) => f.endsWith('.yaml'))
  .map((path) => ({ path, text: git('show', `${ref}:${path}`) }));
// Older content may not pass today's schema (a section added since, say): read it leniently.
const { bundle: before, issues } = buildBundle(rawFromYamlFiles(files));
const errors = issues.filter((i) => i.level === 'error').length;
if (errors) console.error(`(${ref}: ${errors} entries don't fit today's schema and were left out of the comparison)`);
const after = loadContentOrThrow();
const notes = patchNotes(diffBundles(before, after));
if (outAt > 0 && process.argv[outAt + 1]) {
  writeFileSync(process.argv[outAt + 1]!, notes);
  console.log(`wrote ${process.argv[outAt + 1]}`);
} else {
  console.log(notes);
}
