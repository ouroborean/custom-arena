// Guides: coached walkthroughs of the menus (recruiting, equipment, infusions, forging), the meta
// counterpart of the battle lessons. A step shows text, highlights a `data-guide` hook, and either
// waits for "Got it" or moves on by itself once the player has done what it asks (`until`), judged
// from the account's own state, so nothing is faked: the player recruits, equips and forges for real.

import { create } from 'zustand';
import type { Character } from './api.js';

/** Where a step happens; the coach offers to take the player there. */
export type GuideScreen = 'home' | 'character';

/** What `until` can look at: counts from the account and from the screens' unsaved state. */
export interface GuideSnapshot {
  characters: number;
  /** The open character's (unsaved) items and infusions, as keys that change with any edit. */
  draftItems: string;
  draftInfusions: string;
  /** Loadouts saved and pieces forged since the page loaded. */
  saves: number;
  forges: number;
  /** Pieces on the forge bench. */
  benchBase: boolean;
  benchAddition: boolean;
  screen: string;
  characterId: string | null;
}

type Signals = Pick<GuideSnapshot, 'draftItems' | 'draftInfusions' | 'saves' | 'forges' | 'benchBase' | 'benchAddition'>;

export interface GuideStep {
  text: string;
  screen?: GuideScreen;
  /** A `data-guide` hook to outline. */
  highlight?: string;
  /** Moves on by itself once this holds (`start`: the snapshot when the step began). */
  until?: (now: GuideSnapshot, start: GuideSnapshot) => boolean;
}

export interface Guide {
  id: string;
  name: string;
  description: string;
  /** Needs a character to work with (the coach points to Recruiting first otherwise). */
  needsCharacter?: boolean;
  steps: GuideStep[];
}

export const GUIDES: Guide[] = [
  {
    id: 'recruit',
    name: 'Recruiting',
    description: 'Build your roster and pick the team you take into battle.',
    steps: [
      {
        screen: 'home',
        highlight: 'wallet',
        text: 'Characters are recruited with Gold. Each recruit costs 100; new accounts start with 1000, and matches, the story and the arcade pay more.',
      },
      {
        screen: 'home',
        highlight: 'recruit',
        text: 'Click "Recruit a character". You get a random class (favoring classes you have fewer of) and a random element.',
        until: (now, start) => now.characters > start.characters,
      },
      {
        screen: 'home',
        highlight: 'roster',
        text: "Every recruit knows their class's signature skill plus one more from its pool, and carries one infusion of their element to place on a skill. Equipment adds the rest.",
      },
      {
        screen: 'home',
        highlight: 'team',
        text: 'Your first three recruits become your active team: the three you take into practice, the story, the arcade and online matches. "Change team" picks a different three, in battle order.',
      },
      {
        highlight: 'roster',
        text: "Click a character's card to open them. Their page shows their skills and loadout; the Equipment and Infusions guides go on from there.",
        until: (now) => now.screen === 'character',
      },
    ],
  },
  {
    id: 'equip',
    name: 'Equipment',
    description: 'Put pieces on a character and prepare the skills they grant.',
    needsCharacter: true,
    steps: [
      {
        screen: 'character',
        highlight: 'slots',
        text: 'Each character has 4 equipment slots. A piece can grant a skill, an infusion (a Shard), a passive (a Sigil), or up to three of those forged together.',
      },
      {
        screen: 'character',
        highlight: 'items',
        text: 'Your pieces are listed here; hover one to see what it does and how it fits this character. Click a piece to equip it.',
        until: (now, start) => now.draftItems !== start.draftItems,
      },
      {
        screen: 'character',
        highlight: 'skillPool',
        text: 'Skills from equipment go into this pool. A character takes at most 5 skills into battle: prepare the ones you want (✓) and leave the rest in the pool.',
      },
      {
        screen: 'character',
        highlight: 'slots',
        text: 'Only one item passive (Sigil) works at a time. To change a slot, click it and pick a replacement, or remove it with ×.',
      },
      {
        screen: 'character',
        highlight: 'save',
        text: 'Changes only count once saved. Click "Save loadout".',
        until: (now, start) => now.saves > start.saves,
      },
    ],
  },
  {
    id: 'infuse',
    name: 'Infusions',
    description: 'Turn skills into elemental versions, and two elements into a fusion.',
    needsCharacter: true,
    steps: [
      {
        screen: 'character',
        highlight: 'infusions',
        text: "This is the character's infusion pool. Everyone starts with one infusion of their own element; every Shard you equip adds one of its element.",
      },
      {
        screen: 'character',
        highlight: 'infusions',
        text: 'Pick a skill and click "+ <element>" next to it. The skill becomes that element\'s version: hover the button first to see what it turns into.',
        until: (now, start) => now.draftInfusions !== start.draftInfusions,
      },
      {
        screen: 'character',
        highlight: 'infusions',
        text: 'A skill holds up to two infusions. A second one turns it into the fusion of the two elements (Fire + Ice is Apocalypse, Fire + Fire is Dragon), with its own mechanics. Click an infusion to take it back off.',
      },
      {
        screen: 'character',
        highlight: 'save',
        text: 'Click "Save loadout" to keep it.',
        until: (now, start) => now.saves > start.saves,
      },
    ],
  },
  {
    id: 'forge',
    name: 'Forging',
    description: 'Combine pieces into stronger ones, split them, or salvage them for Gold.',
    steps: [
      {
        screen: 'home',
        highlight: 'inventory',
        text: 'Your inventory holds pieces made of components: Skills, Shards (infusions) and Sigils (passives). Matches, the story and the arcade drop new ones.',
      },
      {
        screen: 'home',
        highlight: 'pieces',
        text: 'Click a piece you aren\'t wearing, then "Use as base". The base keeps its name; what you add to it gives it a prefix or suffix.',
        until: (now) => now.benchBase,
      },
      {
        screen: 'home',
        highlight: 'pieces',
        text: 'Now pick a second piece and click "Use as addition". A piece holds up to 3 components, with at most one Sigil and no skill twice.',
        until: (now) => now.benchAddition,
      },
      {
        screen: 'home',
        highlight: 'forge',
        text: 'The bench shows what you\'d make. Forging two pieces costs 50 Gold (100 for three components). Click "Forge".',
        until: (now, start) => now.forges > start.forges,
      },
      {
        screen: 'home',
        highlight: 'pieces',
        text: 'A forged piece fills one slot with everything it holds. "Split" takes it back apart for a small fee, and "Salvage" turns any spare piece into Gold.',
      },
    ],
  },
];

