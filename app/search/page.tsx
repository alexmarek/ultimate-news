'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useKeyboardNav } from '@/components/useKeyboardNav';
import HelpModal from '@/components/HelpModal';
import { stripHtml, decodeEntities } from '@/lib/text';
import { summaryPreview } from '@/lib/summary';
import { categoryShortLabel, categoryStyle } from '@/lib/categoryColor';
import { splitByMatches } from '@/lib/highlight';

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

/** Text with the words of the query wrapped in <mark>. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitByMatches(text, query).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : part.text))}
    </>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mode, setMode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const articleIds = results.map((r) => r.id);
  const { showHelp, setShowHelp } = useKeyboardNav(articleIds);

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
        setResults(data.results || []);
        setMode(data.mode || '');
        if (data.error && (!data.results || data.results.length === 0)) {
          setError(data.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      }
      setLoading(false);
    }
    doSearch();
  }, [query]);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-50">
        <div className="container mx-auto flex h-14 items-center gap-1 px-4 md:h-auto md:py-4 md:gap-4">
          <Link
            href="/"
            aria-label="Back to news"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center  text-[var(--text)] hover:bg-[var(--surface)] md:ml-0 md:text-[var(--text-muted)] md:hover:bg-transparent md:hover:text-[var(--text)]"
          >
            <ArrowLeft aria-hidden="true" className="w-5 h-5" />
          </Link>

          <form
            role="search"
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
                <Search aria-hidden="true" className="h-[18px] w-[18px] text-[var(--text)]" />
              </div>
              <input
                type="search"
                name="q"
                defaultValue={query}
                aria-label="Search news"
                /* 16px so iOS Safari does not zoom the page on focus */
                className="block h-11 w-full  border-2 border-[var(--highlight)] bg-[var(--surface-elevated)] pl-10 pr-3 text-[16px] text-[var(--text)] placeholder:text-[var(--text-muted)]"
                placeholder="Search across all sources..."
              />
            </div>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-8 max-w-3xl">
        {loading ? (
          <div className="text-center py-16 text-[var(--text-muted)]">Searching...</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-[var(--text)] mb-2">Search unavailable</p>
            <p className="text-body-md text-[var(--text-muted)]">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--text)] mb-2">
              {query.length >= 3
                ? `No results for "${query}"`
                : 'No articles yet.'}
            </p>
            <p className="text-body-md text-[var(--text-muted)]">
              {query.length >= 3
                ? mode === 'no-embeddings'
                  ? 'Semantic search is warming up — embeddings are being generated for existing articles.'
                  : 'Try different keywords.'
                : 'Search requires at least 3 characters.'}
            </p>
          </div>
        ) : (
          <>
            {query && (
              <div className="mb-2 md:mb-6">
                <h1 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--text-muted)] md:font-serif md:text-headline-lg md:normal-case md:tracking-normal md:text-[var(--text)]">
                  {mode === 'recent' ? 'Recent articles' : (
                    <>
                      <span className="md:hidden">{results.length} {results.length === 1 ? 'result' : 'results'}</span>
                      <span className="hidden md:inline">Results for &quot;{query}&quot;</span>
                    </>
                  )}
                </h1>
                <p className="hidden md:block text-body-md text-[var(--text-muted)] mt-1">
                  {results.length} {results.length === 1 ? 'result' : 'results'}
                  {mode === 'semantic' && ' • semantic search'}
                  {mode === 'recent' && ' • showing recent'}
                  {mode === 'no-embeddings' && ' • embeddings pending'}
                </p>
              </div>
            )}

            <ul className="md:space-y-4">
              {results.map((r) => (
                <li
                  key={r.id}
                  data-kb-id={r.id}
                  className="border-b border-[var(--border)] last:border-b-0  md:border md:bg-[var(--surface-elevated)] md:p-4 md:last:border-b md:transition-shadow"
                >
                  <div className="flex flex-col items-start gap-1.5 py-3.5 md:py-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/?category=${encodeURIComponent(r.primaryArea)}`}
                        style={categoryStyle(r.primaryArea)}
                        className="cat-fill inline-block  px-[9px] py-0.5 text-[12px] font-semibold leading-4"
                      >
                        {categoryShortLabel(r.primaryArea)}
                      </Link>
                      {r.score !== null && (
                        <span className="text-body-sm text-[var(--text-muted)]">
                          {Math.round(r.score * 100)}% match
                        </span>
                      )}
                    </div>

                    <h2 className="font-serif text-[17px] leading-[22px] font-semibold text-[var(--text)] md:text-headline-md md:leading-[22px]">
                      <Link href={`/article/${r.id}`} className="hover:underline">
                        <Highlighted text={decodeEntities(r.title)} query={query} />
                      </Link>
                    </h2>

                    <p className="text-body-sm text-[var(--text-muted)]">
                      {r.source.name} · {formatDistanceToNow(new Date(r.publishedAt), { addSuffix: true })}
                    </p>

                    {(r.summary || r.excerpt) && (
                      <p className="hidden md:block text-body-md text-[var(--text-body)] line-clamp-2">
                        {summaryPreview(r.summary) || stripHtml(r.excerpt)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
