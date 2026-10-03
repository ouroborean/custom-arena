// Home: active team, practice vs bot, the arcade, roster (roll, open, pick a team), wallet and inventory.

import { useEffect, useState } from 'react';
import { canAfford, formatAmounts } from '@arena/meta';
import { api, ApiError, type ArcadeStatus } from '../api.js';
import { content } from '../content.js';
import type { BotKind } from '../match/LocalMatch.js';
import { useT } from '../i18n/index.js';
import { useMeta } from '../meta.js';
import { arcadeMode, useStore } from '../store.js';
import { Brand } from './Account.js';
import { InventoryPanel } from './Inventory.js';
import { OnlinePanel } from './OnlinePanel.js';
import { CharacterCard, Portrait } from './Roster.js';

export function Home() {
  const t = useT();
  const { user, characters, maxRoster, team, wallet, busy, error, roll, setTeam, signOut, contentMismatch, clearError } = useMeta();
  const rollCost = content.economy.roll.cost;
  const go = useStore((s) => s.go);
  const newMatch = useStore((s) => s.newMatch);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [bot, setBot] = useState<BotKind>('normal');
  const [problem, setProblem] = useState<{ message: string; problems: string[] } | null>(null);
  const [arcade, setArcade] = useState<ArcadeStatus | null>(null);

  useEffect(() => {
    let live = true;
    api.arcade().then(
      (a) => live && setArcade(a),
      () => live && setArcade(null),
    );
    return () => {
      live = false;
    };
  }, []);

  const teamChars = team.map((id) => characters.find((c) => c.id === id)).filter((c) => c !== undefined);

  const practice = async () => {
    setProblem(null);
    try {
      // The server issues the match (seed and teams) and verifies the result, so practice can pay out.
      // Who moves first is the server's coin flip.
      const r = await api.startPractice(bot);
      newMatch(content, r.config, { kind: 'vsBot', bot, human: 0, practice: { attemptId: r.attemptId } }, 'home');
    } catch (e) {
      setProblem(e instanceof ApiError ? { message: e.message, problems: e.problems } : { message: String(e), problems: [] });
    }
  };

  const playArcade = async () => {
    setProblem(null);
    try {
      // The server issues the run's next stage (or the one left unfinished) and verifies the result.
      const r = await api.startArcade();
      newMatch(content, r.config, arcadeMode(r), 'home');
    } catch (e) {
      setProblem(e instanceof ApiError ? { message: e.message, problems: e.problems } : { message: String(e), problems: [] });
    }
  };

  const togglePick = (id: string) => {
    if (!picking) return;
    if (picking.includes(id)) setPicking(picking.filter((x) => x !== id));
    else if (picking.length < 3) setPicking([...picking, id]);
  };

  return (
    <div className="meta-page wide">
      <div className="meta-header">
        <Brand />
        <div className="account-chip">
          <span className="wallet" aria-label={t('home.wallet')}>
            {Object.entries(content.economy.currencies).map(([id, c]) => (
              <span key={id} className="currency">
                <b>{wallet[id] ?? 0}</b> {c.name}
              </span>
            ))}
          </span>
          <span>{user?.displayName}</span>
          <button type="button" className="btn small" onClick={() => go('settings')}>
            {t('nav.settings')}
          </button>
          <button type="button" className="btn small" onClick={() => void signOut()}>
            {t('nav.signOut')}
          </button>
        </div>
      </div>

      {contentMismatch && (
        <p className="notice warn" role="status">
          {t('home.contentMismatch', { server: contentMismatch.slice(0, 8), client: content.version.slice(0, 8) })}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <button type="button" className="btn small" onClick={clearError}>
            {t('common.ok')}
          </button>
        </p>
      )}

      <section className="panel play-panel" aria-label={t('home.play')}>
        <div className="team-strip" aria-label={t('home.activeTeam')}>
          <span className="panel-title">{t('home.activeTeam')}</span>
          <div className="team-slots">
            {[0, 1, 2].map((i) => {
              const c = teamChars[i];
              return c ? (
                <button type="button" key={c.id} className="team-slot" onClick={() => go('character', c.id)}>
                  <Portrait c={c} size={44} />
                  <span>{c.name}</span>
                </button>
              ) : (
                <div key={i} className="team-slot empty">
                  {characters.length < 3 ? t('home.recruitSlot') : t('home.emptySlot')}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn small" onClick={() => setPicking(picking ? null : [])}>
            {picking ? t('common.cancel') : t('home.changeTeam')}
          </button>
        </div>
        <div className="play-controls">
          <div className="control">
            <label htmlFor="home-bot">{t('home.bot')}</label>
            <select id="home-bot" value={bot} onChange={(e) => setBot(e.target.value as BotKind)}>
              <option value="easy">{t('bot.easy')}</option>
              <option value="normal">{t('bot.normal')}</option>
              <option value="hard">{t('bot.hard')}</option>
            </select>
          </div>
          <button type="button" className="btn" onClick={() => go('tutorial')} disabled={busy}>
            {t('nav.tutorial')}
          </button>
          <button type="button" className="btn primary" onClick={() => go('story')} disabled={busy}>
            {t('nav.story')}
          </button>
          <button type="button" className="btn primary" onClick={() => void practice()} disabled={teamChars.length !== 3 || busy}>
            {t('home.practice')}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void playArcade()}
            disabled={teamChars.length !== 3 || busy}
            title={arcade ? t('home.arcadeTitle', { best: arcade.best, drops: arcade.dropsToday, cap: arcade.dailyDropCap }) : undefined}
          >
            {arcade ? t('home.arcadeStage', { stage: arcade.stage, stages: arcade.stages }) : t('home.arcade')}
          </button>
          <button type="button" className="btn" onClick={() => go('sandbox')}>
            {t('nav.sandbox')}
          </button>
        </div>
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
      </section>

      <OnlinePanel teamReady={teamChars.length === 3} />

      <section aria-label={t('home.roster')}>
        <div className="section-head">
          <h2>
            {t('home.roster')} <span className="muted">{characters.length}/{maxRoster}</span>
          </h2>
          {picking ? (
            <>
              <span className="muted">{t('home.pickTeam', { count: picking.length })}</span>
              <button
                type="button"
                className="btn primary"
                disabled={picking.length !== 3 || busy}
                onClick={() => void setTeam(picking).then(() => setPicking(null))}
              >
                {t('home.saveTeam')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={busy || characters.length >= maxRoster || !canAfford(wallet, rollCost)}
              onClick={() => void roll()}
            >
              {t('home.roll', { cost: formatAmounts(content, rollCost) })}
            </button>
          )}
        </div>
        <div className="roster-grid">
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              c={c}
              selected={picking ? picking.includes(c.id) : team.includes(c.id)}
              {...(() => {
                const i = (picking ?? team).indexOf(c.id);
                return i >= 0 ? { order: i + 1 } : {};
              })()}
              onOpen={() => (picking ? togglePick(c.id) : go('character', c.id))}
            />
          ))}
        </div>
      </section>

      <InventoryPanel />
    </div>
  );
}
