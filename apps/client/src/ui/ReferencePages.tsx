// The in-game reference's pages and skill details (ui/Reference.tsx has the frame, navigation and
// search box). Every page reads the reference built from the content bundle (reference/data.ts) and
// the reference's own words (reference/prose.ts).

import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/index.js';
import { classesOf, searchReference, type Element, type RefElement, type RefKit, type ReferenceData } from '../reference/data.js';
import { ELEMENTS, ELEMENTS_LEAD, FUSIONS, HOME, type ProseSection } from '../reference/prose.js';
import type { RefRoute } from '../reference/route.js';
import { elementClass } from './common.js';
import {
  BaseChip,
  Chips,
  CostCd,
  ElChip,
  ElementChips,
  EntryDef,
  FilterInput,
  href,
  KeywordDef,
  KindBadge,
  KitChip,
  Mark,
  Md,
  Parents,
  PassiveDef,
  RefCard,
  Rules,
  SkillRows,
  Swatch,
  Tag,
  UsedTerms,
} from './ReferenceParts.js';

export type Go = (r: RefRoute) => void;
type T = ReturnType<typeof useT>;

function Prose({ section }: { section: ProseSection }) {
  return (
    <section>
      <h2 className="ref-h2">{section.title}</h2>
      <ul className="ref-prose">
        {section.items.map((x) => (
          <li key={x.lead}>
            <strong>{x.lead}</strong> <Md text={x.text} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Crumbs({ items }: { items: { label: string; to?: RefRoute }[] }) {
  const t = useT();
  return (
    <nav className="ref-crumbs" aria-label={t('ref.breadcrumb')}>
      {items.map((x, i) => (
        <span key={i}>
          {i > 0 && <span className="ref-crumb-sep">/</span>}
          {x.to ? <a href={href(x.to)}>{x.label}</a> : <span>{x.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="ref-head">
      <p className="ref-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

function Stats({ items }: { items: [number, string][] }) {
  return (
    <div className="ref-stats">
      {items.map(([n, label]) => (
        <div key={label}>
          <b>{n.toLocaleString('en-US')}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Pager<X extends { name: string }>({ list, at, to, label }: { list: X[]; at: X; to: (x: X) => RefRoute; label: string }) {
  const t = useT();
  const i = list.indexOf(at);
  const prev = list[i - 1];
  const next = list[i + 1];
  return (
    <nav className="ref-pager" aria-label={label}>
      {prev ? (
        <a className="prev" href={href(to(prev))}>
          <small>{t('ref.previous')}</small>
          <strong>{prev.name}</strong>
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a className="next" href={href(to(next))}>
          <small>{t('ref.next')}</small>
          <strong>{next.name}</strong>
        </a>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------- home

export function HomePage({ data, onSearch }: { data: ReferenceData; onSearch: () => void }) {
  const t = useT();
  const skillCount = data.bases.length * (1 + data.elements.length + data.kits.length);
  const statusCount = data.core.length + data.elements.reduce((n, e) => n + e.statuses.length, 0);
  const pure = data.kits.filter((k) => k.parents[0] === k.parents[1]);
  const entry = (to: RefRoute, eyebrow: string, title: string, text: string, extra?: React.ReactNode) => (
    <div className="ref-entry">
      <a className="ref-entry-main" href={href(to)}>
        <span className="ref-eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <span>{text}</span>
      </a>
      {extra && <div className="ref-entry-links">{extra}</div>}
    </div>
  );
  return (
    <article>
      <header className="ref-head ref-hero">
        <p className="ref-eyebrow">{t('ref.playerReference')}</p>
        <h1>{t('ref.title')}</h1>
        <p className="ref-lead">{HOME.lead}</p>
        <Stats
          items={[
            [data.bases.length, t('ref.stat.bases')],
            [data.elements.length, t('ref.stat.elements')],
            [data.kits.length, t('ref.stat.fusions')],
            [skillCount, t('ref.stat.skills')],
            [statusCount, t('ref.stat.statuses')],
          ]}
        />
        <button type="button" className="btn" onClick={onSearch}>
          {t('ref.searchEverything')} <kbd>/</kbd>
        </button>
      </header>

      <h2 className="ref-h2">{t('ref.findYourWay')}</h2>
      <div className="ref-entries">
        {entry({ page: 'base' }, t('ref.eyebrow.start'), t('ref.nav.base'), t('ref.entry.base', { count: data.bases.length }))}
        {entry(
          { page: 'elements' },
          t('ref.eyebrow.oneInfusion'),
          t('ref.nav.elements'),
          t('ref.entry.elements', { count: data.bases.length }),
          data.elements.map((e) => <ElChip key={e.name} el={e.name} />),
        )}
        {entry(
          { page: 'fusions' },
          t('ref.eyebrow.twoInfusions'),
          t('ref.nav.fusions'),
          t('ref.entry.fusions', { count: data.kits.length, n: data.bases.length }),
          pure.map((k) => <KitChip key={k.id} kit={k} />),
        )}
        {entry({ page: 'compare', skill: 'strike' }, t('ref.eyebrow.reference'), t('ref.nav.compare'), t('ref.entry.compare', { count: data.elements.length, n: data.kits.length }))}
        {entry({ page: 'keywords' }, t('ref.eyebrow.reference'), t('ref.nav.keywords'), t('ref.entry.keywords'))}
        {entry({ page: 'statuses' }, t('ref.eyebrow.reference'), t('ref.nav.statuses'), t('ref.entry.statuses'))}
      </div>

      <Prose section={HOME.howItWorks} />

      <h2 className="ref-h2">{t('ref.classes')}</h2>
      <p className="muted ref-narrow">{t('ref.classesHint')}</p>
      <div className="ref-scroll">
        <table className="ref-table">
          <thead>
            <tr>
              <th>{t('ref.col.class')}</th>
              <th>{t('ref.col.signatures')}</th>
              <th>{t('ref.col.borrowed')}</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map((c) => (
              <tr key={c.id}>
                <td className="ref-strong">{c.name}</td>
                {[c.signatures, c.affinity].map((list, col) => (
                  <td key={col}>
                    {list.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <a
                          href={href({ page: 'base', skill: id })}
                          className={col === 0 && id === c.starter ? 'ref-starter' : undefined}
                          title={col === 0 && id === c.starter ? t('ref.starterHint') : undefined}
                        >
                          {data.baseById.get(id)?.name ?? id}
                        </a>
                      </span>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- the base kit

export function BasePage({ data, skill, go }: { data: ReferenceData; skill: string | undefined; go: Go }) {
  const t = useT();
  return (
    <article>
      <Crumbs items={[{ label: t('ref.nav.home'), to: { page: 'home' } }, { label: t('ref.nav.base') }]} />
      <PageHead eyebrow={t('ref.eyebrow.noInfusion')} title={t('ref.nav.base')}>
        <p className="ref-lead">{t('ref.base.lead', { count: data.bases.length })}</p>
      </PageHead>
      <nav className="ref-strip" aria-label={t('ref.elementKits')}>
        <span>{t('ref.elementKits')}</span>
        {data.elements.map((e) => (
          <ElChip key={e.name} el={e.name} />
        ))}
      </nav>
      <h2 className="ref-h2">{t('ref.skills')}</h2>
      <SkillRows
        head={t('ref.col.classes')}
        selected={skill}
        onPick={(b) => go({ page: 'base', skill: b })}
        rows={data.bases.map((s) => {
          const c = classesOf(data, s.id);
          return { base: s.id, skill: s, label: <span className="muted">{[c.signature, c.affinity].map((x) => x?.name).filter(Boolean).join(' · ')}</span> };
        })}
      />
    </article>
  );
}

// ---------------------------------------------------------------- elements

export function ElementsPage({ data }: { data: ReferenceData }) {
  const t = useT();
  return (
    <article>
      <PageHead eyebrow={t('ref.eyebrow.oneInfusion')} title={t('ref.nav.elements')}>
        <p className="ref-lead">{ELEMENTS_LEAD}</p>
      </PageHead>
      <div className="ref-el-grid">
        {data.elements.map((e) => (
          <section key={e.name} className={`ref-el-card ${elementClass(e.name)}`}>
            <h2>
              <a href={href({ page: 'element', element: e.slug })}>{e.name}</a>
            </h2>
            <p className="ref-tagline">{e.tagline}</p>
            <p className="ref-kv">
              <span>{t('ref.themes')}</span>
              {e.themes}
            </p>
            <div className="ref-kv">
              <span>{e.statuses.length ? t('ref.statuses') : t('ref.terms')}</span>
              <div className="ref-links">
                {[...e.statuses, ...e.terms].map((x) => (
                  <a key={x.slug} href={href({ page: 'statuses', entry: x.slug })}>
                    {x.name}
                  </a>
                ))}
              </div>
            </div>
            <div className="ref-kv">
              <span>{t('ref.nav.fusions')}</span>
              <div className="ref-links">
                {e.fusions.map(({ kit }) => (
                  <KitChip key={kit.id} kit={kit} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export function ElementPage({ data, element: e, skill, go }: { data: ReferenceData; element: RefElement; skill: string | undefined; go: Go }) {
  const t = useT();
  const [filter, setFilter] = useState<string | null>(null);
  const filters = [...e.statuses, ...e.terms]
    .filter((x) => x.glossary)
    .map((x) => ({ x, count: data.bases.filter((b) => data.usesOf(e.skills[b.id]?.description ?? '').includes(x.glossary!)).length }))
    .filter((f) => f.count > 0);
  return (
    <article>
      <Crumbs items={[{ label: t('ref.nav.home'), to: { page: 'home' } }, { label: t('ref.nav.elements'), to: { page: 'elements' } }, { label: e.name }]} />
      <header className={`ref-kit-head ${elementClass(e.name)}`} style={{ '--a': `var(--el)`, '--b': `var(--el)` } as React.CSSProperties}>
        <div className="ref-plate">
          <h1>{e.name}</h1>
        </div>
        <p className="ref-tagline">{e.tagline}</p>
        <p className="ref-kv">
          <span>{t('ref.themes')}</span>
          {e.themes}
        </p>
      </header>

      <h2 className="ref-h2">{e.statuses.length ? t('ref.statusesAndTerms') : t('ref.terms')}</h2>
      <div className="ref-defs ref-box">
        {e.statuses.map((x) => (
          <EntryDef key={x.slug} entry={x} />
        ))}
        {e.statuses.length > 0 && e.terms.length > 0 && <p className="ref-note">{t('ref.terms')}</p>}
        {e.terms.map((x) => (
          <EntryDef key={x.slug} entry={x} />
        ))}
      </div>

      <h2 className="ref-h2">{t('ref.nav.fusions')}</h2>
      <p className="muted ref-narrow">{t('ref.element.fusionsHint', { element: e.name })}</p>
      <div className="ref-fu-list">
        {e.fusions.map(({ kit, partner }) => (
          <div key={kit.id}>
            <KitChip kit={kit} />
            <span className="muted">{partner === e.name ? t('ref.twice', { element: e.name }) : `+ ${partner}`}</span>
          </div>
        ))}
      </div>

      <div className="ref-sec-row">
        <h2 className="ref-h2">{t('ref.skills')}</h2>
        {filters.length > 0 && (
          <Chips
            label={t('ref.filterByTerm')}
            value={filter}
            onChange={setFilter}
            options={filters.map((f) => ({
              value: f.x.glossary!,
              title: t('ref.skillsUsing', { name: f.x.name }),
              label: (
                <>
                  {f.x.name} <span className="ref-n">{f.count}</span>
                </>
              ),
            }))}
          />
        )}
      </div>
      <SkillRows
        head={t('ref.col.base')}
        selected={skill}
        onPick={(b) => go({ page: 'element', element: e.slug, skill: b })}
        rows={data.bases.flatMap((b) => {
          const s = e.skills[b.id];
          return s ? [{ base: b.id, skill: s, label: <span className="muted">{b.name}</span>, hidden: !!filter && !data.usesOf(s.description).includes(filter) }] : [];
        })}
      />
      <Pager list={data.elements} at={e} to={(x) => ({ page: 'element', element: x.slug })} label={t('ref.otherElements')} />
    </article>
  );
}

// ---------------------------------------------------------------- fusions

function Matrix({ data, onPoint }: { data: ReferenceData; onPoint: (k: RefKit) => void }) {
  const byPair = new Map<string, RefKit>();
  for (const k of data.kits) {
    byPair.set(`${k.parents[0]}|${k.parents[1]}`, k);
    byPair.set(`${k.parents[1]}|${k.parents[0]}`, k);
  }
  const head = (el: string) => (
    <a className={`ref-el-h ${elementClass(el)}`} href={href({ page: 'element', element: el.toLowerCase() })}>
      {el}
    </a>
  );
  return (
    <table className="ref-matrix">
      <thead>
        <tr>
          <th />
          {ELEMENTS.map((c) => (
            <th key={c} scope="col">
              {head(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ELEMENTS.map((r) => (
          <tr key={r}>
            <th scope="row">{head(r)}</th>
            {ELEMENTS.map((c) => {
              const k = byPair.get(`${r}|${c}`);
              return (
                <td key={c}>
                  {k && (
                    <a
                      className="ref-cell"
                      href={href({ page: 'kit', kit: k.id })}
                      style={{ '--a': `var(--el-${r.toLowerCase()})`, '--b': `var(--el-${c.toLowerCase()})` } as React.CSSProperties}
                      aria-label={`${k.name}: ${r} + ${c}`}
                      onMouseEnter={() => onPoint(k)}
                      onFocus={() => onPoint(k)}
                    >
                      <span>{k.name}</span>
                    </a>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const kitText = (k: RefKit) => [k.name, k.tagline, k.playsLike, ...k.keywords.flatMap((x) => [x.name, x.text]), ...k.passives.flatMap((p) => [p.name, p.text])].join(' ').toLowerCase();

export function FusionsPage({ data }: { data: ReferenceData }) {
  const t = useT();
  const [pointed, setPointed] = useState<RefKit | null>(null);
  const [q, setQ] = useState('');
  const [el, setEl] = useState<Element | null>(null);
  const keywordCount = data.kits.reduce((n, k) => n + k.keywords.length, 0);
  const query = q.trim().toLowerCase();
  const show = (k: RefKit) => (!query || kitText(k).includes(query)) && (!el || k.parents.includes(el));
  const shown = data.kits.filter(show).length;
  return (
    <article>
      <PageHead eyebrow={t('ref.eyebrow.twoInfusions')} title={t('ref.nav.fusions')}>
        <p className="ref-lead">{FUSIONS.lead}</p>
        <Stats
          items={[
            [data.kits.length, t('ref.stat.fusions')],
            [data.kits.length * data.bases.length, t('ref.skills')],
            [keywordCount, t('ref.stat.keywords')],
          ]}
        />
      </PageHead>
      <Prose section={FUSIONS.howTheyWork} />

      <h2 className="ref-h2">{t('ref.matrix')}</h2>
      <div className="ref-scroll ref-matrix-wrap">
        <Matrix data={data} onPoint={setPointed} />
      </div>
      <div className="ref-matrix-info" aria-live="polite">
        {pointed ? (
          <>
            <strong>{pointed.name}</strong> <span className="muted">{pointed.parents.join(' + ')}</span>
            <br />
            {pointed.tagline}
            <br />
            <span className="muted">{t('ref.keywordsList', { name: pointed.keywords.map((k) => k.name).join(', ') })}</span>
          </>
        ) : (
          t('ref.matrixHint')
        )}
      </div>

      <h2 className="ref-h2">{t('ref.groups')}</h2>
      <div className="ref-toolbar">
        <FilterInput value={q} onChange={setQ} placeholder={t('ref.filterFusions')} />
        <ElementChips value={el} onChange={setEl} />
      </div>
      {data.groups.map((g) => {
        const kits = g.kits.filter(show);
        if (!kits.length) return null;
        return (
          <section key={g.slug} className="ref-group">
            <h3 className="ref-h3">{g.title}</h3>
            <p className="muted ref-narrow">{g.lead}</p>
            <div className="ref-kit-grid">
              {kits.map((k) => (
                <a key={k.id} className="ref-kit-card" href={href({ page: 'kit', kit: k.id })}>
                  <span className="ref-kit-card-head">
                    <Swatch parents={k.parents} />
                    <strong>{k.name}</strong>
                    <span className="muted">{k.parents.join(' + ')}</span>
                  </span>
                  <span className="ref-kit-card-plays">{k.playsLike}</span>
                  <span className="muted">{k.keywords.map((x) => x.name).join(' · ')}</span>
                </a>
              ))}
            </div>
          </section>
        );
      })}
      {shown === 0 && <p className="muted ref-empty">{t('ref.noFusion')}</p>}
    </article>
  );
}

export function KitPage({ data, kit: k, skill, go }: { data: ReferenceData; kit: RefKit; skill: string | undefined; go: Go }) {
  const t = useT();
  const [filter, setFilter] = useState<string | null>(null);
  const group = data.groups.find((g) => g.slug === k.groups[0]);
  const used = k.keywords
    .map((kw) => ({ kw, count: data.bases.filter((b) => data.usesOf(k.skills[b.id]?.description ?? '').includes(kw.id)).length }))
    .filter((x) => x.count > 0);
  return (
    <article>
      <Crumbs
        items={[
          { label: t('ref.nav.home'), to: { page: 'home' } },
          { label: t('ref.nav.fusions'), to: { page: 'fusions' } },
          { label: group?.title ?? '' },
        ]}
      />
      <header
        className="ref-kit-head"
        style={{ '--a': `var(--el-${k.parents[0].toLowerCase()})`, '--b': `var(--el-${k.parents[1].toLowerCase()})` } as React.CSSProperties}
      >
        <div className="ref-plate">
          <h1>{k.name}</h1>
        </div>
        <Parents kit={k} />
        <p className="ref-tagline">{k.tagline}</p>
        <p className="ref-kv">
          <span>{t('ref.playsLike')}</span>
          {k.playsLike}
        </p>
      </header>

      <h2 className="ref-h2">{t('ref.nav.keywords')}</h2>
      <div className="ref-defs ref-box">
        {k.keywords.map((kw) => (
          <KeywordDef key={kw.id} keyword={kw} />
        ))}
        {k.passives.length > 0 && <p className="ref-note">{t('ref.kit.passivesNote', { name: k.name })}</p>}
        {k.passives.map((p) => (
          <PassiveDef key={p.id} passive={p} />
        ))}
        {k.notes.map((n) => (
          <p key={n} className="ref-kit-note">
            {n}
          </p>
        ))}
      </div>

      <div className="ref-sec-row">
        <h2 className="ref-h2">{t('ref.skills')}</h2>
        {used.length > 0 && (
          <Chips
            label={t('ref.filterByKeyword')}
            value={filter}
            onChange={setFilter}
            options={used.map((x) => ({
              value: x.kw.id,
              title: t('ref.skillsUsing', { name: x.kw.name }),
              label: (
                <>
                  {x.kw.name} <span className="ref-n">{x.count}</span>
                </>
              ),
            }))}
          />
        )}
      </div>
      <SkillRows
        head={t('ref.col.base')}
        selected={skill}
        onPick={(b) => go({ page: 'kit', kit: k.id, skill: b })}
        rows={data.bases.flatMap((b) => {
          const s = k.skills[b.id];
          return s ? [{ base: b.id, skill: s, label: <span className="muted">{b.name}</span>, hidden: !!filter && !data.usesOf(s.description).includes(filter) }] : [];
        })}
      />
      <Pager list={data.kits} at={k} to={(x) => ({ page: 'kit', kit: x.id })} label={t('ref.otherFusions')} />
    </article>
  );
}

// ---------------------------------------------------------------- compare

export function ComparePage({ data, skill, pick, go }: { data: ReferenceData; skill: string; pick: string | undefined; go: Go }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [el, setEl] = useState<Element | null>(null);
  const base = data.baseById.get(skill) ?? data.bases[0]!;
  const query = q.trim().toLowerCase();
  return (
    <article>
      <nav className="ref-base-strip" aria-label={t('ref.baseSkills')}>
        {data.bases.map((b) => (
          <a key={b.id} href={href({ page: 'compare', skill: b.id })} className={b.id === base.id ? 'on' : undefined} aria-current={b.id === base.id ? 'page' : undefined}>
            {b.name}
          </a>
        ))}
      </nav>
      <PageHead eyebrow={t('ref.compareEyebrow')} title={base.name}>
        <div className="ref-base-card">
          <CostCd skill={base} />
          <a className="muted" href={href({ page: 'base', skill: base.id })}>
            {t('ref.inBaseKit')}
          </a>
          <p>
            <Rules text={base.description} />
          </p>
        </div>
      </PageHead>

      <h2 className="ref-h2">{t('ref.singleElement')}</h2>
      <SkillRows
        head={t('ref.col.element')}
        selected={pick && data.elementBySlug.has(pick) ? `el:${pick}` : undefined}
        onPick={(b) => go({ page: 'compare', skill: base.id, pick: b.slice(3) })}
        rows={data.elements.flatMap((e) => {
          const s = e.skills[base.id];
          return s ? [{ base: `el:${e.slug}`, skill: s, label: <ElChip el={e.name} /> }] : [];
        })}
      />

      <h2 className="ref-h2">{t('ref.allFusionVersions', { count: data.kits.length })}</h2>
      <div className="ref-toolbar">
        <FilterInput value={q} onChange={setQ} placeholder={t('ref.filterNameEffect')} />
        <ElementChips value={el} onChange={setEl} />
      </div>
      <SkillRows
        head={t('ref.col.fusion')}
        selected={pick && data.kitById.has(pick) ? `kit:${pick}` : undefined}
        onPick={(b) => go({ page: 'compare', skill: base.id, pick: b.slice(4) })}
        rows={data.kits.flatMap((k) => {
          const s = k.skills[base.id];
          if (!s) return [];
          const ok = (!query || `${k.name} ${s.name} ${s.description}`.toLowerCase().includes(query)) && (!el || k.parents.includes(el));
          return [{ base: `kit:${k.id}`, skill: s, label: <KitChip kit={k} skill={base.id} />, hidden: !ok }];
        })}
      />
    </article>
  );
}

// ---------------------------------------------------------------- keywords

export function KeywordsPage({ data }: { data: ReferenceData }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [el, setEl] = useState<Element | null>(null);
  const query = q.trim().toLowerCase();
  const kits = data.kits.filter((k) => (!query || kitText(k).includes(query)) && (!el || k.parents.includes(el)));
  return (
    <article>
      <PageHead eyebrow={t('ref.eyebrow.glossary')} title={t('ref.nav.keywords')}>
        <p className="ref-lead">
          {t('ref.keywords.lead', { count: data.kits.length })} <a href={href({ page: 'statuses' })}>{t('ref.nav.statuses')}</a>.
        </p>
      </PageHead>
      <div className="ref-toolbar">
        <FilterInput value={q} onChange={setQ} placeholder={t('ref.filterKeywords')} />
        <ElementChips value={el} onChange={setEl} />
      </div>
      <div className="ref-kw-list">
        {kits.map((k) => (
          <section key={k.id} className="ref-kw-kit">
            <h2>
              <a href={href({ page: 'kit', kit: k.id })}>{k.name}</a>
              <Swatch parents={k.parents} />
              <span className="muted">{k.parents.join(' + ')}</span>
            </h2>
            {k.keywords.map((kw) => (
              <KeywordDef key={kw.id} keyword={kw} />
            ))}
            {k.passives.map((p) => (
              <PassiveDef key={p.id} passive={p} />
            ))}
          </section>
        ))}
      </div>
      {kits.length === 0 && <p className="muted ref-empty">{t('ref.noKeyword')}</p>}
    </article>
  );
}

// ---------------------------------------------------------------- statuses and terms

export function StatusesPage({ data, entry }: { data: ReferenceData; entry: string | undefined }) {
  const t = useT();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const target = entry ? data.entryBySlug.get(entry) : undefined;
  // A linked entry stays visible: following a link clears a filter that would hide it.
  const [prevEntry, setPrevEntry] = useState(entry);
  if (prevEntry !== entry) {
    setPrevEntry(entry);
    if (target && query && !`${target.name} ${target.text}`.toLowerCase().includes(query)) setQ('');
  }
  useEffect(() => {
    if (!entry) return;
    const el = document.getElementById(target ? `ref-st-${entry}` : `ref-stg-${entry}`);
    el?.scrollIntoView({ block: target ? 'center' : 'start' });
  }, [entry, target]);
  const match = (e: { name: string; text: string }) => !query || `${e.name} ${e.text}`.toLowerCase().includes(query);
  const count = data.core.length + data.elements.reduce((n, e) => n + e.statuses.length, 0);
  const core = data.core.filter(match);
  const rules = data.rules.filter(match);
  const groups = data.elements.map((e) => ({ e, statuses: e.statuses.filter(match), terms: e.terms.filter(match) })).filter((g) => g.statuses.length + g.terms.length > 0);
  const nothing = !core.length && !rules.length && !groups.length;
  return (
    <article>
      <PageHead eyebrow={t('ref.eyebrow.glossary')} title={t('ref.nav.statuses')}>
        <p className="ref-lead">
          {t('ref.statuses.lead', { count })} <a href={href({ page: 'keywords' })}>{t('ref.nav.keywords')}</a>.
        </p>
      </PageHead>
      <nav className="ref-chips" aria-label={t('ref.jumpTo')}>
        <a className="ref-chip" href={href({ page: 'statuses', entry: 'core' })}>
          {t('ref.core')}
        </a>
        {data.elements.map((e) => (
          <a key={e.slug} className="ref-chip" href={href({ page: 'statuses', entry: e.slug })}>
            <span className={`ref-dot ${elementClass(e.name)}`} />
            {e.name}
          </a>
        ))}
        <a className="ref-chip" href={href({ page: 'statuses', entry: 'rules' })}>
          {t('ref.rulesTerms')}
        </a>
      </nav>
      <div className="ref-toolbar">
        <FilterInput value={q} onChange={setQ} placeholder={t('ref.filterStatuses')} />
      </div>

      {core.length > 0 && (
        <section id="ref-stg-core">
          <h2 className="ref-h2">{t('ref.coreStatuses')}</h2>
          <div className="ref-defs ref-box">
            {core.map((x) => (
              <EntryDef key={x.slug} entry={x} anchored target={x === target} />
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && <h2 className="ref-h2">{t('ref.elementStatuses')}</h2>}
      <div className="ref-kw-list">
        {groups.map(({ e, statuses, terms }) => (
          <section key={e.slug} id={`ref-stg-${e.slug}`} className={`ref-kw-kit ref-st-el ${elementClass(e.name)}`}>
            <h2>
              <span className="ref-el-h">{e.name}</span>
              <a className="muted" href={href({ page: 'element', element: e.slug })}>
                {t('ref.elementSkills', { element: e.name })}
              </a>
            </h2>
            {statuses.map((x) => (
              <EntryDef key={x.slug} entry={x} anchored target={x === target} />
            ))}
            {statuses.length > 0 && terms.length > 0 && <p className="ref-note">{t('ref.terms')}</p>}
            {terms.map((x) => (
              <EntryDef key={x.slug} entry={x} anchored target={x === target} />
            ))}
          </section>
        ))}
      </div>

      {rules.length > 0 && (
        <section id="ref-stg-rules">
          <h2 className="ref-h2">{t('ref.rulesTerms')}</h2>
          <div className="ref-defs ref-box">
            {rules.map((x) => (
              <EntryDef key={x.slug} entry={x} anchored target={x === target} />
            ))}
          </div>
        </section>
      )}
      {nothing && <p className="muted ref-empty">{t('ref.nothingMatches')}</p>}
    </article>
  );
}

// ---------------------------------------------------------------- search

const LIMIT = 150;

export function SearchPage({ data, query }: { data: ReferenceData; query: string }) {
  const t = useT();
  const r = useMemo(() => searchReference(data, query), [data, query]);
  if (!query.trim()) return <p className="muted">{t('ref.searchHint')}</p>;
  const places = r.elements.length + r.kits.length;
  const total = places + r.keywords.length + r.entries.length + r.skills.length + r.fusionSkills.length;
  const more = (n: number) => n > LIMIT && <p className="muted">{t('ref.showingFirst', { count: LIMIT })}</p>;
  return (
    <article>
      <PageHead eyebrow={t('ref.search')} title={`“${query}”`}>
        <p className="muted">
          {t('ref.searchCounts', { places, keywords: r.keywords.length, entries: r.entries.length, skills: r.skills.length, fusionSkills: r.fusionSkills.length })}
        </p>
      </PageHead>
      {places > 0 && (
        <>
          <h2 className="ref-h3">{t('ref.result.places')}</h2>
          <ul className="ref-results">
            {r.elements.map((e) => (
              <li key={e.slug}>
                <a href={href({ page: 'element', element: e.slug })}>
                  <span className="ref-r-top">
                    <strong>
                      <Mark text={e.name} query={query} />
                    </strong>
                    <ElChip el={e.name} link={false} />
                  </span>
                  <span>
                    <Mark text={e.tagline} query={query} />
                  </span>
                </a>
              </li>
            ))}
            {r.kits.map((k) => (
              <li key={k.id}>
                <a href={href({ page: 'kit', kit: k.id })}>
                  <span className="ref-r-top">
                    <strong>
                      <Mark text={k.name} query={query} />
                    </strong>
                    <Swatch parents={k.parents} />
                    <span className="muted">{k.parents.join(' + ')}</span>
                  </span>
                  <span>
                    <Mark text={k.tagline} query={query} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.keywords.length > 0 && (
        <>
          <h2 className="ref-h3">{t('ref.nav.keywords')}</h2>
          <ul className="ref-results">
            {r.keywords.map((x) => (
              <li key={`${x.kit.id}:${x.name}`}>
                <a href={href({ page: 'kit', kit: x.kit.id })}>
                  <span className="ref-r-top">
                    <strong>
                      <Mark text={x.name} query={query} />
                    </strong>
                    <span className="muted">{x.kit.name}</span>
                  </span>
                  <span>
                    <Mark text={x.text} query={query} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.entries.length > 0 && (
        <>
          <h2 className="ref-h3">{t('ref.statusesAndTerms')}</h2>
          <ul className="ref-results">
            {r.entries.map((e) => (
              <li key={e.slug}>
                <a href={href({ page: 'statuses', entry: e.slug })}>
                  <span className="ref-r-top">
                    <strong>
                      <Mark text={e.name} query={query} />
                    </strong>
                    <span className="muted">{entryGroup(t, e)}</span>
                    <KindBadge kind={e.kind} />
                  </span>
                  <span>
                    <Mark text={e.text} query={query} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.skills.length > 0 && (
        <>
          <h2 className="ref-h3">{t('ref.result.skills')}</h2>
          <ul className="ref-results">
            {r.skills.slice(0, LIMIT).map((x) => (
              <li key={x.skill.id}>
                <a href={href(x.element ? { page: 'element', element: x.element.slug, skill: x.base } : { page: 'base', skill: x.base })}>
                  <span className="ref-r-top">
                    <strong>
                      <Mark text={x.skill.name} query={query} />
                    </strong>
                    <span className="muted">{x.element ? `${x.element.name} · ${data.baseById.get(x.base)?.name}` : t('ref.nav.base')}</span>
                    <CostCd skill={x.skill} />
                  </span>
                  <span>
                    <Mark text={x.skill.description} query={query} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {more(r.skills.length)}
        </>
      )}
      {r.fusionSkills.length > 0 && (
        <>
          <h2 className="ref-h3">{t('ref.result.fusionSkills')}</h2>
          <ul className="ref-results">
            {r.fusionSkills.slice(0, LIMIT).map((x) => (
              <li key={x.skill.id}>
                <a href={href({ page: 'kit', kit: x.kit.id, skill: x.base })}>
                  <span className="ref-r-top">
                    <strong>
                      <Mark text={x.skill.name} query={query} />
                    </strong>
                    <span className="muted">
                      {x.kit.name} · {data.baseById.get(x.base)?.name}
                    </span>
                    <CostCd skill={x.skill} />
                  </span>
                  <span>
                    <Mark text={x.skill.description} query={query} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {more(r.fusionSkills.length)}
        </>
      )}
      {total === 0 && <p className="muted">{t('ref.nothingMatches')}</p>}
    </article>
  );
}

function entryGroup(t: T, e: { group: string; element?: string; status?: string }): string {
  if (e.group === 'core') return t('ref.group.core');
  if (e.group === 'rules') return t('ref.group.rules');
  return e.status ? t('ref.group.elementStatus', { element: e.element ?? '' }) : t('ref.group.elementTerm', { element: e.element ?? '' });
}

// ---------------------------------------------------------------- details: a skill beside its other versions

function DetailHead({ context, base, skill, meta }: { context: React.ReactNode; base: string; skill: { name: string }; meta: React.ReactNode }) {
  return (
    <>
      <p className="ref-eyebrow">
        {context} · {base}
      </p>
      <h2 className="ref-detail-title">{skill.name}</h2>
      <div className="ref-detail-meta">{meta}</div>
    </>
  );
}

export function BaseDetail({ data, base }: { data: ReferenceData; base: string }) {
  const t = useT();
  const s = data.baseById.get(base);
  if (!s) return null;
  const c = classesOf(data, base);
  return (
    <>
      <DetailHead
        context={<a href={href({ page: 'base' })}>{t('ref.nav.base')}</a>}
        base={s.name}
        skill={s}
        meta={
          <>
            <CostCd skill={s} />
            <BaseChip />
          </>
        }
      />
      <p className="ref-detail-effect">
        <Rules text={s.description} />
      </p>
      <UsedTerms data={data} text={s.description} />
      <h3 className="ref-h3">{t('ref.classes')}</h3>
      <div className="ref-defs">
        {c.signature && (
          <div className="ref-def">
            <div className="ref-def-head">
              <strong>{c.signature.name}</strong>
              <Tag>{t('ref.signature')}</Tag>
              {c.signature.starter === base && <Tag accent>{t('ref.starter')}</Tag>}
            </div>
          </div>
        )}
        {c.affinity && (
          <div className="ref-def">
            <div className="ref-def-head">
              <strong>{c.affinity.name}</strong>
              <Tag>{t('ref.borrowed')}</Tag>
            </div>
          </div>
        )}
      </div>
      <h3 className="ref-h3">{t('ref.withOneInfusion')}</h3>
      {data.elements.map((e) => {
        const v = e.skills[base];
        return v ? <RefCard key={e.slug} label={<ElChip el={e.name} link={false} />} skill={v} to={{ page: 'element', element: e.slug, skill: base }} /> : null;
      })}
      <a className="btn ref-detail-btn" href={href({ page: 'compare', skill: base })}>
        {t('ref.compareAcrossFusions', { name: s.name })}
      </a>
    </>
  );
}

export function ElementDetail({ data, element: e, base }: { data: ReferenceData; element: RefElement; base: string }) {
  const t = useT();
  const s = e.skills[base];
  const b = data.baseById.get(base);
  if (!s || !b) return null;
  return (
    <>
      <DetailHead
        context={<a href={href({ page: 'element', element: e.slug })}>{e.name}</a>}
        base={b.name}
        skill={s}
        meta={
          <>
            <CostCd skill={s} />
            <ElChip el={e.name} link={false} />
          </>
        }
      />
      <p className="ref-detail-effect">
        <Rules text={s.description} />
      </p>
      <UsedTerms data={data} text={s.description} />
      <h3 className="ref-h3">{t('ref.baseSkill')}</h3>
      <RefCard label={<BaseChip />} skill={b} to={{ page: 'base', skill: base }} />
      <h3 className="ref-h3">{t('ref.withSecondInfusion')}</h3>
      {e.fusions.map(({ kit }) => {
        const v = kit.skills[base];
        return v ? <RefCard key={kit.id} label={<KitChip kit={kit} link={false} />} skill={v} to={{ page: 'kit', kit: kit.id, skill: base }} /> : null;
      })}
      <a className="btn ref-detail-btn" href={href({ page: 'compare', skill: base })}>
        {t('ref.compareAcrossAll', { name: b.name })}
      </a>
    </>
  );
}

export function KitDetail({ data, kit: k, base }: { data: ReferenceData; kit: RefKit; base: string }) {
  const t = useT();
  const s = k.skills[base];
  const b = data.baseById.get(base);
  if (!s || !b) return null;
  const parents = k.parents[0] === k.parents[1] ? [k.parents[0]] : k.parents;
  const uses = data.usesOf(s.description);
  const keywords = k.keywords.filter((kw) => uses.includes(kw.id));
  return (
    <>
      <DetailHead
        context={<a href={href({ page: 'kit', kit: k.id })}>{k.name}</a>}
        base={b.name}
        skill={s}
        meta={
          <>
            <CostCd skill={s} />
            <Parents kit={k} />
          </>
        }
      />
      <p className="ref-detail-effect">
        <Rules text={s.description} />
      </p>
      {keywords.length > 0 && (
        <>
          <h3 className="ref-h3">{t('ref.keywordCount', { count: keywords.length })}</h3>
          <div className="ref-defs">
            {keywords.map((kw) => (
              <KeywordDef key={kw.id} keyword={kw} />
            ))}
          </div>
        </>
      )}
      <UsedTerms data={data} text={s.description} />
      <h3 className="ref-h3">{t('ref.baseSkill')}</h3>
      <RefCard label={<BaseChip />} skill={b} to={{ page: 'base', skill: base }} />
      <h3 className="ref-h3">{t('ref.parentVersions', { count: parents.length })}</h3>
      {parents.map((el) => {
        const e = data.elementBySlug.get(el.toLowerCase());
        const v = e?.skills[base];
        return e && v ? <RefCard key={el} label={<ElChip el={el} link={false} />} skill={v} to={{ page: 'element', element: e.slug, skill: base }} /> : null;
      })}
      <a className="btn ref-detail-btn" href={href({ page: 'compare', skill: base })}>
        {t('ref.allFusionSkills', { count: data.kits.length, name: b.name })}
      </a>
    </>
  );
}
