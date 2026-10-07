// The Tutorial screen: the tutorial chapter's lessons (encounters with fixed teams, forced energy and
// a coach script), which run like story attempts so the server verifies them and pays their rewards,
// then the menu guides (guides.ts): coached walkthroughs of recruiting, equipment, infusions and forging.

import { useEffect, useState } from 'react';
import { formatAmounts } from '@arena/meta';
import { pieceDisplayName, type GrantSpec } from '@arena/engine';
import { api, ApiError, type ChapterStatus } from '../api.js';
import { content } from '../content.js';
import { GUIDES, snapshotOf, useGuide } from '../guides.js';
import { useT } from '../i18n/index.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';

export function Tutorial() {
  const t = useT();
  const go = useStore((s) => s.go);
  const newMatch = useStore((s) => s.newMatch);
  const [chapters, setChapters] = useState<ChapterStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const done = useGuide((s) => s.done);
  const beginGuide = useGuide((s) => s.begin);
  const setHomeTab = useStore((s) => s.setHomeTab);
  const characters = useMeta((s) => s.characters);
  const team = useMeta((s) => s.team);

  /** Starts a guide on the screen its first step happens on. */
  const startGuide = (id: string) => {
    const guide = GUIDES.find((g) => g.id === id)!;
    const first = guide.steps[0]!.screen ?? 'home';
    const who = team[0] ?? characters[0]?.id;
    const screen = first === 'character' && who ? 'character' : 'home';
    // Home guides start on the Main tab: their first steps show the player which tab to open.
    beginGuide(id, snapshotOf(characters, useGuide.getState().signals, screen, screen === 'character' ? who! : null, 'main'));
    if (screen === 'character') go('character', who);
    else {
      setHomeTab('main');
      go('home');
    }
  };

  const grantText = (g: GrantSpec | undefined): string => {
    const parts = [
      formatAmounts(content, g?.currency ?? {}),
      ...(g?.boxes ?? []).map((b) => content.economy.lootBoxes?.[b]?.name ?? b),
      ...(g?.items ?? []).map((i) => pieceDisplayName(content, i)),
      ...(g?.rolls ? [t('grant.freeCharacters', { count: g.rolls })] : []),
    ].filter((p) => p !== 'nothing');
    return parts.length ? parts.join(' · ') : t('common.none');
  };

  useEffect(() => {
    api.story().then(
      (r) => setChapters(r.chapters.filter((c) => content.chapters[c.id]?.tutorial)),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const start = async (id: string) => {
    setError(null);
    setStarting(id);
    try {
      const r = await api.startStory(id);
      newMatch(content, r.config, { kind: 'vsBot', bot: 'easy', human: 0, story: { encounter: id, attemptId: r.attemptId } }, 'tutorial');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="meta-page">
      <div className="meta-header">
        <Brand />
        <button type="button" className="btn small" onClick={() => go('home')}>
          {t('common.home')}
        </button>
      </div>
      <h1 className="page-title">{t('tutorial.title')}</h1>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!chapters ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        chapters.map((c) => {
          const def = content.chapters[c.id]!;
          return (
            <section key={c.id} className="panel chapter" aria-label={def.name}>
              <p className="muted">{def.description}</p>
              <ol className="encounters">
                {c.encounters.map((e, i) => {
                  const enc = content.encounters[e.id]!;
                  return (
                    <li key={e.id} className={`encounter${e.cleared ? ' cleared' : ''}${e.unlocked ? '' : ' locked'}`}>
                      <div className="encounter-main">
                        <b>{t('tutorial.lesson', { n: i + 1, name: enc.name })}</b>
                        <span className="muted">{enc.description}</span>
                        <span className="muted">{e.cleared ? t('tutorial.done') : t('tutorial.reward', { reward: grantText(enc.rewards?.first) })}</span>
                      </div>
                      <button
                        type="button"
                        className={`btn${e.cleared ? '' : ' primary'}`}
                        disabled={!e.unlocked || starting !== null}
                        onClick={() => void start(e.id)}
                      >
                        {starting === e.id ? t('common.starting') : e.cleared ? t('tutorial.again') : t('tutorial.start')}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {def.reward && (
                <p className="muted">
                  {t('tutorial.chapterReward', { reward: grantText(def.reward) })}
                  {c.complete ? ` ${t('common.claimed')}` : ''}
                </p>
              )}
            </section>
          );
        })
      )}
      <section className="panel chapter" aria-label={t('tutorial.guides')}>
        <h2 className="panel-title">{t('tutorial.guides')}</h2>
        <p className="muted">{t('tutorial.guidesIntro')}</p>
        <ol className="encounters">
          {GUIDES.map((g) => {
            const finished = done.includes(g.id);
            return (
              <li key={g.id} className={`encounter${finished ? ' cleared' : ''}`}>
                <div className="encounter-main">
                  <b>{g.name}</b>
                  <span className="muted">{g.description}</span>
                  <span className="muted">
                    {finished ? t('tutorial.done') : t('tutorial.reward', { reward: grantText(content.economy.guideRewards?.[g.id]) })}
                  </span>
                </div>
                <button type="button" className={`btn${finished ? '' : ' primary'}`} onClick={() => startGuide(g.id)}>
                  {finished ? t('tutorial.again') : t('tutorial.start')}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
