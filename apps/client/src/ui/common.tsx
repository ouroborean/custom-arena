import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { COLORS, type ContentBundle, type Cost, type PieceDef, type PlayerView, type QueuedAction, type SkillDef, type Unit } from '@arena/engine';
import { portraitUrl, skillIconUrl, useAssets } from '../assets.js';
import { useStore, type InspectTarget } from '../store.js';

export function Tooltip({ content, children, block }: { content: ReactNode; children: ReactNode; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="tip-wrap"
      style={block ? { display: 'flex' } : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span role="tooltip" id={id} className="tip">
          {content}
        </span>
      )}
    </span>
  );
}

export type PipColor = 'S' | 'A' | 'I' | 'W' | 'r';

export const ENERGY_NAMES: Record<PipColor, string> = { S: 'Strength', A: 'Agility', I: 'Intelligence', W: 'Wisdom', r: 'Random' };

/**
 * Pip outlines on a 0–12 grid. Every color has its own shape so energy never depends on telling
 * red from green (GDD Phase 8 "color-blind energy pip shapes"): Strength ■, Agility ▲,
 * Intelligence ◆, Wisdom ⬢, and random as a hollow square.
 */
const PIP_SHAPES: Record<PipColor, string> = {
  S: '1,1 11,1 11,11 1,11',
  A: '6,0.8 11.4,11 0.6,11',
  I: '6,0.4 11.6,6 6,11.6 0.4,6',
  W: '3.3,1 8.7,1 11.5,6 8.7,11 3.3,11 0.5,6',
  r: '1.5,1.5 10.5,1.5 10.5,10.5 1.5,10.5',
};

/** One energy pip: a shape in the color's fill with a hard outline. */
export function EnergyPip({ color, size = 11, title }: { color: PipColor; size?: number; title?: string }) {
  return (
    <svg className={`pip-svg ${color}`} width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={title ?? ENERGY_NAMES[color]}>
      <polygon points={PIP_SHAPES[color]} />
    </svg>
  );
}

export function CostPips({ cost, large }: { cost: Cost; large?: boolean }) {
  const pips: { c: PipColor; key: string }[] = [];
  for (const c of COLORS) for (let i = 0; i < cost[c]; i++) pips.push({ c, key: `${c}${i}` });
  for (let i = 0; i < cost.r; i++) pips.push({ c: 'r', key: `r${i}` });
  const label = pips.length ? pips.map((p) => ENERGY_NAMES[p.c]).join(', ') : 'free';
  return (
    <span className="cost" role="img" aria-label={`Cost: ${label}`}>
      {pips.length === 0 && <span className="pip free">0</span>}
      {pips.map((p) => (
        <EnergyPip key={p.key} color={p.c} size={large ? 20 : 11} />
      ))}
    </span>
  );
}

/** Hover/focus handlers that pop up the details card for `target`, anchored to the element. */
export function useHover(target: InspectTarget) {
  const setInspect = useStore((s) => s.setInspect);
  const show = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setInspect(target, { left: r.left, top: r.top, width: r.width, height: r.height });
  };
  const hide = () => setInspect(null);
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

// ---------------------------------------------------------------- identity: codes, colors, portraits

const CLASS_HUES: Record<string, number> = {
  warrior: 2,
  knight: 214,
  druid: 132,
  ranger: 78,
  monk: 28,
  mage: 238,
  warlock: 282,
  rogue: 332,
  priest: 48,
  paladin: 188,
};

const CLASS_CODES: Record<string, string> = {
  warrior: 'WAR',
  knight: 'KNT',
  druid: 'DRU',
  ranger: 'RNG',
  monk: 'MNK',
  mage: 'MAG',
  warlock: 'WLK',
  rogue: 'ROG',
  priest: 'PRI',
  paladin: 'PAL',
};

