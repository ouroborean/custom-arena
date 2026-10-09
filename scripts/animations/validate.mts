// Checks animation concept files (docs/animations/concepts/<group>.yaml) against the spec in
// docs/animations/README.md: every skill, owned status, minion passive and macro of the group is
// covered; every cue names a real animation and valid fields; HiddenTarget skills give nothing away.
// Warnings flag likely gaps (a damaging skill with no `hit` cue, an inline counter with no `trigger`).
//
//   npx tsx scripts/animations/validate.mts            every concept file present
//   npx tsx scripts/animations/validate.mts fire ice   just these groups
//   --strict                                           warnings fail too

import { loadContentOrThrow } from '@arena/content';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = join(ROOT, 'docs', 'animations');
const CONCEPTS = join(DOCS, 'concepts');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = args.filter((a) => !a.startsWith('--'));

const content = loadContentOrThrow();
const catalog: Record<string, Any> = parse(readFileSync(join(DOCS, 'catalog.yaml'), 'utf8'));
const groups: Record<string, Any> = JSON.parse(readFileSync(join(DOCS, 'briefs', 'groups.json'), 'utf8'));

const ON = new Set(['cast', 'travel', 'hit', 'blocked', 'heal', 'apply', 'remove', 'summon', 'death', 'revive', 'trigger', 'resolve']);
const ANCHORS = new Set(['actor', 'target', 'bearer', 'minion', 'source', 'allies', 'enemies', 'allySide', 'enemySide', 'field']);
const PATHS = new Set(['straight', 'arc', 'drop', 'rise', 'beam', 'return']);
const FACES = new Set(['fromActor', 'toActor', 'toTarget', 'up', 'down', 'left', 'right']);
const ELEMENTS = new Set(['Fire', 'Ice', 'Water', 'Lightning', 'Wind', 'Poison', 'Earth', 'Holy', 'Unholy', 'Shadow']);
const TINTS = new Set(['element', 'element2', 'duo', 'source', 'neutral', 'native']);
const CUE_KEYS = new Set(['on', 'status', 'only', 'fx', 'at', 'from', 'to', 'path', 'face', 'size', 'scale', 'tint', 'tone', 'variant', 'offset', 'delay', 'stagger', 'repeat', 'speed', 'layer', 'opacity', 'flip', 'frames', 'note']);
const CAST_ANCHORS = new Set(['actor', 'allySide', 'field']);
const STATUS_KEYS = new Set(['apply', 'tick', 'trigger', 'remove', 'expire', 'aura', 'note']);
const DEFAULT_KEYS = new Set(['hit', 'blocked', 'heal', 'death', 'revive', 'summon', 'counter', 'effectBlocked', 'skillFailed', 'shieldBreak', 'interrupted', 'note']);
const TOP_KEYS = new Set(['group', 'statuses', 'macros', 'skills', 'defaults', 'notes']);
const isText = (id: string) => /^symbol_.*_text_\d+$/.test(id) || /^symbol_(place|rank)_/.test(id);

// Cross-file context: every concept file present, for the signature and shared-art warnings.
const allDocs: Record<string, Any> = {};
if (existsSync(CONCEPTS)) {
  for (const f of readdirSync(CONCEPTS).filter((x) => x.endsWith('.yaml'))) {
    try {
      allDocs[f.slice(0, -5)] = parse(readFileSync(join(CONCEPTS, f), 'utf8'));
    } catch {
      /* reported when that group is checked */
    }
  }
}
/** The main art of a skill concept: its first hit, else its first non-cast cue, else its first cue. */
const mainFxOf = (s: Any): string | undefined =>
  s?.cues?.find((c: Any) => c?.on === 'hit')?.fx ?? s?.cues?.find((c: Any) => c?.on !== 'cast')?.fx ?? s?.cues?.[0]?.fx;
/** Base status signatures: art in a base status's apply/aura default → the statuses it signals. */
const signatures = new Map<string, Set<string>>();
for (const [sid, st] of Object.entries<Any>(allDocs.base?.statuses ?? {})) {
  for (const k of ['apply', 'aura']) {
    for (const c of ([] as Any[]).concat(st?.[k] ?? [])) if (c?.fx) (signatures.get(c.fx) ?? signatures.set(c.fx, new Set()).get(c.fx)!).add(sid);
  }
}
/** archetype → main fx → groups using it as that archetype's main art. */
const archetypeArt = new Map<string, Map<string, Set<string>>>();
for (const [g, d] of Object.entries<Any>(allDocs)) {
  for (const [id, s] of Object.entries<Any>(d?.skills ?? {})) {
    if (!id.includes('.')) continue;
    const fx = mainFxOf(s);
    if (!fx) continue;
    const a = id.split('.')[0]!;
    const m = archetypeArt.get(a) ?? archetypeArt.set(a, new Map()).get(a)!;
    (m.get(fx) ?? m.set(fx, new Set()).get(fx)!).add(g);
  }
}
const SHARED_ART_LIMIT = 6;

