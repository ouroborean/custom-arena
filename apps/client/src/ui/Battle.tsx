import { useEffect, useMemo } from 'react';
import type { PlayerId } from '@arena/engine';
import { delayFor } from '../match/playback.js';
import { useStore, type Speed } from '../store.js';
import { BattleLog } from './BattleLog.js';
import { CommitDialog } from './CommitDialog.js';
import { Dock } from './Dock.js';
import { GameOverOverlay, HandoffOverlay, Toast } from './Overlays.js';
import { UnitCard } from './UnitCard.js';

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

const SPEEDS: { v: Speed; label: string }[] = [
  { v: 1, label: '1×' },
  { v: 2, label: '2×' },
  { v: 0, label: 'Instant' },
];

export function Battle() {
  usePlayback();
  const match = useStore((s) => s.match);
  const viewer = useStore((s) => s.viewer);
  const version = useStore((s) => s.version);
  const displayView = useStore((s) => s.displayView);
  const playing = useStore((s) => s.pending.length > 0);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const commitOpen = useStore((s) => s.commitOpen);
  const handoff = useStore((s) => s.handoff);
  const floats = useStore((s) => s.floats);
  const surrender = useStore((s) => s.surrender);
  const toSetup = useStore((s) => s.toSetup);
  const cancelTargeting = useStore((s) => s.cancelTargeting);
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelTargeting();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelTargeting]);

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

  const status = match.finished
    ? 'Match over'
    : playing
      ? 'Resolving…'
      : myTurn
        ? 'Your turn'
        : match.mode.kind === 'watch'
          ? `Player ${match.active + 1} is thinking…`
          : "Opponent's turn";

  const side = (p: PlayerId) => {
    const units = view.units.filter((u) => u.owner === p);
    const chars = units.filter((u) => u.kind === 'character');
    const minions = units.filter((u) => u.kind === 'minion' && u.alive);
    const label =
      match.mode.kind === 'vsBot' ? (p === viewer ? 'Your team' : 'Enemy team') : `Player ${p + 1}${p === viewer ? ' (you)' : ''}`;
    return (
      <section className="field" aria-label={label}>
        <div className="side-label">
          <span>{label}</span>
          {view.players[p].energy === null && <span style={{ textTransform: 'none', letterSpacing: 0 }}>energy hidden</span>}
        </div>
        <div className={`team-row${p === viewer ? '' : ' enemy'}`}>
          {chars.map((u) => (
            <UnitCard key={u.id} unit={u} view={view} viewer={viewer} content={content} availability={availability} hit={hitUnits.has(u.id)} />
          ))}
        </div>
        {minions.length > 0 && (
          <div className="minion-row">
            {minions.map((u) => (
              <UnitCard key={u.id} unit={u} view={view} viewer={viewer} content={content} availability={availability} hit={hitUnits.has(u.id)} />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="battle">
      <header className="topbar">
        <span className="title">Custom Arena</span>
        <span className={`turn-pill${myTurn ? ' mine' : ''}`}>
          Turn {view.turn} · {status}
        </span>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          Playback
        </span>
        <div className="segmented" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s.label} type="button" aria-pressed={speed === s.v} onClick={() => setSpeed(s.v)}>
              {s.label}
            </button>
          ))}
        </div>
        {!match.finished && match.mode.kind !== 'watch' && (
          <button type="button" className="btn danger small" onClick={() => confirm('Surrender this match?') && surrender()}>
            Surrender
          </button>
        )}
        <button type="button" className="btn small" onClick={toSetup}>
          Leave
        </button>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {side(other)}
        {side(viewer)}
        {match.mode.kind !== 'watch' && <Dock view={liveView} viewer={viewer} content={content} myTurn={myTurn} />}
      </main>

      <aside className="side-panel">
        <BattleLog />
      </aside>

      {commitOpen && <CommitDialog view={liveView} viewer={viewer} content={content} />}
      <HandoffOverlay />
      <GameOverOverlay />
      <Toast />
    </div>
  );
}
