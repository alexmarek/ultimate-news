'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  query: string;
  category: string;
}

export function Pagination({ currentPage, totalPages, query, category }: PaginationProps) {
  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-1">
      <Link
        href={buildHref(currentPage - 1)}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
          currentPage <= 1
            ? 'text-gray-400 pointer-events-none'
            : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
        }`}
        aria-disabled={currentPage <= 1}
        tabIndex={currentPage <= 1 ? -1 : undefined}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 py-2 text-gray-400 text-sm">
            ...
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
              p === currentPage
                ? 'bg-primary-500 text-gray-900'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={buildHref(currentPage + 1)}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
          currentPage >= totalPages
            ? 'text-gray-400 pointer-events-none'
            : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
        }`}
        aria-disabled={currentPage >= totalPages}
        tabIndex={currentPage >= totalPages ? -1 : undefined}
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </nav>
  );
}
