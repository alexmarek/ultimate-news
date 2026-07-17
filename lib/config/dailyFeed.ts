// lib/config/dailyFeed.ts
// Per-category article targets and source-specific configs for the daily feed.

import type { Area } from '@/lib/types';

export const DAILY_FEED_TARGETS: Record<Area, number> = {
  'World News': 6,
  'Technology': 5,
  'Environment': 4,
  'Positive News': 4,
  'Music': 0,
  'Sport': 0,
  'Business': 2,
  'Travel': 4,
};

export const SOURCE_CONFIGS: Record<string, { category: Area; limit: number }> = {
  'wired': { category: 'Technology', limit: 2 },
  'theverge': { category: 'Technology', limit: 2 },
  'goodnewsnetwork': { category: 'Positive News', limit: 4 },
  'qz': { category: 'Business', limit: 2 },
  'japantoday': { category: 'World News', limit: 3 },
  'euobserver': { category: 'World News', limit: 2 },
  'dw': { category: 'World News', limit: 4 },
  'thehackernews': { category: 'Technology', limit: 3 },
  'insideclimatenews': { category: 'Environment', limit: 2 },
  'bbc-future-planet': { category: 'Environment', limit: 2 },
  'budgettraveller': { category: 'Travel', limit: 4 },
  'bemytravelmuse': { category: 'Travel', limit: 4 },
  'telegraph-travel': { category: 'Travel', limit: 4 },
};
