import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATA_DIR, loadContentOrThrow, rawFromYamlFiles } from '@arena/content';
import { buildReference, searchReference } from '../src/reference/data.js';
import { ELEMENTS } from '../src/reference/prose.js';
import { pageKey, parseRefHash, refHash, type RefRoute } from '../src/reference/route.js';

const content = loadContentOrThrow();
const coreFile = `${DATA_DIR}/base/statuses.yaml`;
const coreIds = Object.keys(rawFromYamlFiles([{ path: coreFile, text: readFileSync(coreFile, 'utf8') }]).statuses);
const ref = buildReference(content, coreIds);

describe('the reference, from the content bundle', () => {
  it('has every base skill, element and fusion, each with all its skills', () => {
    expect(ref.problems).toEqual([]);
    expect(ref.bases.map((s) => s.name).slice(0, 3)).toEqual(['Strike', 'Smash', 'Charge']);
    expect(ref.bases).toHaveLength(30);
    expect(ref.elements.map((e) => e.name)).toEqual([...ELEMENTS]);
    expect(ref.kits).toHaveLength(Object.keys(content.fusions).length);
    expect(new Set(ref.kits.map((k) => k.id)).size).toBe(ref.kits.length);
    for (const x of [...ref.elements, ...ref.kits]) expect(Object.keys(x.skills), x.name).toHaveLength(30);
    expect(ref.elementBySlug.get('fire')!.skills.strike!.name).toBe(content.skills['strike.fire']!.name);
  });

  it('lists the fusions in ten element sections: the pure fusion first, then the pairs in element order', () => {
    expect(ref.groups.map((g) => g.title)).toEqual(ELEMENTS.map((e) => `${e} fusions`));
    for (const g of ref.groups) {
      expect(g.kits, g.title).toHaveLength(10);
      const el = g.title.replace(' fusions', '');
      expect(g.kits[0]!.parents).toEqual([el, el]);
      expect(g.kits.every((k) => k.parents.includes(el as (typeof ELEMENTS)[number]))).toBe(true);
    }
    expect(ref.groups[0]!.kits.map((k) => k.id).slice(0, 3)).toEqual(['dragon', 'apocalypse', 'mechanic']);
    // A pair is listed under both its elements; a pure fusion under its one.
    const phoenix = ref.kitById.get('phoenix')!;
    expect(phoenix.groups).toEqual(['fire', 'holy']);
    expect(ref.groups.filter((g) => g.kits.includes(phoenix)).map((g) => g.slug)).toEqual(['fire', 'holy']);
    expect(ref.kitById.get('dragon')!.groups).toEqual(['fire']);
  });

  it("lists each element's ten fusions, itself first", () => {
    for (const e of ref.elements) {
      expect(e.fusions, e.name).toHaveLength(10);
      expect(e.fusions[0]!.partner).toBe(e.name);
    }
    expect(ref.elementBySlug.get('fire')!.fusions.map((f) => f.kit.id).slice(0, 2)).toEqual(['dragon', 'apocalypse']);
  });

  it("derives a fusion's keywords and passives from its glossary and statuses", () => {
    const dragon = ref.kitById.get('dragon')!;
    expect(dragon.parents).toEqual(['Fire', 'Fire']);
    expect(dragon.keywords.map((k) => [k.name, k.kind])).toEqual([
      ['Dragonfire', 'Debuff'],
      ['Hoard', 'Buff'],
      ['Breath', undefined],
    ]);
    expect(dragon.passives.map((p) => p.name)).toEqual(["Wyrm's Heart"]);
    // A passive that is also a keyword marks the keyword instead of being listed twice.
    const apocalypse = ref.kitById.get('apocalypse')!;
    expect(apocalypse.passives).toEqual([]);
    expect(apocalypse.keywords.filter((k) => k.passive)).toHaveLength(1);
  });

  it('sorts statuses and terms into core, element and rules entries, each with its own link', () => {
    expect(ref.core.map((e) => e.name)).toContain('Might');
    expect(ref.core.every((e) => e.group === 'core' && e.status)).toBe(true);
    const earth = ref.elementBySlug.get('earth')!;
    expect(earth.statuses).toEqual([]);
    expect(earth.terms.map((e) => e.name)).toContain('Boulder');
    expect(ref.elementBySlug.get('fire')!.statuses.map((e) => e.name)).toEqual(['Ignite', 'Scorched', 'Flameborn']);
    expect(ref.rules.map((e) => e.name)).toContain('Piercing');
    // Links are unique, and none is taken by a section of the page (core, rules, an element).
    const sections = new Set(['core', 'rules', ...ref.elements.map((e) => e.slug)]);
    expect(ref.entryBySlug.size).toBe(ref.entries.length);
    expect(ref.entries.filter((e) => sections.has(e.slug))).toEqual([]);
  });

  it('defines every keyword skill text can use, on the statuses page or a fusion page', () => {
    const undefinedKeywords = Object.values(content.glossary).filter((g) => !ref.defOf(g));
    expect(undefinedKeywords.map((g) => g.id)).toEqual([]);
    const might = content.glossary.might!;
    expect(ref.defOf(might)).toMatchObject({ entry: { slug: 'might' } });
    expect(ref.defOf(content.glossary.hoard!)).toMatchObject({ kit: { id: 'dragon' }, keyword: { name: 'Hoard' } });
  });

  it('finds the keywords a text uses', () => {
    const uses = ref.usesOf(ref.kitById.get('dragon')!.skills.strike!.description);
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.every((id) => content.glossary[id])).toBe(true);
    // "Charge skills" names the skill, not a keyword form.
    expect(ref.usesOf('Your Strike skills deal 5 more damage.')).toEqual([]);
  });

  it('classes: three signatures and three borrowed skills, every base skill in exactly two classes', () => {
    expect(ref.classes).toHaveLength(10);
    for (const b of ref.bases) {
      expect(ref.classes.filter((c) => c.signatures.includes(b.id)), b.id).toHaveLength(1);
      expect(ref.classes.filter((c) => c.affinity.includes(b.id)), b.id).toHaveLength(1);
    }
  });
});

