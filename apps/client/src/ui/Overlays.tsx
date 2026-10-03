import { pieceDisplayName } from '@arena/engine';
import { formatAmounts } from '@arena/meta';
import { content } from '../content.js';
import type { MatchSession, OnlineInfo } from '../match/session.js';
import { useT, type MessageKey } from '../i18n/index.js';
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
  const t = useT();
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
  const won = r.winner === viewer;
  const headline =
    online?.endReason === 'ended while you were away'
      ? t('over.matchOver')
      : r.winner === null
        ? t('over.draw')
        : personal
          ? t(won ? 'over.victory' : 'over.defeat')
          : t('over.playerWins', { n: r.winner + 1 });
  const serverReason = online?.endReason ?? (match.mode.kind === 'replay' ? match.mode.endReason : undefined);
  const reasonKey: MessageKey =
    serverReason === 'disconnect'
      ? won
        ? 'over.reason.opponentDisconnected'
        : 'over.reason.youDisconnected'
      : serverReason === 'afk'
        ? won
          ? 'over.reason.opponentIdle'
          : 'over.reason.youIdle'
        : serverReason === 'ended while you were away'
          ? 'over.reason.away'
          : (`over.reason.${r.reason}` as MessageKey);
  const record = match.record;
  const seed = match.config?.seed ?? 0;
  const rating = online?.rating;
  const reward = online?.reward;
  const story = kind === 'vsBot' ? match.mode.story : undefined;
  const practice = kind === 'vsBot' ? match.mode.practice : undefined;
  const arcade = kind === 'vsBot' ? match.mode.arcade : undefined;

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
        <div className={`banner${r.winner === null ? '' : personal ? (won ? ' win' : ' lose') : ' win'}`} id="over-title">
          {headline}
        </div>
        <p className="muted">{t('over.summary', { reason: t(reasonKey), turn: match.turn })}</p>
        {rating && (
          <p className="rating-change">
            {t('over.rating', {
              before: rating.before,
              after: rating.after,
              delta: `${rating.after >= rating.before ? '+' : ''}${rating.after - rating.before}`,
            })}
          </p>
        )}
        {reward && <Earned currency={reward.currency} items={reward.items} />}
        {(story || practice || arcade) && <StoryVerdict />}
        <div className="actions" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {record && kind !== 'replay' && (
            <button type="button" className="btn" onClick={download}>
              {t('over.download')}
            </button>
          )}
          <button type="button" className={`btn${local ? '' : ' primary'}`} autoFocus={!local} onClick={toSetup}>
            {t(`over.back.${returnTo}`)}
          </button>
          {local && !arcade && (
            <button type="button" className="btn primary" autoFocus onClick={rematch}>
              {t('over.rematch')}
            </button>
          )}
          {arcade && <ArcadeNext onClick={rematch} />}
        </div>
      </div>
    </div>
  );
}

/** "Earned 40 Gold · Wind Katana". */
function Earned({ currency, items }: { currency: Record<string, number>; items: string[] }) {
  const t = useT();
  return (
    <p className="reward">
      {t('over.earned', { amounts: formatAmounts(content, currency) })}
      {items.map((id, i) => (
        <span key={`${id}${i}`}>
          {' · '}
          <b>{pieceDisplayName(content, id)}</b>
        </span>
      ))}
    </p>
  );
}

/** What the server made of a finished story attempt (it replays the match before paying out). */
/** After an arcade stage: on to the next stage, or a new run (once the server has recorded the result). */
function ArcadeNext({ onClick }: { onClick: () => void }) {
  const t = useT();
  const result = useStore((s) => s.storyResult);
  if (!result || result.status === 'submitting') return null;
  const next = result.status === 'done' ? result.result.arcade?.next : undefined;
  const label = !next ? t('over.arcadeRetry') : next.stage === 1 ? t('over.arcadeNewRun') : t('over.arcadeNext', { stage: next.stage });
  return (
    <button type="button" className="btn primary" autoFocus onClick={onClick}>
      {label}
    </button>
  );
}

function StoryVerdict() {
  const t = useT();
  const result = useStore((s) => s.storyResult);
  if (!result || result.status === 'submitting') return <p className="muted">{t('over.checking')}</p>;
  if (result.status === 'error') {
    return (
      <p className="notice error" role="alert">
        {t('over.notRecorded', { message: result.message })}
      </p>
    );
  }
  const r = result.result;
  const earned = Object.values(r.reward.currency).some((n) => n > 0) || r.reward.items.length > 0;
  return (
    <div className="story-verdict">
      {earned && <Earned currency={r.reward.currency} items={r.reward.items} />}
      {!earned && <p className="muted">{t('over.recorded', { outcome: r.outcome })}</p>}
      {r.arcade && (
        <p className="reward">
          {r.arcade.ladderComplete
            ? t('over.arcadeComplete', { stages: r.arcade.next.stages })
            : r.outcome === 'win'
              ? t('over.arcadeCleared', { stage: r.arcade.stage, stages: r.arcade.next.stages })
              : t('over.arcadeOver', { stage: r.arcade.stage })}
        </p>
      )}
      {r.chapterComplete && (
        <p className="reward">{t('over.chapterComplete', { chapter: content.chapters[r.chapterComplete]?.name ?? r.chapterComplete })}</p>
      )}
      {r.characters.map((c) => (
        <p key={c.id} className="reward">
          {t('over.newCharacter', { name: c.name })}
        </p>
      ))}
      {r.achievements.map((a) => (
        <p key={a.id} className="reward">
          {t('over.achievement', { name: content.achievements[a.id]?.name ?? a.id })}
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