let errors = 0;
let warnings = 0;

function walkOps(x: Any, f: (op: Any) => void) {
  if (Array.isArray(x)) return x.forEach((y) => walkOps(y, f));
  if (!x || typeof x !== 'object') return;
  if (typeof x.op === 'string') f(x);
  for (const v of Object.values(x)) walkOps(v, f);
}

function checkGroup(g: string) {
  const info = groups[g];
  const file = join(CONCEPTS, `${g}.yaml`);
  const out: string[] = [];
  const err = (m: string) => (errors++, out.push(`  ✗ ${m}`));
  const warn = (m: string) => (warnings++, out.push(`  ! ${m}`));
  if (!info) return console.log(`${g}: not a group (see docs/animations/briefs/groups.json)`), errors++;
  if (!existsSync(file)) return console.log(`${g}: no concept file`), errors++;
  let doc: Any;
  try {
    doc = parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`${g}: YAML doesn't parse — ${(e as Error).message.split('\n')[0]}`);
    errors++;
    return;
  }
  if (!doc || typeof doc !== 'object') return console.log(`${g}: empty file`), errors++;
  if (doc.group !== g) err(`group: should be "${g}"`);
  for (const k of Object.keys(doc)) if (!TOP_KEYS.has(k)) err(`unknown top-level key "${k}"`);
  if (doc.defaults && g !== 'base') err('`defaults` belongs in base.yaml only');

  /** Validates one cue. `ctx.on` is implied for status/macro/default cues; `inline` = the skill's inline status ids. */
  const cue = (where: string, c: Any, ctx: { implied?: string; inline?: Set<string>; hiddenTarget?: boolean }) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return err(`${where}: a cue must be a mapping`);
    for (const k of Object.keys(c)) if (!CUE_KEYS.has(k)) err(`${where}: unknown field "${k}"`);
    const on = ctx.implied ?? c.on;
    if (!ctx.implied) {
      if (!ON.has(c.on)) err(`${where}: on "${c.on}" isn't one of ${[...ON].join(', ')}`);
    } else if (c.on !== undefined) err(`${where}: no \`on\` here (it's implied by the key)`);
    if (c.fx === 'none') {
      if (!(on === 'apply' || on === 'remove' || on === 'trigger') || !c.status) err(`${where}: fx none only silences a status default (on apply/remove/trigger with status)`);
    } else {
      const a = catalog[c.fx];
      if (!a) err(`${where}: fx "${c.fx}" isn't in the catalog`);
      else if (a.duplicateOf) err(`${where}: fx "${c.fx}" is a duplicate — use "${a.duplicateOf}"`);
      else {
        if (isText(c.fx)) err(`${where}: fx "${c.fx}" is a text/ranking banner, not for skills`);
        if (c.size !== undefined && !(c.size in a.sizes)) err(`${where}: size "${c.size}" — ${c.fx} has ${Object.keys(a.sizes).join('/')}`);
        if (c.variant !== undefined && !a.colors.includes(c.variant)) err(`${where}: variant "${c.variant}" — ${c.fx} has ${a.colors.join(', ')}`);
        if (c.variant !== undefined && c.tint !== undefined) warn(`${where}: both variant and tint — variant wins`);
        if (c.frames !== undefined) {
          const f = c.frames;
          if (!(Array.isArray(f) && f.length === 2 && f.every((n: Any) => Number.isInteger(n)) && f[0] >= 0 && f[0] <= f[1] && f[1] < a.frames)) {
            err(`${where}: frames should be [first, last] within 0–${a.frames - 1}`);
          }
        }
      }
    }
    if (c.status !== undefined) {
      if (!(on === 'apply' || on === 'remove' || on === 'trigger')) err(`${where}: status only applies to apply/remove/trigger cues`);
      const s = String(c.status);
      if (!['buff', 'debuff', 'any'].includes(s) && !content.statuses[s] && !ctx.inline?.has(s)) err(`${where}: status "${s}" isn't a status or one of this skill's inline statuses`);
    }
    if (on === 'trigger' && !ctx.implied && !c.status) err(`${where}: a trigger cue names its status`);
    for (const k of ['at', 'from', 'to'] as const) if (c[k] !== undefined && !ANCHORS.has(c[k])) err(`${where}: ${k} "${c[k]}" isn't an anchor`);
    if ((c.from !== undefined || c.to !== undefined || c.path !== undefined) && on !== 'travel') err(`${where}: from/to/path are for travel cues`);
    if (c.path !== undefined && !PATHS.has(c.path)) err(`${where}: path "${c.path}"`);
    if (c.face !== undefined && !FACES.has(c.face) && typeof c.face !== 'number') err(`${where}: face "${c.face}"`);
    if (c.tint !== undefined) {
      const t = String(c.tint);
      if (/^#[0-9a-fA-F]{6}$/.test(t)) warn(`${where}: raw tint ${t} — use a token (element, element2, duo, source, neutral, an element) and tone`);
      else if (!TINTS.has(t) && !ELEMENTS.has(t)) err(`${where}: tint "${t}"`);
    }
    if (c.tone !== undefined && !['light', 'dark'].includes(c.tone)) err(`${where}: tone "${c.tone}" (light or dark)`);
    if (c.only !== undefined) {
      if (!['primary', 'others'].includes(c.only)) err(`${where}: only "${c.only}" (primary or others)`);
      if (!['hit', 'heal', 'apply', 'remove'].includes(on)) err(`${where}: only applies to hit/heal/apply/remove cues`);
    }
    if (on === 'travel' && c.face !== undefined && !ctx.implied) err(`${where}: travel art orients along its path — drop face`);
    if (on === 'cast' && !ctx.implied && c.at !== undefined && !CAST_ANCHORS.has(c.at)) err(`${where}: nothing lands on cast — put target-side art on travel/hit/apply/heal/resolve (cast is at actor, allySide or field)`);
    const num = (k: string, lo: number, hi: number, int = false) => {
      if (c[k] === undefined) return;
      if (typeof c[k] !== 'number' || c[k] < lo || c[k] > hi || (int && !Number.isInteger(c[k]))) err(`${where}: ${k} ${c[k]} (expected ${lo}–${hi})`);
    };
    num('scale', 0.2, 4);
    num('delay', 0, 4000);
    num('stagger', 0, 1000);
    num('repeat', 1, 6, true);
    num('speed', 0.5, 2);
    num('opacity', 0.1, 1);
    if (c.offset !== undefined && !(Array.isArray(c.offset) && c.offset.length === 2 && c.offset.every((n: Any) => typeof n === 'number' && Math.abs(n) <= 3))) err(`${where}: offset should be [x, y] within ±3`);
    if (c.layer !== undefined && !['over', 'under'].includes(c.layer)) err(`${where}: layer "${c.layer}"`);
    if (c.flip !== undefined && !['x', 'y'].includes(c.flip)) err(`${where}: flip "${c.flip}"`);
    if (ctx.hiddenTarget && on === 'travel') err(`${where}: HiddenTarget skill — no travel toward the target`);
    if (ctx.hiddenTarget && on === 'cast' && (c.at === 'target' || c.face === 'toTarget')) err(`${where}: HiddenTarget skill — the cast mustn't point at the target`);
  };
  const cueList = (where: string, list: Any, ctx: Parameters<typeof cue>[2]) => {
    if (!Array.isArray(list)) return err(`${where}: expected a list of cues`);
    list.forEach((c, i) => cue(`${where}[${i}]`, c, ctx));
  };

  // Skills: exactly the group's, each with a beat and cues.
  const skills = doc.skills ?? {};
  const want = new Set<string>(info.skills);
  for (const id of want) if (!(id in skills)) err(`skill ${id}: missing`);
  const mainFx = new Map<string, string[]>();
  for (const [id, s] of Object.entries<Any>(skills)) {
    if (!want.has(id)) {
      err(`skill ${id}: not in this group`);
      continue;
    }
    const def = content.skills[id] as Any;
    for (const k of Object.keys(s ?? {})) if (!['beat', 'cues', 'note'].includes(k)) err(`skill ${id}: unknown key "${k}"`);
    if (!s?.beat || typeof s.beat !== 'string') err(`skill ${id}: needs a one-line beat`);
    if (!Array.isArray(s?.cues) || s.cues.length === 0) {
      err(`skill ${id}: needs cues`);
      continue;
    }
    const inline = new Map<string, Any>();
    const ops = new Set<string>();
    walkOps(def.ops, (op) => {
      ops.add(op.op);
      if (op.op === 'apply' && op.effect && typeof op.effect === 'object') inline.set(op.effect.id, op.effect);
    });
    const hiddenTarget = (def.tags ?? []).includes('HiddenTarget');
    cueList(`skill ${id}.cues`, s.cues, { inline: new Set(inline.keys()), hiddenTarget });
    const ons = new Set(s.cues.map((c: Any) => c?.on));
    const triggered = new Set(s.cues.filter((c: Any) => c?.on === 'trigger').map((c: Any) => c.status));
    if (ops.has('damage') && !ons.has('hit')) warn(`skill ${id}: deals damage but has no hit cue`);
    if (ops.has('heal') && !ons.has('heal')) warn(`skill ${id}: heals but has no heal cue`);
    if (ops.has('summon') && !ons.has('summon')) warn(`skill ${id}: summons but has no summon cue`);
    for (const [iid, e] of inline) if ((e.triggers ?? []).length && !triggered.has(iid)) warn(`skill ${id}: inline ${iid} has triggers but no trigger cue`);
    const applied = new Set<string>();
    walkOps(def.ops, (op) => op.op === 'apply' && typeof op.effect === 'string' && applied.add(op.effect));
    if (g !== 'base') {
      for (const [i, c] of s.cues.entries()) {
        const sig = signatures.get(c?.fx);
        // A Trap/Taunt-archetype skill setting its own snare or taunt may share that base look on purpose,
        // and an apply cue for the status itself is that status (however the skill applies it).
        const arch = id.split('.')[0];
        const own = (arch === 'trap' && sig?.has('trap')) || (arch === 'taunt' && sig?.has('taunt')) || (c?.on === 'apply' && sig?.has(c.status));
        if (sig && !own && ![...sig].some((x) => applied.has(x))) warn(`skill ${id}.cues[${i}]: ${c.fx} is the signature of ${[...sig].join('/')} (base) — it will read as that status`);
      }
    }
    const main = mainFxOf(s);
    if (main && id.includes('.')) {
      const users = archetypeArt.get(id.split('.')[0]!)?.get(main);
      if (users && users.size > SHARED_ART_LIMIT) warn(`skill ${id}: ${main} is this archetype's main art in ${users.size} groups (${[...users].join(', ')}) — use different art or layer it with your own`);
    }
    if (main) (mainFx.get(main) ?? mainFx.set(main, []).get(main)!).push(id);
  }
  for (const [fx, ids] of mainFx) if (ids.length > 3) warn(`fx ${fx} is the main effect of ${ids.length} skills (${ids.join(', ')}) — vary it`);

  // Statuses: the group's named statuses and its minions' triggered inline passives.
  const statuses = doc.statuses ?? {};
  const owned = new Set<string>(info.statuses);
  for (const m of info.minions) {
    for (const p of (content.minions[m] as Any).passives ?? []) {
      if (typeof p === 'object' && (p.triggers ?? []).length) owned.add(p.id);
    }
  }
  for (const id of owned) if (!(id in statuses)) err(`status ${id}: missing default`);
  for (const [id, s] of Object.entries<Any>(statuses)) {
    if (!owned.has(id)) warn(`status ${id}: not owned by this group (defaults belong with the group that defines it)`);
    if (g !== 'base') {
      for (const k of ['apply', 'aura']) {
        for (const c of ([] as Any[]).concat(s?.[k] ?? [])) {
          const sig = signatures.get(c?.fx);
          if (sig) warn(`status ${id}.${k}: ${c.fx} is the signature of ${[...sig].join('/')} (base) — pick art of its own`);
        }
      }
    }
    if (!s || typeof s !== 'object') {
      err(`status ${id}: expected a mapping of apply/tick/trigger/remove/expire/aura`);
      continue;
    }
    for (const [k, v] of Object.entries<Any>(s)) {
      if (!STATUS_KEYS.has(k)) err(`status ${id}: unknown key "${k}"`);
      else if (k === 'aura') (Array.isArray(v) ? cueList : cue)(`status ${id}.aura`, v, { implied: 'apply' });
      else if (k !== 'note') cueList(`status ${id}.${k}`, v, { implied: k === 'tick' || k === 'expire' ? 'apply' : k });
    }
  }

  // Macros.
  const macros = doc.macros ?? {};
  for (const id of info.macros) if (!(id in macros)) err(`macro ${id}: missing`);
  for (const [id, list] of Object.entries<Any>(macros)) {
    if (!info.macros.includes(id)) err(`macro ${id}: not defined by this group`);
    else cueList(`macro ${id}`, list, { implied: 'hit' });
  }

  if (doc.defaults) {
    for (const [k, v] of Object.entries<Any>(doc.defaults)) {
      if (!DEFAULT_KEYS.has(k)) err(`defaults.${k}: unknown (one of ${[...DEFAULT_KEYS].join(', ')})`);
      else if (k !== 'note') cueList(`defaults.${k}`, v, { implied: 'hit' });
    }
  }

  const n = Object.keys(skills).length;
  console.log(`${g}: ${n}/${want.size} skills, ${Object.keys(statuses).length}/${owned.size} statuses, ${Object.keys(macros).length}/${info.macros.length} macros${out.length ? '' : ' — ok'}`);
  for (const l of out) console.log(l);
}

const targets = only.length ? only : existsSync(CONCEPTS) ? readdirSync(CONCEPTS).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)) : [];
if (!targets.length) console.log('No concept files yet.');
for (const g of targets) checkGroup(g);
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors || (strict && warnings) ? 1 : 0);
