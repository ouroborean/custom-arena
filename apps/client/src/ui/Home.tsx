// Home: active team, practice vs bot, roster (roll, open, pick a team), wallet and inventory.

import { useState } from 'react';
import { randomConfig } from '@arena/ai';
import type { MatchConfig } from '@arena/engine';
import { canAfford, formatAmounts } from '@arena/meta';
import { api, ApiError } from '../api.js';
import { content } from '../content.js';
import type { BotKind } from '../match/LocalMatch.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';
import { InventoryPanel } from './Inventory.js';
import { OnlinePanel } from './OnlinePanel.js';
import { CharacterCard, Portrait } from './Roster.js';

export function Home() {
  const { user, characters, maxRoster, team, wallet, busy, error, roll, setTeam, signOut, contentMismatch, clearError } = useMeta();
  const rollCost = content.economy.roll.cost;
  const go = useStore((s) => s.go);
  const newMatch = useStore((s) => s.newMatch);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [bot, setBot] = useState<BotKind>('normal');
  const [human, setHuman] = useState<0 | 1>(0);
  const [problem, setProblem] = useState<{ message: string; problems: string[] } | null>(null);

  const teamChars = team.map((id) => characters.find((c) => c.id === id)).filter((c) => c !== undefined);

  const practice = async () => {
    setProblem(null);
    try {
      const { specs } = await api.teamSpecs();
      const seed = Math.floor(Math.random() * 1_000_000);
      const bots = randomConfig(content, seed).teams[1].map((c, i) => ({ ...c, name: `Bot ${content.classes[c.classId!]!.name} ${i + 1}` }));
      const teams = (human === 0 ? [specs, bots] : [bots, specs]) as MatchConfig['teams'];
      newMatch(content, { seed, teams }, { kind: 'vsBot', bot, human }, 'home');
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
          <span className="wallet" aria-label="Wallet">
            {Object.entries(content.economy.currencies).map(([id, c]) => (
              <span key={id} className="currency">
                <b>{wallet[id] ?? 0}</b> {c.name}
              </span>
            ))}
          </span>
          <span>{user?.displayName}</span>
          <button type="button" className="btn small" onClick={() => go('settings')}>
            Settings
          </button>
          <button type="button" className="btn small" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {contentMismatch && (
        <p className="notice warn" role="status">
          The server runs content {contentMismatch.slice(0, 8)} but this client has {content.version.slice(0, 8)}. Restart both from the same
          checkout.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <button type="button" className="btn small" onClick={clearError}>
            OK
          </button>
        </p>
      )}

      <section className="panel play-panel" aria-label="Play">
        <div className="team-strip" aria-label="Active team">
          <span className="panel-title">Active team</span>
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
                  Empty
                </div>
              );
            })}
          </div>
          <button type="button" className="btn small" onClick={() => setPicking(picking ? null : [])}>
            {picking ? 'Cancel' : 'Change team'}
          </button>
        </div>
        <div className="play-controls">
          <div className="control">
            <label htmlFor="home-bot">Bot</label>
            <select id="home-bot" value={bot} onChange={(e) => setBot(e.target.value as BotKind)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="control">
            <span className="label">You play</span>
            <div className="segmented" role="group" aria-label="Turn order">
              <button type="button" aria-pressed={human === 0} onClick={() => setHuman(0)}>
                First
              </button>
              <button type="button" aria-pressed={human === 1} onClick={() => setHuman(1)}>
                Second
              </button>
            </div>
          </div>
          <button type="button" className="btn" onClick={() => go('tutorial')} disabled={busy}>
            Tutorial
          </button>
          <button type="button" className="btn primary" onClick={() => go('story')} disabled={busy}>
            Story
          </button>
          <button type="button" className="btn primary" onClick={() => void practice()} disabled={teamChars.length !== 3 || busy}>
            Practice vs bot
          </button>
          <button type="button" className="btn" onClick={() => go('sandbox')}>
            Sandbox
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

      <section aria-label="Roster">
        <div className="section-head">
          <h2>
            Roster <span className="muted">{characters.length}/{maxRoster}</span>
          </h2>
          {picking ? (
            <>
              <span className="muted">Pick 3 characters, in battle order ({picking.length}/3)</span>
              <button
                type="button"
                className="btn primary"
                disabled={picking.length !== 3 || busy}
                onClick={() => void setTeam(picking).then(() => setPicking(null))}
              >
                Save team
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={busy || characters.length >= maxRoster || !canAfford(wallet, rollCost)}
              onClick={() => void roll()}
            >
              Roll a character ({formatAmounts(content, rollCost)})
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
