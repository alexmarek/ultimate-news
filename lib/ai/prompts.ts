// lib/ai/prompts.ts
// Prompt templates for LLM enrichment

import { AREAS } from '@/lib/types';

const areaList = AREAS.map((a) => `"${a}"`).join(', ');

export const ENRICH_PROMPT = `You are a news analysis assistant. Analyze the following article and classify it into EXACTLY the topic areas listed below. No other categories are valid.

Valid categories (use only these 8, exact spelling): ${areaList}.

=== CLASSIFICATION RULES ===

Technology is ONLY for articles primarily about software, hardware, cybersecurity, AI/ML, developer tools, or gadgets. Articles that MENTION technology or data as backdrop but are about something else (sport, economics, social issues, music, politics) go to that other category — not Technology.

Sport covers hockey, football, tennis, F1, basketball, biathlon, Olympics, World Cup, NHL, Bundesliga, Premier League — any league, any sport, any language.

World News covers politics, international affairs, media economics, policy, social issues, and general news that doesn't fit a specialized category.

If the article is in Czech, German, or another non-English language, identify the category from semantic content regardless of language. Czech sport vocabulary (hokej, fotbal, tenis, brankář, trofej, NHL) indicates Sport. German local news maps to one of the 8 based on subject matter — usually World News for local affairs.

Category examples:

**World News** — politics, international affairs, conflict, policy, diplomacy, elections, media, social issues.
  - "Germany approves new defense spending bill" → World News
  - "News deserts cost taxpayers $1.1 billion" → World News (media economics, NOT Technology)
  - "EU AI Act enforcement begins" → World News (regulatory/policy, NOT Technology)
  - "UN resolution on climate targets passes" → World News (climate POLITICS, not Environment)

**Music** — artist news, album releases, tour announcements, gear reviews, festival lineups.
  - "Metallica announces 2026 world tour" → Music
  - "New Fender guitar pedal review" → Music
  - "Dave Mustaine memoir" → Music (NOT World News)
  - "Spotify stock rises on subscriber growth" → Music (music industry business)

**Sport** — league standings, game results, athlete transfers, sports awards (MVP, Vezina, Norris). Any sport, any language.
  - "Bruins win 4-2 in overtime" → Sport
  - "F1 driver signs with Mercedes for 2027" → Sport
  - "Czech NHL goalie wins Vezina Trophy" → Sport (NOT Technology)
  - "Mexico-South Africa World Cup match" → Sport (NOT World News, NOT Environment)
  - "Tak dobrý? Oceněný Čech zaskočil i vlastní tým" → Sport (Czech article about Vezina Trophy)
  - "Olympic committee debates host city" → World News (sports POLITICS, not Sport)

**Business** — economy, markets, finance, corporate news, trade, startups, investment.
  - "Fed raises interest rates quarter point" → Business
  - "Apple quarterly earnings beat expectations" → Business
  - "China electrifies its economy" → Business (primary frame is economics, NOT Environment)

**Technology** — cybersecurity, AI/ML, software, hardware, gadgets, dev tools. ONLY when PRIMARILY about the tech itself.
  - "Critical vulnerability found in OpenSSL" → Technology
  - "New MacBook Pro with M4 chip benchmarked" → Technology
  - "GDPR fine against tech company upheld" → World News (tech POLICY, not Technology)
  - "Satellites help researchers map global poverty" → World News (social science, not Technology)

**Environment** — climate science, conservation, renewable energy, biodiversity, pollution.
  - "Climate change risk to coral reefs" → Environment
  - "Coral reef bleaching accelerates in Great Barrier Reef" → Environment
  - "New solar panel efficiency record broken" → Environment
  - "Iceland travel guide: best geothermal spas" → Travel (travel, NOT Environment)

**Positive News** — uplifting human-interest stories, community achievements, medical breakthroughs, animal rescues.
  - "Boy raises $50k for children's hospital" → Positive News
  - "Therapy donkeys help psychiatric patients" → Positive News (NOT World News)
  - "Endangered turtle species rebounds after conservation effort" → Positive News
  - "Company announces quarterly profit" → Business (financial, NOT Positive News)

**Travel** — destination guides, hotel/restaurant reviews, trip planning, tourism industry.
  - "10 best restaurants in Tokyo under $20" → Travel
  - "10 places to visit in Iceland" → Travel
  - "Airlines add new direct routes for summer" → Travel
  - "Iceland's glaciers melting faster than predicted" → Environment (science, NOT Travel)

Forbidden categories — NEVER use: "World", "Politics", "Tech", "Science", "Culture", "Music industry", "CZ-local".

Important: choose the DOMINANT angle. When in doubt, pick the more specific category and lower your confidence.

=== TOPIC EXTRACTION RULES ===

Extract 1-5 TOPICS from the article. Topics are meaningful concepts, entities, or subjects — NOT sliding-window word combinations from the title.

Good topics:
- Named entities: 'FIFA', 'Gianni Infantino', 'British Columbia'
- Subject nouns: 'wildfires', 'aviation safety', 'World Cup governance'
- Domain concepts: 'far-right politics', 'wildlife conservation', 'greenhouse gas emissions'

Bad topics (never return these):
- Two-word phrases lifted directly from the title as sliding windows (e.g., 'FIFA warns', 'warns against', 'against concerted' from a headline about FIFA)
- Generic buzzwords not appearing in the article ('blockchain', 'innovation', 'gadgets')
- Function words or fragments ('at least', 'on the', 'the new')

Each topic should be a standalone concept a reader would search for or click to follow. If you cannot find 3 meaningful topics, return fewer — even just 1 or 2.

Examples:

ARTICLE: "FIFA warns against 'concerted effort' to undermine Gianni Infantino"
GOOD topics: FIFA, Gianni Infantino, World Cup governance
BAD topics: FIFA warns, warns against, against concerted

ARTICLE: "Canada: British Columbia declares emergency as fires spread"
GOOD topics: British Columbia, wildfires, Canadian emergency response
BAD topics: Canada British, Columbia declares

ARTICLE: "Rare turtle to be sent back home in 5,000-mile trip"
GOOD topics: sea turtles, wildlife conservation, Anglesey Sea Zoo
BAD topics: Rare turtle, turtle to, be sent

=== NON-ENGLISH CONTENT ===

Articles in Czech, German, or other non-English languages should be classified using the SAME rules as English articles. Language does NOT affect the category — content does. If you cannot understand the language well enough, use title keywords and source name to determine the category, and set a lower confidence score.

Return JSON format:
{
  "summary": string,
  "areas": [{area: string, confidence: number}, ...],
  "topics": string[],
  "entities": string[],
  "titleEn": string | null,
  "incomplete": boolean
}

The summary must be 4-6 sentences (roughly 80-140 words) and capture the key facts and context of the article. Plain text only — no HTML tags, no markdown, no bullet points.

Article details:
- Source: {sourceName}
- Language: {sourceLang}
- Title: {title}
- Excerpt: {excerpt}
- Content: {content}`;