export const guideById = (id: string) => GUIDES.find((g) => g.id === id);

// Finished guides belong to the account, not the browser: the server keeps them (GET /api/guides),
// and finishing one records it there (POST /api/guides/:id/complete, which also pays its reward).
// Older builds kept them in localStorage, which leaked one account's guides into another's.
try {
  localStorage.removeItem('arena:guides:done');
} catch {
  // Storage blocked: nothing to clean up.
}

export function snapshotOf(characters: Character[], signals: Signals, screen: string, characterId: string | null): GuideSnapshot {
  return { characters: characters.length, ...signals, screen, characterId };
}

interface GuideState {
  active: { id: string; step: number; start: GuideSnapshot } | null;
  /** Guides the signed-in account has finished: the server's list plus any finished since. */
  done: string[];
  /** Of those, the ones the server has recorded; the rest still need reporting. */
  recorded: string[];
  /** The account's finished guides from the server (sign-in, refresh); [] when signed out. */
  load(done: string[]): void;
  /** The server has recorded a finished guide. */
  markRecorded(id: string): void;
  /** What the screens report (see GuideSnapshot). */
  signals: Signals;
  begin(id: string, now: GuideSnapshot): void;
  /** Takes the current step's starting point again (the player moved to another screen or character). */
  rebase(now: GuideSnapshot): void;
  /** Moves to the next step (finishing the guide after the last). */
  advance(now: GuideSnapshot): void;
  stop(): void;
  setSignals(s: Partial<Signals>): void;
  /** A loadout was saved, or a piece forged. */
  count(what: 'saves' | 'forges'): void;
}

export const useGuide = create<GuideState>((set, get) => ({
  active: null,
  done: [],
  recorded: [],
  load(done) {
    set({ done: [...done], recorded: [...done] });
  },
  markRecorded(id) {
    if (!get().recorded.includes(id)) set({ recorded: [...get().recorded, id] });
  },
  signals: { draftItems: '', draftInfusions: '', saves: 0, forges: 0, benchBase: false, benchAddition: false },
  begin(id, now) {
    set({ active: { id, step: 0, start: now } });
  },
  rebase(now) {
    const a = get().active;
    if (a) set({ active: { ...a, start: now } });
  },
  advance(now) {
    const a = get().active;
    if (!a) return;
    const guide = guideById(a.id);
    if (!guide || a.step + 1 >= guide.steps.length) {
      set({ active: null, done: [...new Set([...get().done, a.id])] });
      return;
    }
    set({ active: { ...a, step: a.step + 1, start: now } });
  },
  stop() {
    set({ active: null });
  },
  setSignals(s) {
    const cur = get().signals;
    if (Object.entries(s).every(([k, v]) => cur[k as keyof typeof cur] === v)) return;
    set({ signals: { ...cur, ...s } });
  },
  count(what) {
    const cur = get().signals;
    set({ signals: { ...cur, [what]: cur[what] + 1 } });
  },
}));
