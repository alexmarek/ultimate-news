// lib/config/sources.ts
// Single source of truth for every news source: where it is fetched from,
// which category it feeds and how many articles it contributes per day.
// The ingest pipeline, the DB seed and the homepage filters all derive from
// this list, so adding or removing a source is a one-place change.

import type { Area } from '@/lib/types';

export interface SourceDef {
  id: string;
  name: string;
  /** Public site or section URL. Also used for feed auto-discovery and HTML scraping. */
  url: string;
  /** Known feed URLs, tried in order. Omit to rely on auto-discovery from `url`. */
  feeds?: string[];
  /**
   * If no feed can be found, scrape article links from `url`. Scraped articles
   * need a machine-readable publish date (JSON-LD, <meta> or <time>) to be kept.
   */
  scrape?: boolean;
  /** Fetch the feed through api.rss2json.com (for hosts that block server-side requests). */
  viaRss2Json?: boolean;
  category: Area;
  /** Maximum number of articles this source contributes to the daily feed. */
  limit: number;
  contentKind: string;
  tier: 'tier-1' | 'tier-2';
  weight: number;
}

export const SOURCES: SourceDef[] = [
  // --- World News ---
  { id: 'japantoday', name: 'Japan Today', url: 'https://japantoday.com/', category: 'World News', limit: 3, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  { id: 'euobserver', name: 'EUobserver', url: 'https://euobserver.com/', category: 'World News', limit: 2, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  // [Unverified] no feed URL is known for the AllSides topic page; falls back to auto-discovery, then HTML scraping.
  { id: 'allsides-world', name: 'AllSides', url: 'https://www.allsides.com/topics/world', scrape: true, category: 'World News', limit: 3, contentKind: 'news', tier: 'tier-1', weight: 0.85 },

  // --- Technology ---
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/tech', feeds: ['https://www.theverge.com/rss/tech/index.xml'], category: 'Technology', limit: 2, contentKind: 'technology', tier: 'tier-1', weight: 1.0 },

  // --- Science ---
  // [Unverified] feed URL follows the common WordPress /feed/ convention.
  { id: 'zmescience', name: 'ZME Science', url: 'https://www.zmescience.com/', feeds: ['https://www.zmescience.com/feed/'], category: 'Science', limit: 4, contentKind: 'science', tier: 'tier-2', weight: 0.85 },

  // --- Environment ---
  { id: 'insideclimatenews', name: 'Inside Climate News', url: 'https://insideclimatenews.org', feeds: ['https://insideclimatenews.org/feed/'], viaRss2Json: true, category: 'Environment', limit: 2, contentKind: 'environment', tier: 'tier-2', weight: 0.85 },
  // [Unverified] the UN reports page is a listing, not a feed; reports are published rarely, so
  // with the 14-day freshness limit this source will often contribute nothing.
  { id: 'un-climate-reports', name: 'UN Climate Change', url: 'https://www.un.org/en/climatechange/reports', scrape: true, category: 'Environment', limit: 2, contentKind: 'environment', tier: 'tier-1', weight: 0.9 },

  // --- Positive News ---
  { id: 'goodnewsnetwork', name: 'Good News Network', url: 'https://www.goodnewsnetwork.org', feeds: ['https://www.goodnewsnetwork.org/feed/'], category: 'Positive News', limit: 4, contentKind: 'positive-news', tier: 'tier-2', weight: 0.8 },
  // [Unverified] feed URL follows the common WordPress /feed/ convention.
  { id: 'nautilus', name: 'Nautilus', url: 'https://nautil.us/', feeds: ['https://nautil.us/feed/'], category: 'Positive News', limit: 3, contentKind: 'positive-news', tier: 'tier-2', weight: 0.8 },

  // --- Business ---
  { id: 'qz', name: 'Quartz', url: 'https://qz.com', feeds: ['https://qz.com/feed'], category: 'Business', limit: 2, contentKind: 'business', tier: 'tier-1', weight: 0.9 },

  // --- Travel ---
  { id: 'smithsonian-travel', name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/travel/', feeds: ['https://www.smithsonianmag.com/rss/travel/'], category: 'Travel', limit: 4, contentKind: 'travel', tier: 'tier-1', weight: 0.9 },
  { id: 'fathomaway', name: 'Fathom Away', url: 'https://fathomaway.com', feeds: ['https://fathomaway.com/feed/'], category: 'Travel', limit: 4, contentKind: 'travel', tier: 'tier-1', weight: 0.9 },
  // [Unverified] feed URLs follow the common WordPress /feed/ convention.
  { id: 'ricksteves-cameron', name: "Rick Steves' Europe (Cameron)", url: 'https://blog.ricksteves.com/cameron/', feeds: ['https://blog.ricksteves.com/cameron/feed/'], category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-2', weight: 0.85 },
  { id: 'europeanbestdestinations', name: 'European Best Destinations', url: 'https://www.europeanbestdestinations.com/', feeds: ['https://www.europeanbestdestinations.com/feed/'], category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-2', weight: 0.85 },
];

export const SOURCE_IDS: string[] = SOURCES.map((s) => s.id);

export const SOURCES_BY_ID: Record<string, SourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);

/** Shape of a row in the `Source` table for a configured source. */
export function toSourceRecord(s: SourceDef) {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    feedUrl: s.feeds?.[0] ?? null,
    ingestStrategy: s.scrape && !s.feeds?.length ? 'html' : 'rss',
    lang: 'en',
    tier: s.tier,
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: s.contentKind,
    weight: s.weight,
    isActive: true,
  };
}
