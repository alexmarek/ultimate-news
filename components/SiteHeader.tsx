import { Suspense } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import ThemeToggle from '@/components/ThemeToggle';
import HideReadToggle from '@/components/HideReadToggle';

/** The site header: title (link home), theme toggle, search, and on feed pages the hide-read toggle. */
export default function SiteHeader({ homeHref = '/', showHideRead = false }: { homeHref?: string; showHideRead?: boolean }) {
  return (
    <header className="bg-[var(--surface-elevated)] border-b border-[var(--border)] sticky top-0 z-50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-4">
            <Link href={homeHref} className="font-serif text-display-3 font-bold text-[var(--text)] hover:text-[var(--text-body)] transition-colors">Ultimate News</Link>
            <div className="flex items-center gap-1">
              {showHideRead && (
                <Suspense>
                  <HideReadToggle />
                </Suspense>
              )}
              <ThemeToggle />
            </div>
            </div>
            <p className="text-[var(--text-body)] mt-1">Curated news from sources you care about</p>
          </div>
          <div className="w-full md:w-auto">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}
