import { SOURCES } from '@/lib/config/sources';
import { KEYBOARD_SHORTCUTS } from '@/lib/2026-11-13-shortcut-definitions';

const summaryStyle = 'flex min-h-11 cursor-pointer items-center text-[var(--ink)] underline underline-offset-2';

export default function NewsFooter() {
  return <footer className="mt-8 border-t border-[var(--rule)] py-5 text-meta text-[var(--meta)]">
    <div className="flex flex-wrap items-start justify-between gap-x-6">
      <p className="max-w-xl py-3">Summaries and importance ratings are written by AI from the linked originals.</p>
      <div className="flex flex-wrap items-start gap-x-5">
        <details>
          <summary className={summaryStyle}>{SOURCES.length} sources</summary>
          <ul className="mb-4 grid gap-1 pr-6">{SOURCES.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[var(--ink)] underline">{source.name}</a></li>)}</ul>
        </details>
        <details>
          <summary className={summaryStyle}>How this page is made</summary>
          <p className="mb-4 max-w-sm pr-6">Stories are collected from the linked sources. AI writes the summaries and relevance notes from available article text or, where necessary, a teaser. Open the original source to read its reporting.</p>
        </details>
        <details>
          <summary className={summaryStyle}>Keyboard shortcuts</summary>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 pr-6">{KEYBOARD_SHORTCUTS.map(({ key, desc }) => <div key={key} className="contents"><dt><kbd className="border border-[var(--rule)] px-1.5 py-0.5 font-mono text-[var(--ink)]">{key}</kbd></dt><dd>{desc}</dd></div>)}</dl>
        </details>
      </div>
    </div>
  </footer>;
}
