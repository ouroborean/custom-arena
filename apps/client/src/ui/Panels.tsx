import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  COLORS,
  effectDefinition,
  effectName,
  sumCosts,
  type ContentBundle,
  type PlayerId,
  type PlayerView,
  type SkillAvailability,
} from '@arena/engine';
import { serverNow } from '../match/online.js';
import type { MatchSession, OnlineInfo } from '../match/session.js';
import { useStore } from '../store.js';
import { CATEGORY_LABEL, CostPips, describeAction, durationText, elementClass, ENERGY_NAMES, EnergyPip, skillCategory } from './common.js';

const TARGET_TEXT: Record<string, string> = {
  self: 'Self',
  enemy: 'One enemy',
  ally: 'One ally',
  any: 'Any unit',
  allEnemies: 'All enemies',
  allAllies: 'All allies',
  none: 'No target',
};

// ---------------------------------------------------------------- hover card

export function HoverCard({ view, content, availability }: { view: PlayerView; content: ContentBundle; availability: SkillAvailability[] }) {
  const inspect = useStore((s) => s.inspect);
  const anchor = useStore((s) => s.anchor);
  const setInspect = useStore((s) => s.setInspect);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Place the card above the hovered element (or below if there's no room), inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return setPos(null);
    const { width, height } = el.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    let top = anchor.top - height - gap;
    if (top < margin) top = anchor.top + anchor.height + gap;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    let left = anchor.left + anchor.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    setPos({ left, top });
  }, [anchor, inspect]);

  // A fixed card would drift from its element on scroll or resize, so close it instead.
  useEffect(() => {
    if (!anchor) return;
    const close = () => setInspect(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor, setInspect]);

  let body: React.ReactNode = null;

  if (inspect?.kind === 'skill') {
    const u = view.units.find((x) => x.id === inspect.unit);
    const slot = u?.skills[inspect.slot];
    const def = slot ? content.skills[slot.defId] : undefined;
    const a = availability.find((x) => x.actor === inspect.unit && x.slot === inspect.slot);
    if (u && slot && def) {
      const cat = skillCategory(def);
      body = (
        <>
          <h4>{def.name}</h4>
          <div className="meta">
            <CostPips cost={a?.cost ?? def.cost} large />
            <span>CD {def.cooldown}</span>
            <span>{TARGET_TEXT[def.target]}</span>
            <span className={`tag-pill cat-${cat}`}>{CATEGORY_LABEL[cat]}</span>
            {def.element !== 'None' && <span className={`tag-pill ${elementClass(def.element)}`}>{def.element}</span>}
            {def.tags
              .filter((t) => !['Harmful', 'Helpful', 'Strategic', 'NonStrategic'].includes(t))
              .map((t) => (
                <span key={t} className="tag-pill">
                  {t}
                </span>
              ))}
          </div>
          <div className="desc">{def.description}</div>
          {slot.cooldown > 0 && <div className="warn">On cooldown: {slot.cooldown} more of your turns</div>}
          {a && a.targets.length === 0 && a.reason && slot.cooldown === 0 && <div className="warn">{a.reason}</div>}
        </>
      );
    }
  } else if (inspect?.kind === 'effect') {
    const e = view.effects.find((x) => x.id === inspect.effect);
    if (e) {
      const def = effectDefinition(content, e);
      const source = view.units.find((u) => u.id === e.source)?.name ?? '—';
      const bearer = view.units.find((u) => u.id === e.bearer)?.name ?? '—';
      body = (
        <>
          <h4>
            {effectName(content, e.defId)}
            {e.stacks > 1 ? ` ×${e.stacks}` : ''}
          </h4>
          <div className="meta">
            <span className={`tag-pill ${def?.kind === 'Buff' ? 'cat-support' : def?.kind === 'Debuff' ? 'cat-attack' : ''}`}>{def?.kind}</span>
            <span>
              On {bearer} · from {source}
            </span>
            {e.value > 0 && <span>Value {e.value}</span>}
          </div>
          <div className="desc">{def?.description}</div>
          <div className="meta">{durationText(e.duration)}</div>
          {def?.visibility === 'hidden' && !e.revealed && <div className="hint">Hidden from your opponent</div>}
        </>
      );
    }
  } else if (inspect?.kind === 'unit') {
    const u = view.units.find((x) => x.id === inspect.unit);
    if (u) {
      const cls = u.kind === 'character' ? content.classes[u.defId]?.name : 'Minion';
      const effects = view.effects.filter((e) => e.bearer === u.id);
      body = (
        <>
          <h4>{u.name}</h4>
          <div className="meta">
            <span>{cls}</span>
            <span>
              {u.hp} / {u.maxHp} HP
            </span>
          </div>
          <div className="list">
            {u.skills.map((s, i) => {
              const d = content.skills[s.defId]!;
              return (
                <div key={i}>
                  <b>{d.name}</b> <CostPips cost={d.cost} />
                  {s.cooldown > 0 && <span className="hint"> · CD {s.cooldown}</span>}
                  <span className="muted"> — {d.description}</span>
                </div>
              );
            })}
          </div>
          {effects.length > 0 && (
            <div className="meta" style={{ marginTop: 8 }}>
              Effects:{' '}
              {effects.map((e) => (
                <span key={e.id} className="tag-pill">
                  {effectName(content, e.defId)}
                  {e.stacks > 1 ? ` ×${e.stacks}` : ''}
                  {e.duration !== null ? ` [${e.duration}]` : ''}
                </span>
              ))}
            </div>
          )}
        </>
      );
    }
  }

  if (!body || !anchor) return null;
  return (
    <div
      ref={ref}
      className="hovercard inspector"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0, visibility: 'hidden' }}
    >
      {body}
    </div>
  );
}

