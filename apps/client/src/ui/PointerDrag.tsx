// Drag-and-drop with pointer events, shared by the Roster tab (ui/RosterDrag.tsx) and the forge
// (ui/Inventory.tsx). Pointer events work with a mouse and on touch screens alike: a mouse drag starts
// after a few pixels of movement, a touch drag after a short press-and-hold (so a swipe still scrolls
// the page). Drop targets carry a `data-drop` attribute that the user of the hook parses. A drag never
// counts as a click, so a plain click still does what it did.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Movement (px) before a mouse press becomes a drag, and how long a touch must hold still. */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
const TOUCH_HOLD_MS = 280;

interface Live<S> {
  source: S;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  dragging: boolean;
  timer: number | undefined;
}

export interface PointerDragOptions<S, T> {
  /** The drop target a `data-drop` value names, given the element and the pointer (null: not one). */
  parse: (spec: string, el: HTMLElement, x: number, y: number) => T | null;
  /** A stable key for a target, for highlighting it. */
  key: (target: T) => string;
  onDrop: (source: S, target: T) => void;
  /** What follows the pointer while dragging. */
  ghost: (source: S) => ReactNode;
}

export function usePointerDrag<S, T>(options: PointerDragOptions<S, T>) {
  const live = useRef<Live<S> | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ source: S; x: number; y: number; target: T | null } | null>(null);
  const opts = useRef(options);
  opts.current = options;

  const targetAt = useCallback((x: number, y: number): T | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
    const spec = el?.dataset.drop;
    return el && spec ? opts.current.parse(spec, el, x, y) : null;
  }, []);

  const end = useCallback(
    (drop: boolean, x = 0, y = 0) => {
      const l = live.current;
      if (!l) return;
      window.clearTimeout(l.timer);
      live.current = null;
      if (l.dragging) {
        // The click that follows the pointerup belongs to the drag, not to what was dragged.
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        const target = drop ? targetAt(x, y) : null;
        if (target !== null) opts.current.onDrop(l.source, target);
      }
      setDrag(null);
    },
    [targetAt],
  );

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
  }, [end, targetAt]);

  /** Props for something the player can drag. */
  const sourceProps = (source: S) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || live.current) return;
      const touch = e.pointerType === 'touch';
      const l: Live<S> = { source, pointerId: e.pointerId, touch, startX: e.clientX, startY: e.clientY, dragging: false, timer: undefined };
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
          {options.ghost(drag.source)}
        </div>,
        document.body,
      )
    : null;

  return {
    sourceProps,
    ghost,
    /** What's being dragged. */
    dragging: drag?.source ?? null,
    /** The key of the drop target under the pointer ('' for none), for highlighting. */
    overKey: drag?.target != null ? options.key(drag.target) : '',
  };
}
