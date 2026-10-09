// Plays the battle animation concepts (docs/animations/README.md) as turn playback steps through the
// engine's events. A skill's cues bind to the events it causes: `skillUsed` opens its context (cast and
// travel), the damage, heals, statuses, summons and deaths that follow play its hit/heal/apply/… cues,
// and the next skill or turn boundary closes it (resolve). Effects that fire later — a counter, a trap,
// a channel's pulse, a status ticking, a minion's passive — are traced back through the effect that
// caused them (inline effects are `<skillId>:<inlineId>`), and anything unexplained falls back to the
// board-wide defaults.

import type { EffectInstance, GameEvent, PlayerView, Unit } from '@arena/engine';
import { rampOfHex, stopsOf, vfxData, type Cue, type Face, type Stops, type VfxData } from './data.js';
import { clearAll, hasTag, liveTags, spawn, stopTag, type Placed } from './renderer.js';

const BASE_FPS = 20;
const TRAVEL_MS: [number, number] = [260, 560];

interface SkillCtx {
  skill: string;
  actor: string;
  targets: Set<string>;
  /** Units this skill has already hit (later hits on them come from its macros). */
  hit: Set<string>;
  /** A counter/trap/channel acting for its skill, after the fact. */
  trigger?: boolean;
}

let ctx: SkillCtx | null = null;
/** Inline effects whose trigger cue already played this turn (one flourish per firing). */
const fired = new Set<string>();

interface Scene {
  view: PlayerView;
  speed: number;
}

// ---------------------------------------------------------------- geometry

const portraitOf = (id: string) => document.querySelector<HTMLElement>(`.portrait[data-unit="${CSS.escape(id)}"]`);
const rectOf = (id: string | undefined) => (id ? portraitOf(id)?.getBoundingClientRect() ?? null : null);
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function unitHeight(): number {
  return document.querySelector<HTMLElement>('.portrait[data-unit]')?.getBoundingClientRect().height || 96;
}

/** The middle of a set of units' portraits (a side, or the whole board). */
function middleOf(ids: string[]): { x: number; y: number } | null {
  const rs = ids.map(rectOf).filter((r): r is DOMRect => !!r);
  if (!rs.length) return null;
  const l = Math.min(...rs.map((r) => r.left));
  const r = Math.max(...rs.map((r) => r.right));
  const t = Math.min(...rs.map((r) => r.top));
  const b = Math.max(...rs.map((r) => r.bottom));
  return { x: (l + r) / 2, y: (t + b) / 2 };
}

const DRAWN: Record<string, number> = {
  'points-right': 0,
  'points-left': Math.PI,
  'points-up': -Math.PI / 2,
  'points-down': Math.PI / 2,
  'diagonal-up-right': -Math.PI / 4,
  'diagonal-down-right': Math.PI / 4,
  'diagonal-up-left': (-3 * Math.PI) / 4,
  'diagonal-down-left': (3 * Math.PI) / 4,
};

/** Rotation and mirroring that make art drawn with `orientation` point along `dir` (radians). */
function orient(orientation: string, dir: number | null): { angle: number; flipX: boolean } {
  if (dir === null) return { angle: 0, flipX: false };
  const drawn = DRAWN[orientation];
  if (drawn !== undefined) return { angle: dir - drawn, flipX: false };
  // Sweeps, ground bursts, bands: mirror toward the left, never rotate (README `face`).
  return { angle: 0, flipX: Math.cos(dir) < -0.2 };
}

// ---------------------------------------------------------------- resolving a cue

interface Who {
  actor?: string;
  target?: string;
  bearer?: string;
  minion?: string;
  source?: string;
  /** The skill's chosen targets (for `only`, and `face: toTarget`). */
  primary?: string[];
}

interface Tinting {
  /** Group whose element(s) `element`/`element2`/`duo` mean. */
  group: string;
  /** Group of whatever caused it, for `source`. */
  source: string;
}

