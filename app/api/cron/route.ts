import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSources, runIngest, seedSources } from '@/lib/ingest/pipeline';
import { freshCutoff } from '@/lib/config/dailyFeed';
import { refreshMarkets } from '@/lib/markets/snapshot';
import { similarPairs } from '@/lib/dedup/cluster';

// Called by Vercel Cron at 08:00 UTC (10:00 CEST) daily.

export async function GET(req: NextRequest) {
  // Debug: the most similar cross-source article pairs (calibrates story grouping). Read-only.
  if (req.nextUrl.searchParams.get('debug') === 'pairs') {
    return NextResponse.json({ threshold: 'see SIMILARITY_THRESHOLD in lib/dedup/cluster.ts', pairs: await similarPairs() });
  }

  // Debug mode — report DB state without running ingestion
  if (req.nextUrl.searchParams.has('debug')) {
    const totalArticles = await prisma.article.count();
    const oldArticles = await prisma.article.count({
      where: { publishedAt: { lt: freshCutoff() } },
    });
    const newest = await prisma.article.findFirst({ orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } });
    const oldest = await prisma.article.findFirst({ orderBy: { publishedAt: 'asc' }, select: { publishedAt: true } });
    const feedArticles = await prisma.article.count({ where: { isInDailyFeed: true } });
    return NextResponse.json({ totalArticles, feedArticles, oldArticles, newest: newest?.publishedAt, oldest: oldest?.publishedAt });
  }

  // Dry run — fetch every source and report what would be ingested; writes nothing, calls no AI.
  if (req.nextUrl.searchParams.has('dryRun')) {
    const p = req.nextUrl.searchParams;
    const only = p.get('source')?.split(',').filter(Boolean);
    // Model comparison (dry run only): a fixed allowlist, so this public endpoint cannot be pointed at any model.
    const model = ['claude-haiku-4-5-20251001', 'claude-haiku-5-5'].find((m) => m === p.get('model'));
    const effort = (['low', 'medium', 'high'] as const).find((e) => e === p.get('effort'));
    return NextResponse.json(await checkSources(Date.now(), only, p.has('enrich'), { model, effort }));
  }

  // Market data only (ETF performance, petrol prices): refreshes the stored snapshot, no articles.
  if (req.nextUrl.searchParams.has('markets')) {
    return NextResponse.json(await refreshMarkets());
  }

  try {
    await seedSources();
    const sources = await prisma.source.findMany({ where: { isActive: true } });
    const { status, body } = await runIngest(sources);
    // Independent of the articles: a market data failure never fails the ingest.
    const markets = await refreshMarkets().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    return NextResponse.json({ ...body, markets }, { status });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
