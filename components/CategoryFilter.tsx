'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EyeOff, Shield } from 'lucide-react';

interface CategoryFilterProps {
  categories: string[];
}

export default function CategoryFilter({ categories }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';
  const hideRead = searchParams.get('hideRead') === '1';
  const independentOnly = searchParams.get('independentOnly') === '1';

  const allCategories = ['all', ...categories].slice(0, 10);

  function navigate(category: string, hide: boolean, independent: boolean) {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (category !== 'all') params.set('category', category);
    if (hide) params.set('hideRead', '1');
    if (independent) params.set('independentOnly', '1');
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  const handleCategoryChange = (category: string) => {
    navigate(category, hideRead, independentOnly);
  };

  const handleHideReadToggle = () => {
    navigate(selectedCategory, !hideRead, independentOnly);
  };

  const handleIndependentToggle = () => {
    navigate(selectedCategory, hideRead, !independentOnly);
  };

  return (
    <div className="w-full overflow-x-auto pb-2">
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
        <div className="w-px h-6 bg-[var(--border)] mx-1" />
        <button
          onClick={handleIndependentToggle}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-md font-medium whitespace-nowrap transition-all duration-200 ${
            independentOnly
              ? 'bg-[var(--accent-2)]/20 text-[var(--accent-2)] shadow-sm cursor-pointer'
              : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:bg-[var(--surface)] border border-[var(--border)] cursor-pointer'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[var(--accent-2)]" />
          Independent only
        </button>
        <button
          onClick={handleHideReadToggle}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-md font-medium whitespace-nowrap transition-all duration-200 ${
            hideRead
              ? 'bg-[var(--border)] text-[var(--text-body)] shadow-sm cursor-pointer'
              : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:bg-[var(--surface)] border border-[var(--border)] cursor-pointer'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          Hide read
        </button>
      </div>
    </div>
  );
}
