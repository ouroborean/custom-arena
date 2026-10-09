// Writes one markdown brief per animation group (base, the 10 elements, the 55 fusions) for whoever
// concepts that group's animations: its skills (with what they target, apply, summon and remove), the
// statuses defined inside them, its minions and what their passives do, and the named statuses and
// macros its files define. Also writes groups.json: each group's skill, status, macro and minion ids,
// which scripts/animations/validate.mts checks the concept files against.
//
//   npx tsx scripts/animations/digest.mts <out-dir>

import { loadContentOrThrow } from '@arena/content';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = join(ROOT, 'packages', 'content', 'data');
const out = process.argv[2];
if (!out) throw new Error('usage: digest.mts <out-dir>');
mkdirSync(out, { recursive: true });

const c = loadContentOrThrow();
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ELEMENTS = ['fire', 'ice', 'water', 'lightning', 'wind', 'poison', 'earth', 'holy', 'unholy', 'shadow'];
const fusions = c.fusions as Record<string, { name: string; elements: string[] }>;
const groupDir = (g: string) => (g === 'base' ? join(DATA, 'base') : ELEMENTS.includes(g) ? join(DATA, g) : join(DATA, 'fusions', g));
const groups = ['base', ...ELEMENTS, ...Object.keys(fusions)];
const groupOfElement = (el: string | undefined) => (!el || el === 'None' ? 'base' : el.toLowerCase());

/** Top-level keys of every <kind>*.yaml in a group's folder, with the file they're in. */
function keysIn(g: string, kind: string): { id: string; file: string }[] {
  const dir = groupDir(g);
  return readdirSync(dir)
    .filter((f) => f.startsWith(kind) && f.endsWith('.yaml'))
    .flatMap((f) => Object.keys(parse(readFileSync(join(dir, f), 'utf8')) ?? {}).map((id) => ({ id, file: relative(ROOT, join(dir, f)).replaceAll('\\', '/') })));
}

// What a list of ops does, in brief, and the statuses / macros / minions it touches.
interface Touches {
  applies: Set<string>;
  inline: Map<string, Any>;
  macros: Set<string>;
  summons: Set<string>;
  ops: Set<string>;
}
const touches = (): Touches => ({ applies: new Set(), inline: new Map(), macros: new Set(), summons: new Set(), ops: new Set() });
function walk(x: Any, t: Touches) {
  if (Array.isArray(x)) return x.forEach((y) => walk(y, t));
  if (!x || typeof x !== 'object') return;
  if (typeof x.op === 'string') {
    t.ops.add(x.op);
    if (x.op === 'apply') {
      if (typeof x.effect === 'string') t.applies.add(x.effect);
      else if (x.effect?.id) t.inline.set(x.effect.id, x.effect);
    }
    if (x.op === 'macro') t.macros.add(x.id);
    if (x.op === 'summon' && typeof x.minion === 'string') t.summons.add(x.minion);
  }
  for (const v of Object.values(x)) walk(v, t);
}

const statusUsers = new Map<string, Set<string>>(); // status id → groups whose skills apply it
const macroUsers = new Map<string, Set<string>>();
const skillsByGroup = new Map<string, Any[]>();
for (const s of Object.values<Any>(c.skills)) {
  const g = groupOfElement(s.element);
  (skillsByGroup.get(g) ?? skillsByGroup.set(g, []).get(g)!).push(s);
  const t = touches();
  walk(s.ops, t);
  for (const a of t.applies) (statusUsers.get(a) ?? statusUsers.set(a, new Set()).get(a)!).add(g);
  for (const m of t.macros) (macroUsers.get(m) ?? macroUsers.set(m, new Set()).get(m)!).add(g);
}

const costText = (cost: Record<string, number> | undefined) =>
  Object.entries(cost ?? {}).flatMap(([k, n]) => Array<string>(n).fill(k)).join('') || 'free';
const line = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const index: Record<string, Any> = {};

