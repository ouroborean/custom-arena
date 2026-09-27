import { formatAmounts } from '@arena/meta';
import { content } from '../content.js';
import type { MatchSession, OnlineInfo } from '../match/session.js';
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
  const kind = match.mode.kind;
  const personal = kind === 'vsBot' || kind === 'online' || kind === 'replay';
  const online = kind === 'online' ? (match as MatchSession & OnlineInfo) : null;
  const headline =
    online?.endReason === 'ended while you were away'
      ? 'Match over'
      : r.winner === null
        ? 'Draw'
        : personal
          ? r.winner === viewer
            ? 'Victory'
            : 'Defeat'
          : `Player ${r.winner + 1} wins`;
  const serverReason = online?.endReason ?? (match.mode.kind === 'replay' ? match.mode.endReason : undefined);
  const reason =
    serverReason === 'disconnect'
      ? r.winner === viewer
        ? 'Your opponent disconnected'
        : 'You were disconnected too long'
      : serverReason === 'afk'
        ? r.winner === viewer
          ? 'Your opponent stopped playing'
          : 'Too many turns timed out'
        : serverReason === 'ended while you were away'
          ? 'It ended while you were away; see Match history'
          : { elimination: 'All enemy characters defeated', draw: 'Both teams fell together', surrender: 'Surrender', turnLimit: 'Turn limit reached' }[r.reason];
  const record = match.record;
  const seed = match.config?.seed ?? 0;
  const rating = online?.rating;
  const reward = online?.reward;
  const story = kind === 'vsBot' ? match.mode.story : undefined;

  const download = () => {
    if (!record) return;
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `custom-arena-replay-${seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const local = (kind === 'vsBot' && !story) || kind === 'hotseat' || kind === 'watch';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
      <div className="dialog" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className={`banner${r.winner === null ? '' : personal ? (r.winner === viewer ? ' win' : ' lose') : ' win'}`} id="over-title">
          {headline}
        </div>
        <p className="muted">
          {reason} · turn {match.turn}
        </p>
        {rating && (
          <p className="rating-change">
            Rating {rating.before} → <b>{rating.after}</b> ({rating.after >= rating.before ? '+' : ''}
            {rating.after - rating.before})
          </p>
        )}
        {reward && (
          <p className="reward">
            Earned {formatAmounts(content, reward.currency)}
            {reward.items.map((id) => (
              <span key={id}>
                {' · '}
                <b>{content.items[id]?.name ?? id}</b>
              </span>
            ))}
          </p>
        )}
        {story && <StoryVerdict />}
        <div className="actions" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {record && kind !== 'replay' && (
            <button type="button" className="btn" onClick={download}>
              Download replay
            </button>
          )}
          <button type="button" className={`btn${local ? '' : ' primary'}`} autoFocus={!local} onClick={toSetup}>
            {{ home: 'Home', history: 'Back to history', sandbox: 'New match', story: 'Back to the story', tutorial: 'Back to the tutorial' }[returnTo]}
          </button>
          {local && (
            <button type="button" className="btn primary" autoFocus onClick={rematch}>
              Rematch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** What the server made of a finished story attempt (it replays the match before paying out). */
function StoryVerdict() {
  const result = useStore((s) => s.storyResult);
  if (!result || result.status === 'submitting') return <p className="muted">Checking the result with the server…</p>;
  if (result.status === 'error') {
    return (
      <p className="notice error" role="alert">
        The result couldn't be recorded: {result.message}
      </p>
    );
  }
  const r = result.result;
  const earned = Object.values(r.reward.currency).some((n) => n > 0) || r.reward.items.length > 0;
  return (
    <div className="story-verdict">
      {earned && (
        <p className="reward">
          Earned {formatAmounts(content, r.reward.currency)}
          {r.reward.items.map((id, i) => (
            <span key={`${id}${i}`}>
              {' · '}
              <b>{content.items[id]?.name ?? id}</b>
            </span>
          ))}
        </p>
      )}
      {!earned && <p className="muted">Result recorded ({r.outcome}).</p>}
      {r.chapterComplete && <p className="reward">{content.chapters[r.chapterComplete]?.name} complete!</p>}
      {r.characters.map((c) => (
        <p key={c.id} className="reward">
          New character: <b>{c.name}</b>
        </p>
      ))}
      {r.achievements.map((a) => (
        <p key={a.id} className="reward">
          Achievement: <b>{content.achievements[a.id]?.name ?? a.id}</b>
        </p>
      ))}
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
