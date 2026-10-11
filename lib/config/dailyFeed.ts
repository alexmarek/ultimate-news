// lib/config/dailyFeed.ts
// Per-category article targets, per-source configs and the freshness window
// for the daily feed. Source definitions live in lib/config/sources.ts.

import type { Area } from '@/lib/types';
import { AREAS } from '@/lib/types';
import { SOURCES, SOURCE_IDS } from '@/lib/config/sources';

/** Articles older than this are never ingested and never shown. */
export const MAX_ARTICLE_AGE_DAYS = 14;
export const MAX_ARTICLE_AGE_MS = MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;

/** Oldest publish date that still counts as fresh. */
export function freshCutoff(now: number = Date.now()): Date {
  return new Date(now - MAX_ARTICLE_AGE_MS);
}

/**
 * Prisma `where` fragment for articles that may be displayed: part of the daily
 * feed, from a currently configured source, and not older than the freshness window.
 */
export function visibleArticleFilter(now: number = Date.now()) {
  return {
    isInDailyFeed: true,
    publishedAt: { gte: freshCutoff(now) },
    sourceId: { in: SOURCE_IDS },
  };
}

/** Per-category target = the sum of its sources' daily limits. */
export const DAILY_FEED_TARGETS: Record<Area, number> = Object.fromEntries(
  AREAS.map((area) => [
    area,
    SOURCES.filter((s) => s.category === area).reduce((sum, s) => sum + s.limit, 0),
  ]),
) as Record<Area, number>;

export const SOURCE_CONFIGS: Record<string, { category: Area; limit: number }> = Object.fromEntries(
  SOURCES.map((s) => [s.id, { category: s.category, limit: s.limit }]),
);
