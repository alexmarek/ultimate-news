// lib/ingest/pipeline.ts
// The daily ingest: collect fresh articles from every configured source,
// summarise them, then replace the previous feed.
//
//   1. collect   – per source: feed (known URLs, then auto-discovery) or HTML
//                  scrape; drop anything older than MAX_ARTICLE_AGE_DAYS *before*
//                  applying the per-source limit; keep the newest `limit`.
//   2. enrich    – fetch the full article text when the feed only gave a snippet,
//                  summarise with Claude (fallback: extractive), embed. Runs
//                  with bounded concurrency and a time budget so the whole run
//                  fits Vercel's function limit.
//   3. write     – only now are the old articles replaced, in one transaction, so
//                  a failed or timed-out run never leaves the site empty.
//   4. cluster   – group articles that cover the same story.

import Parser from 'rss-parser';
import type { Prisma, Source } from '@prisma/client';
import { prisma } from '@/lib/db';
import { SOURCES, SOURCE_IDS, toSourceRecord, type SourceDef } from '@/lib/config/sources';
import { DAILY_FEED_TARGETS, MAX_ARTICLE_AGE_DAYS, MAX_ARTICLE_AGE_MS } from '@/lib/config/dailyFeed';
import type { RawArticle } from '@/lib/types';
import { extractImageFromRssItem } from '@/lib/ingest/extractImage';
import { fetchArticleText } from '@/lib/ingest/fetchArticleText';
import { discoverFeed } from '@/lib/ingest/discoverFeed';
import { scrapeListing } from '@/lib/ingest/scrapeListing';
import { canonicalizeUrl, articleIdFromUrl } from '@/lib/ingest/canonicalize';
import { mapPool } from '@/lib/ingest/pool';
import { stripHtml } from '@/lib/text';
import { enrichArticle, enrichFallback, isSnippet } from '@/lib/ai/enrich';
import { embedMany } from '@/lib/ai/embed';
import { summaryPreview, summaryToPlainText } from '@/lib/summary';
import { recomputeClusters } from '@/lib/dedup/cluster';

/** Below this much text the feed only gave a snippet: fetch the article page for the full body. */
const FULL_TEXT_MIN_CHARS = 3000;
const SOURCE_CONCURRENCY = 5;
const ENRICH_CONCURRENCY = 6;
/** vercel.json allows 300 s per run. Stop starting new Claude calls after this, finish the rest with the fallback. */
const ENRICH_DEADLINE_MS = 190_000;
/** Don't start fetching another article page with less than this left before the deadline. */
const FETCH_MIN_REMAINING_MS = 30_000;

const parser = new Parser({
  timeout: 15_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  customFields: {
    item: ['media:content', 'media:thumbnail', 'media:group', 'enclosure', 'content:encoded'],
  },
});

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Upserts every configured source and deactivates any that are no longer configured. */
export async function seedSources() {
  for (const def of SOURCES) {
    const row = toSourceRecord(def);
    await prisma.source.upsert({
      where: { id: def.id },
      create: row,
      update: {
        isActive: true,
        name: row.name,
        url: row.url,
        lang: row.lang,
        feedUrl: row.feedUrl,
        ingestStrategy: row.ingestStrategy,
        contentKind: row.contentKind,
        tier: row.tier,
        weight: row.weight,
      },
    });
  }
  await prisma.source.updateMany({
    where: { id: { notIn: SOURCE_IDS } },
    data: { isActive: false },
  });
}

// ---------------------------------------------------------------------------
// 1. Collect
// ---------------------------------------------------------------------------

