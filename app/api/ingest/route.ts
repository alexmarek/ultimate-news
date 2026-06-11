import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Parser from 'rss-parser';
import { extractImageFromRssItem } from '@/lib/ingest/extractImage';
import { canonicalizeUrl, articleIdFromUrl } from '@/lib/ingest/canonicalize';
import { enrichArticle } from '@/lib/ai/enrich-simple';
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
    { id: 'wired', name: 'Wired', url: 'https://www.wired.com', feedUrl: 'https://www.wired.com/feed/rss', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'technology', weight: 1.0, isActive: true },
    { id: 'goodnewsnetwork', name: 'Good News Network', url: 'https://www.goodnewsnetwork.org', feedUrl: 'https://www.goodnewsnetwork.org/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'positive-news', weight: 0.8, isActive: true },
    { id: 'theweek', name: 'The Week', url: 'https://theweek.com', feedUrl: 'https://theweek.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.95, isActive: true },
    { id: 'qz', name: 'Quartz', url: 'https://qz.com', feedUrl: 'https://qz.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'business', weight: 0.9, isActive: true },
    { id: 'oneusefulthing', name: 'One Useful Thing', url: 'https://www.oneusefulthing.org', feedUrl: 'https://www.oneusefulthing.org/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'ai-newsletter', weight: 0.85, isActive: true },
    { id: 'fodors', name: "Fodor's Travel", url: 'https://www.fodors.com', feedUrl: 'https://www.fodors.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'travel', weight: 0.75, isActive: true },
    { id: 'washingtoninstitute', name: 'Washington Institute', url: 'https://www.washingtoninstitute.org', feedUrl: 'https://www.washingtoninstitute.org/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'policy', weight: 0.9, isActive: true },
    { id: 'propublica', name: 'ProPublica', url: 'https://www.propublica.org', feedUrl: 'https://www.propublica.org/feeds/propublica/main', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'investigative', weight: 1.0, isActive: true },
    { id: 'npr', name: 'NPR', url: 'https://www.npr.org', feedUrl: 'https://feeds.npr.org/1001/rss.xml', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.95, isActive: true },
    { id: 'poynter', name: 'Poynter', url: 'https://www.poynter.org', feedUrl: 'https://www.poynter.org/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'media', weight: 0.75, isActive: true },
    { id: 'dw', name: 'Deutsche Welle', url: 'https://www.dw.com/en/top-stories/s-9097', feedUrl: 'https://rss.dw.com/rdf/rss-en-all', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.9, isActive: true },
    { id: 'csmonitor', name: 'Christian Science Monitor', url: 'https://www.csmonitor.com', feedUrl: 'https://www.csmonitor.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.9, isActive: true },
    { id: 'nhk', name: 'NHK World Japan', url: 'https://www3.nhk.or.jp/nhkworld/en/news/list/', feedUrl: 'https://www3.nhk.or.jp/nhkworld/en/rss/index.rdf', ingestStrategy: 'rss', lang: 'en', tier: 'tier-1', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.85, isActive: true },
    { id: 'dailymaverick', name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za', feedUrl: 'https://www.dailymaverick.co.za/feed/', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.8, isActive: true },
    { id: 'ekathimerini', name: 'Kathimerini', url: 'https://www.ekathimerini.com', feedUrl: 'https://www.ekathimerini.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'news', weight: 0.75, isActive: true },
    { id: 'thehackernews', name: 'The Hacker News', url: 'https://thehackernews.com', feedUrl: 'https://feeds.feedburner.com/TheHackersNews', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'cybersecurity', weight: 0.8, isActive: true },
    { id: 'bayreuther-tagblatt', name: 'Bayreuther Tagblatt', url: 'https://www.bayreuther-tagblatt.de', feedUrl: 'https://www.bayreuther-tagblatt.de/feed/', ingestStrategy: 'rss', lang: 'de', tier: 'tier-3', editorialIndependence: 'independent', isWireService: false, contentKind: 'local-news', weight: 0.6, isActive: true },
    { id: 'sport-cz', name: 'Sport.cz', url: 'https://www.sport.cz', feedUrl: null, ingestStrategy: 'rss', lang: 'cs', tier: 'tier-2', editorialIndependence: 'national', isWireService: false, contentKind: 'sports', weight: 0.7, isActive: true },
    { id: 'aktualne-cz', name: 'Aktuálně.cz', url: 'https://www.aktualne.cz', feedUrl: 'https://www.aktualne.cz/rss/', ingestStrategy: 'rss', lang: 'cs', tier: 'tier-2', editorialIndependence: 'national', isWireService: false, contentKind: 'news', weight: 0.75, isActive: true },
    { id: 'blabbermouth', name: 'Blabbermouth.net', url: 'https://blabbermouth.net', feedUrl: 'https://blabbermouth.net/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'music-metal', weight: 0.7, isActive: true },
    { id: 'musicradar', name: 'MusicRadar', url: 'https://www.musicradar.com', feedUrl: 'https://www.musicradar.com/feeds/all', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'music-gear', weight: 0.7, isActive: true },
    { id: 'guitarworld', name: 'Guitar World', url: 'https://www.guitarworld.com', feedUrl: 'https://www.guitarworld.com/feed', ingestStrategy: 'rss', lang: 'en', tier: 'tier-2', editorialIndependence: 'independent', isWireService: false, contentKind: 'music-gear', weight: 0.7, isActive: true },
    { id: 'loot-drop', name: 'Loot Drop', url: 'https://www.loot-drop.io', feedUrl: null, ingestStrategy: 'rss', lang: 'en', tier: 'tier-3', editorialIndependence: 'independent', isWireService: false, contentKind: 'gaming', weight: 0.5, isActive: true },
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
  let total = 0;
  let created = 0;
  let errors = 0;

  for (const source of sources) {
    if (source.ingestStrategy !== 'rss') continue;

    const feedUrl = await getFeedUrl(source);
    if (!feedUrl) continue;

    try {
      const feed = await parser.parseURL(feedUrl);

      for (const item of feed.items || []) {
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

        const primaryArea = enrichment.areas[0]?.area || 'World';

        await prisma.article.create({
          data: {
            id: articleId,
            sourceId: source.id,
            canonicalUrl,
            originalUrl: rawUrl,
            title,
            titleEn: enrichment.titleEn,
            excerpt,
            content: item.content || item['content:encoded'] || null,
            publishedAt,
            author: item.creator || null,
            lang: source.lang,
            summary: enrichment.summary,
            areas: enrichment.areas.map((a) => a.area).join(','),
            primaryArea,
            areaConfidences: JSON.stringify(enrichment.areas),
            topics: enrichment.topics.join(','),
            entities: enrichment.entities.join(','),
            imageUrl: imageUrl || null,
            isPaywalled: false,
            isWireOrigin: source.isWireService,
          },
        });

        created++;
      }

      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), consecutiveErrors: 0, lastError: null },
      });

      total += feed.items?.length || 0;
    } catch (error) {
      errors++;
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

  return NextResponse.json({ total_processed: total, new_articles: created, errors });
}
