'use client';

import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  query?: string;
  category?: string;
}

export default function Pagination({ currentPage, totalPages, query, category }: PaginationProps) {
  const createUrl = (page: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    params.set('page', String(page));
    return `/?${params.toString()}`;
  };

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={createUrl(currentPage - 1)}
          className="px-3 py-2 rounded-lg text-body-md font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors duration-200"
        >
          Previous
        </Link>
      )}
      {pages.map((page, i) => (
        i > 0 && pages[i] - pages[i - 1] > 1 ? (
          <span key={`dots-${i}`} className="px-2 py-2 text-gray-400 text-body-md">…</span>
        ) : null
      ))}
      {pages.map((page) => (
        <Link
          key={page}
          href={createUrl(page)}
          className={`px-3 py-2 rounded-lg text-body-md font-medium transition-colors duration-200 ${
            page === currentPage
              ? 'bg-primary-500 text-gray-900 shadow-sm cursor-default pointer-events-none'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer'
          }`}
        >
          {page}
        </Link>
      ))}
      {currentPage < totalPages && (
        <Link
          href={createUrl(currentPage + 1)}
          className="px-3 py-2 rounded-lg text-body-md font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors duration-200"
        >
          Next
        </Link>
      )}
    </div>
  );
}
