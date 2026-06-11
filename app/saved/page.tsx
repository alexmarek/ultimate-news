import { Suspense } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ArrowLeft, Newspaper } from 'lucide-react';
import TimeAgo from '@/components/TimeAgo';
import ToggleSave from '@/components/ToggleSave';

const USER_ID = 'default';

export default function SavedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <SavedContent />
    </Suspense>
  );
}

async function SavedContent() {
  const saved = await prisma.articleSaved.findMany({
    where: { userId: USER_ID },
    orderBy: { savedAt: 'desc' },
    include: {
      article: {
        include: { source: true, cluster: { select: { totalSourceCount: true } } },
      },
    },
  });

  const articles = saved.map((s) => s.article);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Back to news
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">Saved articles</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No saved articles yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Bookmark articles to read them later.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/?category=${encodeURIComponent(a.primaryArea)}`}
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#D3BDB0]/30 text-stone-700 mb-1.5"
                    >
                      {a.primaryArea}
                    </Link>
                    <Link href={`/article/${a.id}`} className="block">
                      <h2 className="text-base font-semibold text-gray-900 leading-snug mb-1 hover:text-gray-600 transition-colors">
                        {a.title}
                      </h2>
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Newspaper className="w-3.5 h-3.5" />
                        <span>{a.source.name}</span>
                      </div>
                      <TimeAgo date={a.publishedAt} />
                    </div>
                    {a.summary && (
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                        {a.summary}
                      </p>
                    )}
                  </div>
                  <ToggleSave articleId={a.id} initialSaved={true} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
