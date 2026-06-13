// scripts/manual-ingest.ts
// Runs the full ingest pipeline locally against the production database.
// No auth required — connects directly via DATABASE_URL.
//
// Usage:
//   DATABASE_URL="..." npx tsx scripts/manual-ingest.ts

import { prisma } from '@/lib/db';
import Parser from 'rss-parser';
import { extractImageFromRssItem } from '@/lib/ingest/extractImage';
import { canonicalizeUrl, articleIdFromUrl } from '@/lib/ingest/canonicalize';
import { enrichArticle } from '@/lib/ai/enrich';
import { embed } from '@/lib/ai/embed';
import { AREAS } from '@/lib/types';
import { DAILY_FEED_TARGETS } from '@/lib/config/dailyFeed';
import { selectForDailyFeed } from '@/lib/ingest/selectForDailyFeed';
import { recomputeClusters } from '@/lib/dedup/cluster';
import { discoverFeed } from '@/lib/ingest/discoverFeed';

const PER_SOURCE_FETCH = 10;

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'media:group', 'enclosure', 'content:encoded'],
  },
});

async function getFeedUrl(source: { id: string; feedUrl: string | null; url: string }): Promise<string | null> {
  if (source.feedUrl) return source.feedUrl;
  const discovered = await discoverFeed(source.url);
  if (discovered) {
    await prisma.source.update({ where: { id: source.id }, data: { feedUrl: discovered } });
  }
  return discovered;
}

async function main() {
  console.log('Starting manual ingest...\n');

  const sources = await prisma.source.findMany({ where: { isActive: true } });
  console.log(`Active sources: ${sources.length}\n`);

  let totalCreated = 0;
  const allNewArticles: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    if (source.ingestStrategy !== 'rss') continue;

    const feedUrl = await getFeedUrl(source);
    if (!feedUrl) {
      console.log(`  ${source.name}: no feed URL, skipping`);
      continue;
    }

    try {
      const feed = await parser.parseURL(feedUrl);
      let sourceCreated = 0;

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
        let primaryArea: string = AREAS[0];
        let lowConfidenceTag = false;
        if (topArea && topArea.confidence >= 0.65 && AREAS.includes(topArea.area as never)) {
          primaryArea = topArea.area;
        } else {
          lowConfidenceTag = true;
        }

        const embeddingText = [title, excerpt, enrichment.summary].filter(Boolean).join(' ');
        let embeddingJson: string | null = null;
        try { const vec = await embed(embeddingText); embeddingJson = JSON.stringify(vec); } catch {}

        await prisma.article.create({
          data: {
            id: articleId, sourceId: source.id, canonicalUrl, originalUrl: rawUrl,
            title, titleEn: enrichment.titleEn, excerpt,
            content: item.content || item['content:encoded'] || null,
            publishedAt, author: item.creator || null, lang: source.lang,
            summary: enrichment.summary,
            areas: enrichment.areas.map((a: { area: string }) => a.area).join(','),
            primaryArea: primaryArea as string, areaConfidences: JSON.stringify(enrichment.areas),
            topics: enrichment.topics.join(','), entities: enrichment.entities.join(','),
            imageUrl: imageUrl || null, isPaywalled: false,
            isWireOrigin: source.isWireService, lowConfidenceTag,
            embedding: embeddingJson, isInDailyFeed: false,
          },
        });

        allNewArticles.push({ articleId, canonicalUrl, primaryArea, sourceId: source.id, publishedAt });
        sourceCreated++;
        totalCreated++;
      }

      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), consecutiveErrors: 0, lastError: null },
      });

      console.log(`  ${source.name}: ${sourceCreated} new (${feed.items?.length || 0} fetched)`);
    } catch (err) {
      console.error(`  ${source.name}: ERROR — ${err instanceof Error ? err.message : String(err)}`);
      await prisma.source.update({
        where: { id: source.id },
        data: { lastErrorAt: new Date(), lastError: err instanceof Error ? err.message : String(err), consecutiveErrors: { increment: 1 } },
      });
    }
  }

  console.log(`\nTotal enriched: ${totalCreated}`);

  // Daily feed selection
  const sinceDate = new Date(); sinceDate.setHours(sinceDate.getHours() - 24);
  const recentArticles = await prisma.article.findMany({
    where: { publishedAt: { gte: sinceDate } },
    select: { id: true, canonicalUrl: true, primaryArea: true, sourceId: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
  });

  const candidates = recentArticles.map((a) => ({
    articleId: a.id, canonicalUrl: a.canonicalUrl,
    primaryArea: a.primaryArea, sourceId: a.sourceId, publishedAt: a.publishedAt,
  }));

  const { selected: dailySelection, categoryFill, deduped } = selectForDailyFeed(candidates, DAILY_FEED_TARGETS);

  const selectedIds = dailySelection.map((s) => s.articleId);
  if (selectedIds.length > 0) {
    await prisma.article.updateMany({ where: { id: { in: selectedIds } }, data: { isInDailyFeed: true } });
  }

  console.log('\nDaily feed:');
  for (const [area, report] of Object.entries(categoryFill)) {
    const line = `  ${area}: ${report.selected}/${report.target}`;
    console.log(line + (report.reason ? ` (${report.reason})` : ''));
  }
  console.log(`  Deduped: ${deduped}`);

  // Clustering
  try {
    const clusterResult = await recomputeClusters();
    console.log(`\nClusters: ${clusterResult.totalClusters} total, ${clusterResult.multiSourceClusters} multi-source`);
  } catch (e) {
    console.error('Clustering failed:', e instanceof Error ? e.message : String(e));
  }

  console.log('\nIngest complete.');
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
