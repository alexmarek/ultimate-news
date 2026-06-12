// lib/ai/prompts.ts
// Prompt templates for LLM enrichment

import { AREAS } from '@/lib/types';

const areaList = AREAS.map((a) => `"${a}"`).join(', ');

export const ENRICH_PROMPT = `You are a news analysis assistant. Analyze the following article and classify it into EXACTLY the topic areas listed below. No other categories are valid.

Valid categories (use only these 8, exact spelling): ${areaList}.

Classification guide with specific examples:

**World News** — politics, international affairs, conflict, policy, diplomacy, elections, general news not fitting other categories.
  - Example: "Germany approves new defense spending bill" → World News
  - Example: "UN resolution on climate targets passes" → World News (climate POLITICS, not Environment)

**Music** — artist news, album releases, tour announcements, gear reviews, festival lineups, music industry business. Any genre.
  - Example: "Metallica announces 2026 world tour" → Music
  - Example: "New Fender guitar pedal review" → Music
  - Example: "Spotify stock rises on subscriber growth" → Music (music industry business)

**Sport** — league standings, game results, athlete transfers, tournament coverage, sports business. Any sport.
  - Example: "Bruins win 4-2 in overtime" → Sport
  - Example: "F1 driver signs with Mercedes for 2027" → Sport
  - Example: "Czech hockey team advances to semifinals" → Sport (NOT World News)
  - Example: "Olympic committee debates host city" → World News (sports POLITICS, not Sport)

**Business** — economy, markets, finance, corporate news, trade, startups, investment.
  - Example: "Fed raises interest rates quarter point" → Business
  - Example: "Apple quarterly earnings beat expectations" → Business

**Technology** — cybersecurity, AI/ML, software, hardware, gadgets, dev tools, startups.
  - Example: "Critical vulnerability found in OpenSSL" → Technology
  - Example: "New MacBook Pro with M4 chip benchmarked" → Technology
  - Example: "GDPR fine against tech company upheld" → World News (tech POLICY, not Technology)

**Environment** — climate science, conservation, renewable energy, biodiversity, pollution, ecological research.
  - Example: "Coral reef bleaching accelerates in Great Barrier Reef" → Environment
  - Example: "New solar panel efficiency record broken" → Environment
  - Example: "Iceland travel guide: best geothermal spas" → Travel (travel piece about Iceland, NOT Environment)

**Positive News** — uplifting human-interest stories, community achievements, medical breakthroughs, animal rescues, charitable work.
  - Example: "Boy raises $50k for children's hospital" → Positive News
  - Example: "Endangered turtle species rebounds after conservation effort" → Positive News
  - Example: "Company announces quarterly profit" → Business (financial, NOT Positive News)

**Travel** — destination guides, hotel/restaurant reviews, trip planning, tourism industry, cultural exploration, travel deals.
  - Example: "10 best restaurants in Tokyo under $20" → Travel
  - Example: "Airlines add new direct routes for summer" → Travel
  - Example: "Iceland's glaciers melting faster than predicted" → Environment (science/climate, NOT Travel)

Forbidden categories — NEVER use these: "World" (use "World News"), "Politics" (use "World News"), "Tech" (use "Technology"), "Science" (reclassify into Environment or Technology), "Culture" (reclassify into Music or Travel), "Music industry" (use "Music"), "CZ-local" (reclassify into World News or Sport).

Important: choose the DOMINANT angle. A sports policy debate is World News. A music streaming business article is Music or Business. When in doubt between two, pick the more specific category and lower your confidence.

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
