'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, ArrowLeft, Search, ExternalLink } from 'lucide-react';
import TimeAgo from '@/components/TimeAgo';

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  summary: string;
  publishedAt: string;
  primaryArea: string;
  lang: string;
  canonicalUrl: string;
  source: { id: string; name: string; editorialIndependence: string };
  cluster: { totalSourceCount: number } | null;
  score: number | null;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mode, setMode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function doSearch() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setResults(data.results || []);
          setMode(data.mode || '');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      }
      setLoading(false);
    }
    doSearch();
  }, [query]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const q = (formData.get('q') as string)?.trim();
                if (q) {
                  const url = new URL('/search', window.location.origin);
                  url.searchParams.set('q', q);
                  window.location.href = url.toString();
                }
              }}
              className="flex-1"
            >
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Search across all sources..."
                />
              </div>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Searching...</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-2">Search unavailable</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-2">
              {query.length >= 3
                ? `No results for "${query}"`
                : 'No articles yet.'}
            </p>
            <p className="text-sm text-gray-400">
              {query.length >= 3
                ? 'Try different keywords.'
                : 'Search requires at least 3 characters.'}
            </p>
          </div>
        ) : (
          <>
            {query && (
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === 'recent' ? 'Recent articles' : `Results for "${query}"`}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {results.length} {results.length === 1 ? 'result' : 'results'}
                  {mode === 'semantic' && ' • semantic search'}
                  {mode === 'recent' && ' • showing recent'}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Area badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Link
                          href={`/?category=${encodeURIComponent(r.primaryArea)}`}
                          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#D3BDB0]/30 text-stone-700"
                        >
                          {r.primaryArea}
                        </Link>
                        {r.score !== null && (
                          <span className="text-[11px] text-gray-400">
                            {Math.round(r.score * 100)}% match
                          </span>
                        )}
                      </div>

                      {/* Headline */}
                      <Link href={`/article/${r.id}`} className="block">
                        <h2 className="text-base font-semibold text-gray-900 leading-snug mb-1 hover:text-gray-600 transition-colors">
                          {r.title}
                        </h2>
                      </Link>

                      {/* Source + time */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <div className="flex items-center gap-1">
                          <Newspaper className="w-3.5 h-3.5" />
                          <span>{r.source.name}</span>
                        </div>
                        <TimeAgo date={r.publishedAt} />
                      </div>

                      {/* Summary excerpt */}
                      {(r.summary || r.excerpt) && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {r.summary || r.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
