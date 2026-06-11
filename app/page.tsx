import { Suspense } from 'react';
import NewsCard from '@/components/NewsCard';
import SearchBar from '@/components/SearchBar';
import CategoryFilter from '@/components/CategoryFilter';
import { Pagination } from '@/components/Pagination';
import { prisma } from '@/lib/db';
import type { Article, Source, Cluster } from '@prisma/client';

type ArticleWithRelations = Article & { source: Source; cluster: Cluster | null };

const MAIN_CATEGORIES = ['World', 'Technology', 'Environment', 'Politics', 'Business', 'Music'];
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
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const category = params.category || '';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);

  let articles: ArticleWithRelations[];
  let totalArticles: number;
  let grouped: Record<string, ArticleWithRelations[]> = {};

  if (category && category !== 'all') {
    const where: any = { primaryArea: category };
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
    const where = buildSearchWhere(query);
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
          where: { primaryArea: cat },
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
      grouped[MAIN_CATEGORIES[i]] = results[i];
    }
    articles = results.flat();

    const counts = await Promise.all(
      MAIN_CATEGORIES.map(async (cat) => {
        const sourcesWithArticles = await prisma.article.findMany({
          where: { primaryArea: cat },
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
  if (!categoryNames.includes('Music')) {
    categoryNames.push('Music');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ultimate News</h1>
              <p className="text-gray-600 mt-1">Curated news from sources you care about</p>
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
            <div className="text-gray-400 mb-4">No stories yet. News will appear after the first ingest.</div>
            <div className="text-sm text-gray-500">Ingest runs every 24 hours to fetch fresh content.</div>
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([cat, catArticles]) => (
              <section key={cat} className={isSectionView ? 'mb-10' : 'mb-6'}>
                {isSectionView && (
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
                      {cat}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed line-clamp-2">
                      {categorySummary(catArticles)}
                    </p>
                  </div>
                )}
                {!isSectionView && (
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900">Latest Stories</h2>
                    <p className="text-gray-600 text-sm mt-2">
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
                    />
                  ))}
                </div>
              </section>
            ))}
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

        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="max-w-2xl mx-auto text-center text-gray-600 text-sm">
            <p>News updated every 24 hours</p>
            <p className="mt-2">Sources: BBC, Reuters, Associated Press, and more</p>
          </div>
        </div>
      </main>
    </div>
  );
}