const SKILL_CODES: Record<string, string> = {
  Strike: 'STR',
  Smash: 'SMH',
  Charge: 'CHG',
  Riposte: 'RIP',
  Rage: 'RGE',
  Shot: 'SHT',
  Snipe: 'SNP',
  Trap: 'TRP',
  Maneuver: 'MNV',
  Companion: 'CMP',
  Bolt: 'BLT',
  Blast: 'BST',
  Consume: 'CSM',
  Summon: 'SMN',
  Channel: 'CHN',
  Stab: 'STB',
  Ravage: 'RVG',
  Mislead: 'MSL',
  Stun: 'STN',
  Dance: 'DNC',
  Heal: 'HEL',
  Bless: 'BLS',
  Curse: 'CRS',
  Smite: 'SMT',
  Prayer: 'PRY',
  Cleave: 'CLV',
  Shout: 'SHO',
  Withstand: 'WST',
  Taunt: 'TNT',
  Titan: 'TTN',
};

const STATUS_CODES: Record<string, string> = {
  might: 'MGT',
  weakness: 'WKN',
  vulnerable: 'VUL',
  armor: 'ARM',
  shield: 'SHD',
  stun: 'STN',
  invulnerable: 'INV',
  untargetable: 'UNT',
  isolated: 'ISO',
  shattered: 'SHT',
  swiftness: 'SWF',
  intimidated: 'INT',
  focus: 'FOC',
  confusion: 'CNF',
  mark: 'MRK',
  taunt: 'TAU',
  immune: 'IMM',
  trap: 'TRP',
  sanctify: 'SNC',
  renew: 'RNW',
  riposte: 'RIP',
  mislead: 'MSL',
  snipe: 'AIM',
  channel: 'CHN',
  lifetime: 'SUM',
  wolf_bite: 'ATK',
  arcane_bolt: 'ATK',
  stun_ns: 'STN',
  // Fire
  ignite: 'IGN',
  scorched: 'SCR',
  flameborn: 'FLB',
  blisterblade: 'RIP',
  heat_seeker: 'AIM',
  hidden_explosives: 'EXP',
  heat_haze: 'HAZ',
  flamethrower: 'CHN',
  ring_of_fire: 'ROF',
  dragon_breath: 'ATK',
  cinder_burst: 'ATK',
  // Poison
  toxin: 'TOX',
  prey: 'PRY',
  shed_skin: 'SKN',
  banewood_javelin: 'AIM',
  snake_pit: 'PIT',
  nine_plagues: 'CHN',
  numbing_needle: 'NDL',
  preymark: 'PMK',
  ghosted: 'GHO',
  // Holy
  anointed: 'ANT',
  condemned: 'CDM',
  zealous_rush: 'ZEL',
  retribution: 'RTB',
  spear_of_light: 'AIM',
  holy_nova: 'NOV',
  consecration: 'CHN',
  martyrdom: 'MTR',
  saving_grace: 'SVG',
  // Ice
  frostbitten: 'FRB',
  chilled: 'CHL',
  numb: 'NMB',
  frostborn: 'FRO',
  frost_spines: 'RIP',
  comet_shard: 'AIM',
  frost_snare: 'SNR',
  blizzard: 'CHN',
  // Water
  flow: 'FLW',
  surge: 'SRG',
  riverbend: 'RIP',
  tidal_arrow: 'AIM',
  whirlpool: 'WHP',
  dunk: 'DNK',
  call_rain: 'CHN',
  aqua_ring: 'RNG',
  tidal_pull_reset: 'TPL',
  // Unholy
  horrified: 'HOR',
  immortal: 'IMM',
  soul_fragment: 'SOL',
  lifesteal: 'LST',
  wraithwalk: 'WRW',
  spiteful_retort: 'RIP',
  soul_lance: 'AIM',
  soul_shackle: 'SHK',
  grave_step: 'IMM',
  drain_life: 'CHN',
  drained: 'DRN',
  mirage_of_nightmares: 'MIR',
  soul_sickness: 'SIK',
  jaws_of_hell: 'CHN',
  // Lightning
  charged: 'CHG',
  sapped: 'SAP',
  stormborn: 'STB',
  conduit: 'CND',
  feedback_loop: 'RIP',
  particle_beam: 'AIM',
  tesla_coil: 'TSL',
  lightningrod: 'CHN',
  hologram: 'HLO',
  polarity: 'POL',
  lightning_cage: 'CGE',
  aggro_signal: 'AGR',
  // Wind
  stun_s: 'STN',
  rushing: 'RSH',
  leaping: 'LEA',
  elegant_sweep: 'AIM',
  float_noose: 'NSE',
  vortex: 'CHN',
  wind_step: 'WST',
  feathermark: 'FTH',
  // Shadow (+ base Sleep)
  sleep: 'SLP',
  stealth: 'STH',
  blinded: 'BLD',
  long_shadow: 'LSH',
  mirage_blade: 'RIP',
  dream_seeker: 'AIM',
  dream_chains: 'DRM',
  nightsong: 'CHN',
  illusory_lure: 'LUR',
  // Earth
  shale_guard: 'RIP',
  tunnelmaker: 'AIM',
  boulder_trap: 'BTR',
  worldcaller: 'CHN',
  pitfall: 'PFL',
  landslide: 'LND',
  earth_pillar: 'PIL',
  ancient_grudge: 'GRD',
};

