// Builds the battle animations the client plays (apps/client/public/assets/vfx/): sprite sheets of only
// the animations the concepts use, and vfx.json — the compiled concepts plus what the player needs to
// resolve them (sheet layout, art orientation, element ramps, which group owns each status and macro).
//
//   npx tsx scripts/animations/build-vfx.mts
//
// Tintable art is stored as a shading map (grey + alpha): 0 / 85 / 170 / 255 for the dark, mid and light
// stops and white, so the client can recolor it with any ramp. Palette art maps its handful of colors onto
// those levels by brightness; class art keeps its brightness as a smooth gradient. Art played in a drawn
// color (`variant`) or untinted class art (`native`) is stored as plain RGBA.

import { loadContentOrThrow } from '@arena/content';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'skill_animations');
const DOCS = join(ROOT, 'docs', 'animations');
const OUT = join(ROOT, 'apps', 'client', 'public', 'assets', 'vfx');
const SHEET_MAX_W = 2048;

const content = loadContentOrThrow();
const catalog: Record<string, Any> = parse(readFileSync(join(DOCS, 'catalog.yaml'), 'utf8'));
const concepts: Record<string, Any> = Object.fromEntries(
  readdirSync(join(DOCS, 'concepts'))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => [f.slice(0, -5), parse(readFileSync(join(DOCS, 'concepts', f), 'utf8'))]),
);

// ---------------------------------------------------------------- ramps and groups (README "Tinting")

const RAMPS: Record<string, [string, string, string]> = {
  Fire: ['#a82a00', '#ff6a00', '#ffc266'],
  Ice: ['#3a8ab8', '#8fd8ff', '#e6f7ff'],
  Water: ['#12308f', '#2f6bff', '#9ec0ff'],
  Lightning: ['#5a1aa8', '#a24dff', '#d9b8ff'],
  Wind: ['#8fa0b4', '#dfe8ef', '#ffffff'],
  Poison: ['#3f7a12', '#8be03c', '#d4ff9a'],
  Earth: ['#6b4420', '#b5793a', '#e8c48c'],
  Holy: ['#b38600', '#ffcc00', '#ffe98a'],
  Unholy: ['#6e0f22', '#b3203a', '#ff6680'],
  Shadow: ['#1f1f26', '#4d4d57', '#a8a8bc'],
  Neutral: ['#5c6675', '#a3adbb', '#e8ecf2'],
};
const fusions = content.fusions as Record<string, { name: string; elements: string[] }>;
const groupElements: Record<string, [string, string]> = { base: ['Neutral', 'Neutral'] };
for (const el of Object.keys(RAMPS)) if (el !== 'Neutral') groupElements[el.toLowerCase()] = [el, el];
for (const [id, f] of Object.entries(fusions)) groupElements[id] = [f.elements[0]!, f.elements[1]!];

// ---------------------------------------------------------------- compile concepts

/** Strips designer-only fields (beat, note) and lists all cues so sheets can be collected. */
const allCues: Any[] = [];
const clean = (c: Any) => {
  if (!c || typeof c !== 'object') return c;
  const { note: _n, ...rest } = c;
  if (rest.fx && rest.fx !== 'none') allCues.push(rest);
  return rest;
};
const cueList = (v: Any) => ([] as Any[]).concat(v ?? []).map(clean).filter(Boolean);

const skills: Record<string, Any[]> = {};
const statuses: Record<string, Any> = {};
const macros: Record<string, Any[]> = {};
const statusGroup: Record<string, string> = {};
const macroGroup: Record<string, string> = {};
let defaults: Record<string, Any[]> = {};
for (const [g, d] of Object.entries(concepts)) {
  for (const [id, s] of Object.entries<Any>(d.skills ?? {})) skills[id] = cueList(s.cues);
  for (const [id, s] of Object.entries<Any>(d.statuses ?? {})) {
    const out: Any = {};
    for (const k of ['apply', 'tick', 'trigger', 'remove', 'expire', 'aura']) if (s?.[k]) out[k] = cueList(s[k]);
    statuses[id] = out;
    statusGroup[id] = g;
  }
  for (const [id, list] of Object.entries<Any>(d.macros ?? {})) {
    macros[id] = cueList(list);
    macroGroup[id] = g;
  }
  if (d.defaults) defaults = Object.fromEntries(Object.entries<Any>(d.defaults).filter(([k]) => k !== 'note').map(([k, v]) => [k, cueList(v)]));
}

// What the player can't read from events: each skill's group, status kinds (incl. inline ones), which
// skill owns an inline status, the macros a skill calls and whether its own damage reaches past its target.
const groupOf = (el: string | undefined) => (!el || el === 'None' ? 'base' : el.toLowerCase());
const skillMeta: Record<string, Any> = {};
const statusKind: Record<string, string> = {};
const inlineOwner: Record<string, string> = {};
for (const s of Object.values<Any>(content.statuses)) statusKind[s.id] = s.kind;
const walk = (x: Any, f: (op: Any) => void) => {
  if (Array.isArray(x)) return x.forEach((y) => walk(y, f));
  if (!x || typeof x !== 'object') return;
  if (typeof x.op === 'string') f(x);
  for (const v of Object.values(x)) walk(v, f);
};
for (const s of Object.values<Any>(content.skills)) {
  const ms = new Set<string>();
  let splash = false;
  walk(s.ops, (op) => {
    if (op.op === 'macro') ms.add(op.id);
    if (op.op === 'damage' && op.to !== 'primary') splash = true;
    if (op.op === 'apply' && op.effect && typeof op.effect === 'object') {
      statusKind[op.effect.id] = op.effect.kind ?? 'Neutral';
      inlineOwner[op.effect.id] ??= s.id;
    }
  });
  skillMeta[s.id] = { g: groupOf(s.element), ...(ms.size ? { m: [...ms] } : {}), ...(splash ? { sp: 1 } : {}) };
}

