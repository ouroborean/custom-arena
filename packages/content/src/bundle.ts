// Turns raw parsed content files into a validated ContentBundle. Pure (no filesystem), so it can
// also run in the browser or at server boot.

import {
  fusionKey,
  scripts,
  variantId,
  type ClassDef,
  type Cond,
  type AchievementDef,
  type ChapterDef,
  type ContentBundle,
  type FusionDef,
  type GlossaryDef,
  type EconomyDef,
  type EncounterDef,
  type TutorialDef,
  type EffectDef,
  type ItemDef,
  type MinionDef,
  type Op,
  type SkillDef,
} from '@arena/engine';
import { z } from 'zod';
import {
  classFileEntry,
  conditionFileEntry,
  achievementFileEntry,
  chapterFileEntry,
  economySchema,
  effectDefSchema,
  encounterFileEntry,
  fusionFileEntry,
  glossaryFileEntry,
  tutorialFileEntry,
  itemFileEntry,
  macroFileEntry,
  minionFileEntry,
  skillFileEntry,
} from './schema.js';

export interface RawContent {
  skills: Record<string, unknown>;
  statuses: Record<string, unknown>;
  minions: Record<string, unknown>;
  classes: Record<string, unknown>;
  macros: Record<string, unknown>;
  conditions: Record<string, unknown>;
  items: Record<string, unknown>;
  /** Top-level sections of the economy file(s): currencies, roll, rewards, … */
  economy: Record<string, unknown>;
  encounters: Record<string, unknown>;
  /** Story chapters by id (story*.yaml). */
  story: Record<string, unknown>;
  achievements: Record<string, unknown>;
  /** Tutorial coach scripts by encounter id. */
  tutorial: Record<string, unknown>;
  /** Fusion elements by id (fusions*.yaml). */
  fusions: Record<string, unknown>;
  /** Keywords by id (glossary*.yaml). */
  glossary: Record<string, unknown>;
}

