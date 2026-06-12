import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Parser from 'rss-parser';
import { extractImageFromRssItem } from '@/lib/ingest/extractImage';
import { canonicalizeUrl, articleIdFromUrl } from '@/lib/ingest/canonicalize';
import { enrichArticle } from '@/lib/ai/enrich-simple';
import { embed } from '@/lib/ai/embed';
import { AREAS } from '@/lib/types';
import { discoverFeed } from '@/lib/ingest/discoverFeed';

const parser = new Parser({
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

// Category targets: how many articles to keep per category each ingest
const CATEGORY_TARGETS: Record<string, number> = {
  'World News': 10,
  'Music': 4,
  'Sport': 4,
  'Business': 4,
  'Technology': 10,
  'Environment': 6,
  'Positive News': 6,
  'Travel': 4,
};

const PER_SOURCE_FETCH = 15; // Fetch more than needed so we have variety to pick from

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
    { id: 'npr', name: 'NPR', url: 'https://www.npr.org', feedUrl: 'https://feeds.npr.org/1001/rss.xml', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.95, isActive: true },
    { id: 'dw', name: 'Deutsche Welle', url: 'https://www.dw.com/en/top-stories/s-9097', feedUrl: 'https://rss.dw.com/rdf/rss-en-all', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.9, isActive: true },
    { id: 'blabbermouth', name: 'Blabbermouth.net', url: 'https://blabbermouth.net', feedUrl: 'https://blabbermouth.net/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'music-metal', weight: 0.7, isActive: true },
    { id: 'musicradar', name: 'MusicRadar', url: 'https://www.musicradar.com', feedUrl: 'https://www.musicradar.com/feeds/all', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'music-gear', weight: 0.7, isActive: true },
    { id: 'sport-cz', name: 'Sport.cz', url: 'https://www.sport.cz', feedUrl: null, ingestStrategy: 'rss', lang: 'cs', tier: 'tier-2', editorialIndependence: 'national', isWireService: false, contentKind: 'sports', weight: 0.7, isActive: true },
    { id: 'wired', name: 'Wired', url: 'https://www.wired.com', feedUrl: 'https://www.wired.com/feed/rss', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'technology', weight: 1.0, isActive: true },
    { id: 'oneusefulthing', name: 'One Useful Thing', url: 'https://www.oneusefulthing.org', feedUrl: 'https://www.oneusefulthing.org/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'ai-newsletter', weight: 0.85, isActive: true },
    { id: 'thehackernews', name: 'The Hacker News', url: 'https://thehackernews.com', feedUrl: 'https://feeds.feedburner.com/TheHackersNews', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'cybersecurity', weight: 0.8, isActive: true },
    { id: 'insideclimatenews', name: 'Inside Climate News', url: 'https://insideclimatenews.org', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'environment', weight: 0.85, isActive: true },
    { id: 'bbc-future-planet', name: 'BBC Future Planet', url: 'https://www.bbc.com/future-planet', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'environment', weight: 0.85, isActive: true },
    { id: 'goodnewsnetwork', name: 'Good News Network', url: 'https://www.goodnewsnetwork.org', feedUrl: 'https://www.goodnewsnetwork.org/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'positive-news', weight: 0.8, isActive: true },
    { id: 'smiley-movement', name: 'Smiley Movement', url: 'https://smileymovement.org', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'positive-news', weight: 0.75, isActive: true },
    { id: 'qz', name: 'Quartz', url: 'https://qz.com', feedUrl: 'https://qz.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'business', weight: 0.9, isActive: true },
    { id: 'yahoo-finance', name: 'Yahoo Finance', url: 'https://finance.yahoo.com', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'business', weight: 0.85, isActive: true },
    { id: 'fodors', name: "Fodor's Travel", url: 'https://www.fodors.com', feedUrl: 'https://www.fodors.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'travel', weight: 0.75, isActive: true },
    { id: 'lonelyplanet', name: 'Lonely Planet', url: 'https://www.lonelyplanet.com', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'travel', weight: 0.8, isActive: true },
  ];

  for (const s of sources) {
    await prisma.source.create({ data: s });
  }
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

async function runIngest(sources: Awaited<ReturnType<typeof prisma.source.findMany>>) {
  let totalFetched = 0;
  let totalCreated = 0;
  let sourceErrors = 0;

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

  // --- Phase 1: fetch all sources, enrich all new articles ---
  for (const source of sources) {
    if (source.ingestStrategy !== 'rss') continue;

    const feedUrl = await getFeedUrl(source);
    if (!feedUrl) continue;

    try {
      const feed = await parser.parseURL(feedUrl);

      for (const item of (feed.items || []).slice(0, PER_SOURCE_FETCH)) {
        const rawUrl = item.link || item.guid || '';
        if (!rawUrl) continue;

        const canonicalUrl = await canonicalizeUrl(rawUrl);
        const articleId = articleIdFromUrl(canonicalUrl);

        const existing = await prisma.article.findUnique({ where: { canonicalUrl } });
        if (existing) continue;

        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
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

        const topArea = enrichment.areas[0];
        const confidenceThreshold = 0.65;
        let primaryArea: string;
        let lowConfidenceTag = false;

        if (!topArea || topArea.confidence < confidenceThreshold || !AREAS.includes(topArea.area as never)) {
          primaryArea = AREAS[0];
          lowConfidenceTag = true;
        } else {
          primaryArea = topArea.area;
        }

        const embeddingText = [title, excerpt, enrichment.summary].filter(Boolean).join(' ');
        let embeddingJson: string | null = null;
        try {
          const vec = await embed(embeddingText);
          embeddingJson = JSON.stringify(vec);
        } catch {
          // Voyage unavailable
        }

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
          lowConfidenceTag,
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

      totalFetched += feed.items?.length || 0;
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

  // --- Phase 2: per-category selection with source variety ---
  const byCategory = new Map<string, typeof allNewArticles>();
  for (const a of allNewArticles) {
    const cat = a.primaryArea;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(a);
  }

  const selected: typeof allNewArticles = [];
  const selectedIds = new Set<string>();
  const summaryLines: string[] = [];

  for (const area of AREAS) {
    const target = CATEGORY_TARGETS[area] ?? 4;
    const pool = (byCategory.get(area) || []).filter((a) => !selectedIds.has(a.articleId));
    if (pool.length === 0) continue;

    // Group by source, sort each group by source weight desc
    const bySource = new Map<string, typeof pool>();
    for (const a of pool) {
      if (!bySource.has(a.sourceId)) bySource.set(a.sourceId, []);
      bySource.get(a.sourceId)!.push(a);
    }

    // Source-specific focus: Sport.cz prioritises Czech football/tennis
    const sourceEntries = [...bySource.entries()];
    // Round-robin: take 1 from each source, repeat until target
    const picked: typeof pool = [];
    let round = 0;
    while (picked.length < target && sourceEntries.length > 0) {
      for (const [, articles] of sourceEntries) {
        if (picked.length >= target) break;
        if (round < articles.length) {
          picked.push(articles[round]);
        }
      }
      round++;
      if (round >= Math.max(...sourceEntries.map(([, a]) => a.length))) break;
    }

    for (const a of picked) {
      if (selectedIds.has(a.articleId)) continue;
      selected.push(a);
      selectedIds.add(a.articleId);
    }

    summaryLines.push(`  ${area}: ${picked.length}/${target} from ${bySource.size} source(s)`);
  }

  // --- Phase 3: write selected articles to DB ---
  let written = 0;
  for (const a of selected) {
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
      },
    });
    written++;
  }

  console.log('[ingest] category summary:');
  for (const line of summaryLines) console.log(line);
  console.log(`[ingest] wrote ${written}/${totalCreated} enriched articles across ${byCategory.size} categories`);

  return NextResponse.json({
    total_fetched: totalFetched,
    enriched: totalCreated,
    written,
    source_errors: sourceErrors,
    summary: summaryLines,
  });
}
