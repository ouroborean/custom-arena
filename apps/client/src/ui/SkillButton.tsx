import type { ContentBundle, SkillAvailability, Unit } from '@arena/engine';
import { useStore } from '../store.js';
import { CostPips, Tooltip } from './common.js';

const TARGET_TEXT: Record<string, string> = {
  self: 'Self',
  enemy: 'One enemy',
  ally: 'One ally',
  allEnemies: 'All enemies',
  allAllies: 'All allies',
  none: 'No target',
};

export function SkillButton({
  unit,
  slot,
  content,
  availability,
  queued,
  queueIndex,
  disabled,
}: {
  unit: Unit;
  slot: number;
  content: ContentBundle;
  availability: SkillAvailability | undefined;
  queued: boolean;
  queueIndex: number;
  disabled: boolean;
}) {
  const targeting = useStore((s) => s.targeting);
  const selectSkill = useStore((s) => s.selectSkill);
  const unqueue = useStore((s) => s.unqueue);
  const s = unit.skills[slot]!;
  const def = content.skills[s.defId]!;
  const cost = availability?.cost ?? def.cost;
  const usable = !!availability && availability.targets.length > 0;
  const selected = targeting?.actor === unit.id && targeting.slot === slot;
  const reason = queued ? null : (availability?.reason ?? null);

  const onClick = () => {
    if (queued && queueIndex >= 0) unqueue(queueIndex);
    else selectSkill(unit.id, slot);
  };

  return (
    <Tooltip
      block
      content={
        <>
          <h4>{def.name}</h4>
          <div>{def.description}</div>
          <div className="row">
            <CostPips cost={cost} base={def.cost} /> · cooldown {def.cooldown} · {TARGET_TEXT[def.target]}
          </div>
          <div className="row">{def.tags.filter((t) => t !== 'NonStrategic').join(' · ')}</div>
          {queued && <div className="row hint">Queued. Click to remove it.</div>}
          {!queued && reason && <div className="row" style={{ color: '#f1a1a4' }}>{reason}</div>}
        </>
      }
    >
      <button
        type="button"
        className={`skill${selected ? ' selected' : ''}${queued ? ' queued' : ''}`}
        disabled={disabled || (!usable && !queued)}
        aria-pressed={selected || queued}
        aria-label={`${def.name}${s.cooldown > 0 ? `, cooldown ${s.cooldown}` : ''}${queued ? ', queued' : ''}${
          !usable && !queued && reason ? `, unavailable: ${reason}` : ''
        }`}
        onClick={onClick}
        style={{ width: '100%' }}
      >
        <span className="name">{def.name}</span>
        <CostPips cost={cost} base={def.cost} />
        {s.cooldown > 0 && <span className="cd" aria-label={`Cooldown ${s.cooldown}`}>{s.cooldown}</span>}
      </button>
    </Tooltip>
  );
}
