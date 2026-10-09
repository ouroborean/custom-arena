// Builds docs/animations/catalog.yaml: one entry per animation in skill_animations/, with what the
// files say (frames, sizes, color variants, where the frames are) merged with what we've written about
// each one by eye (docs/animations/catalog.notes.yaml: look, motion, orientation, best uses).
//
//   npx tsx scripts/animations/build-catalog.mts
//
// Ids: a generic animation is its folder name (epic_explosion_001); a Statuses entry is fanfx_<name>
// (fanfx_barrier); a class animation is <class>_<n> (frost_knight_3). Statuses entries that are
// byte-identical to another animation are listed with `duplicateOf` and nothing else.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isSeq, parse, visit } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'skill_animations');
const OUT = join(ROOT, 'docs', 'animations', 'catalog.yaml');
const NOTES = join(ROOT, 'docs', 'animations', 'catalog.notes.yaml');
const CLASS_DIR = 'Advanced Class Animations';

type Size = [number, number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
interface Entry {
  id: string;
  category: string;
  frames: number;
  sizes: Record<string, Size>;
  colors: string[];
  /** palette: a 4-color palette swap, so any tint works; colorize: multi-hue art, tinting flattens it. */
  tint: 'palette' | 'colorize';
  /** Frame path pattern, relative to skill_animations/: {size} {color} {n} (zero-padded to 4) or {i} (1-based). */
  path: string;
  duplicateOf?: string;
  [note: string]: unknown;
}

const dirs = (p: string) => readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const pngs = (p: string) => readdirSync(p).filter((f) => f.toLowerCase().endsWith('.png'));
const pngSize = (file: string): Size => {
  const h = readFileSync(file).subarray(16, 24);
  return [h.readUInt32BE(0), h.readUInt32BE(4)];
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const frameNo = (f: string) => Number(/(\d+)\.png$/i.exec(f)![1]);
const digest = (dir: string) => {
  const h = createHash('md5');
  for (const f of pngs(dir).sort((a, b) => frameNo(a) - frameNo(b))) h.update(readFileSync(join(dir, f)));
  return h.digest('hex');
};

const entries: Entry[] = [];
const seen = new Map<string, string>(); // content digest of the large red (or first) variant → id

for (const category of dirs(SRC).filter((d) => d !== CLASS_DIR).sort()) {
  for (const group of dirs(join(SRC, category)).sort()) {
    const variants = dirs(join(SRC, category, group));
    const parsed = variants.map((v) => ({ v, m: /_(large|small)_([a-z]+)$/.exec(v)! }));
    const prefix = parsed[0]!.v.slice(0, parsed[0]!.m.index);
    const id = category === 'Statuses' ? `fanfx_${slug(group)}` : group;
    const sizes: Record<string, Size> = {};
    let frames = 0;
    for (const { v, m } of parsed) {
      const files = pngs(join(SRC, category, group, v));
      frames = Math.max(frames, files.length);
      sizes[m[1]!] ??= pngSize(join(SRC, category, group, v, files[0]!));
    }
    const colors = [...new Set(parsed.map((p) => p.m[2]!))].sort();
    const probe = parsed.find((p) => p.v.endsWith('_large_red')) ?? parsed[0]!;
    const key = digest(join(SRC, category, group, probe.v));
    const entry: Entry = {
      id,
      category,
      frames,
      sizes,
      colors,
      tint: 'palette',
      path: `${category}/${group}/${prefix}_{size}_{color}/frame{n}.png`,
    };
    const dup = seen.get(key);
    if (dup) entry.duplicateOf = dup;
    else seen.set(key, id);
    entries.push(entry);
  }
}

for (const folder of dirs(join(SRC, CLASS_DIR))) {
  const [, cls, n] = /^(.*) (\d+)$/.exec(folder)!;
  const files = pngs(join(SRC, CLASS_DIR, folder)).sort((a, b) => frameNo(a) - frameNo(b));
  const stem = files[0]!.replace(/\d+\.png$/i, '');
  entries.push({
    id: `${slug(cls!)}_${n}`,
    category: `Class: ${cls}`,
    frames: files.length,
    sizes: { native: pngSize(join(SRC, CLASS_DIR, folder, files[0]!)) },
    colors: ['native'],
    tint: 'colorize',
    path: `${CLASS_DIR}/${folder}/${stem}{i}.png`,
  });
}
entries.sort((a, b) => (a.category.startsWith('Class') === b.category.startsWith('Class') ? 0 : a.category.startsWith('Class') ? 1 : -1));

const notes: Record<string, Record<string, unknown>> = existsSync(NOTES) ? (parse(readFileSync(NOTES, 'utf8')) ?? {}) : {};
const out: Record<string, Omit<Entry, 'id'>> = {};
for (const { id, ...e } of entries) {
  if (e.duplicateOf) {
    out[id] = { category: e.category, duplicateOf: e.duplicateOf } as Omit<Entry, 'id'>;
    continue;
  }
  out[id] = { ...e, ...(notes[id] ?? {}) };
}
const unknown = Object.keys(notes).filter((k) => !(k in out));
if (unknown.length) console.warn(`Notes for unknown animations: ${unknown.join(', ')}`);

const header = `# The animation library (skill_animations/), generated by scripts/animations/build-catalog.mts — don't
# edit by hand: frame facts come from the files, descriptions from catalog.notes.yaml.
# ${entries.filter((e) => !e.duplicateOf).length} animations (+ ${entries.filter((e) => e.duplicateOf).length} duplicates). See README.md for how concepts use them.\n\n`;
const doc = new Document(out);
visit(doc, { Seq: (_, node) => void (isSeq(node) && (node.flow = true)) });
writeFileSync(OUT, header + doc.toString({ lineWidth: 0 }));
console.log(`Wrote ${Object.keys(out).length} entries to ${OUT}`);

// A one-line-per-animation index for scanning; catalog.yaml has the full notes (tintNote, caveats, paths).
const rows: string[] = [
  '# Animation index',
  '',
  'One line per animation, generated with catalog.yaml (see it for motion, tintNote, caveats and frame paths).',
  'Sizes: L/S = large/small palette art (tint freely), N = native class art (pre-colored). Orient = drawn direction; Anchor = where it sits.',
];
let category = '';
for (const [id, e] of Object.entries(out) as [string, Record<string, Any>][]) {
  if (e.duplicateOf) continue;
  if (e.category !== category) {
    category = e.category;
    rows.push('', `## ${category}`, '', '| id | frames | size | orient | anchor | loop | intensity | look | best for |', '|---|---|---|---|---|---|---|---|---|');
  }
  const size = Object.entries(e.sizes as Record<string, Size>)
    .map(([k, [w, h]]) => `${k === 'large' ? 'L' : k === 'small' ? 'S' : 'N'}${w}×${h}`)
    .join(' ');
  const cell = (v: unknown) => String(v ?? '').replaceAll('|', '/');
  rows.push(`| \`${id}\` | ${e.frames} | ${size} | ${cell(e.orientation)} | ${cell(e.anchor)} | ${e.loopable ? 'yes' : ''} | ${cell(e.intensity)} | ${cell(e.look)} | ${cell(((e.bestFor as string[]) ?? []).join(', '))} |`);
}
writeFileSync(join(ROOT, 'docs', 'animations', 'catalog-index.md'), rows.join('\n') + '\n');
