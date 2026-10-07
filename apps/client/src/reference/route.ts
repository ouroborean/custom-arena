// The reference's views as URL hashes, so any view can be linked: #reference/kit/dragon/stun opens
// Dragon's Stun. Only hashes starting with #reference mean anything; the rest of the game doesn't use
// the URL. Pure: ui/Reference.tsx checks the ids against the content.
//
//   #reference                          home: how the game works, the classes
//   #reference/base[/<skill>]           the base kit, optionally with a base skill open
//   #reference/elements                 the ten elements at a glance
//   #reference/element/<el>[/<skill>]   an element's statuses and 30 skills
//   #reference/fusions                  how fusions work, the matrix, the groups
//   #reference/kit/<fusion>[/<skill>]   a fusion's keywords and 30 skills
//   #reference/compare/<skill>[/<el or fusion>]   one base skill across every element and fusion
//   #reference/keywords                 every fusion keyword and passive
//   #reference/statuses[/<entry>]       statuses and terms, optionally scrolled to one
//   #reference/search/<query>           search results

export type RefRoute =
  | { page: 'home' }
  | { page: 'base'; skill?: string }
  | { page: 'elements' }
  | { page: 'element'; element: string; skill?: string }
  | { page: 'fusions' }
  | { page: 'kit'; kit: string; skill?: string }
  | { page: 'compare'; skill: string; pick?: string }
  | { page: 'keywords' }
  | { page: 'statuses'; entry?: string }
  | { page: 'search'; query: string };

export const REF_PREFIX = '#reference';

export function isReferenceHash(hash: string): boolean {
  return hash === REF_PREFIX || hash.startsWith(`${REF_PREFIX}/`);
}

const opt = <K extends string>(key: K, v: string | undefined) => (v ? ({ [key]: v } as { [P in K]: string }) : {});

/** The view a hash names, or null for a hash that isn't the reference's. Unknown views open the home page. */
export function parseRefHash(hash: string): RefRoute | null {
  if (!isReferenceHash(hash)) return null;
  const rest = hash.slice(REF_PREFIX.length + 1);
  if (rest.startsWith('search/')) return { page: 'search', query: safeDecode(rest.slice('search/'.length)) };
  const [page, a, b] = rest.split('/').map(safeDecode);
  switch (page) {
    case 'base':
      return { page: 'base', ...opt('skill', a) };
    case 'elements':
      return { page: 'elements' };
    case 'element':
      return a ? { page: 'element', element: a, ...opt('skill', b) } : { page: 'elements' };
    case 'fusions':
      return { page: 'fusions' };
    case 'kit':
      return a ? { page: 'kit', kit: a, ...opt('skill', b) } : { page: 'fusions' };
    case 'compare':
      return { page: 'compare', skill: a || 'strike', ...opt('pick', b) };
    case 'keywords':
      return { page: 'keywords' };
    case 'statuses':
      return { page: 'statuses', ...opt('entry', a) };
    default:
      return { page: 'home' };
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The hash for a view. */
export function refHash(r: RefRoute): string {
  const parts: (string | undefined)[] = (() => {
    switch (r.page) {
      case 'home':
        return [];
      case 'base':
        return ['base', r.skill];
      case 'elements':
        return ['elements'];
      case 'element':
        return ['element', r.element, r.skill];
      case 'fusions':
        return ['fusions'];
      case 'kit':
        return ['kit', r.kit, r.skill];
      case 'compare':
        return ['compare', r.skill, r.pick];
      case 'keywords':
        return ['keywords'];
      case 'statuses':
        return ['statuses', r.entry];
      case 'search':
        return ['search', r.query];
    }
  })();
  const path = parts.filter((p): p is string => !!p).map(encodeURIComponent);
  return path.length ? `${REF_PREFIX}/${path.join('/')}` : REF_PREFIX;
}

/** The view without its open skill, entry or pick: the page itself (for scrolling to the top on a new page). */
export function pageKey(r: RefRoute): string {
  switch (r.page) {
    case 'element':
      return `element/${r.element}`;
    case 'kit':
      return `kit/${r.kit}`;
    case 'compare':
      return `compare/${r.skill}`;
    default:
      return r.page;
  }
}
