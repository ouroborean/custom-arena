// Turns raw parsed content files into a validated ContentBundle. Pure (no filesystem), so it can
// also run in the browser or at server boot.

import { scripts, type ClassDef, type ContentBundle, type EffectDef, type MinionDef, type Op, type SkillDef } from '@arena/engine';
import { z } from 'zod';
import { classFileEntry, effectDefSchema, minionFileEntry, skillFileEntry } from './schema.js';

export interface RawContent {
  skills: Record<string, unknown>;
  statuses: Record<string, unknown>;
  minions: Record<string, unknown>;
  classes: Record<string, unknown>;
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

  const version = contentHash(canonicalJson({ skills, statuses, minions, classes }));
  const bundle: ContentBundle = { version, skills, statuses, minions, classes };
  issues.push(...checkReferences(bundle), ...lintSkills(bundle));
  return { bundle, issues };
}

// ---------------------------------------------------------------- referential integrity

function walkOps(ops: readonly Op[], visit: (op: Op, inInline: boolean) => void, inInline = false): void {
  for (const op of ops) {
    visit(op, inInline);
    if (op.op === 'if') {
      walkOps(op.then, visit, inInline);
      walkOps(op.else ?? [], visit, inInline);
    } else if (op.op === 'forEach') {
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
    });

  for (const s of Object.values(b.skills)) checkOps(`skills.${s.id}`, s.ops);
  for (const st of Object.values(b.statuses)) {
    walkEffect(st, (op) => checkOps(`statuses.${st.id}`, [op]));
    for (const m of st.modifiers ?? []) {
      if (m.mod === 'negateNext' && !b.statuses[m.effect]) err(`statuses.${st.id}`, `negateNext refers to unknown status "${m.effect}"`);
    }
  }
  for (const m of Object.values(b.minions)) {
    for (const sk of m.skills) if (!b.skills[sk]) err(`minions.${m.id}`, `unknown skill "${sk}"`);
    for (const p of m.passives) {
      if (typeof p === 'string') {
        if (!b.statuses[p]) err(`minions.${m.id}`, `unknown status "${p}"`);
      } else walkEffect(p, (op) => checkOps(`minions.${m.id}`, [op]));
    }
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

// ---------------------------------------------------------------- lint

const TYPO_WORDS = ['Rarvage', 'Mirslead', 'Nurmb', 'Bolster', 'Guardian'];

export function lintSkills(b: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });

  for (const s of Object.values(b.skills)) {
    const where = `skills.${s.id}`;
    const strat = s.tags.includes('Strategic');
    if (strat === s.tags.includes('NonStrategic')) err(where, 'must be tagged exactly one of Strategic / NonStrategic (Q4)');
    if (s.tags.includes('Harmful') === s.tags.includes('Helpful')) err(where, 'must be tagged exactly one of Harmful / Helpful');
    if ((s.target === 'enemy' || s.target === 'allEnemies') && s.tags.includes('Helpful')) {
      warn(where, 'targets enemies but is tagged Helpful');
    }

    // Strategic = "not explicitly directly damaging": compare the tag with the skill's direct damage.
    let direct = false;
    walkOps(s.ops, (op, inInline) => {
      if (op.op !== 'damage') return;
      if (!inInline && op.direct !== false) direct = true;
    });
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

    for (const w of TYPO_WORDS) if (s.description.includes(w) || s.name.includes(w)) err(where, `contains retired/misspelled word "${w}"`);
  }
  return issues;
}
