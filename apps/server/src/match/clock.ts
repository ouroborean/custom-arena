// Time source for match rooms, injectable so timer behavior is testable without waiting.

export interface Timer {
  cancel(): void;
}

export interface Clock {
  now(): number;
  after(ms: number, fn: () => void): Timer;
}

export const realClock: Clock = {
  now: () => Date.now(),
  after(ms, fn) {
    const h = setTimeout(fn, ms);
    h.unref?.();
    return { cancel: () => clearTimeout(h) };
  },
};

/** Manually advanced clock for tests. */
export class FakeClock implements Clock {
  private t = 1_000_000;
  private timers: { at: number; fn: () => void; live: boolean }[] = [];

  now(): number {
    return this.t;
  }

  after(ms: number, fn: () => void): Timer {
    const timer = { at: this.t + ms, fn, live: true };
    this.timers.push(timer);
    return { cancel: () => void (timer.live = false) };
  }

  /** Moves time forward, firing due timers in order. */
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      const due = this.timers.filter((x) => x.live && x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.t = due.at;
      due.live = false;
      due.fn();
    }
    this.t = end;
    this.timers = this.timers.filter((x) => x.live);
  }
}
