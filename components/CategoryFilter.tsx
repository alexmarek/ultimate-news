'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { categoryStyle } from '@/lib/categoryColor';

interface CategoryFilterProps {
  categories: string[];
}

export default function CategoryFilter({ categories }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';
  const hideRead = searchParams.get('hideRead') === '1';

  const allCategories = ['all', ...categories].slice(0, 10);

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (category !== 'all') params.set('category', category);
    if (hideRead) params.set('hideRead', '1');
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : '/', { scroll: false });
    });
  };

  return (
    <div className={`w-full overflow-x-auto pb-2 transition-opacity duration-150 ${isPending ? 'opacity-50' : ''}`}>
      <div className="flex items-center space-x-2 min-w-max">
        {allCategories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            aria-pressed={selectedCategory === category}
            className={`inline-flex min-h-11 items-center gap-2 px-3.5  border text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer ${
              selectedCategory === category
                ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)] font-semibold'
                : 'bg-[var(--surface-elevated)] text-[var(--text)] hover:bg-[var(--surface)] border-[var(--border)]'
            }`}
          >
            {category !== 'all' && (
              <span aria-hidden="true" className="cat-dot h-2.5 w-2.5 shrink-0 " style={categoryStyle(category)} />
            )}
            {category === 'all' ? 'All Categories' : category}
          </button>
        ))}
      </div>
    </div>
  );
}
