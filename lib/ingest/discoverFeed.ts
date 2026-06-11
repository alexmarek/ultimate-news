// lib/ingest/discoverFeed.ts
// Attempt to discover an RSS/Atom feed URL from a website's HTML.
// Returns null if none found.

import * as cheerio from 'cheerio';

export async function discoverFeed(siteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(siteUrl, {
      headers: {
        'User-Agent': 'UltimateNews/1.0 (+contact@example.com)',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check common feed link patterns
    const feedLinks = $('link[type="application/rss+xml"], link[type="application/atom+xml"]');

    for (const link of feedLinks) {
      const href = $(link).attr('href');
      if (href) {
        try {
          const url = new URL(href, siteUrl);
          return url.toString();
        } catch {
          continue;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}