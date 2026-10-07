// Rules text (skill, status and item descriptions) with its keywords set apart: each glossary keyword
// is tinted in its element's color (base keywords in the keyword accent) and underlined, so a player
// can tell game terms from plain wording at a glance. Alt (or the keyword-help setting) still opens
// the explanation cards beside a hover panel (KeywordHelp). With `link` (the reference), a keyword
// that has a definition page becomes a link to it.

import type { GlossaryDef } from '@arena/engine';
import { content } from '../content.js';
import { keywordMatcher, splitKeywords, type Matcher } from '../keywords.js';

let matcher: Matcher | null = null;
/** One matcher for the whole client: the glossary, skipping base-skill names used as "X skills". */
function gameMatcher(): Matcher {
  matcher ??= keywordMatcher(content.glossary, new Set(Object.values(content.skills).filter((s) => !s.id.includes('.')).map((s) => s.name)));
  return matcher;
}

/** Where a keyword links to, and its hover text. */
export type KeywordLink = (keyword: GlossaryDef) => { href: string; title?: string } | undefined;

export function RulesText({ text, link }: { text: string | undefined; link?: KeywordLink }) {
  if (!text) return null;
  return (
    <>
      {splitKeywords(gameMatcher(), text).map((p, i) => {
        if (!p.keyword) return p.text;
        const className = `kw${p.keyword.element ? ` el-${p.keyword.element.toLowerCase()}` : ''}`;
        const to = link?.(p.keyword);
        return to ? (
          <a key={i} className={`${className} kw-link`} href={to.href} title={to.title}>
            {p.text}
          </a>
        ) : (
          <span key={i} className={className}>
            {p.text}
          </span>
        );
      })}
    </>
  );
}
