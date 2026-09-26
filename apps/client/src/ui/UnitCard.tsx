import { effectDefinition, effectName, type ContentBundle, type EffectInstance, type PlayerId, type PlayerView, type SkillAvailability, type Unit } from '@arena/engine';
import { useStore } from '../store.js';
import { CostPips, durationText, hueFor, initials, Tooltip } from './common.js';
import { SkillButton } from './SkillButton.js';

function StatusChip({ e, content, view }: { e: EffectInstance; content: ContentBundle; view: PlayerView }) {
  const def = effectDefinition(content, e);
  const name = effectName(content, e.defId);
  const source = view.units.find((u) => u.id === e.source)?.name ?? '—';
  const hiddenFromEnemy = def?.visibility === 'hidden' && !e.revealed;
  const short = name.replace(/\s*\(.*\)/, '');
  return (
    <Tooltip
      content={
        <>
          <h4>
            {name} {e.stacks > 1 ? `×${e.stacks}` : ''}
          </h4>
          <div>{def?.description ?? ''}</div>
          {e.value > 0 && <div className="row">Value: {e.value}</div>}
          <div className="row">{durationText(e.duration)}</div>
          <div className="row">From {source}</div>
          {hiddenFromEnemy && <div className="row">Hidden from your opponent</div>}
        </>
      }
    >
      <span className={`chip ${def?.kind ?? 'Neutral'}${hiddenFromEnemy ? ' hidden' : ''}`} tabIndex={0}>
        {short}
        {e.stacks > 1 && <span className="n">×{e.stacks}</span>}
        {e.value > 0 && <span className="n">({e.value})</span>}
        {e.duration !== null && <span className="d">{e.duration}</span>}
      </span>
    </Tooltip>
  );
}

export function UnitCard({
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
  const floats = allFloats.filter((f) => f.unit === unit.id);
  const removeFloat = useStore((s) => s.removeFloat);
  const chooseTarget = useStore((s) => s.chooseTarget);
  const playing = useStore((s) => s.pending.length > 0);

  const hp = displayHp[unit.id] ?? unit.hp;
  const alive = hp > 0 && unit.alive;
  const effects = view.effects.filter((e) => e.bearer === unit.id);
  const shield = effects
    .filter((e) => effectDefinition(content, e)?.shield)
    .reduce((n, e) => n + e.value, 0);
  const pct = Math.max(0, Math.min(100, (hp / unit.maxHp) * 100));
  const shieldPct = Math.min(100 - pct, (shield / unit.maxHp) * 100);
  const hpClass = pct <= 30 ? 'low' : pct <= 60 ? 'mid' : '';
  const targetable = !!targeting && targeting.options.some((o) => o[0] === unit.id);
  const mine = unit.owner === viewer;
  const queue = mine ? (view.players[viewer].queue ?? []) : [];
  const queueIndex = queue.findIndex((q) => q.actor === unit.id);
  const queued = queueIndex >= 0 ? queue[queueIndex] : undefined;
  const queuedDef = queued ? content.skills[unit.skills[queued.slot]!.defId] : undefined;
  const queuedTarget = queued?.targets[0] ? view.units.find((u) => u.id === queued.targets[0])?.name : undefined;
  const cls = unit.kind === 'character' ? content.classes[unit.defId]?.name : 'Minion';
  const hue = hueFor(unit.defId);

  const cardClass = [
    'unit',
    unit.kind === 'minion' ? 'minion' : '',
    alive ? '' : 'dead',
    targetable ? 'targetable' : '',
    targeting?.actor === unit.id ? 'acting' : '',
    hit ? 'hit' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cardClass}
      role={targetable ? 'button' : undefined}
      tabIndex={targetable ? 0 : undefined}
      aria-label={targetable ? `Target ${unit.name}` : undefined}
      onClick={targetable ? () => chooseTarget(unit.id) : undefined}
      onKeyDown={targetable ? (ev) => (ev.key === 'Enter' || ev.key === ' ') && chooseTarget(unit.id) : undefined}
    >
      <div className="unit-head">
        <div
          className="portrait"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue} 60% 24%))` }}
          aria-hidden
        >
          {initials(unit.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="unit-name">{unit.name}</div>
          <div className="unit-sub">{cls}</div>
        </div>
      </div>

      <div className="hpbar" aria-label={`${hp} of ${unit.maxHp} health${shield ? `, ${shield} shield` : ''}`}>
        <div className={`fill ${hpClass}`} style={{ width: `${pct}%` }} />
        {shield > 0 && <div className="shield" style={{ left: `${pct}%`, width: `${shieldPct}%` }} />}
        <div className="label">
          {alive ? `${hp} / ${unit.maxHp}` : 'Defeated'}
          {shield > 0 ? `  +${shield}` : ''}
        </div>
      </div>

      <div className="statuses">
        {effects.map((e) => (
          <StatusChip key={e.id} e={e} content={content} view={view} />
        ))}
      </div>

      {mine && alive && unit.skills.length > 0 && (
        <div className="skills">
          {unit.skills.map((slot, i) => (
            <SkillButton
              key={i}
              unit={unit}
              slot={i}
              content={content}
              availability={availability.find((a) => a.actor === unit.id && a.slot === i)}
              queued={queued?.slot === i}
              queueIndex={queueIndex}
              disabled={playing}
            />
          ))}
        </div>
      )}

      {!mine && alive && unit.skills.length > 0 && (
        <div className="skills compact">
          {unit.skills.map((slot, i) => {
            const d = content.skills[slot.defId]!;
            return (
              <Tooltip
                key={i}
                content={
                  <>
                    <h4>{d.name}</h4>
                    <div>{d.description}</div>
                    <div className="row">
                      <CostPips cost={d.cost} /> · cooldown {d.cooldown}
                    </div>
                  </>
                }
              >
                <span className="mini" tabIndex={0}>
                  {d.name}
                  {slot.cooldown > 0 ? ` (${slot.cooldown})` : ''}
                </span>
              </Tooltip>
            );
          })}
        </div>
      )}

      {queued && queuedDef && !playing && (
        <div className="queued-note">
          Queued: {queuedDef.name}
          {queuedTarget ? ` → ${queuedTarget}` : ''}
        </div>
      )}

      <div className="floats" aria-hidden>
        {floats.map((f) => (
          <div key={f.id} className={`float ${f.kind}`} onAnimationEnd={() => removeFloat(f.id)}>
            {f.text}
          </div>
        ))}
      </div>
    </div>
  );
}
