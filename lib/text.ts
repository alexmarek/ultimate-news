// lib/text.ts
// HTML stripping and entity decoding for RSS-derived text.

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&hellip;': '\u2026',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
};

// Numeric references outside the Unicode range are malformed; keep them as
// literal text instead of letting String.fromCodePoint throw a RangeError.
function codePointOr(code: number, original: string): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (m, n) => codePointOr(Number(n), m))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => codePointOr(parseInt(h, 16), m))
    .replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m] ?? m);
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Common English function words, ignored when comparing or scoring text. */
export const STOPWORDS = new Set(
  ('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just may me more most my no nor not of off on once only or other our out over own said says same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your')
    .split(' '),
);
