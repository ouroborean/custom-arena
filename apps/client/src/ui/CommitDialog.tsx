import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COLORS,
  effectDefinition,
  effectName,
  isValidAllocation,
  sumCosts,
  type ContentBundle,
  type Energy,
  type PlayerId,
  type PlayerView,
} from '@arena/engine';
import { useStore } from '../store.js';
import { describeAction, EnergyPip } from './common.js';
import { ReorderList } from './ReorderList.js';

const COLOR_NAMES = { S: 'Strength', A: 'Agility', I: 'Intelligence', W: 'Wisdom' } as const;
/** Short labels, so the four cells are the same width. */
const COLOR_ABBR = { S: 'STR', A: 'AGI', I: 'INT', W: 'WIS' } as const;

export function CommitDialog({ view, viewer, content }: { view: PlayerView; viewer: PlayerId; content: ContentBundle }) {
  const commit = useStore((s) => s.commit);
  const close = useStore((s) => s.closeCommit);
  const me = view.players[viewer];
  const pool = me.energy ?? { S: 0, A: 0, I: 0, W: 0 };
  const queue = useMemo(() => (me.queue ?? []).map((q, i) => ({ q, i })), [me.queue]);
  const reserved = sumCosts(queue.map((x) => x.q.cost));
  const ticking = view.effects.filter(
    (e) => e.sourceOwner === viewer && (effectDefinition(content, e)?.triggers ?? []).some((t) => t.on === 'turnEnd'),
  );

  const [order, setOrder] = useState(queue);
  const [ticks, setTicks] = useState(ticking);
  // Random costs are always paid by hand: nothing is pre-filled, so players learn what "random" means.
  const [alloc, setAlloc] = useState<Energy>({ S: 0, A: 0, I: 0, W: 0 });
  const valid = isValidAllocation(pool, reserved, alloc);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const allocRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // With random costs to pay, start at the first + (the confirm button waits until they're paid).
    const firstMore = allocRef.current?.querySelector<HTMLButtonElement>('button[data-more]:not(:disabled)');
    (firstMore ?? confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const bump = (c: keyof Energy, d: number) => setAlloc((a) => ({ ...a, [c]: Math.max(0, a[c] + d) }));
  const assigned = COLORS.reduce((n, c) => n + alloc[c], 0);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="commit-title">
      <div className="dialog">
        <h2 id="commit-title">End turn</h2>

        <section>
          <h3>Resolution order</h3>
          <ReorderList items={order} keyOf={(x) => x.q.actor} render={(x) => {
              const d = describeAction(x.q, view, content);
              return `${d.skill} — ${d.line}`;
            }} onChange={setOrder} />
        </section>

        {ticks.length > 1 && (
          <section>
            <h3>Your ticking effects (end of turn)</h3>
            <ReorderList
              items={ticks}
              keyOf={(e) => e.id}
              render={(e) => `${effectName(content, e.defId)} on ${view.units.find((u) => u.id === e.bearer)?.name ?? e.bearer}`}
              onChange={setTicks}
            />
          </section>
        )}

        {reserved.r > 0 && (
          <section>
            <h3>Pay random costs</h3>
            <div className={`alloc-due${assigned >= reserved.r ? ' paid' : ''}`} aria-live="polite">
              <span className="alloc-due-num">
                {assigned}
                <span className="alloc-due-of">/{reserved.r}</span>
              </span>
              <span className="alloc-due-label">
                {assigned >= reserved.r ? 'Random costs paid' : `${reserved.r - assigned} random energy left to pay`}
              </span>
            </div>
            <p className="muted alloc-hint">Choose which spare energy pays for the random part of your skills' costs.</p>
            <div className="alloc" ref={allocRef}>
              {COLORS.map((c) => {
                const spare = pool[c] - reserved[c];
                return (
                  <div className={`alloc-cell${spare === 0 ? ' empty' : ''}`} key={c}>
                    <span className="alloc-color" title={COLOR_NAMES[c]}>
                      <EnergyPip color={c} size={18} title={COLOR_NAMES[c]} />
                      {COLOR_ABBR[c]}
                    </span>
                    <span className="alloc-spare" aria-label={`${spare - alloc[c]} ${COLOR_NAMES[c]} spare of ${pool[c]} in your pool`}>
                      <b>{spare - alloc[c]}</b>
                      <span className="muted">spare · {pool[c]} in pool</span>
                    </span>
                    <div className="stepper">
                      <button type="button" className="icon-btn" aria-label={`Less ${COLOR_NAMES[c]}`} disabled={alloc[c] <= 0} onClick={() => bump(c, -1)}>
                        −
                      </button>
                      {alloc[c]}
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`More ${COLOR_NAMES[c]}`}
                        data-more
                        disabled={alloc[c] >= spare || assigned >= reserved.r}
                        onClick={() => bump(c, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="actions">
          <button type="button" className="btn" onClick={close}>
            Back
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn primary"
            disabled={!valid}
            onClick={() =>
              commit({
                queueOrder: order.map((x) => x.i),
                tickOrder: ticks.map((e) => e.id),
                allocation: alloc,
              })
            }
          >
            Confirm &amp; resolve
          </button>
        </div>
      </div>
    </div>
  );
}
