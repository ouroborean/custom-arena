// Rules text (skill, status and item descriptions) with its keywords set apart: each glossary keyword
// is tinted in its element's color (base keywords in the keyword accent) and underlined, so a player
// can tell game terms from plain wording at a glance. Alt (or the keyword-help setting) still opens
// the explanation cards beside a hover panel (KeywordHelp).

import { content } from '../content.js';
import { keywordMatcher, splitKeywords, type Matcher } from '../keywords.js';

let matcher: Matcher | null = null;
/** One matcher for the whole client: the glossary, skipping base-skill names used as "X skills". */
function gameMatcher(): Matcher {
  matcher ??= keywordMatcher(content.glossary, new Set(Object.values(content.skills).filter((s) => !s.id.includes('.')).map((s) => s.name)));
  return matcher;
}

export function RulesText({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <>
      {splitKeywords(gameMatcher(), text).map((p, i) =>
        p.keyword ? (
          <span key={i} className={`kw${p.keyword.element ? ` el-${p.keyword.element.toLowerCase()}` : ''}`}>
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}
