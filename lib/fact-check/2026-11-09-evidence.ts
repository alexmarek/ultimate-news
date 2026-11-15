import { randomUUID } from 'node:crypto';
import * as cheerio from 'cheerio';
import { canonicalizeUrl } from '@/lib/ingest/canonicalize';
import { extractArticleText, extractPageMeta } from '@/lib/ingest/pageMeta';
import { fetchPublicHtml } from './2026-11-09-safe-fetch';

export interface RetrievedEvidence {
  id: string;
  claimId: string;
  url: string;
  title: string;
  publisher: string | null;
  publishedAt: Date | null;
  retrievedAt: Date;
  /** Kept only in memory during evaluation, not reproduced in the public report. */
  content: string;
}

/** A search result becomes evidence only after independently fetching its contents. */
export async function retrieveEvidence({ claimId, candidates, articleUrl, fetcher = fetchPublicHtml }: {
  claimId: string; candidates: string[]; articleUrl: string; fetcher?: typeof fetchPublicHtml;
}): Promise<RetrievedEvidence[]> {
  const original = await canonicalizeUrl(articleUrl);
  const seen = new Set<string>();
  const records: RetrievedEvidence[] = [];
  for (const candidate of candidates.slice(0, 5)) {
    try {
      const normalized = await canonicalizeUrl(candidate);
      if (normalized === original || seen.has(normalized)) continue;
      const fetched = await fetcher(normalized);
      const finalUrl = await canonicalizeUrl(fetched.url);
      if (finalUrl === original || seen.has(finalUrl)) continue;
      seen.add(finalUrl);
      const $ = cheerio.load(fetched.html);
      const meta = extractPageMeta($, finalUrl);
      const content = extractArticleText($);
      if (!meta.title || !content) continue;
      records.push({ id: randomUUID(), claimId, url: finalUrl, title: meta.title, publisher: meta.siteName, publishedAt: meta.publishedAt, retrievedAt: new Date(), content });
    } catch {
      // Inaccessible sources cannot support a claim; continue with other candidates.
    }
  }
  return records;
}

/** A model-proposed quotation is acceptable only if present in retrieved content. */
export function isRetrievedExcerpt(record: RetrievedEvidence, excerpt: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const value = normalize(excerpt);
  return value.length >= 20 && value.length <= 500 && normalize(record.content).includes(value);
}
