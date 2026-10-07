// The menu guides (guides.ts): every step points at a hook that exists on a screen, and the steps
// that wait for the player move on only once the player has done the thing.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDES, snapshotOf, type GuideSnapshot } from '../src/guides.js';

const UI = new URL('../src/ui/', import.meta.url);
const sources = readdirSync(UI)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => readFileSync(new URL(f, UI), 'utf8'))
  .join('\n');

const base: GuideSnapshot = snapshotOf(
  [],
  { draftItems: '', draftInfusions: '', saves: 0, forges: 0, benchBase: false, benchAddition: false },
  'home',
  null,
);

describe('guides', () => {
  it('cover recruiting, equipment, infusions and forging, with unique ids', () => {
    expect(GUIDES.map((g) => g.id)).toEqual(['recruit', 'equip', 'infuse', 'forge']);
  });

  it('only highlight hooks the screens actually have', () => {
    for (const g of GUIDES) {
      for (const s of g.steps) {
        if (!s.highlight) continue;
        // Home's tab buttons build their hooks from the tab ids (tab-main, tab-roster, tab-forge, …).
        if (s.highlight.startsWith('tab-')) {
          expect(['tab-main', 'tab-roster', 'tab-forge', 'tab-reference'], `${g.id}: ${s.highlight}`).toContain(s.highlight);
          expect(sources).toContain('data-guide={`tab-${x.id}`}');
        } else expect(sources, `${g.id}: ${s.highlight}`).toContain(`data-guide="${s.highlight}"`);
      }
    }
  });

  it('wait for the real action: a recruit, an edit, a save, a forge', () => {
    const until = (id: string, i: number) => GUIDES.find((g) => g.id === id)!.steps[i]!.until!;
    expect(until('recruit', 2)({ ...base, characters: 1 }, base)).toBe(true);
    expect(until('recruit', 2)(base, base)).toBe(false);
    // Opening a character that already wears something isn't an edit; changing it is.
    const open = { ...base, draftItems: 'a:1' };
    expect(until('equip', 1)(open, open)).toBe(false);
    expect(until('equip', 1)({ ...open, draftItems: 'a:1,b:2' }, open)).toBe(true);
    expect(until('equip', 4)({ ...base, saves: 1 }, base)).toBe(true);
    expect(until('infuse', 1)({ ...base, draftInfusions: 'strike:Fire' }, base)).toBe(true);
    expect(until('forge', 4)({ ...base, forges: 1 }, base)).toBe(true);
    expect(until('forge', 4)(base, base)).toBe(false);
  });

  it('show the player which Home tab to open, and move on once they open it', () => {
    const until = (id: string, i: number) => GUIDES.find((g) => g.id === id)!.steps[i]!.until!;
    const step = (id: string, i: number) => GUIDES.find((g) => g.id === id)!.steps[i]!;
    expect(step('recruit', 1).highlight).toBe('tab-roster');
    expect(until('recruit', 1)({ ...base, homeTab: 'roster' }, base)).toBe(true);
    expect(until('recruit', 1)(base, base)).toBe(false);
    expect(step('forge', 0).highlight).toBe('tab-forge');
    expect(until('forge', 0)({ ...base, homeTab: 'forge' }, base)).toBe(true);
    expect(until('forge', 0)(base, base)).toBe(false);
  });
});
