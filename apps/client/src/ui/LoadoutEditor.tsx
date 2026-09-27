// The loadout editor (GDD §8.3): four slots that take any item, over a grid of the items the player
// owns. Hovering or focusing an item shows what it grants and whether it fits. Clicking an item
// equips it in the next free slot; selecting a slot first makes the next item replace it.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ItemDef, ItemType } from '@arena/engine';
import {
  EQUIPMENT_SLOTS,
  ITEM_TYPE_NAMES,
  itemElement,
  resolveLoadout,
  withItem,
  type CharacterRecord,
  type EquippedItem,
  type Loadout,
  type ResolvedLoadout,
} from '@arena/meta';
import type { Character, InventoryItem } from '../api.js';
import { content } from '../content.js';
import { CostPips, elementClass, itemCode } from './common.js';

const GROUPS: { id: string; label: string; types: readonly ItemType[] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'weapons', label: 'Weapons', types: ['A', 'B', 'C', 'D', 'E'] },
  { id: 'armor', label: 'Armor', types: ['F', 'G'] },
  { id: 'trinkets', label: 'Trinkets', types: ['H', 'J', 'L'] },
  { id: 'crystals', label: 'Crystals', types: ['I', 'K'] },
];
const TYPE_ORDER = 'ABCDEFGHIJKL';
const ELEMENTS = [...new Set(Object.values(content.items).flatMap((i) => i.infusions.map((inf) => inf.element)))].sort();

/** One owned item id: its free copies, and where the others are. */
interface PoolEntry {
  def: ItemDef;
  /** Copies that can go on this character now. */
  free: InventoryItem[];
  /** Copies in this character's draft. */
  here: number;
  /** Names of other characters wearing a copy. */
  elsewhere: string[];
}

type Fit =
  | { kind: 'ok'; adds: string[] }
  | { kind: 'problems'; problems: string[] }
  | { kind: 'full' }
  | { kind: 'class'; className: string }
  /** No copy free: every one is equipped (here, or on other characters). */
  | { kind: 'none'; reason: string };

const skillName = (base: string) => content.skills[base]?.name ?? base;

/** Usage the new loadout adds, as "+1 skill"-style notes. */
function usageDelta(before: ResolvedLoadout['usage'], after: ResolvedLoadout['usage']): string[] {
  const out: string[] = [];
  const add = (n: number, one: string, many: string) => n > 0 && out.push(`+${n} ${n === 1 ? one : many}`);
  add(after.skills - before.skills, 'skill', 'skills');
  add(after.passives - before.passives, 'passive', 'passives');
  add(after.infusions - before.infusions, 'infusion', 'infusions');
  return out;
}

