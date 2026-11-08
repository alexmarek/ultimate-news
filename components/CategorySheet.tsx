'use client';

import { useRef, useState, type RefObject } from 'react';
import { Check } from 'lucide-react';
import { useModalFocus } from '@/components/useModalFocus';
import { categoryStyle } from '@/lib/categoryColor';

/** Drag the handle down by this many px to dismiss. */
const DISMISS_DISTANCE = 80;

const ROW =
  'flex h-[52px] w-full items-center gap-3.5 rounded-xl px-3 text-left text-[16px] text-[var(--text)] cursor-pointer transition-colors active:bg-[var(--surface)]';

interface CategorySheetProps {
  open: boolean;
  categories: string[];
  /** The category currently applied (null = all). */
  selected: string | null;
  onSelect: (category: string | null) => void;
  onClose: () => void;
  /** The filter icon, so focus goes back to it when the sheet closes. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

/** Bottom sheet listing the categories (mobile). A real dialog: focus trapped, Esc / scrim tap / drag-down close it. */
export default function CategorySheet({ open, categories, selected, onSelect, onClose, returnFocusTo }: CategorySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useModalFocus(open, sheetRef, onClose, returnFocusTo);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  }
  function onPointerUp() {
    if (dragStart.current === null) return;
    const dismissed = dragY > DISMISS_DISTANCE;
    dragStart.current = null;
    setDragY(0);
    if (dismissed) onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-[rgb(26_28_24/0.32)] animate-scrim-in" onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-sheet-title"
        tabIndex={-1}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[20px] bg-[var(--bg)] px-2 shadow-[0_-8px_24px_rgb(26_28_24/0.12)] animate-sheet-up focus:outline-none"
      >
        {/* Drag handle */}
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center pt-1"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span aria-hidden="true" className="h-1 w-10 rounded-sm bg-[var(--border-strong)]" />
        </div>

        <div className="flex items-center justify-between pb-2 pl-3 pr-2">
          <h2 id="category-sheet-title" className="font-serif text-headline-lg font-bold text-[var(--text)]">
            Categories
          </h2>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="h-11 rounded-lg px-3 text-body-md font-semibold text-[var(--text)] underline decoration-[var(--highlight)] decoration-2 underline-offset-4 cursor-pointer"
          >
            Clear
          </button>
        </div>

        <ul className="overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <li>
            <button
              type="button"
              aria-pressed={selected === null}
              onClick={() => onSelect(null)}
              className={`${ROW} ${selected === null ? 'bg-[var(--panel)] font-semibold' : ''}`}
            >
              <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-[var(--text-muted)]" />
              <span className="flex-1 truncate">All categories</span>
              {selected === null && <Check aria-hidden="true" className="h-5 w-5 shrink-0" />}
            </button>
          </li>
          {categories.map((category) => {
            const isSelected = category === selected;
            return (
              <li key={category}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(category)}
                  className={`${ROW} ${isSelected ? 'bg-[var(--panel)] font-semibold' : ''}`}
                >
                  <span aria-hidden="true" className="cat-dot h-3.5 w-3.5 shrink-0 rounded-full" style={categoryStyle(category)} />
                  <span className="flex-1 truncate">{category}</span>
                  {isSelected && <Check aria-hidden="true" className="h-5 w-5 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
