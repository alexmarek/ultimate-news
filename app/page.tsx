import { Suspense } from 'react';
import type { Article, Source, Cluster } from '@prisma/client';
import { cookies } from 'next/headers';
import { formatDistanceToNow } from 'date-fns';
import AffectsYou from '@/components/AffectsYou';
import EditionNavigation from '@/components/EditionNavigation';
import KeyboardNavWrapper from '@/components/KeyboardNavWrapper';
import MarketPanel from '@/components/MarketPanel';
import MorningBrief from '@/components/MorningBrief';
import NewsFooter from '@/components/NewsFooter';
import NewsCard from '@/components/NewsCard';
import Pagination from '@/components/Pagination';
import SiteHeader from '@/components/SiteHeader';
import { archiveExclusions } from '@/lib/2026-11-13-archive-exclusions';
import { distinctStories } from '@/lib/2026-11-13-distinct-stories';
import { selectEdition } from '@/lib/2026-11-13-editions';
import { pickEditionBrief } from '@/lib/2026-11-13-brief-candidates';
import { visibleArticleFilter } from '@/lib/config/dailyFeed';
import { prisma } from '@/lib/db';
import { dayLabelParts } from '@/lib/groupByDay';
import { readMarkets } from '@/lib/markets/snapshot';

export const dynamic = 'force-dynamic';
type Story = Article & { source: Source; cluster: Cluster | null };
const PER_PAGE = 12;

function buildSearchWhere(query: string) {
  return { OR: [
    { title: { contains: query, mode: 'insensitive' } },
    { summary: { contains: query, mode: 'insensitive' } },
    { excerpt: { contains: query, mode: 'insensitive' } },
  ] };
}

