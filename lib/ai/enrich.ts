// lib/ai/enrich.ts
// Claude Haiku enrichment for the ingest pipeline.
// Replaces enrich-simple.ts in production — uses Anthropic API for
// area classification, topic extraction, and summarization.
//
// Falls back to enrich-simple.ts mock if ANTHROPIC_API_KEY is unset
// or the API call fails.

import Anthropic from '@anthropic-ai/sdk';
import { ENRICH_PROMPT } from '@/lib/ai/prompts';
import { enrichArticle as mockEnrich } from '@/lib/ai/enrich-simple';

interface EnrichInput {
  sourceName: string;
  sourceLang: string;
  title: string;
  excerpt: string;
  content?: string;
}

interface EnrichOutput {
  summary: string;
  areas: Array<{ area: string; confidence: number }>;
  topics: string[];
  entities: string[];
  titleEn: string | null;
  incomplete: boolean;
}

function buildPrompt(input: EnrichInput): string {
  const content = (input.content || input.excerpt || '').slice(0, 4000);
  return ENRICH_PROMPT
    .replace('{sourceName}', input.sourceName)
    .replace('{sourceLang}', input.sourceLang)
    .replace('{title}', input.title)
    .replace('{excerpt}', input.excerpt)
    .replace('{content}', content);
}

function parseResponse(text: string): EnrichOutput | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.summary && !parsed.areas) return null;
    return {
      summary: parsed.summary || '',
      areas: Array.isArray(parsed.areas) ? parsed.areas : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      titleEn: parsed.titleEn || null,
      incomplete: parsed.incomplete || false,
    };
  } catch {
    return null;
  }
}

export async function enrichArticle(input: EnrichInput): Promise<EnrichOutput> {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key || key === 'sk-dummy-for-development') {
    return mockEnrich(input);
  }

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const prompt = buildPrompt(input);

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { text: string }).text)
      .join('\n');

    const result = parseResponse(text);
    if (result) return result;

    console.error('[enrich] Claude response parse failed, falling back to mock');
    return mockEnrich(input);
  } catch (err) {
    console.error('[enrich] Claude API error:', err instanceof Error ? err.message : String(err));
    return mockEnrich(input);
  }
}