function consonantCode(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  const cons = letters[0] + letters.slice(1).replace(/[AEIOU]/g, '');
  return (cons.length >= 3 ? cons : letters).slice(0, 3);
}

export function hueFor(id: string): number {
  if (id in CLASS_HUES) return CLASS_HUES[id]!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function classCode(classId: string): string {
  return CLASS_CODES[classId] ?? '?';
}

export function unitCode(u: Unit): string {
  return CLASS_CODES[u.defId] ?? consonantCode(u.name);
}

export function skillCode(def: SkillDef): string {
  return SKILL_CODES[def.archetype] ?? consonantCode(def.name);
}

export function statusCode(key: string, name: string): string {
  return STATUS_CODES[key] ?? consonantCode(name);
}

/** CSS class for an element accent ("" for no element). */
export function elementClass(element: string | undefined): string {
  return element && element !== 'None' ? `has-el el-${element.toLowerCase()}` : '';
}

const BASE_ELEMENTS = new Set(['fire', 'poison', 'holy', 'ice', 'water', 'unholy', 'lightning', 'wind', 'shadow', 'earth']);

/**
 * How a skill or status glyph is painted: neutral grey with no element, the element's glyph color
 * (theme.css --glyph-*), or for a fusion a diagonal gradient from one of its elements to the other. A
 * doubled element (Fire + Fire) fades into a deeper shade of itself so it still reads as a fusion.
 */
export function glyphPaint(element: string | undefined, content: ContentBundle): string {
  if (!element || element === 'None') return 'var(--glyph-neutral)';
  const key = element.toLowerCase();
  if (BASE_ELEMENTS.has(key)) return `var(--glyph-${key})`;
  const fusion = content.fusions[key] ?? Object.values(content.fusions).find((f) => f.name === element);
  if (!fusion) return 'var(--glyph-neutral)';
  const [a, b] = fusion.elements.map((e) => `var(--glyph-${e.toLowerCase()})`) as [string, string];
  return `linear-gradient(135deg, ${a} 20%, ${a === b ? `color-mix(in srgb, ${b} 55%, #000)` : b} 80%)`;
}

/** A white-on-transparent icon file used as a mask, so it takes any paint: a color or a gradient. */
export function Glyph({ url, paint }: { url: string; paint: string }) {
  const mask = `url("${url}")`;
  return <span className="glyph" aria-hidden style={{ background: paint, maskImage: mask, WebkitMaskImage: mask }} />;
}

/** A skill's icon at text size, for skill chips outside battle; nothing when the skill has none. */
export function SkillGlyph({ def, content }: { def: SkillDef; content: ContentBundle }) {
  const url = skillIconUrl(useAssets((s) => s.icons), def);
  return url ? (
    <span className="chip-glyph">
      <Glyph url={url} paint={glyphPaint(def.element, content)} />
    </span>
  ) : null;
}

/**
 * A piece of equipment at a glance: a colored corner for each infusion it adds (top-right, then
 * bottom-right), and in the middle an icon for each skill it grants plus "!" if it has a passive. With
 * more to show, the tokens shrink. Decorative: the tile around it carries the accessible name and the
 * hover card.
 */
export function ItemFace({ def, content, className = '' }: { def: Pick<PieceDef, 'skills' | 'infusions' | 'passive'>; content: ContentBundle; className?: string }) {
  const icons = useAssets((s) => s.icons);
  const tokens = def.skills.length + (def.passive ? 1 : 0);
  // Infusions only: a diamond each (three for a Geode, sized like three tokens).
  const size = tokens || (def.infusions.length > 2 ? 3 : 0);
  return (
    <span className={`item-face ${className}`} data-tokens={size} aria-hidden>
      {def.infusions.slice(0, 2).map((inf, i) => (
        <span key={i} className={`item-corner item-corner-${i} ${elementClass(inf.element)}`} />
      ))}
      <span className="item-tokens">
        {def.skills.map((id) => {
          const skill = content.skills[id];
          const url = skill ? skillIconUrl(icons, skill) : null;
          return (
            <span key={id} className="item-token">
              {url ? <Glyph url={url} paint={glyphPaint(skill?.element, content)} /> : <span className="item-token-code">{skill ? skillCode(skill) : '?'}</span>}
            </span>
          );
        })}
        {def.passive && <span className="item-token item-passive">!</span>}
        {/* Infusions only (Shards, Crystals, Geodes): a diamond per infusion, so the middle isn't blank. */}
        {tokens === 0 &&
          def.infusions.map((inf, i) => (
            <span key={i} className={`item-token item-infusion ${elementClass(inf.element)}`}>
              <span />
            </span>
          ))}
      </span>
    </span>
  );
}

export type SkillCategory = 'attack' | 'control' | 'support';

export function skillCategory(def: SkillDef): SkillCategory {
  if (def.tags.includes('Helpful')) return 'support';
  return def.tags.includes('Strategic') ? 'control' : 'attack';
}

export const CATEGORY_LABEL: Record<SkillCategory, string> = { attack: 'Attack', control: 'Control', support: 'Support' };

/** Flat two-tone diagonal split in the class color. */
/** Portrait art from the manifest (drawn under the name tag), or nothing to keep the generated look. */
export function PortraitArt({ artKey, portraitId }: { artKey: string; portraitId?: string }) {
  const portraits = useAssets((s) => s.portraits);
  const [broken, setBroken] = useState(false);
  const url = portraitUrl(portraits, artKey, portraitId);
  if (!url || broken) return null;
  return <img className="portrait-art" src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

export function portraitStyle(classOrDefId: string): CSSProperties {
  const h = hueFor(classOrDefId);
  return {
    background: `linear-gradient(135deg, hsl(${h} 78% 40%) 0 52%, hsl(${h} 80% 27%) 52% 100%)`,
  };
}

export function durationText(d: number | null): string {
  if (d === null) return 'Permanent';
  return d === 1 ? 'Ends at the end of this turn' : `Ends after ${d} more turn ends (both players’ turns count)`;
}

export function describeAction(q: QueuedAction, view: PlayerView, content: ContentBundle): { skill: string; line: string } {
  const actor = view.units.find((u) => u.id === q.actor);
  const def = actor ? content.skills[actor.skills[q.slot]!.defId] : undefined;
  const target = q.targets[0] ? view.units.find((u) => u.id === q.targets[0])?.name : undefined;
  return { skill: def?.name ?? '?', line: `${actor?.name ?? q.actor}${target ? ` → ${target}` : ''}` };
}
