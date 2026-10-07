// The game reference: the base kit, the ten elements and the 55 fusions with every one of their skills,
// the fusion keywords, and the statuses and rules terms, all read from the content bundle the game runs
// (reference/data.ts). One component, shown on Home's Reference tab and, signed out, as its own screen
// (ReferenceScreen). A sidebar (a menu on phones) moves between sections; picking a skill opens it beside
// its other versions. Every view has a URL hash (reference/route.ts), kept in the address bar while the
// reference is open, so a view can be linked: #reference/kit/dragon/stun.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useT } from '../i18n/index.js';
import type { ReferenceData } from '../reference/data.js';
import { isReferenceHash, pageKey, parseRefHash, refHash, type RefRoute } from '../reference/route.js';
import { useStore } from '../store.js';
import { Brand } from './Account.js';
import { elementClass } from './common.js';
import { href, referenceData, Swatch } from './ReferenceParts.js';
import {
  BaseDetail,
  BasePage,
  ComparePage,
  ElementDetail,
  ElementPage,
  ElementsPage,
  FusionsPage,
  HomePage,
  KeywordsPage,
  KitDetail,
  KitPage,
  SearchPage,
  StatusesPage,
} from './ReferencePages.js';

/** The view last shown, so leaving the reference and coming back opens it where it was. */
let lastRoute: RefRoute = { page: 'home' };

function initialRoute(): RefRoute {
  const r = typeof location === 'undefined' ? null : parseRefHash(location.hash);
  if (r) lastRoute = r;
  return lastRoute;
}

/** The route with unknown ids dropped: an unknown element or fusion opens its overview, an unknown skill closes. */
function resolve(data: ReferenceData, r: RefRoute): RefRoute {
  const base = (id: string | undefined) => (id && data.baseById.has(id) ? id : undefined);
  switch (r.page) {
    case 'base':
      return { page: 'base', skill: base(r.skill) };
    case 'element':
      return data.elementBySlug.has(r.element) ? { page: 'element', element: r.element, skill: base(r.skill) } : { page: 'elements' };
    case 'kit':
      return data.kitById.has(r.kit) ? { page: 'kit', kit: r.kit, skill: base(r.skill) } : { page: 'fusions' };
    case 'compare': {
      const pick = r.pick && (data.elementBySlug.has(r.pick) || data.kitById.has(r.pick)) ? r.pick : undefined;
      return { page: 'compare', skill: base(r.skill) ?? data.bases[0]?.id ?? 'strike', pick };
    }
    default:
      return r;
  }
}

/** The view with its open skill closed. */
function closed(r: RefRoute): RefRoute {
  switch (r.page) {
    case 'base':
      return { page: 'base' };
    case 'element':
      return { page: 'element', element: r.element };
    case 'kit':
      return { page: 'kit', kit: r.kit };
    case 'compare':
      return { page: 'compare', skill: r.skill };
    default:
      return r;
  }
}

/** The sidebar entry a view belongs to. */
function navKey(r: RefRoute): string {
  if (r.page === 'element') return `element/${r.element}`;
  if (r.page === 'kit') return `kit/${r.kit}`;
  return r.page;
}

