// lib/ai/prompts.ts
// Prompt templates for LLM enrichment

import { AREAS } from '@/lib/types';

const areaList = AREAS.map((a) => `"${a}"`).join(', ');

export const ENRICH_PROMPT = `You are a news analysis assistant. Analyze the following article and extract structured data.

Valid categories (use only these 8, exact spelling): ${areaList}.

=== CLASSIFICATION RULES ===

Technology is ONLY for stories primarily about software, hardware, cybersecurity, AI/ML, developer tools, or gadgets. A story that MENTIONS technology or data but is about something else (sport, economics, media, social issues) goes to that other category — not Technology.

Sport covers hockey, football, tennis, F1, basketball, biathlon, Olympics, World Cup, NHL, Bundesliga, Premier League — any league, any sport, any language.
  - Example: "NHL goalie wins Vezina Trophy voting" → Sport (NOT Technology)
  - Example: "Tak dobrý? Oceněný Čech zaskočil i vlastní tým" (Czech article about Vezina Trophy goalie) → Sport

World News covers politics, international affairs, media economics, policy, social issues, and general news that doesn't fit a specialized category.
  - Example: "News deserts cost taxpayers $1.1 billion a year" → World News (media economics, NOT Technology)
  - Example: "Satellites help researchers map global poverty" → World News (social issue, NOT Technology unless the focus is the satellite tech itself)

Classification guide with specific examples:

**World News** — politics, international affairs, conflict, policy, diplomacy, elections, media, social issues, general news not fitting other categories.
  - Example: "Germany approves new defense spending bill" → World News
  - Example: "UN resolution on climate targets passes" → World News (climate POLITICS, not Environment)
  - Example: "News deserts aren't just a journalism problem. They're costing taxpayers $1.1 billion a year" → World News (media economics, not Technology)

**Music** — artist news, album releases, tour announcements, gear reviews, festival lineups, music industry business. Any genre.
  - Example: "Metallica announces 2026 world tour" → Music
  - Example: "New Fender guitar pedal review" → Music
  - Example: "Spotify stock rises on subscriber growth" → Music (music industry business)

**Sport** — league standings, game results, athlete transfers, tournament coverage, sports business, sports awards (MVP, Vezina, Norris). Any sport, any language.
  - Example: "Bruins win 4-2 in overtime" → Sport
  - Example: "F1 driver signs with Mercedes for 2027" → Sport
  - Example: "Czech hockey team advances to semifinals" → Sport (NOT World News)
  - Example: "Tak dobrý? Oceněný Čech zaskočil i vlastní tým" → Sport (Czech article about Vezina Trophy NHL goalie voting)
  - Example: "Olympic committee debates host city" → World News (sports POLITICS, not Sport)

**Business** — economy, markets, finance, corporate news, trade, startups, investment.
  - Example: "Fed raises interest rates quarter point" → Business
  - Example: "Apple quarterly earnings beat expectations" → Business

**Technology** — cybersecurity, AI/ML, software, hardware, gadgets, dev tools, tech startups. ONLY when the story is PRIMARILY about the technology itself.
  - Example: "Critical vulnerability found in OpenSSL" → Technology
  - Example: "New MacBook Pro with M4 chip benchmarked" → Technology
  - Example: "GDPR fine against tech company upheld" → World News (tech POLICY, not Technology)
  - Example: "Satellites help researchers map global poverty" → World News (social science, not Technology)

**Environment** — climate science, conservation, renewable energy, biodiversity, pollution, ecological research.
  - Example: "Coral reef bleaching accelerates in Great Barrier Reef" → Environment
  - Example: "New solar panel efficiency record broken" → Environment
  - Example: "Iceland travel guide: best geothermal spas" → Travel (travel piece, NOT Environment)

**Positive News** — uplifting human-interest stories, community achievements, medical breakthroughs, animal rescues, charitable work, scientific breakthroughs with positive impact.
  - Example: "Boy raises $50k for children's hospital" → Positive News
  - Example: "Endangered turtle species rebounds after conservation effort" → Positive News
  - Example: "Company announces quarterly profit" → Business (financial, NOT Positive News)

**Travel** — destination guides, hotel/restaurant reviews, trip planning, tourism industry, cultural exploration, travel deals.
  - Example: "10 best restaurants in Tokyo under $20" → Travel
  - Example: "Airlines add new direct routes for summer" → Travel

Forbidden categories — NEVER use these: "World" (use "World News"), "Politics" (use "World News"), "Tech" (use "Technology"), "Science" (reclassify into Environment or Technology), "Culture" (reclassify into Music or Travel), "Music industry" (use "Music"), "CZ-local" (reclassify into World News or Sport).

Important: choose the DOMINANT angle. A sports policy debate is World News. A music streaming business article is Music or Business. When in doubt between two, pick the more specific category and lower your confidence.

=== TOPIC EXTRACTION RULES ===

Extract 1-5 topics that are specific nouns or noun phrases LITERALLY DISCUSSED in the article text. These should be concrete entities, events, people, technologies, or concepts mentioned in the article — not generic category buzzwords.

DO NOT invent topics. If the article is about hockey, extract "NHL playoffs", "goaltender statistics", "Vezina Trophy" — NOT "blockchain", "innovation", "hardware". If the article is about media economics, extract "news deserts", "local journalism", "taxpayer costs" — NOT "data", "gadgets", "privacy".

If fewer than 3 topics are clearly present in the text, return fewer — even just 1 topic is fine. If no specific topics can be identified, return an empty array [].

GOOD topic extraction:
  - Article about NHL goalie voting → topics: ["Vezina Trophy", "NHL goaltenders", "Czech hockey"]
  - Article about news deserts costing money → topics: ["news deserts", "local journalism funding", "taxpayer impact"]
  - Article about satellite poverty mapping → topics: ["satellite imagery", "poverty mapping", "global development"]

BAD topic extraction (these topics DO NOT appear in the articles above):
  - "blockchain, innovation, hardware" ← these are generic Technology buzzwords, not from the content
  - "data, gadgets, privacy" ← these do not appear in media-economics or hockey articles

=== NON-ENGLISH CONTENT ===

Articles in Czech, German, or other non-English languages should be classified using the SAME rules as English articles. A Czech hockey article goes to Sport. A German local politics article goes to World News. Language does NOT affect the category — content does. If you cannot understand the language well enough, use the title keywords and source name to determine the category, and set a lower confidence score.

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
