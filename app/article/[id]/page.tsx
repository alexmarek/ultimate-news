import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Newspaper, ExternalLink, ArrowLeft } from 'lucide-react';
import TimeAgo from '@/components/TimeAgo';
import MarkRead from '@/components/MarkRead';
import ToggleSave from '@/components/ToggleSave';
import ArticleImage from '@/components/ArticleImage';

function SourceInitial({ name }: { name: string }) {
  return (
    <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center flex-shrink-0">
      <span className="text-body-sm font-semibold text-[var(--text-muted)] leading-none">{name.charAt(0)}</span>
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

  const isSaved = await prisma.articleSaved.count({
    where: { userId: 'default', articleId: article.id },
  }) > 0;

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
  const wireOrigin: typeof clusterArticles = [];
  const syndicated: typeof clusterArticles = [];
  const independent: typeof clusterArticles = [];
  for (const ca of clusterArticles) {
    const t = sourceTypeLabel(ca.source.editorialIndependence);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    if (ca.source.isWireService || ca.source.editorialIndependence === 'syndicate') {
      wireOrigin.push(ca);
    } else if (ca.source.editorialIndependence === 'national') {
      syndicated.push(ca);
    } else {
      independent.push(ca);
    }
  }

  function SourceArticleCard({ ca }: { ca: (typeof clusterArticles)[number] }) {
    return (
      <Link
        href={`/article/${ca.id}`}
        className="block p-4 hover:bg-[var(--surface)] transition-colors"
      >
        <div className="flex items-start gap-2.5">
          <SourceInitial name={ca.source.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-body-sm font-medium text-[var(--text-body)] truncate">
                {ca.source.name}
              </span>
              <span className="text-body-sm text-[var(--text-faint)] flex-shrink-0">
                {new Date(ca.publishedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <h4 className="font-serif text-headline-sm font-medium text-[var(--text)] line-clamp-2 mb-0.5">
              {ca.title}
            </h4>
            {ca.excerpt && (
              <p className="text-body-sm text-[var(--text-faint)] line-clamp-1">
                {ca.excerpt}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-body-md text-[var(--text-muted)] hover:text-[var(--text)] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to news
        </Link>

        {/* Area badge */}
        <div className="mb-4">
          <Link
            href={`/?category=${encodeURIComponent(article.primaryArea)}`}
            className="inline-block px-3 py-1 rounded-full text-body-sm font-medium bg-[var(--accent-warm)]/30 text-[var(--text)] hover:bg-[var(--accent-warm)]/50 transition-colors"
          >
            {article.primaryArea}
          </Link>
          {article.lowConfidenceTag && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-body-sm bg-[var(--warning)]/20 text-[var(--warning)]">
              auto-tagged
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="font-serif text-display-3 md:text-display-2 font-semibold text-[var(--text)] mb-5">
          {article.title}
        </h1>

        {/* Source row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 text-[var(--text-faint)]" />
            <span className="text-body-md font-medium text-[var(--text-body)]">{article.source.name}</span>
          </div>
          <TimeAgo date={article.publishedAt} />
          <span className="px-2 py-0.5 rounded text-body-sm font-medium bg-[var(--surface)] text-[var(--text-body)] uppercase">
            {article.lang}
          </span>
          {article.author && (
            <span className="text-body-md text-[var(--text-faint)]">by {article.author}</span>
          )}
        </div>

        {/* Hero image */}
        {article.imageUrl && (
          <div className="max-w-xl mb-8">
            <ArticleImage
              src={`/api/img?url=${encodeURIComponent(article.imageUrl)}`}
              alt={article.imageAlt || article.title}
              sourceName={article.source.name}
              aspectRatio="16/9"
              className="rounded-xl"
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
                <h2 className="text-body-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  Summary
                </h2>
                <div className="space-y-3">
                  {summaryParagraphs.map((p, i) => (
                    <p key={i} className="text-body-lg text-[var(--text-body)]">
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
                    className="px-2 py-0.5 rounded-full text-body-sm bg-[var(--surface)] text-[var(--text)] leading-none"
                  >
                    {topic.trim()}
                  </li>
                ))}
              </ul>
            )}

            {/* Article Extract */}
            {article.content && (
              <div className="border-t border-[var(--border)] pt-6 mt-6">
                <h2 className="text-body-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  Article Extract
                </h2>
                <p className="text-body-md text-[var(--text-body)] leading-relaxed max-w-none">
                  {(() => {
                    const clean = article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    return clean.length > 1500 ? clean.slice(0, 1500) + '...' : clean;
                  })()}
                </p>
              </div>
            )}

            {/* Read on source */}
            <div className="flex items-center gap-3">
            <a
              href={article.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--text)] text-[var(--surface-elevated)] rounded-lg hover:bg-[var(--accent)] transition-colors text-body-md font-medium"
            >
              Read on {article.source.name}
              <ExternalLink className="w-4 h-4" />
            </a>
            <ToggleSave articleId={article.id} initialSaved={isSaved} variant="icon-label" />
            </div>
          </div>

          {/* Right column — cluster panel */}
          <div className="lg:col-span-1">
            {article.cluster ? (
              <div className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {/* Stats header */}
                <div className="p-4 space-y-3">
                  <h3 className="text-body-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Coverage
                  </h3>

                  <div className="space-y-1">
                    <span className="font-serif text-display-2 font-bold text-[var(--accent-3)] leading-none">
                      {article.cluster.totalSourceCount}
                    </span>
                    <p className="text-body-md text-[var(--text-body)]">
                      {article.cluster.totalSourceCount === 1
                        ? 'source covering this story'
                        : 'sources covering this story'}
                    </p>
                  </div>

                  {article.cluster.hasIndependentVoice && (
                    <p className="text-body-md font-medium text-[var(--accent-2)]">
                      {article.cluster.independentSourceCount} independent{' '}
                      {article.cluster.independentSourceCount === 1 ? 'source' : 'sources'}
                    </p>
                  )}

                  {article.cluster.totalSourceCount > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {typeCounts.wire > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-body-sm font-medium bg-[var(--surface)] text-[var(--text-body)]">
                          {typeCounts.wire} wire
                        </span>
                      )}
                      {typeCounts.national > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-body-sm font-medium bg-[var(--surface)] text-[var(--text-body)]">
                          {typeCounts.national} national
                        </span>
                      )}
                      {typeCounts.independent > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-body-sm font-medium bg-[var(--surface)] text-[var(--text-body)]">
                          {typeCounts.independent} independent
                        </span>
                      )}
                    </div>
                  )}

                  {corroborationScore !== null && article.cluster.totalSourceCount > 1 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-body-sm text-[var(--text-faint)]">Corroboration</span>
                        <span className="text-body-sm font-medium text-[var(--text-body)]">{corroborationScore}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-3)] rounded-full"
                          style={{ width: `${corroborationScore}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Peer articles list */}
                {clusterArticles.length <= 1 ? (
                  <div className="p-4">
                    <p className="text-body-md text-[var(--text-faint)]">
                      Only {article.source.name} is covering this story.
                    </p>
                  </div>
                ) : (
                  <div>
                    {wireOrigin.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                            Originating wire
                          </span>
                          <span
                            className="text-[var(--text-faint)] cursor-help"
                            title="Original reporting from a wire service (Reuters, AP, AFP). Other outlets syndicate this story — it appears verbatim across many sites."
                          >
                            &#9432;
                          </span>
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                          {wireOrigin.map((ca) => (
                            <SourceArticleCard key={ca.id} ca={ca} />
                          ))}
                        </div>
                      </div>
                    )}
                    {syndicated.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                            Syndicated coverage
                          </span>
                          <span
                            className="text-[var(--text-faint)] cursor-help"
                            title="These outlets republished the wire story without independent reporting. The content is identical or near-identical to the original wire."
                          >
                            &#9432;
                          </span>
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                          {syndicated.map((ca) => (
                            <SourceArticleCard key={ca.id} ca={ca} />
                          ))}
                        </div>
                      </div>
                    )}
                    {independent.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[var(--accent-2)] uppercase tracking-wide">
                            Independent reporting
                          </span>
                          <span
                            className="text-[var(--text-faint)] cursor-help"
                            title="These outlets produced their own original reporting on this story. Independent voices provide corroboration and reduce reliance on wire syndication."
                          >
                            &#9432;
                          </span>
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                          {independent.map((ca) => (
                            <SourceArticleCard key={ca.id} ca={ca} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-5">
                <h3 className="text-body-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Coverage
                </h3>
                <p className="text-body-md text-[var(--text-faint)]">Not clustered yet.</p>
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
