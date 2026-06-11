// lib/ai/prompts.ts
// Prompt templates for LLM enrichment

export const ENRICH_PROMPT = `You are a news analysis assistant. Analyze the following article and extract:

1. **Summary**: A concise 2-3 sentence summary in the same language as the article.
2. **Areas**: 1-3 primary topic areas (e.g., Politics, Technology, Environment). Include confidence scores 0-1.
3. **Topics**: 3-5 specific topics or keywords mentioned.
4. **Entities**: 3-5 named entities (people, organizations, locations).
5. **TitleEn**: English translation of the title if not already English.
6. **Incomplete**: Boolean indicating if the content seems paywalled or truncated.

Return JSON format:
{
  "summary": string,
  "areas": Array<{area: string, confidence: number}>,
  "topics": string[],
  "entities": string[],
  "titleEn": string | null,
  "incomplete": boolean
}

Article details:
- Source: {sourceName}
- Language: {sourceLang}
- Title: {title}
- Excerpt: {excerpt}
- Content: {content}`;