export function Reference() {
  const t = useT();
  const data = referenceData();
  const [raw, setRaw] = useState<RefRoute>(initialRoute);
  const route = useMemo(() => resolve(data, raw), [data, raw]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState(raw.page === 'search' ? raw.query : '');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const timer = useRef(0);
  const sideId = useId();

  const go = useCallback((r: RefRoute) => {
    clearTimeout(timer.current);
    setRaw(r);
    setMenuOpen(false);
    setQuery(r.page === 'search' ? r.query : '');
  }, []);

  // The address bar shows the view while the reference is open, and nothing of it once it's closed.
  const hash = refHash(route);
  useEffect(() => {
    lastRoute = parseRefHash(hash) ?? lastRoute;
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
  }, [hash]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (isReferenceHash(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    },
    [],
  );
  // A reference link typed or followed from outside (another tab, a bookmark) while it's open.
  useEffect(() => {
    const on = () => {
      const r = parseRefHash(location.hash);
      if (r) go(r);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [go]);

  // A new page starts at its top (an open skill or entry scrolls itself into view).
  const key = pageKey(route);
  const shownKey = useRef(key);
  useLayoutEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollBy(0, top - 8);
  }, [key]);

  const detailOpen = refHash(closed(route)) !== hash;
  const close = useCallback(() => go(closed(route)), [go, route]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'Escape') {
        if (typing) (document.activeElement as HTMLElement).blur();
        else if (detailOpen) close();
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [detailOpen, close]);

  // Links inside the reference (#reference/…) move it without touching the browser history.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a');
    const r = a ? parseRefHash(a.getAttribute('href') ?? '') : null;
    if (!r) return;
    e.preventDefault();
    go(r);
  };

  const onSearch = (v: string) => {
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (v.trim()) {
        setRaw({ page: 'search', query: v.trim() });
        setMenuOpen(false);
      }
    }, 180);
  };
  const focusSearch = () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  };

  const page = (() => {
    switch (route.page) {
      case 'base':
        return <BasePage data={data} skill={route.skill} go={go} />;
      case 'elements':
        return <ElementsPage data={data} />;
      case 'element':
        return <ElementPage key={route.element} data={data} element={data.elementBySlug.get(route.element)!} skill={route.skill} go={go} />;
      case 'fusions':
        return <FusionsPage data={data} />;
      case 'kit':
        return <KitPage key={route.kit} data={data} kit={data.kitById.get(route.kit)!} skill={route.skill} go={go} />;
      case 'compare':
        return <ComparePage key={route.skill} data={data} skill={route.skill} pick={route.pick} go={go} />;
      case 'keywords':
        return <KeywordsPage data={data} />;
      case 'statuses':
        return <StatusesPage data={data} entry={route.entry} />;
      case 'search':
        return <SearchPage data={data} query={route.query} />;
      default:
        return <HomePage data={data} onSearch={focusSearch} />;
    }
  })();

  const detail = (() => {
    if (route.page === 'base' && route.skill) return <BaseDetail data={data} base={route.skill} />;
    if (route.page === 'element' && route.skill) return <ElementDetail data={data} element={data.elementBySlug.get(route.element)!} base={route.skill} />;
    if (route.page === 'kit' && route.skill) return <KitDetail data={data} kit={data.kitById.get(route.kit)!} base={route.skill} />;
    if (route.page === 'compare' && route.pick) {
      const e = data.elementBySlug.get(route.pick);
      if (e) return <ElementDetail data={data} element={e} base={route.skill} />;
      const k = data.kitById.get(route.pick);
      if (k) return <KitDetail data={data} kit={k} base={route.skill} />;
    }
    return null;
  })();

  const current = navKey(route);
  const currentGroup = route.page === 'kit' ? data.kitById.get(route.kit)?.group : undefined;
  const item = (to: RefRoute, label: React.ReactNode, lead?: React.ReactNode) => {
    const on = navKey(to) === current;
    return (
      <li key={refHash(to)}>
        <a href={href(to)} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
          {lead ?? <span className="ref-side-mark" aria-hidden />}
          <span>{label}</span>
        </a>
      </li>
    );
  };

  return (
    <div ref={rootRef} className={`ref${detail ? ' has-detail' : ''}${menuOpen ? ' menu-open' : ''}`} onClick={onClick}>
      <div className="ref-bar">
        <button type="button" className="btn small ref-menu-btn" aria-expanded={menuOpen} aria-controls={sideId} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? t('ref.closeSections') : t('ref.sections')}
        </button>
        <label className="ref-search">
          <span className="sr-only">{t('ref.searchLabel')}</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={t('ref.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onSearch(e.target.value)}
          />
          <kbd aria-hidden>/</kbd>
        </label>
      </div>

      <nav id={sideId} className="ref-side" aria-label={t('ref.sections')}>
        <ul>
          {item({ page: 'home' }, t('ref.nav.home'))}
          {item({ page: 'base' }, t('ref.nav.base'))}
        </ul>
        <h2>{t('ref.nav.elements')}</h2>
        <ul>
          {item({ page: 'elements' }, t('ref.allElements'))}
          {data.elements.map((e) => item({ page: 'element', element: e.slug }, e.name, <span className={`ref-side-dot ${elementClass(e.name)}`} aria-hidden />))}
        </ul>
        <h2>{t('ref.nav.fusions')}</h2>
        <ul>{item({ page: 'fusions' }, t('ref.overviewMatrix'))}</ul>
        {data.groups.map((g) => (
          <details key={g.slug} className="ref-fold" open={g.slug === currentGroup || undefined}>
            <summary>
              {g.title}
              <span className="ref-n">{g.kits.length}</span>
            </summary>
            <ul>{g.kits.map((k) => item({ page: 'kit', kit: k.id }, k.name, <Swatch parents={k.parents} />))}</ul>
          </details>
        ))}
        <h2>{t('ref.reference')}</h2>
        <ul>
          {item({ page: 'compare', skill: route.page === 'compare' ? route.skill : 'strike' }, t('ref.nav.compare'))}
          {item({ page: 'keywords' }, t('ref.nav.keywords'))}
          {item({ page: 'statuses' }, t('ref.nav.statuses'))}
        </ul>
      </nav>

      <div className="ref-main">{page}</div>

      {detail && (
        <>
          <div className="ref-scrim" onClick={close} aria-hidden />
          <aside key={hash} className="ref-detail" aria-label={t('ref.skillDetails')}>
            <button type="button" className="ref-detail-close" aria-label={t('ref.closeDetails')} onClick={close}>
              ×
            </button>
            {detail}
          </aside>
        </>
      )}
    </div>
  );
}

/** The reference on its own screen (signed out, or offline), with the way back. */
export function ReferenceScreen() {
  const t = useT();
  const go = useStore((s) => s.go);
  return (
    <div className="meta-page wide ref-page">
      <div className="meta-header">
        <Brand note={t('ref.title')} />
        <button type="button" className="btn small" onClick={() => go('home')}>
          {t('ref.back')}
        </button>
      </div>
      <Reference />
    </div>
  );
}
