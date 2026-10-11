// lib/summary.ts
// Format, sanitising and parsing of article summaries.
//
// A summary is stored as a small, safe subset of Markdown:
//   **lead sentence(s)**          bold first paragraph = the main message
//   plain paragraphs              separated by blank lines
//   ## Heading                    short sub-heading (e.g. "Key points")
//   - bullet                      one distinct fact per line
//   **bold** and *italic*         inline emphasis only
//
// Everything here is pure (no I/O), so it is safe to import from client
// components and is covered by lib/summary.test.ts. Summaries are rendered as
// React elements (never as raw HTML), so model output cannot inject markup.

import { decodeEntities } from '@/lib/text';

export const MAX_SUMMARY_WORDS = 400;

export type SummaryBlock =
  | { type: 'lead'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] };

export interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

// ---------------------------------------------------------------------------
// Inline emphasis
// ---------------------------------------------------------------------------

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*(.+?)\*\*|\*(?!\s)([^*]+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ text: m[1], bold: true });
    else tokens.push({ text: m[2], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last) });
  return tokens;
}

/** Text with emphasis markers removed. */
export function stripInline(text: string): string {
  return parseInline(text).map((t) => t.text).join('');
}

/** Removes emphasis markers that are not properly paired, so none leak into the UI. */
function balanceInline(text: string): string {
  let out = text;
  if ((out.match(/\*\*/g) ?? []).length % 2 === 1) out = out.replace(/\*\*/g, '');
  const singles = (out.replace(/\*\*/g, '').match(/\*/g) ?? []).length;
  if (singles % 2 === 1) out = out.replace(/\*/g, '');
  return out;
}

export function countWords(text: string): number {
  return stripInline(text).split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Sentences and duplicate detection
// ---------------------------------------------------------------------------

const ABBREVIATIONS = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|No|Inc|Ltd|Co|Corp|Gen|Sen|Rep|Gov|Lt|Col|Sgt|Mt|Ft|approx)\./g;

