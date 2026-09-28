// Keyword explanations beside hover panels (docs/glossary.md). While a tooltip is open, holding Alt
// (or always, per Settings; the default on touch screens) shows a card for every keyword it uses, and
// underlines those words. It watches the page for elements with role="tooltip", so every hover panel
// gets it without knowing about it.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { content } from '../content.js';
import { useT } from '../i18n/index.js';
import { keywordItems, keywordMatcher, type KeywordItem, type KeywordMatch } from '../keywords.js';
import { keywordHelpMode, useSettings } from '../settings.js';
import { elementClass } from './common.js';

const HIGHLIGHT = 'keyword';

/** Whether Alt is held down (only listened for while `listen`). */
function useAltHeld(listen: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!listen) {
      setHeld(false);
      return;
    }
    // preventDefault keeps a lone Alt from moving focus to the browser's menu.
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      e.preventDefault();
      setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      e.preventDefault();
      setHeld(false);
    };
    const off = () => setHeld(false);
    // Released while another window had focus: the next mouse move tells.
    const sync = (e: MouseEvent) => {
      if (!e.altKey) setHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    window.addEventListener('mousemove', sync);
    document.addEventListener('visibilitychange', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
      window.removeEventListener('mousemove', sync);
      document.removeEventListener('visibilitychange', off);
    };
  }, [listen]);
  return held;
}

/** The hover panel on screen (the newest, if there are several). */
function openPanel(): HTMLElement | null {
  const panels = [...document.querySelectorAll<HTMLElement>('[role="tooltip"]')].filter((p) => {
    const r = p.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(p).visibility !== 'hidden';
  });
  return panels[panels.length - 1] ?? null;
}

/** A panel's explanatory text: everything but its title (and anything marked data-no-keywords). */
function bodyText(panel: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('h4, [data-no-keywords]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

// The CSS Custom Highlight API underlines words without touching the DOM React owns (where supported).
type HighlightRegistry = { set(name: string, h: unknown): void; delete(name: string): void };
const registry = (): HighlightRegistry | undefined => (globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined)?.highlights;

function highlight(found: { node: Text; matches: KeywordMatch[] }[]): void {
  const reg = registry();
  const HighlightCtor = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!reg || !HighlightCtor) return;
  const ranges = found.flatMap(({ node, matches }) =>
    matches.map((m) => {
      const r = new Range();
      r.setStart(node, m.index);
      r.setEnd(node, m.index + m.length);
      return r;
    }),
  );
  reg.set(HIGHLIGHT, new HighlightCtor(...ranges));
}

function clearHighlight(): void {
  registry()?.delete(HIGHLIGHT);
}

interface Shown {
  rect: DOMRect;
  items: KeywordItem[];
  /** Identity of what's shown, so an unchanged panel doesn't re-render. */
  key: string;
}

export function KeywordHelp() {
  const t = useT();
  const mode = useSettings(keywordHelpMode);
  const alt = useAltHeld(mode === 'alt');
  const open = mode === 'always' || (mode === 'alt' && alt);
  const match = useMemo(
    () => keywordMatcher(content.glossary, new Set(Object.values(content.skills).filter((s) => !s.id.includes('.')).map((s) => s.name))),
    [],
  );
  const [shown, setShown] = useState<Shown | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Follow the open panel: tooltips come and go, move, and change text as the game updates.
  useEffect(() => {
    if (mode === 'off') {
      setShown(null);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const panel = openPanel();
      const found = panel ? bodyText(panel).map((node) => ({ node, matches: match(node.data) })) : [];
      const items = keywordItems(
        match,
        found.flatMap((f) => f.matches),
      );
      if (!panel || items.length === 0) {
        clearHighlight();
        setShown(null);
        return;
      }
      if (open) highlight(found);
      else clearHighlight();
      const rect = panel.getBoundingClientRect();
      const key = `${items.map((i) => i.keyword.id).join()}@${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}`;
      setShown((prev) => (prev?.key === key ? prev : { rect, items, key }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver((records) => {
      if (records.every((r) => ref.current?.contains(r.target))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      clearHighlight();
    };
  }, [mode, open, match]);

  // Beside the panel: right, else left, else below or above; always inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shown) return setPos(null);
    const { width: w, height: h } = el.getBoundingClientRect();
    const r = shown.rect;
    const gap = 8;
    const m = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (!open) {
      // The hint sits just under the panel's bottom-right corner.
      left = r.right - w;
      top = r.bottom + 4 + h <= vh - m ? r.bottom + 4 : r.top - 4 - h;
    } else if (r.right + gap + w <= vw - m) {
      left = r.right + gap;
      top = r.top;
    } else if (r.left - gap - w >= m) {
      left = r.left - gap - w;
      top = r.top;
    } else {
      left = r.left;
      top = r.bottom + gap + h <= vh - m ? r.bottom + gap : r.top - gap - h;
    }
    setPos({ left: Math.max(m, Math.min(left, vw - m - w)), top: Math.max(m, Math.min(top, vh - m - h)) });
  }, [shown, open]);

  if (!shown) return null;
  const style = pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0, visibility: 'hidden' as const };
  return createPortal(
    open ? (
      <div ref={ref} className="keyword-panels" style={style} role="note" aria-label={t('keywords.title')}>
        {shown.items.map(({ keyword: k, via }) => (
          <div key={k.id} className={`kw-card ${elementClass(k.element)}`}>
            <div className="kw-name">
              {k.name}
              {k.element && <span className="kw-el">{k.element}</span>}
            </div>
            <div className="kw-text">{k.text}</div>
            {via && <div className="kw-via">{t('keywords.via', { name: via })}</div>}
          </div>
        ))}
      </div>
    ) : (
      <div ref={ref} className="kw-hint" style={style} aria-hidden>
        {t('keywords.hint', { count: shown.items.filter((i) => !i.via).length })}
      </div>
    ),
    document.body,
  );
}
