import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchOgImage } from '@/lib/ingest/extractImage';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.INGEST_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const articles = await prisma.article.findMany({
    where: { imageUrl: null },
    take: 50,
    select: { id: true, originalUrl: true },
  });

  let filled = 0;
  let failed = 0;

  const concurrency = 5;
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (article) => {
        const imageUrl = await fetchOgImage(article.originalUrl);
        if (imageUrl) {
          await prisma.article.update({
            where: { id: article.id },
            data: { imageUrl },
          });
        }
        return imageUrl;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) filled++;
      if (result.status === 'rejected') failed++;
    }
  }

  return NextResponse.json({ processed: articles.length, filled, failed });
}
