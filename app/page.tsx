import { Suspense } from 'react';
import NewsCard from '@/components/NewsCard';
import SearchBar from '@/components/SearchBar';
import CategoryFilter from '@/components/CategoryFilter';
import Pagination from '@/components/Pagination';
import { prisma } from '@/lib/db';
import { AREAS } from '@/lib/types';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import KeyboardNavWrapper from '@/components/KeyboardNavWrapper';
import type { Article, Source, Cluster } from '@prisma/client';

type ArticleWithRelations = Article & { source: Source; cluster: Cluster | null };

const MAIN_CATEGORIES = [...AREAS];
const PER_PAGE = 18;
const PER_CATEGORY = 3;

function buildSearchWhere(query: string) {
  return {
    OR: [
      { title: { contains: query } },
      { summary: { contains: query } },
      { excerpt: { contains: query } },
    ],
  };
}

function categorySummary(articles: ArticleWithRelations[]): string {
  if (articles.length === 0) return 'No recent stories.';
  const headlines = articles.map((a) => a.title).join(' • ');
  return headlines;
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

  const readArticles = await prisma.articleRead.findMany({
    where: { userId: 'default' },
    select: { articleId: true },
  });
  const readArticleIds = new Set(readArticles.map((r) => r.articleId));
  const isRead = (articleId: string) => readArticleIds.has(articleId);

  const savedArticles = await prisma.articleSaved.findMany({
    where: { userId: 'default' },
    select: { articleId: true },
  });
  const savedArticleIds = new Set(savedArticles.map((s) => s.articleId));
  const isSaved = (articleId: string) => savedArticleIds.has(articleId);

  const readFilter = hideRead && readArticleIds.size > 0
    ? { id: { notIn: [...readArticleIds] } }
    : {};

  let articles: ArticleWithRelations[];
  let totalArticles: number;
  let grouped: Record<string, ArticleWithRelations[]> = {};

  if (category && category !== 'all') {
    const where: any = { primaryArea: category, ...readFilter };
    if (query) Object.assign(where, buildSearchWhere(query));
    articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { source: true, cluster: true },
    }) as ArticleWithRelations[];
    totalArticles = await prisma.article.count({ where });
    grouped = { [category]: articles };
  } else if (query) {
    const where = { ...buildSearchWhere(query), ...readFilter };
    articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { source: true, cluster: true },
    }) as ArticleWithRelations[];
    totalArticles = await prisma.article.count({ where });
    grouped = { 'Search results': articles };
  } else {
    const skip = (page - 1) * PER_CATEGORY;
    const BATCH = 50;
    const results = await Promise.all(
      MAIN_CATEGORIES.map(async (cat) => {
        const all = await prisma.article.findMany({
          where: { primaryArea: cat, ...readFilter },
          orderBy: { publishedAt: 'desc' },
          take: BATCH,
          include: { source: true, cluster: true },
        }) as ArticleWithRelations[];

        const seen = new Set<string>();
        const unique = all.filter((a) => {
          if (seen.has(a.sourceId)) return false;
          seen.add(a.sourceId);
          return true;
        });

        return unique.slice(skip, skip + PER_CATEGORY);
      })
    );

    for (let i = 0; i < MAIN_CATEGORIES.length; i++) {
      if (results[i].length > 0) {
        grouped[MAIN_CATEGORIES[i]] = results[i];
      }
    }
    articles = results.flat();

    const counts = await Promise.all(
      MAIN_CATEGORIES.map(async (cat) => {
        const sourcesWithArticles = await prisma.article.findMany({
          where: { primaryArea: cat, ...readFilter },
          select: { sourceId: true },
          distinct: ['sourceId'],
        });
        return sourcesWithArticles.length;
      })
    );
    totalArticles = Math.max(...counts, 0);
  }

  const itemsPerPage = category && category !== 'all' ? PER_PAGE : PER_CATEGORY;
  const totalPages = Math.ceil(totalArticles / itemsPerPage);
  const isSectionView = !category && !query;
  const gridClass = isSectionView
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1200px]:grid-cols-4 gap-5';

  const dbCategories = await prisma.article.findMany({
    select: { primaryArea: true },
    distinct: ['primaryArea'],
    take: 20,
  });
  const categoryNames = dbCategories.map((c) => c.primaryArea);
  if (!categoryNames.includes('Music industry')) {
    categoryNames.push('Music industry');
  }

  const allArticleIds = articles.map((a) => a.id);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="bg-[var(--surface-elevated)] border-b border-[var(--border)] sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-4">
              <h1 className="font-serif text-display-3 font-bold text-[var(--text)]">Ultimate News</h1>
              <Link
                href="/saved"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-md font-medium text-[var(--text-body)] hover:bg-[var(--surface)] transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Saved
              </Link>
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
                    <p className="text-[var(--text-muted)] text-body-md mt-1 line-clamp-2">
                      {categorySummary(catArticles)}
                    </p>
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
                <div className={gridClass}>
                  {catArticles.map((article) => (
                    <NewsCard
                      key={article.id}
                      article={article}
                      cluster={article.cluster}
                      isRead={isRead(article.id)}
                      initialSaved={isSaved(article.id)}
                      dataKbId={article.id}
                    />
                  ))}
                </div>
              </section>
            ))}
            </KeyboardNavWrapper>
          </>
        )}

        {totalPages > 1 && (
          <div className="mt-10">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              query={query}
              category={category}
            />
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="max-w-2xl mx-auto text-center text-[var(--text-body)] text-body-md">
            <p>News updated every 24 hours</p>
            <p className="mt-2">Sources: BBC, Reuters, Associated Press, and more</p>
          </div>
        </div>
      </main>
    </div>
  );
}
