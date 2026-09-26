import {
  effectDefinition,
  effectName,
  type ContentBundle,
  type EffectInstance,
  type PlayerId,
  type PlayerView,
  type SkillAvailability,
  type Unit,
} from '@arena/engine';
import { useStore } from '../store.js';
import { CostPips, portraitStyle, skillCategory, skillCode, statusCode, unitCode, useMediaQuery } from './common.js';

function StatusChip({ e, content }: { e: EffectInstance; content: ContentBundle }) {
  const setInspect = useStore((s) => s.setInspect);
  const def = effectDefinition(content, e);
  const name = effectName(content, e.defId);
  const key = e.inline?.id ?? e.defId;
  const hidden = def?.visibility === 'hidden' && !e.revealed;
  const inspect = () => setInspect({ kind: 'effect', effect: e.id });
  return (
    <button
      type="button"
      className={`chip ${def?.kind ?? 'Neutral'}${hidden ? ' hidden' : ''}`}
      aria-label={`${name}${e.stacks > 1 ? ` ×${e.stacks}` : ''}${e.duration !== null ? `, ${e.duration} turn ends left` : ''}`}
      onMouseEnter={inspect}
      onFocus={inspect}
      onClick={inspect}
    >
      {statusCode(key, name)}
      {e.duration !== null && <span className="d">{e.duration}</span>}
      {(e.stacks > 1 || e.value > 0) && <span className="n">{e.value > 0 ? e.value : `×${e.stacks}`}</span>}
    </button>
  );
}

function SkillTile({
  unit,
  slot,
  content,
  availability,
  queued,
  queueIndex,
  locked,
}: {
  unit: Unit;
  slot: number;
  content: ContentBundle;
  availability: SkillAvailability | undefined;
  queued: boolean;
  queueIndex: number;
  locked: boolean;
}) {
  const targeting = useStore((s) => s.targeting);
  const selectSkill = useStore((s) => s.selectSkill);
  const unqueue = useStore((s) => s.unqueue);
  const setInspect = useStore((s) => s.setInspect);
  const s = unit.skills[slot]!;
  const def = content.skills[s.defId]!;
  const cost = availability?.cost ?? def.cost;
  const usable = !!availability && availability.targets.length > 0;
  const selected = targeting?.actor === unit.id && targeting.slot === slot;
  const reason = !usable && !queued ? availability?.reason : null;
  const inspect = () => setInspect({ kind: 'skill', unit: unit.id, slot });

  return (
    <div className="tile-wrap">
      <button
        type="button"
        className={`tile cat-${skillCategory(def)}${selected ? ' selected' : ''}${queued ? ' queued' : ''}`}
        disabled={locked || (!usable && !queued)}
        aria-pressed={selected || queued}
        aria-label={`${def.name}${s.cooldown > 0 ? `, cooldown ${s.cooldown}` : ''}${queued ? ', queued' : ''}${reason ? `, unavailable: ${reason}` : ''}`}
        onMouseEnter={inspect}
        onFocus={inspect}
        onClick={() => (queued && queueIndex >= 0 ? unqueue(queueIndex) : selectSkill(unit.id, slot))}
      >
        <span className="code">{skillCode(def)}</span>
        <CostPips cost={cost} />
        {s.cooldown > 0 && <span className="cd">{s.cooldown}</span>}
      </button>
      <span className="tile-name" aria-hidden>
        {def.name}
      </span>
    </div>
  );
}

