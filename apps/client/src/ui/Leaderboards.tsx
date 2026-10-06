// Home's two leaderboards (GET /api/leaderboards): the longest current win streaks in casual and ranked
// matches, and the highest ranked ratings this season. Places nobody has earned yet are filled by the
// earliest accounts, in registration order, shown without a value.

import { useEffect, useState } from 'react';
import { api, type LeaderboardEntry, type Leaderboards as Boards } from '../api.js';
import { useT } from '../i18n/index.js';

export function Leaderboards() {
  const t = useT();
  const [boards, setBoards] = useState<Boards | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api.leaderboards().then(
      (b) => live && setBoards(b),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="leaderboards" aria-label={t('home.leaderboards')}>
      <Board
        title={t('home.lb.streak')}
        hint={t('home.lb.streakHint')}
        entries={boards?.winstreak}
        failed={failed}
        value={(e) => (e.value === null ? '—' : e.value === 1 ? t('home.lb.win') : t('home.lb.wins', { count: e.value }))}
      />
      <Board
        title={t('home.lb.rank')}
        hint={boards?.season ? t('home.lb.rankHintSeason', { season: boards.season.name }) : t('home.lb.rankHint')}
        entries={boards?.rank}
        failed={failed}
        value={(e) => (e.value === null ? '—' : `${e.value}${e.detail ? ` · ${e.detail}` : ''}`)}
      />
    </div>
  );
}

function Board({
  title,
  hint,
  entries,
  failed,
  value,
}: {
  title: string;
  hint: string;
  entries: LeaderboardEntry[] | undefined;
  failed: boolean;
  value: (e: LeaderboardEntry) => string;
}) {
  const t = useT();
  return (
    <section className="panel leaderboard" aria-label={title}>
      <div className="panel-title">{title}</div>
      <p className="muted lb-hint">{hint}</p>
      {!entries ? (
        <p className="muted">{failed ? t('home.lb.failed') : t('common.loading')}</p>
      ) : (
        <ol className="lb-list">
          {entries.map((e, i) => (
            <li key={`${e.name}${i}`} className={e.value === null ? 'unranked' : ''}>
              <span className="lb-place">{i + 1}</span>
              <span className="lb-name">{e.name}</span>
              <span className="lb-value">{value(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
