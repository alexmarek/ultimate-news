// lib/ingest/scrapeListing.ts
// Ingest for sources configured with `scrape: true` (no RSS/Atom feed is used):
// read the article links off a listing page, then open each linked page and read
// its metadata (title, description, image, publish date) and body text.
//
// Only pages with a machine-readable publish date (on the page itself or next to
// the link on the listing) are kept, because the freshness rule (14 days for
// news, longer for curated categories such as Travel) can't be applied
// otherwise. Anything that isn't an article (menus, topic pages, PDFs) fails
// that test and is dropped.

import * as cheerio from 'cheerio';
import type { RawArticle } from '@/lib/types';
import { extractArticleText, extractListingLinks, extractPageMeta, fetchHtmlResult } from '@/lib/ingest/pageMeta';
import { mapPool } from '@/lib/ingest/pool';

export interface ScrapeOptions {
  /** Maximum articles to return (newest first). */
  limit: number;
  /** Articles older than this many ms are dropped. */
  maxAgeMs: number;
  /** Maximum linked pages to open. */
  maxCandidates?: number;
  /** Source name, stripped from the end of page titles ("Headline - Source"). */
  siteName?: string;
  /** Only links whose URL matches are treated as articles (e.g. a blog's dated post paths). */
  includeUrl?: RegExp;
  /** Links for which this returns true are not opened (e.g. articles already judged on an earlier day). */
  skipUrl?: (url: string) => boolean;
  /** If given, receives one entry per step/link explaining what happened (for the dry-run report). */
  trace?: Array<Record<string, unknown>>;
  now?: number;
}

export async function scrapeListing(pageUrl: string, opts: ScrapeOptions): Promise<RawArticle[]> {
  const now = opts.now ?? Date.now();
  const listing = await fetchHtmlResult(pageUrl);
  opts.trace?.push({ step: 'listing', url: pageUrl, status: listing.status, error: listing.error, diag: listing.diag, bytes: listing.html?.length ?? 0 });
  if (!listing.html) throw new Error(`Could not fetch ${pageUrl} (${listing.error ?? 'no response'})`);

  const links = extractListingLinks(cheerio.load(listing.html), pageUrl, opts.maxCandidates ?? 14, opts.includeUrl);
  opts.trace?.push({ step: 'links', found: links.length });
  if (links.length === 0) throw new Error('No article links found on the listing page');

  const pages = await mapPool(links, 4, async (link): Promise<RawArticle | null> => {
    const note = (outcome: string, extra: Record<string, unknown> = {}) =>
      opts.trace?.push({ step: 'link', url: link.url, text: link.text.slice(0, 80), cardDate: link.date?.toISOString() ?? null, outcome, ...extra });

    if (opts.skipUrl?.(link.url)) {
      note('skipped: already considered');
      return null;
    }
    // A date shown on the listing that is already too old saves opening the page.
    if (link.date && now - link.date.getTime() > opts.maxAgeMs) {
      note('skipped: listing date too old');
      return null;
    }
    const page = await fetchHtmlResult(link.url);
    if (!page.html) {
      note('page fetch failed', { status: page.status, error: page.error, diag: page.diag });
      return null;
    }
    const $ = cheerio.load(page.html);
    // Metadata first: extractArticleText strips <script> tags (incl. JSON-LD).
    const meta = extractPageMeta($, link.url, opts.siteName);
    const publishedAt = meta.publishedAt ?? link.date;
    if (!publishedAt) {
      note('dropped: no publish date found', { title: meta.title });
      return null;
    }
    const content = extractArticleText($);
    note(now - publishedAt.getTime() > opts.maxAgeMs ? 'dropped: too old' : 'kept', { title: meta.title, publishedAt: publishedAt.toISOString(), bodyChars: content?.length ?? 0 });
    return {
      url: link.url,
      title: meta.title || link.text,
      excerpt: meta.description || '',
      content,
      publishedAt,
      author: meta.author ?? undefined,
      imageUrl: meta.image ?? undefined,
    };
  });

  const fresh = pages
    .filter((p): p is RawArticle => p !== null && now - p.publishedAt.getTime() <= opts.maxAgeMs)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return fresh.slice(0, opts.limit);
}
