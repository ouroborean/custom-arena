// The in-game reference's model, built from the live content bundle: the 30 base skills and their
// classes, each element's 30 versions with its statuses and terms, each fusion's 30 versions with its
// keywords and passives, the core statuses and the rules terms. The reference's own words come from
// reference/prose.ts. Pure (it takes the bundle), so it can be tested; ui/Reference.tsx renders it.

import type { ContentBundle, EffectKind, GlossaryDef, SkillDef } from '@arena/engine';
import { keywordMatcher, type Matcher } from '../keywords.js';
import { ELEMENTS, ELEMENT_PROSE, KITS } from './prose.js';

export type Element = (typeof ELEMENTS)[number];

/** A status or rules term, as the Statuses & terms page defines it. */
export interface RefEntry {
  /** Its link: #reference/statuses/<slug>. */
  slug: string;
  name: string;
  kind?: EffectKind;
  text: string;
  group: 'core' | 'element' | 'rules';
  /** For an element's statuses and terms. */
  element?: Element;
  /** A status (as opposed to a term). */
  status?: string;
  /** The glossary keyword that explains it in skill text, if any. */
  glossary?: string;
}

/** A fusion keyword: a glossary entry of the fusion's. */
export interface RefKeyword {
  /** Glossary id. */
  id: string;
  name: string;
  kind?: EffectKind;
  text: string;
  /** Every character carrying one of the fusion's skills has it. */
  passive: boolean;
}

/** A fusion passive that isn't also one of its keywords. */
export interface RefPassive {
  id: string;
  name: string;
  text: string;
}

export interface RefKit {
  id: string;
  name: string;
  parents: [Element, Element];
  /** The element sections it's listed under: both parents' (one for a pure fusion). */
  groups: string[];
  tagline: string;
  playsLike: string;
  notes: string[];
  keywords: RefKeyword[];
  passives: RefPassive[];
  /** Its version of each base skill, by base skill id. */
  skills: Record<string, SkillDef>;
}

export interface RefGroup {
  slug: string;
  title: string;
  lead: string;
  kits: RefKit[];
}

export interface RefElement {
  name: Element;
  slug: string;
  tagline: string;
  themes: string;
  statuses: RefEntry[];
  terms: RefEntry[];
  /** Its version of each base skill, by base skill id. */
  skills: Record<string, SkillDef>;
  /** The ten fusions it makes with a second infusion: with itself first, then the other elements in order. */
  fusions: { kit: RefKit; partner: Element }[];
}

export interface RefClass {
  id: string;
  name: string;
  /** Base skill ids. */
  signatures: string[];
  affinity: string[];
  starter?: string;
}

export interface ReferenceData {
  /** The 30 base skills, Strike to Titan. */
  bases: SkillDef[];
  baseById: Map<string, SkillDef>;
  classes: RefClass[];
  elements: RefElement[];
  elementBySlug: Map<string, RefElement>;
  groups: RefGroup[];
  /** Every fusion, in group order. */
  kits: RefKit[];
  kitById: Map<string, RefKit>;
  core: RefEntry[];
  rules: RefEntry[];
  /** Every status and term: core, then each element's, then the rules terms. */
  entries: RefEntry[];
  entryBySlug: Map<string, RefEntry>;
  /** Where a keyword in rules text is defined: a status or term, or a fusion's keyword. */
  defOf(g: GlossaryDef): { entry: RefEntry } | { kit: RefKit; keyword: RefKeyword } | null;
  /** The glossary keywords a text uses (ids), in order of first use. */
  usesOf(text: string): string[];
  /** Missing pieces (a fusion without prose, a skill without a version…), for the tests. */
  problems: string[];
}

export const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The classes that can use a base skill: the one it's a signature of, and the one that borrows it. */
export function classesOf(data: ReferenceData, base: string): { signature?: RefClass; affinity?: RefClass } {
  return { signature: data.classes.find((c) => c.signatures.includes(base)), affinity: data.classes.find((c) => c.affinity.includes(base)) };
}

/**
 * Builds the reference from the bundle. `coreStatusIds` are the statuses in base/statuses.yaml (the
 * bundle doesn't keep which file a status came from).
 */
