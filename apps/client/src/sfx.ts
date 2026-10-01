// Sound effects (GDD Phase 8 SFX): a small cue set synthesized with the Web Audio API, so the game
// has sound with no audio files. A recording listed in /assets/audio/manifest.json replaces a cue's
// synth. Volume and mute come from Settings; nothing plays until the first user gesture unlocks audio.

import { useAssets } from './assets.js';
import type { Cue } from './match/cues.js';
import { useSettings } from './settings.js';

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<Cue, number>();

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  return ctx;
}

// Browsers only allow audio after a gesture: resume on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => void audio()?.resume();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function tone(a: AudioContext, out: AudioNode, type: OscillatorType, from: number, to: number, start: number, dur: number, peak: number): void {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, start);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(a: AudioContext, out: AudioNode, start: number, dur: number, peak: number, filterFrom: number, filterTo: number): void {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  // A fixed pattern rather than Math.random: the same hit sounds the same.
  let x = 12345;
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (x / 0x3fffffff - 1) * (1 - i / len);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(filterFrom, start);
  f.frequency.exponentialRampToValueAtTime(filterTo, start + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(out);
  src.start(start);
}

/** The synthesized version of each cue. */
const SYNTH: Record<Cue, (a: AudioContext, out: AudioNode, t: number) => void> = {
  hit: (a, o, t) => noise(a, o, t, 0.12, 0.5, 3000, 300),
  bigHit: (a, o, t) => {
    noise(a, o, t, 0.25, 0.8, 2500, 150);
    tone(a, o, 'sine', 140, 50, t, 0.25, 0.5);
  },
  shieldHit: (a, o, t) => {
    tone(a, o, 'triangle', 1400, 900, t, 0.18, 0.25);
    tone(a, o, 'sine', 2100, 1800, t, 0.12, 0.12);
  },
  heal: (a, o, t) => [523, 659, 784].forEach((f, i) => tone(a, o, 'sine', f, f, t + i * 0.06, 0.18, 0.18)),
  buff: (a, o, t) => tone(a, o, 'triangle', 440, 880, t, 0.16, 0.18),
  debuff: (a, o, t) => tone(a, o, 'triangle', 520, 220, t, 0.2, 0.18),
  stun: (a, o, t) => {
    tone(a, o, 'square', 300, 200, t, 0.3, 0.08);
    tone(a, o, 'square', 305, 195, t + 0.05, 0.3, 0.06);
  },
  counter: (a, o, t) => {
    tone(a, o, 'square', 900, 600, t, 0.08, 0.12);
    noise(a, o, t, 0.1, 0.4, 6000, 2000);
  },
  death: (a, o, t) => tone(a, o, 'sawtooth', 330, 55, t, 0.6, 0.18),
  skill: (a, o, t) => noise(a, o, t, 0.15, 0.18, 1200, 5000),
  turn: (a, o, t) => {
    tone(a, o, 'sine', 660, 660, t, 0.12, 0.15);
    tone(a, o, 'sine', 990, 990, t + 0.1, 0.16, 0.15);
  },
  victory: (a, o, t) => [523, 659, 784, 1047].forEach((f, i) => tone(a, o, 'triangle', f, f, t + i * 0.12, 0.35, 0.22)),
  defeat: (a, o, t) => [392, 311, 262].forEach((f, i) => tone(a, o, 'triangle', f, f * 0.98, t + i * 0.18, 0.4, 0.2)),
};

function recording(a: AudioContext, file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(`/assets/audio/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((b) => a.decodeAudioData(b))
      .catch(() => null);
    buffers.set(file, p);
  }
  return p;
}

/** Plays a cue at the Settings volume (a recording if the manifest has one). Repeats within 60 ms are dropped. */
export function playCue(cue: Cue): void {
  const { volume, muted } = useSettings.getState();
  if (muted || volume <= 0) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? -Infinity) < 60) return;
  lastPlayed.set(cue, now);
  const out = a.createGain();
  out.gain.value = volume;
  out.connect(a.destination);
  const file = useAssets.getState().audio[cue];
  if (!file) return SYNTH[cue](a, out, a.currentTime);
  void recording(a, file).then((buf) => {
    if (!buf) return SYNTH[cue](a, out, a.currentTime);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.start();
  });
}
