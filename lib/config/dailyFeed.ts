// lib/config/dailyFeed.ts
// Per-category article targets for the daily feed selection.

import type { Area } from '@/lib/types';

export const DAILY_FEED_TARGETS: Record<Area, number> = {
  'World News': 6,
  'Technology': 6,
  'Environment': 6,
  'Positive News': 6,
  'Music': 6,
  'Sport': 6,
  'Business': 6,
  'Travel': 6,
};
