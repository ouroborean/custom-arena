// The action popup: while a turn plays back, each skill use shows as a small panel ("Ember Mage used
// Fireball on Red Ranger 1"), with the actor's portrait, the skill's icon and the targets' portraits.
// Decorative: the battle log and the announcer carry the same information for screen readers.

import { useEffect, useState } from 'react';
import type { ContentBundle, Unit } from '@arena/engine';
import { portraitKey } from '../assets.js';
import { useStore, type ShownAction } from '../store.js';
import { elementClass, PortraitArt, portraitStyle, SkillGlyph, unitCode } from './common.js';

/** How long a popup stays at 1× (it's cut short by the next action, and scaled by the speed). */
const SHOW_MS = 2200;

export function ActionPopup({ units, content }: { units: readonly Unit[]; content: ContentBundle }) {
  const action = useStore((s) => s.action);
  const speed = useStore((s) => s.speed);
  const viewer = useStore((s) => s.viewer);
  const [shown, setShown] = useState<ShownAction | null>(null);

  useEffect(() => {
    if (!action) return;
    setShown(action);
    const t = setTimeout(() => setShown((s) => (s?.id === action.id ? null : s)), SHOW_MS / Math.max(1, speed));
    return () => clearTimeout(t);
  }, [action, speed]);

  const actor = shown ? units.find((u) => u.id === shown.actor) : undefined;
  if (!shown || !actor) return <div className="action-slot" />;
  const def = content.skills[shown.skill];
  const targets = shown.targets.map((id) => units.find((u) => u.id === id)).filter((u): u is Unit => !!u);
  return (
    <div className="action-slot">
      <div key={shown.id} className={`action-popup ${actor.owner === viewer ? 'ally' : 'foe'}`}>
        <Face unit={actor} />
        <div className="action-text">
          <span className="action-actor">{actor.name}</span>
          <span className="action-used">
            used{' '}
            <span className={`action-skill ${elementClass(def?.element)}`}>
              {def && <SkillGlyph def={def} content={content} />}
              {def?.name ?? 'a hidden skill'}
            </span>
          </span>
          {targets.length > 0 && (
            <span className="action-targets">
              on
              {targets.map((t) => (
                <span key={t.id} className="action-target">
                  <Face unit={t} small />
                  {t.name}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** A unit's portrait square, as on the board but small. */
function Face({ unit, small }: { unit: Unit; small?: boolean }) {
  return (
    <span className={`action-face${small ? ' small' : ''} ${elementClass(unit.element)}`} style={portraitStyle(unit.defId)} aria-hidden>
      <PortraitArt artKey={portraitKey({ kind: unit.kind, defId: unit.defId, classId: unit.defId, element: unit.element ?? 'None' })} />
      <span className="mono">{unitCode(unit)}</span>
    </span>
  );
}
