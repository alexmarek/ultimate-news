import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIngest, seedSources } from '@/lib/ingest/pipeline';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.INGEST_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Always sync seed sources (upserts new, deactivates removed)
  await seedSources();
  const sources = await prisma.source.findMany({ where: { isActive: true } });

  const { status, body } = await runIngest(sources);
  return NextResponse.json(body, { status });
}
