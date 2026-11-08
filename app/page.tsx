import { Suspense } from 'react';
import NewsCard from '@/components/NewsCard';
import CategoryFilter from '@/components/CategoryFilter';
import Pagination from '@/components/Pagination';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { formatDistanceToNow } from 'date-fns';
import KeyboardNavWrapper from '@/components/KeyboardNavWrapper';
import MasonryGrid from '@/components/MasonryGrid';
import SiteHeader from '@/components/SiteHeader';
import DayHeader from '@/components/DayHeader';
import type { Article, Source, Cluster } from '@prisma/client';
import { SOURCES } from '@/lib/config/sources';
import { visibleArticleFilter } from '@/lib/config/dailyFeed';
import MorningBrief from '@/components/MorningBrief';
import MarketPanel from '@/components/MarketPanel';
import { pickBrief } from '@/lib/brief';
import { groupByDay } from '@/lib/groupByDay';
import { readMarkets } from '@/lib/markets/snapshot';

export const dynamic = 'force-dynamic';

type ArticleWithRelations = Article & { source: Source; cluster: Cluster | null };

const PER_PAGE = 12;

function buildSearchWhere(query: string) {
  return {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { summary: { contains: query, mode: 'insensitive' } },
      { excerpt: { contains: query, mode: 'insensitive' } },
    ],
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string; hideRead?: string; forYou?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const category = params.category || '';
  const hideRead = params.hideRead === '1';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const forYouView = params.forYou === '1';

  // Read article IDs from cookie (per-user, no DB needed)
  const cookieStore = await cookies();
  let readArticleIds = new Set<string>();
  try {
    const raw = cookieStore.get('read_articles')?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) readArticleIds = new Set(parsed);
    }
  } catch {}
  const isRead = (articleId: string) => readArticleIds.has(articleId);

  const readFilter = hideRead && readArticleIds.size > 0
    ? { id: { notIn: [...readArticleIds] } }
    : {};

  // Daily feed only: configured sources, nothing older than the 14-day freshness window.
  const feedFilter = visibleArticleFilter();

  let articles: ArticleWithRelations[];
  let totalArticles: number;

  const where: any = { ...readFilter, ...feedFilter };
  if (category && category !== 'all') {
    where.primaryArea = category;
  }
  if (query) {
    Object.assign(where, buildSearchWhere(query));
  }
  if (forYouView) {
    where.forYou = { not: null };
  }

  articles = await prisma.article.findMany({
    where,
    orderBy: forYouView ? [{ importance: 'desc' }, { publishedAt: 'desc' }] : { publishedAt: 'desc' },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    include: { source: true, cluster: true },
  }) as ArticleWithRelations[];

  totalArticles = await prisma.article.count({ where });

  // Front page only: today's brief and the market panel above the archive.
  const isFrontPage = !query && (!category || category === 'all') && page === 1 && !forYouView;
  const [briefCandidates, markets] = isFrontPage
    ? await Promise.all([
        prisma.article.findMany({
          where: { ...feedFilter, importance: { not: null } },
          orderBy: [{ importance: 'desc' }, { publishedAt: 'desc' }],
          take: 40,
          include: { source: true },
        }),
        readMarkets(),
      ])
    : [[], { etfs: null, petrol: null }];
  const brief = pickBrief(briefCandidates);
  const showMarkets = Boolean(markets.etfs || markets.petrol);

  // The archive is grouped by local day. The "stories that affect you" view is ranked by
  // importance rather than date, so it stays one list.
  const dayGroups = forYouView ? [] : groupByDay(articles);

  const totalPages = Math.ceil(totalArticles / PER_PAGE);

  const dbCategories = await prisma.article.findMany({
    where: feedFilter,
    select: { primaryArea: true },
    distinct: ['primaryArea'],
    take: 20,
  });
  const categoryNames = dbCategories.map((c) => c.primaryArea);

  const allArticleIds = articles.map((a) => a.id);

  // Footer stats
  const activeSourceCount = SOURCES.length;
  const latestArticle = await prisma.article.findFirst({
    where: feedFilter,
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  });
  const lastUpdated = latestArticle
    ? formatDistanceToNow(latestArticle.fetchedAt, { addSuffix: true })
    : null;

  const renderCard = (article: ArticleWithRelations) => (
    <NewsCard
      key={article.id}
      article={article}
      cluster={article.cluster}
      isRead={isRead(article.id)}
      dataKbId={article.id}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SiteHeader homeHref={hideRead ? '/?hideRead=1' : '/'} showHideRead categories={categoryNames} />

      <main className="container mx-auto px-4 py-4 md:py-8">

        {/* On mobile the categories live in the header's filter sheet. */}
        <div className="mb-8 hidden md:block">
          <Suspense>
            <CategoryFilter categories={categoryNames} />
          </Suspense>
        </div>

        {isFrontPage && (brief.length > 0 || showMarkets) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 md:mb-12">
            {brief.length > 0 && (
              <div className={showMarkets ? 'lg:col-span-2' : 'lg:col-span-3'}>
                <MorningBrief articles={brief} readIds={readArticleIds} />
              </div>
            )}
            {showMarkets && (
              <div className={brief.length > 0 ? '' : 'lg:col-span-3'}>
                <MarketPanel etfs={markets.etfs} petrol={markets.petrol} />
              </div>
            )}
          </div>
        )}

        {articles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-muted)] mb-4">No stories yet. News will appear after the first ingest.</div>
            <div className="text-body-md text-[var(--text-muted)]">Ingest runs every 24 hours to fetch fresh content.</div>
          </div>
        ) : (
          <KeyboardNavWrapper articleIds={allArticleIds}>
            {forYouView ? (
              <section className="mb-6">
                <div className="mb-6">
                  <h2 className="font-serif text-display-3 font-semibold text-[var(--text)]">Stories that affect you</h2>
                  <p className="text-[var(--text-body)] text-body-md mt-2">Ranked by how much they matter to you (AI inference)</p>
                </div>
                <MasonryGrid>{articles.map(renderCard)}</MasonryGrid>
              </section>
            ) : (
              dayGroups.map((group) => (
                <section key={group.key} aria-labelledby={`day-${group.key}`} className="mb-10">
                  <DayHeader group={group} headingId={`day-${group.key}`} />
                  <MasonryGrid>{group.items.map(renderCard)}</MasonryGrid>
                </section>
              ))
            )}
          </KeyboardNavWrapper>
        )}

        {totalPages > 1 && (
          <div className="mt-10">
            <Suspense>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                query={query}
                category={category}
              />
            </Suspense>
            <p className="mt-3 text-center text-body-sm text-[var(--text-muted)]">Page {page} of {totalPages}</p>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="max-w-2xl mx-auto text-center text-[var(--text-body)] text-body-md">
            {lastUpdated && <p>Last updated {lastUpdated}</p>}
            <p className="mt-2">{activeSourceCount} sources across {categoryNames.length} categories</p>
          </div>
        </div>
      </main>
    </div>
  );
}
