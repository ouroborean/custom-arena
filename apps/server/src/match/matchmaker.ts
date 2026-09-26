// Matchmaking queues (GDD Phase 5): players are paired within a rating band that widens the longer
// they wait. In-process for now; the interface is small enough to move to Redis when the server
// scales out (GDD §10.2).

import type { CharacterSpec } from '@arena/engine';
import type { QueueMode } from '@arena/protocol';
import type { Clock, Timer } from './clock.js';

export interface QueueEntry {
  userId: string;
  displayName: string;
  mode: QueueMode;
  /** Rating used for pairing (ranked season rating, or the hidden casual rating). */
  rating: number;
  /** The player's validated team at the time they queued. */
  specs: CharacterSpec[];
  joinedAt: number;
}

/** Rating window: starts at BASE and widens by GROWTH per second waited, up to MAX. */
export const BAND = { base: 100, growthPerSecond: 10, max: 800 };
export const TICK_MS = 1000;

export function bandAfter(waitedMs: number): number {
  return Math.min(BAND.max, BAND.base + (BAND.growthPerSecond * waitedMs) / 1000);
}

export class Matchmaker {
  private readonly queue = new Map<string, QueueEntry>();
  private timer: Timer | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly onPair: (a: QueueEntry, b: QueueEntry) => void,
  ) {}

  has(userId: string): boolean {
    return this.queue.has(userId);
  }

  get size(): number {
    return this.queue.size;
  }

  join(entry: Omit<QueueEntry, 'joinedAt'>): QueueEntry {
    const e = { ...entry, joinedAt: this.clock.now() };
    this.queue.set(e.userId, e);
    this.schedule();
    return e;
  }

  leave(userId: string): boolean {
    return this.queue.delete(userId);
  }

  /** Pairs everyone it can, oldest first. */
  tick(): void {
    const now = this.clock.now();
    const waiting = [...this.queue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const taken = new Set<string>();
    for (const a of waiting) {
      if (taken.has(a.userId)) continue;
      let best: QueueEntry | null = null;
      for (const b of waiting) {
        if (b === a || taken.has(b.userId) || b.mode !== a.mode) continue;
        const band = Math.min(bandAfter(now - a.joinedAt), bandAfter(now - b.joinedAt));
        const gap = Math.abs(a.rating - b.rating);
        if (gap > band) continue;
        if (!best || gap < Math.abs(a.rating - best.rating)) best = b;
      }
      if (best) {
        taken.add(a.userId).add(best.userId);
        this.queue.delete(a.userId);
        this.queue.delete(best.userId);
        this.onPair(a, best);
      }
    }
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = this.clock.after(TICK_MS, () => {
      this.timer = null;
      this.tick();
      if (this.queue.size > 0) this.schedule();
    });
  }

  stop(): void {
    this.timer?.cancel();
    this.timer = null;
  }
}
