import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ForYouNote from '@/components/ForYouNote';
import MarkRead from '@/components/MarkRead';
import SiteHeader from '@/components/SiteHeader';
import SummaryView from '@/components/SummaryView';
import { visibleArticleFilter } from '@/lib/config/dailyFeed';
import { SOURCES } from '@/lib/config/sources';
import { prisma } from '@/lib/db';
import { FEED_TIME_ZONE } from '@/lib/groupByDay';
import { parseSummary, stripInline } from '@/lib/summary';
import { decodeEntities, stripHtml } from '@/lib/text';

export const dynamic = 'force-dynamic';

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; } catch { return null; }
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id }, include: { source: true, cluster: true } });
  if (!article) notFound();

  const store = await cookies();
  let readIds: string[] = [];
  try { const raw = store.get('read_articles')?.value; if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) readIds = parsed.filter((item): item is string => typeof item === 'string'); } } catch {}
  const excluded = [...new Set([...readIds, article.id])];
  const feed = visibleArticleFilter();
  const earlier = { OR: [{ publishedAt: { lt: article.publishedAt } }, { publishedAt: article.publishedAt, id: { lt: article.id } }] };
  const later = { OR: [{ publishedAt: { gt: article.publishedAt } }, { publishedAt: article.publishedAt, id: { gt: article.id } }] };
  const [olderUnread, newestUnread, previous, clusterReports, latest] = await Promise.all([
    prisma.article.findFirst({ where: { ...feed, ...earlier, id: { notIn: excluded } }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], select: { id: true, title: true } }),
    prisma.article.findFirst({ where: { ...feed, id: { notIn: excluded } }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], select: { id: true, title: true } }),
    prisma.article.findFirst({ where: { ...feed, ...later }, orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true } }),
    article.clusterId ? prisma.article.findMany({ where: { clusterId: article.clusterId, id: { not: article.id } }, include: { source: true }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }] }) : Promise.resolve([]),
    prisma.article.findFirst({ where: feed, orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
  ]);
  const nextUnread = olderUnread ?? newestUnread;
  const sourceIds = new Set([article.sourceId]);
  const alsoReporting = clusterReports.filter((report) => { if (sourceIds.has(report.sourceId)) return false; sourceIds.add(report.sourceId); return true; });
  const original = safeHttpUrl(article.canonicalUrl) ?? safeHttpUrl(article.originalUrl);
  const sourceUrl = safeHttpUrl(article.source.url);
  const hasSummary = Boolean(article.summary?.trim());
  const opening = parseSummary(article.summary).find((block) => block.type === 'lead' || block.type === 'paragraph');
  const deck = opening && (opening.type === 'lead' || opening.type === 'paragraph') ? stripInline(opening.text) : decodeEntities(stripHtml(article.excerpt));
  const topics = article.topics.split(',').map((topic) => topic.trim()).filter(Boolean);
  const published = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FEED_TIME_ZONE, timeZoneName: 'short' }).format(article.publishedAt);

  return <div className="min-h-screen bg-[var(--paper)] pb-20 md:pb-0">
    <SiteHeader showHideRead categories={[...new Set(SOURCES.map((source) => source.category))]} activeCategory={article.primaryArea} updated={latest ? formatDistanceToNow(latest.fetchedAt, { addSuffix: true }) : null} stale={Boolean(latest && Date.now() - latest.fetchedAt.getTime() > 24 * 60 * 60 * 1000)} />
    <main className="mx-auto max-w-[1248px] px-4 py-7 md:px-6 md:py-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,640px)_340px] lg:justify-between lg:gap-16">
        <article className="min-w-0">
          <Link href={`/?category=${encodeURIComponent(article.primaryArea)}`} className="text-label font-bold uppercase tracking-[1.2px] text-[var(--accent)]">{article.primaryArea}</Link>
          <h1 className="mt-3 font-serif text-[34px] leading-[36px] font-semibold tracking-[-1px] text-[var(--ink)] [text-wrap:balance] md:text-h1 md:leading-[52px]">{decodeEntities(article.title)}</h1>
          {deck && <p className="mt-5 font-serif text-[20px] leading-[27px] text-[var(--body)] md:text-deck">{deck}</p>}
          <p className="mt-6 border-y border-t-[var(--ink)] border-b-[var(--rule)] py-3 text-meta text-[var(--meta)]">
            {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--ink)] underline">{article.source.name}</a> : <strong className="text-[var(--ink)]">{article.source.name}</strong>}
            {' · '}{published}{hasSummary && (article.fromTeaser ? ' · summarised by AI from a teaser' : ' · summarised by AI from the full article')}
          </p>
          {article.forYou && <div className="mt-5"><ForYouNote text={article.forYou} /></div>}
          {article.imageUrl && <figure className="mt-6"><div className="relative aspect-[3/2] w-full overflow-hidden"><Image src={`/api/img?url=${encodeURIComponent(article.imageUrl)}&v=2`} alt={article.imageAlt || decodeEntities(article.title)} fill sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), 640px" className="object-cover" priority /></div><figcaption className="mt-2 text-meta text-[var(--meta)]">Image: {article.source.name}</figcaption></figure>}
          {hasSummary && <div className="mt-7"><SummaryView summary={article.summary} omitOpening /></div>}
          {original && <a href={original} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex min-h-[52px] items-center gap-2 bg-[var(--ink)] px-6 py-3 text-ui font-semibold text-[var(--paper)]">Read the full story at {article.source.name}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>}
          {topics.length > 0 && <p className="mt-5 text-meta text-[var(--meta)]">More on {topics.map((topic, index) => <span key={`${topic}-${index}`}>{index > 0 && ', '}<Link href={`/search?q=${encodeURIComponent(topic)}`} className="text-[var(--ink)] underline">{topic}</Link></span>)}</p>}
          {(nextUnread || previous) && <nav aria-label="More stories" className="mt-9 border-t-[3px] border-[var(--ink)]">
            {nextUnread && <Link href={`/article/${nextUnread.id}`} className="grid min-h-14 grid-cols-[112px_1fr] gap-3 border-b border-[var(--rule)] py-3"><span className="text-label font-bold uppercase tracking-[1px]">Next unread</span><span className="font-serif text-row font-semibold">{decodeEntities(nextUnread.title)}</span></Link>}
            {previous && <Link href={`/article/${previous.id}`} className="grid min-h-14 grid-cols-[112px_1fr] gap-3 border-b border-[var(--rule)] py-3"><span className="text-label font-bold uppercase tracking-[1px] text-[var(--meta)]">Previous</span><span className="font-serif text-row font-semibold">{decodeEntities(previous.title)}</span></Link>}
          </nav>}
        </article>
        {alsoReporting.length > 0 && <aside aria-labelledby="also-reporting-heading" className="lg:sticky lg:top-6 lg:self-start"><section className="border-t-[3px] border-[var(--ink)] pt-3"><h2 id="also-reporting-heading" className="text-label font-bold uppercase tracking-[1.2px]">Also reporting this</h2>{alsoReporting.map((report) => <article key={report.id} className="border-b border-[var(--rule)] py-3"><h3 className="font-serif text-row font-semibold"><Link href={`/article/${report.id}`} className="hover:text-[var(--accent)]">{decodeEntities(report.title)}</Link></h3><p className="mt-1 text-meta text-[var(--meta)]"><strong className="text-[var(--ink)]">{report.source.name}</strong> · {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: FEED_TIME_ZONE }).format(report.publishedAt)}</p></article>)}</section></aside>}
      </div>
    </main>
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] border-t border-[var(--ink)] bg-[var(--paper)] md:hidden">
      {original ? <a href={original} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center justify-center gap-1 bg-[var(--ink)] px-3 text-center text-meta font-semibold text-[var(--paper)]">Read at {article.source.name}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></a> : <Link href="/" className="flex flex-1 items-center justify-center text-ui font-semibold">Back to news</Link>}
      {nextUnread && <Link href={`/article/${nextUnread.id}`} className="flex w-[132px] shrink-0 items-center justify-center px-2 text-meta font-semibold">Next unread →</Link>}
    </div>
    <MarkRead articleId={article.id} />
  </div>;
}
