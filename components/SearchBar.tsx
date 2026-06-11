'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const category = searchParams.get('category');
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          placeholder="Search stories, topics, or sources..."
        />
        <button
          type="submit"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary-600 hover:text-primary-700 transition-colors duration-200 cursor-pointer"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
