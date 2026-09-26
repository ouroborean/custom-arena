// Client state. The LocalMatch is the source of truth for the game; this store holds UI state
// (targeting, playback, logs, dialogs) and bumps `version` whenever the match changes.

import { CommandError, redactEvents, type Energy, type GameEvent, type MatchConfig, type PlayerId, type PlayerView } from '@arena/engine';
import { create } from 'zustand';
import { LocalMatch, type MatchMode } from './match/LocalMatch.js';
import { isLogged, toFloat, toLogLine, type FloatText, type LogLine } from './match/playback.js';
import type { ContentBundle } from '@arena/engine';

export type Speed = 0 | 1 | 2;

export interface Targeting {
  actor: string;
  slot: number;
  options: string[][];
}

/** What the inspector panel is describing (last hovered / focused thing). */
export type InspectTarget =
  | { kind: 'skill'; unit: string; slot: number }
  | { kind: 'effect'; effect: string }
  | { kind: 'unit'; unit: string };

/** Screen rectangle of the hovered element, for positioning the hover card. */
export interface Anchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CommitPlan {
  queueOrder?: number[];
  tickOrder?: string[];
  allocation?: Energy;
}

interface StoreState {
  screen: 'setup' | 'battle';
  match: LocalMatch | null;
  /** Bumped on every match change so components re-read views. */
  version: number;
  viewer: PlayerId;
  targeting: Targeting | null;
  /** Events waiting to be played back for the current viewer. */
  pending: GameEvent[];
  /** Snapshot shown while playback runs (statuses update when it finishes). */
  displayView: PlayerView | null;
  displayHp: Record<string, number>;
  floats: FloatText[];
  logs: [LogLine[], LogLine[]];
  speed: Speed;
  commitOpen: boolean;
  /** Hotseat: the device must be handed to this player before their turn is shown. */
  handoff: PlayerId | null;
  toast: string | null;
  nextId: number;
  inspect: InspectTarget | null;
  anchor: Anchor | null;
  logOpen: boolean;

  newMatch(content: ContentBundle, config: MatchConfig, mode: MatchMode): void;
  rematch(): void;
  toSetup(): void;
  selectSkill(actor: string, slot: number): void;
  chooseTarget(unitId: string): void;
  cancelTargeting(): void;
  unqueue(index: number): void;
  reorderQueue(order: number[]): void;
  openCommit(): void;
  closeCommit(): void;
  commit(plan: CommitPlan): void;
  surrender(): void;
  step(): void;
  flush(): void;
  afterPlayback(): void;
  removeFloat(id: number): void;
  setSpeed(s: Speed): void;
  acceptHandoff(): void;
  dismissToast(): void;
  setInspect(t: InspectTarget | null, anchor?: Anchor | null): void;
  toggleLog(open?: boolean): void;
}

function initialViewer(mode: MatchMode): PlayerId {
  return mode.kind === 'vsBot' ? mode.human : 0;
}

