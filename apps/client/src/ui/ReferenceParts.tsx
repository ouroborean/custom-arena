// Small pieces of the in-game reference (ui/Reference.tsx): element and fusion chips, cost and
// cooldown, keyword and status definitions, skill lists and comparison cards, filters.

import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import type { EffectKind, SkillDef } from '@arena/engine';
import { content, coreStatusIds } from '../content.js';
import { useT } from '../i18n/index.js';
import { buildReference, type Element, type RefEntry, type RefKeyword, type RefKit, type RefPassive, type ReferenceData } from '../reference/data.js';
import { ELEMENTS } from '../reference/prose.js';
import { refHash, type RefRoute } from '../reference/route.js';
import { CostPips, elementClass, SkillGlyph } from './common.js';
import { RulesText, type KeywordLink } from './RulesText.js';

let cached: ReferenceData | null = null;
/** The reference, built once from the content bundle. */
export function referenceData(): ReferenceData {
  cached ??= buildReference(content, coreStatusIds);
  return cached;
}

export const href = (r: RefRoute) => refHash(r);

/** Keywords in rules text link to their definitions: a status or term, or the fusion that has the keyword. */
const keywordLink: KeywordLink = (g) => {
  const def = referenceData().defOf(g);
  if (!def) return undefined;
  const title = `${g.name}: ${g.text}`;
  return 'entry' in def ? { href: href({ page: 'statuses', entry: def.entry.slug }), title } : { href: href({ page: 'kit', kit: def.kit.id }), title };
};

/** Rules text with its keywords linked to their definitions. */
export function Rules({ text }: { text: string | undefined }) {
  return <RulesText text={text} link={keywordLink} />;
}