for (const g of groups) {
  const fusion = fusions[g];
  const elements = g === 'base' ? ['None'] : fusion ? fusion.elements : [g[0]!.toUpperCase() + g.slice(1)];
  const name = g === 'base' ? 'Base (elementless)' : (fusion?.name ?? elements[0]!);
  const skills = (skillsByGroup.get(g) ?? []).slice();
  const minionRows = keysIn(g, 'minions');
  const minionIds = minionRows.map((m) => m.id).filter((id) => c.minions[id]);
  const minionSkillIds = new Set(minionIds.flatMap((m) => (c.minions[m] as Any).skills ?? []));
  const statusRows = keysIn(g, 'statuses').filter((s) => c.statuses[s.id]);
  const macroRows = keysIn(g, 'macros').filter((m) => c.macros[m.id]);
  const skillFile = keysIn(g, 'skills')[0]?.file ?? '';

  const md: string[] = [];
  md.push(`# ${name} — animation brief`, '');
  md.push(`Group id: \`${g}\`. Element(s): ${elements.join(' + ')}. Concept file: \`docs/animations/concepts/${g}.yaml\`.`);
  md.push(`Skill source: \`${skillFile}\`${minionRows.length ? `; minions: \`${minionRows[0]!.file}\`` : ''}${statusRows.length ? `; statuses: \`${statusRows[0]!.file}\`` : ''}${macroRows.length ? `; macros: \`${macroRows[0]!.file}\`` : ''}.`);
  md.push('', `## Skills (${skills.length})`, '');
  const ordered = [...skills.filter((s) => !minionSkillIds.has(s.id)), ...skills.filter((s) => minionSkillIds.has(s.id))];
  for (const s of ordered) {
    const t = touches();
    walk(s.ops, t);
    const owner = minionSkillIds.has(s.id) ? minionIds.find((m) => ((c.minions[m] as Any).skills ?? []).includes(s.id)) : undefined;
    md.push(`### \`${s.id}\` — ${s.name}${owner ? ` (minion skill of \`${owner}\`)` : ''}`);
    md.push(`- ${s.archetype ?? 'Minion'} · cost ${costText(s.cost)} · cooldown ${s.cooldown ?? 0} · target **${s.target}** · tags ${(s.tags ?? []).join(', ')}`);
    md.push(`- ${line(s.description)}`);
    const parts = [
      t.applies.size && `applies: ${[...t.applies].join(', ')}`,
      t.inline.size && `inline statuses: ${[...t.inline.keys()].join(', ')}`,
      t.macros.size && `macros: ${[...t.macros].join(', ')}`,
      t.summons.size && `summons: ${[...t.summons].join(', ')}`,
      `ops: ${[...t.ops].join(', ')}`,
    ].filter(Boolean);
    md.push(`- ${parts.join(' · ')}`);
    for (const [id, e] of t.inline) {
      const trig = (e.triggers ?? []).map((tr: Any) => tr.on + (tr.intercept ? `/${tr.intercept}` : '')).join(', ');
      md.push(`  - inline \`${id}\` (${e.kind ?? '?'}${e.visibility === 'hidden' ? ', hidden' : ''}${trig ? `; triggers: ${trig}` : ''}): ${line(e.description)}`);
    }
    md.push('');
  }
  if (minionIds.length) {
    md.push(`## Minions (${minionIds.length})`, '', 'A minion acts through its skills (above) and its passives\' triggers (below): concept the passive actions too.', '');
    for (const m of minionIds) {
      const def = c.minions[m] as Any;
      md.push(`- \`${m}\` — ${def.name}, ${def.hp} HP; skills: ${(def.skills ?? []).join(', ') || 'none'}`);
      for (const p of def.passives ?? []) {
        const pd = typeof p === 'string' ? (c.statuses[p] as Any) : p;
        const trig = (pd?.triggers ?? []).map((tr: Any) => tr.on).join(', ');
        md.push(`  - passive \`${pd?.id ?? p}\`${trig ? ` (triggers: ${trig})` : ''}: ${line(pd?.description)}`);
      }
    }
    md.push('');
  }
  if (statusRows.length) {
    md.push(`## Named statuses defined here (${statusRows.length}) — this group owns their default animations`, '');
    for (const { id } of statusRows) {
      const s = c.statuses[id] as Any;
      const trig = (s.triggers ?? []).map((tr: Any) => tr.on + (tr.intercept ? `/${tr.intercept}` : '')).join(', ');
      md.push(`- \`${id}\` — ${s.name} (${s.kind}${trig ? `; triggers: ${trig}` : ''}): ${line(s.description)} _Applied by skills in: ${[...(statusUsers.get(id) ?? [])].join(', ') || 'none directly'}._`);
    }
    md.push('');
  }
  if (macroRows.length) {
    md.push(`## Macros defined here (${macroRows.length}) — this group owns their default animations`, '');
    for (const { id } of macroRows) {
      const t = touches();
      walk(c.macros[id], t);
      md.push(`- \`${id}\`: ops ${[...t.ops].join(', ')}${t.applies.size ? `; applies ${[...t.applies].join(', ')}` : ''}. _Used by: ${[...(macroUsers.get(id) ?? [])].join(', ') || 'none directly'}._`);
    }
    md.push('');
  }
  writeFileSync(join(out, `${g}.md`), md.join('\n'));
  index[g] = {
    name,
    elements,
    skills: ordered.map((s) => s.id),
    minions: minionIds,
    statuses: statusRows.map((s) => s.id),
    macros: macroRows.map((m) => m.id),
  };
}
writeFileSync(join(out, 'groups.json'), JSON.stringify(index, null, 1));
const total = Object.values<Any>(index).reduce((n, g) => n + g.skills.length, 0);
console.log(`${groups.length} groups, ${total} skills → ${out}`);
