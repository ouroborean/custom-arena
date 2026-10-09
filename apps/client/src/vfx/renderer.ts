// Draws battle animations on two fixed, full-screen canvases — one over the board, one under the
// portraits — in a requestAnimationFrame loop that runs only while something is playing. Where each
// animation sits is asked of its `place` callback every frame, so it follows the layout (scrolling,
// resizing) and can move (travel).

import { sheetCanvas, type Sheet, type Stops } from './data.js';

export interface Placed {
  x: number;
  y: number;
  /** Radians, clockwise. */
  angle: number;
  /** Pixels per art pixel; negative mirrors. */
  sx: number;
  sy: number;
  /** Which point of the art sits at (x, y): its center, or the middle of its bottom edge. */
  origin: 'center' | 'bottom';
  opacity: number;
}

export interface Spawn {
  key: string;
  stops: Stops | null;
  sheet: Sheet;
  /** Milliseconds before it appears. */
  delay: number;
  frameMs: number;
  frames: [number, number];
  /** Times through its frames (Infinity: until stopped). */
  repeat: number;
  /** Milliseconds it lasts regardless of frames (travel), looping its frames meanwhile. */
  life?: number;
  /** Where it is at progress t (0–1 over `life`, else 0). Null skips the frame (its unit is gone). */
  place: (t: number) => Placed | null;
  layer: 'over' | 'under';
  /** For stopping looping animations (auras). */
  tag?: string;
}

interface Live extends Spawn {
  start: number;
}

const live: Live[] = [];
const canvases: { over: HTMLCanvasElement | null; under: HTMLCanvasElement | null } = { over: null, under: null };
let raf = 0;

// Development: a handle for inspecting what's playing from the console.
if (import.meta.env.DEV) (globalThis as { __vfx?: unknown }).__vfx = { live, canvases };

export function attachCanvases(over: HTMLCanvasElement | null, under: HTMLCanvasElement | null): void {
  canvases.over = over;
  canvases.under = under;
  if (!over) clearAll();
}

export function spawn(s: Spawn): void {
  live.push({ ...s, start: performance.now() + s.delay });
  if (!raf) raf = requestAnimationFrame(tick);
}

/** Stops every animation whose tag starts with `prefix`. */
export function stopTag(prefix: string): void {
  for (let i = live.length - 1; i >= 0; i--) if (live[i]!.tag?.startsWith(prefix)) live.splice(i, 1);
}

export function hasTag(prefix: string): boolean {
  return live.some((l) => l.tag?.startsWith(prefix));
}

export function liveTags(): string[] {
  return live.flatMap((l) => (l.tag ? [l.tag] : []));
}

export function clearAll(): void {
  live.length = 0;
  for (const c of [canvases.over, canvases.under]) c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
}

function prepare(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(window.innerWidth * dpr);
  const h = Math.round(window.innerHeight * dpr);
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const g = c.getContext('2d');
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, window.innerWidth, window.innerHeight);
  g.imageSmoothingEnabled = false;
  return g;
}

function tick(now: number): void {
  raf = 0;
  const over = canvases.over ? prepare(canvases.over) : null;
  const under = canvases.under ? prepare(canvases.under) : null;
  for (let i = live.length - 1; i >= 0; i--) {
    const l = live[i]!;
    const elapsed = now - l.start;
    if (elapsed < 0) continue;
    const span = l.frames[1] - l.frames[0] + 1;
    const step = Math.floor(elapsed / l.frameMs);
    const done = l.life !== undefined ? elapsed >= l.life : step >= span * l.repeat;
    if (done) {
      live.splice(i, 1);
      continue;
    }
    const g = l.layer === 'under' ? under : over;
    const img = g && sheetCanvas(l.key, l.stops);
    if (!g || !img) continue;
    const at = l.place(l.life ? Math.min(1, elapsed / l.life) : 0);
    if (!at) continue;
    const f = l.frames[0] + (step % span);
    const { w, h, c } = l.sheet;
    g.save();
    g.globalAlpha = at.opacity;
    g.translate(at.x, at.y);
    g.rotate(at.angle);
    g.scale(at.sx, at.sy);
    g.drawImage(img, (f % c) * w, Math.floor(f / c) * h, w, h, -w / 2, at.origin === 'bottom' ? -h : -h / 2, w, h);
    g.restore();
  }
  if (live.length) raf = requestAnimationFrame(tick);
  else {
    over?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    under?.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}
