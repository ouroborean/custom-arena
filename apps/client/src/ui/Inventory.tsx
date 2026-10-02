// Inventory and the forge (docs/equipment.md §6): owned pieces, where they're equipped, forging two
// pieces into one, splitting a forged piece back into its components, and salvage. Only unequipped
// pieces can be forged, split or salvaged.

import { useMemo, useState } from 'react';
import { describePiece, type PieceDef } from '@arena/engine';
import { canAfford, forge as forgeRule, formatAmounts, pieceKind, salvageValue, splitPiece } from '@arena/meta';
import type { InventoryItem } from '../api.js';
import { content } from '../content.js';
import { useMeta } from '../meta.js';
import { ItemFace } from './common.js';
import { ELEMENTS, ItemDetails, KIND_ORDER, PIECE_GROUPS, PieceBadge, pieceKindLabel, pieceSearchText } from './LoadoutEditor.js';

/** One owned piece id: its unequipped copies, and who wears the others. */
interface Entry {
  def: PieceDef;
  spare: InventoryItem[];
  /** Names of the characters wearing a copy. */
  worn: string[];
}

export function InventoryPanel() {
  const { inventory, characters, wallet, busy, forge, split, salvage } = useMeta();
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
  const onBench = new Set([baseInst?.id, addInst?.id].filter(Boolean));
  const free = (e: Entry) => e.spare.filter((i) => !onBench.has(i.id));
  const result = baseInst && addInst ? forgeRule(content, baseInst.itemId, addInst.itemId) : null;
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
    setBase(null);
    setAddition(null);
    setSelected(item.itemId);
    setNotice(`Forged ${made.name}.`);
  };

  const doSplit = async (e: Entry) => {
    const inst = free(e)[0];
    if (!inst) return;
    const parts = await split(inst.id);
    if (parts) setNotice(`Split ${e.def.name} into ${e.def.components.map((c) => c.name).join(', ')}.`);
  };

  return (
    <section aria-label="Inventory">
      <div className="section-head">
        <h2>
          Inventory <span className="muted">{inventory.length}</span>
        </h2>
        <span className="muted">Equip pieces from a character's page. Wins in casual and ranked matches drop more components.</span>
      </div>

      <div className="forge-bench" role="group" aria-label="Forge">
        <BenchSlot label="Base" inst={baseInst} onClear={() => setBase(null)} />
        <span className="forge-op" aria-hidden>
          +
        </span>
        <BenchSlot label="Addition" inst={addInst} onClear={() => setAddition(null)} />
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
        The base keeps its name and the addition adds to it. A piece holds up to 3 components: one Sigil at most, and no skill twice.
      </p>
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

      <div className="inventory-body">
        {entries.length === 0 ? (
          <p className="muted">No equipment yet. Casual and ranked wins, the story and achievements all give components.</p>
        ) : (
          <div className="item-grid" aria-label="Your pieces">
            {shown.map((e) => {
              const n = free(e).length;
              return (
                <button
                  key={e.def.id}
                  type="button"
                  className={`item-tile${n === 0 ? ' blocked' : ''}${selected === e.def.id ? ' here' : ''}`}
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
                  void salvage(free(current)[0]!.id).then(() => setNotice(`Salvaged ${current.def.name}.`));
                }}
                onBlur={() => confirming === current.def.id && setConfirming(null)}
              >
                {confirming === current.def.id ? `Salvage for ${formatAmounts(content, salvageValue(content, current.def.id))}?` : 'Salvage'}
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

function BenchSlot({ label, inst, onClear }: { label: string; inst: InventoryItem | undefined; onClear: () => void }) {
  const def = inst ? describePiece(content, inst.itemId) : undefined;
  return (
    <div className={`forge-slot${def ? ' filled' : ''}`}>
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
