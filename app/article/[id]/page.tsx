import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Newspaper, ExternalLink, ArrowLeft, ChevronLeft } from 'lucide-react';
import TimeAgo from '@/components/TimeAgo';
import MarkRead from '@/components/MarkRead';
import ArticleImage from '@/components/ArticleImage';
import SummaryView from '@/components/SummaryView';
import ForYouNote from '@/components/ForYouNote';
import ThemeToggle from '@/components/ThemeToggle';
import { categoryColor, categoryShortLabel, categoryStyle } from '@/lib/categoryColor';
import { stripHtml, decodeEntities } from '@/lib/text';
import { countSummaryWords } from '@/lib/summary';

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

/** Reader-facing label for what kind of outlet a source is (wire / national / independent). */
function sourceOutletLabel(editorialIndependence: string, isWireService: boolean): string {
  if (isWireService || editorialIndependence === 'syndicate') return 'Wire service';
  if (editorialIndependence === 'independent') return 'Independent outlet';
  return 'National outlet';
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

  const hasSummary = countSummaryWords(article.summary) > 0;
  const topics = article.topics ? article.topics.split(',') : [];
  const firstTopic = topics[0]?.trim() ?? '';
  // The Coverage box only says something when more than one outlet covers the story.
  const showCoverage = Boolean(article.cluster && article.cluster.totalSourceCount > 1);
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
              <span className="text-body-sm text-[var(--text-muted)] flex-shrink-0">
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
              <p className="text-body-sm text-[var(--text-muted)] line-clamp-1">
                {stripHtml(ca.excerpt)}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Mobile header: back, wordmark, theme, then a 6px bar in the category colour */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)] md:hidden">
        <div className="flex h-14 items-center justify-between px-1">
          <Link href="/" aria-label="Back to news" className="flex h-11 w-11 items-center justify-center text-[var(--text)]">
            <ChevronLeft aria-hidden="true" className="h-[22px] w-[22px]" />
          </Link>
          <span className="font-serif text-headline-md font-bold text-[var(--text)]">Ultimate News</span>
          <ThemeToggle />
        </div>
      </header>
      <div aria-hidden="true" className="h-1.5 md:hidden" style={{ backgroundColor: categoryColor(article.primaryArea) }} />

      <div className="container mx-auto px-4 py-5 md:py-8 max-w-6xl">
        {/* Back link (desktop) */}
        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-1.5 text-body-md text-[var(--text-muted)] hover:text-[var(--text)] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to news
        </Link>

        {/* Category · first topic */}
        <div className="mb-4">
          <Link
            href={`/?category=${encodeURIComponent(article.primaryArea)}`}
            style={categoryStyle(article.primaryArea)}
            className="cat-fill inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-4 transition-opacity hover:opacity-80"
          >
            <strong className="shrink-0 font-semibold uppercase tracking-[0.3px]">{categoryShortLabel(article.primaryArea)}</strong>
            {firstTopic && <span className="min-w-0 truncate">· {firstTopic}</span>}
          </Link>
          {article.lowConfidenceTag && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-body-sm bg-[var(--warning)]/20 text-[var(--text)]">
              auto-tagged
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="font-serif text-[30px] leading-[35px] md:text-display-2 font-bold text-[var(--text)] mb-5">
          {decodeEntities(article.title)}
        </h1>

        {/* Source row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 text-[var(--text-faint)]" />
            <span className="text-body-md font-medium text-[var(--text-body)]">{article.source.name}</span>
          </div>
          <TimeAgo date={article.publishedAt} />
          <span className="px-2 py-0.5 rounded text-body-sm font-medium bg-[var(--surface)] text-[var(--text-body)] uppercase">
            {article.lang === 'en' ? 'en' : `${article.lang} → en`}
          </span>
          {hasSummary && (
            <span
              className="px-2 py-0.5 rounded text-body-sm font-medium bg-[var(--surface)] text-[var(--text-body)]"
              title={article.fromTeaser
                ? 'Only a teaser of this article was available, so the summary is short by necessity.'
                : 'The summary was written from the full article text.'}
            >
              {article.fromTeaser ? 'Summary from teaser' : 'Summary from full article'}
            </span>
          )}
          {article.author && (
            <span className="text-body-md text-[var(--text-muted)]">by {article.author}</span>
          )}
        </div>

        {/* Hero image */}
        {article.imageUrl && (
          <div className="max-w-xl mb-8">
            <ArticleImage
              src={`/api/img?url=${encodeURIComponent(article.imageUrl)}&v=2`}
              alt={article.imageAlt || article.title}
              sourceName={article.source.name}
              area={article.primaryArea}
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
            {hasSummary && (
              <div>
                <h2 className="text-body-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  Summary
                </h2>
                <SummaryView summary={article.summary} />
              </div>
            )}

            {article.forYou && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                <ForYouNote text={article.forYou} />
              </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {topics.map((topic) => (
                  <li
                    key={topic}
                    className="px-2.5 py-1 rounded-full text-body-sm bg-[var(--surface)] text-[var(--text-body)] leading-none"
                  >
                    {topic.trim()}
                  </li>
                ))}
              </ul>
            )}

            {/* Read on source */}
            <div className="flex flex-col gap-3 pt-2 md:w-fit">
              <a
                href={article.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-[var(--text)] px-6 text-[16px] font-semibold text-[var(--surface-elevated)] transition-opacity hover:opacity-90"
              >
                Read on {article.source.name}
                <ExternalLink aria-hidden="true" className="w-[18px] h-[18px]" />
              </a>
              {!showCoverage && (
                <p className="text-center text-body-sm text-[var(--text-muted)]">
                  Source: <span className="font-semibold text-[var(--text-body)]">{article.source.name}</span>
                  {' · '}
                  {sourceOutletLabel(article.source.editorialIndependence, article.source.isWireService)}
                </p>
              )}
            </div>
          </div>

          {/* Right column — cluster panel */}
          <div className="lg:col-span-1 empty:hidden">
            {showCoverage && article.cluster ? (
              <div className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {/* Stats header */}
                <div className="p-4 space-y-3">
                  <h3 className="text-body-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Coverage
                  </h3>

                  <div className="space-y-1">
                    <span className="font-serif text-display-2 font-bold text-[var(--text)] leading-none">
                      {article.cluster.totalSourceCount}
                    </span>
                    <p className="text-body-md text-[var(--text-body)]">
                      {article.cluster.totalSourceCount === 1
                        ? 'source covering this story'
                        : 'sources covering this story'}
                    </p>
                  </div>

                  {article.cluster.hasIndependentVoice && (
                    <p className="text-body-md font-medium text-[var(--text)]">
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
                        <span className="text-body-sm text-[var(--text-muted)]">Corroboration</span>
                        <span className="text-body-sm font-medium text-[var(--text-body)]">{corroborationScore}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--highlight)] rounded-full"
                          style={{ width: `${corroborationScore}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Peer articles list */}
                {clusterArticles.length <= 1 ? (
                  <div className="p-4">
                    <p className="text-body-md text-[var(--text-muted)]">
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
                          <span className="text-[11px] font-semibold text-[var(--text-body)] uppercase tracking-wide">
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
            ) : null}
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-16" />
      </div>
      <MarkRead articleId={article.id} />
    </div>
  );
}
