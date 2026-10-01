// Localization runtime (GDD Phase 8 "localization readiness"): message catalogs keyed by id, with
// {param} interpolation, plural forms through Intl.PluralRules, and Intl number/date formatting.
// English is the source catalog; "pseudo" is generated from it (accented and ~40% longer) to catch
// hard-coded text and layouts that break when strings grow. See docs/live-ops.md §3.

import { useSettings } from '../settings.js';
import { en, type MessageKey, type Messages } from './en.js';

export type { MessageKey } from './en.js';

/** A message: plain text with {params}, or plural forms chosen by the `count` param. */
export type Message = string | { one?: string; other: string; zero?: string; two?: string; few?: string; many?: string };

const PSEUDO_MAP: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', c: 'ç', n: 'ñ', y: 'ý', A: 'Á', E: 'É', I: 'Í', O: 'Ö', U: 'Ü', C: 'Ç', N: 'Ñ', Y: 'Ý',
};

/** Accents letters (outside {params}) and pads the text, bracketed so clipping shows. */
export function pseudo(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    out += depth === 0 ? (PSEUDO_MAP[ch] ?? ch) : ch;
  }
  const pad = '~'.repeat(Math.max(1, Math.round(text.length * 0.4)));
  return `[${out}${pad}]`;
}

function pseudoMessages(src: Messages): Messages {
  const out: Record<string, Message> = {};
  for (const [k, m] of Object.entries(src) as [string, Message][]) {
    out[k] = typeof m === 'string' ? pseudo(m) : Object.fromEntries(Object.entries(m).map(([f, v]) => [f, pseudo(v as string)])) as Message;
  }
  return out as Messages;
}

/** Available catalogs: BCP 47 tag → messages (missing keys fall back to English). */
export const CATALOGS: Record<string, { name: string; messages: Partial<Messages> }> = {
  en: { name: 'English', messages: en },
  'en-XA': { name: 'Pseudo-locale (testing)', messages: pseudoMessages(en) },
};

/** The catalog to use for a setting: 'auto' picks the browser's language if we have it. */
export function resolveLocale(setting: string, browser: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): string {
  if (setting !== 'auto' && CATALOGS[setting]) return setting;
  for (const tag of browser) {
    if (CATALOGS[tag]) return tag;
    const base = tag.split('-')[0]!;
    if (CATALOGS[base]) return base;
  }
  return 'en';
}

function interpolate(text: string, params: Record<string, string | number>, locale: string): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined) return `{${name}}`;
    return typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : v;
  });
}

/** Formats a message in a locale (pure; the hook below binds the current one). */
export function format(locale: string, key: MessageKey, params: Record<string, string | number> = {}): string {
  const m: Message = CATALOGS[locale]?.messages[key] ?? en[key];
  if (typeof m === 'string') return interpolate(m, params, locale);
  const count = typeof params.count === 'number' ? params.count : 0;
  const form = count === 0 && m.zero !== undefined ? 'zero' : new Intl.PluralRules(locale === 'en-XA' ? 'en' : locale).select(count);
  return interpolate((m as Record<string, string | undefined>)[form] ?? m.other, params, locale);
}

/** The current locale's `t` (re-renders when the language setting changes). */
export function useT(): (key: MessageKey, params?: Record<string, string | number>) => string {
  const setting = useSettings((s) => s.locale);
  const locale = resolveLocale(setting);
  return (key, params) => format(locale, key, params);
}

/** Dates in the current locale (match history, achievements). */
export function formatDate(d: string | Date, setting = useSettings.getState().locale): string {
  const locale = resolveLocale(setting);
  return new Intl.DateTimeFormat(locale === 'en-XA' ? 'en' : locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
}
