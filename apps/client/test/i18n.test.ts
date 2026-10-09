import { describe, expect, it } from 'vitest';
import { CATALOGS, format, pseudo, resolveLocale } from '../src/i18n/index.js';
import { en } from '../src/i18n/en.js';

describe('i18n', () => {
  it('interpolates params and formats numbers', () => {
    expect(format('en', 'home.roll', { cost: '100 Gold' })).toBe('Recruit a character (100 Gold)');
    expect(format('en', 'coach.tip', { n: 2, total: 7 })).toBe('Tip 2/7');
  });

  it('picks plural forms by count', () => {
    expect(format('en', 'grant.freeCharacters', { count: 1 })).toBe('1 free character');
    expect(format('en', 'grant.freeCharacters', { count: 3 })).toBe('3 free characters');
  });

  it('pseudo-localizes every message while keeping its params', () => {
    expect(pseudo('Tip {n}/{total}')).toBe('[Típ {n}/{total}~~~~~~]'); // accents outside {params}, ~40% longer
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const params = { count: 2, n: 1, total: 3, name: 'X', reward: 'R', cost: 'C', server: 'S', client: 'C', tier: 'T', className: 'K', hp: 5, reason: 'R', turn: 4, before: 1, after: 2, delta: '+1', amounts: 'A', message: 'M', outcome: 'win', chapter: 'Ch', season: 'S1', date: 'D', rating: 1500, rd: 90, wins: 1, games: 2, stage: 3, stages: 12, best: 2, drops: 1, cap: 15, level: 2, xp: 60, needed: 400, box: 'B', at: 25, amount: 40, win: 'W', loss: 'L', chance: 50, element: 'E', places: 2, keywords: 3, entries: 4, skills: 5, fusionSkills: 6, starter: 'St', others: 'O' };
      const out = format('en-XA', key, params);
      expect(out.startsWith('['), key).toBe(true);
      expect(out, key).not.toMatch(/\{\w+\}/); // every param was filled
    }
  });

  it('resolves the locale from the setting or the browser', () => {
    expect(resolveLocale('auto', ['fr-FR', 'en-GB'])).toBe('en');
    expect(resolveLocale('en-XA')).toBe('en-XA');
    expect(resolveLocale('xx')).toBe('en');
    expect(Object.keys(CATALOGS)).toContain('en');
  });
});
