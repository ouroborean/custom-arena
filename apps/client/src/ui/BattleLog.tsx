import { useEffect, useRef } from 'react';
import { useStore } from '../store.js';

export function BattleLog() {
  const lines = useStore((s) => s.logs[s.viewer]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <section className="panel log" aria-label="Battle log">
      <div className="side-label" style={{ marginBottom: 6 }}>
        <span>Battle log</span>
      </div>
      <div className="log-lines" ref={ref} aria-live="polite">
        {lines.map((l) => (
          <div key={l.id} className={`log-line k-${l.kind}`} title={l.detail}>
            {l.text}
          </div>
        ))}
      </div>
    </section>
  );
}
