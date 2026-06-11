import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Newspaper, ExternalLink, Users, Shield, ArrowLeft } from 'lucide-react';
import TimeAgo from '@/components/TimeAgo';

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

          {/* Right column — cluster card */}
          <div className="lg:col-span-1">
            {article.cluster ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Coverage
                </h3>

                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="text-lg font-semibold text-gray-900">
                    {article.cluster.totalSourceCount}
                  </span>
                  <span className="text-gray-600">
                    {article.cluster.totalSourceCount === 1 ? 'source' : 'sources'} covering this story
                  </span>
                </div>

                {article.cluster.hasIndependentVoice && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">
                      Independent coverage
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Corroboration score</span>
                    <span className="text-xs font-medium text-gray-700">{corroborationScore}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${corroborationScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
    </div>
  );
}
