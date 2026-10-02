import { useEffect, useMemo, useRef } from 'react';
import type { PlayerId } from '@arena/engine';
import type { MatchSession, OnlineInfo } from '../match/session.js';
import { assignBench, delayFor } from '../match/playback.js';
import { useStore } from '../store.js';
import { CommitDialog } from './CommitDialog.js';
import { ActionPopup } from './ActionPopup.js';
import { Announcer } from './Announcer.js';
import { Coach } from './Coach.js';
import { GameOverOverlay, HandoffOverlay, Toast } from './Overlays.js';
import { HoverCard, LogDrawer, QueueTray, Stage, TargetHint, TopBar } from './Panels.js';
import { EmptySlot, MinionSlot, UnitRow } from './UnitRow.js';

/** Steps through queued events on a timer, so resolution plays out instead of snapping. */
function usePlayback(): void {
  const next = useStore((s) => s.pending[0]);
  const speed = useStore((s) => s.speed);
  const step = useStore((s) => s.step);
  useEffect(() => {
    if (!next) return;
    if (speed === 0) {
      useStore.getState().flush();
      return;
    }
    const t = setTimeout(step, delayFor(next) / speed);
    return () => clearTimeout(t);
  }, [next, speed, step]);
}

export function Battle() {
  usePlayback();
  const match = useStore((s) => s.match);
  const viewer = useStore((s) => s.viewer);
  const version = useStore((s) => s.version);
  const displayView = useStore((s) => s.displayView);
  const playing = useStore((s) => s.pending.length > 0);
  const commitOpen = useStore((s) => s.commitOpen);
  const handoff = useStore((s) => s.handoff);
  const floats = useStore((s) => s.floats);
  const cancelTargeting = useStore((s) => s.cancelTargeting);
  const toggleLog = useStore((s) => s.toggleLog);
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);
  // Stable minion bench slots per side, remembered across renders for this match.
  const bench = useRef<{ match: MatchSession | null; slots: [(string | null)[], (string | null)[]] }>({ match: null, slots: [[], []] });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelTargeting();
        toggleLog(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelTargeting, toggleLog]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 3500);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  // Re-read the authoritative view whenever the match changes (version bump).
  const liveView = useMemo(() => match?.view(viewer), [match, viewer, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const availability = useMemo(() => (match && !playing ? match.availability(viewer) : []), [match, viewer, version, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!match || !liveView) return null;
  const view = displayView ?? liveView;
  const content = match.content;
  const other: PlayerId = viewer === 0 ? 1 : 0;
  const myTurn = match.canAct(viewer) && handoff === null;
  const hitUnits = new Set(floats.filter((f) => f.kind === 'damage').map((f) => f.unit));
  const kind = match.mode.kind;
  const watch = kind === 'watch' || kind === 'replay';
  const awaiting = kind === 'online' && (match as MatchSession & OnlineInfo).awaiting;

  const status = match.finished
    ? 'Match over'
    : playing
      ? 'Resolving'
      : myTurn
        ? 'Your move'
        : awaiting
          ? 'Sending turn'
          : kind === 'replay'
            ? 'Replay'
            : kind === 'watch'
              ? `Bot ${match.active + 1}`
              : kind === 'online'
                ? "Opponent's move"
                : 'Enemy move';
  const tone = playing ? 'busy' : myTurn ? 'mine' : 'idle';

  if (bench.current.match !== match) bench.current = { match, slots: [[], []] };
  const benchFor = (p: PlayerId) => {
    const present = view.units.filter((u) => u.owner === p && u.kind === 'minion' && u.alive).map((u) => u.id);
    const slots = assignBench(bench.current.slots[p], present, view.settings.minionCap);
    bench.current.slots[p] = slots;
    return slots;
  };

  const roster = (p: PlayerId) => {
    const chars = view.units.filter((u) => u.owner === p && u.kind === 'character');
    const label = p === viewer ? (watch ? 'Bot 1' : 'Your team') : watch ? 'Bot 2' : 'Enemy team';
    return (
      <section className={`roster${p === viewer ? '' : ' enemy'}`} aria-label={label} {...(p === viewer ? {} : { 'data-coach': 'enemies' })}>
        <div className="roster-label">{label}</div>
        <div className="rows">
          {chars.map((u) => (
            <UnitRow key={u.id} unit={u} view={view} viewer={viewer} content={content} availability={availability} hit={hitUnits.has(u.id)} />
          ))}
        </div>
        <div className="bench" aria-label={`${label} minions`}>
          {benchFor(p).map((id, i) => {
            const u = id ? view.units.find((x) => x.id === id) : undefined;
            return u ? (
              <MinionSlot key={u.id} unit={u} view={view} viewer={viewer} content={content} availability={availability} hit={hitUnits.has(u.id)} />
            ) : (
              <EmptySlot key={`empty-${i}`} />
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="battle">
      <TopBar match={match} view={view} viewer={viewer} myTurn={myTurn} />

      <main className="arena">
        {roster(viewer)}
        <Stage turn={view.turn} status={status} tone={tone} popup={<ActionPopup units={view.units} content={content} />} />
        {roster(other)}
      </main>

      {!watch && (
        <footer className="bottombar">
          <QueueTray view={liveView} viewer={viewer} content={content} />
        </footer>
      )}

      <HoverCard view={view} content={content} availability={availability} />
      <TargetHint view={liveView} content={content} />
      <LogDrawer />
      {commitOpen && <CommitDialog view={liveView} viewer={viewer} content={content} />}
      <Coach />
      <Announcer />
      <HandoffOverlay />
      <GameOverOverlay />
      <Toast />
    </div>
  );
}
