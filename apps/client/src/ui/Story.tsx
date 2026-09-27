// Story mode (GDD §2.2, docs/single-player.md): element chapters of three encounters each, and the
// achievements list. Starting an encounter asks the server for an attempt (teams + seed); the match
// runs locally and its result goes back to the server for verification when it ends.

import { useEffect, useState } from 'react';
import { encounterUnitSpec, formatAmounts } from '@arena/meta';
import type { GrantSpec } from '@arena/engine';
import { api, ApiError, type AchievementStatus, type ChapterStatus } from '../api.js';
import { content } from '../content.js';
import { useT } from '../i18n/index.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';
import { elementClass } from './common.js';

function grantText(g: GrantSpec | undefined): string {
  const parts = [formatAmounts(content, g?.currency ?? {}), ...(g?.items ?? []).map((i) => content.items[i]?.name ?? i)].filter(
    (p) => p !== 'nothing',
  );
  return parts.length ? parts.join(' · ') : '—';
}

export function Story() {
  const t = useT();
  const go = useStore((s) => s.go);
  const newMatch = useStore((s) => s.newMatch);
  const team = useMeta((s) => s.team);
  const [chapters, setChapters] = useState<ChapterStatus[] | null>(null);
  const [clears, setClears] = useState<Record<string, number>>({});
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [problem, setProblem] = useState<{ message: string; problems: string[] } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    api.story().then(
      (r) => {
        setChapters(r.chapters);
        setClears(r.clears);
      },
      (e: unknown) => setProblem({ message: e instanceof Error ? e.message : String(e), problems: [] }),
    );
    api.achievements().then(
      (r) => setAchievements(r.achievements),
      () => undefined,
    );
  }, []);

  const play = async (id: string) => {
    setProblem(null);
    setStarting(id);
    try {
      const r = await api.startStory(id);
      newMatch(content, r.config, { kind: 'vsBot', bot: 'normal', human: 0, story: { encounter: id, attemptId: r.attemptId } }, 'story');
    } catch (e) {
      setProblem(e instanceof ApiError ? { message: e.message, problems: e.problems } : { message: String(e), problems: [] });
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="meta-page wide">
      <div className="meta-header">
        <Brand />
        <button type="button" className="btn small" onClick={() => go('home')}>
          {t('common.home')}
        </button>
      </div>
      <h1 className="page-title">{t('story.title')}</h1>
      {team.length !== 3 && <p className="notice warn">{t('story.needTeam')}</p>}
      {problem && (
        <div className="notice error" role="alert">
          {problem.message}
          {problem.problems.length > 0 && (
            <ul>
              {problem.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!chapters ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <div className="chapters">
          {chapters
            .filter((c) => !content.chapters[c.id]?.tutorial)
            .map((c) => {
              const def = content.chapters[c.id]!;
              return (
                <section key={c.id} className={`panel chapter${c.unlocked ? '' : ' locked'}`} aria-label={def.name}>
                  <div className="chapter-head">
                    {def.element && <span className={`element-tag ${elementClass(def.element)}`}>{def.element}</span>}
                    <h2>{def.name}</h2>
                    <span className="muted">{c.complete ? t('story.complete') : c.unlocked ? def.description : t('story.locked')}</span>
                  </div>
                  {c.unlocked && (
                    <ol className="encounters">
                      {c.encounters.map((e, i) => {
                        const enc = content.encounters[e.id]!;
                        const enemies = enc.enemies.map((u) =>
                          t('story.enemy', {
                            name: u.name,
                            className: content.classes[u.classId]?.name ?? u.classId,
                            hp: encounterUnitSpec(content, u).hp ?? 100,
                          }),
                        );
                        return (
                          <li key={e.id} className={`encounter${e.cleared ? ' cleared' : ''}${e.unlocked ? '' : ' locked'}`}>
                            <div className="encounter-main">
                              <b>
                                {i + 1}. {enc.name}
                              </b>
                              <span className="muted">
                                {enc.description} · {t('story.ai', { tier: t(`bot.${enc.ai.tier}`) })}
                              </span>
                              <span className="enemies">{enemies.join(' · ')}</span>
                              <span className="muted">
                                {e.cleared
                                  ? t('story.cleared', { count: clears[e.id] ?? 1, reward: grantText(enc.rewards?.repeat) })
                                  : t('story.firstClear', { reward: grantText(enc.rewards?.first) })}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={`btn${e.cleared ? '' : ' primary'}`}
                              disabled={!e.unlocked || starting !== null || (!enc.playerTeam && team.length !== 3)}
                              onClick={() => void play(e.id)}
                            >
                              {starting === e.id ? t('common.starting') : e.cleared ? t('story.replay') : t('story.fight')}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {def.reward && (
                    <p className="muted">
                      {t('story.chapterReward', { reward: grantText(def.reward) })}
                      {c.complete ? ` ${t('common.claimed')}` : ''}
                    </p>
                  )}
                </section>
              );
            })}
        </div>
      )}

      <section aria-label={t('story.achievements')}>
        <div className="section-head">
          <h2>
            {t('story.achievements')}{' '}
            <span className="muted">
              {achievements.filter((a) => a.done).length}/{Object.keys(content.achievements).length}
            </span>
          </h2>
        </div>
        <div className="achievement-grid">
          {Object.values(content.achievements).map((a) => {
            const p = achievements.find((x) => x.id === a.id);
            return (
              <div key={a.id} className={`achievement${p?.done ? ' done' : ''}`}>
                <b>{a.name}</b>
                <span className="muted">{a.description}</span>
                <span className="progress">
                  {p?.done ? t('story.achievementDone') : `${Math.min(p?.count ?? 0, a.count)}/${a.count}`} · {grantText(a.reward)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
