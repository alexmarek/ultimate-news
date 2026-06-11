import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Newspaper, ExternalLink, ArrowLeft } from 'lucide-react';
import TimeAgo from '@/components/TimeAgo';
import MarkRead from '@/components/MarkRead';

function SourceInitial({ name }: { name: string }) {
  return (
    <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-semibold text-stone-500 leading-none">{name.charAt(0)}</span>
    </div>
  );
}

function sourceTypeLabel(editorialIndependence: string): string {
  if (editorialIndependence === 'syndicate') return 'wire';
  return editorialIndependence;
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
    include: { source: true, cluster: true },
  });

  if (!article) notFound();

  const summaryParagraphs = article.summary?.split('\n').filter(Boolean) ?? [];
  const topics = article.topics ? article.topics.split(',') : [];
  const corroborationScore = article.cluster
    ? Math.round(article.cluster.corroborationScore * 100)
    : null;

  const clusterArticles = article.clusterId
    ? await prisma.article.findMany({
        where: { clusterId: article.clusterId },
        include: { source: true },
        orderBy: [
          { source: { weight: 'desc' } },
          { publishedAt: 'desc' },
        ],
      })
    : [];

  const typeCounts: Record<string, number> = { wire: 0, national: 0, independent: 0 };
  for (const ca of clusterArticles) {
    const t = sourceTypeLabel(ca.source.editorialIndependence);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to news
        </Link>

        {/* Area badge */}
        <div className="mb-4">
          <Link
            href={`/?category=${encodeURIComponent(article.primaryArea)}`}
            className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#D3BDB0]/30 text-stone-800 hover:bg-[#D3BDB0]/50 transition-colors"
          >
            {article.primaryArea}
          </Link>
          {article.lowConfidenceTag && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
              auto-tagged
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-gray-900 leading-tight mb-5">
          {article.title}
        </h1>

        {/* Source row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{article.source.name}</span>
          </div>
          <TimeAgo date={article.publishedAt} />
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 uppercase">
            {article.lang}
          </span>
          {article.author && (
            <span className="text-sm text-gray-400">by {article.author}</span>
          )}
        </div>

        {/* Hero image */}
        {article.imageUrl && (
          <div className="relative w-full aspect-[16/9] mb-8 rounded-xl overflow-hidden bg-gray-200">
            <img
              src={`/api/img?url=${encodeURIComponent(article.imageUrl)}`}
              alt={article.imageAlt || article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Two-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {summaryParagraphs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Summary
                </h2>
                <div className="space-y-3">
                  {summaryParagraphs.map((p, i) => (
                    <p key={i} className="text-gray-700 leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {topics.map((topic) => (
                  <li
                    key={topic}
                    className="px-2 py-0.5 rounded-full text-xs bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 leading-none"
                  >
                    {topic.trim()}
                  </li>
                ))}
              </ul>
            )}

            {/* Read on source */}
            <a
              href={article.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Read on {article.source.name}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Right column — cluster panel */}
          <div className="lg:col-span-1">
            {article.cluster ? (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {/* Stats header */}
                <div className="p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Coverage
                  </h3>

                  <div className="space-y-1">
                    <span className="text-4xl font-bold text-[#2B7878] leading-none">
                      {article.cluster.totalSourceCount}
                    </span>
                    <p className="text-sm text-gray-600">
                      {article.cluster.totalSourceCount === 1
                        ? 'source covering this story'
                        : 'sources covering this story'}
                    </p>
                  </div>

                  {article.cluster.hasIndependentVoice && (
                    <p className="text-sm font-medium text-[#8D165F]">
                      {article.cluster.independentSourceCount} independent{' '}
                      {article.cluster.independentSourceCount === 1 ? 'source' : 'sources'}
                    </p>
                  )}

                  {article.cluster.totalSourceCount > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {typeCounts.wire > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600">
                          {typeCounts.wire} wire
                        </span>
                      )}
                      {typeCounts.national > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600">
                          {typeCounts.national} national
                        </span>
                      )}
                      {typeCounts.independent > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600">
                          {typeCounts.independent} independent
                        </span>
                      )}
                    </div>
                  )}

                  {corroborationScore !== null && article.cluster.totalSourceCount > 1 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-400">Corroboration</span>
                        <span className="text-[11px] font-medium text-gray-600">{corroborationScore}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2B7878] rounded-full"
                          style={{ width: `${corroborationScore}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Peer articles list */}
                {clusterArticles.length <= 1 ? (
                  <div className="p-4">
                    <p className="text-sm text-gray-400">
                      Only {article.source.name} is covering this story.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {clusterArticles.map((ca) => (
                      <Link
                        key={ca.id}
                        href={`/article/${ca.id}`}
                        className="block p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <SourceInitial name={ca.source.name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-xs font-medium text-gray-700 truncate">
                                {ca.source.name}
                              </span>
                              <span className="text-[11px] text-gray-400 flex-shrink-0">
                                {new Date(ca.publishedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                            <h4 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 mb-0.5">
                              {ca.title}
                            </h4>
                            {ca.excerpt && (
                              <p className="text-xs text-gray-400 line-clamp-1">
                                {ca.excerpt}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Coverage
                </h3>
                <p className="text-sm text-gray-400">Not clustered yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-16" />
      </div>
      <MarkRead articleId={article.id} />
    </div>
  );
}
