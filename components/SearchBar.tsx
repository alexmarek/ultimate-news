'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[var(--text-faint)]" />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full pl-10 pr-12 py-3 border border-[var(--border-strong)] rounded-xl bg-[var(--surface-elevated)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all duration-200"
          placeholder="Search across all sources..."
        />
        <button
          type="submit"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--accent)] hover:opacity-80 transition-colors duration-200 cursor-pointer"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
