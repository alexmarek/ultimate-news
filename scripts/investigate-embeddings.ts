// scripts/investigate-embeddings.ts
// Diagnoses embedding state across all articles.
//
// Usage:
//   npx tsx scripts/investigate-embeddings.ts
//
// Requires DATABASE_URL in .env pointing to the target database.

import { prisma } from '@/lib/db';

async function main() {
  console.log('========================================');
  console.log('Article Embedding Investigation');
  console.log('========================================\n');

  // (a) Total / with embedding / missing
  const total = await prisma.article.count();
  const withEmbed = await prisma.article.count({ where: { embedding: { not: null } } });
  const missing = total - withEmbed;
  console.log(`Total articles:          ${total}`);
  console.log(`With embeddings:         ${withEmbed} (${total > 0 ? ((withEmbed / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Missing embeddings:      ${missing} (${total > 0 ? ((missing / total) * 100).toFixed(1) : 0}%)`);

  // (b) Dimension distribution
  console.log('\n--- Dimension distribution ---');
  if (withEmbed === 0) {
    console.log('  No embeddings stored.');
  } else {
    const articles = await prisma.article.findMany({
      where: { embedding: { not: null } },
      select: { id: true, embedding: true },
      take: 500,
    });

    const dims = new Map<number, number>();
    for (const a of articles) {
      try {
        const vec = JSON.parse(a.embedding!);
        const dim = Array.isArray(vec) ? vec.length : 0;
        dims.set(dim, (dims.get(dim) || 0) + 1);
      } catch {
        dims.set(-1, (dims.get(-1) || 0) + 1);
      }
    }
    for (const [dim, count] of [...dims.entries()].sort((a, b) => a[0] - b[0])) {
      const label = dim === -1 ? 'unparseable' : `${dim}d`;
      console.log(`  ${label}: ${count}`);
    }
  }

  // (c) Sample of recent articles
  console.log('\n--- Recent 10 articles ---');
  const sample = await prisma.article.findMany({
    select: { id: true, title: true, lang: true, embedding: true },
    orderBy: { publishedAt: 'desc' },
    take: 10,
  });
  for (const a of sample) {
    let status: string;
    if (!a.embedding) {
      status = 'NULL';
    } else {
      try {
        const vec = JSON.parse(a.embedding);
        status = `present (${Array.isArray(vec) ? vec.length : 'invalid'} dims)`;
      } catch {
        status = 'invalid JSON';
      }
    }
    console.log(`  ${a.title.slice(0, 60)}...`);
    console.log(`    id: ${a.id}, lang: ${a.lang}, embedding: ${status}`);
  }

  // (d) Search readiness check
  console.log('\n--- Search readiness ---');
  if (withEmbed === 0) {
    console.log('  ⚠️  ZERO articles have embeddings.');
    console.log('     Semantic search will return empty results.');
    console.log('     Run scripts/embed-missing-articles.ts to backfill.');
  } else if (withEmbed < total) {
    console.log(`  ⚠️  ${missing} articles missing embeddings.`);
    console.log('     Search works but only covers articles with embeddings.');
    console.log('     Run scripts/embed-missing-articles.ts to fill the gap.');
  } else {
    console.log('  ✓ All articles have embeddings. Search is fully operational.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
