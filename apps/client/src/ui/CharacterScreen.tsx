// Character page: rename/retire, effective skills, the loadout editor (GDD §7.3, §8) and presets.
// The loadout is validated live with the same @arena/meta rules the server enforces on save.

import { useEffect, useMemo, useState } from 'react';
import { RARITIES, resolveLoadout, SLOT_TYPES, type EquippedItem, type Loadout } from '@arena/meta';
import { api, ApiError, type Character, type Preset } from '../api.js';
import { content } from '../content.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';
import { elementClass } from './common.js';
import { Portrait, RarityBadge, recordOf, SkillChips } from './Roster.js';

type SlotRef = { key: 'mainHand' | 'offHand' | 'twoHanded' | 'body' } | { key: 'accessories' | 'sockets'; index: number };

const SLOT_LABEL = { mainHand: 'Main hand', offHand: 'Off hand', twoHanded: 'Two-handed', body: 'Body', accessories: 'Accessory', sockets: 'Crystal socket' };
const SLOT_KIND = { mainHand: 'mainHand', offHand: 'offHand', twoHanded: 'twoHanded', body: 'body', accessories: 'accessory', sockets: 'socket' } as const;

/** JSON with sorted keys: the server's jsonb storage doesn't keep key order. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}

function getSlot(l: Loadout, ref: SlotRef): EquippedItem | undefined {
  return 'index' in ref ? l[ref.key]?.[ref.index] : l[ref.key];
}

function setSlot(l: Loadout, ref: SlotRef, eq: EquippedItem | undefined): Loadout {
  if (!('index' in ref)) {
    const next = { ...l };
    if (eq) next[ref.key] = eq;
    else delete next[ref.key];
    return next;
  }
  const list = [...(l[ref.key] ?? [])];
  list[ref.index] = eq!;
  const compact = list.filter(Boolean);
  const next = { ...l };
  if (compact.length) next[ref.key] = compact;
  else delete next[ref.key];
  return next;
}

export function CharacterScreen() {
  const id = useStore((s) => s.characterId);
  const go = useStore((s) => s.go);
  const { characters, inventory, team, rename, retire, refresh, busy } = useMeta();
  const c = characters.find((x) => x.id === id);
  if (!c) {
    return (
      <div className="meta-page">
        <button type="button" className="btn" onClick={() => go('home')}>
          ← Back
        </button>
        <p className="muted">That character isn't in your roster.</p>
      </div>
    );
  }
  return <CharacterPage key={c.id} c={c} inventory={inventory} inTeam={team.includes(c.id)} busy={busy} onRename={rename} onRetire={retire} onSaved={refresh} />;
}

function CharacterPage({
  c,
  inventory,
  inTeam,
  busy,
  onRename,
  onRetire,
  onSaved,
}: {
  c: Character;
  inventory: ReturnType<typeof useMeta.getState>['inventory'];
  inTeam: boolean;
  busy: boolean;
  onRename: (id: string, name: string) => Promise<void>;
  onRetire: (id: string) => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const go = useStore((s) => s.go);
  const [name, setName] = useState(c.name);
  const [draft, setDraft] = useState<Loadout>(c.loadout);
  const [serverProblems, setServerProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const rarity = RARITIES[c.rarity];
  const record = recordOf(c);
  const resolved = useMemo(() => resolveLoadout(content, record, draft), [record, draft]);
  const dirty = canonical(draft) !== canonical(c.loadout);

  useEffect(() => {
    api.presets(c.id).then((r) => setPresets(r.presets), () => setPresets([]));
  }, [c.id]);

  const slots: SlotRef[] = [
    { key: 'mainHand' },
    { key: 'offHand' },
    { key: 'twoHanded' },
    { key: 'body' },
    ...Array.from({ length: rarity.equipmentSlots }, (_, index) => ({ key: 'accessories' as const, index })),
    ...Array.from({ length: rarity.freeSockets }, (_, index) => ({ key: 'sockets' as const, index })),
  ];
  const usedInDraft = new Set(slots.map((r) => getSlot(draft, r)?.instanceId).filter(Boolean));

  const save = async () => {
    setServerProblems([]);
    setSaved(null);
    try {
      await api.saveLoadout(c.id, draft);
      await onSaved();
      setSaved('Loadout saved');
    } catch (e) {
      setServerProblems(e instanceof ApiError && e.problems.length ? e.problems : [String((e as Error).message)]);
    }
  };

  const savePreset = async () => {
    try {
      const r = await api.savePreset(c.id, presetName.trim(), draft);
      setPresets([...presets, r.preset]);
      setPresetName('');
    } catch (e) {
      setServerProblems(e instanceof ApiError && e.problems.length ? e.problems : [String((e as Error).message)]);
    }
  };

  const applyPreset = async (p: Preset) => {
    setServerProblems([]);
    try {
      await api.applyPreset(c.id, p.id);
      setDraft(p.loadout);
      await onSaved();
      setSaved(`Applied “${p.name}”`);
    } catch (e) {
      setServerProblems(e instanceof ApiError && e.problems.length ? e.problems : [String((e as Error).message)]);
    }
  };

  const problems = [...resolved.problems, ...serverProblems];
  const b = rarity.budget;

  return (
    <div className="meta-page wide">
      <div className="section-head">
        <button type="button" className="btn" onClick={() => go('home')}>
          ← Roster
        </button>
      </div>

      <section className="panel char-header" aria-label="Character">
        <Portrait c={c} size={88} />
        <div className="char-header-body">
          <div className="rename">
            <input type="text" aria-label="Name" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" className="btn small" disabled={busy || !name.trim() || name === c.name} onClick={() => void onRename(c.id, name.trim())}>
              Rename
            </button>
          </div>
          <div className="char-meta">
            <RarityBadge rarity={c.rarity} />
            <span>
              {c.element} {content.classes[c.classId]?.name}
            </span>
            <span className="muted">
              {rarity.equipmentSlots} accessory slots · {rarity.freeSockets} sockets · budget {b.skills} skills / {b.passives} passives / {b.infusions}{' '}
              infusions
            </span>
          </div>
          <SkillChips skills={resolved.problems.length ? c.skills : resolved.skills} />
        </div>
        <button
          type="button"
          className="btn danger"
          disabled={busy || inTeam}
          title={inTeam ? 'Remove from the active team first' : undefined}
          onClick={() => {
            if (window.confirm(`Retire ${c.name}? This can't be undone.`)) void onRetire(c.id).then(() => go('home'));
          }}
        >
          Retire
        </button>
      </section>

      <section className="panel" aria-label="Loadout">
        <div className="section-head">
          <span className="panel-title">Loadout</span>
          <span className="muted">
            Using {resolved.usage.skills}/{b.skills} skills · {resolved.usage.passives}/{b.passives} passives · {resolved.usage.infusions}/
            {b.infusions} infusions
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" disabled={!dirty} onClick={() => setDraft(c.loadout)}>
            Reset
          </button>
          <button type="button" className="btn primary" disabled={!dirty || resolved.problems.length > 0 || busy} onClick={() => void save()}>
            Save loadout
          </button>
        </div>
        {saved && !dirty && <p className="notice ok">{saved}</p>}
        {problems.length > 0 && (
          <ul className="problems" role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="slot-grid">
          {slots.map((ref) => {
            const kind = SLOT_KIND[ref.key];
            const eq = getSlot(draft, ref);
            const def = eq ? content.items[eq.itemId] : undefined;
            const options = inventory.filter(
              (i) =>
                SLOT_TYPES[kind].includes(content.items[i.itemId]?.type ?? 'L') &&
                (i.equippedOn === null || i.equippedOn === c.id) &&
                (!usedInDraft.has(i.id) || i.id === eq?.instanceId),
            );
            const label = 'index' in ref ? `${SLOT_LABEL[ref.key]} ${ref.index + 1}` : SLOT_LABEL[ref.key];
            return (
              <div key={label} className={`slot-card ${def ? 'filled' : ''}`}>
                <div className="slot-head">
                  <span className="slot-label">{label}</span>
                  <span className="muted">{SLOT_TYPES[kind].join(' · ')}</span>
                </div>
                <select
                  aria-label={label}
                  value={eq?.instanceId ?? ''}
                  onChange={(e) => {
                    const inst = inventory.find((i) => i.id === e.target.value);
                    setDraft(setSlot(draft, ref, inst ? { itemId: inst.itemId, instanceId: inst.id } : undefined));
                  }}
                >
                  <option value="">{options.length ? '— empty —' : '— no items —'}</option>
                  {options.map((i) => (
                    <option key={i.id} value={i.id}>
                      {content.items[i.itemId]?.name} ({content.items[i.itemId]?.type})
                    </option>
                  ))}
                </select>
                {def && eq && (
                  <div className="slot-detail">
                    {def.skills.length > 0 && (
                      <div className="muted">Grants {def.skills.map((s) => content.skills[s]?.name).join(', ')}</div>
                    )}
                    {def.infusions.map((inf, i) => {
                      const unused = eq.unused?.includes(i) ?? false;
                      const update = (next: Partial<EquippedItem>) => setDraft(setSlot(draft, ref, { ...eq, ...next }));
                      return (
                        <div key={i} className="infusion-row">
                          <span className={`skill-chip ${elementClass(inf.element)}`}>{inf.element}</span>
                          {inf.target ? (
                            <span>→ {content.skills[inf.target]?.name}</span>
                          ) : (
                            <select
                              aria-label={`${def.name} ${inf.element} infusion target`}
                              value={eq.targets?.[i] ?? ''}
                              disabled={unused}
                              onChange={(e) => {
                                const targets = [...(eq.targets ?? [])];
                                while (targets.length <= i) targets.push(null);
                                targets[i] = e.target.value || null;
                                update({ targets });
                              }}
                            >
                              <option value="">choose a skill…</option>
                              {resolved.skills.map((s) => (
                                <option key={s.base} value={s.base}>
                                  {content.skills[s.base]?.name}
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
                                const next = { ...eq, unused: [...set].sort() };
                                if (next.unused.length === 0) delete (next as { unused?: number[] }).unused;
                                setDraft(setSlot(draft, ref, next));
                              }}
                            />
                            unused
                          </label>
                        </div>
                      );
                    })}
                    {def.passive && (
                      <p className="passive">
                        <b>Passive</b> {def.passive}
                        {def.passiveEffect ? (
                          // The implementation's own wording spells out the rulings (docs/equipment.md).
                          <span className="muted"> — in play: {content.statuses[def.passiveEffect]?.description}</span>
                        ) : (
                          <span className="muted"> (not active yet)</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-label="Presets">
        <div className="section-head">
          <span className="panel-title">Presets</span>
          <input type="text" aria-label="Preset name" placeholder="Preset name" maxLength={24} value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <button type="button" className="btn small" disabled={!presetName.trim() || resolved.problems.length > 0} onClick={() => void savePreset()}>
            Save current as preset
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="muted">No presets yet.</p>
        ) : (
          <div className="preset-list">
            {presets.map((p) => (
              <div key={p.id} className="preset">
                <span>{p.name}</span>
                <button type="button" className="btn small" onClick={() => void applyPreset(p)}>
                  Apply
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => void api.deletePreset(c.id, p.id).then(() => setPresets(presets.filter((x) => x.id !== p.id)))}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
