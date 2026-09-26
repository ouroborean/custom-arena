import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { COLORS, type ContentBundle, type Cost, type PlayerView, type QueuedAction, type SkillDef, type Unit } from '@arena/engine';
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

export function CostPips({ cost, large }: { cost: Cost; large?: boolean }) {
  const pips: { c: string; key: string }[] = [];
  for (const c of COLORS) for (let i = 0; i < cost[c]; i++) pips.push({ c, key: `${c}${i}` });
  for (let i = 0; i < cost.r; i++) pips.push({ c: 'r', key: `r${i}` });
  return (
    <span className="cost" aria-label={`Cost ${pips.map((p) => p.c).join('') || 'free'}`}>
      {pips.length === 0 && <span className="pip free">0</span>}
      {pips.map((p) => (
        <span key={p.key} className={`pip ${p.c}${large ? ' lg' : ''}`} />
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

export type SkillCategory = 'attack' | 'control' | 'support';

export function skillCategory(def: SkillDef): SkillCategory {
  if (def.tags.includes('Helpful')) return 'support';
  return def.tags.includes('Strategic') ? 'control' : 'attack';
}

export const CATEGORY_LABEL: Record<SkillCategory, string> = { attack: 'Attack', control: 'Control', support: 'Support' };

/** Flat two-tone diagonal split in the class color. */
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
