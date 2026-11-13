import { Suspense } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import ThemeToggle from '@/components/ThemeToggle';
import HideReadToggle from '@/components/HideReadToggle';
import MobileHeader from '@/components/MobileHeader';
import { FEED_TIME_ZONE } from '@/lib/groupByDay';

export default function SiteHeader({ homeHref = '/', showHideRead = false, categories, activeCategory, selectedDay, updated, stale = false }: {
  homeHref?: string; showHideRead?: boolean; categories?: string[]; activeCategory?: string; selectedDay?: string; updated?: string | null; stale?: boolean;
}) {
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FEED_TIME_ZONE }).format(new Date());
  const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: FEED_TIME_ZONE }).format(new Date());
  const sections = [
    ['World', 'World News'], ['Business', 'Business'], ['Technology', 'Technology'],
    ['Science', 'Science'], ['Environment', 'Environment'], ['Good news', 'Positive News'], ['Travel', 'Travel'],
  ];
  const current = 'shadow-[inset_0_-3px_0_var(--accent)]';
  return <header className="bg-[var(--paper)] text-[var(--ink)]">
    <div className="md:hidden"><Suspense fallback={<div className="h-[52px] px-4 font-serif text-[22px]">Ultimate News</div>}><MobileHeader homeHref={homeHref} showHideRead={showHideRead} categories={categories} date={shortDate} updated={updated} stale={stale} /></Suspense></div>
    <div className="mx-auto hidden max-w-[1248px] px-6 md:block">
      <div className="flex min-h-[88px] items-center justify-between gap-6 py-4">
        <div className="min-w-0 flex-1 text-meta"><p className="font-semibold">{date}</p>{updated && <p className={stale ? 'font-semibold text-[var(--verdict-false)]' : 'text-[var(--meta)]'}>Updated {updated}</p>}</div>
        <Link href={homeHref} className="font-serif text-wordmark font-bold tracking-[-0.5px]">Ultimate News</Link>
        <div className="flex flex-1 items-center justify-end gap-3">{showHideRead && <Suspense><HideReadToggle /></Suspense>}<ThemeToggle /><Suspense><SearchBar /></Suspense></div>
      </div>
      <nav aria-label="Sections" className="flex min-h-11 flex-wrap items-center gap-x-6 border-t border-b-[3px] border-[var(--ink)] border-b-double text-meta font-semibold">
        <Link className={`flex min-h-11 items-center hover:text-[var(--accent)] ${!activeCategory || activeCategory === 'all' ? current : ''}`} href={homeHref} aria-current={!activeCategory || activeCategory === 'all' ? 'page' : undefined}>Front page</Link>
        {sections.map(([label, value]) => { const params = new URLSearchParams({ category: value }); if (homeHref.includes('hideRead=1')) params.set('hideRead', '1'); if (selectedDay) params.set('day', selectedDay); return <Link key={value} className={`flex min-h-11 items-center hover:text-[var(--accent)] ${activeCategory === value ? current : ''}`} href={`/?${params}`} aria-current={activeCategory === value ? 'page' : undefined}>{label}</Link>; })}
      </nav>
    </div>
  </header>;
}
