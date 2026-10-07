// Character page: rename/retire, effective skills, the loadout editor (GDD §7.3, §8.3) and presets.
// The loadout is validated live with the same @arena/meta rules the server enforces on save.

import { useEffect, useMemo, useState } from 'react';
import { EQUIPMENT_SLOTS, MAX_SKILLS, PASSIVE_BUDGET, resolveLoadout, type Loadout } from '@arena/meta';
import { api, ApiError, type Character, type Preset } from '../api.js';
import { content } from '../content.js';
import { useGuide } from '../guides.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';
import { LoadoutEditor } from './LoadoutEditor.js';
import { Portrait, recordOf, SkillChips } from './Roster.js';

/** JSON with sorted keys: the server's jsonb storage doesn't keep key order. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
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
  return (
    <CharacterPage
      key={c.id}
      c={c}
      characters={characters}
      inventory={inventory}
      inTeam={team.includes(c.id)}
      busy={busy}
      onRename={rename}
      onRetire={retire}
      onSaved={refresh}
    />
  );
}

function CharacterPage({
  c,
  characters,
  inventory,
  inTeam,
  busy,
  onRename,
  onRetire,
  onSaved,
}: {
  c: Character;
  characters: Character[];
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
  const record = useMemo(() => recordOf(c), [c]);
  const resolved = useMemo(() => resolveLoadout(content, record, draft), [record, draft]);
  const dirty = canonical(draft) !== canonical(c.loadout);

  // The Equipment and Infusions guides follow the unsaved loadout.
  const setGuideSignals = useGuide((s) => s.setSignals);
  const countForGuide = useGuide((s) => s.count);
  const itemsKey = draft.items.map((i) => `${i.itemId}:${i.instanceId ?? ''}`).join(',');
  const infusionsKey = draft.infusions.map((i) => `${i.skill}:${i.element}`).join(',');
  useEffect(() => setGuideSignals({ draftItems: itemsKey, draftInfusions: infusionsKey }), [itemsKey, infusionsKey, setGuideSignals]);
  useEffect(() => () => setGuideSignals({ draftItems: '', draftInfusions: '' }), [setGuideSignals]);

  useEffect(() => {
    api.presets(c.id).then((r) => setPresets(r.presets), () => setPresets([]));
  }, [c.id]);

  const save = async () => {
    setServerProblems([]);
    setSaved(null);
    try {
      // Pieces another character wears that the player chose to move here come off them on save.
      const take = draft.items
        .map((e) => e.instanceId)
        .filter((id): id is string => !!id && !!inventory.find((i) => i.id === id && i.equippedOn && i.equippedOn !== c.id));
      const r = await api.saveLoadout(c.id, draft, take);
      await onSaved();
      countForGuide('saves');
      setSaved(r.moved.length ? `Loadout saved; moved from ${r.moved.map((m) => m.name).join(', ')}` : 'Loadout saved');
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
            <span>
              {c.element} {content.classes[c.classId]?.name}
            </span>
            <span className="muted">
              {EQUIPMENT_SLOTS} item slots · up to {MAX_SKILLS} skills · {PASSIVE_BUDGET} item passive
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
            {draft.items.length}/{EQUIPMENT_SLOTS} items · {resolved.skills.length}/{MAX_SKILLS} skills · {resolved.usage.passives}/{PASSIVE_BUDGET} passive ·{' '}
            {resolved.usage.infusions} infusions placed
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" disabled={!dirty} onClick={() => setDraft(c.loadout)}>
            Reset
          </button>
          <button
            type="button"
            className="btn primary"
            data-guide="save"
            disabled={!dirty || resolved.problems.length > 0 || busy}
            onClick={() => void save()}
          >
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
        <LoadoutEditor
          character={c}
          record={record}
          draft={draft}
          onChange={setDraft}
          resolved={resolved}
          inventory={inventory}
          characters={characters}
        />
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
