import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.cluster.deleteMany();
  await prisma.article.deleteMany();
  await prisma.source.deleteMany();

  const sources = [
    {
      id: 'propublica',
      name: 'ProPublica',
      url: 'https://www.propublica.org',
      feedUrl: 'https://www.propublica.org/feeds/propublica/main',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-1',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'investigative',
      weight: 1.0,
      isActive: true,
    },
    {
      id: 'dw',
      name: 'Deutsche Welle',
      url: 'https://www.dw.com/en/top-stories/s-9097',
      feedUrl: 'https://rss.dw.com/rdf/rss-en-all',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-1',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'news',
      weight: 0.9,
      isActive: true,
    },
    {
      id: 'wired',
      name: 'Wired',
      url: 'https://www.wired.com',
      feedUrl: 'https://www.wired.com/feed/rss',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-1',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'technology',
      weight: 1.0,
      isActive: true,
    },
    {
      id: 'thehackernews',
      name: 'The Hacker News',
      url: 'https://thehackernews.com',
      feedUrl: 'https://feeds.feedburner.com/TheHackersNews',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-2',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'cybersecurity',
      weight: 0.8,
      isActive: true,
    },
    {
      id: 'insideclimatenews',
      name: 'Inside Climate News',
      url: 'https://insideclimatenews.org',
      feedUrl: 'https://insideclimatenews.org/feed/',
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
      id: 'bbc-future-planet',
      name: 'BBC Future Planet',
      url: 'https://www.bbc.com/future-planet',
      feedUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-1',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'environment',
      weight: 0.85,
      isActive: true,
    },
    {
      id: 'goodnewsnetwork',
      name: 'Good News Network',
      url: 'https://www.goodnewsnetwork.org',
      feedUrl: 'https://www.goodnewsnetwork.org/feed/',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-2',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'positive-news',
      weight: 0.8,
      isActive: true,
    },
    {
      id: 'qz',
      name: 'Quartz',
      url: 'https://qz.com',
      feedUrl: 'https://qz.com/feed',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-1',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'business',
      weight: 0.9,
      isActive: true,
    },
    {
      id: 'budgettraveller',
      name: 'Budget Traveller',
      url: 'https://budgettraveller.org/blog/',
      feedUrl: 'https://budgettraveller.org/feed/',
      ingestStrategy: 'rss',
      lang: 'en',
      tier: 'tier-2',
      editorialIndependence: 'independent',
      isWireService: false,
      contentKind: 'travel',
      weight: 0.8,
      isActive: true,
    },
    {
      id: 'bemytravelmuse',
      name: 'Be My Travel Muse',
      url: 'https://www.bemytravelmuse.com/archives/',
      feedUrl: 'https://www.bemytravelmuse.com/feed/',
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

  for (const s of sources) {
    await prisma.source.create({ data: s });
  }

  console.log(`Created ${sources.length} sources`);
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
