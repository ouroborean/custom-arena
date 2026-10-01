// Online play from Home: casual/ranked queues, private matches by code, and resuming a match.

import { useEffect, useState } from 'react';
import { formatAmounts } from '@arena/meta';
import { api, type Ratings } from '../api.js';
import { content } from '../content.js';
import { formatDate, useT } from '../i18n/index.js';
import { online, serverNow, useOnline } from '../match/online.js';
import { useStore } from '../store.js';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The ranked season line: the season and when it ends, the player's standing, the last season reward. */
function SeasonLine({ ratings }: { ratings: Ratings }) {
  const t = useT();
  const { season, next, ranked, lastReward } = ratings;
  const last =
    lastReward &&
    t('season.lastReward', {
      season: lastReward.seasonName,
      tier: lastReward.tier,
      rating: lastReward.rating,
      reward: [formatAmounts(content, lastReward.currency), ...lastReward.items.map((i) => content.items[i]?.name ?? i)].join(' · '),
    });
  return (
    <div className="season-line">
      {season ? (
        <>
          <b>{season.end ? t('season.ends', { season: season.name, date: formatDate(season.end) }) : t('season.open', { season: season.name })}</b>
          {ranked && (
            <>
              <span>
                {t('season.rating', { rating: ranked.rating, rd: ranked.rd, wins: ranked.wins, games: ranked.games })}
              </span>
              <span className={`season-tier${ranked.tier ? '' : ' none'}`}>
                {ranked.placementGames > 0
                  ? t('season.placement', { count: ranked.placementGames })
                  : ranked.tier
                    ? t('season.tier', { tier: ranked.tier.name })
                    : t('season.unranked')}
              </span>
            </>
          )}
        </>
      ) : (
        <b>
          {t('season.between')}
          {next ? ` · ${t('season.next', { season: next.name, date: formatDate(next.start) })}` : ''}
        </b>
      )}
      {last && <span className="muted">{last}</span>}
    </div>
  );
}

function Waiting({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="mono-num">{mmss(serverNow() - since)}</span>;
}

export function OnlinePanel({ teamReady }: { teamReady: boolean }) {
  const { status, lobby, error, problems, current } = useOnline();
  const match = useStore((s) => s.match);
  const newSession = useStore((s) => s.newSession);
  const go = useStore((s) => s.go);
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState<number | null>(90);
  const [ratings, setRatings] = useState<Ratings | null>(null);

  useEffect(() => {
    online.connect();
    api.ratings().then(setRatings, () => setRatings(null));
  }, []);

  const ready = status === 'ready';
  const idle = lobby.kind === 'idle';
  const resumable = current && !current.finished && match !== current;

  return (
    <section className="panel online-panel" aria-label="Online play">
      <div className="section-head">
        <span className="panel-title">Online</span>
        <span className={`conn-dot ${status}`} title={status} />
        <span className="muted">{status === 'ready' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Offline'}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn small" onClick={() => go('history')}>
          Match history
        </button>
      </div>
      {ratings && <SeasonLine ratings={ratings} />}

      {resumable && (
        <div className="online-row">
          <span>
            Match in progress vs <b>{current.mode.opponent}</b>
          </span>
          <button type="button" className="btn primary" onClick={() => newSession(current, 'home')}>
            Resume match
          </button>
        </div>
      )}

      {lobby.kind === 'queued' && (
        <div className="online-row">
          <span>
            Searching for a <b>{lobby.mode}</b> match · <Waiting since={lobby.since} />
          </span>
          <button type="button" className="btn" onClick={() => online.leaveQueue()}>
            Cancel
          </button>
        </div>
      )}

      {lobby.kind === 'hosting' && (
        <div className="online-row">
          <span>
            Private match code <b className="code">{lobby.code}</b> · {lobby.timer ? `${lobby.timer}s turns` : 'no timer'} · waiting for a
            friend…
          </span>
          <button type="button" className="btn" onClick={() => online.cancelPrivate()}>
            Cancel
          </button>
        </div>
      )}

      {idle && !resumable && (
        <div className="online-row wrap">
          <button type="button" className="btn primary" disabled={!ready || !teamReady} onClick={() => online.joinQueue('casual')}>
            Casual
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!ready || !teamReady || ratings?.season === null}
            onClick={() => online.joinQueue('ranked')}
          >
            Ranked
          </button>
          <span className="divider" />
          <div className="control">
            <label htmlFor="pm-timer">Private match</label>
            <div className="row-actions">
              <select id="pm-timer" value={timer ?? 0} onChange={(e) => setTimer(Number(e.target.value) || null)}>
                <option value={90}>90s turns</option>
                <option value={60}>60s turns</option>
                <option value={180}>180s turns</option>
                <option value={0}>No timer</option>
              </select>
              <button type="button" className="btn" disabled={!ready || !teamReady} onClick={() => online.createPrivate(timer)}>
                Create code
              </button>
            </div>
          </div>
          <div className="control">
            <label htmlFor="pm-code">Join with code</label>
            <div className="row-actions">
              <input
                id="pm-code"
                type="text"
                maxLength={12}
                value={code}
                placeholder="ABC234"
                style={{ width: 110, textTransform: 'uppercase' }}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="button" className="btn" disabled={!ready || !teamReady || code.trim().length < 4} onClick={() => online.joinPrivate(code)}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="notice error" role="alert">
          {error}
          {problems.length > 0 && (
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
