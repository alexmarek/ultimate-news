'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '@/components/useModalFocus';
import { KEYBOARD_SHORTCUTS } from '@/lib/2026-11-13-shortcut-definitions';

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, modalRef, onClose);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
    <div aria-hidden="true" className="absolute inset-0 bg-black/30" />
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" tabIndex={-1} className="relative mx-4 w-full max-w-sm border border-[var(--border)] bg-[var(--surface-elevated)] p-6" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 id="shortcuts-title" className="font-serif text-headline-md font-semibold text-[var(--text)]">Keyboard shortcuts</h2><button type="button" aria-label="Close keyboard shortcuts" onClick={onClose} className="flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"><X aria-hidden="true" className="h-5 w-5" /></button></div>
      <div className="space-y-2">{KEYBOARD_SHORTCUTS.map(({ key, desc }) => <div key={key} className="flex items-center justify-between"><kbd className="border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-body-sm text-[var(--text-body)]">{key}</kbd><span className="text-body-md text-[var(--text-body)]">{desc}</span></div>)}</div>
      <p className="mt-4 text-body-sm text-[var(--text-muted)]">Press <kbd className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono text-[10px]">?</kbd> to toggle this panel.</p>
    </div>
  </div>;
}