/** Prose with **bold** runs. */
export function Md({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** Text with the first occurrence of the query highlighted. */
export function Mark({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function ElChip({ el, link = true }: { el: string; link?: boolean }) {
  const className = `ref-el ${elementClass(el)}`;
  return link ? (
    <a className={className} href={href({ page: 'element', element: el.toLowerCase() })}>
      {el}
    </a>
  ) : (
    <span className={className}>{el}</span>
  );
}

export function BaseChip() {
  const t = useT();
  return <span className="ref-el ref-el-base">{t('ref.base')}</span>;
}

/** A fusion's two parent colors. */
export function Swatch({ parents }: { parents: readonly [string, string] }) {
  return (
    <span className="ref-sw" aria-hidden>
      <i className={elementClass(parents[0])} />
      <i className={elementClass(parents[1])} />
    </span>
  );
}

/** A fusion's name with its parents' colors, as a link (or plain, with `link` false). */
export function KitChip({ kit, skill, link = true }: { kit: RefKit; skill?: string; link?: boolean }) {
  const body = (
    <>
      <Swatch parents={kit.parents} />
      <span>{kit.name}</span>
    </>
  );
  return link ? (
    <a className="ref-fu" href={href({ page: 'kit', kit: kit.id, ...(skill ? { skill } : {}) })}>
      {body}
    </a>
  ) : (
    <span className="ref-fu">{body}</span>
  );
}

export function Parents({ kit }: { kit: RefKit }) {
  return (
    <span className="ref-parents">
      <ElChip el={kit.parents[0]} />
      <span className="ref-plus">+</span>
      <ElChip el={kit.parents[1]} />
    </span>
  );
}

export function KindBadge({ kind }: { kind?: EffectKind | undefined }) {
  const t = useT();
  if (!kind) return null;
  return <span className={`ref-kind ref-kind-${kind.toLowerCase()}`}>{t(`ref.kind.${kind.toLowerCase() as 'buff' | 'debuff' | 'neutral'}`)}</span>;
}

export function Tag({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <span className={`ref-kind${accent ? ' ref-kind-passive' : ''}`}>{children}</span>;
}

/** Cost pips and cooldown. */
export function CostCd({ skill }: { skill: SkillDef }) {
  const t = useT();
  return (
    <span className="ref-costcd">
      <CostPips cost={skill.cost} />
      <span className="ref-cd" title={t('ref.cooldown')}>
        {t('ref.cd', { n: skill.cooldown })}
      </span>
    </span>
  );
}

/** A status or rules term: name, kind, rule. */
export function EntryDef({ entry, anchored, target }: { entry: RefEntry; anchored?: boolean; target?: boolean }) {
  return (
    <div className={`ref-def${target ? ' target' : ''}`} {...(anchored ? { id: `ref-st-${entry.slug}` } : {})}>
      <div className="ref-def-head">
        <strong>{entry.name}</strong>
        <KindBadge kind={entry.kind} />
      </div>
      <p>
        <Rules text={entry.text} />
      </p>
    </div>
  );
}

/** A fusion keyword (or passive): name, kind, rule. */
export function KeywordDef({ keyword }: { keyword: RefKeyword }) {
  const t = useT();
  return (
    <div className="ref-def">
      <div className="ref-def-head">
        <strong>{keyword.name}</strong>
        <KindBadge kind={keyword.kind} />
        {keyword.passive && (
          <span title={t('ref.passiveHint')}>
            <Tag accent>{t('ref.passive')}</Tag>
          </span>
        )}
      </div>
      <p>
        <Rules text={keyword.text} />
      </p>
    </div>
  );
}

export function PassiveDef({ passive }: { passive: RefPassive }) {
  const t = useT();
  return (
    <div className="ref-def">
      <div className="ref-def-head">
        <strong>{passive.name}</strong>
        <Tag accent>{t('ref.passive')}</Tag>
      </div>
      <p>
        <Rules text={passive.text} />
      </p>
    </div>
  );
}

/** Toggle chips, at most one on: calls back with its value or null. */
export function Chips<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: V; label: ReactNode; title?: string }[];
  value: V | null;
  onChange: (v: V | null) => void;
  label: string;
}) {
  return (
    <div className="ref-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="ref-chip"
          aria-pressed={value === o.value}
          title={o.title}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Chips for the ten elements. */
export function ElementChips({ value, onChange }: { value: Element | null; onChange: (v: Element | null) => void }) {
  const t = useT();
  return (
    <Chips
      label={t('ref.filterByElement')}
      value={value}
      onChange={onChange}
      options={ELEMENTS.map((el) => ({
        value: el,
        label: (
          <>
            <span className={`ref-dot ${elementClass(el)}`} />
            {el}
          </>
        ),
      }))}
    />
  );
}

export function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input className="ref-filter" type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export interface SkillRow {
  /** The base skill id (what the row selects). */
  base: string;
  skill: SkillDef;
  /** The lead column: the base skill's name, an element, a fusion, classes… */
  label: ReactNode;
  hidden?: boolean;
}

/**
 * Skills as rows: lead label, icon and name, cost and cooldown, effect. Picking one (its name, or
 * anywhere on the row that isn't a link) calls `onPick`; `selected` is highlighted, and scrolled to
 * when the list first shows (a deep link).
 */
export function SkillRows({ rows, selected, onPick, head }: { rows: SkillRow[]; selected?: string | undefined; onPick?: (base: string) => void; head: string }) {
  const t = useT();
  const first = useRef(selected);
  useEffect(() => {
    if (first.current) document.getElementById(`ref-row-${first.current}`)?.scrollIntoView({ block: 'center' });
  }, []);
  const shown = rows.filter((r) => !r.hidden);
  return (
    <div className="ref-skills" role="list">
      <div className="ref-skills-head" aria-hidden>
        <span>{head}</span>
        <span>{t('ref.col.skill')}</span>
        <span>{t('ref.col.costCd')}</span>
        <span>{t('ref.col.effect')}</span>
      </div>
      {shown.map((r) => (
        <div
          key={r.skill.id}
          role="listitem"
          id={onPick ? `ref-row-${r.base}` : undefined}
          className={`ref-skill${onPick ? ' pickable' : ''}${selected === r.base ? ' sel' : ''}`}
          onClick={
            onPick
              ? (e) => {
                  if ((e.target as HTMLElement).closest('a, button')) return;
                  onPick(r.base);
                }
              : undefined
          }
        >
          <span className="ref-skill-label">{r.label}</span>
          <span className="ref-skill-name">
            <SkillGlyph def={r.skill} content={content} />
            {onPick ? (
              <button type="button" aria-pressed={selected === r.base} onClick={() => onPick(r.base)}>
                {r.skill.name}
              </button>
            ) : (
              <strong>{r.skill.name}</strong>
            )}
          </span>
          <CostCd skill={r.skill} />
          <p className="ref-skill-text">
            <Rules text={r.skill.description} />
          </p>
        </div>
      ))}
      {shown.length === 0 && <p className="muted ref-empty">{t('ref.noMatch')}</p>}
    </div>
  );
}

/** A skill as a comparison card: a label (element or fusion), its name linked, cost and effect. */
export function RefCard({ label, skill, to }: { label: ReactNode; skill: SkillDef; to?: RefRoute }) {
  return (
    <div className="ref-card">
      <div className="ref-card-head">
        {label}
        <SkillGlyph def={skill} content={content} />
        {to ? (
          <a className="ref-card-name" href={href(to)}>
            {skill.name}
          </a>
        ) : (
          <strong className="ref-card-name">{skill.name}</strong>
        )}
        <CostCd skill={skill} />
      </div>
      <p>
        <Rules text={skill.description} />
      </p>
    </div>
  );
}

/** The statuses and terms a text uses, as definitions (not counting fusion keywords, listed apart). */
export function UsedTerms({ data, text }: { data: ReferenceData; text: string }) {
  const t = useT();
  const entries = data
    .usesOf(text)
    .map((id) => content.glossary[id])
    .map((g) => (g ? data.defOf(g) : null))
    .flatMap((d) => (d && 'entry' in d ? [d.entry] : []));
  if (!entries.length) return null;
  return (
    <>
      <h3 className="ref-h3">{t('ref.usedTerms', { count: entries.length })}</h3>
      <div className="ref-defs">
        {entries.map((e) => (
          <EntryDef key={e.slug} entry={e} />
        ))}
      </div>
    </>
  );
}
