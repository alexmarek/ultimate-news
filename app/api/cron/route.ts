import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIngest } from '@/app/api/ingest/route';

// Called by Vercel Cron at 10:00 UTC daily.
// Only Vercel's internal scheduler can hit this endpoint.

export async function GET(_req: NextRequest) {
  try {
    const sources = await prisma.source.findMany({ where: { isActive: true } });
    const result = await runIngest(sources);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
