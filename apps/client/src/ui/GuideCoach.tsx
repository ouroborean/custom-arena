// The coach for the menu guides (guides.ts): the current step, a highlight on the part of the screen
// it's about, a way there when the player is elsewhere, and "Got it" for steps that only ask the
// player to read. Steps with `until` move on by themselves once the player has done the thing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { content } from '../content.js';
import { guideById, snapshotOf, useGuide } from '../guides.js';
import { useMeta } from '../meta.js';
import { useStore, type HomeTab } from '../store.js';

/**
 * Reports each guide the player finishes to the server, which records it for the account and pays its
 * reward (economy `guideRewards`) the first time; a payout shows a notice and refreshes the experience
 * bar's boxes.
 */
interface GuidePayout {
  guide: string;
  boxes: string[];
}

function useGuideRewards(): [GuidePayout | null, () => void] {
  const done = useGuide((s) => s.done);
  const recorded = useGuide((s) => s.recorded);
  const claimed = useRef(new Set<string>());
  const [paid, setPaid] = useState<GuidePayout | null>(null);
  useEffect(() => {
    for (const id of done) {
      if (recorded.includes(id) || claimed.current.has(id) || !content.economy.guideRewards?.[id]) continue;
      claimed.current.add(id);
      api.completeGuide(id).then(
        (r) => {
          useGuide.getState().markRecorded(id);
          useMeta.setState({ progress: r.progress });
          if (r.reward?.boxes?.length) setPaid({ guide: guideById(id)?.name ?? id, boxes: r.reward.boxes });
        },
        () => claimed.current.delete(id),
      );
    }
  }, [done, recorded]);
  return [paid, () => setPaid(null)];
}

/** "Guide complete: Recruiting. You earned an Uncommon Loot Box." */
function GuidePaid({ paid, onClose }: { paid: GuidePayout; onClose: () => void }) {
  const names = paid.boxes.map((b) => content.economy.lootBoxes?.[b]?.name ?? b).join(', ');
  return (
    <aside className="coach guide-coach" role="status" aria-live="polite" aria-label="Guide complete">
      <span className="coach-step">{paid.guide} · complete</span>
      <p>
        You earned: <b>{names}</b>. Open it from the experience bar on Home.
      </p>
      <div className="guide-actions">
        <button type="button" className="btn small primary" autoFocus onClick={onClose}>
          Nice
        </button>
      </div>
    </aside>
  );
}

/** The Home tab each highlighted part of Home lives on, so a guide step can open it. */
const HOME_TAB_OF: Record<string, HomeTab> = {
  recruit: 'roster',
  roster: 'roster',
  team: 'roster',
  inventory: 'forge',
  pieces: 'forge',
  forge: 'forge',
  trade: 'forge',
};

export function GuideCoach() {
  const [paid, dismissPaid] = useGuideRewards();
  const homeTab = useStore((s) => s.homeTab);
  const setHomeTab = useStore((s) => s.setHomeTab);
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

  const now = useMemo(() => snapshotOf(characters, signals, screen, characterId, homeTab), [characters, signals, screen, characterId, homeTab]);
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
    rebase(snapshotOf(useMeta.getState().characters, s, screen, characterId, useStore.getState().homeTab));
  }, [active, here, screen, characterId, rebase]);

  // `active` is a dependency too: a step can already be met when it begins (the addition was on the
  // bench before the base), and then nothing else changes to re-run this.
  useEffect(() => {
    if (met) advance(now);
  }, [met, now, active, advance]);

  // A step about part of Home opens the tab it's on.
  const wantTab = screen === 'home' && step?.highlight ? HOME_TAB_OF[step.highlight] : undefined;
  useEffect(() => {
    if (wantTab && wantTab !== homeTab) setHomeTab(wantTab);
  }, [wantTab, homeTab, setHomeTab]);

  if (screen === 'battle') return null;
  if (!active || !guide || !step) return paid ? <GuidePaid paid={paid} onClose={dismissPaid} /> : null;

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
