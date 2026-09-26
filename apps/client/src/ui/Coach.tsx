// The tutorial coach (GDD Phase 6 "step-scripted using engine hooks"): the current step's text, a
// "Got it" button for steps that only ask the player to read, and a highlight on the part of the
// screen the step is about. The store refuses commands the step doesn't ask for.

import type { CoachTarget } from '@arena/engine';
import { useStore } from '../store.js';

/** CSS selector for a coach target (data hooks in Panels, UnitRow and Battle). */
function selectorFor(t: CoachTarget): string {
  if (typeof t === 'string') return `[data-coach="${t}"]`;
  if ('skill' in t) return `.tile[data-skill="${t.skill}"], .tile[data-skill^="${t.skill}."]`;
  return `[data-unit="${t.unit}"]:not(.tile)`;
}

export function Coach() {
  const match = useStore((s) => s.match);
  const coach = useStore((s) => s.coach);
  const next = useStore((s) => s.coachNext);
  if (!match || !coach) return null;
  const script = match.content.tutorial[coach.lesson];
  const step = script?.steps[coach.step];
  if (!script || !step) return null;
  return (
    <aside className="coach" role="status" aria-live="polite">
      {step.highlight && (
        // A rule rather than a class on the element, so React re-renders can't drop it.
        <style>{`${selectorFor(step.highlight)} { outline: 3px solid var(--yellow); outline-offset: 2px; animation: coach-pulse 1.2s ease-in-out infinite; }`}</style>
      )}
      <span className="coach-step">
        Tip {coach.step + 1}/{script.steps.length}
      </span>
      <p>{step.text}</p>
      {!step.expect && (
        <button type="button" className="btn small primary" autoFocus onClick={next}>
          Got it
        </button>
      )}
    </aside>
  );
}
