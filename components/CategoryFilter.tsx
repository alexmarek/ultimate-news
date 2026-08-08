'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

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
            className={`px-4 py-2 rounded-lg text-body-md font-medium whitespace-nowrap transition-all duration-200 ${
              selectedCategory === category
                ? 'bg-[var(--accent)] text-[var(--surface-elevated)] shadow-sm cursor-pointer'
                : 'bg-[var(--surface-elevated)] text-[var(--text-body)] hover:bg-[var(--surface)] border border-[var(--border)] cursor-pointer'
            }`}
          >
            {category === 'all' ? 'All Categories' : category}
          </button>
        ))}
      </div>
    </div>
  );
}
