// The admin tool (docs/deploy.md §Admin): player counts, who's online, a searchable player list, and
// each player's account (characters and loadouts, level, wallet, inventory, team, ratings, progress,
// recent matches). The server only answers accounts listed in ADMIN_EMAILS.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pieceDisplayName } from '@arena/engine';
import { formatAmounts } from '@arena/meta';
import { api, ApiError, type AdminOverview, type AdminPlayer, type AdminPlayerRow } from '../api.js';
import { content } from '../content.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';
import { Portrait, SkillChips } from './Roster.js';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

/** "3 min ago", "2 h ago", "4 d ago". */
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

export function Admin() {
  const go = useStore((s) => s.go);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [list, setList] = useState<{ total: number; pageSize: number; players: AdminPlayerRow[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : String(e));

  // The counts and the online list refresh every 15 seconds.
  const loadOverview = useCallback(() => api.adminOverview().then(setOverview, fail), []);
  useEffect(() => {
    void loadOverview();
    const timer = window.setInterval(() => void loadOverview(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => {
      api.adminPlayers(query.trim(), page).then((r) => live && setList(r), fail);
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [query, page]);

  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="meta-page wide admin">
      <div className="meta-header">
        <Brand note="Admin" />
        <div className="account-chip">
          <button type="button" className="btn small" onClick={() => void loadOverview()}>
            Refresh
          </button>
          <button type="button" className="btn small" onClick={() => go('home')}>
            Home
          </button>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <section aria-label="Overview">
        <div className="admin-stats">
          <Stat label="Registered" value={overview?.registered} />
          <Stat label="Online now" value={overview?.online.length} accent />
          <Stat label="In a match" value={overview?.inMatch} />
          <Stat label="Active, 15 min" value={overview?.activeNow} />
          <Stat label="Active today" value={overview?.activeToday} />
          <Stat label="New today" value={overview?.newToday} />
          <Stat label="New this week" value={overview?.newThisWeek} />
          <Stat label="Matches today" value={overview?.matchesToday} />
        </div>
        <div className="panel admin-online">
          <span className="panel-title">Online now</span>
          {!overview ? (
            <span className="muted">Loading…</span>
          ) : overview.online.length === 0 ? (
            <span className="muted">Nobody is connected.</span>
          ) : (
            <div className="admin-chips">
              {overview.online.map((u) => (
                <button key={u.id} type="button" className="admin-chip" onClick={() => setOpenId(u.id)}>
                  <span className="conn-dot ready" aria-hidden />
                  {u.name}
                  {u.inMatch && <span className="muted"> · in a match</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-label="Players" className="admin-players">
        <div className="section-head">
          <h2>
            Players <span className="muted">{list?.total ?? ''}</span>
          </h2>
          <input
            type="search"
            aria-label="Search players by name or email"
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Email</th>
                <th>Level</th>
                <th>Gold</th>
                <th>Characters</th>
                <th>Joined</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {list?.players.map((p) => (
                <tr key={p.id} className={openId === p.id ? 'open' : ''} onClick={() => setOpenId(p.id)}>
                  <td>
                    <button type="button" className="admin-link" onClick={() => setOpenId(p.id)}>
                      {p.online && <span className="conn-dot ready" title="Online" aria-label="Online" />} {p.displayName}
                    </button>
                  </td>
                  <td className="muted">{p.email}</td>
                  <td>{p.level}</td>
                  <td>{p.gold ?? '—'}</td>
                  <td>{p.characters}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>{p.online ? 'online' : ago(p.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list && list.players.length === 0 && <p className="muted">No players match.</p>}
        {pages > 1 && (
          <div className="admin-pager">
            <button type="button" className="btn small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span className="muted">
              Page {page + 1} of {pages}
            </span>
            <button type="button" className="btn small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </section>

      {openId && <PlayerDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | undefined; accent?: boolean }) {
  return (
    <div className={`admin-stat${accent ? ' accent' : ''}`}>
      <b>{value ?? '…'}</b>
      <span>{label}</span>
    </div>
  );
}

/** One player's account, in a panel over the page. */
function PlayerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<AdminPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setP(null);
    setError(null);
    api.adminPlayer(id).then(
      (r) => live && setP(r),
      (e: unknown) => live && setError(e instanceof ApiError ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // The inventory grouped by piece: how many, and who wears copies.
  const inventory = useMemo(() => {
    if (!p) return [];
    const names = new Map(p.characters.map((c) => [c.id, c.name]));
    const by = new Map<string, { name: string; count: number; worn: string[] }>();
    for (const i of p.inventory) {
      const e = by.get(i.itemId) ?? { name: pieceDisplayName(content, i.itemId), count: 0, worn: [] };
      e.count++;
      if (i.equippedOn) e.worn.push(names.get(i.equippedOn) ?? '?');
      by.set(i.itemId, e);
    }
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [p]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Player details" onClick={onClose}>
      <div className="dialog admin-detail" onClick={(e) => e.stopPropagation()}>
        <div className="admin-detail-head">
          <h2>{p?.account.displayName ?? 'Player'}</h2>
          <button type="button" className="btn small" autoFocus onClick={onClose}>
            Close
          </button>
        </div>
        {error && <p className="notice error">{error}</p>}
        {!p && !error && <p className="muted">Loading…</p>}
        {p && (
          <>
            <dl className="admin-facts">
              <dt>Email</dt>
              <dd>{p.account.email}</dd>
              <dt>Status</dt>
              <dd>{p.account.inMatch ? 'online, in a match' : p.account.online ? 'online' : `last active ${ago(p.account.lastSeenAt)}`}</dd>
              <dt>Joined</dt>
              <dd>{when(p.account.createdAt)}</dd>
              <dt>Level</dt>
              <dd>
                {p.progress.level} · {p.progress.xp}/{p.progress.needed} XP · {p.progress.total} total · {p.progress.unopenedBoxes} unopened box
                {p.progress.unopenedBoxes === 1 ? '' : 'es'}
              </dd>
              <dt>Wallet</dt>
              <dd>{formatAmounts(content, p.wallet)}</dd>
              <dt>Ranked</dt>
              <dd>
                {p.ranked
                  ? `${p.ranked.season}: ${p.ranked.display} (${p.ranked.tier ?? 'placement'}) · ${p.ranked.wins}/${p.ranked.games} wins`
                  : 'no ranked games this season'}
              </dd>
              <dt>Casual</dt>
              <dd>
                {p.casual.wins}/{p.casual.games} wins
              </dd>
              <dt>Story</dt>
              <dd>
                {p.story.cleared} encounters cleared · {p.story.chapters.length} chapters complete
              </dd>
              <dt>Arcade</dt>
              <dd>best stage {p.arcadeBest}</dd>
              <dt>Achievements</dt>
              <dd>{p.achievements.length ? p.achievements.map((a) => content.achievements[a]?.name ?? a).join(', ') : 'none'}</dd>
              <dt>Guides</dt>
              <dd>{p.guides.length ? p.guides.join(', ') : 'none'}</dd>
            </dl>

            <h3>
              Characters <span className="muted">{p.characters.length}</span>
            </h3>
            <div className="admin-chars">
              {p.characters.map((c) => {
                const slot = p.team.indexOf(c.id);
                return (
                  <div key={c.id} className={`admin-char${slot >= 0 ? ' in-team' : ''}`}>
                    <div className="admin-char-head">
                      <Portrait c={c} size={44} />
                      <div>
                        <b>{c.name}</b>
                        <div className="muted">
                          {c.element} {content.classes[c.classId]?.name ?? c.classId}
                          {slot >= 0 && ` · team slot ${slot + 1}`}
                        </div>
                      </div>
                    </div>
                    <SkillChips skills={c.resolved.skills} />
                    <div className="admin-char-line">
                      <b>Equipped:</b>{' '}
                      {c.resolved.items.length ? c.resolved.items.map((it) => pieceDisplayName(content, it)).join(', ') : 'nothing'}
                    </div>
                    {c.resolved.unprepared.length > 0 && (
                      <div className="admin-char-line muted">
                        Not prepared: {c.resolved.unprepared.map((s) => content.skills[s]?.name ?? s).join(', ')}
                      </div>
                    )}
                    {Object.keys(c.resolved.unassigned).length > 0 && (
                      <div className="admin-char-line muted">
                        Unplaced infusions:{' '}
                        {Object.entries(c.resolved.unassigned)
                          .map(([el, n]) => `${n} ${el}`)
                          .join(', ')}
                      </div>
                    )}
                    {c.resolved.problems.length > 0 && <div className="admin-char-line fit-bad">{c.resolved.problems.join(' ')}</div>}
                  </div>
                );
              })}
            </div>

            <h3>
              Inventory <span className="muted">{p.inventory.length} pieces</span>
            </h3>
            {inventory.length === 0 ? (
              <p className="muted">Empty.</p>
            ) : (
              <ul className="admin-inventory">
                {inventory.map((e) => (
                  <li key={e.name}>
                    <b>{e.name}</b>
                    {e.count > 1 && ` ×${e.count}`}
                    {e.worn.length > 0 && <span className="muted"> · on {e.worn.join(', ')}</span>}
                  </li>
                ))}
              </ul>
            )}

            <h3>Recent matches</h3>
            {p.recentMatches.length === 0 ? (
              <p className="muted">No online matches.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Kind</th>
                      <th>Opponent</th>
                      <th>Result</th>
                      <th>Turns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.recentMatches.map((m) => (
                      <tr key={m.id}>
                        <td>{when(m.startedAt)}</td>
                        <td>{m.kind}</td>
                        <td>{m.opponent}</td>
                        <td>{m.outcome ?? m.status}{m.endReason ? ` (${m.endReason})` : ''}</td>
                        <td>{m.turns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
