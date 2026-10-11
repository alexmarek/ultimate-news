import { PrismaClient } from '@prisma/client';
import { SOURCES, toSourceRecord } from '../lib/config/sources';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.cluster.deleteMany();
  await prisma.article.deleteMany();
  await prisma.source.deleteMany();

  // The source list lives in lib/config/sources.ts (single source of truth).
  for (const def of SOURCES) {
    await prisma.source.create({ data: toSourceRecord(def) });
  }

  console.log(`Created ${SOURCES.length} sources`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
