'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EyeOff } from 'lucide-react';

interface CategoryFilterProps {
  categories: string[];
}

export default function CategoryFilter({ categories }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';
  const hideRead = searchParams.get('hideRead') === '1';

  const allCategories = ['all', ...categories].slice(0, 10);

  function navigate(category: string, hide: boolean) {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (category !== 'all') params.set('category', category);
    if (hide) params.set('hideRead', '1');
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  const handleCategoryChange = (category: string) => {
    navigate(category, hideRead);
  };

  const handleHideReadToggle = () => {
    navigate(selectedCategory, !hideRead);
  };

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center space-x-2 min-w-max">
        {allCategories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              selectedCategory === category
                ? 'bg-primary-500 text-gray-900 shadow-sm cursor-pointer'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer'
            }`}
          >
            {category === 'all' ? 'All Categories' : category}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button
          onClick={handleHideReadToggle}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
            hideRead
              ? 'bg-stone-200 text-stone-700 shadow-sm cursor-pointer'
              : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 cursor-pointer'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          Hide read
        </button>
      </div>
    </div>
  );
}
