import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

// Shown for unknown URLs and for articles that are no longer in the feed
// (the daily ingest replaces all articles, so yesterday's article links stop working).
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <p className="text-body-sm font-medium text-[var(--text-muted)] mb-2">404</p>
        <h1 className="font-serif text-headline-lg font-semibold text-[var(--text)] mb-3">This page is no longer here</h1>
        <p className="text-[var(--text-body)] mb-8">
          The feed is replaced every day, so links to older articles stop working. Today&apos;s stories are on the front page, or use the search above.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--text)] text-[var(--surface-elevated)] rounded-lg hover:bg-[var(--accent)] transition-colors duration-200 text-body-md font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Today&apos;s news
        </Link>
      </main>
    </div>
  );
}