function stopsFor(d: VfxData, cue: Cue, t: Tinting): Stops | null {
  if (!cue.k?.endsWith('.t')) return null;
  const els = d.groupElements[t.group] ?? ['Neutral', 'Neutral'];
  const tint = cue.tint ?? 'element';
  let ramp: [string, string, string];
  if (tint === 'element' || tint === 'native') ramp = d.ramps[els[0]]!;
  else if (tint === 'element2') ramp = d.ramps[els[1]]!;
  else if (tint === 'duo') {
    const a = d.ramps[els[0]]!;
    const b = d.ramps[els[1]]!;
    ramp = [a[0], b[1], b[2]];
  } else if (tint === 'source') ramp = d.ramps[(d.groupElements[t.source] ?? ['Neutral'])[0]]!;
  else if (tint === 'neutral') ramp = d.ramps.Neutral!;
  else if (tint.startsWith('#')) ramp = rampOfHex(tint);
  else ramp = d.ramps[tint] ?? d.ramps.Neutral!;
  return stopsOf(ramp ?? d.ramps.Neutral!, cue.tone);
}

function unitsOfSide(view: PlayerView, owner: number, ally: boolean): string[] {
  return view.units.filter((u) => u.alive && (u.owner === owner) === ally).map((u) => u.id);
}

