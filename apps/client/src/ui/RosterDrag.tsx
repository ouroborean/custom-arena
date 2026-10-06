// Dragging characters on the Roster tab (decided 2026-10-06): drop a roster card on another to move it
// there, or on an active-team slot to put that character in (replacing who was there, or swapping places
// if they were already in the team); team slots drag onto each other to change battle order. The
// dragging itself (mouse and touch) is ui/PointerDrag.tsx.

import type { KeyboardEvent, ReactNode } from 'react';
import { usePointerDrag } from './PointerDrag.js';

export type DragSource = { id: string; from: 'roster' | 'team'; index: number };
export type DropTarget = { to: 'roster'; index: number; after: boolean } | { to: 'team'; slot: number };

/** A `data-drop` value: "team:1", or "roster:3" (before or after it by which half the pointer is on). */
function parse(spec: string, el: HTMLElement, x: number): DropTarget | null {
  const [kind, n] = spec.split(':');
  const index = Number(n);
  if (kind === 'team') return { to: 'team', slot: index };
  if (kind === 'roster') {
    const r = el.getBoundingClientRect();
    return { to: 'roster', index, after: x > r.left + r.width / 2 };
  }
  return null;
}

const keyOf = (t: DropTarget) => (t.to === 'team' ? `team:${t.slot}` : `roster:${t.index}:${t.after ? 'a' : 'b'}`);

export function useRosterDrag(onDrop: (source: DragSource, target: DropTarget) => void, ghostOf: (source: DragSource) => ReactNode) {
  return usePointerDrag<DragSource, DropTarget>({ parse, key: keyOf, onDrop, ghost: ghostOf });
}

/**
 * Keyboard moves for a focused roster card: Alt + ←/→ moves it along the roster, Alt + 1/2/3 puts it
 * in that team slot. (Drag-and-drop's keyboard counterpart; "Change team" still works as before.)
 */
export function rosterKeys(index: number, count: number, act: (target: DropTarget) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowLeft' && index > 0) act({ to: 'roster', index: index - 1, after: false });
    else if (e.key === 'ArrowRight' && index < count - 1) act({ to: 'roster', index: index + 1, after: true });
    else if (['1', '2', '3'].includes(e.key)) act({ to: 'team', slot: Number(e.key) - 1 });
    else return;
    e.preventDefault();
  };
}

/** The roster after moving `id` onto `target` (a roster place). */
export function moveInRoster(ids: string[], id: string, target: { index: number; after: boolean }): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const rest = ids.filter((x) => x !== id);
  // The target index counted the dragged card; once it's taken out, places after it shift left.
  let at = target.index + (target.after ? 1 : 0);
  if (from < at) at -= 1;
  rest.splice(Math.max(0, Math.min(at, rest.length)), 0, id);
  return rest;
}

/** The team after putting `id` in `slot`: it replaces who was there, or swaps if already in the team. */
export function placeInTeam(team: string[], id: string, slot: number): string[] {
  const next = [...team];
  const was = next.indexOf(id);
  if (was === slot) return next;
  if (was >= 0 && slot >= next.length) {
    next.splice(was, 1);
    next.push(id);
    return next;
  }
  if (was >= 0) {
    next[was] = next[slot]!;
    next[slot] = id;
    return next;
  }
  if (slot >= next.length) next.push(id);
  else next[slot] = id;
  return next;
}
