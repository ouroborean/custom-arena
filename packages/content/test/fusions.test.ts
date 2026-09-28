// Fusion elements (GDD §7.3): the data file covers every pair once, and the checks catch mistakes.

import { describe, expect, it } from 'vitest';
import type { ContentBundle, FusionDef } from '@arena/engine';
import { checkFusions, loadContentOrThrow } from '../src/index.js';

const content = loadContentOrThrow();

describe('fusions', () => {
  it('the 10 base elements make 55 fusions, with no gaps or duplicates', () => {
    expect(Object.keys(content.fusions)).toHaveLength(55);
    expect(checkFusions(content)).toEqual([]);
    expect(content.fusions.dragon).toEqual({ id: 'dragon', name: 'Dragon', elements: ['Fire', 'Fire'] });
  });

  it('reports unknown elements, a pair used twice, base-element names and gaps', () => {
    const f = (id: string, name: string, elements: [string, string]): FusionDef => ({ id, name, elements });
    const { dragon: _dropped, ...rest } = content.fusions;
    const bad: ContentBundle = {
      ...content,
      fusions: {
        ...rest,
        steam: f('steam', 'Steam', ['Fire', 'Vapor']),
        twin: f('twin', 'Twin', ['Ice', 'Fire']), // Fire + Ice is Apocalypse already
        fire2: f('fire2', 'Fire', ['Wind', 'Wind']),
      },
    };
    const messages = checkFusions(bad).map((i) => `${i.level} ${i.where}: ${i.message}`);
    expect(messages).toContain('error fusions.steam: unknown element "Vapor"');
    expect(messages).toContain('error fusions.twin: Ice + Fire already makes Apocalypse');
    expect(messages).toContain('error fusions.fire2: "Fire" is a base element\'s name');
    expect(messages).toContain('warning fusions: no fusion for Fire + Fire');
  });
});
