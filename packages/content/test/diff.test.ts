import { describe, expect, it } from 'vitest';
import { diffBundles, patchNotes } from '../src/index.js';
import { content } from './harness.js';

describe('content diff', () => {
  it('finds changed fields, rules-only changes, additions, removals and economy edits', () => {
    const after = structuredClone(content);
    after.version = 'after000';
    after.skills.strike = { ...after.skills.strike!, cooldown: 1, cost: { ...after.skills.strike!.cost, r: 1 } };
    after.skills.shot = { ...after.skills.shot!, ops: [] };
    delete (after.skills as Record<string, unknown>).stab;
    after.items.brand_new = { ...after.items.longsword!, id: 'brand_new', name: 'Brand New Blade' };
    after.economy.roll = { cost: { gold: 120 } };

    const d = diffBundles(content, after);
    const strike = d.categories.skills.changed.find((c) => c.id === 'strike')!;
    expect(strike.fields.map((f) => f.field)).toEqual(['cost', 'cooldown']);
    expect(d.categories.skills.changed.find((c) => c.id === 'shot')!.fields).toEqual([{ field: 'other', before: '', after: '' }]);
    expect(d.categories.skills.removed.map((r) => r.id)).toEqual(['stab']);
    expect(d.categories.items.added.map((r) => r.name)).toEqual(['Brand New Blade']);
    expect(d.economy).toEqual(['roll']);

    const notes = patchNotes(d);
    expect(notes).toContain('**Strike**: cost S → Sr; cooldown 0 → 1');
    expect(notes).toContain('**Shot**: rules changed');
    expect(notes).toContain('Removed: **Stab**');
    expect(notes).toContain('New: **Brand New Blade**');
    expect(notes).toContain('Changed: roll');
  });

  it('says so when nothing changed', () => {
    expect(patchNotes(diffBundles(content, content))).toContain('No content changes.');
  });
});
