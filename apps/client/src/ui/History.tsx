// Match history with replays (GDD Phase 5). Replays run locally from the recorded commands.

import { useEffect, useState } from 'react';
import { pieceDisplayName } from '@arena/engine';
import { formatAmounts } from '@arena/meta';
import { api, type MatchSummary } from '../api.js';
import { content } from '../content.js';
import { ReplaySession } from '../match/ReplaySession.js';
import { useStore } from '../store.js';

const REASONS: Record<string, string> = {
  elimination: 'Elimination',
  surrender: 'Surrender',
  draw: 'Draw',
  turnLimit: 'Turn limit',
  disconnect: 'Disconnect',
  afk: 'Timed out',
  server_restart: 'Server restart',
};

export function History() {
  const go = useStore((s) => s.go);
  const newSession = useStore((s) => s.newSession);
  const [rows, setRows] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.matches().then(
      (r) => setRows(r.matches),
      (e: Error) => setError(e.message),
    );
  }, []);

  const watch = async (m: MatchSummary) => {
    setError(null);
    try {
      const { record, seat, playable } = await api.replay(m.id);
      if (!playable) return setError('That replay was recorded with a different game version.');
      newSession(
        new ReplaySession(content, record, { kind: 'replay', seat, opponent: m.opponent, ...(m.endReason ? { endReason: m.endReason } : {}) }),
        'history',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="meta-page wide">
      <div className="section-head">
        <button type="button" className="btn" onClick={() => go('home')}>
          ← Home
        </button>
        <h2>Match history</h2>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No online matches yet.</p>
      ) : (
        <div className="history-list" role="table" aria-label="Matches">
          {rows.map((m) => (
            <div key={m.id} className={`history-row ${m.outcome ?? m.status}`} role="row">
              <span className="outcome" role="cell">
                {m.outcome ? m.outcome.toUpperCase() : m.status === 'active' ? 'LIVE' : 'ABORTED'}
              </span>
              <span role="cell">
                vs <b>{m.opponent}</b>
              </span>
              <span className="muted" role="cell">
                {m.kind} · {m.endReason ? (REASONS[m.endReason] ?? m.endReason) : '—'} · {m.turns} turns
              </span>
              <span className="muted" role="cell">
                {new Date(m.startedAt).toLocaleString()}
              </span>
              <span role="cell">
                {m.rating && (
                  <b className={m.rating.after >= m.rating.before ? 'up' : 'down'}>
                    {m.rating.after >= m.rating.before ? '+' : ''}
                    {m.rating.after - m.rating.before}
                  </b>
                )}
              </span>
              <span className="muted" role="cell">
                {m.reward && (
                  <>
                    {formatAmounts(content, m.reward.currency)}
                    {m.reward.items.map((id) => ` · ${pieceDisplayName(content, id)}`).join('')}
                  </>
                )}
              </span>
              <span role="cell">
                {m.status === 'finished' && (
                  <button type="button" className="btn small" onClick={() => void watch(m)}>
                    Replay
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
