// lib/ai/enrich.ts
// Claude enrichment for the ingest pipeline: a structured summary (max 400
// words), topic extraction and classification metadata.
//
// Falls back to the extractive summariser in enrich-simple.ts if
// ANTHROPIC_API_KEY is unset, the API call fails or the reply cannot be
// parsed. The result says which engine produced it (`engine`), so the ingest
// report can show how many articles were summarised by Claude.

import Anthropic from '@anthropic-ai/sdk';
import { ENRICH_PROMPT } from '@/lib/ai/prompts';
import { enrichArticle as fallbackEnrich } from '@/lib/ai/enrich-simple';
import { isLikelyEnglish } from '@/lib/ai/language';
import { READER_PROFILE } from '@/lib/config/reader';
import { MAX_SUMMARY_WORDS, countSummaryWords, countWords, dropMetaCommentary, leadOnlySummary, normalizeSummary, summaryToPlainText } from '@/lib/summary';

export interface EnrichInput {
  sourceName: string;
  sourceLang: string;
  title: string;
  excerpt: string;
  content?: string;
  /** Publication date, so relative dates ("next year") resolve correctly. */
  publishedAt?: Date;
}

export interface EnrichOutput {
  summary: string;
  areas: Array<{ area: string; confidence: number }>;
  topics: string[];
  entities: string[];
  titleEn: string | null;
  incomplete: boolean;
  /** 1-5 relevance for the reader; null when the fallback summariser was used. */
  importance: number | null;
  /** One-sentence personal relevance line (AI inference), or null. */
  forYou: string | null;
  /** Which engine produced the summary. */
  engine: 'ai' | 'fallback';
  /** Why the fallback was used (only when engine is 'fallback'). */
  fallbackReason?: string;
}

// Overridable without a code change, e.g. ENRICH_MODEL=claude-haiku-5-5.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
// ~4k tokens of article text. Longer articles are cut here to bound cost; the
// summary then covers the first ~2,700 words, which holds for nearly all news pieces.
const MAX_ARTICLE_CHARS = 16000;
// 400 words is roughly 600 tokens; leave room for the metadata block.
const MAX_OUTPUT_TOKENS = 2048;
// A usable summary has at least this many words; shorter means the reply was broken.
const MIN_SUMMARY_WORDS = 12;
// Below this many words the source gave only a snippet (typical for feeds whose pages we
// cannot read). Such articles get a short lead only: more would restate the snippet or invent context.
const SNIPPET_MAX_WORDS = 150;
const MIN_SNIPPET_SUMMARY_WORDS = 5;

export function isSnippet(input: Pick<EnrichInput, 'excerpt' | 'content'>): boolean {
  return countWords(input.content || input.excerpt || '') < SNIPPET_MAX_WORDS;
}

const longDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(d);

export function buildPrompt(input: EnrichInput, now: Date = new Date()): string {
  const values: Record<string, string> = {
    sourceName: input.sourceName,
    sourceLang: input.sourceLang,
    title: input.title,
    excerpt: input.excerpt,
    content: (input.content || input.excerpt || '').slice(0, MAX_ARTICLE_CHARS),
    textType: isSnippet(input) ? 'SNIPPET (only the start of the article is available)' : 'full article text',
    readerProfile: READER_PROFILE,
    // The model does not know today's date and otherwise tends to assume the year of its training data.
    today: longDate(now),
    published: input.publishedAt ? longDate(input.publishedAt) : 'unknown',
  };
  // Single pass with a replacer function: article text may contain "$&" or "{title}".
  return ENRICH_PROMPT.replace(/\{(sourceName|sourceLang|title|excerpt|content|textType|readerProfile|today|published)\}/g, (_, key: string) => values[key]);
}

interface ParsedReply {
  summary: string;
  areas: EnrichOutput['areas'];
  topics: string[];
  entities: string[];
  titleEn: string | null;
  incomplete: boolean;
  importance: number | null;
  forYou: string | null;
}

