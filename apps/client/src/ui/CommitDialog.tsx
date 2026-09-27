import { useEffect, useMemo, useRef, useState } from 'react';
import {
  autoAllocate,
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
  const [alloc, setAlloc] = useState<Energy>(() => autoAllocate(pool, reserved));
  const valid = isValidAllocation(pool, reserved, alloc);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
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
            <h3>
              Pay random costs ({assigned}/{reserved.r})
            </h3>
            <div className="alloc">
              {COLORS.map((c) => {
                const spare = pool[c] - reserved[c];
                return (
                  <div className="alloc-cell" key={c}>
                    <EnergyPip color={c} size={16} />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {COLOR_NAMES[c]} · {spare} spare
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
