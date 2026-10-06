// Home: the header (wallet, account), the experience bar, and three tabs. Main: the active team, the
// leaderboards, and every way to play, each explained. Roster: recruiting, opening characters and picking
// the team. Forge: the inventory, forging, splitting, selling and trading in.

import { useEffect, useState } from 'react';
import { canAfford, formatAmounts } from '@arena/meta';
import { api, ApiError, type ArcadeStatus } from '../api.js';
import { content } from '../content.js';
import type { BotKind } from '../match/LocalMatch.js';
import { useT } from '../i18n/index.js';
import { useMeta } from '../meta.js';
import { arcadeMode, useStore, type HomeTab } from '../store.js';
import { Brand } from './Account.js';
import { InventoryPanel } from './Inventory.js';
import { Leaderboards } from './Leaderboards.js';
import { OnlinePanel } from './OnlinePanel.js';
import { XpBar } from './Progress.js';
import { CharacterCard, Portrait } from './Roster.js';

export function Home() {
  const t = useT();
  const { user, characters, maxRoster, team, wallet, busy, error, roll, setTeam, signOut, contentMismatch, clearError } = useMeta();
  const rollCost = content.economy.roll.cost;
  const go = useStore((s) => s.go);
  const newMatch = useStore((s) => s.newMatch);
  const tab = useStore((s) => s.homeTab);
  const setTab = useStore((s) => s.setHomeTab);
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
  const teamReady = teamChars.length === 3;

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

  const eco = content.economy;
  const gold = (n: number | undefined) => formatAmounts(content, { gold: n ?? 0 });
  const storyChapters = Object.values(content.chapters).filter((c) => !c.tutorial).length;
  const tabs: { id: HomeTab; label: string }[] = [
    { id: 'main', label: t('home.tab.main') },
    { id: 'roster', label: t('home.tab.roster') },
    { id: 'forge', label: t('home.tab.forge') },
  ];

  return (
    <div className="meta-page wide">
      <div className="meta-header">
        <Brand />
        <div className="account-chip">
          <span className="wallet" aria-label={t('home.wallet')} data-guide="wallet">
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

      <XpBar />

      <div className="home-tabs" role="tablist" aria-label={t('home.tabs')}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`home-tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`home-panel-${x.id}`}
            className={`home-tab${tab === x.id ? ' active' : ''}`}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'main' && (
        <div className="home-panel" role="tabpanel" id="home-panel-main" aria-labelledby="home-tab-main">
          <div className="home-top">
            <section className="panel active-team" aria-label={t('home.activeTeam')}>
              <div className="section-head">
                <span className="panel-title">{t('home.activeTeam')}</span>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn small" onClick={() => setTab('roster')}>
                  {t('home.editTeam')}
                </button>
              </div>
              {teamChars.length === 0 ? (
                <p className="muted">{t('home.noTeam')}</p>
              ) : (
                <div className="active-team-row">
                  {[0, 1, 2].map((i) => {
                    const c = teamChars[i];
                    return c ? (
                      <button type="button" key={c.id} className="active-member" onClick={() => go('character', c.id)}>
                        <Portrait c={c} size={84} />
                        <b>{c.name}</b>
                        <span className="muted">
                          {c.element} {content.classes[c.classId]?.name ?? c.classId}
                        </span>
                      </button>
                    ) : (
                      <div key={i} className="active-member empty">
                        {t('home.emptySlot')}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <Leaderboards />
          </div>

          <h2 className="home-heading">{t('home.modes')}</h2>
          <div className="mode-grid">
            <section className="panel mode-card" aria-label={t('home.mode.practice.title')}>
              <h3>{t('home.mode.practice.title')}</h3>
              <p className="muted">
                {t('home.mode.practice.text', {
                  win: gold(eco.rewards.practice?.win.currency?.gold),
                  chance: Math.round((eco.rewards.practice?.win.drops?.chance ?? 1) * 100),
                  loss: gold(eco.rewards.practice?.loss.currency?.gold),
                })}
              </p>
              <div className="mode-actions">
                <select aria-label={t('home.bot')} value={bot} onChange={(e) => setBot(e.target.value as BotKind)}>
                  <option value="easy">{t('bot.easy')}</option>
                  <option value="normal">{t('bot.normal')}</option>
                  <option value="hard">{t('bot.hard')}</option>
                </select>
                <button type="button" className="btn primary" onClick={() => void practice()} disabled={!teamReady || busy}>
                  {t('home.practice')}
                </button>
              </div>
            </section>
            <section className="panel mode-card" aria-label={t('home.mode.arcade.title')}>
              <h3>{t('home.mode.arcade.title')}</h3>
              <p className="muted">{t('home.mode.arcade.text', { stages: eco.arcade?.stages.length ?? 0, cap: eco.arcade?.dailyDropCap ?? 0 })}</p>
              <div className="mode-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void playArcade()}
                  disabled={!teamReady || busy}
                  title={arcade ? t('home.arcadeTitle', { best: arcade.best, drops: arcade.dropsToday, cap: arcade.dailyDropCap }) : undefined}
                >
                  {arcade ? t('home.arcadeStage', { stage: arcade.stage, stages: arcade.stages }) : t('home.arcade')}
                </button>
              </div>
            </section>
            <section className="panel mode-card" aria-label={t('home.mode.story.title')}>
              <h3>{t('home.mode.story.title')}</h3>
              <p className="muted">{t('home.mode.story.text', { count: storyChapters })}</p>
              <div className="mode-actions">
                <button type="button" className="btn primary" onClick={() => go('story')} disabled={busy}>
                  {t('nav.story')}
                </button>
              </div>
            </section>
            <section className="panel mode-card" aria-label={t('home.mode.tutorial.title')}>
              <h3>{t('home.mode.tutorial.title')}</h3>
              <p className="muted">{t('home.mode.tutorial.text')}</p>
              <div className="mode-actions">
                <button type="button" className="btn" onClick={() => go('tutorial')} disabled={busy}>
                  {t('nav.tutorial')}
                </button>
                <button type="button" className="btn" onClick={() => go('sandbox')}>
                  {t('nav.sandbox')}
                </button>
              </div>
            </section>
          </div>
          {!teamReady && <p className="muted">{t('home.needTeam')}</p>}
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

          <h2 className="home-heading">{t('home.queues')}</h2>
          <div className="queue-notes">
            <p>
              <b>{t('home.queue.casualName')}</b>{' '}
              {t('home.queue.casual', { win: gold(eco.rewards.casual?.win.currency?.gold), loss: gold(eco.rewards.casual?.loss.currency?.gold) })}
            </p>
            <p>
              <b>{t('home.queue.rankedName')}</b> {t('home.queue.ranked', { win: gold(eco.rewards.ranked?.win.currency?.gold) })}
            </p>
            <p>
              <b>{t('home.queue.privateName')}</b> {t('home.queue.private')}
            </p>
          </div>
          <OnlinePanel teamReady={teamReady} />
        </div>
      )}

      {tab === 'roster' && (
        <div className="home-panel" role="tabpanel" id="home-panel-roster" aria-labelledby="home-tab-roster">
          <section className="panel play-panel" aria-label={t('home.activeTeam')}>
            <div className="team-strip" data-guide="team">
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
          </section>

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
                  data-guide="recruit"
                  disabled={busy || characters.length >= maxRoster || !canAfford(wallet, rollCost)}
                  onClick={() => void roll()}
                >
                  {t('home.roll', { cost: formatAmounts(content, rollCost) })}
                </button>
              )}
            </div>
            <p className="muted">{t('home.rosterHint')}</p>
            <div className="roster-grid" data-guide="roster">
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
        </div>
      )}

      {tab === 'forge' && (
        <div className="home-panel" role="tabpanel" id="home-panel-forge" aria-labelledby="home-tab-forge">
          <InventoryPanel />
        </div>
      )}
    </div>
  );
}
