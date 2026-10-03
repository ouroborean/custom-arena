import { describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { advanceAchievement, encounterConfig, encounterUnitSpec, singlePlayerFirst, storyStatus, type MatchFact } from '../src/index.js';

const content = loadContentOrThrow();

describe('encounters', () => {
  it('derive kits from class and element', () => {
    const spec = encounterUnitSpec(content, { name: 'Pyre Witch', classId: 'mage', element: 'Fire', skillCount: 4, hp: 90 });
    expect(spec.skills).toEqual(['bolt.fire', 'blast.fire', 'channel.fire', 'summon.fire']);
    expect(spec.hp).toBe(90);
    const plain = encounterUnitSpec(content, { name: 'X', classId: 'mage', skills: ['bolt', 'shot'] });
    expect(plain.skills).toEqual(['bolt', 'shot']);
  });

  it('seat the player first, the encounter second', () => {
    const enc = content.encounters.embers_3!;
    const mine = [encounterUnitSpec(content, { name: 'Me', classId: 'warrior' })];
    const config = encounterConfig(content, enc, 42, mine);
    expect(config.teams[0]).toEqual(mine);
    expect(config.teams[1].map((c) => c.name)).toEqual(['The Cinder Tyrant', 'Ember Guard', 'Blaze Caller']);
    expect(config.teams[1][0]!.passives).toEqual(['boss_cinder_tyrant']);
    expect(config.firstPlayer).toBe(0);
  });
});

describe('story progress', () => {
  it("opens all ten story chapters from the start, each one's encounters in order", () => {
    const fresh = storyStatus(content, new Set()).filter((c) => !content.chapters[c.id]!.tutorial);
    expect(fresh).toHaveLength(10);
    for (const c of fresh) {
      expect(c).toMatchObject({ unlocked: true, complete: false });
      expect(c.encounters.map((e) => e.unlocked)).toEqual([true, false, false]);
    }
    // Starting with a later chapter is fine: Heartstone's first clear opens its next encounter.
    const later = storyStatus(content, new Set(['heartstone_1'])).find((c) => c.id === 'heartstone')!;
    expect(later.encounters.map((e) => e.unlocked)).toEqual([true, true, false]);

    const done = storyStatus(content, new Set(['embers_1', 'embers_2', 'embers_3']));
    expect(done[0]!.complete).toBe(true);
    expect(done[1]!.complete).toBe(false);
  });
});

describe('achievements', () => {
  const win: MatchFact = { mode: 'casual', outcome: 'win', turns: 20, classes: ['warrior', 'mage'], elements: ['Fire'] };

  it('count matching matches and finish once', () => {
    const a = content.achievements.warrior_path!;
    let p = advanceAchievement(a, undefined, win);
    expect(p).toEqual({ count: 1, done: false });
    p = advanceAchievement(a, p, { ...win, classes: ['mage'] });
    expect(p.count).toBe(1);
    for (let i = 0; i < 9; i++) p = advanceAchievement(a, p, win);
    expect(p).toEqual({ count: 10, done: true });
    expect(advanceAchievement(a, p, win)).toBe(p);
  });

  it('streaks reset on a non-counting match of the same modes only', () => {
    const a = content.achievements.on_a_roll!;
    let p = advanceAchievement(a, undefined, win);
    p = advanceAchievement(a, p, { ...win, mode: 'story', outcome: 'loss' }); // other mode: ignored
    expect(p.count).toBe(1);
    p = advanceAchievement(a, p, { ...win, outcome: 'loss' });
    expect(p.count).toBe(0);
  });

  it('quick wins and story bosses', () => {
    expect(advanceAchievement(content.achievements.quick_work!, undefined, { ...win, turns: 14 }).done).toBe(true);
    expect(advanceAchievement(content.achievements.quick_work!, undefined, win).done).toBe(false);
    const boss = { ...win, mode: 'story', encounter: 'embers_3', chapter: 'embers' };
    expect(advanceAchievement(content.achievements.first_chapter!, undefined, boss).done).toBe(true);
  });
});

describe('who moves first in practice and the arcade', () => {
  it('is a coin flip, fixed by the match seed', () => {
    const seeds = Array.from({ length: 400 }, (_, i) => 7919 * i + 13);
    const first = seeds.map(singlePlayerFirst);
    expect(seeds.map(singlePlayerFirst)).toEqual(first);
    const ones = first.filter((p) => p === 1).length;
    expect(ones).toBeGreaterThan(160);
    expect(ones).toBeLessThan(240);
  });
});
