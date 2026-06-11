// lib/ai/prompts.ts
// Prompt templates for LLM enrichment

import { AREAS } from '@/lib/types';

const areaList = AREAS.map((a) => `"${a}"`).join(', ');

export const ENRICH_PROMPT = `You are a news analysis assistant. Analyze the following article and extract:

1. **Summary**: A concise 2-3 sentence summary in the same language as the article.
2. **Areas**: 1-3 primary topic areas chosen ONLY from this list: ${areaList}. Include confidence scores 0-1 (be honest — if you're unsure, use a lower score). Never use "Technology" (use "Tech"), "Environment" (reclassify into Science or Politics), or "Music" (use "Music industry").

Classification guide for tricky cases:
- Sports scores, game results, player transfers → Sport (NOT Politics, NOT World)
- Hockey, football, tennis coverage of any kind → Sport
- Album releases, tour announcements, band interviews, gear reviews → Music industry (NOT Culture, NOT Politics)
- Ransomware attacks, data breaches, vulnerability disclosures → Tech (NOT Politics)
- Cybersecurity regulation, government hacking policy → Politics or Tech (choose the dominant angle)
- Environmental protests, climate legislation → Politics (NOT Science)
- Climate research, new energy tech, species studies → Science
- Municipal news from Czech cities → CZ-local
- International sports events like Olympics, World Cup → Sport (NOT World)
- Music streaming economics, label business → Music industry or Business (choose the dominant angle)

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