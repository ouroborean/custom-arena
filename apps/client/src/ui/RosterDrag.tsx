// Dragging characters on the Roster tab (decided 2026-10-06): drop a roster card on another to move it
// there, or on an active-team slot to put that character in (replacing who was there, or swapping places
// if they were already in the team); team slots drag onto each other to change battle order.
//
// Pointer events, so it works with a mouse and on touch screens alike: a mouse drag starts after a few
// pixels of movement, a touch drag after a short press-and-hold (so a swipe still scrolls the page).
// A drag never counts as a click, so a plain click still opens the character.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type DragSource = { id: string; from: 'roster' | 'team'; index: number };
export type DropTarget = { to: 'roster'; index: number; after: boolean } | { to: 'team'; slot: number };

/** Movement (px) before a mouse press becomes a drag, and how long a touch must hold still. */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
const TOUCH_HOLD_MS = 280;

interface Live {
  source: DragSource;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  dragging: boolean;
  timer: number | undefined;
}

/** Reads the drop target under a point from the `data-drop` attribute ("roster:3", "team:1"). */
function targetAt(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
  const spec = el?.dataset.drop;
  if (!el || !spec) return null;
  const [kind, n] = spec.split(':');
  const index = Number(n);
  if (kind === 'team') return { to: 'team', slot: index };
  if (kind === 'roster') {
    const r = el.getBoundingClientRect();
    return { to: 'roster', index, after: x > r.left + r.width / 2 };
  }
  return null;
}

const keyOf = (t: DropTarget | null) => (t ? (t.to === 'team' ? `team:${t.slot}` : `roster:${t.index}:${t.after ? 'a' : 'b'}`) : '');

export function useRosterDrag(onDrop: (source: DragSource, target: DropTarget) => void, ghostOf: (source: DragSource) => ReactNode) {
  const live = useRef<Live | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ source: DragSource; x: number; y: number; target: DropTarget | null } | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const end = useCallback((drop: boolean, x = 0, y = 0) => {
    const l = live.current;
    if (!l) return;
    window.clearTimeout(l.timer);
    live.current = null;
    if (l.dragging) {
      // The click that follows the pointerup belongs to the drag, not to the card.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      const target = drop ? targetAt(x, y) : null;
      if (target) dropRef.current(l.source, target);
    }
    setDrag(null);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const l = live.current;
      if (!l || e.pointerId !== l.pointerId) return;
      const dist = Math.hypot(e.clientX - l.startX, e.clientY - l.startY);
      if (!l.dragging) {
        // A touch that moves before the hold is a scroll; a mouse that moves far enough is a drag.
        if (l.touch) {
          if (dist > TOUCH_SLOP) end(false);
          return;
        }
        if (dist < MOUSE_SLOP) return;
        l.dragging = true;
      }
      setDrag({ source: l.source, x: e.clientX, y: e.clientY, target: targetAt(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      if (live.current && e.pointerId === live.current.pointerId) end(true, e.clientX, e.clientY);
    };
    const cancel = (e: PointerEvent) => {
      if (live.current && e.pointerId === live.current.pointerId) end(false);
    };
    // Once a touch drag is under way, the page mustn't scroll under the finger.
    const touchMove = (e: TouchEvent) => {
      if (live.current?.dragging) e.preventDefault();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', touchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', touchMove);
    };
  }, [end]);

  /** Props for something the player can drag (a roster card or a team slot). */
  const sourceProps = (source: DragSource) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || live.current) return;
      const touch = e.pointerType === 'touch';
      const l: Live = { source, pointerId: e.pointerId, touch, startX: e.clientX, startY: e.clientY, dragging: false, timer: undefined };
      if (touch) {
        l.timer = window.setTimeout(() => {
          if (live.current !== l) return;
          l.dragging = true;
          navigator.vibrate?.(15);
          setDrag({ source, x: l.startX, y: l.startY, target: targetAt(l.startX, l.startY) });
        }, TOUCH_HOLD_MS);
      }
      live.current = l;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    // The long press is for dragging, not the browser's context menu.
    onContextMenu: (e: React.MouseEvent) => {
      if (live.current?.touch) e.preventDefault();
    },
  });

  const ghost = drag
    ? createPortal(
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          {ghostOf(drag.source)}
        </div>,
        document.body,
      )
    : null;

  return {
    sourceProps,
    ghost,
    /** What's being dragged, and the key of the drop target under it (for highlighting). */
    dragging: drag?.source ?? null,
    overKey: keyOf(drag?.target ?? null),
    keyOf,
  };
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
