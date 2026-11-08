'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import HideReadToggle from '@/components/HideReadToggle';
import ThemeToggle from '@/components/ThemeToggle';
import CategorySheet from '@/components/CategorySheet';

const ICON_BASE =
  'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface)] active:bg-[var(--surface)] cursor-pointer';
/** Search, filter and close are primary actions (full ink); hide-read and theme are quieter. */
const ICON_BUTTON = `${ICON_BASE} text-[var(--text)]`;

interface MobileHeaderProps {
  homeHref: string;
  showHideRead: boolean;
  /** Feed pages pass the category names; without them there is no filter button. */
  categories?: string[];
}

/**
 * The header below the `md` breakpoint: one 56px row (wordmark + Search, Filter, Hide read, Theme),
 * which swaps to a full-width search field, plus a "Showing [Category ×]" strip while a filter is on.
 */
export default function MobileHeader({ homeHref, showHideRead, categories }: MobileHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreSearchFocus = useRef(false);

  const rawCategory = searchParams.get('category');
  const activeCategory = rawCategory && rawCategory !== 'all' ? rawCategory : null;
  const canFilter = Boolean(categories && categories.length > 0);

  // Focus the field when it opens; give focus back to the Search icon when it closes.
  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    } else if (restoreSearchFocus.current) {
      restoreSearchFocus.current = false;
      searchButtonRef.current?.focus();
    }
  }, [searchOpen]);

  const closeSearch = useCallback(() => {
    restoreSearchFocus.current = true;
    setSearchOpen(false);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function selectCategory(category: string | null) {
    // Same params as the desktop CategoryFilter: keep q and hideRead, replace category.
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (searchParams.get('hideRead') === '1') params.set('hideRead', '1');
    const qs = params.toString();
    setSheetOpen(false);
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }

  return (
    <>
      {searchOpen ? (
        <form role="search" onSubmit={submitSearch} className="flex h-14 items-center gap-1 px-4">
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              ref={inputRef}
              type="search"
              name="q"
              aria-label="Search news"
              placeholder="Find news"
              autoComplete="off"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  closeSearch();
                }
              }}
              /* 16px font so iOS Safari does not zoom the page on focus */
              className="h-11 w-full rounded-xl border-2 border-[var(--highlight)] bg-[var(--surface-elevated)] pl-10 pr-3 text-[16px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>
          <button type="button" onClick={closeSearch} aria-label="Close search" className={ICON_BUTTON}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href={homeHref} className="min-w-0 truncate font-serif text-headline-lg font-bold text-[var(--text)]">
            Ultimate News
          </Link>
          <div className="-mr-2 flex shrink-0 items-center">
            <button ref={searchButtonRef} type="button" onClick={() => setSearchOpen(true)} aria-label="Search" className={ICON_BUTTON}>
              <Search aria-hidden="true" className="h-5 w-5" />
            </button>
            {canFilter && (
              <button
                ref={filterButtonRef}
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="Filter categories"
                aria-haspopup="dialog"
                className={ICON_BUTTON}
              >
                <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
                {activeCategory && (
                  <span aria-hidden="true" className="absolute right-[7px] top-2 h-[11px] w-[11px] rounded-full border-2 border-[var(--bg)] bg-[var(--highlight)] box-content" />
                )}
              </button>
            )}
            {showHideRead && <HideReadToggle />}
            <ThemeToggle />
          </div>
        </div>
      )}

      {canFilter && activeCategory && !searchOpen && (
        <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2.5 text-body-sm text-[var(--text-muted)]">
          <span>Showing</span>
          <button
            type="button"
            onClick={() => selectCategory(null)}
            aria-label={`Clear category filter: ${activeCategory}`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--highlight)] py-1 pl-3 pr-2 text-body-sm font-semibold text-[var(--ink)] cursor-pointer"
          >
            {activeCategory}
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {canFilter && (
        <CategorySheet
          open={sheetOpen}
          categories={categories!}
          selected={activeCategory}
          onSelect={selectCategory}
          onClose={closeSheet}
          returnFocusTo={filterButtonRef}
        />
      )}
    </>
  );
}
