// scripts/wipe-articles.ts
// Wipes all articles and clusters for a fresh rebuild.
// Resets source lastFetchedAt/error timestamps.
// Does NOT touch Source rows, user settings, or any other table.
//
// Usage:
//   npx tsx scripts/wipe-articles.ts
//
// Requires DATABASE_URL in .env.

import { prisma } from '@/lib/db';

async function main() {
  const articleCount = await prisma.article.count();
  const clusterCount = await prisma.cluster.count();
  const sourceCount = await prisma.source.count();

  console.log('Before wipe:');
  console.log(`  Articles: ${articleCount}`);
  console.log(`  Clusters: ${clusterCount}`);
  console.log(`  Sources: ${sourceCount}`);
  console.log();

  // Delete child records first (FK constraints)
  console.log('Deleting article reads...');
  const { count: deletedReads } = await prisma.articleRead.deleteMany();
  console.log(`  Deleted ${deletedReads} read records`);

  console.log('Deleting article saves...');
  const { count: deletedSaves } = await prisma.articleSaved.deleteMany();
  console.log(`  Deleted ${deletedSaves} save records`);

  // Delete all clusters (must go before articles due to FK)
  console.log('Deleting clusters...');
  const { count: deletedClusters } = await prisma.cluster.deleteMany();
  console.log(`  Deleted ${deletedClusters} clusters`);

  // Delete all articles
  console.log('Deleting articles...');
  const { count: deletedArticles } = await prisma.article.deleteMany();
  console.log(`  Deleted ${deletedArticles} articles`);

  // Reset source timers
  console.log('Resetting source timers...');
  const { count: resetSources } = await prisma.source.updateMany({
    data: {
      lastFetchedAt: null,
      lastErrorAt: null,
      lastError: null,
      consecutiveErrors: 0,
    },
  });
  console.log(`  Reset ${resetSources} sources`);

  // Verify
  const finalArticles = await prisma.article.count();
  const finalClusters = await prisma.cluster.count();
  console.log();
  console.log('After wipe:');
  console.log(`  Articles: ${finalArticles}`);
  console.log(`  Clusters: ${finalClusters}`);
  console.log(`  Sources: ${sourceCount} (untouched)`);
  console.log();
  console.log('Wipe complete. Sources ready for fresh ingest.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
