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
import { SOURCE_CONFIGS, DAILY_FEED_TARGETS } from '@/lib/config/dailyFeed';
import { recomputeClusters } from '@/lib/dedup/cluster';
import { discoverFeed } from '@/lib/ingest/discoverFeed';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
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

  // Wipe all existing articles and clusters for a fresh daily feed
  await prisma.articleRead.deleteMany();
  await prisma.articleSaved.deleteMany();
  await prisma.cluster.deleteMany();
  await prisma.article.deleteMany();

  const sources = await prisma.source.findMany({ where: { isActive: true } });
  const activeSources = sources.filter((s) => s.id in SOURCE_CONFIGS);
  console.log(`Active sources for ingest: ${activeSources.length}\n`);

  let totalCreated = 0;
  const seenArticleIds = new Set<string>();
  const allNewArticles: Array<{
    articleId: string;
    sourceId: string;
    canonicalUrl: string;
    primaryArea: string;
  }> = [];

  for (const source of activeSources) {
    const config = SOURCE_CONFIGS[source.id];
    if (source.ingestStrategy !== 'rss') continue;

    const feedUrl = await getFeedUrl(source);
    if (!feedUrl) {
      console.log(`  ${source.name}: no feed URL, skipping`);
      continue;
    }

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
      let sourceCreated = 0;

      for (const item of (feed.items || []).slice(0, config.limit)) {
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

        // Determine category deterministically based on our SOURCE_CONFIGS matrix
        const primaryArea = config.category;

        const embeddingText = [title, excerpt, enrichment.summary].filter(Boolean).join(' ');
        let embeddingJson: string | null = null;
        try {
          const vec = await embed(embeddingText);
          embeddingJson = JSON.stringify(vec);
        } catch {}

        if (seenArticleIds.has(articleId)) continue;
        seenArticleIds.add(articleId);

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
            areas: enrichment.areas.map((a: { area: string }) => a.area).join(','),
            primaryArea: primaryArea as string,
            areaConfidences: JSON.stringify(enrichment.areas),
            topics: enrichment.topics.join(','),
            entities: enrichment.entities.join(','),
            imageUrl: imageUrl || null,
            isPaywalled: false,
            isWireOrigin: source.isWireService,
            lowConfidenceTag: false,
            embedding: embeddingJson,
            isInDailyFeed: true,
          },
        });

        allNewArticles.push({ articleId, canonicalUrl, primaryArea, sourceId: source.id });
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

  // Display category report
  console.log('\nDaily feed category counts:');
  for (const [area, target] of Object.entries(DAILY_FEED_TARGETS)) {
    const count = allNewArticles.filter((a) => a.primaryArea === area).length;
    console.log(`  ${area}: ${count}/${target}`);
  }

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
