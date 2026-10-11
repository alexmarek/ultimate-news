// lib/ingest/fetchArticleText.ts
//
// Fetches the article page and extracts the main body text.
// Used during ingestion when the RSS feed only provides a short excerpt,
// so enrichment (and summaries) have the full article to work with.

import * as cheerio from 'cheerio';
import { extractArticleText, fetchHtml } from '@/lib/ingest/pageMeta';

export async function fetchArticleText(articleUrl: string): Promise<string | undefined> {
  const html = await fetchHtml(articleUrl);
  if (!html) return undefined;
  try {
    return extractArticleText(cheerio.load(html));
  } catch {
    return undefined;
  }
}
