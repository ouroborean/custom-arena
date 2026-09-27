// The Tutorial screen: the tutorial chapter's lessons (encounters with fixed teams, forced energy and
// a coach script). They run like story attempts, so the server verifies them and pays their rewards.

import { useEffect, useState } from 'react';
import { formatAmounts } from '@arena/meta';
import type { GrantSpec } from '@arena/engine';
import { api, ApiError, type ChapterStatus } from '../api.js';
import { content } from '../content.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';

function grantText(g: GrantSpec | undefined): string {
  const parts = [
    formatAmounts(content, g?.currency ?? {}),
    ...(g?.items ?? []).map((i) => content.items[i]?.name ?? i),
    ...(g?.rolls ? [`${g.rolls} free character${g.rolls > 1 ? 's' : ''}`] : []),
  ].filter((p) => p !== 'nothing');
  return parts.length ? parts.join(' · ') : '—';
}

export function Tutorial() {
  const go = useStore((s) => s.go);
  const newMatch = useStore((s) => s.newMatch);
  const [chapters, setChapters] = useState<ChapterStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

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
          Home
        </button>
      </div>
      <h1 className="page-title">Tutorial</h1>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!chapters ? (
        <p className="muted">Loading…</p>
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
                        <b>
                          Lesson {i + 1}: {enc.name}
                        </b>
                        <span className="muted">{enc.description}</span>
                        <span className="muted">{e.cleared ? 'Done' : `Reward: ${grantText(enc.rewards?.first)}`}</span>
                      </div>
                      <button
                        type="button"
                        className={`btn${e.cleared ? '' : ' primary'}`}
                        disabled={!e.unlocked || starting !== null}
                        onClick={() => void start(e.id)}
                      >
                        {starting === e.id ? 'Starting…' : e.cleared ? 'Again' : 'Start'}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {def.reward && (
                <p className="muted">
                  Finish every lesson: {grantText(def.reward)}
                  {c.complete ? ' (claimed)' : ''}
                </p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