/** Parses the <metadata>/<summary> reply. Returns null if no usable summary is present. */
export function parseResponse(text: string, truncated = false, snippet = false): ParsedReply | null {
  const summaryMatch = text.match(/<summary>([\s\S]*?)(?:<\/summary>|$)/i);
  if (!summaryMatch) return null;

  const closed = /<\/summary>/i.test(text);
  // Remove talk about the text itself, and for snippets everything beyond the lead.
  let raw = dropMetaCommentary(summaryMatch[1]);
  if (snippet) raw = leadOnlySummary(raw);
  const summary = normalizeSummary(raw, {
    maxWords: MAX_SUMMARY_WORDS,
    dropTrailingFragment: truncated || !closed,
  });
  if (countSummaryWords(summary) < (snippet ? MIN_SNIPPET_SUMMARY_WORDS : MIN_SUMMARY_WORDS)) return null;

  let meta: Record<string, unknown> = {};
  const metaMatch = text.match(/<metadata>([\s\S]*?)<\/metadata>/i);
  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1].trim());
      if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>;
    } catch {
      // Metadata is best-effort; the summary is the important part.
    }
  }

  const areas = Array.isArray(meta.areas)
    ? (meta.areas as Array<{ area?: unknown; confidence?: unknown }>)
        .filter((a) => typeof a?.area === 'string')
        .map((a) => ({ area: a.area as string, confidence: typeof a.confidence === 'number' ? a.confidence : 0.5 }))
    : [];

  return {
    summary,
    areas,
    topics: Array.isArray(meta.topics) ? meta.topics.filter((t): t is string => typeof t === 'string').slice(0, 5) : [],
    entities: Array.isArray(meta.entities) ? meta.entities.filter((e): e is string => typeof e === 'string').slice(0, 6) : [],
    titleEn: typeof meta.titleEn === 'string' && meta.titleEn ? meta.titleEn : null,
    incomplete: meta.incomplete === true,
    importance: typeof meta.importance === 'number' && Number.isFinite(meta.importance) ? Math.min(5, Math.max(1, Math.round(meta.importance))) : null,
    forYou: typeof meta.forYou === 'string' && meta.forYou.trim() && meta.forYou.trim().toLowerCase() !== 'null' ? meta.forYou.trim().slice(0, 300) : null,
  };
}

/**
 * Why a reply cannot be used for an article that should have been translated to
 * English (no English headline, or the summary is still in the source language);
 * null when it can. Always null for English sources.
 */
export function translationProblem(parsed: Pick<ParsedReply, 'summary' | 'titleEn'>, sourceLang: string): string | null {
  if (sourceLang === 'en') return null;
  if (!parsed.titleEn) return 'the reply has no English headline';
  if (!isLikelyEnglish(summaryToPlainText(parsed.summary))) return 'the summary is not in English';
  return null;
}

/** Enrichment without any network call (also used when the ingest time budget is spent). */
export async function enrichFallback(input: EnrichInput, reason: string): Promise<EnrichOutput> {
  const result = await fallbackEnrich(input);
  return { ...result, importance: null, forYou: null, engine: 'fallback', fallbackReason: reason };
}

export async function enrichArticle(input: EnrichInput): Promise<EnrichOutput> {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key || key === 'sk-dummy-for-development') {
    return enrichFallback(input, 'ANTHROPIC_API_KEY is not set');
  }

  try {
    const anthropic = new Anthropic({ apiKey: key, timeout: 40_000, maxRetries: 1 });

    const msg = await anthropic.messages.create({
      model: process.env.ENRICH_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });

    const text = msg.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { text: string }).text)
      .join('\n');

    const parsed = parseResponse(text, msg.stop_reason === 'max_tokens', isSnippet(input));
    if (parsed) {
      const problem = translationProblem(parsed, input.sourceLang);
      if (problem) {
        console.error(`[enrich] translation rejected: ${problem}`);
        return enrichFallback(input, `Translation failed: ${problem}`);
      }
      const fallbackAreas = [{ area: 'World News', confidence: 0.5 }];
      return {
        ...parsed,
        areas: parsed.areas.length ? parsed.areas : fallbackAreas,
        engine: 'ai',
      };
    }

    console.error('[enrich] Claude reply had no usable summary, using fallback');
    return enrichFallback(input, 'Claude reply could not be parsed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[enrich] Claude API error:', message);
    return enrichFallback(input, `Claude API error: ${message}`);
  }
}
