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
  /** Language the source publishes in (default 'en'). Non-English articles are translated to English at ingest. */
  lang?: string;
  /** Feed items whose URL matches are skipped (e.g. a news feed that also carries sport). */
  excludeUrl?: RegExp;
  /** Scrape sources: only links whose URL matches are opened as articles (a blog's post paths, not its shop or index pages). */
  includeUrl?: RegExp;
  /** Feed items whose title matches are skipped (e.g. programme listings rather than articles). */
  excludeTitle?: RegExp;
  /** Fetch the feed through api.rss2json.com (for hosts that block server-side requests). */
  viaRss2Json?: boolean;
  category: Area;
  /** Maximum number of articles this source contributes to the daily feed. */
  limit: number;
  contentKind: string;
  tier: 'tier-1' | 'tier-2';
  weight: number;
}

/** tagesschau feeds also list TV programmes ("tagesthemen", "Wirtschaft vor acht vom 13.10.2026"). */
const TAGESSCHAU_PROGRAMMES = /^(tagesschau|tagesthemen|nachtmagazin|tagesschau24|tagesschau in 100 sekunden|wirtschaft vor acht)\b.{0,25}$/i;

export const SOURCES: SourceDef[] = [
  // --- World News ---
  { id: 'newsonjapan', name: 'News On Japan', url: 'https://newsonjapan.com/', feeds: ['https://newsonjapan.com/rss/top.xml'], category: 'World News', limit: 3, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  // German-language: headline and summary are translated to English at ingest. Politics section = World News.
  // Feed instead of a scrape: faz.net answers server-side page requests with an empty 302, but serves its RSS feed.
  // The feed carries only a short teaser, so these summaries are brief (and the article text cannot be fetched either).
  { id: 'faz', name: 'FAZ.NET', url: 'https://www.faz.net/aktuell/politik/', feeds: ['https://www.faz.net/rss/aktuell/politik/'], lang: 'de', category: 'World News', limit: 3, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  // German public broadcaster (ARD), translated: a second German voice next to FAZ's centre-right line.
  { id: 'tagesschau', name: 'tagesschau', url: 'https://www.tagesschau.de/', feeds: ['https://www.tagesschau.de/index~rss2.xml', 'https://www.tagesschau.de/xml/rss2/'], excludeUrl: /sportschau\.de|\/sport\/|\/multimedia\//i, excludeTitle: TAGESSCHAU_PROGRAMMES, lang: 'de', category: 'World News', limit: 2, contentKind: 'news', tier: 'tier-1', weight: 0.95 },
  { id: 'euobserver', name: 'EUobserver', url: 'https://euobserver.com/', category: 'World News', limit: 2, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  // Second view on Brussels next to EUobserver.
  { id: 'politico-europe', name: 'Politico Europe', url: 'https://www.politico.eu/', feeds: ['https://www.politico.eu/feed/'], category: 'World News', limit: 2, contentKind: 'news', tier: 'tier-1', weight: 0.9 },
  // French public international broadcaster: global coverage beyond Europe.
  { id: 'france24', name: 'France 24', url: 'https://www.france24.com/en/', feeds: ['https://www.france24.com/en/rss'], category: 'World News', limit: 2, contentKind: 'news', tier: 'tier-1', weight: 0.9 },

  // --- Business (markets, energy and petrol prices, the cybersecurity industry) ---
  { id: 'tagesschau-wirtschaft', name: 'tagesschau Wirtschaft', url: 'https://www.tagesschau.de/wirtschaft/', feeds: ['https://www.tagesschau.de/wirtschaft/index~rss2.xml'], excludeUrl: /\/multimedia\//i, excludeTitle: TAGESSCHAU_PROGRAMMES, lang: 'de', category: 'Business', limit: 2, contentKind: 'business', tier: 'tier-1', weight: 0.95 },
  { id: 'euronews-business', name: 'Euronews Business', url: 'https://www.euronews.com/business', feeds: ['https://www.euronews.com/rss?level=vertical&name=business'], category: 'Business', limit: 2, contentKind: 'business', tier: 'tier-1', weight: 0.85 },
  // Business of cybersecurity (deals, earnings, regulation) rather than vulnerability alerts.
  { id: 'cybersecuritydive', name: 'Cybersecurity Dive', url: 'https://www.cybersecuritydive.com/', feeds: ['https://www.cybersecuritydive.com/feeds/news/'], category: 'Business', limit: 2, contentKind: 'business', tier: 'tier-2', weight: 0.85 },

  // --- Technology ---
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/tech', feeds: ['https://www.theverge.com/rss/tech/index.xml'], category: 'Technology', limit: 2, contentKind: 'technology', tier: 'tier-1', weight: 1.0 },

  // --- Science ---
  { id: 'zmescience', name: 'ZME Science', url: 'https://www.zmescience.com/', scrape: true, category: 'Science', limit: 3, contentKind: 'science', tier: 'tier-2', weight: 0.85 },
  { id: 'nautilus', name: 'Nautilus', url: 'https://nautil.us/', scrape: true, category: 'Science', limit: 2, contentKind: 'science', tier: 'tier-2', weight: 0.85 },
  { id: 'quanta', name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/', feeds: ['https://www.quantamagazine.org/feed/'], category: 'Science', limit: 2, contentKind: 'science', tier: 'tier-1', weight: 0.9 },

  // --- Environment ---
  { id: 'un-climate-reports', name: 'UN Climate Change', url: 'https://news.un.org/en/news/topic/climate-change', scrape: true, category: 'Environment', limit: 2, contentKind: 'environment', tier: 'tier-1', weight: 0.9 },
  { id: 'carbonbrief', name: 'Carbon Brief', url: 'https://www.carbonbrief.org/', feeds: ['https://www.carbonbrief.org/feed/'], category: 'Environment', limit: 2, contentKind: 'environment', tier: 'tier-1', weight: 0.9 },

  // --- Positive News ---
  { id: 'goodnewsnetwork', name: 'Good News Network', url: 'https://www.goodnewsnetwork.org', feeds: ['https://www.goodnewsnetwork.org/feed/'], category: 'Positive News', limit: 2, contentKind: 'positive-news', tier: 'tier-2', weight: 0.8 },
  // Constructive journalism: a problem together with what is working against it.
  { id: 'positive-news', name: 'Positive News', url: 'https://www.positive.news/', feeds: ['https://www.positive.news/feed/'], category: 'Positive News', limit: 2, contentKind: 'positive-news', tier: 'tier-1', weight: 0.85 },

  // --- Travel (curated, see CURATED_AREAS in dailyFeed.ts) ---
  // Inspiration rather than news: articles up to ~6 months old. `limit` is each source's share of the
  // daily candidate pool; Claude rates the pool and the best 6 are shown, none of them twice.
  { id: 'euronews-travel', name: 'Euronews Travel', url: 'https://www.euronews.com/travel', feeds: ['https://www.euronews.com/rss?level=vertical&name=travel'], category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-1', weight: 0.85 },
  { id: 'ricksteves-cameron', name: "Rick Steves' Europe (Cameron)", url: 'https://blog.ricksteves.com/cameron/', scrape: true, includeUrl: /^https:\/\/blog\.ricksteves\.com\/cameron\/\d{4}\/\d{2}\/[^/]+/, category: 'Travel', limit: 2, contentKind: 'travel', tier: 'tier-2', weight: 0.85 },
  { id: 'guardian-travel', name: 'The Guardian Travel', url: 'https://www.theguardian.com/travel', feeds: ['https://www.theguardian.com/travel/rss'], category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-1', weight: 0.9 },
  { id: 'cntraveller', name: 'Condé Nast Traveller', url: 'https://www.cntraveller.com/', feeds: ['https://www.cntraveller.com/feed/rss'], category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-1', weight: 0.85 },
  { id: 'fathomaway', name: 'Fathom Away', url: 'https://fathomaway.com', feeds: ['https://fathomaway.com/feed/'], category: 'Travel', limit: 3, contentKind: 'travel', tier: 'tier-1', weight: 0.9 },
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
    lang: s.lang ?? 'en',
    tier: s.tier,
    editorialIndependence: 'independent',
    isWireService: false,
    contentKind: s.contentKind,
    weight: s.weight,
    isActive: true,
  };
}
