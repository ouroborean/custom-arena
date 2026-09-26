import { COLORS, sumCosts, type ContentBundle, type PlayerId, type PlayerView, type QueuedAction } from '@arena/engine';
import { useStore } from '../store.js';
import { CostPips } from './common.js';
import { ReorderList } from './ReorderList.js';

export function describeAction(q: QueuedAction, view: PlayerView, content: ContentBundle): string {
  const actor = view.units.find((u) => u.id === q.actor);
  const def = actor ? content.skills[actor.skills[q.slot]!.defId] : undefined;
  const target = q.targets[0] ? view.units.find((u) => u.id === q.targets[0])?.name : undefined;
  return `${actor?.name ?? q.actor}: ${def?.name ?? '?'}${target ? ` → ${target}` : ''}`;
}

export function Dock({ view, viewer, content, myTurn }: { view: PlayerView; viewer: PlayerId; content: ContentBundle; myTurn: boolean }) {
  const reorderQueue = useStore((s) => s.reorderQueue);
  const unqueue = useStore((s) => s.unqueue);
  const openCommit = useStore((s) => s.openCommit);
  const commit = useStore((s) => s.commit);
  const playing = useStore((s) => s.pending.length > 0);
  const targeting = useStore((s) => s.targeting);
  const me = view.players[viewer];
  const energy = me.energy ?? { S: 0, A: 0, I: 0, W: 0 };
  const queue = me.queue ?? [];
  const reserved = sumCosts(queue.map((q) => q.cost));
  const total = COLORS.reduce((n, c) => n + energy[c], 0);
  const free = total - COLORS.reduce((n, c) => n + reserved[c], 0) - reserved.r;

  const endTurn = () => {
    // Nothing to decide? End straight away; otherwise open the commit step.
    if (queue.length === 0) commit({});
    else openCommit();
  };

  return (
    <div className="dock">
      <section className="panel energy" aria-label="Energy">
        <div className="side-label">
          <span>Energy</span>
          <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {free} free of {total}
          </span>
        </div>
        <div className="energy-row">
          {COLORS.map((c) => (
            <div className="energy-cell" key={c} title={`${{ S: 'Strength', A: 'Agility', I: 'Intelligence', W: 'Wisdom' }[c]}`}>
              <span className={`pip ${c}`}>{c}</span>
              {energy[c] - reserved[c]}
              {reserved[c] > 0 && <span className="res">({reserved[c]} reserved)</span>}
            </div>
          ))}
          {reserved.r > 0 && (
            <div className="energy-cell" title="Random costs you have promised to pay">
              <span className="pip r" />
              {reserved.r} <span className="res">random promised</span>
            </div>
          )}
        </div>
      </section>

      <section className={`panel queue-panel${queue.length === 0 && !targeting ? ' empty' : ''}`} aria-label="Queued skills">
        <div className="side-label" style={{ marginBottom: 6 }}>
          <span>Queue</span>
          {queue.length > 0 && <CostPips cost={reserved} />}
        </div>
        {queue.length === 0 ? (
          <div className="muted" style={{ fontSize: 12.5 }}>
            {targeting ? 'Choose a highlighted target (Esc to cancel).' : myTurn ? 'Click a skill to queue it.' : 'Waiting…'}
          </div>
        ) : (
          <ReorderList
            items={queue.map((q, i) => ({ q, i }))}
            keyOf={(x) => x.q.actor}
            render={(x) => describeAction(x.q, view, content)}
            onChange={(next) => reorderQueue(next.map((x) => x.i))}
            onRemove={(i) => unqueue(i)}
          />
        )}
        {targeting && queue.length > 0 && <div className="hint" style={{ marginTop: 6 }}>Choose a highlighted target (Esc to cancel).</div>}
      </section>

      <section className="end-turn">
        <button type="button" className="btn primary" disabled={!myTurn || playing} onClick={endTurn}>
          End Turn
        </button>
      </section>
    </div>
  );
}
