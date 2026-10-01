// Shared roster pieces: rarity badge, character card, and effective (equipment-resolved) skills.

import { resolveLoadout, RARITIES, skillDefId, type CharacterRecord, type CharacterSkill } from '@arena/meta';
import type { Character } from '../api.js';
import { content } from '../content.js';
import { portraitKey } from '../assets.js';
import { classCode, CostPips, elementClass, PortraitArt, portraitStyle, SkillGlyph, Tooltip } from './common.js';

export const recordOf = (c: Character): CharacterRecord => ({
  name: c.name,
  classId: c.classId,
  element: c.element,
  rarity: c.rarity,
  portraitId: c.portraitId,
  skills: c.skills,
});

/** The character's skills with its saved loadout applied (falls back to native skills). */
export function effectiveSkills(c: Character): CharacterSkill[] {
  const r = resolveLoadout(content, recordOf(c), c.loadout);
  return r.problems.length ? c.skills : r.skills;
}

export function RarityBadge({ rarity }: { rarity: Character['rarity'] }) {
  return <span className={`rarity rarity-${rarity}`}>{RARITIES[rarity].name}</span>;
}

export function SkillChips({ skills }: { skills: CharacterSkill[] }) {
  return (
    <div className="skill-list">
      {skills.map((s) => {
        const d = content.skills[skillDefId(s)]!;
        return (
          <Tooltip
            key={s.base}
            content={
              <>
                <h4>{d.name}</h4>
                <div>{d.description}</div>
                <div className="row">
                  <CostPips cost={d.cost} /> · cooldown {d.cooldown}
                  {s.locked && ' · default infusion'}
                  {s.source === 'equipment' && ' · from equipment'}
                </div>
              </>
            }
          >
            <span className={`skill-chip ${elementClass(d.element)} ${s.source === 'equipment' ? 'from-equipment' : ''}`} tabIndex={0}>
              <SkillGlyph def={d} content={content} />
              {d.name}
              <CostPips cost={d.cost} />
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function Portrait({ c, size = 56 }: { c: Pick<Character, 'classId' | 'element'> & { portraitId?: string }; size?: number }) {
  return (
    <div className={`portrait ${elementClass(c.element)}`} style={{ ...portraitStyle(c.classId), width: size, height: size }} aria-hidden>
      <PortraitArt artKey={portraitKey(c)} {...(c.portraitId ? { portraitId: c.portraitId } : {})} />
      <span className="mono">{classCode(c.classId)}</span>
    </div>
  );
}

export function CharacterCard({
  c,
  onOpen,
  selected,
  order,
}: {
  c: Character;
  onOpen: () => void;
  selected?: boolean;
  order?: number;
}) {
  const cls = content.classes[c.classId];
  return (
    <button
      type="button"
      className={`char-card ${selected ? 'selected' : ''}`}
      onClick={onOpen}
      aria-pressed={selected}
      aria-label={`${c.name}, ${RARITIES[c.rarity].name} ${c.element} ${cls?.name ?? c.classId}`}
    >
      <Portrait c={c} />
      <div className="char-card-body">
        <div className="char-card-top">
          <span className="char-name">{c.name}</span>
          {order !== undefined && <span className="team-order">{order}</span>}
        </div>
        <div className="char-meta">
          <RarityBadge rarity={c.rarity} />
          <span>
            {c.element} {cls?.name}
          </span>
        </div>
        <SkillChips skills={effectiveSkills(c)} />
      </div>
    </button>
  );
}
