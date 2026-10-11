// lib/ingest/scrapeListing.ts
// Ingest for sources configured with `scrape: true` (no RSS/Atom feed is used):
// read the article links off a listing page, then open each linked page and read
// its metadata (title, description, image, publish date) and body text.
//
// Only pages with a machine-readable publish date (on the page itself or next to
// the link on the listing) are kept, because the 14-day freshness rule can't be
// applied otherwise. Anything that isn't an article (menus, topic pages, PDFs)
// fails that test and is dropped.

import * as cheerio from 'cheerio';
import type { RawArticle } from '@/lib/types';
import { extractArticleText, extractListingLinks, extractPageMeta, fetchHtml } from '@/lib/ingest/pageMeta';
import { mapPool } from '@/lib/ingest/pool';

export interface ScrapeOptions {
  /** Maximum articles to return (newest first). */
  limit: number;
  /** Articles older than this many ms are dropped. */
  maxAgeMs: number;
  /** Maximum linked pages to open. */
  maxCandidates?: number;
  now?: number;
}

export async function scrapeListing(pageUrl: string, opts: ScrapeOptions): Promise<RawArticle[]> {
  const now = opts.now ?? Date.now();
  const html = await fetchHtml(pageUrl);
  if (!html) throw new Error(`Could not fetch ${pageUrl}`);

  const links = extractListingLinks(cheerio.load(html), pageUrl, opts.maxCandidates ?? 14);
  if (links.length === 0) throw new Error('No article links found on the listing page');

  const pages = await mapPool(links, 4, async (link): Promise<RawArticle | null> => {
    // A date shown on the listing that is already too old saves opening the page.
    if (link.date && now - link.date.getTime() > opts.maxAgeMs) return null;
    const body = await fetchHtml(link.url);
    if (!body) return null;
    const $ = cheerio.load(body);
    // Metadata first: extractArticleText strips <script> tags (incl. JSON-LD).
    const meta = extractPageMeta($, link.url);
    const publishedAt = meta.publishedAt ?? link.date;
    if (!publishedAt) return null;
    const content = extractArticleText($);
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
