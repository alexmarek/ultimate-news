// Splits text into plain and matching parts so search results can wrap the matches in <mark>.

export interface TextPart {
  text: string;
  match: boolean;
}

/** Words shorter than this are ignored: highlighting every "a" or "of" would just be noise. */
const MIN_TERM_LENGTH = 2;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every case-insensitive occurrence of any word of `query` in `text` becomes a `match` part.
 * Returns the whole text as one plain part when nothing matches (semantic search results often
 * don't contain the typed words).
 */
export function splitByMatches(text: string, query: string): TextPart[] {
  const terms = [...new Set(query.split(/\s+/).filter((t) => t.length >= MIN_TERM_LENGTH))].sort((a, b) => b.length - a.length);
  if (!text || terms.length === 0) return [{ text, match: false }];

  const pattern = new RegExp(`(?:${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), match: false });
    parts.push({ text: m[0], match: true });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