describe('reference search', () => {
  it('matches names and text, ignoring case, across every kind of entry', () => {
    const r = searchReference(ref, 'hoard');
    expect(r.keywords.map((k) => [k.kit.id, k.name])).toContainEqual(['dragon', 'Hoard']);
    expect(r.fusionSkills.length).toBeGreaterThan(0);
    expect(r.fusionSkills.every((x) => `${x.skill.name} ${x.skill.description}`.toLowerCase().includes('hoard'))).toBe(true);

    const ignite = searchReference(ref, 'IGNITE');
    expect(ignite.entries.map((e) => e.name)).toContain('Ignite');
    expect(ignite.skills.some((x) => x.element?.name === 'Fire')).toBe(true);
    expect(ignite.elements.map((e) => e.name)).toContain('Fire'); // its tagline

    const fire = searchReference(ref, 'fire');
    expect(fire.kits.map((k) => k.id)).toEqual(expect.arrayContaining(['dragon', 'apocalypse'])); // by parent
    const strike = searchReference(ref, 'strike').skills[0]!;
    expect(strike.base).toBe('strike');
    expect(strike.element).toBeUndefined(); // the base skill comes first
  });

  it('finds nothing for an empty or unmatched query', () => {
    const none = searchReference(ref, '   ');
    expect(Object.values(none).every((list) => list.length === 0)).toBe(true);
    const nothing = searchReference(ref, 'zzqqxx');
    expect(Object.values(nothing).every((list) => list.length === 0)).toBe(true);
  });
});

describe('reference links', () => {
  it('round-trips every view through its hash', () => {
    const routes: RefRoute[] = [
      { page: 'home' },
      { page: 'base' },
      { page: 'base', skill: 'strike' },
      { page: 'elements' },
      { page: 'element', element: 'fire', skill: 'smash' },
      { page: 'fusions' },
      { page: 'kit', kit: 'dragon', skill: 'stun' },
      { page: 'compare', skill: 'strike', pick: 'night' },
      { page: 'keywords' },
      { page: 'statuses', entry: 'might' },
      { page: 'search', query: 'soul fragment / 2' },
    ];
    for (const r of routes) expect(parseRefHash(refHash(r)), refHash(r)).toEqual(r);
    expect(refHash({ page: 'kit', kit: 'dragon', skill: 'stun' })).toBe('#reference/kit/dragon/stun');
    expect(refHash({ page: 'home' })).toBe('#reference');
  });

  it('ignores other hashes and opens the home page for unknown views', () => {
    expect(parseRefHash('')).toBeNull();
    expect(parseRefHash('#references')).toBeNull();
    expect(parseRefHash('#/kit/dragon')).toBeNull();
    expect(parseRefHash('#reference/')).toEqual({ page: 'home' });
    expect(parseRefHash('#reference/nowhere')).toEqual({ page: 'home' });
    expect(parseRefHash('#reference/kit')).toEqual({ page: 'fusions' });
    expect(parseRefHash('#reference/search/%E0%A4%A')).toEqual({ page: 'search', query: '%E0%A4%A' });
  });

  it('keys pages without their open skill, so picking a skill keeps the page', () => {
    expect(pageKey({ page: 'kit', kit: 'dragon', skill: 'stun' })).toBe(pageKey({ page: 'kit', kit: 'dragon' }));
    expect(pageKey({ page: 'kit', kit: 'dragon' })).not.toBe(pageKey({ page: 'kit', kit: 'crystal' }));
  });
});