export function UnitRow({
  unit,
  view,
  viewer,
  content,
  availability,
  hit,
}: {
  unit: Unit;
  view: PlayerView;
  viewer: PlayerId;
  content: ContentBundle;
  availability: SkillAvailability[];
  hit: boolean;
}) {
  const targeting = useStore((s) => s.targeting);
  const displayHp = useStore((s) => s.displayHp);
  const allFloats = useStore((s) => s.floats);
  const removeFloat = useStore((s) => s.removeFloat);
  const chooseTarget = useStore((s) => s.chooseTarget);
  const setInspect = useStore((s) => s.setInspect);
  const playing = useStore((s) => s.pending.length > 0);

  const floats = allFloats.filter((f) => f.unit === unit.id);
  const mine = unit.owner === viewer;
  const hp = displayHp[unit.id] ?? unit.hp;
  const alive = hp > 0 && unit.alive;
  const effects = view.effects.filter((e) => e.bearer === unit.id);
  const shield = effects.filter((e) => effectDefinition(content, e)?.shield).reduce((n, e) => n + e.value, 0);
  const pct = Math.max(0, Math.min(100, (hp / unit.maxHp) * 100));
  const shieldPct = Math.min(100 - pct, (shield / unit.maxHp) * 100);
  const hpClass = pct <= 30 ? 'low' : pct <= 60 ? 'mid' : '';
  const targetable = !!targeting && targeting.options.some((o) => o[0] === unit.id);
  const queue = mine ? (view.players[viewer].queue ?? []) : [];
  const queueIndex = queue.findIndex((q) => q.actor === unit.id);
  const queued = queueIndex >= 0 ? queue[queueIndex] : undefined;
  const queuedDef = queued ? content.skills[unit.skills[queued.slot]!.defId] : undefined;
  const queuedTarget = queued?.targets[0] ? view.units.find((u) => u.id === queued.targets[0])?.name : undefined;
  const inspectUnit = () => setInspect({ kind: 'unit', unit: unit.id });
  // The status grid has a fixed size so rows never grow; extra effects collapse into "+N".
  const narrow = useMediaQuery('(max-width: 900px)');
  const phone = useMediaQuery('(max-width: 600px)');
  const statusLimit = !mine && narrow ? 4 : unit.kind === 'minion' ? 6 : phone ? 8 : 15;

  const rowClass = ['unit-row', mine ? '' : 'enemy', unit.kind === 'minion' ? 'minion' : '', alive ? '' : 'dead', hit ? 'hit' : '']
    .filter(Boolean)
    .join(' ');

  const portraitInner = (
    <>
      <span className="mono">{unitCode(unit)}</span>
      <span className="tag">{unit.name}</span>
      {queued && queuedDef && !playing && (
        <span className="queued-slot" title={`Queued: ${queuedDef.name}${queuedTarget ? ` → ${queuedTarget}` : ''}`}>
          {queuedDef.name}
          {queuedTarget ? ` → ${queuedTarget}` : ''}
        </span>
      )}
      <span className="floats" aria-hidden>
        {floats.map((f) => (
          <span key={f.id} className={`float ${f.kind}`} onAnimationEnd={() => removeFloat(f.id)}>
            {f.text}
          </span>
        ))}
      </span>
    </>
  );

  return (
    <div className={rowClass}>
      <div className="fighter">
        {targetable ? (
          <button
            type="button"
            className="portrait targetable"
            style={portraitStyle(unit.defId)}
            aria-label={`Target ${unit.name}`}
            onClick={() => chooseTarget(unit.id)}
            onMouseEnter={inspectUnit}
            onFocus={inspectUnit}
          >
            {portraitInner}
          </button>
        ) : (
          <div
            className={`portrait${targeting?.actor === unit.id ? ' acting' : ''}`}
            style={portraitStyle(unit.defId)}
            tabIndex={0}
            role="group"
            aria-label={`${unit.name}, ${hp} of ${unit.maxHp} health`}
            onMouseEnter={inspectUnit}
            onFocus={inspectUnit}
          >
            {portraitInner}
          </div>
        )}
        <div className="hpbar" aria-hidden>
          <div className={`fill ${hpClass}`} style={{ width: `${pct}%` }} />
          {shield > 0 && <div className="shield" style={{ left: `${pct}%`, width: `${shieldPct}%` }} />}
        </div>
        <div className="hptext">
          {alive ? `${hp} / ${unit.maxHp}` : 'KO'}
          {shield > 0 && <span className="sh"> +{shield}</span>}
        </div>
      </div>

      <div className="statuses box" aria-label={`${unit.name} effects`}>
        {(effects.length > statusLimit ? effects.slice(0, statusLimit - 1) : effects).map((e) => (
          <StatusChip key={e.id} e={e} content={content} />
        ))}
        {effects.length > statusLimit && (
          <button
            type="button"
            className="chip more"
            aria-label={`${effects.length - statusLimit + 1} more effects`}
            onMouseEnter={inspectUnit}
            onFocus={inspectUnit}
            onClick={inspectUnit}
          >
            +{effects.length - statusLimit + 1}
          </button>
        )}
      </div>

      {mine && unit.skills.length > 0 && (
        <div className="strip">
          {unit.skills.map((_, i) => (
            <SkillTile
              key={i}
              unit={unit}
              slot={i}
              content={content}
              availability={availability.find((a) => a.actor === unit.id && a.slot === i)}
              queued={queued?.slot === i}
              queueIndex={queueIndex}
              locked={playing || !alive}
            />
          ))}
        </div>
      )}

      {!mine && unit.skills.length > 0 && (
        <div className="enemy-skills" aria-label={`${unit.name} skills`}>
          {unit.skills.map((slot, i) => {
            const d = content.skills[slot.defId]!;
            return (
              <span key={i} className="mini" onMouseEnter={inspectUnit}>
                <span>{d.name}</span>
                <span className="cdn">{slot.cooldown > 0 ? slot.cooldown : ''}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
