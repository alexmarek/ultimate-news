import { Suspense } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import ThemeToggle from '@/components/ThemeToggle';
import HideReadToggle from '@/components/HideReadToggle';
import MobileHeader from '@/components/MobileHeader';

/**
 * The site header. Below `md` it is one 56px row (MobileHeader); from `md` up it is the title with
 * tagline, theme toggle, search and (on feed pages) the hide-read toggle.
 * `categories` (feed pages only) enables the mobile category filter.
 */
export default function SiteHeader({
  homeHref = '/',
  showHideRead = false,
  categories,
}: {
  homeHref?: string;
  showHideRead?: boolean;
  categories?: string[];
}) {
  return (
    <header className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-50">
      {/* Mobile */}
      <div className="md:hidden">
        <Suspense
          fallback={
            <div className="flex h-14 items-center px-4">
              <Link href={homeHref} className="font-serif text-headline-lg font-bold text-[var(--text)]">Ultimate News</Link>
            </div>
          }
        >
          <MobileHeader homeHref={homeHref} showHideRead={showHideRead} categories={categories} />
        </Suspense>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-row justify-between items-center gap-4">
            <div>
              <div className="flex items-center gap-4">
                <Link href={homeHref} className="font-serif text-[32px] leading-9 font-bold text-[var(--text)] hover:text-[var(--text-body)] transition-colors">Ultimate News</Link>
                <div className="flex items-center gap-1">
                  {showHideRead && (
                    <Suspense>
                      <HideReadToggle />
                    </Suspense>
                  )}
                  <ThemeToggle />
                </div>
              </div>
              <p className="text-[14px] text-[var(--text-muted)] mt-0.5">Curated news from sources you care about</p>
            </div>
            <div className="w-auto">
              <Suspense>
                <SearchBar />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
