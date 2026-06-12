// scripts/embed-missing-articles.ts
// Backfills Voyage embeddings for articles missing them.
//
// Cost: voyage-3-lite at $0.02/1M tokens. ~500 tokens per article.
// Full run on 592 articles ≈ 296K tokens ≈ $0.006. Negligible.
//
// Usage:
//   npx tsx scripts/embed-missing-articles.ts
//
// Dry-run:  npx tsx scripts/embed-missing-articles.ts --dry  (default)
// Apply:    npx tsx scripts/embed-missing-articles.ts --apply
//
// Batch size of 10 to stay well within Voyage free-tier rate limits.
// Requires DATABASE_URL and VOYAGE_API_KEY in .env.

import { prisma } from '@/lib/db';
import { embed } from '@/lib/ai/embed';

const BATCH_SIZE = 10;
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const total = await prisma.article.count();
  const missing = await prisma.article.count({
    where: { embedding: null },
  });

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Total articles: ${total}, missing embeddings: ${missing}`);

  if (missing === 0) {
    console.log('No articles missing embeddings. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  const estimatedTokens = missing * 500;
  const estimatedCost = (estimatedTokens / 1_000_000) * 0.02;
  console.log(
    `Estimated: ${estimatedTokens.toLocaleString()} tokens ≈ $${estimatedCost.toFixed(4)}\n`,
  );

  let processed = 0;
  let embedded = 0;
  let failed = 0;

  while (true) {
    const batch = await prisma.article.findMany({
      where: { embedding: null },
      take: BATCH_SIZE,
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, excerpt: true, summary: true },
    });

    if (batch.length === 0) break;

    for (const article of batch) {
      const embeddingText = [article.title, article.excerpt, article.summary]
        .filter(Boolean)
        .join(' ');

      if (DRY_RUN) {
        console.log(`  [dry] ${article.title.slice(0, 50)}...`);
        embedded++;
        continue;
      }

      try {
        const vec = await embed(embeddingText);
        await prisma.article.update({
          where: { id: article.id },
          data: { embedding: JSON.stringify(vec) },
        });
        console.log(`  ✓ ${article.title.slice(0, 50)}... (${vec.length}d)`);
        embedded++;
      } catch (err) {
        console.error(
          `  ✗ ${article.title.slice(0, 50)}... ${err instanceof Error ? err.message : String(err)}`,
        );
        failed++;
      }
    }

    processed += batch.length;
    console.log(
      `  Batch done: ${processed}/${missing} processed (${embedded} embedded, ${failed} failed)\n`,
    );

    // Small delay between batches to be kind to Voyage rate limits
    if (!DRY_RUN && processed < missing) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}Done. ${embedded} articles ${DRY_RUN ? 'would be' : ''} embedded, ${failed} failed.`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