export default async function Home({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string; page?: string; day?: string; hideRead?: string; forYou?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || '';
  const category = params.category || '';
  const hideRead = params.hideRead === '1';
  const forYouView = params.forYou === '1';
  const searchView = Boolean(query) || forYouView;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const now = new Date();
  const cookieStore = await cookies();
  let readIds = new Set<string>();
  try {
    const raw = cookieStore.get('read_articles')?.value;
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) readIds = new Set(parsed.filter((id): id is string => typeof id === 'string')); }
  } catch {}
  const excludedIds = archiveExclusions([], readIds, hideRead);
  const feedFilter = visibleArticleFilter(now.getTime());
  const baseWhere: any = { ...feedFilter };
  if (excludedIds.length) baseWhere.id = { notIn: excludedIds };
  if (category && category !== 'all') baseWhere.primaryArea = category;
  if (query) Object.assign(baseWhere, buildSearchWhere(query));
  if (forYouView) baseWhere.forYou = { not: null };

  // Fetch a small UTC margin around the six local calendar days; groupByDay makes the final cut.
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [categories, latest, markets, archiveStories, searchResult] = await Promise.all([
    prisma.article.findMany({ where: feedFilter, select: { primaryArea: true }, distinct: ['primaryArea'], take: 20 }),
    prisma.article.findFirst({ where: feedFilter, orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
    !searchView && !category ? readMarkets() : Promise.resolve({ etfs: null, petrol: null }),
    !searchView ? prisma.article.findMany({ where: { ...baseWhere, publishedAt: { gte: windowStart } }, orderBy: { publishedAt: 'desc' }, include: { source: true, cluster: true } }) as Promise<Story[]> : Promise.resolve([]),
    searchView ? Promise.all([
      prisma.article.findMany({ where: baseWhere, orderBy: forYouView ? [{ importance: 'desc' }, { publishedAt: 'desc' }] : { publishedAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { source: true, cluster: true } }) as Promise<Story[]>,
      prisma.article.count({ where: baseWhere }),
    ]) : Promise.resolve([[] as Story[], 0] as [Story[], number]),
  ]);
  const categoryNames = categories.map((item) => item.primaryArea);
  const edition = selectEdition(archiveStories, params.day, now);
  const newest = selectEdition(archiveStories, undefined, now).selected;
  const showBrief = !searchView && (!category || category === 'all') && Boolean(edition.selected && edition.selected.key === newest?.key);
  const dayStories = edition.selected?.items ?? [];
  const brief = showBrief && newest ? pickEditionBrief(archiveStories, newest.key, now) : [];
  const remaining = distinctStories(dayStories, brief);
  const offDuty = showBrief ? remaining.filter((story) => story.primaryArea === 'Travel' || story.primaryArea === 'Positive News') : [];
  const offDutyIds = new Set(offDuty.map((story) => story.id));
  const archive = remaining.filter((story) => !offDutyIds.has(story.id));
  const affectsStories = dayStories.filter((story) => story.forYou).sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || b.publishedAt.getTime() - a.publishedAt.getTime());
  const updated = latest ? formatDistanceToNow(latest.fetchedAt, { addSuffix: true }) : null;
  const stale = latest ? now.getTime() - latest.fetchedAt.getTime() > 24 * 60 * 60 * 1000 : false;
  const searchStories = searchResult[0];
  const totalPages = Math.ceil(searchResult[1] / PER_PAGE);
  const hasMarkets = Boolean(markets.etfs || markets.petrol);
  const displayLabel = edition.selected ? (() => { const { weekday, day, month } = dayLabelParts(edition.selected.date); return `${weekday} ${day} ${month}`; })() : '';
  const card = (story: Story, variant: 'lead' | 'row' | 'off-duty' = 'row') => <NewsCard key={story.id} article={story} cluster={story.cluster} isRead={readIds.has(story.id)} dataKbId={story.id} variant={variant} />;
  const offDutyBlock = offDuty.length > 0 && <aside aria-label="Off duty" className="border-t-[3px] border-[var(--ink)] pt-3"><h2 className="text-label font-bold uppercase tracking-[1.2px]">Off duty</h2>{offDuty.map((story) => card(story, 'off-duty'))}</aside>;

  return <div className="min-h-screen bg-[var(--bg)]">
    <SiteHeader homeHref={hideRead ? '/?hideRead=1' : '/'} showHideRead categories={categoryNames} activeCategory={category} selectedDay={params.day ? edition.selected?.key : undefined} updated={updated} stale={stale} />
    <main className="mx-auto max-w-[1248px] px-4 py-5 md:px-6 md:py-7">
      {searchView ? <>
        <h1 className="mb-4 border-t-[3px] border-[var(--ink)] pt-3 font-serif text-headline font-semibold">{forYouView ? 'Stories that affect you' : `Search results for “${query}”`}</h1>
        {searchStories.length ? <KeyboardNavWrapper articleIds={searchStories.map((story) => story.id)}>{searchStories.map((story) => card(story))}</KeyboardNavWrapper> : <p className="py-8 text-[var(--meta)]">No stories found.</p>}
        {totalPages > 1 && <div className="mt-8"><Suspense><Pagination currentPage={page} totalPages={totalPages} query={query} category={category} /></Suspense></div>}
      </> : <>
        {hasMarkets && showBrief && <div className="-mx-4 mb-6 md:hidden"><MarketPanel etfs={markets.etfs} petrol={markets.petrol} /></div>}
        <AffectsYou total={affectsStories.length} hideRead={hideRead} stories={affectsStories.slice(0, 5).map((story) => ({ id: story.id, title: story.title, forYou: story.forYou, sourceName: story.source.name }))} />
        {edition.selected ? <KeyboardNavWrapper articleIds={[...archive, ...offDuty].map((story) => story.id)}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
            <div>
              {showBrief && brief.length > 0 && <MorningBrief articles={brief} readIds={readIds} />}
              <section aria-labelledby="edition-heading" className={`${showBrief && brief.length ? 'mt-9' : ''} border-t-[3px] border-[var(--ink)] pt-3`}>
                <h2 id="edition-heading" className="font-serif text-headline font-semibold">{showBrief ? 'Also from ' : ''}{displayLabel}</h2>
                <div className="mt-2">{archive.length ? archive.map((story, index) => card(story, index === 0 ? 'lead' : 'row')) : <p className="py-4 text-ui text-[var(--meta)]">No other stories in this edition.</p>}</div>
              </section>
            </div>
            <div className="space-y-8">{showBrief && hasMarkets && <div className="hidden md:block"><MarketPanel etfs={markets.etfs} petrol={markets.petrol} /></div>}{offDutyBlock}</div>
          </div>
          <EditionNavigation newer={edition.newer} older={edition.older} category={category} hideRead={hideRead} />
        </KeyboardNavWrapper> : <p className="py-8 text-[var(--meta)]">No stories in the last six days.</p>}
      </>}
      <NewsFooter />
    </main>
  </div>;
}
