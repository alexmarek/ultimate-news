// scripts/sync-sources.ts
// One-off script to sync the source list to the canonical set.
//
// Removes (soft-deletes by setting isActive = false):
//   Washington Institute, Poynter, Christian Science Monitor, Daily Maverick,
//   Kathimerini, Loot Drop, Guitar World
//
// Adds:
//   BBC Sport, Inside Climate News, Stereogum, Lonely Planet
//
// Usage:
//   npx tsx scripts/sync-sources.ts
//
// Requires DATABASE_URL in .env.

import { prisma } from '@/lib/db';
import { discoverFeed } from '@/lib/ingest/discoverFeed';

const REMOVED_IDS = [
  'washingtoninstitute',
  'poynter',
  'csmonitor',
  'dailymaverick',
  'ekathimerini',
  'loot-drop',
  'guitarworld',
];

const NEW_SOURCES = [
  {
    id: 'bbc-sport',
    name: 'BBC Sport',
    url: 'https://www.bbc.com/sport',
    feedUrl: 'https://feeds.bbci.co.uk/sport/rss.xml',
    ingestStrategy: 'rss',
    lang: 'en',
    tier: 'tier-1',
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: 'sports',
    weight: 0.9,
    isActive: true,
  },
  {
    id: 'insideclimatenews',
    name: 'Inside Climate News',
    url: 'https://insideclimatenews.org',
    feedUrl: null,
    ingestStrategy: 'rss',
    lang: 'en',
    tier: 'tier-2',
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: 'environment',
    weight: 0.85,
    isActive: true,
  },
  {
    id: 'stereogum',
    name: 'Stereogum',
    url: 'https://www.stereogum.com',
    feedUrl: null,
    ingestStrategy: 'rss',
    lang: 'en',
    tier: 'tier-2',
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: 'music',
    weight: 0.75,
    isActive: true,
  },
  {
    id: 'lonelyplanet',
    name: 'Lonely Planet',
    url: 'https://www.lonelyplanet.com',
    feedUrl: null,
    ingestStrategy: 'rss',
    lang: 'en',
    tier: 'tier-2',
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: 'travel',
    weight: 0.8,
    isActive: true,
  },
];

async function main() {
  console.log('Syncing sources...\n');

  // Soft-delete removed sources
  console.log('Removing sources:');
  for (const id of REMOVED_IDS) {
    const source = await prisma.source.findUnique({ where: { id } });
    if (source) {
      await prisma.source.update({
        where: { id },
        data: { isActive: false },
      });
      console.log(`  ✓ ${source.name} → isActive = false`);
    } else {
      console.log(`  - ${id} not found in database, skipping`);
    }
  }

  console.log();

  // Insert new sources
  console.log('Adding sources:');
  for (const s of NEW_SOURCES) {
    const existing = await prisma.source.findUnique({ where: { id: s.id } });
    if (existing) {
      await prisma.source.update({
        where: { id: s.id },
        data: { isActive: true, weight: s.weight, contentKind: s.contentKind },
      });
      console.log(`  ✓ ${s.name} already exists → updated`);
    } else {
      await prisma.source.create({ data: s });
      console.log(`  ✓ ${s.name} → inserted`);
    }
  }

  console.log();

  // Discover feed URLs for sources without one
  console.log('Discovering feed URLs:');
  const toDiscover = NEW_SOURCES.filter((s) => !s.feedUrl);

  if (toDiscover.length === 0) {
    console.log('  All new sources have explicit feed URLs — nothing to discover.');
  } else {
    for (const s of toDiscover) {
      process.stdout.write(`  ${s.name} (${s.url})... `);
      try {
        const discovered = await discoverFeed(s.url);
        if (discovered) {
          await prisma.source.update({
            where: { id: s.id },
            data: { feedUrl: discovered },
          });
          console.log(`✓ ${discovered}`);
        } else {
          if (s.id === 'lonelyplanet') {
            console.log('✗ No RSS feed found');
            console.log('');
            console.log('  ⚠️  Lonely Planet requires manual feed configuration.');
            console.log('     The source has been created but will not ingest until feedUrl is set.');
            console.log('     Possible feeds to try:');
            console.log('       - https://www.lonelyplanet.com/feeds/all');
            console.log('       - https://www.lonelyplanet.com/news/feed');
            console.log('     Once you find the correct URL, update it via Prisma Studio:');
            console.log('       UPDATE "Source" SET "feedUrl" = \'<url>\' WHERE id = \'lonelyplanet\';');
            console.log('');
          } else {
            console.log(`✗ No RSS feed found — ${s.name} will not ingest until feedUrl is configured.`);
          }
        }
      } catch (err) {
        console.log(`✗ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log('\nSync complete.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