export interface ContentIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export class ContentError extends Error {
  constructor(public readonly issues: ContentIssue[]) {
    super(`Content is invalid:\n${issues.map((i) => `  [${i.level}] ${i.where}: ${i.message}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

function parseEntries<T>(
  kind: string,
  raw: Record<string, unknown>,
  schema: z.ZodType<T>,
  issues: ContentIssue[],
  injectId = false,
): Record<string, T & { id: string }> {
  const out: Record<string, T & { id: string }> = {};
  for (const [id, entry] of Object.entries(raw)) {
    const input = injectId && entry && typeof entry === 'object' ? { id, ...(entry as object) } : entry;
    const r = schema.safeParse(input);
    if (!r.success) {
      for (const iss of r.error.issues) {
        issues.push({ level: 'error', where: `${kind}.${id}${iss.path.length ? '.' + iss.path.join('.') : ''}`, message: iss.message });
      }
      continue;
    }
    out[id] = { ...(r.data as T), id };
  }
  return out;
}

/** Stable (sorted-key) JSON, used for the content version hash. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonicalJson(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** FNV-1a 32-bit, twice with different seeds → 16 hex chars. Deterministic and dependency-free. */
export function contentHash(text: string): string {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return fnv(0x811c9dc5) + fnv(0x9747b28c);
}

export function buildBundle(raw: RawContent): { bundle: ContentBundle; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const statuses = parseEntries<EffectDef>('statuses', raw.statuses, effectDefSchema, issues, true);
  const skills = parseEntries('skills', raw.skills, skillFileEntry, issues) as Record<string, SkillDef>;
  const minions = parseEntries('minions', raw.minions, minionFileEntry, issues) as Record<string, MinionDef>;
  const classes = parseEntries('classes', raw.classes, classFileEntry, issues) as Record<string, ClassDef>;
  const macros: Record<string, Op[]> = {};
  for (const [id, entry] of Object.entries(raw.macros)) {
    const r = macroFileEntry.safeParse(entry);
    if (r.success) macros[id] = r.data;
    else for (const iss of r.error.issues) issues.push({ level: 'error', where: `macros.${id}.${iss.path.join('.')}`, message: iss.message });
  }

  const conditions: Record<string, Cond> = {};
  for (const [id, entry] of Object.entries(raw.conditions)) {
    const r = conditionFileEntry.safeParse(entry);
    if (r.success) conditions[id] = r.data;
    else for (const iss of r.error.issues) issues.push({ level: 'error', where: `conditions.${id}.${iss.path.join('.')}`, message: iss.message });
  }

  const items = parseEntries('items', raw.items ?? {}, itemFileEntry, issues) as Record<string, ItemDef>;

  const eco = economySchema.safeParse(raw.economy ?? {});
  if (!eco.success) {
    for (const iss of eco.error.issues) issues.push({ level: 'error', where: `economy${iss.path.length ? '.' + iss.path.join('.') : ''}`, message: iss.message });
  }
  const economy: EconomyDef = eco.success ? withRecipeIds(eco.data) : EMPTY_ECONOMY;

  const encounters = parseEntries('encounters', raw.encounters ?? {}, encounterFileEntry, issues) as Record<string, EncounterDef>;
  const chapters = parseEntries('story', raw.story ?? {}, chapterFileEntry, issues) as Record<string, ChapterDef>;
  const achievements = parseEntries('achievements', raw.achievements ?? {}, achievementFileEntry, issues) as Record<string, AchievementDef>;
  const tutorial = parseEntries('tutorial', raw.tutorial ?? {}, tutorialFileEntry, issues, true) as Record<string, TutorialDef>;
  const fusions = parseEntries('fusions', raw.fusions ?? {}, fusionFileEntry, issues) as Record<string, FusionDef>;
  const glossary = resolveGlossary(parseEntries('glossary', raw.glossary ?? {}, glossaryFileEntry, issues), statuses, issues);

  const version = contentHash(
    canonicalJson({ skills, statuses, minions, classes, macros, conditions, items, economy, encounters, chapters, achievements, tutorial, fusions, glossary }),
  );
  const bundle: ContentBundle = {
    version,
    skills,
    statuses,
    minions,
    classes,
    macros,
    conditions,
    items,
    economy,
    encounters,
    chapters,
    achievements,
    tutorial,
    fusions,
    glossary,
  };
  issues.push(
    ...checkReferences(bundle),
    ...lintSkills(bundle),
    ...checkElements(bundle),
    ...checkFusions(bundle),
    ...checkGlossary(bundle),
    ...checkEconomy(bundle),
    ...checkSinglePlayer(bundle),
  );
  return { bundle, issues };
}

const EMPTY_ECONOMY: EconomyDef = { currencies: {}, roll: { cost: {} }, rewards: {}, dailyDropCap: 0, dropTables: {}, recipes: {}, salvage: {} };

function withRecipeIds(e: Omit<EconomyDef, 'recipes'> & { recipes: Record<string, Omit<EconomyDef['recipes'][string], 'id'>> }): EconomyDef {
  return { ...e, recipes: Object.fromEntries(Object.entries(e.recipes).map(([id, r]) => [id, { ...r, id }])) };
}

/** Encounters, chapters and achievements must point at classes, skills, statuses and items that exist. */
export function checkSinglePlayer(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const grant = (where: string, g: { currency?: Record<string, number>; items?: string[] } | undefined) => {
    for (const k of Object.keys(g?.currency ?? {})) if (!b.economy.currencies[k]) err(where, `unknown currency "${k}"`);
    for (const i of g?.items ?? []) if (!b.items[i]) err(where, `unknown item "${i}"`);
  };
  const unit = (where: string, u: EncounterDef['enemies'][number]) => {
    if (!b.classes[u.classId]) err(where, `unknown class "${u.classId}"`);
    for (const s of u.skills ?? []) if (!b.skills[s]) err(where, `unknown skill "${s}"`);
    for (const p of u.passives ?? []) if (!b.statuses[p]) err(where, `unknown status "${p}"`);
  };
  for (const e of Object.values(b.encounters)) {
    if (e.enemies.length < 1 || e.enemies.length > 3) err(`encounters.${e.id}`, 'needs 1–3 enemies');
    e.enemies.forEach((u, i) => unit(`encounters.${e.id}.enemies.${i}`, u));
    e.playerTeam?.forEach((u, i) => unit(`encounters.${e.id}.playerTeam.${i}`, u));
    for (const [i, r] of (e.ai.script ?? []).entries()) {
      if (r.unit >= e.enemies.length) err(`encounters.${e.id}.ai.script.${i}`, `no enemy #${r.unit}`);
    }
    grant(`encounters.${e.id}.rewards.first`, e.rewards?.first);
    grant(`encounters.${e.id}.rewards.repeat`, e.rewards?.repeat);
  }
  for (const c of Object.values(b.chapters)) {
    for (const id of c.encounters) if (!b.encounters[id]) err(`story.${c.id}`, `unknown encounter "${id}"`);
    if (c.requires && !b.chapters[c.requires]) err(`story.${c.id}`, `unknown chapter "${c.requires}"`);
    grant(`story.${c.id}.reward`, c.reward);
  }
  for (const a of Object.values(b.achievements)) {
    if (a.when.withClass && !b.classes[a.when.withClass]) err(`achievements.${a.id}`, `unknown class "${a.when.withClass}"`);
    if (a.when.encounter && !b.encounters[a.when.encounter]) err(`achievements.${a.id}`, `unknown encounter "${a.when.encounter}"`);
    if (a.when.chapter && !b.chapters[a.when.chapter]) err(`achievements.${a.id}`, `unknown chapter "${a.when.chapter}"`);
    grant(`achievements.${a.id}.reward`, a.reward);
  }
  for (const t of Object.values(b.tutorial)) {
    const enc = b.encounters[t.id];
    if (!enc) {
      err(`tutorial.${t.id}`, 'no encounter with this id');
      continue;
    }
    if (!enc.playerTeam) err(`tutorial.${t.id}`, 'tutorial encounters need a fixed playerTeam');
    t.steps.forEach((s, i) => {
      const skill = s.expect && 'queue' in s.expect ? s.expect.queue.skill : typeof s.highlight === 'object' && 'skill' in s.highlight ? s.highlight.skill : null;
      if (skill && !b.skills[skill] && !Object.keys(b.skills).some((id) => id.startsWith(`${skill}.`))) {
        err(`tutorial.${t.id}.steps.${i}`, `unknown skill "${skill}"`);
      }
    });
  }
  return issues;
}

/** Currencies, drop tables and recipes must point at things that exist. */
export function checkEconomy(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const e = b.economy;
  const err = (where: string, message: string) => issues.push({ level: 'error', where: `economy.${where}`, message });
  const currencies = (where: string, amounts: Record<string, number> | undefined) => {
    for (const k of Object.keys(amounts ?? {})) if (!e.currencies[k]) err(where, `unknown currency "${k}"`);
  };
  const itemsOfType = (t: string) => Object.values(b.items).filter((i) => i.type === t);
  currencies('roll.cost', e.roll.cost);
  for (const [mode, r] of Object.entries(e.rewards)) {
    for (const outcome of ['win', 'loss', 'draw'] as const) {
      const spec = r[outcome];
      currencies(`rewards.${mode}.${outcome}`, spec.currency);
      if (spec.drops && !e.dropTables[spec.drops.table]) err(`rewards.${mode}.${outcome}`, `unknown drop table "${spec.drops.table}"`);
    }
  }
  for (const [id, t] of Object.entries(e.dropTables)) {
    for (const [type, w] of Object.entries(t.types)) if (w && itemsOfType(type).length === 0) err(`dropTables.${id}`, `no items of type ${type}`);
    for (const x of t.exclude ?? []) if (!b.items[x]) err(`dropTables.${id}`, `unknown item "${x}"`);
  }
  for (const r of Object.values(e.recipes)) {
    currencies(`recipes.${r.id}`, r.cost);
    if (itemsOfType(r.inputs.type).length === 0) err(`recipes.${r.id}`, `no items of type ${r.inputs.type}`);
    for (const input of itemsOfType(r.inputs.type)) {
      const el = input.infusions[0]?.element;
      const out = itemsOfType(r.output.type).filter((o) => !r.inputs.sameElement || o.infusions[0]?.element === el);
      if (out.length !== 1) err(`recipes.${r.id}`, `${input.id} would make ${out.length} possible items (needs exactly 1)`);
    }
  }
  for (const [type, amounts] of Object.entries(e.salvage)) currencies(`salvage.${type}`, amounts);
  return issues;
}

// ---------------------------------------------------------------- referential integrity

function walkOps(ops: readonly Op[], visit: (op: Op, inInline: boolean) => void, inInline = false): void {
  for (const op of ops) {
    visit(op, inInline);
    if (op.op === 'if') {
      walkOps(op.then, visit, inInline);
      walkOps(op.else ?? [], visit, inInline);
    } else if (op.op === 'forEach' || op.op === 'repeat') {
      walkOps(op.do, visit, inInline);
    } else if (op.op === 'apply' && typeof op.effect !== 'string') {
      walkEffect(op.effect, visit);
    }
  }
}

function walkEffect(def: EffectDef, visit: (op: Op, inInline: boolean) => void): void {
  for (const t of def.triggers ?? []) walkOps(t.do ?? [], visit, true);
  walkOps(def.onExpire ?? [], visit, true);
}

export function checkReferences(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });

  const checkOps = (where: string, ops: readonly Op[]) =>
    walkOps(ops, (op) => {
      if (op.op === 'apply' && typeof op.effect === 'string' && !b.statuses[op.effect]) err(where, `unknown status "${op.effect}"`);
      if (op.op === 'summon' && !b.minions[op.minion]) err(where, `unknown minion "${op.minion}"`);
      if (op.op === 'script' && !scripts[op.id]) err(where, `unknown script "${op.id}"`);
      if (op.op === 'macro' && !b.macros[op.id]) err(where, `unknown macro "${op.id}"`);
      if (op.op === 'convertEffects') {
        for (const id of [op.from, op.to]) if (!b.statuses[id]) err(where, `unknown status "${id}"`);
      }
      for (const name of JSON.stringify(op).match(/"check":\{"cond":"([^"]+)"/g) ?? []) {
        const id = name.slice('"check":{"cond":"'.length, -1);
        if (!b.conditions[id]) err(where, `unknown condition "${id}"`);
      }
    });

  for (const s of Object.values(b.skills)) checkOps(`skills.${s.id}`, [...s.ops, ...(s.onCountered ?? [])]);
  for (const st of Object.values(b.statuses)) {
    walkEffect(st, (op) => checkOps(`statuses.${st.id}`, [op]));
    for (const m of st.modifiers ?? []) {
      if (m.mod === 'negateNext' && !b.statuses[m.effect]) err(`statuses.${st.id}`, `negateNext refers to unknown status "${m.effect}"`);
    }
  }
  for (const [id, ops] of Object.entries(b.macros)) checkOps(`macros.${id}`, ops);
  for (const m of Object.values(b.minions)) {
    checkOps(`minions.${m.id}.onSummon`, m.onSummon ?? []);
    for (const sk of m.skills) if (!b.skills[sk]) err(`minions.${m.id}`, `unknown skill "${sk}"`);
    for (const p of m.passives) {
      if (typeof p === 'string') {
        if (!b.statuses[p]) err(`minions.${m.id}`, `unknown status "${p}"`);
      } else walkEffect(p, (op) => checkOps(`minions.${m.id}`, [op]));
    }
  }

  // Items: granted skills are base skills, elements exist, classes exist.
  const elements = new Set(Object.values(b.skills).map((s) => s.element));
  for (const it of Object.values(b.items)) {
    const where = `items.${it.id}`;
    for (const sk of it.skills) if (b.skills[sk]?.element !== 'None') err(where, `"${sk}" isn't a base skill`);
    for (const inf of it.infusions) {
      if (!elements.has(inf.element) || inf.element === 'None') err(where, `unknown element "${inf.element}"`);
    }
    if (it.passiveEffect && !b.statuses[it.passiveEffect]) err(where, `unknown passive effect "${it.passiveEffect}"`);
  }

  // Classes: skills exist, and each skill is a signature once and an affinity once (GDD §6.2).
  const sigCount = new Map<string, number>();
  const affCount = new Map<string, number>();
  for (const c of Object.values(b.classes)) {
    for (const sk of [...c.signatures, ...c.affinity]) if (!b.skills[sk]) err(`classes.${c.id}`, `unknown skill "${sk}"`);
    for (const sk of c.affinity) if (c.signatures.includes(sk)) err(`classes.${c.id}`, `"${sk}" is both signature and affinity`);
    for (const sk of c.signatures) sigCount.set(sk, (sigCount.get(sk) ?? 0) + 1);
    for (const sk of c.affinity) affCount.set(sk, (affCount.get(sk) ?? 0) + 1);
  }
  if (Object.keys(b.classes).length > 0) {
    const baseSkills = Object.values(b.skills).filter((s) => s.element === 'None');
    for (const s of baseSkills) {
      if (sigCount.get(s.id) !== 1) err('classes', `"${s.id}" is a signature of ${sigCount.get(s.id) ?? 0} classes (expected 1)`);
      if (affCount.get(s.id) !== 1) err('classes', `"${s.id}" is an affinity of ${affCount.get(s.id) ?? 0} classes (expected 1)`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------- elements

/**
 * Elemental variants: "<base>.<element>" must share its base skill's archetype, and every element
 * that has any variants should cover all base archetypes (a warning while an element is in progress).
 */
export function checkElements(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const base = Object.values(b.skills).filter((s) => s.element === 'None' && !s.id.includes('.'));
  const archetypes = new Set(base.map((s) => s.archetype));
  const variants = Object.values(b.skills).filter((s) => s.element !== 'None' && archetypes.has(s.archetype));
  const elements = new Set(variants.map((s) => s.element));
  for (const s of variants) {
    const baseId = s.id.split('.')[0]!;
    const baseSkill = b.skills[baseId];
    if (!baseSkill) issues.push({ level: 'error', where: `skills.${s.id}`, message: `no base skill "${baseId}"` });
    else if (baseSkill.archetype !== s.archetype) {
      issues.push({ level: 'error', where: `skills.${s.id}`, message: `archetype ${s.archetype} differs from base ${baseSkill.archetype}` });
    }
    if (s.id !== variantId(baseId, s.element)) issues.push({ level: 'error', where: `skills.${s.id}`, message: `id should be "${variantId(baseId, s.element)}"` });
  }
  for (const el of elements) {
    const missing = base.filter((s) => !b.skills[variantId(s.id, el)]).map((s) => s.id);
    if (missing.length) issues.push({ level: 'warning', where: `element ${el}`, message: `missing variants: ${missing.join(', ')}` });
  }
  return issues;
}

/** Glossary entries with their defaults filled in from the statuses they explain. */
function resolveGlossary(
  entries: Record<string, z.output<typeof glossaryFileEntry> & { id: string }>,
  statuses: Record<string, EffectDef>,
  issues: ContentIssue[],
): Record<string, GlossaryDef> {
  const out: Record<string, GlossaryDef> = {};
  for (const e of Object.values(entries)) {
    const where = `glossary.${e.id}`;
    const status = e.status ? statuses[e.status] : undefined;
    if (e.status && !status) issues.push({ level: 'error', where, message: `unknown status "${e.status}"` });
    const name = e.name ?? status?.name;
    const text = e.text ?? status?.description;
    if (!name || !text) {
      issues.push({ level: 'error', where, message: 'needs a name and text, or a status that has them' });
      continue;
    }
    out[e.id] = {
      id: e.id,
      name,
      text,
      forms: e.forms ?? [name],
      ...(e.element ? { element: e.element } : {}),
      ...(e.status ? { status: e.status } : {}),
    };
  }
  return out;
}

/** Keywords: each word form belongs to one keyword, and elements exist. */
export function checkGlossary(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const elements = new Set(Object.values(b.skills).map((s) => s.element));
  const owner = new Map<string, string>();
  for (const g of Object.values(b.glossary)) {
    const where = `glossary.${g.id}`;
    if (g.element && !elements.has(g.element)) issues.push({ level: 'error', where, message: `unknown element "${g.element}"` });
    for (const f of g.forms) {
      const other = owner.get(f);
      if (other) issues.push({ level: 'error', where, message: `"${f}" already means ${other}` });
      owner.set(f, g.id);
    }
  }
  return issues;
}

/**
 * Fusions (GDD §7.3): each is made from two base elements, no pair makes two fusions, and a fusion
 * isn't named like a base element. Every pair of base elements (one element twice included) should
 * have a fusion: a gap is a warning, since the game only needs them once skills have fusion variants.
 */
export function checkFusions(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  // Base elements: every skill element except None and the fusions' own names (fusion kits). A
  // name that some pair is made from stays a base element, so a fusion can't hide one.
  const fusionNames = new Set(Object.values(b.fusions).map((f) => f.name));
  const pairElements = new Set(Object.values(b.fusions).flatMap((f) => f.elements));
  const elements = [...new Set(Object.values(b.skills).map((s) => s.element))]
    .filter((e) => e !== 'None' && (!fusionNames.has(e) || pairElements.has(e)))
    .sort();
  const seen = new Map<string, string>();
  for (const f of Object.values(b.fusions)) {
    const where = `fusions.${f.id}`;
    for (const id of f.passives ?? []) if (!b.statuses[id]) issues.push({ level: 'error', where, message: `unknown passive status "${id}"` });
    for (const el of f.elements) if (!elements.includes(el)) issues.push({ level: 'error', where, message: `unknown element "${el}"` });
    if (elements.includes(f.name)) issues.push({ level: 'error', where, message: `"${f.name}" is a base element's name` });
    const key = fusionKey(f.elements[0], f.elements[1]);
    const other = seen.get(key);
    if (other) issues.push({ level: 'error', where, message: `${f.elements.join(' + ')} already makes ${other}` });
    seen.set(key, f.name);
  }
  if (Object.keys(b.fusions).length > 0) {
    const missing = elements.flatMap((a, i) => elements.slice(i).filter((c) => !seen.has(fusionKey(a, c))).map((c) => `${a} + ${c}`));
    if (missing.length) issues.push({ level: 'warning', where: 'fusions', message: `no fusion for ${missing.join(', ')}` });
  }
  return issues;
}

// ---------------------------------------------------------------- lint

// Misspellings from the sheets, and retired names ("Bolster" → Bless, "Guardian" class → Paladin).
// "Guardian Strike" is a real Holy skill name, so it's allowed.
const RETIRED: { word: string; pattern: RegExp }[] = [
  { word: 'Rarvage', pattern: /\bRarvage\b/ },
  { word: 'Mirslead', pattern: /\bMirslead\b/ },
  { word: 'Nurmb', pattern: /\bNurmb\b/ },
  { word: 'Bolster', pattern: /\bBolster\b/ },
  { word: 'Guardian', pattern: /\bGuardian\b(?! Strike)/ },
];

export function lintSkills(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });

  for (const s of Object.values(b.skills)) {
    const where = `skills.${s.id}`;
    const strat = s.tags.includes('Strategic');
    if (strat === s.tags.includes('NonStrategic')) err(where, 'must be tagged exactly one of Strategic / NonStrategic (Q4)');
    // Divine's Radiant skills are neither: their target decides (Harmful on enemies, Helpful on allies).
    if (s.tags.includes('Radiant')) {
      if (s.tags.includes('Harmful') || s.tags.includes('Helpful')) err(where, 'a Radiant skill is neither Harmful nor Helpful');
      if (s.target !== 'any') err(where, 'a Radiant skill targets any unit');
    } else if (s.tags.includes('Harmful') === s.tags.includes('Helpful')) err(where, 'must be tagged exactly one of Harmful / Helpful');
    if ((s.target === 'enemy' || s.target === 'allEnemies') && s.tags.includes('Helpful')) {
      warn(where, 'targets enemies but is tagged Helpful');
    }

    // Strategic = "not explicitly directly damaging": compare the tag with the skill's direct damage.
    let direct = false;
    const scanDirect = (ops: readonly Op[], seen: Set<string>) =>
      walkOps(ops, (op, inInline) => {
        // Macros count as part of the skill (Divine's Radiant halves live in macros).
        if (op.op === 'macro' && !inInline && !seen.has(op.id)) {
          seen.add(op.id);
          scanDirect(b.macros[op.id] ?? [], seen);
        }
        if (op.op !== 'damage') return;
        if (!inInline && op.direct !== false) direct = true;
      });
    scanDirect(s.ops, new Set());
    // Delayed payloads (onExpire) of the skill's own effects are direct too.
    walkOps(s.ops, (op) => {
      if (op.op === 'apply' && typeof op.effect !== 'string') {
        walkOps(op.effect.onExpire ?? [], (inner) => {
          if (inner.op === 'damage' && inner.direct !== false) direct = true;
        });
      }
    });
    if (strat && direct) warn(where, 'tagged Strategic but deals direct damage');
    if (!strat && !direct && !s.tags.includes('Channeled')) warn(where, 'tagged NonStrategic but deals no direct damage');

    for (const { word, pattern } of RETIRED) {
      if (pattern.test(s.description) || pattern.test(s.name)) err(where, `contains retired/misspelled word "${word}"`);
    }
  }
  return issues;
}
