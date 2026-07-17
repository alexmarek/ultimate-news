import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIngest, seedSources } from '@/app/api/ingest/route';

// Called by Vercel Cron at 08:00 UTC (10:00 CEST) daily.

export async function GET(req: NextRequest) {
  // Debug mode — report DB state without running ingestion
  if (req.nextUrl.searchParams.has('debug')) {
    const totalArticles = await prisma.article.count();
    const oldArticles = await prisma.article.count({
      where: { publishedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    const newest = await prisma.article.findFirst({ orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } });
    const oldest = await prisma.article.findFirst({ orderBy: { publishedAt: 'asc' }, select: { publishedAt: true } });
    const feedArticles = await prisma.article.count({ where: { isInDailyFeed: true } });
    return NextResponse.json({ totalArticles, feedArticles, oldArticles, newest: newest?.publishedAt, oldest: oldest?.publishedAt });
  }

  try {
    await seedSources();
    const sources = await prisma.source.findMany({ where: { isActive: true } });
    return runIngest(sources);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