/** Plays one cue. `defAt` is where it plays when the cue doesn't say; `loop` tags an endless one (an aura). */
function play(cue: Cue, who: Who, defAt: string, tinting: Tinting, scene: Scene, loop?: string): void {
  const d = vfxData();
  if (!d || !cue.k || cue.fx === 'none') return;
  const sheet = d.sheets[cue.k];
  const art = d.fx[cue.fx];
  if (!sheet || !art) return;
  const { view, speed } = scene;
  const ownerOf = (id: string | undefined) => view.units.find((u) => u.id === id)?.owner;
  const side = ownerOf(who.actor ?? who.bearer ?? who.source) ?? view.viewer;
  const stops = stopsFor(d, cue, tinting);
  const frameMs = 1000 / (BASE_FPS * (cue.speed ?? 1) * speed);
  const n = sheet.n;
  const frames: [number, number] = cue.frames ? [Math.min(cue.frames[0], n - 1), Math.min(cue.frames[1], n - 1)] : [0, n - 1];
  const base = {
    key: cue.k,
    stops,
    sheet,
    frameMs,
    frames,
    repeat: loop ? Infinity : (cue.repeat ?? 1),
    layer: cue.layer ?? 'over',
    ...(loop ? { tag: loop } : {}),
  } as const;
  const delay = (cue.delay ?? 0) / speed;
  const unitOf = (a: string): string | undefined =>
    a === 'actor' ? who.actor : a === 'target' ? who.target : a === 'bearer' ? who.bearer : a === 'minion' ? who.minion : a === 'source' ? who.source : undefined;
  const scaleOf = () => (unitHeight() * (cue.scale ?? 1)) / sheet.h;
  const origin = art.a === 'ground' || art.a === 'overhead' ? 'bottom' : 'center';

  // Where the effect points, from the unit it plays on.
  const faceDir = (on: string | undefined): number | null => {
    const f: Face | undefined = cue.face;
    if (f === undefined) return null;
    if (typeof f === 'number') return (f * Math.PI) / 180;
    if (f === 'up') return -Math.PI / 2;
    if (f === 'down') return Math.PI / 2;
    if (f === 'left') return Math.PI;
    if (f === 'right') return 0;
    const here = rectOf(on);
    const there = rectOf(f === 'toTarget' ? (who.primary?.[0] ?? who.target) : who.actor);
    if (!here || !there) return null;
    const a = center(here);
    const b = center(there);
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 2) {
      // Playing on the actor itself: point toward the other side instead.
      return side === view.viewer ? 0 : Math.PI;
    }
    const toward = Math.atan2(b.y - a.y, b.x - a.x);
    return f === 'fromActor' ? toward + Math.PI : toward;
  };

  const placeAt = (getPoint: () => { x: number; y: number } | null, dir: () => number | null) => (): Placed | null => {
    const p = getPoint();
    if (!p) return null;
    const k = scaleOf();
    const o = orient(art.o, dir());
    const off = cue.offset ?? [0, 0];
    const u = unitHeight();
    let y = p.y - off[1] * u;
    if (art.a === 'ground') y += u / 2; // feet
    if (art.a === 'overhead') y -= u / 2; // head
    return {
      x: p.x + off[0] * u,
      y,
      angle: o.angle,
      sx: k * (o.flipX !== (cue.flip === 'x') ? -1 : 1),
      sy: k * (cue.flip === 'y' ? -1 : 1),
      origin,
      opacity: cue.opacity ?? 1,
    };
  };

  // Travel: from one unit to another, the art leading along its path.
  if (cue.on === 'travel') {
    const fromId = unitOf(cue.from ?? 'actor');
    const toId = unitOf(cue.to ?? 'target');
    const life = Math.max(TRAVEL_MS[0], Math.min(TRAVEL_MS[1], frameMs * (frames[1] - frames[0] + 1))) / speed;
    const path = cue.path ?? 'straight';
    spawn({
      ...base,
      delay,
      life,
      place: (t) => {
        const ra = rectOf(fromId);
        const rb = rectOf(toId);
        if (!ra || !rb) return null;
        const a = center(ra);
        const b = center(rb);
        const u = unitHeight();
        let p: { x: number; y: number };
        let dir: number;
        if (path === 'beam') {
          dir = Math.atan2(b.y - a.y, b.x - a.x);
          const o = orient(art.o, dir);
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const k = scaleOf();
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle: o.angle, sx: len / sheet.w, sy: k, origin: 'center', opacity: cue.opacity ?? 1 };
        }
        if (path === 'drop') {
          p = { x: b.x, y: b.y - u * 2.2 * (1 - t) };
          dir = Math.PI / 2;
        } else if (path === 'rise') {
          p = { x: b.x, y: b.y - u * 1.6 * t };
          dir = -Math.PI / 2;
        } else {
          const s = path === 'return' ? (t < 0.5 ? t * 2 : 2 - t * 2) : t;
          p = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
          dir = Math.atan2(b.y - a.y, b.x - a.x) + (path === 'return' && t >= 0.5 ? Math.PI : 0);
          if (path === 'arc') {
            const dist = Math.hypot(b.x - a.x, b.y - a.y);
            p.y -= Math.sin(Math.PI * s) * dist * 0.25;
            dir += (0.5 - s) * -1.2 * Math.sign(b.x - a.x || 1);
          }
        }
        const o = orient(art.o, dir);
        const k = scaleOf();
        return {
          x: p.x,
          y: p.y,
          angle: o.angle,
          sx: k * (o.flipX !== (cue.flip === 'x') ? -1 : 1),
          sy: k * (cue.flip === 'y' ? -1 : 1),
          origin: 'center',
          opacity: cue.opacity ?? 1,
        };
      },
    });
    return;
  }

  const at = cue.at ?? defAt;
  if (at === 'allySide' || at === 'enemySide' || at === 'field') {
    const ids = at === 'field' ? view.units.filter((u) => u.alive).map((u) => u.id) : unitsOfSide(view, side, at === 'allySide');
    spawn({ ...base, delay, place: placeAt(() => middleOf(ids), () => faceDir(undefined)) });
    return;
  }
  if (at === 'allies' || at === 'enemies') {
    unitsOfSide(view, side, at === 'allies').forEach((id, i) =>
      spawn({ ...base, delay: delay + (i * (cue.stagger ?? 60)) / speed, place: placeAt(() => (rectOf(id) ? center(rectOf(id)!) : null), () => faceDir(id)) }),
    );
    return;
  }
  const id = unitOf(at);
  if (!id) return;
  spawn({ ...base, delay, place: placeAt(() => (rectOf(id) ? center(rectOf(id)!) : null), () => faceDir(id)) });
}

// ---------------------------------------------------------------- binding events to cues

const skillGroup = (d: VfxData, skill: string | undefined) => (skill && d.skillMeta[skill]?.g) || 'base';
const plainStatus = (defId: string) => (defId.includes(':') ? defId.slice(defId.lastIndexOf(':') + 1) : defId);
const ownerSkill = (defId: string) => (defId.includes(':') ? defId.slice(0, defId.lastIndexOf(':')) : undefined);

function skillCues(d: VfxData, skill: string, on: string): Cue[] {
  return (d.skills[skill] ?? []).filter((c) => c.on === on);
}

