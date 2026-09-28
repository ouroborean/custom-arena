// Content diffs for balance patches (GDD §12.1 "balance patches are new versions", docs/live-ops.md
// §2): what changed between two bundles, and patch notes drafted from it. Pure; the content:diff
// script builds the "before" bundle from a git revision.

import { formatCost, type ContentBundle, type SkillDef } from '@arena/engine';
import { canonicalJson } from './bundle.js';

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface EntryChange {
  id: string;
  name: string;
  /** Readable field changes; `other` when only the rules data (ops, triggers…) changed. */
  fields: FieldChange[];
}

export interface CategoryDiff {
  added: { id: string; name: string }[];
  removed: { id: string; name: string }[];
  changed: EntryChange[];
}

export interface ContentDiff {
  before: string;
  after: string;
  categories: Record<'skills' | 'statuses' | 'minions' | 'items' | 'encounters' | 'chapters' | 'achievements' | 'tutorial' | 'fusions', CategoryDiff>;
  /** Economy sections that changed (currencies, rewards, drop tables, …). */
  economy: string[];
}

function skillFields(d: SkillDef): Record<string, string> {
  return {
    name: d.name,
    cost: formatCost(d.cost),
    cooldown: String(d.cooldown),
    target: d.target,
    tags: d.tags.join(', '),
    description: d.description,
  };
}

function nameOf(e: unknown, id: string): string {
  return e && typeof e === 'object' && 'name' in e && typeof (e as { name: unknown }).name === 'string' ? (e as { name: string }).name : id;
}

function diffRecords<T>(before: Record<string, T>, after: Record<string, T>, readable?: (x: T) => Record<string, string>): CategoryDiff {
  const out: CategoryDiff = { added: [], removed: [], changed: [] };
  for (const id of Object.keys(after).sort()) {
    if (!(id in before)) out.added.push({ id, name: nameOf(after[id], id) });
  }
  for (const id of Object.keys(before).sort()) {
    if (!(id in after)) {
      out.removed.push({ id, name: nameOf(before[id], id) });
      continue;
    }
    const a = before[id]!;
    const b = after[id]!;
    if (canonicalJson(a) === canonicalJson(b)) continue;
    const fields: FieldChange[] = [];
    if (readable) {
      const fa = readable(a);
      const fb = readable(b);
      for (const k of Object.keys(fb)) if (fa[k] !== fb[k]) fields.push({ field: k, before: fa[k] ?? '', after: fb[k]! });
    }
    // Something beyond the readable fields changed (ops, triggers, modifiers…).
    const rest = (x: T) => {
      if (!readable) return canonicalJson(x);
      const keys = new Set(Object.keys(readable(x)));
      return canonicalJson(Object.fromEntries(Object.entries(x as object).filter(([k]) => !keys.has(k))));
    };
    if (rest(a) !== rest(b)) fields.push({ field: 'other', before: '', after: '' });
    out.changed.push({ id, name: nameOf(b, id), fields });
  }
  return out;
}

export function diffBundles(before: ContentBundle, after: ContentBundle): ContentDiff {
  const economy = (Object.keys({ ...before.economy, ...after.economy }) as (keyof ContentBundle['economy'])[])
    .filter((k) => canonicalJson(before.economy[k]) !== canonicalJson(after.economy[k]))
    .sort();
  return {
    before: before.version,
    after: after.version,
    categories: {
      skills: diffRecords(before.skills, after.skills, skillFields),
      statuses: diffRecords(before.statuses, after.statuses, (d) => ({ name: d.name, kind: d.kind, description: d.description ?? '' })),
      minions: diffRecords(before.minions, after.minions, (d) => ({ name: d.name, hp: String(d.hp) })),
      items: diffRecords(before.items, after.items, (d) => ({ name: d.name, passive: d.passive ?? '' })),
      encounters: diffRecords(before.encounters, after.encounters, (d) => ({ name: d.name, ai: d.ai.tier })),
      chapters: diffRecords(before.chapters, after.chapters),
      achievements: diffRecords(before.achievements, after.achievements, (d) => ({ name: d.name, description: d.description })),
      tutorial: diffRecords(before.tutorial, after.tutorial),
      fusions: diffRecords(before.fusions ?? {}, after.fusions ?? {}, (d) => ({ name: d.name, elements: d.elements.join(' + ') })),
    },
    economy,
  };
}

const TITLES: Record<keyof ContentDiff['categories'], string> = {
  skills: 'Skills',
  statuses: 'Statuses',
  minions: 'Minions',
  items: 'Equipment',
  encounters: 'Story encounters',
  chapters: 'Story chapters',
  achievements: 'Achievements',
  tutorial: 'Tutorial',
  fusions: 'Fusion elements',
};

/** Patch notes in Markdown, drafted from a diff (edit before publishing). */
export function patchNotes(d: ContentDiff): string {
  const out = [`# Patch notes`, '', `Content ${d.before.slice(0, 8)} → ${d.after.slice(0, 8)}`, ''];
  let any = false;
  for (const [key, title] of Object.entries(TITLES) as [keyof ContentDiff['categories'], string][]) {
    const c = d.categories[key];
    if (!c.added.length && !c.removed.length && !c.changed.length) continue;
    any = true;
    out.push(`## ${title}`, '');
    for (const e of c.changed) {
      const shown = e.fields.filter((f) => f.field !== 'other');
      const detail = shown.map((f) => (f.field === 'description' ? `new text: “${f.after}”` : `${f.field} ${f.before} → ${f.after}`));
      if (e.fields.some((f) => f.field === 'other')) detail.push('rules changed');
      out.push(`- **${e.name}**: ${detail.join('; ')}`);
    }
    for (const e of c.added) out.push(`- New: **${e.name}**`);
    for (const e of c.removed) out.push(`- Removed: **${e.name}**`);
    out.push('');
  }
  if (d.economy.length) {
    any = true;
    out.push('## Economy', '', `- Changed: ${d.economy.join(', ')}`, '');
  }
  if (!any) out.push('No content changes.', '');
  return out.join('\n');
}
