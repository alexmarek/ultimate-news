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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.INGEST_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sources = await prisma.source.findMany({ where: { isActive: true } });
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