export function buildReference(content: ContentBundle, coreStatusIds: readonly string[]): ReferenceData {
  const problems: string[] = [];
  const glossary = Object.values(content.glossary);
  const elementNames = new Set<string>(ELEMENTS);

  // ------------------------------------------------ base skills and classes
  const classes: RefClass[] = Object.values(content.classes).map((c) => ({
    id: c.id,
    name: c.name,
    signatures: [...c.signatures],
    affinity: [...c.affinity],
    ...(c.starter ? { starter: c.starter } : {}),
  }));
  const inClasses = new Set(classes.flatMap((c) => [...c.signatures, ...c.affinity]));
  const bases = Object.values(content.skills).filter((s) => !s.id.includes('.') && inClasses.has(s.id));
  const baseById = new Map(bases.map((s) => [s.id, s]));
  for (const id of inClasses) if (!baseById.has(id)) problems.push(`class skill ${id} isn't a skill`);

  const versions = (suffix: string, where: string) => {
    const out: Record<string, SkillDef> = {};
    for (const b of bases) {
      const s = content.skills[`${b.id}.${suffix}`];
      if (s) out[b.id] = s;
      else problems.push(`${where}: no ${b.id}.${suffix}`);
    }
    return out;
  };

  // ------------------------------------------------ statuses and terms
  const statusGlossary = new Map<string, GlossaryDef>();
  for (const g of glossary) if (g.status) statusGlossary.set(g.status, g);
  const statusEntry = (id: string, group: RefEntry['group'], element?: Element): RefEntry | null => {
    const s = content.statuses[id];
    if (!s) {
      problems.push(`status ${id} doesn't exist`);
      return null;
    }
    const g = statusGlossary.get(id);
    const text = g?.text ?? s.description;
    if (!text) problems.push(`status ${id} has no description`);
    return {
      slug: slugOf(s.name),
      name: s.name,
      kind: s.kind,
      text: text ?? '',
      group,
      ...(element ? { element } : {}),
      status: id,
      ...(g ? { glossary: g.id } : {}),
    };
  };
  const termEntry = (g: GlossaryDef, group: RefEntry['group'], element?: Element): RefEntry => ({
    slug: slugOf(g.name),
    name: g.name,
    text: g.text,
    group,
    ...(element ? { element } : {}),
    glossary: g.id,
  });
  const core = coreStatusIds.map((id) => statusEntry(id, 'core')).filter((e) => e !== null);
  const rules = glossary.filter((g) => !g.element && !g.status).map((g) => termEntry(g, 'rules'));

  // ------------------------------------------------ fusions
  // Fusions are listed by element: each element's section has its pure fusion first, then its pairs in
  // element order, so a pair appears under both of its elements.
  const prose = new Map(KITS.map((k) => [k.id, k] as const));
  for (const f of Object.values(content.fusions)) if (!prose.has(f.id)) problems.push(`fusion ${f.id} has no reference prose`);
  for (const k of KITS) if (!content.fusions[k.id]) problems.push(`prose for ${k.id}, which isn't a fusion`);
  const order = (e: string) => (ELEMENTS as readonly string[]).indexOf(e);
  const kitById = new Map<string, RefKit>();
  for (const f of Object.values(content.fusions)) {
    const p = prose.get(f.id);
    if (!p) continue;
    const keywords: RefKeyword[] = glossary
      .filter((x) => x.element === f.name)
      .map((x) => {
        const kind = x.status ? content.statuses[x.status]?.kind : undefined;
        return { id: x.id, name: x.name, text: x.text, passive: false, ...(kind ? { kind } : {}) };
      });
    const passives: RefPassive[] = [];
    for (const id of f.passives ?? []) {
      const st = content.statuses[id];
      if (!st) {
        problems.push(`${f.id}: passive ${id} doesn't exist`);
        continue;
      }
      const kw = keywords.find((k) => content.glossary[k.id]?.status === id || k.name === st.name);
      if (kw) kw.passive = true;
      else passives.push({ id, name: st.name, text: st.description ?? '' });
    }
    const [a, b] = [...f.elements].sort((x, y) => order(x) - order(y)) as [string, string];
    if (!elementNames.has(a) || !elementNames.has(b)) problems.push(`${f.id}: parents ${a} + ${b} aren't both base elements`);
    kitById.set(f.id, {
      id: f.id,
      name: f.name,
      parents: [a as Element, b as Element],
      groups: [...new Set([a.toLowerCase(), b.toLowerCase()])],
      tagline: p.tagline,
      playsLike: p.playsLike,
      notes: p.notes ?? [],
      keywords,
      passives,
      skills: versions(f.id, f.id),
    });
  }
  const groups: RefGroup[] = ELEMENTS.map((el) => {
    const mine = [...kitById.values()].filter((k) => k.parents.includes(el));
    const other = (k: RefKit) => (k.parents[0] === el ? k.parents[1] : k.parents[0]);
    // The pure fusion first, then the pairs by the other element's place in the element order.
    const sorted = mine.sort((x, y) => Number(other(x) !== el) - Number(other(y) !== el) || order(other(x)) - order(other(y)));
    const pure = sorted.find((k) => k.parents[0] === el && k.parents[1] === el);
    return {
      slug: el.toLowerCase(),
      title: `${el} fusions`,
      lead: pure ? `${el} with each element: ${el} + ${el} (${pure.name}) first, then ${el} with every other element.` : `${el} with each other element.`,
      kits: sorted,
    };
  });
  // Every fusion once, in the order its first section lists it.
  const kits = [...new Set(groups.flatMap((g) => g.kits))];

  // ------------------------------------------------ elements
  const elements: RefElement[] = ELEMENTS.map((name) => {
    const statuses = Object.values(content.statuses)
      .filter((s) => s.element === name)
      .map((s) => statusEntry(s.id, 'element', name))
      .filter((e) => e !== null);
    const terms = glossary.filter((g) => g.element === name && !g.status).map((g) => termEntry(g, 'element', name));
    const partner = (k: RefKit): Element => (k.parents[0] === name ? k.parents[1] : k.parents[0]);
    const fusions = kits
      .filter((k) => k.parents.includes(name))
      .map((kit) => ({ kit, partner: partner(kit) }))
      .sort((x, y) => (x.partner === name ? -1 : y.partner === name ? 1 : ELEMENTS.indexOf(x.partner) - ELEMENTS.indexOf(y.partner)));
    if (fusions.length !== ELEMENTS.length) problems.push(`${name} is a parent of ${fusions.length} fusions, expected ${ELEMENTS.length}`);
    return { name, slug: name.toLowerCase(), ...ELEMENT_PROSE[name], statuses, terms, skills: versions(name.toLowerCase(), name), fusions };
  });

  const entries = [...core, ...elements.flatMap((e) => [...e.statuses, ...e.terms]), ...rules];
  const entryBySlug = new Map<string, RefEntry>();
  for (const e of entries) {
    if (entryBySlug.has(e.slug)) problems.push(`two statuses or terms link as ${e.slug}`);
    entryBySlug.set(e.slug, e);
  }
  const entryByGlossary = new Map(entries.filter((e) => e.glossary).map((e) => [e.glossary!, e]));
  const keywordOf = new Map(kits.flatMap((kit) => kit.keywords.map((keyword) => [keyword.id, { kit, keyword }] as const)));

  // Rules text: base skill names followed by "skill(s)" name the skill, as in the game's tooltips.
  const matcher: Matcher = keywordMatcher(content.glossary, new Set(bases.map((s) => s.name)));
  const uses = new Map<string, string[]>();
  const usesOf = (text: string) => {
    let out = uses.get(text);
    if (!out) {
      out = [...new Set(matcher(text).map((m) => m.keyword.id))];
      uses.set(text, out);
    }
    return out;
  };

  return {
    bases,
    baseById,
    classes,
    elements,
    elementBySlug: new Map(elements.map((e) => [e.slug, e])),
    groups,
    kits,
    kitById,
    core,
    rules,
    entries,
    entryBySlug,
    defOf(g) {
      const entry = entryByGlossary.get(g.id);
      if (entry) return { entry };
      return keywordOf.get(g.id) ?? null;
    },
    usesOf,
    problems,
  };
}

