// The order elements are shown in everywhere (decided 2026-10-09). Display only: random rolls keep
// their own (alphabetical) order so seeded rolls don't change.

export const ELEMENT_ORDER = ['Fire', 'Ice', 'Wind', 'Lightning', 'Water', 'Earth', 'Poison', 'Shadow', 'Holy', 'Unholy'] as const;

/** Sorts element names into ELEMENT_ORDER (anything else after them, alphabetically). */
export function byElementOrder(a: string, b: string): number {
  const i = (ELEMENT_ORDER as readonly string[]).indexOf(a);
  const j = (ELEMENT_ORDER as readonly string[]).indexOf(b);
  return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b);
}