// ---------------------------------------------------------------- sheets

/** A sheet key per (fx, size, mode): mode `t` = shading map to tint, else a drawn color / native. */
const need = new Map<string, { fx: string; size: string; mode: string }>();
const keyOf = (c: Any) => {
  const e = catalog[c.fx];
  if (!e || e.duplicateOf) throw new Error(`Unknown animation ${c.fx}`);
  const cls = e.tint === 'colorize';
  const size = cls ? 'native' : (c.size ?? 'large');
  let mode: string;
  if (c.variant) mode = c.variant;
  else if (cls) mode = !c.tint || c.tint === 'native' ? 'native' : 't';
  else mode = c.tint === 'native' ? (e.colors.includes('white') ? 'white' : 'red') : 't';
  const key = `${c.fx}.${size}.${mode}`;
  need.set(key, { fx: c.fx, size, mode });
  return key;
};
for (const c of allCues) c.k = keyOf(c);

const framePath = (e: Any, size: string, color: string, i: number) =>
  join(SRC, e.path.includes('{i}') ? e.path.replace('{i}', String(i + 1)) : e.path.replace('{size}', size).replace('{color}', color).replace('{n}', String(i).padStart(4, '0')));

const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

rmSync(join(OUT, 'sheets'), { recursive: true, force: true });
mkdirSync(join(OUT, 'sheets'), { recursive: true });
const sheets: Record<string, { w: number; h: number; c: number; n: number }> = {};
let bytes = 0;
for (const [key, { fx, size, mode }] of need) {
  const e = catalog[fx];
  const [w, h] = e.sizes[size] as [number, number];
  const color = mode === 't' ? (e.colors.includes('red') ? 'red' : e.colors[0]) : mode === 'native' ? 'native' : mode;
  // Variants can differ by a frame or two from the catalog's count: use what this one has.
  const n = readdirSync(dirname(framePath(e, size, color, 0))).filter((f) => f.toLowerCase().endsWith('.png')).length;
  const frames = await Promise.all(Array.from({ length: n }, (_, i) => sharp(framePath(e, size, color, i)).ensureAlpha().raw().toBuffer()));
  const cols = Math.max(1, Math.min(n, Math.floor(SHEET_MAX_W / w)));
  const rows = Math.ceil(n / cols);
  const W = cols * w;
  const H = rows * h;
  let out: Buffer;
  let channels: 2 | 4;
  if (mode === 't') {
    // Shading levels: palette art's few colors ranked by brightness onto 0/85/170 (+255 for near-white);
    // anything with many colors (class art) as a smooth brightness gradient.
    const colors = new Map<number, number>();
    for (const f of frames) for (let p = 0; p < f.length; p += 4) if (f[p + 3]! > 0) colors.set((f[p]! << 16) | (f[p + 1]! << 8) | f[p + 2]!, lum(f[p]!, f[p + 1]!, f[p + 2]!));
    const level = new Map<number, number>();
    if (colors.size <= 8 && e.tint === 'palette') {
      const ranked = [...colors.entries()].sort((a, b) => a[1] - b[1]);
      const white = ranked.length > 1 && ranked[ranked.length - 1]![1] > 0.9 ? ranked.pop() : undefined;
      if (white) level.set(white[0], 255);
      ranked.forEach(([rgb], i) => level.set(rgb, ranked.length === 1 ? 85 : Math.round((i * 170) / (ranked.length - 1))));
    } else {
      const ls = [...colors.values()];
      const lo = Math.min(...ls);
      const hi = Math.max(...ls);
      for (const [rgb, l] of colors) level.set(rgb, Math.round(((l - lo) / Math.max(1e-6, hi - lo)) * 255));
    }
    channels = 2;
    out = Buffer.alloc(W * H * 2);
    frames.forEach((f, i) => {
      const ox = (i % cols) * w;
      const oy = Math.floor(i / cols) * h;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = (y * w + x) * 4;
          const q = ((oy + y) * W + ox + x) * 2;
          const a = f[p + 3]!;
          if (!a) continue;
          out[q] = level.get((f[p]! << 16) | (f[p + 1]! << 8) | f[p + 2]!) ?? 0;
          out[q + 1] = a;
        }
      }
    });
  } else {
    channels = 4;
    out = Buffer.alloc(W * H * 4);
    frames.forEach((f, i) => {
      const ox = (i % cols) * w;
      const oy = Math.floor(i / cols) * h;
      for (let y = 0; y < h; y++) f.copy(out, ((oy + y) * W + ox) * 4, y * w * 4, (y + 1) * w * 4);
    });
  }
  const png = await sharp(out, { raw: { width: W, height: H, channels } }).png({ compressionLevel: 9, palette: channels === 4 }).toBuffer();
  writeFileSync(join(OUT, 'sheets', `${key}.png`), png);
  bytes += png.length;
  sheets[key] = { w, h, c: cols, n };
}

// Art facts the player needs: drawn orientation and anchor.
const fx: Record<string, { o: string; a: string }> = {};
for (const { fx: id } of need.values()) fx[id] = { o: catalog[id].orientation ?? 'none', a: catalog[id].anchor ?? 'center' };

const vfx = { ramps: RAMPS, groupElements, sheets, fx, skills, statuses, macros, defaults, statusGroup, macroGroup, skillMeta, statusKind, inlineOwner };
const json = JSON.stringify(vfx);
writeFileSync(join(OUT, 'vfx.json'), json);
console.log(`${need.size} sheets (${(bytes / 1e6).toFixed(1)} MB), vfx.json ${(json.length / 1e6).toFixed(2)} MB, ${allCues.length} cues`);
