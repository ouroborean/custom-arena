// Keywords (docs/glossary.md): status keywords take the status's wording; each word form means one thing.

import { describe, expect, it } from 'vitest';
import { buildBundle, checkGlossary, loadContentOrThrow, rawFromYamlFiles } from '../src/index.js';

const content = loadContentOrThrow();

describe('glossary', () => {
  it('fills status keywords from their status, and has no clashing forms', () => {
    expect(content.glossary.might).toEqual({ id: 'might', name: 'Might', text: content.statuses.might!.description, forms: ['Might'], status: 'might' });
    expect(content.glossary.chilled).toMatchObject({ name: 'Chilled', element: 'Ice', forms: ['Chilled', 'Chills', 'Chill'] });
    expect(checkGlossary(content)).toEqual([]);
  });

  it('reports unknown statuses, missing text and a form claimed twice', () => {
    const yaml = [
      'a: { status: nothing_like_this }',
      'b: { name: Lonely }',
      'c: { name: Chill Out, text: "x", forms: [Chill] }',
      'd: { name: Also Chill, text: "y", forms: [Chill] }',
    ].join('\n');
    const { issues } = buildBundle(rawFromYamlFiles([{ path: 'glossary.test.yaml', text: yaml }]));
    const messages = issues.filter((i) => i.where.startsWith('glossary')).map((i) => `${i.where}: ${i.message}`);
    expect(messages).toContain('glossary.a: unknown status "nothing_like_this"');
    expect(messages).toContain('glossary.b: needs a name and text, or a status that has them');
    expect(messages).toContain('glossary.d: "Chill" already means c');
  });
});
