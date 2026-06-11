// lib/ingest/extractImage.ts
//
// Pull an image URL from a feed item or a scraped HTML element.
// Extraction priority:
//   1. media:content / media:thumbnail  (RSS only — explicit feed images)
//   2. enclosure                        (RSS only — older feed convention)
//   3. og:image / twitter:image         (HTML — populated by most CMSes)
//   4. content:encoded first <img>      (RSS only)
//   5. first <img> in the listing block (HTML scrape — last resort)
//
// Returns undefined when nothing usable was found. The frontend handles
// missing images by skipping the image block; no placeholder fallback here.

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// RSS — handle the irregular shapes rss-parser hands back
// ---------------------------------------------------------------------------
type AnyRssItem = Record<string, unknown>;

export function extractImageFromRssItem(item: AnyRssItem): string | undefined {
  // 1. media:content (sometimes an object, sometimes an array)
  const mediaContent = (item.mediaContent ?? item['media:content']) as
    | { $?: { url?: string }; url?: string }
    | Array<{ $?: { url?: string }; url?: string }>
    | undefined;

  if (Array.isArray(mediaContent)) {
    for (const m of mediaContent) {
      const url = m?.$?.url ?? m?.url;
      if (url && isPlausibleImage(url)) return url;
    }
  } else if (mediaContent) {
    const url = mediaContent.$?.url ?? mediaContent.url;
    if (url && isPlausibleImage(url)) return url;
  }

  // 1b. media:group wrapper (some feeds wrap media:content inside media:group)
  const mediaGroup = (item.mediaGroup ?? item['media:group']) as
    | { $?: Record<string, unknown>; mediaContent?: Array<{ $?: { url?: string }; url?: string }>; ['media:content']?: Array<{ $?: { url?: string }; url?: string }> }
    | undefined;
  if (mediaGroup) {
    const contents = mediaGroup.mediaContent ?? mediaGroup['media:content'];
    if (Array.isArray(contents)) {
      for (const m of contents) {
        const url = m?.$?.url ?? m?.url;
        if (url && isPlausibleImage(url)) return url;
      }
    }
  }

  // 2. media:thumbnail
  const mediaThumbnail = (item.mediaThumbnail ?? item['media:thumbnail']) as
    | { $?: { url?: string }; url?: string }
    | Array<{ $?: { url?: string }; url?: string }>
    | undefined;

  if (Array.isArray(mediaThumbnail)) {
    for (const t of mediaThumbnail) {
      const url = t?.$?.url ?? t?.url;
      if (url && isPlausibleImage(url)) return url;
    }
  } else if (mediaThumbnail) {
    const url = mediaThumbnail.$?.url ?? mediaThumbnail.url;
    if (url && isPlausibleImage(url)) return url;
  }

  // 3. enclosure (older feeds, podcasts, sometimes images)
  const enclosure = (item.enclosure ?? item['enclosure']) as { url?: string; type?: string } | undefined;
  if (enclosure?.url && enclosure.type?.startsWith('image/')) {
    return enclosure.url;
  }

  // 4. content:encoded — first <img>
  const contentEncoded = (item.contentEncoded ?? item['content:encoded'] ?? item.content) as string | undefined;
  if (typeof contentEncoded === 'string') {
    const fromHtml = firstImgInHtml(contentEncoded);
    if (fromHtml) return fromHtml;
  }

  // 5. content / description as a last-ditch parse
  const content = (item.content ?? item.description) as string | undefined;
  if (typeof content === 'string') {
    const fromHtml = firstImgInHtml(content);
    if (fromHtml) return fromHtml;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// og:image fallback — fetch the article page and look for meta tags
// ---------------------------------------------------------------------------
export async function fetchOgImage(articleUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(articleUrl, {
      headers: { 'User-Agent': 'UltimateNews/1.0 (+contact@example.com)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) return undefined;

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content');

    if (ogImage) {
      const abs = absolutize(ogImage, articleUrl);
      if (abs && isPlausibleImage(abs)) return abs;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// HTML scrape — listing-page element
// ---------------------------------------------------------------------------
type CheerioElement = ReturnType<cheerio.CheerioAPI>;

export function extractImageFromHtml(
  $el: CheerioElement,
  baseUrl: string,
): string | undefined {
  // Try <img> inside the listing element
  const imgSrc = $el.find('img').first().attr('src')
    || $el.find('img').first().attr('data-src')
    || $el.find('img').first().attr('data-lazy-src');
  if (imgSrc) {
    const abs = absolutize(imgSrc, baseUrl);
    if (abs && isPlausibleImage(abs)) return abs;
  }

  // Try srcset — take the first URL
  const srcset = $el.find('img').first().attr('srcset');
  if (srcset) {
    const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
    if (first) {
      const abs = absolutize(first, baseUrl);
      if (abs && isPlausibleImage(abs)) return abs;
    }
  }

  // Try background-image style on a child element
  const bgStyle = $el.find('[style*="background-image"]').first().attr('style');
  if (bgStyle) {
    const match = bgStyle.match(/url\(['"]?([^'")]+)['"]?\)/);
    if (match?.[1]) {
      const abs = absolutize(match[1], baseUrl);
      if (abs && isPlausibleImage(abs)) return abs;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function firstImgInHtml(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function absolutize(href: string, baseUrl: string): string | undefined {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

// Filter out 1px trackers, sprite sheets, obvious icons. [Inference] heuristic
// based on common patterns; tune if you see false positives in real data.
function isPlausibleImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('1x1') || lower.includes('pixel.gif') || lower.includes('tracker')) return false;
  if (lower.endsWith('.svg') && lower.includes('icon')) return false;
  if (lower.includes('sprite')) return false;
  return true;
}