/** Video, audio and podcast items have no article text to summarise. */
const MEDIA_URL = /\/(?:video|videos|podcast|podcasts|audio)(?:\/|-)/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRawArticle(item: any): RawArticle | null {
  const link: string = item.link || item.guid || '';
  if (!/^https?:\/\//i.test(link) || MEDIA_URL.test(link)) return null;

  const parsed = new Date(item.isoDate || item.pubDate || '');
  return {
    url: link,
    title: stripHtml(item.title || 'Untitled'),
    excerpt: stripHtml(item.contentSnippet || item.summary || ''),
    content: stripHtml(item.content || item['content:encoded'] || ''),
    // Feed items without a usable date are treated as new, as before.
    publishedAt: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
    author: item.creator || item.author || undefined,
    imageUrl: extractImageFromRssItem(item as Record<string, unknown>) || undefined,
  };
}

async function parseFeed(def: SourceDef, feedUrl: string): Promise<RawArticle[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[];
  if (def.viaRss2Json) {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
    if (!res.ok) throw new Error(`rss2json failed with status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`rss2json error: ${data.message || 'unknown'}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items = (data.items || []).map((item: any) => ({
      link: item.link,
      guid: item.guid || item.link,
      pubDate: item.pubDate,
      contentSnippet: item.description,
      summary: item.description,
      title: item.title,
      content: item.content || item.description,
    }));
  } else {
    items = (await parser.parseURL(feedUrl)).items || [];
  }
  return items.map(toRawArticle).filter((a): a is RawArticle => a !== null);
}

export interface CollectResult {
  articles: RawArticle[];
  feedUrl: string | null;
  method: 'feed' | 'scrape' | null;
  /** Items the source offered. */
  seen: number;
  /** Items dropped for being older than the freshness window. */
  skippedOld: number;
  error?: string;
}

async function collectByScraping(def: SourceDef, now: number, trace?: Array<Record<string, unknown>>): Promise<CollectResult> {
  try {
    const articles = await scrapeListing(def.url, {
      siteName: def.name,
      trace,
      limit: def.limit,
      maxAgeMs: MAX_ARTICLE_AGE_MS,
      // The page lists newest first on most sites; look a few times past the quota in case some links aren't articles.
      maxCandidates: Math.min(14, Math.max(8, def.limit * 4)),
      now,
    });
    return { articles, feedUrl: null, method: 'scrape', seen: articles.length, skippedOld: 0 };
  } catch (e) {
    return { articles: [], feedUrl: null, method: null, seen: 0, skippedOld: 0, error: `scrape: ${errorMessage(e)}` };
  }
}

export async function collectFromSource(
  def: SourceDef,
  now: number = Date.now(),
  trace?: Array<Record<string, unknown>>,
): Promise<CollectResult> {
  // Scrape-only sources never use RSS/Atom feeds, neither configured nor auto-discovered.
  if (def.scrape) return collectByScraping(def, now, trace);

  const errors: string[] = [];
  const tried = new Set<string>();

  const tryFeed = async (url: string): Promise<{ url: string; items: RawArticle[] } | null> => {
    if (tried.has(url)) return null;
    tried.add(url);
    try {
      const items = await parseFeed(def, url);
      if (items.length > 0) return { url, items };
      errors.push(`${url}: feed has no items`);
    } catch (e) {
      errors.push(`${url}: ${errorMessage(e)}`);
    }
    return null;
  };

  let feed: { url: string; items: RawArticle[] } | null = null;
  for (const url of def.feeds ?? []) {
    feed = await tryFeed(url);
    if (feed) break;
  }
  if (!feed) {
    const discovered = await discoverFeed(def.url);
    if (discovered) feed = await tryFeed(discovered);
    else errors.push('no feed link found on the page');
  }

  if (feed) {
    // Age filter first, THEN the limit: a stale head of the feed must not use up the quota.
    const fresh = feed.items.filter((a) => now - a.publishedAt.getTime() <= MAX_ARTICLE_AGE_MS && !def.excludeUrl?.test(a.url));
    fresh.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    return {
      articles: fresh.slice(0, def.limit),
      feedUrl: feed.url,
      method: 'feed',
      seen: feed.items.length,
      skippedOld: feed.items.length - fresh.length,
    };
  }

  return { articles: [], feedUrl: null, method: null, seen: 0, skippedOld: 0, error: errors.join('; ') };
}

/**
 * Read-only check: runs only the collect step for every configured source and
 * reports what would be ingested. Nothing is written and no summaries are generated.
 */
/** At most this many articles are sent to Claude by one dry run with `enrich` (it is an unauthenticated endpoint). */
const DRY_RUN_ENRICH_MAX = 4;

export async function checkSources(now: number = Date.now(), only?: string[], enrich = false): Promise<Record<string, unknown>> {
  const defs = only?.length ? SOURCES.filter((d) => only.includes(d.id)) : SOURCES;
  const collected = await mapPool(defs, SOURCE_CONCURRENCY, async (def) => {
    const trace: Array<Record<string, unknown>> = [];
    return { def, trace, result: await collectFromSource(def, now, trace) };
  });

  // Optional: summarise the newest article of each selected source, exactly as the ingest would, without writing it.
  const enriched = enrich && only?.length
    ? await mapPool(
        collected.filter(({ result }) => result.articles.length > 0).slice(0, DRY_RUN_ENRICH_MAX),
        DRY_RUN_ENRICH_MAX,
        async ({ def, result }) => {
          const raw = result.articles[0];
          const prepared = await prepareArticle({ def, raw, canonicalUrl: raw.url, articleId: 'dry-run' }, Date.now() + ENRICH_DEADLINE_MS);
          const { row } = prepared;
          return {
            sourceId: def.id,
            url: raw.url,
            engine: prepared.engine,
            fallbackReason: prepared.fallbackReason,
            publishable: prepared.publishable,
            title: row.title,
            importance: row.importance,
            forYou: row.forYou,
            fromTeaser: row.fromTeaser,
            summary: row.summary,
          };
        },
      )
    : undefined;

  return {
    dryRun: true,
    ...(enriched ? { enriched } : {}),
    maxAgeDays: MAX_ARTICLE_AGE_DAYS,
    sources: collected.map(({ def, result, trace }) => ({
      sourceId: def.id,
      name: def.name,
      category: def.category,
      method: result.method,
      feedUrl: result.feedUrl,
      offered: result.seen,
      skippedOld: result.skippedOld,
      kept: result.articles.length,
      ...(result.error ? { error: result.error } : {}),
      // Scrape sources only: what happened to the listing page and to each link.
      ...(def.scrape ? { trace } : {}),
      articles: result.articles.map((a) => ({
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt.toISOString(),
        bodyChars: a.content?.length ?? 0,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. Enrich
// ---------------------------------------------------------------------------

interface Candidate {
  def: SourceDef;
  raw: RawArticle;
  canonicalUrl: string;
  articleId: string;
}

interface PreparedArticle {
  row: Prisma.ArticleCreateManyInput;
  engine: 'ai' | 'fallback';
  fallbackReason?: string;
  /** False for a non-English article that could not be translated: it is not written to the feed. */
  publishable: boolean;
  /** Text used for the story-grouping embedding (English headline + start of the summary). */
  embedText: string;
}

async function prepareArticle(c: Candidate, deadline: number): Promise<PreparedArticle> {
  const { def, raw } = c;
  let content = raw.content ?? '';

  // The summary should reflect the whole article, so fetch the page unless the feed already carries it.
  if (content.length < FULL_TEXT_MIN_CHARS && deadline - Date.now() > FETCH_MIN_REMAINING_MS) {
    const fetched = await fetchArticleText(c.canonicalUrl);
    if (fetched && fetched.length > content.length) content = fetched;
  }

  const lang = def.lang ?? 'en';
  const input = {
    sourceName: def.name,
    sourceLang: lang,
    title: raw.title,
    excerpt: raw.excerpt,
    content: content || undefined,
  };
  const enrichment =
    Date.now() < deadline ? await enrichArticle(input) : await enrichFallback(input, 'ingest time budget exhausted');

  // Everything the site shows is English. For a translated article the stored headline and excerpt
  // are the English ones; the original-language headline is one click away on the source site.
  // The extractive fallback cannot translate, so a non-English article without a Claude summary is dropped.
  // An English-language source can still carry an article in another language (Politico's French
  // Playbook): Claude then returns an English headline, which is used like a translation.
  const titleEn = enrichment.titleEn?.trim();
  const translated = lang !== 'en' || (enrichment.engine === 'ai' && !!titleEn && titleEn !== raw.title.trim());
  const publishable = lang === 'en' || enrichment.engine === 'ai';
  const title = translated ? enrichment.titleEn || raw.title : raw.title;
  const excerpt = translated ? summaryPreview(enrichment.summary, 240) : raw.excerpt;

  // Embedded later in one batch for all articles (see runIngest).
  const embedText = [title, summaryToPlainText(enrichment.summary).split(/\s+/).slice(0, 80).join(' ')].filter(Boolean).join('. ');

  return {
    engine: enrichment.engine,
    fallbackReason: enrichment.fallbackReason,
    publishable,
    embedText,
    row: {
      id: c.articleId,
      sourceId: def.id,
      canonicalUrl: c.canonicalUrl,
      originalUrl: raw.url,
      title,
      titleEn: enrichment.titleEn,
      excerpt,
      content: content || null,
      publishedAt: raw.publishedAt,
      author: raw.author ?? null,
      lang,
      summary: enrichment.summary,
      importance: enrichment.importance,
      forYou: enrichment.forYou,
      fromTeaser: isSnippet({ excerpt: raw.excerpt, content }),
      areas: enrichment.areas.map((a) => a.area).join(','),
      // The category is fixed by the source configuration, not by the model.
      primaryArea: def.category,
      areaConfidences: JSON.stringify(enrichment.areas),
      topics: enrichment.topics.join(','),
      entities: enrichment.entities.join(','),
      imageUrl: raw.imageUrl ?? null,
      isPaywalled: false,
      isWireOrigin: false,
      lowConfidenceTag: false,
      embedding: null,
      isInDailyFeed: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface IngestOutcome {
  status: number;
  body: Record<string, unknown>;
}

export async function runIngest(sources: Source[]): Promise<IngestOutcome> {
  const startedAt = Date.now();
  const activeIds = new Set(sources.map((s) => s.id));
  const defs = SOURCES.filter((d) => activeIds.has(d.id));

  if (defs.length === 0) {
    console.error('[ingest] No active sources match the source configuration — aborting without delete');
    return { status: 400, body: { error: 'No active sources configured' } };
  }

  // --- 1. collect ---
  const collected = await mapPool(defs, SOURCE_CONCURRENCY, async (def) => ({ def, result: await collectFromSource(def, startedAt) }));

  await Promise.all(
    collected.map(({ def, result }) =>
      prisma.source
        .update({
          where: { id: def.id },
          data: result.error
            ? { lastErrorAt: new Date(), lastError: result.error.slice(0, 500), consecutiveErrors: { increment: 1 } }
            : { lastFetchedAt: new Date(), consecutiveErrors: 0, lastError: null, ...(result.feedUrl ? { feedUrl: result.feedUrl } : {}) },
        })
        .catch((e) => console.error(`[ingest] could not record status for ${def.id}:`, errorMessage(e))),
    ),
  );

  const candidates: Candidate[] = [];
  const seenIds = new Set<string>();
  for (const { def, result } of collected) {
    for (const raw of result.articles) {
      try {
        const canonicalUrl = await canonicalizeUrl(raw.url);
        const articleId = articleIdFromUrl(canonicalUrl);
        if (seenIds.has(articleId)) continue;
        seenIds.add(articleId);
        candidates.push({ def, raw, canonicalUrl, articleId });
      } catch {
        // Unparsable URL: skip the item.
      }
    }
  }

  const sourceReport = collected.map(({ def, result }) => ({
    sourceId: def.id,
    name: def.name,
    category: def.category,
    method: result.method,
    feedUrl: result.feedUrl,
    offered: result.seen,
    skippedOld: result.skippedOld,
    kept: candidates.filter((c) => c.def.id === def.id).length,
    ...(result.error ? { error: result.error } : {}),
  }));
  const sourceErrors = collected.filter(({ result }) => result.error).length;

  if (candidates.length === 0) {
    console.error('[ingest] No articles collected — keeping the existing feed');
    return {
      status: 502,
      body: { error: 'No articles collected; the existing feed was left untouched', maxAgeDays: MAX_ARTICLE_AGE_DAYS, sourceErrors, sources: sourceReport },
    };
  }

  // --- 2. enrich ---
  const deadline = startedAt + ENRICH_DEADLINE_MS;
  const allPrepared = await mapPool(candidates, ENRICH_CONCURRENCY, (c) => prepareArticle(c, deadline));
  const prepared = allPrepared.filter((p) => p.publishable);
  const untranslated = allPrepared
    .filter((p) => !p.publishable)
    .map((p) => ({ sourceId: p.row.sourceId, url: p.row.originalUrl, reason: p.fallbackReason ?? 'unknown' }));
  if (untranslated.length) console.error(`[ingest] ${untranslated.length} non-English article(s) left out: could not be translated`);

  if (prepared.length === 0) {
    console.error('[ingest] Nothing publishable after enrichment — keeping the existing feed');
    return {
      status: 502,
      body: { error: 'No articles could be prepared; the existing feed was left untouched', maxAgeDays: MAX_ARTICLE_AGE_DAYS, sourceErrors, untranslated, sources: sourceReport },
    };
  }

  // Story-grouping embeddings, all in one request. Without them articles are simply not grouped.
  let embeddings: Record<string, unknown>;
  try {
    const vectors = await embedMany(prepared.map((p) => p.embedText));
    prepared.forEach((p, i) => {
      p.row.embedding = JSON.stringify(vectors[i]);
    });
    embeddings = { embedded: vectors.length };
  } catch (e) {
    embeddings = { embedded: 0, error: errorMessage(e) };
    console.error('[ingest] embeddings failed:', errorMessage(e));
  }

  // --- 3. write: replace the previous feed in one transaction ---
  await prisma.$transaction([
    prisma.articleRead.deleteMany(),
    prisma.articleSaved.deleteMany(),
    prisma.cluster.deleteMany(),
    prisma.article.deleteMany(),
    prisma.article.createMany({ data: prepared.map((p) => p.row), skipDuplicates: true }),
  ]);
  const written = prepared.length;
  console.log(`[ingest] wrote ${written} articles from ${defs.length} sources`);

  // --- 4. cluster ---
  let clusterResult = null;
  try {
    clusterResult = await recomputeClusters();
    console.log(`[ingest] clustering: ${clusterResult.totalClusters} clusters, ${clusterResult.multiSourceClusters} multi-source`);
  } catch (e) {
    console.error('[ingest] clustering failed:', errorMessage(e));
  }

  const categoryFill: Record<string, { target: number; selected: number; shortfall: number }> = {};
  for (const [area, target] of Object.entries(DAILY_FEED_TARGETS)) {
    const selected = prepared.filter((p) => p.row.primaryArea === area).length;
    categoryFill[area] = { target, selected, shortfall: Math.max(0, target - selected) };
  }

  const aiCount = prepared.filter((p) => p.engine === 'ai').length;
  const fallbackReasons = [...new Set(prepared.map((p) => p.fallbackReason).filter((r): r is string => !!r))];

  return {
    status: 200,
    body: {
      maxAgeDays: MAX_ARTICLE_AGE_DAYS,
      totalFetched: sourceReport.reduce((n, s) => n + s.offered, 0),
      totalNew: written,
      totalEnriched: written,
      totalSelected: written,
      written,
      sourceErrors,
      // How many summaries Claude wrote vs. the extractive fallback. Fallback summaries are lower quality.
      enrichment: { ai: aiCount, fallback: written - aiCount, fallbackReasons, untranslatedSkipped: untranslated.length, untranslated },
      categoryFill,
      embeddings,
      clusters: clusterResult,
      durationMs: Date.now() - startedAt,
      sources: sourceReport,
    },
  };
}
