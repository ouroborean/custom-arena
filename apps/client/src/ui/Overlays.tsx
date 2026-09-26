import { useStore } from '../store.js';

export function HandoffOverlay() {
  const handoff = useStore((s) => s.handoff);
  const accept = useStore((s) => s.acceptHandoff);
  if (handoff === null) return null;
  return (
    <div className="overlay opaque" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
      <div className="dialog" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 id="handoff-title">Player {handoff + 1}'s turn</h2>
        <p className="muted">Pass the device to Player {handoff + 1}. Their hidden effects and energy stay secret from the other player.</p>
        <button type="button" className="btn primary" autoFocus onClick={accept}>
          I'm Player {handoff + 1}, show my turn
        </button>
      </div>
    </div>
  );
}

export function GameOverOverlay() {
  const match = useStore((s) => s.match);
  const viewer = useStore((s) => s.viewer);
  const playing = useStore((s) => s.pending.length > 0);
  const rematch = useStore((s) => s.rematch);
  const toSetup = useStore((s) => s.toSetup);
  const returnTo = useStore((s) => s.returnTo);
  useStore((s) => s.version);
  if (!match || !match.finished || playing) return null;
  const r = match.result!;
  const vsBot = match.mode.kind === 'vsBot';
  const headline =
    r.winner === null ? 'Draw' : vsBot ? (r.winner === viewer ? 'Victory' : 'Defeat') : `Player ${r.winner + 1} wins`;
  const reason = { elimination: 'All enemy characters defeated', draw: 'Both teams fell together', surrender: 'Surrender', turnLimit: 'Turn limit reached' }[r.reason];

  const download = () => {
    const blob = new Blob([JSON.stringify(match.record, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `custom-arena-replay-${match.config.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
      <div className="dialog" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className={`banner${r.winner === null ? '' : vsBot ? (r.winner === viewer ? ' win' : ' lose') : ' win'}`} id="over-title">
          {headline}
        </div>
        <p className="muted">
          {reason} · turn {match.turn}
        </p>
        <div className="actions" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={download}>
            Download replay
          </button>
          <button type="button" className="btn" onClick={toSetup}>
            {returnTo === 'home' ? 'Home' : 'New match'}
          </button>
          <button type="button" className="btn primary" autoFocus onClick={rematch}>
            Rematch
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="toast" role="alert">
      {toast}
      <button type="button" className="btn small" onClick={dismiss}>
        OK
      </button>
    </div>
  );
}
