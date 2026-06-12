// lib/config/dailyFeed.ts
// Per-category article targets for the daily feed selection.

import type { Area } from '@/lib/types';

export const DAILY_FEED_TARGETS: Record<Area, number> = {
  'World News': 10,
  'Technology': 10,
  'Environment': 6,
  'Positive News': 6,
  'Music': 4,
  'Sport': 4,
  'Business': 4,
  'Travel': 4,
};
