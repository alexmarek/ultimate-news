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
import { MAX_SUMMARY_WORDS, normalizeSummary, countSummaryWords } from '@/lib/summary';

export interface EnrichInput {
  sourceName: string;
  sourceLang: string;
  title: string;
  excerpt: string;
  content?: string;
}

export interface EnrichOutput {
  summary: string;
  areas: Array<{ area: string; confidence: number }>;
  topics: string[];
  entities: string[];
  titleEn: string | null;
  incomplete: boolean;
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

export function buildPrompt(input: EnrichInput): string {
  const values: Record<string, string> = {
    sourceName: input.sourceName,
    sourceLang: input.sourceLang,
    title: input.title,
    excerpt: input.excerpt,
    content: (input.content || input.excerpt || '').slice(0, MAX_ARTICLE_CHARS),
  };
  // Single pass with a replacer function: article text may contain "$&" or "{title}".
  return ENRICH_PROMPT.replace(/\{(sourceName|sourceLang|title|excerpt|content)\}/g, (_, key: string) => values[key]);
}

interface ParsedReply {
  summary: string;
  areas: EnrichOutput['areas'];
  topics: string[];
  entities: string[];
  titleEn: string | null;
  incomplete: boolean;
}

/** Parses the <metadata>/<summary> reply. Returns null if no usable summary is present. */
export function parseResponse(text: string, truncated = false): ParsedReply | null {
  const summaryMatch = text.match(/<summary>([\s\S]*?)(?:<\/summary>|$)/i);
  if (!summaryMatch) return null;

  const closed = /<\/summary>/i.test(text);
  const summary = normalizeSummary(summaryMatch[1], {
    maxWords: MAX_SUMMARY_WORDS,
    dropTrailingFragment: truncated || !closed,
  });
  if (countSummaryWords(summary) < MIN_SUMMARY_WORDS) return null;

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
  };
}

/** Enrichment without any network call (also used when the ingest time budget is spent). */
export async function enrichFallback(input: EnrichInput, reason: string): Promise<EnrichOutput> {
  const result = await fallbackEnrich(input);
  return { ...result, engine: 'fallback', fallbackReason: reason };
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

    const parsed = parseResponse(text, msg.stop_reason === 'max_tokens');
    if (parsed) {
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
