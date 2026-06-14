import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIngest } from '@/app/api/ingest/route';

// Called by Vercel Cron at 08:00 UTC (10:00 CEST) daily.

export async function GET(_req: NextRequest) {
  try {
    const sources = await prisma.source.findMany({ where: { isActive: true } });
    return runIngest(sources);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
