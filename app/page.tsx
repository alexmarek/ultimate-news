import { Suspense } from 'react';
import NewsCard from '@/components/NewsCard';
import SearchBar from '@/components/SearchBar';
import CategoryFilter from '@/components/CategoryFilter';
import Pagination from '@/components/Pagination';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import KeyboardNavWrapper from '@/components/KeyboardNavWrapper';
import MasonryGrid from '@/components/MasonryGrid';
import ThemeToggle from '@/components/ThemeToggle';
import HideReadToggle from '@/components/HideReadToggle';
import type { Article, Source, Cluster } from '@prisma/client';

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
  searchParams: Promise<{ q?: string; category?: string; page?: string; hideRead?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const category = params.category || '';
  const hideRead = params.hideRead === '1';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);

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

  const feedFilter = { isInDailyFeed: true };

  let articles: ArticleWithRelations[];
  let totalArticles: number;

  const where: any = { ...readFilter, ...feedFilter };
  if (category && category !== 'all') {
    where.primaryArea = category;
  }
  if (query) {
    Object.assign(where, buildSearchWhere(query));
  }

  articles = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    include: { source: true, cluster: true },
  }) as ArticleWithRelations[];

  totalArticles = await prisma.article.count({ where });

  const feedTitle = category && category !== 'all'
    ? category
    : query
      ? `Search: ${query}`
      : 'Daily Feed';

  const grouped = { [feedTitle]: articles };

  const totalPages = Math.ceil(totalArticles / PER_PAGE);
  const isSectionView = false; // Always render unified paginated archive view
  const gridClass = '';

  const dbCategories = await prisma.article.findMany({
    where: { isInDailyFeed: true },
    select: { primaryArea: true },
    distinct: ['primaryArea'],
    take: 20,
  });
  const categoryNames = dbCategories.map((c) => c.primaryArea);

  const allArticleIds = articles.map((a) => a.id);

  // Footer stats
  const activeSourceCount = await prisma.source.count({ where: { isActive: true } });
  const latestArticle = await prisma.article.findFirst({
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  });
  const lastUpdated = latestArticle
    ? formatDistanceToNow(latestArticle.fetchedAt, { addSuffix: true })
    : null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="bg-[var(--surface-elevated)] border-b border-[var(--border)] sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-4">
              <Link href={hideRead ? '/?hideRead=1' : '/'} className="font-serif text-display-3 font-bold text-[var(--text)] hover:text-[var(--text-body)] transition-colors">Ultimate News</Link>
              <div className="flex items-center gap-1">
                <Suspense>
                  <HideReadToggle />
                </Suspense>
                <ThemeToggle />
              </div>
              </div>
              <p className="text-[var(--text-body)] mt-1">Curated news from sources you care about</p>
            </div>
            <div className="w-full md:w-auto">
              <Suspense>
                <SearchBar />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">

        <div className="mb-8">
          <Suspense>
            <CategoryFilter categories={categoryNames} />
          </Suspense>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-faint)] mb-4">No stories yet. News will appear after the first ingest.</div>
            <div className="text-body-md text-[var(--text-muted)]">Ingest runs every 24 hours to fetch fresh content.</div>
          </div>
        ) : (
          <>
            <KeyboardNavWrapper articleIds={allArticleIds}>
            {Object.entries(grouped).map(([cat, catArticles]) => (
              <section key={cat} className={isSectionView ? 'mb-10' : 'mb-6'}>
                {isSectionView && (
                  <div className="mb-4">
                    <h2 className="font-serif text-headline-md font-semibold text-[var(--text)] uppercase tracking-wide">
                      {cat}
                    </h2>
                  </div>
                )}
                {!isSectionView && (
                  <div className="mb-6">
                    <h2 className="font-serif text-display-3 font-semibold text-[var(--text)]">Latest Stories</h2>
                    <p className="text-[var(--text-body)] text-body-md mt-2">
                      {category && category !== 'all'
                        ? `Page ${page} of ${totalPages} • ${category}`
                        : `Page ${page} of ${totalPages}`}
                    </p>
                  </div>
                )}
                <MasonryGrid>
                  {catArticles.map((article) => (
                    <NewsCard
                      key={article.id}
                      article={article}
                      cluster={article.cluster}
                      isRead={isRead(article.id)}
                      dataKbId={article.id}
                    />
                  ))}
                </MasonryGrid>
              </section>
            ))}
            </KeyboardNavWrapper>
          </>
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