export function LoadoutEditor({
  character,
  record,
  draft,
  onChange,
  resolved,
  inventory,
  characters,
}: {
  character: Character;
  record: CharacterRecord;
  draft: Loadout;
  onChange: (next: Loadout) => void;
  resolved: ResolvedLoadout;
  inventory: InventoryItem[];
  characters: Character[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ key: string; rect: DOMRect; body: ReactNode } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [element, setElement] = useState('');
  const [fitsOnly, setFitsOnly] = useState(false);
  const items = draft.items;

  // A hover card belongs to where the item was; any scroll or resize moves the item.
  useEffect(() => {
    const hide = () => setHover(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  const pool = useMemo<PoolEntry[]>(() => {
    const inDraft = new Set(items.map((e) => e.instanceId).filter(Boolean));
    const names = new Map(characters.map((c) => [c.id, c.name]));
    const by = new Map<string, PoolEntry>();
    for (const inst of inventory) {
      const def = content.items[inst.itemId];
      if (!def) continue;
      const e = by.get(def.id) ?? { def, free: [], here: 0, elsewhere: [] };
      if (inDraft.has(inst.id)) e.here++;
      else if (inst.equippedOn === null || inst.equippedOn === character.id) e.free.push(inst);
      else e.elsewhere.push(names.get(inst.equippedOn) ?? 'another character');
      by.set(def.id, e);
    }
    return [...by.values()].sort(
      (a, b) => TYPE_ORDER.indexOf(a.def.type) - TYPE_ORDER.indexOf(b.def.type) || a.def.name.localeCompare(b.def.name),
    );
  }, [inventory, items, characters, character.id]);

  const fits = useMemo(() => {
    const out = new Map<string, Fit>();
    for (const e of pool) {
      const def = e.def;
      if (def.classId && def.classId !== record.classId) {
        out.set(def.id, { kind: 'class', className: content.classes[def.classId]?.name ?? def.classId });
      } else if (e.free.length === 0) {
        const where = [e.here ? 'on this character' : null, e.elsewhere.length ? `on ${[...new Set(e.elsewhere)].join(', ')}` : null].filter(Boolean).join(' and ');
        out.set(def.id, { kind: 'none', reason: `Every copy you own is equipped ${where}.` });
      } else if (selected === null && items.length >= EQUIPMENT_SLOTS) {
        out.set(def.id, { kind: 'full' });
      } else {
        const next = withItem(content, record, draft, { itemId: def.id, instanceId: e.free[0]!.id }, selected ?? undefined);
        const r = resolveLoadout(content, record, next);
        const problems = r.problems.filter((p) => !resolved.problems.includes(p) && !p.startsWith('Choose a skill'));
        out.set(def.id, problems.length ? { kind: 'problems', problems } : { kind: 'ok', adds: usageDelta(resolved.usage, r.usage) });
      }
    }
    return out;
  }, [pool, selected, items.length, draft, record, resolved]);

  const q = query.trim().toLowerCase();
  const types = GROUPS.find((g) => g.id === group)!.types;
  const shown = pool.filter((e) => {
    const d = e.def;
    if (types.length && !types.includes(d.type)) return false;
    if (element && !d.infusions.some((inf) => inf.element === element)) return false;
    if (fitsOnly && fits.get(d.id)?.kind !== 'ok') return false;
    if (!q) return true;
    const text = [d.name, d.passive ?? '', ITEM_TYPE_NAMES[d.type], ...d.skills.map(skillName), ...d.infusions.map((i) => i.element)].join(' ');
    return text.toLowerCase().includes(q);
  });

  const equip = (e: PoolEntry) => {
    const fit = fits.get(e.def.id)!;
    if (fit.kind === 'none' || fit.kind === 'class') return;
    if (fit.kind === 'full') return setNotice(`All ${EQUIPMENT_SLOTS} slots are full: select a slot to replace, or remove an item.`);
    onChange(withItem(content, record, draft, { itemId: e.def.id, instanceId: e.free[0]!.id }, selected ?? undefined));
    setSelected(null);
    setNotice(null);
    setHover(null);
  };

  const updateSlot = (i: number, eq: EquippedItem) => onChange({ items: items.map((x, j) => (j === i ? eq : x)) });
  const removeSlot = (i: number) => {
    onChange({ items: items.filter((_, j) => j !== i) });
    setSelected(null);
    setHover(null);
  };

  const show = (key: string, target: HTMLElement, body: ReactNode) => setHover({ key, rect: target.getBoundingClientRect(), body });
  const hide = (key: string) => setHover((h) => (h?.key === key ? null : h));

  return (
    <div className="loadout-editor">
      <div className="equip-slots" role="group" aria-label={`Equipment slots (${items.length} of ${EQUIPMENT_SLOTS} used)`}>
        {Array.from({ length: EQUIPMENT_SLOTS }, (_, i) => {
          const eq = items[i];
          const def = eq ? content.items[eq.itemId] : undefined;
          if (!eq || !def) {
            const next = i === items.length;
            return (
              <div key={i} className={`equip-slot empty${next && selected === null ? ' next' : ''}`}>
                <span className="slot-label">Slot {i + 1}</span>
                <span className="muted">{next ? 'Click an item below' : 'Empty'}</span>
              </div>
            );
          }
          const key = `slot-${i}`;
          const isSelected = selected === i;
          return (
            <div key={i} className={`equip-slot filled${isSelected ? ' selected' : ''}`}>
              <div className="equip-slot-top">
                <button
                  type="button"
                  className="equip-slot-main"
                  aria-pressed={isSelected}
                  aria-label={`Slot ${i + 1}: ${def.name}. ${isSelected ? 'Selected: the next item you pick replaces it.' : 'Select to replace.'}`}
                  onClick={() => {
                    setSelected(isSelected ? null : i);
                    setNotice(null);
                  }}
                  onMouseEnter={(ev) => show(key, ev.currentTarget, <ItemDetails def={def} eq={eq} />)}
                  onMouseLeave={() => hide(key)}
                  onFocus={(ev) => show(key, ev.currentTarget, <ItemDetails def={def} eq={eq} />)}
                  onBlur={() => hide(key)}
                >
                  <ItemGlyph def={def} />
                  <span className="equip-slot-name">
                    <b>{def.name}</b>
                    <span className="muted">
                      {def.type} · {ITEM_TYPE_NAMES[def.type]}
                    </span>
                    {isSelected && <span className="replacing">Replacing: pick an item</span>}
                  </span>
                </button>
                <button type="button" className="equip-remove" aria-label={`Remove ${def.name}`} title="Remove" onClick={() => removeSlot(i)}>
                  ×
                </button>
              </div>
              <SlotGrants def={def} eq={eq} resolved={resolved} onChange={(next) => updateSlot(i, next)} />
            </div>
          );
        })}
      </div>

      {notice && (
        <p className="notice warn" role="status">
          {notice}
        </p>
      )}

      <div className="item-pool" aria-label="Your items">
        <div className="pool-filters">
          <input type="search" aria-label="Search items" placeholder="Search items, skills, passives…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="segmented" role="group" aria-label="Item category">
            {GROUPS.map((g) => (
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
          <label className="check">
            <input type="checkbox" checked={fitsOnly} onChange={(e) => setFitsOnly(e.target.checked)} />
            Only what fits
          </label>
          <span className="muted pool-count">
            {shown.length} of {pool.length}
          </span>
        </div>
        {pool.length === 0 ? (
          <p className="muted">No items yet. Casual and ranked wins, the story and achievements all give equipment.</p>
        ) : shown.length === 0 ? (
          <p className="muted">No items match.</p>
        ) : (
          <div className="item-grid">
            {shown.map((e) => {
              const fit = fits.get(e.def.id)!;
              const key = `pool-${e.def.id}`;
              const card = <ItemDetails def={e.def} entry={e} fit={fit} selected={selected} />;
              const blocked = (fit.kind === 'none' && !e.here) || fit.kind === 'class';
              return (
                <button
                  key={e.def.id}
                  type="button"
                  className={`item-tile ${elementClass(itemElement(e.def))}${blocked ? ' blocked' : ''}${fit.kind === 'problems' ? ' conflict' : ''}${e.here ? ' here' : ''}`}
                  aria-disabled={blocked}
                  aria-label={`${e.def.name}, ${ITEM_TYPE_NAMES[e.def.type]}${e.free.length > 1 ? `, ${e.free.length} free` : ''}${e.here ? ', equipped here' : ''}`}
                  onClick={() => equip(e)}
                  onMouseEnter={(ev) => show(key, ev.currentTarget, card)}
                  onMouseLeave={() => hide(key)}
                  onFocus={(ev) => show(key, ev.currentTarget, card)}
                  onBlur={() => hide(key)}
                >
                  <span className="item-type">{e.def.type}</span>
                  <span className="code">{itemCode(e.def.name)}</span>
                  {e.free.length > 1 && <span className="item-count">×{e.free.length}</span>}
                  {e.here > 0 && (
                    <span className="item-here" aria-hidden>
                      ✓
                    </span>
                  )}
                  {fit.kind === 'problems' && (
                    <span className="item-warn" aria-hidden>
                      !
                    </span>
                  )}
                  <span className="tile-name">{e.def.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {hover && <HoverCard rect={hover.rect}>{hover.body}</HoverCard>}
    </div>
  );
}

/** The item's code on its element color, as in the grid (for the slots). */
function ItemGlyph({ def }: { def: ItemDef }) {
  return (
    <span className={`item-glyph ${elementClass(itemElement(def))}`} aria-hidden>
      {itemCode(def.name)}
    </span>
  );
}

/** Under an equipped item: what it grants, and its infusion targets (chosen ones can be changed). */
function SlotGrants({ def, eq, resolved, onChange }: { def: ItemDef; eq: EquippedItem; resolved: ResolvedLoadout; onChange: (eq: EquippedItem) => void }) {
  return (
    <div className="slot-detail">
      {def.skills.length > 0 && <div className="muted">Skill: {def.skills.map(skillName).join(', ')}</div>}
      {def.infusions.map((inf, i) => {
        const unused = eq.unused?.includes(i) ?? false;
        return (
          <div key={i} className="infusion-row">
            <span className={`skill-chip ${elementClass(inf.element)}`}>{inf.element}</span>
            {inf.target ? (
              <span>→ {skillName(inf.target)}</span>
            ) : (
              <select
                aria-label={`${def.name} ${inf.element} infusion target`}
                value={eq.targets?.[i] ?? ''}
                disabled={unused}
                onChange={(e) => {
                  const targets = [...(eq.targets ?? [])];
                  while (targets.length <= i) targets.push(null);
                  targets[i] = e.target.value || null;
                  onChange({ ...eq, targets });
                }}
              >
                <option value="">choose a skill…</option>
                {resolved.skills.map((s) => (
                  <option key={s.base} value={s.base}>
                    {skillName(s.base)}
                  </option>
                ))}
              </select>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={unused}
                onChange={(e) => {
                  const set = new Set(eq.unused ?? []);
                  if (e.target.checked) set.add(i);
                  else set.delete(i);
                  const { unused: _drop, ...rest } = eq;
                  onChange(set.size ? { ...rest, unused: [...set].sort() } : rest);
                }}
              />
              unused
            </label>
          </div>
        );
      })}
      {def.passive && <div className="muted">Passive{def.passiveEffect ? '' : ' (not active yet)'}: hover for details</div>}
    </div>
  );
}

/** Everything about an item, for its hover card; with pool info when it's in the grid. */
function ItemDetails({
  def,
  eq,
  entry,
  fit,
  selected,
}: {
  def: ItemDef;
  eq?: EquippedItem;
  entry?: PoolEntry;
  fit?: Fit;
  selected?: number | null;
}) {
  const el = itemElement(def);
  const effect = def.passiveEffect ? content.statuses[def.passiveEffect] : undefined;
  return (
    <>
      <div className="item-card-head">
        <span className="item-type-badge">{def.type}</span>
        <span className="muted">{ITEM_TYPE_NAMES[def.type]}</span>
        {el && <span className={`skill-chip ${elementClass(el)}`}>{el}</span>}
      </div>
      <h4>{def.name}</h4>
      {def.classId && <div className="item-card-line">{content.classes[def.classId]?.name ?? def.classId} only</div>}
      <ul className="item-grants">
        {def.skills.map((s) => {
          const d = content.skills[s];
          return (
            <li key={s}>
              <b>Skill</b> {d?.name ?? s} {d && <CostPips cost={d.cost} />}
              {d && <div className="muted">{d.description}</div>}
            </li>
          );
        })}
        {def.infusions.map((inf, i) => (
          <li key={`inf-${i}`}>
            <b>Infuse</b> <span className={`skill-chip ${elementClass(inf.element)}`}>{inf.element}</span>{' '}
            {inf.target ? `→ ${skillName(inf.target)}` : eq?.targets?.[i] ? `→ ${skillName(eq.targets[i]!)} (your choice)` : '→ a skill you choose'}
            {eq?.unused?.includes(i) && <span className="muted"> · unused</span>}
          </li>
        ))}
        {def.passive && (
          <li>
            <b>Passive</b> {def.passive}
            {effect ? (
              effect.description && effect.description !== def.passive && <div className="muted">In play: {effect.description}</div>
            ) : (
              <div className="muted">Not active yet.</div>
            )}
          </li>
        )}
      </ul>
      {entry && (
        <div className="item-card-line muted">
          {[
            `You have ${entry.free.length + entry.here + entry.elsewhere.length}`,
            entry.here ? `${entry.here} equipped here` : null,
            ...entry.elsewhere.map((n) => `1 on ${n}`),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      {fit && <FitLine fit={fit} selected={selected ?? null} />}
      {eq && <div className="item-card-line muted">Click to select this slot for replacing; × removes the item.</div>}
    </>
  );
}

function FitLine({ fit, selected }: { fit: Fit; selected: number | null }) {
  const where = selected === null ? 'equip' : `replace slot ${selected + 1}`;
  switch (fit.kind) {
    case 'ok':
      return <div className="item-card-line fit-ok">Fits{fit.adds.length ? `: uses ${fit.adds.join(', ')}` : ''}. Click to {where}.</div>;
    case 'problems':
      return (
        <div className="item-card-line fit-bad">
          Equipping it would break the loadout:
          <ul>
            {fit.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      );
    case 'full':
      return <div className="item-card-line fit-bad">All {EQUIPMENT_SLOTS} slots are full: select a slot to replace, or remove an item.</div>;
    case 'class':
      return <div className="item-card-line fit-bad">Only a {fit.className} can wear it.</div>;
    case 'none':
      return <div className="item-card-line fit-bad">{fit.reason}</div>;
  }
}

/** A card beside `rect` (right, else left, else below), kept inside the viewport. */
function HoverCard({ rect, children }: { rect: DOMRect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 10;
    const m = 8;
    let left = rect.right + gap;
    let top = rect.top;
    if (left + w > window.innerWidth - m) left = rect.left - gap - w;
    if (left < m) {
      // No room at either side (a phone): below the item, or above it.
      left = Math.min(Math.max(m, rect.left), window.innerWidth - m - w);
      top = rect.bottom + gap + h <= window.innerHeight - m ? rect.bottom + gap : rect.top - gap - h;
    }
    top = Math.max(m, Math.min(top, window.innerHeight - m - h));
    setPos({ left: Math.max(m, left), top });
  }, [rect, children]);
  return createPortal(
    <div ref={ref} className="item-card" role="tooltip" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}
