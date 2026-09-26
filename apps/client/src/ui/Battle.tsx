import { useEffect, useMemo, useRef } from 'react';
import type { PlayerId } from '@arena/engine';
import type { LocalMatch } from '../match/LocalMatch.js';
import { assignBench, delayFor } from '../match/playback.js';
import { useStore } from '../store.js';
import { CommitDialog } from './CommitDialog.js';
import { GameOverOverlay, HandoffOverlay, Toast } from './Overlays.js';
import { Inspector, LogDrawer, QueueTray, Stage, TopBar } from './Panels.js';
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
  const bench = useRef<{ match: LocalMatch | null; slots: [(string | null)[], (string | null)[]] }>({ match: null, slots: [[], []] });

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
  const myTurn = !match.finished && match.active === viewer && match.isHuman(viewer) && handoff === null;
  const hitUnits = new Set(floats.filter((f) => f.kind === 'damage').map((f) => f.unit));
  const watch = match.mode.kind === 'watch';

  const status = match.finished ? 'Match over' : playing ? 'Resolving' : myTurn ? 'Your move' : watch ? `Bot ${match.active + 1}` : 'Enemy move';
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
      <section className={`roster${p === viewer ? '' : ' enemy'}`} aria-label={label}>
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
      <TopBar match={match} view={liveView} viewer={viewer} myTurn={myTurn} />

      <main className="arena">
        {roster(viewer)}
        <Stage turn={view.turn} status={status} tone={tone} />
        {roster(other)}
      </main>

      <footer className="bottombar">
        {!watch ? <QueueTray view={liveView} viewer={viewer} content={content} /> : <div />}
        <Inspector view={view} content={content} availability={availability} />
      </footer>

      <LogDrawer />
      {commitOpen && <CommitDialog view={liveView} viewer={viewer} content={content} />}
      <HandoffOverlay />
      <GameOverOverlay />
      <Toast />
    </div>
  );
}
