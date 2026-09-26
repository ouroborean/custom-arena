import { useState, type ReactNode } from 'react';

/** A list reorderable by drag-and-drop or by the ↑/↓ buttons (keyboard accessible). */
export function ReorderList<T>({
  items,
  keyOf,
  render,
  onChange,
  onRemove,
}: {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  onChange: (next: T[]) => void;
  onRemove?: (index: number) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x as T);
    onChange(next);
  };

  return (
    <ol className="queue-list">
      {items.map((item, i) => (
        <li
          key={keyOf(item)}
          className={`queue-item${over === i && dragFrom !== null ? ' drag-over' : ''}`}
          draggable
          onDragStart={(e) => {
            setDragFrom(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(i);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFrom !== null) move(dragFrom, i);
            setDragFrom(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDragFrom(null);
            setOver(null);
          }}
        >
          <span className="idx">{i + 1}</span>
          <span className="grow">{render(item, i)}</span>
          <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
            ↑
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Move down"
            disabled={i === items.length - 1}
            onClick={() => move(i, i + 1)}
          >
            ↓
          </button>
          {onRemove && (
            <button type="button" className="icon-btn" aria-label="Remove" onClick={() => onRemove(i)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
