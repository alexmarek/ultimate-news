// lib/types.ts
// Shared type definitions for the ingest pipeline

export const AREAS = [
  'World',
  'Politics',
  'Tech',
  'Business',
  'Science',
  'Culture',
  'Music industry',
  'CZ-local',
  'Sport',
] as const;

export type Area = (typeof AREAS)[number];

export interface RawArticle {
  url: string;
  title: string;
  excerpt: string;
  content?: string;
  publishedAt: Date;
  author?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export type SourceLang = 'en' | 'cs' | 'de';
export type IngestStrategy = 'rss' | 'sitemap' | 'html-scrape' | 'api';
export type EditorialIndependence = 'syndicate' | 'national' | 'independent';

export interface SourceForFetch {
  id: string;
  name: string;
  url: string;
  feedUrl: string | null;
  ingestStrategy: IngestStrategy;
  lang: SourceLang;
  tier: string;
  editorialIndependence: EditorialIndependence;
  isWireService: boolean;
  contentKind: string;
  weight: number;
  isActive: boolean;
  lastFetchedAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  consecutiveErrors: number;
}

// RSS Parser types
export interface AnyRssItem {
  [key: string]: any;
  title?: string;
  link?: string;
  pubDate?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
}