import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSources, runIngest, seedSources } from '@/lib/ingest/pipeline';
import { freshCutoff } from '@/lib/config/dailyFeed';

// Called by Vercel Cron at 08:00 UTC (10:00 CEST) daily.

export async function GET(req: NextRequest) {
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
    const only = req.nextUrl.searchParams.get('source')?.split(',').filter(Boolean);
    return NextResponse.json(await checkSources(Date.now(), only));
  }

  try {
    await seedSources();
    const sources = await prisma.source.findMany({ where: { isActive: true } });
    const { status, body } = await runIngest(sources);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