export function splitSentences(text: string): string[] {
  const guarded = text
    .replace(ABBREVIATIONS, (m) => `${m.slice(0, -1)}\u0000`)
    .replace(/\b([A-Z])\./g, '$1\u0000') // initials and "U.S."
    .replace(/(\d)\.(\d)/g, '$1\u0001$2'); // decimals
  return guarded
    .split(/(?<=[.!?]["'”’)\]*]*)\s+(?=["'“‘(\[*]*[A-Z0-9])/)
    .map((s) => s.replace(/\u0000/g, '.').replace(/\u0001/g, '.').trim())
    .filter(Boolean);
}

function normalizeKey(text: string): string {
  return stripInline(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SeenEntry {
  key: string;
  words: Set<string>;
}

function toEntry(text: string): SeenEntry {
  const key = normalizeKey(text);
  return { key, words: new Set(key.split(' ').filter(Boolean)) };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** True if `text` repeats (exactly, by containment, or almost word-for-word) something already seen. */
export function isRepeat(text: string, seen: SeenEntry[]): boolean {
  const entry = toEntry(text);
  if (!entry.key) return true;
  for (const s of seen) {
    if (s.key === entry.key) return true;
    if (entry.words.size >= 6 && s.words.size >= 6 && (s.key.includes(entry.key) || entry.key.includes(s.key))) return true;
    if (entry.words.size >= 5 && s.words.size >= 5 && jaccard(entry.words, s.words) >= 0.8) return true;
  }
  return false;
}

/** True if `text` repeats `reference` (used to drop sentences that merely echo the headline). */
export function repeatsText(text: string, reference: string): boolean {
  return isRepeat(text, [toEntry(reference)]);
}

/** Keeps the first occurrence of each sentence; later repeats are dropped. */
export function dedupeSentences(sentences: string[]): string[] {
  const seen: SeenEntry[] = [];
  const out: string[] = [];
  for (const s of sentences) {
    if (isRepeat(s, seen)) continue;
    seen.push(toEntry(s));
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function cleanRaw(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<\s*(?:br|\/p|\/li|\/h[1-6])\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseSummary(summary: string | null | undefined): SummaryBlock[] {
  const text = cleanRaw(summary ?? '');
  if (!text) return [];

  const blocks: SummaryBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: stripInline(heading[1]) });
      continue;
    }
    const bullet = line.match(/^(?:[-*•–]|\d{1,2}[.)])\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  // The first paragraph is the lead (main message) when it is entirely bold, or when it opens
  // with one or more complete bold sentences followed by plain text ("**Lead.** Details...").
  const first = blocks[0];
  if (first?.type === 'paragraph') {
    if (first.text.startsWith('**') && first.text.endsWith('**') && first.text.length > 4 && !first.text.slice(2, -2).includes('**')) {
      blocks[0] = { type: 'lead', text: first.text.slice(2, -2) };
    } else {
      const split = splitBoldOpening(first.text);
      if (split) blocks.splice(0, 1, { type: 'lead', text: split.lead }, ...(split.rest ? [{ type: 'paragraph' as const, text: split.rest }] : []));
    }
  }
  return blocks;
}

/**
 * Splits "**Sentence one.** **Sentence two.** More text" into the bold sentences and the rest.
 * A bold span only counts when it is a full sentence (ends with punctuation; the first one needs 5+ words), so a
 * paragraph that merely starts with a bold name ("**Apple** announced ...") stays a paragraph.
 */
function splitBoldOpening(text: string): { lead: string; rest: string } | null {
  const lead: string[] = [];
  let rest = text;
  for (;;) {
    const m = rest.match(/^\*\*(.+?)\*\*\s*(\S[\s\S]*)?$/);
    if (!m || m[1].includes('**') || !ENDS_SENTENCE.test(m[1]) || (lead.length === 0 && countWords(m[1]) < 5)) break;
    lead.push(m[1]);
    rest = m[2] ?? '';
  }
  return lead.length ? { lead: lead.join(' '), rest } : null;
}

export function serializeSummary(blocks: SummaryBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'lead':
          return `**${balanceInline(b.text)}**`;
        case 'paragraph':
          return balanceInline(b.text);
        case 'heading':
          return `## ${stripInline(b.text)}`;
        case 'list':
          return b.items.map((i) => `- ${balanceInline(i)}`).join('\n');
      }
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Normalising: de-duplicate and enforce the word limit
// ---------------------------------------------------------------------------

function dedupeBlocks(blocks: SummaryBlock[]): SummaryBlock[] {
  const seen: SeenEntry[] = [];
  const keepIfNew = (s: string): boolean => {
    if (isRepeat(s, seen)) return false;
    seen.push(toEntry(s));
    return true;
  };

  const out: SummaryBlock[] = [];
  const headings = new Set<string>();
  for (const b of blocks) {
    if (b.type === 'heading') {
      const key = normalizeKey(b.text);
      if (!key || headings.has(key)) continue;
      headings.add(key);
      out.push(b);
    } else if (b.type === 'list') {
      const items = b.items.filter(keepIfNew);
      if (items.length) out.push({ type: 'list', items });
    } else {
      const sentences = splitSentences(b.text).filter(keepIfNew);
      if (sentences.length) out.push({ type: b.type, text: sentences.join(' ') });
    }
  }
  return out;
}

const ENDS_SENTENCE = /[.!?]["'”’)\]*]*$/;

function capWords(blocks: SummaryBlock[], maxWords: number, dropTrailingFragment: boolean): SummaryBlock[] {
  let remaining = maxWords;
  const out: SummaryBlock[] = [];

  for (const b of blocks) {
    if (remaining <= 0) break;

    if (b.type === 'heading') {
      remaining -= countWords(b.text);
      out.push(b);
      continue;
    }

    if (b.type === 'list') {
      const items: string[] = [];
      let overflow = false;
      for (const item of b.items) {
        const w = countWords(item);
        if (w > remaining) {
          overflow = true;
          break;
        }
        items.push(item);
        remaining -= w;
      }
      if (items.length) out.push({ type: 'list', items });
      if (overflow) break;
      continue;
    }

    const sentences = splitSentences(b.text);
    const kept: string[] = [];
    let overflow = false;
    for (const s of sentences) {
      const w = countWords(s);
      if (w > remaining) {
        overflow = true;
        break;
      }
      kept.push(s);
      remaining -= w;
    }
    if (kept.length === 0 && out.length === 0) {
      // A single oversized sentence at the very start: hard-cut it rather than return nothing.
      const words = stripInline(b.text).split(/\s+/).filter(Boolean).slice(0, remaining);
      out.push({ type: b.type, text: `${words.join(' ')}…` });
      break;
    }
    if (kept.length) out.push({ type: b.type, text: kept.join(' ') });
    if (overflow) break;
  }

  if (dropTrailingFragment && out.length) {
    const last = out[out.length - 1];
    if (last.type === 'paragraph' || last.type === 'lead') {
      const sentences = splitSentences(last.text);
      if (sentences.length && !ENDS_SENTENCE.test(sentences[sentences.length - 1])) {
        sentences.pop();
        if (sentences.length) out[out.length - 1] = { type: last.type, text: sentences.join(' ') };
        else out.pop();
      }
    } else if (last.type === 'list') {
      const items = last.items.slice();
      if (items.length && !ENDS_SENTENCE.test(items[items.length - 1])) items.pop();
      if (items.length) out[out.length - 1] = { type: 'list', items };
      else out.pop();
    }
  }

  // A heading with nothing after it is meaningless.
  while (out.length && out[out.length - 1].type === 'heading') out.pop();
  return out;
}

export interface NormalizeOptions {
  maxWords?: number;
  /** Set when the text may have been cut off mid-sentence (e.g. the model hit max_tokens). */
  dropTrailingFragment?: boolean;
}

/**
 * Cleans model or fallback output into a safe, repeat-free summary of at most
 * `maxWords` words. Returns '' if nothing usable is left.
 */
export function normalizeSummary(raw: string | null | undefined, opts: NormalizeOptions = {}): string {
  const maxWords = opts.maxWords ?? MAX_SUMMARY_WORDS;
  const blocks = capWords(dedupeBlocks(parseSummary(raw)), maxWords, opts.dropTrailingFragment ?? false);
  return serializeSummary(blocks);
}

// ---------------------------------------------------------------------------
// Cleaning model output
// ---------------------------------------------------------------------------

const META_SUBJECT = /\b(?:(?:the|this|that)\s+(?:excerpt|snippet)|provided\s+(?:text|article|content)|(?:text|article|content)\s+(?:provided|given|supplied)|available\s+(?:text|information|details))\b/i;
const META_LIMIT = /\b(?:does not|doesn't|do not|don't|did not|cannot|can't|only|lacks?|limited|too short|cuts? off|truncated|incomplete|no (?:further|more|additional)|not (?:contain|include|provide|specify|detail|mention|state))\b/i;

/** True for a sentence that talks about the text the model was given ("The excerpt does not contain...") rather than the story. */
export function isMetaCommentary(sentence: string): boolean {
  const plain = stripInline(sentence);
  return META_SUBJECT.test(plain) && META_LIMIT.test(plain);
}

/** Removes sentences and bullets that are meta-commentary; promotes the next paragraph if the lead was one. */
export function dropMetaCommentary(summary: string): string {
  const blocks = parseSummary(summary);
  const hadLead = blocks[0]?.type === 'lead';
  const kept: SummaryBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') kept.push(b);
    else if (b.type === 'list') {
      const items = b.items.filter((i) => !isMetaCommentary(i));
      if (items.length) kept.push({ type: 'list', items });
    } else {
      const text = splitSentences(b.text).filter((s) => !isMetaCommentary(s)).join(' ');
      if (text) kept.push({ type: b.type, text });
    }
  }
  if (hadLead && kept[0]?.type === 'paragraph') kept[0] = { type: 'lead', text: kept[0].text };
  return serializeSummary(kept);
}

/**
 * For snippet-only sources: keeps the lead and at most one short paragraph, and drops
 * everything from the first heading or list on (those can only restate the snippet).
 */
export function leadOnlySummary(summary: string): string {
  const blocks = parseSummary(summary);
  const end = blocks.findIndex((b) => b.type === 'heading' || b.type === 'list');
  const head = (end === -1 ? blocks : blocks.slice(0, end)).slice(0, 2);
  return head.length ? serializeSummary(head) : summary;
}

// ---------------------------------------------------------------------------
// Reading helpers for the UI
// ---------------------------------------------------------------------------

export function countSummaryWords(summary: string | null | undefined): number {
  return parseSummary(summary).reduce((sum, b) => {
    if (b.type === 'list') return sum + b.items.reduce((s, i) => s + countWords(i), 0);
    return sum + countWords(b.text);
  }, 0);
}

export function summaryToPlainText(summary: string | null | undefined): string {
  return parseSummary(summary)
    .map((b) => (b.type === 'list' ? b.items.map(stripInline).join(' ') : stripInline(b.text)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Short plain-text teaser for cards and search results: the lead (or first paragraph). */
export function summaryPreview(summary: string | null | undefined, maxChars = 320): string {
  const blocks = parseSummary(summary);
  const first = blocks.find((b): b is Extract<SummaryBlock, { type: 'lead' | 'paragraph' }> => b.type === 'lead' || b.type === 'paragraph');
  const text = first ? stripInline(first.text) : summaryToPlainText(summary);
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > maxChars * 0.5) return cut.slice(0, lastStop + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}
