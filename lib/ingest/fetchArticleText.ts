// lib/ingest/fetchArticleText.ts
//
// Fetches the article page and extracts the main body text.
// Used during ingestion when the RSS feed only provides a short excerpt,
// so enrichment (and summaries) have real content to work with.

import * as cheerio from 'cheerio';

export async function fetchArticleText(articleUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) return undefined;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header, aside, form, iframe, noscript').remove();

    // Prefer semantic article containers
    let paragraphs: string[] = [];
    $('article p, main p, [itemprop="articleBody"] p, .article-body p, .entry-content p, .post-content p').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 40) paragraphs.push(t);
    });

    // Fallback: any substantial <p> on the page
    if (paragraphs.length < 2) {
      paragraphs = [];
      $('p').each((_, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (t.length > 60) paragraphs.push(t);
      });
    }

    const text = paragraphs.join('\n\n').slice(0, 6000);
    return text.length > 200 ? text : undefined;
  } catch {
    return undefined;
  }
}
