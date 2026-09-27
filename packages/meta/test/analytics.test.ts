import { describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import type { CharacterSpec } from '@arena/engine';
import { analyzeMatches, formatRates } from '../src/index.js';

const content = loadContentOrThrow();
const c = (classId: string, element: string, skills: string[], items: string[] = []): CharacterSpec => ({ name: classId, classId, element, skills, items });

describe('analytics', () => {
  it('counts picks once per side and wins per side (draws half)', () => {
    const a = analyzeMatches(content, [
      { teams: [[c('warrior', 'Fire', ['strike']), c('warrior', 'Ice', ['strike.fire'], ['wind_katana'])], [c('mage', 'Fire', ['bolt'])]], winner: 0 },
      { teams: [[c('mage', 'Ice', ['bolt'])], [c('warrior', 'None', ['strike'])]], winner: null },
    ]);
    expect(a.matches).toBe(2);
    expect(a.draws).toBe(1);
    expect(a.firstSeatWinRate).toBe(1);
    const warrior = a.classes.find((r) => r.id === 'warrior')!;
    expect([warrior.picks, warrior.wins, warrior.pickRate]).toEqual([2, 1.5, 0.5]); // a win and a draw
    expect(a.elements.find((r) => r.id === 'Fire')).toMatchObject({ picks: 2, wins: 1 });
    expect(a.elements.some((r) => r.id === 'None')).toBe(false);
    expect(a.items).toEqual([expect.objectContaining({ id: 'wind_katana', name: 'Wind Katana', picks: 1, winRate: 1 })]);
    expect(formatRates('Classes', a.classes)).toContain('Warrior');
  });
});
