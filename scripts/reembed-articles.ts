// scripts/reembed-articles.ts
// Re-embeds all articles using the current Voyage model in lib/ai/embed.ts.
// Use when switching embedding models or if stored embeddings have wrong dims.
//
// Usage:
//   npx tsx scripts/reembed-articles.ts
//
// Dry-run (default):  npx tsx scripts/reembed-articles.ts --dry
// Apply:              npx tsx scripts/reembed-articles.ts --apply
//
// Requires DATABASE_URL and VOYAGE_API_KEY in .env.

import { prisma } from '@/lib/db';
import { embed } from '@/lib/ai/embed';

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Found ${articles.length} articles\n`);

  let embedded = 0;
  let skipped = 0;

  for (const article of articles) {
    // Check current embedding dimension if one exists
    let currentDim: number | null = null;
    if (article.embedding) {
      try {
        const vec = JSON.parse(article.embedding);
        currentDim = Array.isArray(vec) ? vec.length : null;
      } catch {}
    }

    const embeddingText = [article.title, article.excerpt, article.summary]
      .filter(Boolean)
      .join(' ');

    if (DRY_RUN) {
      console.log(
        `  ${article.title.slice(0, 50)}... (current: ${currentDim ? `${currentDim}d` : 'none'})`,
      );
      embedded++;
      continue;
    }

    try {
      const vec = await embed(embeddingText);
      const dim = vec.length;

      console.log(
        `  ✓ ${article.title.slice(0, 50)}... → ${dim}d`,
      );

      await prisma.article.update({
        where: { id: article.id },
        data: { embedding: JSON.stringify(vec) },
      });

      embedded++;
    } catch (err) {
      console.error(
        `  ✗ ${article.title.slice(0, 50)}... ${err instanceof Error ? err.message : String(err)}`,
      );
      skipped++;
    }
  }

  console.log(
    `\nDone. ${embedded} articles ${DRY_RUN ? 'would be' : ''} re-embedded${skipped > 0 ? `, ${skipped} failed.` : '.'}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
