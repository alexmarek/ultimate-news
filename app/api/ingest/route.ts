import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Parser from 'rss-parser';
import { extractImageFromRssItem } from '@/lib/ingest/extractImage';
import { canonicalizeUrl, articleIdFromUrl } from '@/lib/ingest/canonicalize';
import { enrichArticle } from '@/lib/ai/enrich';
import { embed } from '@/lib/ai/embed';
import { AREAS } from '@/lib/types';
import { SOURCE_CONFIGS, DAILY_FEED_TARGETS } from '@/lib/config/dailyFeed';
import { discoverFeed } from '@/lib/ingest/discoverFeed';
import { recomputeClusters } from '@/lib/dedup/cluster';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  customFields: {
    item: [
      'media:content',
      'media:thumbnail',
      'media:group',
      'enclosure',
      'content:encoded',
    ],
  },
});

async function getFeedUrl(source: { id: string; feedUrl: string | null; url: string }): Promise<string | null> {
  if (source.feedUrl) return source.feedUrl;
  const discovered = await discoverFeed(source.url);
  if (discovered) {
    await prisma.source.update({
      where: { id: source.id },
      data: { feedUrl: discovered },
    });
  }
  return discovered;
}

async function seedSources() {
  const sources = [
    { id: 'propublica', name: 'ProPublica', url: 'https://www.propublica.org', feedUrl: 'https://www.propublica.org/feeds/propublica/main', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'investigative', weight: 1.0, isActive: true },
    { id: 'dw', name: 'Deutsche Welle', url: 'https://www.dw.com/en/top-stories/s-9097', feedUrl: 'https://rss.dw.com/rdf/rss-en-all', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.9, isActive: true },
    { id: 'wired', name: 'Wired', url: 'https://www.wired.com', feedUrl: 'https://www.wired.com/feed/rss', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'technology', weight: 1.0, isActive: true },
    { id: 'thehackernews', name: 'The Hacker News', url: 'https://thehackernews.com', feedUrl: 'https://feeds.feedburner.com/TheHackersNews', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'cybersecurity', weight: 0.8, isActive: true },
    { id: 'insideclimatenews', name: 'Inside Climate News', url: 'https://insideclimatenews.org', feedUrl: 'https://insideclimatenews.org/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'environment', weight: 0.85, isActive: true },
    { id: 'bbc-future-planet', name: 'BBC Future Planet', url: 'https://www.bbc.com/future-planet', feedUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'environment', weight: 0.85, isActive: true },
    { id: 'goodnewsnetwork', name: 'Good News Network', url: 'https://www.goodnewsnetwork.org', feedUrl: 'https://www.goodnewsnetwork.org/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'positive-news', weight: 0.8, isActive: true },
    { id: 'qz', name: 'Quartz', url: 'https://qz.com', feedUrl: 'https://qz.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'business', weight: 0.9, isActive: true },
    { id: 'budgettraveller', name: 'Budget Traveller', url: 'https://budgettraveller.org/blog/', feedUrl: 'https://budgettraveller.org/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'travel', weight: 0.8, isActive: true },
    { id: 'bemytravelmuse', name: 'Be My Travel Muse', url: 'https://www.bemytravelmuse.com/archives/', feedUrl: 'https://www.bemytravelmuse.com/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'travel', weight: 0.8, isActive: true },
    { id: 'telegraph-travel', name: 'The Telegraph', url: 'https://www.telegraph.co.uk/travel/', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'travel', weight: 0.9, isActive: true },
    { id: 'euobserver', name: 'EUobserver', url: 'https://euobserver.com/', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.9, isActive: true },
    { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'technology', weight: 1.0, isActive: true },
  ];

  for (const s of sources) {
    await prisma.source.upsert({
      where: { id: s.id },
      create: s,
      update: { isActive: true },
    });
  }

  // Deactivate others
  const keepIds = sources.map(s => s.id);
  await prisma.source.updateMany({
    where: { id: { notIn: keepIds } },
    data: { isActive: false },
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.INGEST_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sources = await prisma.source.findMany({ where: { isActive: true } });

  if (sources.length === 0) {
    await seedSources();
    const seeded = await prisma.source.findMany({ where: { isActive: true } });
    return runIngest(seeded);
  }

  return runIngest(sources);
}

export async function runIngest(sources: Awaited<ReturnType<typeof prisma.source.findMany>>) {
  const activeSources = sources.filter((s) => s.id in SOURCE_CONFIGS);

  if (activeSources.length === 0) {
    console.error('[ingest] No active sources found in SOURCE_CONFIGS — aborting without delete');
    return NextResponse.json({ error: 'No active sources configured' }, { status: 400 });
  }

  // Wipe all existing articles and clusters for a fresh daily feed
  console.log(`[ingest] Wiping existing data (${activeSources.length} active sources)...`);
  await prisma.articleRead.deleteMany();
  await prisma.articleSaved.deleteMany();
  await prisma.cluster.deleteMany();
  await prisma.article.deleteMany();

  let totalFetched = 0;
  let totalCreated = 0;
  let sourceErrors = 0;

  const seenArticleIds = new Set<string>();

  const allNewArticles: Array<{
    articleId: string;
    sourceId: string;
    canonicalUrl: string;
    originalUrl: string;
    title: string;
    excerpt: string;
    content: string | null;
    publishedAt: Date;
    author: string | null;
    lang: string;
    imageUrl: string | null;
    sourceName: string;
    sourceWeight: number;
    primaryArea: string;
    areas: string;
    areaConfidences: string;
    lowConfidenceTag: boolean;
    summary: string;
    topics: string;
    entities: string;
    titleEn: string | null;
    isWireOrigin: boolean;
    embedding: string | null;
  }> = [];

  // --- Phase 1: fetch, enrich, and map categories deterministically ---
  for (const source of activeSources) {
    const config = SOURCE_CONFIGS[source.id];
    if (source.ingestStrategy !== 'rss') continue;

    const feedUrl = await getFeedUrl(source);
    if (!feedUrl) continue;

    try {
      let feed: any;
      if (source.id === 'insideclimatenews') {
        const jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
        const res = await fetch(jsonUrl);
        if (!res.ok) throw new Error(`rss2json failed with status ${res.status}`);
        const data = await res.json();
        if (data.status !== 'ok') throw new Error(`rss2json error: ${data.message || 'unknown'}`);
        feed = {
          items: (data.items || []).map((item: any) => ({
            link: item.link,
            guid: item.guid || item.link,
            pubDate: item.pubDate,
            contentSnippet: item.description,
            summary: item.description,
            title: item.title,
            content: item.content || item.description,
          }))
        };
      } else {
        feed = await parser.parseURL(feedUrl);
      }

      for (const item of (feed.items || []).slice(0, config.limit)) {
        const rawUrl = item.link || item.guid || '';
        if (!rawUrl) continue;

        const canonicalUrl = await canonicalizeUrl(rawUrl);
        const articleId = articleIdFromUrl(canonicalUrl);

        const existing = await prisma.article.findUnique({ where: { canonicalUrl } });
        if (existing) continue;

        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

        // Skip articles older than 7 days
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - publishedAt.getTime() > maxAge) continue;

        const excerpt = item.contentSnippet || item.summary || '';
        const title = item.title || 'Untitled';
        const imageUrl = extractImageFromRssItem(item as unknown as Record<string, unknown>);

        const enrichment = await enrichArticle({
          sourceName: source.name,
          sourceLang: source.lang,
          title,
          excerpt,
          content: item.content || undefined,
        });

        // Determine category deterministically based on our SOURCE_CONFIGS matrix
        const primaryArea = config.category;

        const embeddingText = [title, excerpt, enrichment.summary].filter(Boolean).join(' ');
        let embeddingJson: string | null = null;
        try {
          const vec = await embed(embeddingText);
          embeddingJson = JSON.stringify(vec);
        } catch {
          // Voyage unavailable
        }

        if (seenArticleIds.has(articleId)) continue;
        seenArticleIds.add(articleId);

        allNewArticles.push({
          articleId,
          sourceId: source.id,
          canonicalUrl,
          originalUrl: rawUrl,
          title,
          excerpt,
          content: item.content || item['content:encoded'] || null,
          publishedAt,
          author: item.creator || null,
          lang: source.lang,
          imageUrl: imageUrl || null,
          sourceName: source.name,
          sourceWeight: source.weight,
          primaryArea,
          areas: enrichment.areas.map((a) => a.area).join(','),
          areaConfidences: JSON.stringify(enrichment.areas),
          lowConfidenceTag: false,
          summary: enrichment.summary,
          topics: enrichment.topics.join(','),
          entities: enrichment.entities.join(','),
          titleEn: enrichment.titleEn,
          isWireOrigin: source.isWireService,
          embedding: embeddingJson,
        });

        totalCreated++;
      }

      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), consecutiveErrors: 0, lastError: null },
      });

      totalFetched += config.limit;
    } catch (error) {
      sourceErrors++;
      await prisma.source.update({
        where: { id: source.id },
        data: {
          lastErrorAt: new Date(),
          lastError: error instanceof Error ? error.message : String(error),
          consecutiveErrors: { increment: 1 },
        },
      });
    }
  }

  // --- Phase 2: write all fetched articles to DB directly with isInDailyFeed=true ---
  let written = 0;
  for (const a of allNewArticles) {
    try {
      await prisma.article.create({
        data: {
          id: a.articleId,
          sourceId: a.sourceId,
          canonicalUrl: a.canonicalUrl,
          originalUrl: a.originalUrl,
          title: a.title,
          titleEn: a.titleEn,
          excerpt: a.excerpt,
          content: a.content,
          publishedAt: a.publishedAt,
          author: a.author,
          lang: a.lang,
          summary: a.summary,
          areas: a.areas,
          primaryArea: a.primaryArea,
          areaConfidences: a.areaConfidences,
          topics: a.topics,
          entities: a.entities,
          imageUrl: a.imageUrl,
          isPaywalled: false,
          isWireOrigin: a.isWireOrigin,
          lowConfidenceTag: a.lowConfidenceTag,
          embedding: a.embedding,
          isInDailyFeed: true,
        },
      });
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        continue;
      }
      throw e;
    }
    written++;
  }

  // --- Phase 3: compute clean statistics report for output ---
  const categoryFill: Record<string, any> = {};
  for (const [area, target] of Object.entries(DAILY_FEED_TARGETS)) {
    const count = allNewArticles.filter((a) => a.primaryArea === area).length;
    categoryFill[area] = {
      target,
      selected: count,
      shortfall: Math.max(0, target - count),
      sources: {},
    };
  }

  console.log('[ingest] daily feed written directly per source limits:', written);

  // --- Phase 4: clustering ---
  let clusterResult = null;
  try {
    clusterResult = await recomputeClusters();
    console.log(`[ingest] clustering: ${clusterResult.totalClusters} clusters, ${clusterResult.multiSourceClusters} multi-source`);
  } catch (e) {
    console.error('[ingest] clustering failed:', e instanceof Error ? e.message : String(e));
  }

  const sourceReport = activeSources.map((s) => {
    const fromSource = allNewArticles.filter((a) => a.sourceId === s.id);
    return {
      sourceId: s.id,
      name: s.name,
      fetched: fromSource.length,
      new: fromSource.length,
    };
  });

  return NextResponse.json({
    totalFetched,
    totalNew: totalCreated,
    totalEnriched: totalCreated,
    totalSelected: written,
    written,
    sourceErrors,
    categoryFill,
    deduped: 0,
    clusters: clusterResult,
    sources: sourceReport,
  });
}
