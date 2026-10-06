// Keyword explanations (docs/glossary.md): which glossary keywords a piece of text uses. Pure, so it
// can be tested; ui/KeywordHelp.tsx finds the text in whatever hover panel is open.

import type { GlossaryDef } from '@arena/engine';

export interface KeywordMatch {
  keyword: GlossaryDef;
  /** Where the word form starts in the text, and its length. */
  index: number;
  length: number;
}

export interface KeywordItem {
  keyword: GlossaryDef;
  /** Set for a keyword that isn't in the panel itself but in another keyword's explanation. */
  via?: string;
}

export type Matcher = (text: string) => KeywordMatch[];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Finds the glossary's word forms in text: whole words, case-sensitive, the longest form first. A
 * form that's also a skill's name and is followed by "skill"/"skills" ("your Charge skills") names
 * the skill, so it's left out; `skillNames` are those names.
 */
export function keywordMatcher(glossary: Record<string, GlossaryDef>, skillNames: ReadonlySet<string> = new Set()): Matcher {
  const byForm = new Map<string, GlossaryDef>();
  for (const g of Object.values(glossary)) for (const f of g.forms) byForm.set(f, g);
  const forms = [...byForm.keys()].sort((a, b) => b.length - a.length).map(escape);
  if (forms.length === 0) return () => [];
  const re = new RegExp(`(?<![A-Za-z])(?:${forms.join('|')})(?![A-Za-z])`, 'g');
  return (text) => {
    const out: KeywordMatch[] = [];
    for (const m of text.matchAll(re)) {
      const index = m.index ?? 0;
      if (skillNames.has(m[0]) && /^\s+skills?\b/.test(text.slice(index + m[0].length))) continue;
      out.push({ keyword: byForm.get(m[0])!, index, length: m[0].length });
    }
    return out;
  };
}

/**
 * The keywords to explain for a panel: those it uses, in order of first use, then any their own
 * explanations mention (one level deep, so Sleep brings in Stunned).
 */
export function keywordItems(match: Matcher, found: readonly KeywordMatch[]): KeywordItem[] {
  const seen = new Set<string>();
  const direct: KeywordItem[] = [];
  for (const m of found) {
    if (seen.has(m.keyword.id)) continue;
    seen.add(m.keyword.id);
    direct.push({ keyword: m.keyword });
  }
  const nested: KeywordItem[] = [];
  for (const { keyword } of direct) {
    for (const m of match(keyword.text)) {
      if (seen.has(m.keyword.id)) continue;
      seen.add(m.keyword.id);
      nested.push({ keyword: m.keyword, via: keyword.name });
    }
  }
  return [...direct, ...nested];
}

/** A run of rules text: plain, or a keyword's word form. */
export type TextPart = { text: string; keyword?: GlossaryDef };

/** Splits text into plain runs and keyword runs, in order, for rendering keywords distinctly. */
export function splitKeywords(match: Matcher, text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of match(text)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ text: text.slice(m.index, m.index + m.length), keyword: m.keyword });
    at = m.index + m.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
