// Inventory and the forge (docs/equipment.md §6): owned pieces, where they're equipped, forging two
// pieces into one, splitting a forged piece back into its components, selling (salvage, for gold) and
// trading in 3 single components for a random other one. Only unequipped pieces can be used.
// Pieces drag (mouse or touch, ui/PointerDrag.tsx) from the grid into the base, addition and trade-in
// slots, between slots, and back onto the grid to take them off; clicking still works as before.

import { useEffect, useMemo, useState, type HTMLAttributes } from 'react';
import { describePiece, type PieceDef } from '@arena/engine';
import { canAfford, forge as forgeRule, formatAmounts, pieceKind, salvageValue, splitPiece } from '@arena/meta';
import type { InventoryItem } from '../api.js';
import { content } from '../content.js';
import { useGuide } from '../guides.js';
import { useMeta } from '../meta.js';
import { ItemFace } from './common.js';
import { usePointerDrag } from './PointerDrag.js';
import { ELEMENTS, ItemDetails, KIND_ORDER, PIECE_GROUPS, PieceBadge, pieceKindLabel, pieceSearchText } from './LoadoutEditor.js';

/** What's being dragged: a piece from the grid, or what sits in a bench or trade-in slot. */
type ForgeDrag = { from: 'grid'; piece: string } | { from: 'base' } | { from: 'addition' } | { from: 'trade'; index: number };
/** Where it can go: a bench slot, a trade-in slot, or back to the grid (off the bench). */
type ForgeDrop = { to: 'base' } | { to: 'addition' } | { to: 'trade'; index: number } | { to: 'grid' };

function parseDrop(spec: string): ForgeDrop | null {
  if (spec === 'base' || spec === 'addition' || spec === 'grid') return { to: spec };
  const [kind, n] = spec.split(':');
  return kind === 'trade' ? { to: 'trade', index: Number(n) } : null;
}
const dropKey = (d: ForgeDrop) => (d.to === 'trade' ? `trade:${d.index}` : d.to);

/** One owned piece id: its unequipped copies, and who wears the others. */
interface Entry {
  def: PieceDef;
  spare: InventoryItem[];
  /** Names of the characters wearing a copy. */
  worn: string[];
}

