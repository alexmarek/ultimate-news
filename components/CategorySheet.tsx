'use client';

import { useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '@/components/useModalFocus';
import HideReadToggle from '@/components/HideReadToggle';
import ThemeToggle from '@/components/ThemeToggle';

export default function CategorySheet({ open, categories, selected, onSelect, onClose, returnFocusTo, showHideRead }: {
  open: boolean; categories: string[]; selected: string | null; onSelect: (category: string | null) => void;
  onClose: () => void; returnFocusTo?: RefObject<HTMLElement | null>; showHideRead: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, sheetRef, onClose, returnFocusTo);
  if (!open) return null;
  const row = 'flex min-h-11 w-full items-center justify-between border-b border-[var(--rule)] py-2 text-left text-ui';
  return <div className="fixed inset-0 z-[60] md:hidden">
    <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="menu-title" tabIndex={-1} className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between"><h2 id="menu-title" className="font-serif text-brief font-semibold">Menu</h2><button type="button" onClick={onClose} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center"><X aria-hidden="true" className="h-5 w-5" /></button></div>
      <button type="button" className={row} aria-pressed={!selected || selected === 'all'} onClick={() => onSelect(null)}>Front page</button>
      {categories.map((category) => <button key={category} type="button" className={row} aria-pressed={selected === category} onClick={() => onSelect(category)}>{category}{selected === category && <span>Selected</span>}</button>)}
      <div className={`${row} gap-4`}><span>Hide read</span>{showHideRead && <HideReadToggle />}</div>
      <div className={`${row} gap-4`}><span>Dark mode</span><ThemeToggle /></div>
    </div>
  </div>;
}
