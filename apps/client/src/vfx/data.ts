// Battle animation data (docs/animations): the compiled concepts and sprite sheets built by
// scripts/animations/build-vfx.mts into /assets/vfx. Loaded on first use; sheets load lazily and are
// recolored per ramp on the fly (tintable sheets are shading maps: 0/85/170/255 = dark/mid/light/white).

export type Face = 'fromActor' | 'toActor' | 'toTarget' | 'up' | 'down' | 'left' | 'right' | number;

export interface Cue {
  on?: string;
  status?: string;
  only?: 'primary' | 'others';
  fx: string;
  /** Sheet key, added by the build. */
  k?: string;
  at?: string;
  from?: string;
  to?: string;
  path?: 'straight' | 'arc' | 'drop' | 'rise' | 'beam' | 'return';
  face?: Face;
  scale?: number;
  tint?: string;
  tone?: 'light' | 'dark';
  variant?: string;
  offset?: [number, number];
  delay?: number;
  stagger?: number;
  repeat?: number;
  speed?: number;
  layer?: 'over' | 'under';
  opacity?: number;
  flip?: 'x' | 'y';
  frames?: [number, number];
}

export interface StatusCues {
  apply?: Cue[];
  tick?: Cue[];
  trigger?: Cue[];
  remove?: Cue[];
  expire?: Cue[];
  aura?: Cue[];
}

export interface Sheet {
  w: number;
  h: number;
  /** Columns in the sheet. */
  c: number;
  /** Frames. */
  n: number;
}

export interface VfxData {
  ramps: Record<string, [string, string, string]>;
  groupElements: Record<string, [string, string]>;
  sheets: Record<string, Sheet>;
  /** Drawn orientation and anchor of each animation. */
  fx: Record<string, { o: string; a: string }>;
  skills: Record<string, Cue[]>;
  statuses: Record<string, StatusCues>;
  macros: Record<string, Cue[]>;
  defaults: Record<string, Cue[]>;
  statusGroup: Record<string, string>;
  macroGroup: Record<string, string>;
  /** Per skill: its group, the macros it calls (m), and whether its own damage reaches past its target (sp). */
  skillMeta: Record<string, { g: string; m?: string[]; sp?: 1 }>;
  statusKind: Record<string, string>;
}

const BASE = `${import.meta.env.BASE_URL}assets/vfx/`;
let data: VfxData | null = null;
let loading: Promise<VfxData | null> | null = null;

export function vfxData(): VfxData | null {
  return data;
}

export function loadVfx(): Promise<VfxData | null> {
  loading ??= fetch(`${BASE}vfx.json`)
    .then((r) => (r.ok ? (r.json() as Promise<VfxData>) : null))
    .then((d) => (data = d))
    .catch(() => null);
  return loading;
}

// ---------------------------------------------------------------- sheets

const images = new Map<string, HTMLImageElement | 'error'>();
const tinted = new Map<string, HTMLCanvasElement>();

function image(key: string): HTMLImageElement | null {
  const got = images.get(key);
  if (got === 'error') return null;
  if (got) return got.complete && got.naturalWidth ? got : null;
  const img = new Image();
  img.onerror = () => images.set(key, 'error');
  img.src = `${BASE}sheets/${encodeURIComponent(key)}.png`;
  images.set(key, img);
  return null;
}

/** Starts loading these sheets (e.g. the skills of the units in a match). */
export function preloadSheets(keys: Iterable<string>): void {
  for (const k of keys) image(k);
}

/** A 4-stop color ramp: dark, mid, light, white, as RGB triples. */
export type Stops = [number, number, number][];

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/** The 4 stops of a 3-color ramp, shifted a step by `tone`. */
export function stopsOf(ramp: [string, string, string], tone?: 'light' | 'dark'): Stops {
  const [d, m, l] = ramp.map(hex) as [[number, number, number], [number, number, number], [number, number, number]];
  if (tone === 'light') return [m, l, WHITE, WHITE];
  if (tone === 'dark') return [mix(d, BLACK, 0.45), d, m, l];
  return [d, m, l, WHITE];
}

/** A plain color as a ramp (for raw #hex tints). */
export function rampOfHex(h: string): [string, string, string] {
  const c = hex(h);
  const s = (v: [number, number, number]) => `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  return [s(mix(c, BLACK, 0.45)), h, s(mix(c, WHITE, 0.55))];
}

/**
 * The sheet to draw: tintable sheets recolored with `stops`, others as drawn. Null until it has loaded
 * (or if it failed): callers just skip that frame.
 */
export function sheetCanvas(key: string, stops: Stops | null): CanvasImageSource | null {
  const img = image(key);
  if (!img) return null;
  if (!key.endsWith('.t')) return img;
  const s = stops ?? stopsOf(['#5c6675', '#a3adbb', '#e8ecf2']);
  const cacheKey = `${key}|${s.flat().join(',')}`;
  const hit = tinted.get(cacheKey);
  if (hit) return hit;
  const lut = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    const seg = Math.min(2, Math.floor(v / 85));
    const c = mix(s[seg]!, s[seg + 1]!, (v - seg * 85) / 85);
    lut.set(c, v * 3);
  }
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return img;
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, cv.width, cv.height);
  const d = px.data;
  for (let p = 0; p < d.length; p += 4) {
    if (!d[p + 3]) continue;
    const v = d[p]!; // the shading map is grey: R = G = B
    d[p] = lut[v * 3]!;
    d[p + 1] = lut[v * 3 + 1]!;
    d[p + 2] = lut[v * 3 + 2]!;
  }
  g.putImageData(px, 0, 0);
  tinted.set(cacheKey, cv);
  return cv;
}
