// scripts/manual-ingest.ts
// Runs the full ingest pipeline locally against the database in DATABASE_URL.
// Same code path as the daily cron (lib/ingest/pipeline.ts).
// No auth required — connects directly via DATABASE_URL.
//
// Usage:
//   DATABASE_URL="..." npx tsx scripts/manual-ingest.ts

import { prisma } from '@/lib/db';
import { runIngest, seedSources } from '@/lib/ingest/pipeline';

async function main() {
  console.log('Starting manual ingest...\n');

  await seedSources();
  const sources = await prisma.source.findMany({ where: { isActive: true } });
  console.log(`Active sources for ingest: ${sources.length}\n`);

  const { status, body } = await runIngest(sources);
  console.log(JSON.stringify(body, null, 2));

  await prisma.$disconnect();
  if (status !== 200) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