/** Floating instruction while choosing a target; overlays the board instead of taking space. */
export function TargetHint({ view, content }: { view: PlayerView; content: ContentBundle }) {
  const targeting = useStore((s) => s.targeting);
  if (!targeting) return null;
  const u = view.units.find((x) => x.id === targeting.actor);
  const def = u ? content.skills[u.skills[targeting.slot]!.defId] : undefined;
  return (
    <div className="target-hint" role="status">
      <b>{def?.name}</b> Choose a highlighted target · Esc to cancel
    </div>
  );
}

// ---------------------------------------------------------------- queue tray

export function QueueTray({ view, viewer, content }: { view: PlayerView; viewer: PlayerId; content: ContentBundle }) {
  const reorderQueue = useStore((s) => s.reorderQueue);
  const unqueue = useStore((s) => s.unqueue);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const queue = view.players[viewer].queue ?? [];
  const reserved = sumCosts(queue.map((q) => q.cost));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const order = queue.map((_, i) => i);
    const [x] = order.splice(from, 1);
    order.splice(to, 0, x!);
    reorderQueue(order);
  };

  return (
    <section className="panel" aria-label="Queued skills" data-coach="queue">
      <div className="panel-title">
        <span>Queue · resolves left to right</span>
        {queue.length > 0 && <CostPips cost={reserved} />}
      </div>
      {queue.length === 0 ? (
        <div className="muted">No skills queued.</div>
      ) : (
        <ol className="tray" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {queue.map((q, i) => {
            const d = describeAction(q, view, content);
            return (
              <li
                key={q.actor}
                className={`tray-item${over === i && dragFrom !== null ? ' drag-over' : ''}`}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) move(dragFrom, i);
                  setDragFrom(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setOver(null);
                }}
              >
                <span className="ord">{i + 1}</span>
                <span className="what">
                  <b>{d.skill}</b>
                  <span>{d.line}</span>
                </span>
                <button type="button" className="icon-btn x" aria-label={`Move ${d.skill} earlier`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ←
                </button>
                <button type="button" className="icon-btn x" aria-label={`Remove ${d.skill}`} onClick={() => unqueue(i)}>
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- top bar

function Plate({ side, name, sub, active }: { side: 'left' | 'right'; name: string; sub: string; active: boolean }) {
  return (
    <div className={`plate ${side}`}>
      <div className="plate-main">
        {side === 'right' && <span className={`turn-flag${active ? ' on' : ''}`} aria-hidden />}
        <div className="plate-body">
          <span className="plate-name">{name}</span>
          <span className="plate-sub">{sub}</span>
        </div>
        {side === 'left' && <span className={`turn-flag${active ? ' on' : ''}`} aria-hidden />}
      </div>
    </div>
  );
}

/** Seconds left until an epoch-ms server deadline, re-rendering every 250 ms. */
function useCountdown(deadline: number | null): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Turn timer and opponent presence for online matches. */
function OnlineStatus({ info, mine }: { info: OnlineInfo; mine: boolean }) {
  const left = useCountdown(info.deadline);
  const forfeit = useCountdown(info.opponentConnected ? null : info.forfeitAt);
  return (
    <div className="online-status">
      {left !== null && (
        <span className={`turn-clock${left <= 10 ? ' urgent' : ''}`} title={mine ? 'Your turn ends' : "Opponent's turn ends"}>
          {mmss(left)}
        </span>
      )}
      {!info.opponentConnected && (
        <span className="presence-warn">Opponent disconnected{forfeit !== null ? ` · forfeits in ${mmss(forfeit)}` : ''}</span>
      )}
    </div>
  );
}

export function TopBar({ match, view, viewer, myTurn }: { match: MatchSession; view: PlayerView; viewer: PlayerId; myTurn: boolean }) {
  const openCommit = useStore((s) => s.openCommit);
  const commit = useStore((s) => s.commit);
  const playing = useStore((s) => s.pending.length > 0);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const surrender = useStore((s) => s.surrender);
  const toSetup = useStore((s) => s.toSetup);
  const toggleLog = useStore((s) => s.toggleLog);
  const other: PlayerId = viewer === 0 ? 1 : 0;
  const me = view.players[viewer];
  const energy = me.energy ?? { S: 0, A: 0, I: 0, W: 0 };
  const queue = me.queue ?? [];
  const reserved = sumCosts(queue.map((q) => q.cost));
  const total = COLORS.reduce((n, c) => n + energy[c], 0);
  const free = total - COLORS.reduce((n, c) => n + reserved[c], 0) - reserved.r;
  const mode = match.mode;
  const spectate = mode.kind === 'watch' || mode.kind === 'replay';
  const nameOf = (p: PlayerId) => {
    switch (mode.kind) {
      case 'vsBot':
        if (p === mode.human) return 'You';
        if (mode.story) return match.content.encounters[mode.story.encounter]?.name ?? 'Enemy';
        return `${{ easy: 'Easy', normal: 'Normal', hard: 'Hard' }[mode.bot]} Bot`;
      case 'watch':
        return `Bot ${p + 1}`;
      case 'online':
        return p === mode.you ? 'You' : mode.opponent;
      case 'replay':
        return p === mode.seat ? 'You' : mode.opponent;
      default:
        return `Player ${p + 1}`;
    }
  };
  const subOf = (p: PlayerId) => `${p === 0 ? 'Moves first' : 'Moves second'}${p === viewer ? '' : ' · energy hidden'}`;
  const activeSide = match.finished ? null : match.active;

  return (
    <header className="topbar">
      <Plate side="left" name={nameOf(viewer)} sub={subOf(viewer)} active={activeSide === viewer} />

      <div className="control-center">
        {!spectate && (
          <button
            type="button"
            className="end-turn-btn"
            data-coach="endTurn"
            disabled={!myTurn || playing}
            onClick={() => (queue.length === 0 ? commit({}) : openCommit())}
          >
            End Turn
          </button>
        )}
        {!spectate && (
          <div className="energy-panel" aria-label="Your energy" data-coach="energy">
            {COLORS.map((c) => (
              <span key={c} className="energy-cell" title={ENERGY_NAMES[c]}>
                <EnergyPip color={c} size={20} />
                {energy[c] - reserved[c]}
              </span>
            ))}
            <span className={`energy-cell promised${reserved.r > 0 ? '' : ' zero'}`} title="Random costs you've promised to pay">
              <EnergyPip color="r" size={20} title="Random" />
              {reserved.r}
            </span>
          </div>
        )}
        {!spectate && (
          <div className="energy-meta">
            <b>{free}</b> free of {total} · {reserved.r} random promised
          </div>
        )}
        {mode.kind === 'online' && !match.finished && <OnlineStatus info={match as MatchSession & OnlineInfo} mine={myTurn} />}
      </div>

      <div className="plate right">
        <Plate side="right" name={nameOf(other)} sub={subOf(other)} active={activeSide === other} />
        <div className="utility">
          <div className="segmented" role="group" aria-label="Playback speed">
            {([1, 2, 0] as const).map((v) => (
              <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>
                {v === 0 ? 'Instant' : `${v}×`}
              </button>
            ))}
          </div>
          <button type="button" className="btn small" data-coach="log" onClick={() => toggleLog()}>
            Log
          </button>
          {!match.finished && !spectate && (
            <button type="button" className="btn small danger" onClick={() => confirm('Surrender this match?') && surrender()}>
              Surrender
            </button>
          )}
          {(mode.kind !== 'online' || match.finished) && (
            <button type="button" className="btn small" onClick={toSetup}>
              Leave
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- stage (center)

export function Stage({ turn, status, tone }: { turn: number; status: string; tone: 'mine' | 'busy' | 'idle' }) {
  const lines = useStore((s) => s.logs[s.viewer]);
  const recent = lines.slice(-6);
  return (
    <div className="stage" aria-hidden>
      <div className="stage-turn">
        <small>Turn</small>
        {String(turn).padStart(2, '0')}
      </div>
      <div className={`stage-status ${tone === 'idle' ? '' : tone}`}>{status}</div>
      <div className="stage-feed">
        {recent.map((l) => (
          <div key={l.id} className={`k-${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- log drawer

export function LogDrawer() {
  const lines = useStore((s) => s.logs[s.viewer]);
  const open = useStore((s) => s.logOpen);
  const toggleLog = useStore((s) => s.toggleLog);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, open]);

  return (
    <aside className={`drawer${open ? ' open' : ''}`} aria-label="Battle log" aria-hidden={!open}>
      <div className="panel-title">
        <span>Battle log</span>
        <button type="button" className="btn small" onClick={() => toggleLog(false)}>
          Close
        </button>
      </div>
      <div className="log-lines" ref={ref}>
        {lines.map((l) => (
          <div key={l.id} className={`log-line k-${l.kind}`} title={l.detail}>
            {l.text}
          </div>
        ))}
      </div>
    </aside>
  );
}
