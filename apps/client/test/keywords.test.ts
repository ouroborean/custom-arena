// Keyword explanations: which glossary keywords a tooltip's text uses.

import { describe, expect, it } from 'vitest';
import { loadContentOrThrow } from '@arena/content';
import { keywordItems, keywordMatcher } from '../src/keywords.js';

const content = loadContentOrThrow();
const baseSkills = new Set(Object.values(content.skills).filter((s) => !s.id.includes('.')).map((s) => s.name));
const match = keywordMatcher(content.glossary, baseSkills);
const ids = (text: string) => match(text).map((m) => m.keyword.id);

describe('keyword matching', () => {
  it('finds word forms as whole, case-sensitive words', () => {
    expect(ids('Deals 20 damage to target enemy and Chills them for 2 turns.')).toEqual(['chilled']);
    expect(ids('Chilling Touch and Blinding Powder')).toEqual([]); // skill names, not Chill or Blind
    expect(ids('the shield wall')).toEqual([]); // keywords are capitalized in text
    expect(ids('Deals 25 Piercing damage. Stealthy.')).toEqual(['piercing', 'stealth']);
    expect(ids('If the target is Frostbitten, it will be countered.')).toEqual(['frostbitten', 'counter']);
  });

  it('prefers the longest form, and skips skill names ("your Charge skills")', () => {
    expect(ids('Every Frost debuff counts.')).toEqual(['frost_debuff']);
    expect(ids('Your Charge skills deal 5 more damage. Gains 1 Charge.')).toEqual(['charged']);
    expect(ids('Counters any Harmful skill used on them.')).toEqual(['counter', 'harmful']); // Harmful isn't a skill
  });

  it('lists each keyword once, in order, then those its explanation mentions', () => {
    const items = keywordItems(match, match('Puts them to Sleep. Asleep units wake when hit. Deals Affliction damage.'));
    expect(items.map((i) => [i.keyword.id, i.via ?? null])).toEqual([
      ['sleep', null],
      ['affliction', null],
      ['stunned', 'Sleep'], // Sleep's own text says Stunned
      ['armor', 'Affliction'],
      ['shield', 'Affliction'],
      ['invulnerable', 'Affliction'],
    ]);
  });
});
