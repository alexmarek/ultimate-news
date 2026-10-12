// lib/ingest/pageMeta.ts
// Helpers for reading an article or listing page: fetching HTML, extracting
// the main body text, publication metadata (JSON-LD / <meta> / <time>) and the
// article links on a listing page. Used by fetchArticleText and scrapeListing.

import * as cheerio from 'cheerio';

export type Doc = cheerio.CheerioAPI;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface FetchResult {
  html: string | null;
  /** HTTP status, or null if the request failed before a response (timeout, DNS, TLS). */
  status: number | null;
  error?: string;
  /** Selected response headers of a failed request (redirect target, server, cookie names), for diagnostics. */
  diag?: Record<string, string>;
}

function failureDiagnostics(response: Response): Record<string, string> {
  const diag: Record<string, string> = {};
  for (const h of ['location', 'server', 'via', 'content-type', 'x-cache', 'cf-ray']) {
    const v = response.headers.get(h);
    if (v) diag[h] = v.slice(0, 200);
  }
  // Names only: cookie values are not needed to see that a site wants a consent cookie.
  const cookies = response.headers.getSetCookie?.().map((c) => c.split('=')[0]) ?? [];
  if (cookies.length) diag['set-cookie'] = cookies.join(', ');
  return diag;
}

/** Like fetchHtml, but says why a fetch failed (used for diagnostics). */
export async function fetchHtmlResult(url: string, timeoutMs = 8000): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) return { html: null, status: response.status, error: `HTTP ${response.status}`, diag: failureDiagnostics(response) };
    return { html: await response.text(), status: response.status };
  } catch (e) {
    return { html: null, status: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  return (await fetchHtmlResult(url, timeoutMs)).html;
}

/** Upper bound on stored article text. The summariser reads the first ~16k characters. */
const MAX_TEXT_CHARS = 20000;

/**
 * Main body text of an article page, paragraphs separated by blank lines.
 * NOTE: removes <script>/<nav>/... from the document, so read metadata
 * (extractPageMeta) first.
 */
export function extractArticleText($: Doc): string | undefined {
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

  const text = paragraphs.join('\n\n').slice(0, MAX_TEXT_CHARS);
  return text.length > 200 ? text : undefined;
}

export interface PageMeta {
  siteName: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  publishedAt: Date | null;
  author: string | null;
}

export function parsePlausibleDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 2000 || d.getTime() > Date.now() + 2 * 24 * 60 * 60 * 1000) return null;
  return d;
}

function findInJsonLd(node: unknown, keys: string[], depth = 0): string | null {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findInJsonLd(n, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const k of keys) if (typeof obj[k] === 'string') return obj[k] as string;
    for (const v of Object.values(obj)) {
      const found = findInJsonLd(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const DATE_META_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[property="og:article:published_time"]',
  'meta[name="article:published_time"]',
  'meta[itemprop="datePublished"]',
  'meta[name="date"]',
  'meta[name="publish-date"]',
  'meta[name="pubdate"]',
  'meta[name="DC.date.issued"]',
  'meta[name="dcterms.created"]',
];

export function extractPublishedAt($: Doc, pageUrl: string): Date | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const found = findInJsonLd(JSON.parse($(el).text()), ['datePublished', 'dateCreated']);
      const d = parsePlausibleDate(found);
      if (d) return d;
    } catch {
      // Malformed JSON-LD is common; try the next source.
    }
  }

  for (const selector of DATE_META_SELECTORS) {
    const d = parsePlausibleDate($(selector).first().attr('content'));
    if (d) return d;
  }

  for (const selector of ['article time[datetime]', 'main time[datetime]', 'time[datetime]']) {
    const d = parsePlausibleDate($(selector).first().attr('datetime'));
    if (d) return d;
  }

  const urlDate = pageUrl.match(/\/(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])(?:\/|$|[-_])/);
  if (urlDate) return parsePlausibleDate(`${urlDate[1]}-${urlDate[2]}-${urlDate[3]}T00:00:00Z`);

  return null;
}

function metaContent($: Doc, selectors: string[]): string | null {
  for (const s of selectors) {
    const v = $(s).first().attr('content')?.replace(/\s+/g, ' ').trim();
    if (v) return v;
  }
  return null;
}

/** "Headline - Site Name" -> "Headline" (only when the suffix really is the site name). */
export function stripSiteSuffix(title: string, ...siteNames: Array<string | null | undefined>): string {
  let out = title;
  for (const name of siteNames) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\s*[-\u2013\u2014|:\u00B7]\\s*${escaped}\\s*$`, 'i'), '').trim() || out;
  }
  return out;
}

export function extractPageMeta($: Doc, pageUrl: string, configuredSiteName?: string): PageMeta {
  const siteName = metaContent($, ['meta[property="og:site_name"]']);
  const rawTitle =
    metaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    null;
  const title = rawTitle ? stripSiteSuffix(rawTitle, siteName, configuredSiteName) : null;

  const description = metaContent($, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);

  let image = metaContent($, ['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = null;
    }
  }

  return {
    siteName,
    title,
    description,
    image,
    publishedAt: extractPublishedAt($, pageUrl),
    author: metaContent($, ['meta[name="author"]', 'meta[property="article:author"]']),
  };
}

export interface ListingLink {
  url: string;
  text: string;
  /** Publish date shown next to the link on the listing page (<time datetime>), if any. */
  date: Date | null;
}

const ASSET_EXTENSION = /\.(?:jpe?g|png|gif|svg|webp|css|js|pdf|zip|xml|json|mp3|mp4)$/i;

/** Article-like links on a listing page, in document order (newest first on most sites). */
export function extractListingLinks($: Doc, pageUrl: string, max: number): ListingLink[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const out: ListingLink[] = [];

  $('a[href]').each((_, el) => {
    if (out.length >= max) return;
    const $el = $(el);
    if ($el.closest('nav, footer, [role="navigation"], [role="banner"], body > header').length) return;

    let url: URL;
    try {
      url = new URL($el.attr('href') ?? '', base);
    } catch {
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    url.hash = '';
    if (ASSET_EXTENSION.test(url.pathname)) return;
    if (url.pathname === '/' || url.href === base.href) return;

    const text = $el.text().replace(/\s+/g, ' ').trim();
    const inHeading = $el.closest('h1, h2, h3, h4, h5').length > 0 || $el.find('h1, h2, h3, h4, h5').length > 0;
    const inCard = $el.closest('article, .views-row, li').length > 0;
    if (!inHeading && !(inCard && text.length >= 25)) return;
    if (!inHeading && text.length < 12) return;

    if (seen.has(url.href)) return;
    seen.add(url.href);
    const date = parsePlausibleDate($el.closest('article, li, .views-row').find('time[datetime]').first().attr('datetime'));
    out.push({ url: url.href, text, date });
  });

  return out;
}
