import { useId, useState, type ReactNode } from 'react';
import { COLORS, type Cost } from '@arena/engine';

export function Tooltip({ content, children, block }: { content: ReactNode; children: ReactNode; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="tip-wrap"
      style={block ? { display: 'flex' } : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span role="tooltip" id={id} className="tip">
          {content}
        </span>
      )}
    </span>
  );
}

export function CostPips({ cost, base }: { cost: Cost; base?: Cost }) {
  const pips: { c: string; key: string }[] = [];
  for (const c of COLORS) for (let i = 0; i < cost[c]; i++) pips.push({ c, key: `${c}${i}` });
  for (let i = 0; i < cost.r; i++) pips.push({ c: 'r', key: `r${i}` });
  const changed = base && base.r !== cost.r;
  return (
    <span className="cost" aria-label={`Cost ${pips.map((p) => p.c).join('') || 'free'}`}>
      {pips.length === 0 && <span className="pip free">free</span>}
      {pips.map((p) => (
        <span key={p.key} className={`pip ${p.c}`}>
          {p.c === 'r' ? '' : p.c}
        </span>
      ))}
      {changed && <span className="pip free">{cost.r < base.r ? '−' : '+'}</span>}
    </span>
  );
}

const CLASS_HUES: Record<string, number> = {
  warrior: 8,
  knight: 210,
  druid: 120,
  ranger: 88,
  monk: 32,
  mage: 235,
  warlock: 285,
  rogue: 330,
  priest: 48,
  paladin: 190,
};

export function hueFor(id: string): number {
  if (id in CLASS_HUES) return CLASS_HUES[id]!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0] ?? ''));
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join('') : name.slice(0, 2);
  return letters.toUpperCase();
}

export function durationText(d: number | null): string {
  if (d === null) return 'Permanent';
  return d === 1 ? 'Ends at the end of this turn' : `Ends after ${d} more turn ends (both players’ turns count)`;
}
