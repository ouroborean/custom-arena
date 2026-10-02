// The energy exchange (once per turn: 2 of one color for 1 of another). A popup panel that floats over
// the battle below the energy bar, so nothing on screen moves when it opens.

import { useEffect, useRef, useState } from 'react';
import { checkExchange, COLORS, EXCHANGE, type Color, type PlayerId, type PlayerView } from '@arena/engine';
import { useStore } from '../store.js';
import { ENERGY_NAMES, EnergyPip } from './common.js';

export function ExchangePanel({ view, viewer, onClose }: { view: PlayerView; viewer: PlayerId; onClose: () => void }) {
  const exchange = useStore((s) => s.exchange);
  const me = view.players[viewer];
  const energy = me.energy ?? { S: 0, A: 0, I: 0, W: 0 };
  const [give, setGive] = useState<Color | null>(null);
  const [get, setGet] = useState<Color | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The engine's own check, against this view (it only reads the player's energy, queue and turn).
  const problem = (g: Color, t: Color) => checkExchange(view, viewer, g, t)?.message ?? null;
  const giveable = (c: Color) => COLORS.some((t) => t !== c && problem(c, t) === null);
  const why = give && get ? problem(give, get) : null;

  return (
    <div className="exchange-panel" role="dialog" aria-label="Exchange energy" ref={ref}>
      <div className="exchange-head">
        <b>Exchange energy</b>
        <span className="muted">
          Once per turn: {EXCHANGE.give} of one color for {EXCHANGE.get} of another.
        </span>
      </div>
      <div className="exchange-row" role="group" aria-label="Give">
        <span className="exchange-label">Give {EXCHANGE.give}</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="exchange-color"
            aria-pressed={give === c}
            aria-label={`Give ${EXCHANGE.give} ${ENERGY_NAMES[c]} (you have ${energy[c]})`}
            disabled={!giveable(c)}
            onClick={() => {
              setGive(c);
              if (get === c) setGet(null);
            }}
          >
            <EnergyPip color={c} size={18} />
            <span>{energy[c]}</span>
          </button>
        ))}
      </div>
      <div className="exchange-row" role="group" aria-label="Get">
        <span className="exchange-label">Get {EXCHANGE.get}</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="exchange-color"
            aria-pressed={get === c}
            aria-label={`Get ${EXCHANGE.get} ${ENERGY_NAMES[c]}`}
            disabled={c === give}
            onClick={() => setGet(c)}
          >
            <EnergyPip color={c} size={18} />
          </button>
        ))}
      </div>
      {why && <p className="exchange-why fit-bad">{why}</p>}
      <div className="exchange-actions">
        <button type="button" className="btn small" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn small primary"
          disabled={!give || !get || why !== null}
          onClick={() => {
            exchange(give!, get!);
            onClose();
          }}
        >
          {give && get ? (
            <>
              {EXCHANGE.give} <EnergyPip color={give} size={13} /> → {EXCHANGE.get} <EnergyPip color={get} size={13} />
            </>
          ) : (
            'Exchange'
          )}
        </button>
      </div>
    </div>
  );
}
