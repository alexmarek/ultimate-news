'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import CategorySheet from '@/components/CategorySheet';

export default function MobileHeader({ homeHref, showHideRead, categories, date, updated, stale }: {
  homeHref: string; showHideRead: boolean; categories?: string[]; date: string; updated?: string | null; stale?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const selected = searchParams.get('category');
  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);
  function selectCategory(category: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set('category', category); else params.delete('category');
    params.delete('page');
    setMenuOpen(false);
    router.push(params.size ? `/?${params}` : '/', { scroll: false });
  }
  return <>
    {searchOpen ? <form role="search" className="flex h-[52px] items-center gap-2 border-b border-[var(--ink)] px-4" onSubmit={(e) => {
      e.preventDefault(); const q = inputRef.current?.value.trim(); if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    }}>
      <input ref={inputRef} aria-label="Search news" type="search" placeholder="Find news" className="h-11 min-w-0 flex-1 border border-[var(--rule)] px-3 text-[16px]" onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); searchRef.current?.focus(); } }} />
      <button type="button" className="flex h-11 w-11 items-center justify-center" aria-label="Close search" onClick={() => { setSearchOpen(false); searchRef.current?.focus(); }}><X className="h-5 w-5" /></button>
    </form> : <div className="flex h-[52px] items-center justify-between border-b border-[var(--ink)] px-4">
      <Link href={homeHref} className="font-serif text-[22px] font-bold leading-6">Ultimate News</Link>
      <div className="flex items-center">
        <button ref={searchRef} type="button" aria-label="Search" className="flex h-11 w-11 items-center justify-center" onClick={() => setSearchOpen(true)}><Search aria-hidden="true" className="h-5 w-5" /></button>
        <button ref={menuRef} type="button" aria-haspopup="dialog" className="min-h-11 px-2 text-ui font-semibold" onClick={() => setMenuOpen(true)}>Menu</button>
      </div>
    </div>}
    {showHideRead && <div className="flex min-h-10 items-center gap-1 border-b border-[var(--rule)] px-4 text-meta"><strong>{date}</strong>{updated && <span className={stale ? 'font-semibold text-[var(--verdict-false)]' : 'text-[var(--meta)]'}> · Updated {updated}</span>}</div>}
    <CategorySheet open={menuOpen} categories={categories ?? []} selected={selected} onSelect={selectCategory} onClose={closeMenu} returnFocusTo={menuRef} showHideRead={showHideRead} />
  </>;
}
