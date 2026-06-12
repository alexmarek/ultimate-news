'use client';

import { X } from 'lucide-react';

const shortcuts = [
  { key: 'j', desc: 'Next article' },
  { key: 'k', desc: 'Previous article' },
  { key: 'o', desc: 'Open detail view' },
  { key: 's', desc: 'Toggle save' },
  { key: 'm', desc: 'Mark as read' },
  { key: '/', desc: 'Focus search' },
  { key: 'Esc', desc: 'Clear focus' },
  { key: '?', desc: 'Show / hide shortcuts' },
];

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-[var(--surface-elevated)] rounded-xl shadow-xl border border-[var(--border)] p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-headline-md font-semibold text-[var(--text)]">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] text-body-sm font-mono text-[var(--text-body)] border border-[var(--border)]">
                {key}
              </kbd>
              <span className="text-body-md text-[var(--text-body)]">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-body-sm text-[var(--text-faint)] mt-4">
          Press <kbd className="px-1 py-0.5 rounded bg-[var(--surface)] text-[10px] font-mono border border-[var(--border)]">?</kbd> to toggle this panel.
        </p>
      </div>
    </div>
  );
}