export const useStore = create<StoreState>((set, get) => {
  /** Adds events to both players' logs (redacted per player) and queues playback for the viewer. */
  function publish(events: GameEvent[], before: PlayerView | null): void {
    const { match, viewer, logs, pending } = get();
    if (!match || events.length === 0) return;
    let id = get().nextId;
    const other: PlayerId = viewer === 0 ? 1 : 0;
    const units = match.view(viewer).units;
    // The non-viewing side's log is filled immediately; the viewer's fills during playback.
    const otherLines = redactEvents(events, other)
      .filter(isLogged)
      .map((e) => toLogLine(match.content, units, e, id++));
    const nextLogs: [LogLine[], LogLine[]] = [...logs];
    nextLogs[other] = [...logs[other], ...otherLines];
    const mine = redactEvents(events, viewer);
    const startPlayback = pending.length === 0;
    set({
      logs: nextLogs,
      nextId: id,
      pending: [...pending, ...mine],
      displayView: startPlayback ? before : get().displayView,
      displayHp: startPlayback && before ? Object.fromEntries(before.units.map((u) => [u.id, u.hp])) : get().displayHp,
      version: get().version + 1,
    });
    if (get().speed === 0) get().flush();
  }

  function run(fn: (m: LocalMatch) => GameEvent[]): void {
    const { match, viewer } = get();
    if (!match) return;
    const before = match.view(viewer);
    try {
      const events = fn(match);
      // Planning commands (queue, reorder…) change state without emitting events.
      if (events.length === 0) set({ version: get().version + 1 });
      else publish(events, before);
    } catch (e) {
      if (e instanceof CommandError) set({ toast: e.message, version: get().version + 1 });
      else throw e;
    }
  }

  return {
    screen: 'setup',
    match: null,
    version: 0,
    viewer: 0,
    targeting: null,
    pending: [],
    displayView: null,
    displayHp: {},
    floats: [],
    logs: [[], []],
    speed: 1,
    commitOpen: false,
    handoff: null,
    toast: null,
    nextId: 1,
    inspect: null,
    anchor: null,
    logOpen: false,

    newMatch(content, config, mode) {
      const match = new LocalMatch(content, config, mode);
      const viewer = initialViewer(mode);
      set({
        screen: 'battle',
        match,
        viewer,
        targeting: null,
        pending: [],
        displayView: null,
        displayHp: {},
        floats: [],
        logs: [[], []],
        commitOpen: false,
        handoff: null,
        toast: null,
        inspect: null,
        anchor: null,
        version: get().version + 1,
      });
      publish(match.initialEvents, null);
      if (mode.kind === 'vsBot' && !match.isHuman(match.active)) run((m) => m.runBots());
    },

    rematch() {
      const m = get().match;
      if (m) get().newMatch(m.content, m.config, m.mode);
    },

    toSetup() {
      set({ screen: 'setup', match: null, pending: [], displayView: null, commitOpen: false, handoff: null });
    },

    selectSkill(actor, slot) {
      const { match, viewer, targeting } = get();
      if (!match || get().pending.length > 0) return;
      if (targeting && targeting.actor === actor && targeting.slot === slot) return set({ targeting: null });
      const a = match.availability(viewer).find((x) => x.actor === actor && x.slot === slot);
      if (!a || a.targets.length === 0) {
        if (a?.reason) set({ toast: a.reason });
        return;
      }
      const def = match.content.skills[a.skill];
      const single = def && (def.target === 'enemy' || def.target === 'ally');
      if (!single) {
        set({ targeting: null });
        return run((m) => m.command(viewer, { t: 'queue', actor, slot, targets: [] }));
      }
      set({ targeting: { actor, slot, options: a.targets } });
    },

    chooseTarget(unitId) {
      const { targeting, viewer } = get();
      if (!targeting || !targeting.options.some((o) => o[0] === unitId)) return;
      set({ targeting: null });
      run((m) => m.command(viewer, { t: 'queue', actor: targeting.actor, slot: targeting.slot, targets: [unitId] }));
    },

    cancelTargeting() {
      set({ targeting: null });
    },

    unqueue(index) {
      run((m) => m.command(get().viewer, { t: 'unqueue', index }));
    },

    reorderQueue(order) {
      run((m) => m.command(get().viewer, { t: 'reorder', order }));
    },

    openCommit() {
      set({ commitOpen: true, targeting: null });
    },

    closeCommit() {
      set({ commitOpen: false });
    },

    commit(plan) {
      const viewer = get().viewer;
      set({ commitOpen: false, targeting: null });
      run((m) => {
        const events: GameEvent[] = [];
        if (plan.queueOrder && plan.queueOrder.some((v, i) => v !== i)) {
          events.push(...m.command(viewer, { t: 'reorder', order: plan.queueOrder }));
        }
        if (plan.tickOrder && plan.tickOrder.length > 1) {
          events.push(...m.command(viewer, { t: 'setTickOrder', order: plan.tickOrder }));
        }
        events.push(...m.command(viewer, plan.allocation ? { t: 'endTurn', allocation: plan.allocation } : { t: 'endTurn' }));
        if (m.mode.kind === 'vsBot') events.push(...m.runBots());
        return events;
      });
    },

    surrender() {
      const { match, viewer } = get();
      if (!match || match.finished) return;
      const who = match.mode.kind === 'hotseat' ? match.active : viewer;
      set({ commitOpen: false, targeting: null });
      run((m) => m.command(who, { t: 'surrender' }));
    },

    step() {
      const { pending, match, displayHp, floats, logs, viewer } = get();
      if (!match || pending.length === 0) return;
      const [e, ...rest] = pending as [GameEvent, ...GameEvent[]];
      let id = get().nextId;
      const hp = { ...displayHp };
      if (e.t === 'damage' || e.t === 'heal') hp[e.target] = e.hp;
      if (e.t === 'died') hp[e.unit] = 0;
      const float = toFloat(e, id++);
      const units = match.view(viewer).units;
      const line = isLogged(e) ? toLogLine(match.content, units, e, id++) : null;
      const nextLogs: [LogLine[], LogLine[]] = [...logs];
      if (line) nextLogs[viewer] = [...logs[viewer], line];
      set({
        pending: rest,
        displayHp: hp,
        floats: float ? [...floats, float] : floats,
        logs: nextLogs,
        nextId: id,
      });
      if (rest.length === 0) get().afterPlayback();
    },

    flush() {
      while (get().pending.length > 0) get().step();
    },

    afterPlayback() {
      const { match, viewer } = get();
      set({ displayView: null, displayHp: {}, version: get().version + 1 });
      if (!match || match.finished) return;
      if (match.mode.kind === 'hotseat' && match.active !== viewer) set({ handoff: match.active });
      if (match.mode.kind === 'watch') {
        // Watching: play the next bot turn once this one has been shown.
        setTimeout(() => {
          const s = get();
          if (s.match === match && s.pending.length === 0 && !match.finished) run((m) => m.runBotTurn());
        }, 250);
      }
    },

    removeFloat(id) {
      set({ floats: get().floats.filter((f) => f.id !== id) });
    },

    setSpeed(speed) {
      set({ speed });
      if (speed === 0) get().flush();
    },

    acceptHandoff() {
      const h = get().handoff;
      if (h === null) return;
      set({ handoff: null, viewer: h, version: get().version + 1 });
    },

    dismissToast() {
      set({ toast: null });
    },

    setInspect(inspect, anchor = null) {
      set({ inspect, anchor: inspect ? anchor : null });
    },

    toggleLog(open) {
      set({ logOpen: open ?? !get().logOpen });
    },
  };
});