function onlyOk(c: Cue, unit: string | undefined, primary: Set<string>): boolean {
  if (!c.only || !unit) return true;
  return c.only === 'primary' ? primary.has(unit) : !primary.has(unit);
}

function playDefault(d: VfxData, key: string, who: Who, defAt: string, source: string, scene: Scene) {
  for (const c of d.defaults[key] ?? []) play(c, who, defAt, { group: 'base', source }, scene);
}

function statusCues(d: VfxData, defId: string): ReturnType<() => VfxData['statuses'][string]> | undefined {
  return d.statuses[defId] ?? d.statuses[plainStatus(defId)];
}

function closeCtx(d: VfxData, scene: Scene) {
  if (ctx && !ctx.trigger) {
    const g = skillGroup(d, ctx.skill);
    for (const c of skillCues(d, ctx.skill, 'resolve')) play(c, { actor: ctx.actor, primary: [...ctx.targets] }, 'actor', { group: g, source: g }, scene);
  }
  ctx = null;
}

/** The effect behind something that happened outside any skill: a tick, a trap, a channel, a passive. */
function causeOf(view: PlayerView, source: string, target: string): EffectInstance | undefined {
  const fx = view.effects;
  return (
    fx.find((e) => e.source === source && e.bearer === target) ??
    fx.find((e) => e.bearer === source && (e.targets.includes(target) || e.source === source)) ??
    fx.find((e) => e.bearer === source)
  );
}

/** Opens a trigger context for an inline effect firing on its skill's behalf, playing its trigger cues once. */
function triggerFrom(d: VfxData, eff: EffectInstance, eventSource: string | undefined, scene: Scene): boolean {
  const skill = ownerSkill(eff.defId) ?? eff.sourceSkill;
  if (!skill || !d.skills[skill]) return false;
  const g = skillGroup(d, skill);
  const key = `${eff.id}:${scene.view.turn}`;
  if (!fired.has(key)) {
    fired.add(key);
    const inline = plainStatus(eff.defId);
    for (const c of skillCues(d, skill, 'trigger').filter((c) => !c.status || c.status === inline || c.status === eff.defId)) {
      play(c, { actor: eff.source, bearer: eff.bearer, source: eventSource, target: eff.targets[0], primary: eff.targets }, 'bearer', { group: g, source: g }, scene);
    }
  }
  ctx = { skill, actor: eff.source, targets: new Set(eff.targets), hit: new Set(), trigger: true };
  return true;
}