export function InventoryPanel() {
  const { inventory, characters, wallet, busy, forge, split, salvage, tradeIn } = useMeta();
  const tradeRule = content.economy.tradeIn;
  const [trade, setTrade] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [addition, setAddition] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [element, setElement] = useState('');

  const entries = useMemo<Entry[]>(() => {
    const names = new Map(characters.map((c) => [c.id, c.name]));
    const by = new Map<string, Entry>();
    for (const inst of inventory) {
      const def = describePiece(content, inst.itemId);
      if (!def) continue;
      const e = by.get(def.id) ?? { def, spare: [], worn: [] };
      if (inst.equippedOn) e.worn.push(names.get(inst.equippedOn) ?? 'another character');
      else e.spare.push(inst);
      by.set(def.id, e);
    }
    return [...by.values()].sort(
      (a, b) => KIND_ORDER.indexOf(pieceKind(a.def)) - KIND_ORDER.indexOf(pieceKind(b.def)) || a.def.name.localeCompare(b.def.name),
    );
  }, [inventory, characters]);

  // The bench holds instances; a copy on the bench isn't free for anything else.
  const instance = (id: string | null) => (id ? inventory.find((i) => i.id === id && !i.equippedOn) : undefined);
  const baseInst = instance(base);
  const addInst = instance(addition);
  const tradeInsts = trade.map((id) => instance(id)).filter((i): i is InventoryItem => !!i);
  const onBench = new Set([baseInst?.id, addInst?.id, ...tradeInsts.map((i) => i.id)].filter(Boolean));
  const free = (e: Entry) => e.spare.filter((i) => !onBench.has(i.id));
  const result = baseInst && addInst ? forgeRule(content, baseInst.itemId, addInst.itemId) : null;
  // The Forging guide follows the bench.
  const setGuideSignals = useGuide((s) => s.setSignals);
  const countForGuide = useGuide((s) => s.count);
  useEffect(() => setGuideSignals({ benchBase: !!baseInst, benchAddition: !!addInst }), [baseInst, addInst, setGuideSignals]);
  const made = result?.ok ? describePiece(content, result.piece) : undefined;

  const q = query.trim().toLowerCase();
  const kinds = PIECE_GROUPS.find((g) => g.id === group)!.kinds;
  const shown = entries.filter((e) => {
    if (kinds.length && !kinds.includes(pieceKind(e.def))) return false;
    if (element && !e.def.infusions.some((inf) => inf.element === element)) return false;
    return !q || pieceSearchText(e.def).includes(q);
  });
  const current = entries.find((e) => e.def.id === selected);

  const doForge = async () => {
    if (!baseInst || !addInst || !made) return;
    const item = await forge(baseInst.id, addInst.id);
    if (!item) return;
    countForGuide('forges');
    setBase(null);
    setAddition(null);
    setSelected(item.itemId);
    setNotice(`Forged ${made.name}.`);
  };

  const doTrade = async () => {
    if (!tradeRule || tradeInsts.length !== tradeRule.count) return;
    const names = tradeInsts.map((i) => describePiece(content, i.itemId)?.name ?? i.itemId);
    const item = await tradeIn(tradeInsts.map((i) => i.id));
    if (!item) return;
    setTrade([]);
    setSelected(item.itemId);
    setNotice(`Traded in ${names.join(', ')} for ${describePiece(content, item.itemId)?.name ?? item.itemId}.`);
  };

  // Drag-and-drop between the grid, the bench and the trade-in.
  const instOf = (src: ForgeDrag): InventoryItem | undefined => {
    if (src.from === 'grid') {
      const e = entries.find((x) => x.def.id === src.piece);
      return e ? free(e)[0] : undefined;
    }
    if (src.from === 'base') return baseInst;
    if (src.from === 'addition') return addInst;
    return tradeInsts[src.index];
  };
  const single = (inst: InventoryItem) => describePiece(content, inst.itemId)?.components.length === 1;
  const takeOut = (src: ForgeDrag) => {
    if (src.from === 'base') setBase(null);
    else if (src.from === 'addition') setAddition(null);
    else if (src.from === 'trade') setTrade(trade.filter((id) => id !== tradeInsts[src.index]?.id));
  };
  const onDrop = (src: ForgeDrag, to: ForgeDrop) => {
    const inst = instOf(src);
    if (!inst || src.from === to.to) return;
    if (to.to === 'grid') return takeOut(src);
    if (to.to === 'trade') {
      if (!tradeRule || !single(inst)) return setNotice('Only single components (tier 1) can be traded in.');
      const others = trade.filter((id) => id !== inst.id);
      if (others.length >= tradeRule.count) return setNotice(`The trade-in holds ${tradeRule.count}.`);
      takeOut(src);
      setTrade([...others, inst.id]);
      return;
    }
    // Onto a bench slot: what was there swaps back to where this came from (bench to bench), or goes
    // back to the grid.
    const there = to.to === 'base' ? baseInst : addInst;
    const setThere = to.to === 'base' ? setBase : setAddition;
    if (src.from === 'base' || src.from === 'addition') {
      const setHere = src.from === 'base' ? setBase : setAddition;
      setHere(there?.id ?? null);
    } else {
      takeOut(src);
    }
    setThere(inst.id);
    setSelected(describePiece(content, inst.itemId)?.id ?? null);
  };
  const drag = usePointerDrag<ForgeDrag, ForgeDrop>({
    parse: parseDrop,
    key: dropKey,
    onDrop,
    ghost: (src) => {
      const inst = instOf(src);
      const def = inst ? describePiece(content, inst.itemId) : undefined;
      return def ? (
        <>
          <span className="item-tile static">
            <ItemFace def={def} content={content} className="code" />
          </span>
          <b>{def.name}</b>
        </>
      ) : null;
    },
  });
  const over = (key: string) => (drag.overKey === key ? ' drop-over' : '');

  const doSplit = async (e: Entry) => {
    const inst = free(e)[0];
    if (!inst) return;
    const parts = await split(inst.id);
    if (parts) setNotice(`Split ${e.def.name} into ${e.def.components.map((c) => c.name).join(', ')}.`);
  };

  return (
    <section aria-label="Inventory" data-guide="inventory">
      <div className="section-head">
        <h2>
          Inventory <span className="muted">{inventory.length}</span>
        </h2>
        <span className="muted">Equip pieces from a character's page. Wins in casual and ranked matches drop more components.</span>
      </div>

      <div className="forge-bench" role="group" aria-label="Forge" data-guide="forge">
        <BenchSlot
          label="Base"
          inst={baseInst}
          onClear={() => setBase(null)}
          className={over('base')}
          slotProps={{ 'data-drop': 'base', ...(baseInst ? drag.sourceProps({ from: 'base' }) : {}) }}
        />
        <span className="forge-op" aria-hidden>
          +
        </span>
        <BenchSlot
          label="Addition"
          inst={addInst}
          onClear={() => setAddition(null)}
          className={over('addition')}
          slotProps={{ 'data-drop': 'addition', ...(addInst ? drag.sourceProps({ from: 'addition' }) : {}) }}
        />
        <span className="forge-op" aria-hidden>
          =
        </span>
        <div className="forge-result" aria-live="polite">
          {made && result?.ok ? (
            <>
              <span className="item-tile static">
                <PieceBadge def={made} />
                <ItemFace def={made} content={content} className="code" />
              </span>
              <span className="forge-result-text">
                <b>{made.name}</b>
                <span className="muted">{made.components.map((c) => c.name).join(' + ')}</span>
              </span>
            </>
          ) : result && !result.ok ? (
            <span className="fit-bad">{result.problems.join(' ')}</span>
          ) : (
            <span className="muted">Pick a base and an addition from your pieces below.</span>
          )}
        </div>
        <div className="forge-actions">
          <button
            type="button"
            className="btn small"
            disabled={!baseInst && !addInst}
            title="The base keeps its name; swapping changes which piece that is"
            onClick={() => {
              setBase(addition);
              setAddition(base);
            }}
          >
            Swap
          </button>
          <button type="button" className="btn small primary" disabled={busy || !result?.ok || !canAfford(wallet, result.cost)} onClick={() => void doForge()}>
            Forge{result?.ok ? ` (${formatAmounts(content, result.cost)})` : ''}
          </button>
        </div>
      </div>
      <p className="muted forge-hint">
        Drag pieces into the slots (or use the buttons below). The base keeps its name and the addition adds to it. A piece holds up to 3
        components: one Sigil at most, and no skill twice.
      </p>

      {tradeRule && (
        <div className="trade-bench" role="group" aria-label="Trade in" data-guide="trade">
          <span className="slot-label">Trade in</span>
          <div className="trade-slots">
            {Array.from({ length: tradeRule.count }, (_, i) => {
              const inst = tradeInsts[i];
              const def = inst ? describePiece(content, inst.itemId) : undefined;
              return (
                <div
                  key={i}
                  className={`forge-slot trade-slot${def ? ' filled draggable' : ''}${over(`trade:${i}`)}`}
                  data-drop={`trade:${i}`}
                  {...(inst ? drag.sourceProps({ from: 'trade', index: i }) : {})}
                >
                  {def ? (
                    <>
                      <span className="item-tile static">
                        <PieceBadge def={def} />
                        <ItemFace def={def} content={content} className="code" />
                      </span>
                      <span className="forge-slot-name">{def.name}</span>
                      <button
                        type="button"
                        className="equip-remove"
                        aria-label={`Take ${def.name} out of the trade`}
                        title="Remove"
                        onClick={() => setTrade(trade.filter((id) => id !== inst!.id))}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="muted">Empty</span>
                  )}
                </div>
              );
            })}
          </div>
          <span className="muted trade-text">
            Any {tradeRule.count} single components (tier 1) for one random component of another kind.
          </span>
          <button type="button" className="btn small primary" disabled={busy || tradeInsts.length !== tradeRule.count} onClick={() => void doTrade()}>
            Trade in
          </button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <div className="pool-filters">
        <input type="search" aria-label="Search inventory" placeholder="Search pieces, skills, passives…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="segmented" role="group" aria-label="Piece kind">
          {PIECE_GROUPS.map((g) => (
            <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
        <select aria-label="Element" value={element} onChange={(e) => setElement(e.target.value)}>
          <option value="">Any element</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {el}
            </option>
          ))}
        </select>
        <span className="muted pool-count">
          {shown.length} of {entries.length}
        </span>
      </div>

      <div className="inventory-body" data-guide="pieces">
        {entries.length === 0 ? (
          <p className="muted">No equipment yet. Casual and ranked wins, the story and achievements all give components.</p>
        ) : (
          <div className={`item-grid${over('grid')}`} aria-label="Your pieces" data-drop="grid">
            {shown.map((e) => {
              const n = free(e).length;
              return (
                <button
                  key={e.def.id}
                  type="button"
                  className={`item-tile${n === 0 ? ' blocked' : ' draggable'}${selected === e.def.id ? ' here' : ''}`}
                  {...(n > 0 ? drag.sourceProps({ from: 'grid', piece: e.def.id }) : {})}
                  aria-pressed={selected === e.def.id}
                  aria-label={`${e.def.name}, ${pieceKindLabel(e.def)}, ${n} free${e.worn.length ? `, ${e.worn.length} equipped` : ''}`}
                  onClick={() => {
                    setSelected(e.def.id);
                    setConfirming(null);
                  }}
                >
                  <PieceBadge def={e.def} />
                  <ItemFace def={e.def} content={content} className="code" />
                  {n > 1 && <span className="item-count">×{n}</span>}
                  <span className="tile-name">{e.def.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {drag.ghost}
        {current && (
          <div className="inventory-detail item-card" aria-label={`${current.def.name} details`}>
            <ItemDetails def={current.def} />
            <div className="item-card-line muted">
              {[`${free(current).length} free`, ...current.worn.map((n) => `1 on ${n}`)].join(' · ')}
            </div>
            <div className="inventory-actions">
              <button type="button" className="btn small" disabled={free(current).length === 0} onClick={() => setBase(free(current)[0]!.id)}>
                Use as base
              </button>
              <button type="button" className="btn small" disabled={free(current).length === 0} onClick={() => setAddition(free(current)[0]!.id)}>
                Use as addition
              </button>
              {tradeRule && current.def.components.length === 1 && (
                <button
                  type="button"
                  className="btn small"
                  disabled={free(current).length === 0 || tradeInsts.length >= tradeRule.count}
                  title={`Put it in the trade-in (${tradeInsts.length}/${tradeRule.count})`}
                  onClick={() => setTrade([...tradeInsts.map((i) => i.id), free(current)[0]!.id])}
                >
                  Add to trade-in
                </button>
              )}
              {current.def.components.length > 1 && (
                <button
                  type="button"
                  className="btn small"
                  disabled={busy || free(current).length === 0 || !canAfford(wallet, content.economy.split.cost)}
                  title={`Back into ${current.def.components.map((c) => c.name).join(', ')}`}
                  onClick={() => void doSplit(current)}
                >
                  Split ({formatAmounts(content, splitCost(current.def))})
                </button>
              )}
              <button
                type="button"
                className={`btn small${confirming === current.def.id ? ' danger' : ''}`}
                disabled={busy || free(current).length === 0}
                onClick={() => {
                  if (confirming !== current.def.id) return setConfirming(current.def.id);
                  setConfirming(null);
                  void salvage(free(current)[0]!.id).then(() => setNotice(`Sold ${current.def.name} for ${formatAmounts(content, salvageValue(content, current.def.id))}.`));
                }}
                onBlur={() => confirming === current.def.id && setConfirming(null)}
              >
                {confirming === current.def.id ? `Sell for ${formatAmounts(content, salvageValue(content, current.def.id))}?` : `Sell (${formatAmounts(content, salvageValue(content, current.def.id))})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const splitCost = (def: PieceDef) => {
  const r = splitPiece(content, def.id);
  return r.ok ? r.cost : {};
};

function BenchSlot({
  label,
  inst,
  onClear,
  className = '',
  slotProps,
}: {
  label: string;
  inst: InventoryItem | undefined;
  onClear: () => void;
  className?: string;
  /** Drop target and drag handlers. */
  slotProps?: HTMLAttributes<HTMLDivElement> & { 'data-drop'?: string };
}) {
  const def = inst ? describePiece(content, inst.itemId) : undefined;
  return (
    <div {...slotProps} className={`forge-slot${def ? ' filled draggable' : ''}${className}`}>
      <span className="slot-label">{label}</span>
      {def ? (
        <>
          <span className="item-tile static">
            <PieceBadge def={def} />
            <ItemFace def={def} content={content} className="code" />
          </span>
          <span className="forge-slot-name">{def.name}</span>
          <button type="button" className="equip-remove" aria-label={`Take ${def.name} off the bench`} title="Clear" onClick={onClear}>
            ×
          </button>
        </>
      ) : (
        <span className="muted">Empty</span>
      )}
    </div>
  );
}