// ---------------------------------------------------------------- search

export interface SearchResults {
  elements: RefElement[];
  kits: RefKit[];
  keywords: { kit: RefKit; name: string; text: string }[];
  entries: RefEntry[];
  /** Base and single-element skills; `element` is unset for a base skill. */
  skills: { skill: SkillDef; base: string; element?: RefElement }[];
  fusionSkills: { skill: SkillDef; base: string; kit: RefKit }[];
}

/** Everything whose name or text contains the query (ignoring case). */
export function searchReference(data: ReferenceData, query: string): SearchResults {
  const q = query.trim().toLowerCase();
  const empty: SearchResults = { elements: [], kits: [], keywords: [], entries: [], skills: [], fusionSkills: [] };
  if (!q) return empty;
  const hit = (s: string | undefined) => !!s && s.toLowerCase().includes(q);
  const skillHit = (s: SkillDef) => hit(s.name) || hit(s.description);
  const out = empty;
  out.elements = data.elements.filter((e) => hit(e.name) || hit(e.tagline) || hit(e.themes));
  out.kits = data.kits.filter((k) => hit(k.name) || hit(k.tagline) || k.parents.some(hit));
  for (const kit of data.kits) {
    for (const k of kit.keywords) if (hit(k.name) || hit(k.text)) out.keywords.push({ kit, name: k.name, text: k.text });
    for (const p of kit.passives) if (hit(p.name) || hit(p.text)) out.keywords.push({ kit, name: p.name, text: p.text });
  }
  out.entries = data.entries.filter((e) => hit(e.name) || hit(e.text));
  for (const b of data.bases) if (skillHit(b)) out.skills.push({ skill: b, base: b.id });
  for (const element of data.elements)
    for (const b of data.bases) {
      const s = element.skills[b.id];
      if (s && skillHit(s)) out.skills.push({ skill: s, base: b.id, element });
    }
  for (const kit of data.kits)
    for (const b of data.bases) {
      const s = kit.skills[b.id];
      if (s && skillHit(s)) out.fusionSkills.push({ skill: s, base: b.id, kit });
    }
  return out;
}
