import * as cheerio from 'cheerio';
import { extractArticleText, extractPageMeta } from '@/lib/ingest/pageMeta';
import { canonicalizeUrl } from '@/lib/ingest/canonicalize';
import { fetchPublicHtml } from './2026-11-09-safe-fetch';
import { FactCheckFailure } from './2026-11-13-failure';

type Fetcher = (url: string) => Promise<{ html: string; url: string }>;

export async function extractArticle(url: string, fetcher: Fetcher = fetchPublicHtml) {
  const fetched = await fetcher(url);
  const $ = cheerio.load(fetched.html);
  const meta = extractPageMeta($, fetched.url);
  const language = $('html').attr('lang')?.slice(0, 20) ?? null;
  const pageText = $('body').text().replace(/\s+/g, ' ');
  const structuredPaywall = $('script[type="application/ld+json"]').toArray().some((node) => /"isAccessibleForFree"\s*:\s*(?:false|"false")/i.test($(node).text()));
  if (structuredPaywall || /subscribe to (?:continue|read)|sign in to continue reading|log in to continue reading/i.test(pageText)) throw new FactCheckFailure('article_paywall', 'Article may be paywalled or require sign-in');
  const content = extractArticleText($);
  if (!meta.title || !content || content.length < 800 || content.length >= 20_000) throw new FactCheckFailure('article_text', 'Article text is unavailable, incomplete, or exceeds the extraction limit');
  return { canonicalUrl: await canonicalizeUrl(fetched.url), title: meta.title, publisher: meta.siteName, author: meta.author, publishedAt: meta.publishedAt, language, content };
}
