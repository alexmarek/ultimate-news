// lib/config/dailyFeed.ts
// Per-category article targets, per-source configs and the freshness window
// for the daily feed. Source definitions live in lib/config/sources.ts.

import type { Area } from '@/lib/types';
import { AREAS } from '@/lib/types';
import { SOURCES, SOURCE_IDS } from '@/lib/config/sources';

const DAY_MS = 24 * 60 * 60 * 1000;

/** News older than this is never ingested and never shown. */
export const MAX_ARTICLE_AGE_DAYS = 14;
export const MAX_ARTICLE_AGE_MS = MAX_ARTICLE_AGE_DAYS * DAY_MS;

/**
 * Curated categories are inspiration rather than news: articles may be up to
 * `maxAgeDays` old. Each source's `limit` is then its share of a candidate pool;
 * Claude rates every candidate and only the best `picks` are shown (at most
 * `perSourceCap` from one source while others are available). A featured or
 * weakly rated article is not offered again; a strong one (4-5) that lost out
 * stays in the pool for the next days.
 */
export interface CuratedArea {
  maxAgeDays: number;
  picks: number;
  perSourceCap: number;
}

export const CURATED_AREAS: Partial<Record<Area, CuratedArea>> = {
  Travel: { maxAgeDays: 183, picks: 6, perSourceCap: 2 },
};

/** How old an article of this category may be, in ms. */
export function maxAgeMsFor(area: Area): number {
  return (CURATED_AREAS[area]?.maxAgeDays ?? MAX_ARTICLE_AGE_DAYS) * DAY_MS;
}

/** Oldest publish date that still counts as fresh (news categories). */
export function freshCutoff(now: number = Date.now()): Date {
  return new Date(now - MAX_ARTICLE_AGE_MS);
}

/**
 * Prisma `where` fragment for articles that may be displayed: part of the daily
 * feed, from a currently configured source, and not older than its category's
 * window (14 days for news, longer for curated categories). Wrapped in AND so a
 * caller can still add its own OR (search).
 */
export function visibleArticleFilter(now: number = Date.now()) {
  return {
    isInDailyFeed: true,
    sourceId: { in: SOURCE_IDS },
    AND: [
      {
        OR: [
          { publishedAt: { gte: freshCutoff(now) } },
          ...Object.keys(CURATED_AREAS).map((area) => ({
            primaryArea: area,
            publishedAt: { gte: new Date(now - maxAgeMsFor(area as Area)) },
          })),
        ],
      },
    ],
  };
}

/** Per-category target: the curated pick count, otherwise the sum of its sources' daily limits. */
export const DAILY_FEED_TARGETS: Record<Area, number> = Object.fromEntries(
  AREAS.map((area) => [
    area,
    CURATED_AREAS[area]?.picks ?? SOURCES.filter((s) => s.category === area).reduce((sum, s) => sum + s.limit, 0),
  ]),
) as Record<Area, number>;

export const SOURCE_CONFIGS: Record<string, { category: Area; limit: number }> = Object.fromEntries(
  SOURCES.map((s) => [s.id, { category: s.category, limit: s.limit }]),
);
