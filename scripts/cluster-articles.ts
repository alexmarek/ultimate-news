// scripts/cluster-articles.ts
// Recomputes article clusters across the active window (7 days).
// Run after backfilling embeddings to group related articles by source.
//
// Usage:
//   npx tsx scripts/cluster-articles.ts

import { recomputeClusters } from '@/lib/dedup/cluster';

async function main() {
  console.log('Recomputing clusters...');
  const result = await recomputeClusters();
  console.log(`  Clustered: ${result.clustered} articles joined existing clusters`);
  console.log(`  Total clusters: ${result.totalClusters}`);
  console.log(`  Multi-source clusters: ${result.multiSourceClusters}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
