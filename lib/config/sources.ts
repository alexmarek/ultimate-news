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
  /** Known feed URLs, tried in order. Omit to rely on auto-discovery from `url`. Ignored when `scrape` is set. */
  feeds?: string[];
  /**
   * Read articles straight from the page at `url` (no RSS/Atom feed is used or
   * discovered). Article links are taken from the page and each linked page must
   * expose a machine-readable publish date (JSON-LD, <meta> or <time>) to be kept.
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
  { id: 'newsonjapan', name: 'News On Japan', url: 'https://newsonjapan.com/', feeds: ['https://newsonjapan.com/rss/top.xml'], category: 'World News', limit: 3, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  { id: 'euobserver', name: 'EUobserver', url: 'https://euobserver.com/', category: 'World News', limit: 2, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  // [Unverified] scraped; not yet checked against the live page.
  { id: 'allsides-world', name: 'AllSides', url: 'https://www.allsides.com/topics/world', scrape: true, category: 'World News', limit: 3, contentKind: 'news', tier: 'tier-1', weight: 0.85 },

  // --- Technology ---
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/tech', feeds: ['https://www.theverge.com/rss/tech/index.xml'], category: 'Technology', limit: 2, contentKind: 'technology', tier: 'tier-1', weight: 1.0 },

  // --- Science ---
  // [Unverified] scraped; not yet checked against the live page.
  { id: 'zmescience', name: 'ZME Science', url: 'https://www.zmescience.com/', scrape: true, category: 'Science', limit: 4, contentKind: 'science', tier: 'tier-2', weight: 0.85 },

  // --- Environment ---
  { id: 'insideclimatenews', name: 'Inside Climate News', url: 'https://insideclimatenews.org', feeds: ['https://insideclimatenews.org/feed/'], viaRss2Json: true, category: 'Environment', limit: 2, contentKind: 'environment', tier: 'tier-2', weight: 0.85 },
  // [Unverified] scraped; not yet checked against the live page.
  { id: 'un-climate-reports', name: 'UN Climate Change', url: 'https://news.un.org/en/news/topic/climate-change', scrape: true, category: 'Environment', limit: 2, contentKind: 'environment', tier: 'tier-1', weight: 0.9 },

  // --- Positive News ---
  { id: 'goodnewsnetwork', name: 'Good News Network', url: 'https://www.goodnewsnetwork.org', feeds: ['https://www.goodnewsnetwork.org/feed/'], category: 'Positive News', limit: 4, contentKind: 'positive-news', tier: 'tier-2', weight: 0.8 },
  // [Unverified] scraped; not yet checked against the live page.
  { id: 'nautilus', name: 'Nautilus', url: 'https://nautil.us/', scrape: true, category: 'Positive News', limit: 3, contentKind: 'positive-news', tier: 'tier-2', weight: 0.8 },

  // --- Business ---
  { id: 'qz', name: 'Quartz', url: 'https://qz.com', feeds: ['https://qz.com/feed'], category: 'Business', limit: 2, contentKind: 'business', tier: 'tier-1', weight: 0.9 },

  // --- Travel ---
  { id: 'smithsonian-travel', name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/travel/', feeds: ['https://www.smithsonianmag.com/rss/travel/'], category: 'Travel', limit: 4, contentKind: 'travel', tier: 'tier-1', weight: 0.9 },
  { id: 'fathomaway', name: 'Fathom Away', url: 'https://fathomaway.com', feeds: ['https://fathomaway.com/feed/'], category: 'Travel', limit: 4, contentKind: 'travel', tier: 'tier-1', weight: 0.9 },
  // [Unverified] scraped; not yet checked against the live page.
  { id: 'ricksteves-cameron', name: "Rick Steves' Europe (Cameron)", url: 'https://blog.ricksteves.com/cameron/', scrape: true, category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-2', weight: 0.85 },
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
    feedUrl: s.scrape ? null : (s.feeds?.[0] ?? null),
    ingestStrategy: s.scrape ? 'html' : 'rss',
    lang: 'en',
    tier: s.tier,
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: s.contentKind,
    weight: s.weight,
    isActive: true,
  };
}