/** Called for each playback event, before the board shows it. */
export function vfxEvent(e: GameEvent, view: PlayerView, speed: number): void {
  const d = vfxData();
  if (!d || speed <= 0) return;
  const scene: Scene = { view, speed };
  const groupOfUnit = (id: string | undefined): string => {
    const u: Unit | undefined = view.units.find((x) => x.id === id);
    return u?.element ? u.element.toLowerCase() : 'base';
  };

  switch (e.t) {
    case 'turnStart':
    case 'turnEnd':
    case 'gameOver':
      closeCtx(d, scene);
      if (e.t === 'turnStart') fired.clear();
      return;

    case 'skillUsed': {
      closeCtx(d, scene);
      ctx = { skill: e.skill, actor: e.actor, targets: new Set(e.targets), hit: new Set() };
      const g = skillGroup(d, e.skill);
      const t = { group: g, source: g };
      for (const c of skillCues(d, e.skill, 'cast')) play(c, { actor: e.actor, primary: e.targets }, 'actor', t, scene);
      const travels = skillCues(d, e.skill, 'travel');
      e.targets.forEach((target, i) => {
        for (const c of travels) play({ ...c, delay: (c.delay ?? 0) + i * (c.stagger ?? 90) }, { actor: e.actor, target, primary: e.targets }, 'target', t, scene);
      });
      return;
    }

    case 'skillCountered': {
      // The countered skill never lands; the counter acts for the skill that set it.
      ctx = null;
      const eff = view.effects.find((x) => x.defId === e.effect && x.bearer === e.by);
      if (eff) triggerFrom(d, eff, e.actor, scene);
      else {
        const sc = statusCues(d, e.effect);
        for (const c of sc?.trigger ?? []) play(c, { bearer: e.by, source: e.actor, target: e.actor }, 'bearer', { group: d.statusGroup[e.effect] ?? 'base', source: groupOfUnit(e.by) }, scene);
      }
      playDefault(d, 'counter', { actor: e.actor, target: e.actor, bearer: e.by, source: e.by }, 'target', groupOfUnit(e.by), scene);
      return;
    }

    case 'skillFailed':
      playDefault(d, 'skillFailed', { actor: e.actor, target: e.actor }, 'actor', groupOfUnit(e.actor), scene);
      return;

    case 'damage':
    case 'heal':
    case 'damageBlocked': {
      const kind = e.t === 'heal' ? 'heal' : e.t === 'damageBlocked' || (e.t === 'damage' && e.amount === 0 && e.absorbed > 0) ? 'blocked' : 'hit';
      if (e.t === 'heal' && e.amount === 0) return;
      // Outside a skill (or from someone other than its user): trace it to the effect that caused it.
      if (!ctx || (!ctx.trigger && e.source !== ctx.actor)) {
        if (ctx && !ctx.trigger) closeCtx(d, scene);
        const eff = causeOf(view, e.source, e.target);
        if (eff && ownerSkill(eff.defId) && triggerFrom(d, eff, e.source, scene)) {
          // falls through to the skill's own cues below
        } else if (eff) {
          const sc = statusCues(d, eff.defId);
          const list = sc?.tick ?? sc?.trigger;
          if (list?.length) {
            for (const c of list) play(c, { bearer: eff.bearer, source: eff.source, target: e.target, actor: eff.source }, 'bearer', { group: d.statusGroup[plainStatus(eff.defId)] ?? 'base', source: groupOfUnit(eff.source) }, scene);
            return;
          }
          playDefault(d, kind === 'heal' ? 'heal' : kind, { target: e.target, source: e.source }, 'target', groupOfUnit(e.source), scene);
          return;
        } else {
          playDefault(d, kind === 'heal' ? 'heal' : kind, { target: e.target, source: e.source }, 'target', groupOfUnit(e.source), scene);
          return;
        }
      }
      const c0 = ctx!;
      const g = skillGroup(d, c0.skill);
      const who: Who = { actor: c0.actor, target: e.target, primary: [...c0.targets] };
      // Damage past the skill's own reach, or a second hit on a unit, comes from a macro it called (an Explosion…).
      const meta = d.skillMeta[c0.skill];
      if (kind === 'hit' && meta?.m && (c0.hit.has(e.target) || (!meta.sp && !c0.targets.has(e.target)))) {
        const m = meta.m.find((id) => d.macros[id]?.length);
        if (m) {
          for (const c of d.macros[m]!) play(c, who, 'target', { group: d.macroGroup[m] ?? g, source: g }, scene);
          return;
        }
      }
      if (kind === 'hit') c0.hit.add(e.target);
      const cues = skillCues(d, c0.skill, kind).filter((c) => onlyOk(c, e.target, c0.targets));
      if (cues.length) for (const c of cues) play(c, who, 'target', { group: g, source: g }, scene);
      else playDefault(d, kind === 'heal' ? 'heal' : kind, who, 'target', g, scene);
      return;
    }

    case 'effectApplied': {
      const plain = plainStatus(e.defId);
      const sc = statusCues(d, e.defId);
      const statusTint = { group: d.statusGroup[plain] ?? (ownerSkill(e.defId) ? skillGroup(d, ownerSkill(e.defId)) : 'base'), source: ctx ? skillGroup(d, ctx.skill) : groupOfUnit(e.source) };
      const who: Who = { actor: e.source, bearer: e.bearer, target: e.bearer, source: e.source, primary: ctx ? [...ctx.targets] : [] };
      let replaced = false;
      if (ctx && (ctx.trigger || e.source === ctx.actor)) {
        const g = skillGroup(d, ctx.skill);
        const kind = (d.statusKind[e.defId] ?? d.statusKind[plain] ?? '').toLowerCase();
        for (const c of skillCues(d, ctx.skill, 'apply')) {
          if (!onlyOk(c, e.bearer, ctx.targets)) continue;
          const exact = c.status === e.defId || c.status === plain;
          if (exact) replaced = true;
          if (exact || !c.status || c.status === 'any' || c.status === kind) play(c, { ...who, actor: ctx.actor }, 'bearer', { group: g, source: g }, scene);
        }
      }
      if (!replaced) for (const c of sc?.apply ?? []) play(c, who, 'bearer', statusTint, scene);
      // An aura loops, a little faded, until the status ends.
      const aura = sc?.aura?.[0];
      const tag = auraTag(e.bearer, e.defId);
      if (aura && !hasTag(tag)) play({ ...aura, delay: 0, opacity: Math.min(aura.opacity ?? 0.75, 0.75) }, who, 'bearer', statusTint, scene, tag);
      return;
    }

    case 'effectRemoved': {
      stopTag(auraTag(e.bearer, e.defId));
      if (e.reason === 'died') return;
      const plain = plainStatus(e.defId);
      const sc = statusCues(d, e.defId);
      const who: Who = { bearer: e.bearer, target: e.bearer, actor: ctx?.actor };
      const statusTint = { group: d.statusGroup[plain] ?? 'base', source: ctx ? skillGroup(d, ctx.skill) : groupOfUnit(e.bearer) };
      if (e.reason === 'interrupted') return playDefault(d, 'interrupted', who, 'bearer', statusTint.source, scene);
      if (e.reason === 'expired') {
        for (const c of sc?.expire ?? []) play(c, who, 'bearer', statusTint, scene);
        return;
      }
      if (e.reason === 'depleted') playDefault(d, 'shieldBreak', who, 'bearer', statusTint.source, scene);
      let replaced = false;
      if (ctx) {
        const g = skillGroup(d, ctx.skill);
        const kind = (d.statusKind[e.defId] ?? d.statusKind[plain] ?? '').toLowerCase();
        for (const c of skillCues(d, ctx.skill, 'remove')) {
          if (!onlyOk(c, e.bearer, ctx.targets)) continue;
          const exact = c.status === e.defId || c.status === plain;
          if (exact) replaced = true;
          if (exact || !c.status || c.status === 'any' || c.status === kind) play(c, who, 'bearer', { group: g, source: g }, scene);
        }
      }
      if (!replaced) for (const c of sc?.remove ?? []) play(c, who, 'bearer', statusTint, scene);
      return;
    }

    case 'effectBlocked':
      playDefault(d, 'effectBlocked', { bearer: e.bearer, target: e.bearer }, 'bearer', ctx ? skillGroup(d, ctx.skill) : 'base', scene);
      return;

    case 'summoned': {
      const cues = ctx ? skillCues(d, ctx.skill, 'summon') : [];
      if (ctx && cues.length) {
        const g = skillGroup(d, ctx.skill);
        for (const c of cues) play(c, { actor: ctx.actor, minion: e.unit, target: e.unit }, 'minion', { group: g, source: g }, scene);
      } else playDefault(d, 'summon', { minion: e.unit, target: e.unit, actor: e.by }, 'minion', groupOfUnit(e.by), scene);
      return;
    }

    case 'died':
    case 'revived': {
      if (e.t === 'died') stopTag(`aura:${e.unit}:`);
      const kind = e.t === 'died' ? 'death' : 'revive';
      const cues = ctx ? skillCues(d, ctx.skill, kind) : [];
      if (ctx && cues.length) {
        const g = skillGroup(d, ctx.skill);
        for (const c of cues) play(c, { actor: ctx.actor, target: e.unit }, 'target', { group: g, source: g }, scene);
      } else playDefault(d, kind, { target: e.unit }, 'target', ctx ? skillGroup(d, ctx.skill) : 'base', scene);
      return;
    }

    default:
      return;
  }
}

const auraTag = (bearer: string, defId: string) => `aura:${bearer}:${defId}|`;

/** After playback: drop auras whose status is no longer on the board (ended out of sight, a new match…). */
export function vfxReconcile(view: PlayerView): void {
  const present = new Set(view.effects.map((e) => auraTag(e.bearer, e.defId)));
  for (const tag of liveTags()) if (tag.startsWith('aura:') && !present.has(tag)) stopTag(tag);
}

/** Playback finished, or the battle closed: forget the open skill. */
export function vfxReset(clear = false): void {
  ctx = null;
  if (clear) {
    fired.clear();
    clearAll();
  }
}
