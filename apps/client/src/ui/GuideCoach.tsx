// The coach for the menu guides (guides.ts): the current step, a highlight on the part of the screen
// it's about, a way there when the player is elsewhere, and "Got it" for steps that only ask the
// player to read. Steps with `until` move on by themselves once the player has done the thing.

import { useEffect, useMemo } from 'react';
import { guideById, snapshotOf, useGuide } from '../guides.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';

export function GuideCoach() {
  const active = useGuide((s) => s.active);
  const signals = useGuide((s) => s.signals);
  const advance = useGuide((s) => s.advance);
  const rebase = useGuide((s) => s.rebase);
  const stop = useGuide((s) => s.stop);
  const begin = useGuide((s) => s.begin);
  const screen = useStore((s) => s.screen);
  const characterId = useStore((s) => s.characterId);
  const go = useStore((s) => s.go);
  const characters = useMeta((s) => s.characters);
  const team = useMeta((s) => s.team);

  const now = useMemo(() => snapshotOf(characters, signals, screen, characterId), [characters, signals, screen, characterId]);
  const guide = active ? guideById(active.id) : undefined;
  const step = active && guide ? guide.steps[active.step] : undefined;
  const elsewhere = !!step?.screen && step.screen !== screen;
  // A step is judged from where the player stood when they reached its screen (or character).
  const here = !!active && active.start.screen === screen && active.start.characterId === characterId;
  const met = !!(active && step?.until && !elsewhere && here && step.until(now, active.start));

  useEffect(() => {
    if (!active || here) return;
    // The screens report their state in their own effects; read it fresh rather than from this render.
    const s = useGuide.getState().signals;
    rebase(snapshotOf(useMeta.getState().characters, s, screen, characterId));
  }, [active, here, screen, characterId, rebase]);

  // `active` is a dependency too: a step can already be met when it begins (the addition was on the
  // bench before the base), and then nothing else changes to re-run this.
  useEffect(() => {
    if (met) advance(now);
  }, [met, now, active, advance]);

  if (!active || !guide || !step || screen === 'battle') return null;

  const needsRecruit = guide.needsCharacter && characters.length === 0;
  const firstCharacter = team[0] ?? characters[0]?.id;
  const goThere = () => {
    if (step.screen === 'character' && firstCharacter) go('character', firstCharacter);
    else if (step.screen === 'home') go('home');
  };

  return (
    <aside className="coach guide-coach" role="status" aria-live="polite" aria-label={`${guide.name} guide`}>
      {step.highlight && !elsewhere && (
        // A rule rather than a class on the element, so re-renders can't drop it.
        <style>{`[data-guide="${step.highlight}"] { outline: 3px solid var(--yellow); outline-offset: 3px; animation: coach-pulse 1.2s ease-in-out infinite; }`}</style>
      )}
      <span className="coach-step">
        {guide.name} · {active.step + 1}/{guide.steps.length}
      </span>
      <p>{needsRecruit ? 'This guide needs a character to work with. Recruit one first: the Recruiting guide shows how.' : step.text}</p>
      <div className="guide-actions">
        {needsRecruit ? (
          <button type="button" className="btn small primary" onClick={() => begin('recruit', now)}>
            Start Recruiting
          </button>
        ) : elsewhere ? (
          <button type="button" className="btn small primary" onClick={goThere}>
            {step.screen === 'character' ? 'Open a character' : 'Go to Home'}
          </button>
        ) : (
          !step.until && (
            <button type="button" className="btn small primary" autoFocus onClick={() => advance(now)}>
              {active.step + 1 === guide.steps.length ? 'Done' : 'Got it'}
            </button>
          )
        )}
        <button type="button" className="btn small" onClick={stop}>
          End guide
        </button>
      </div>
    </aside>
  );
}
