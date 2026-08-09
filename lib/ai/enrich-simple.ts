// lib/ai/enrich-simple.ts
// Simplified enrichment for development without AI dependencies.
// Uses source contentKind as area signal + title keywords for topic extraction.

import { AREAS, type Area } from '@/lib/types';
import { stripHtml } from '@/lib/text';

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

// Source contentKind → suggested area mapping
const contentKindArea: Record<string, Area> = {
  'technology': 'Technology',
  'cybersecurity': 'Technology',
  'ai-newsletter': 'Technology',
  'business': 'Business',
  'investigative': 'World News',
  'news': 'World News',
  'policy': 'World News',
  'media': 'World News',
  'local-news': 'World News',
  'positive-news': 'Positive News',
  'music-metal': 'Music',
  'music-gear': 'Music',
  'music': 'Music',
  'sports': 'Sport',
  'travel': 'Travel',
  'environment': 'Environment',
  'gaming': 'Technology',
};

// Title keyword → area override (stronger signal than contentKind)
function titleKeywordArea(title: string): Area | null {
  const t = title.toLowerCase();

  // Sport keywords
  if (/\b(NHL|NBA|NFL|MLB|F1|UFC|tennis|grand slam|playoff|championship|league|tournament|match|goal|score|win|loss|overtime|semifinal|final|medal|Olympic|World Cup|biathlon|cycling|hockey|football|rugby|cricket|boxing|golf|basketball|transfer|signing|free agent)\b/.test(t)) {
    return 'Sport';
  }

  // Music keywords
  if (/\b(album|tour|single|band|concert|festival|guitar|bass|drum|vocal|singer|song|EP|vinyl|label|signing|Grammy|Billboard|Spotify)\b/.test(t)) {
    return 'Music';
  }

  // Technology keywords (only if the article IS primarily about tech)
  if (/\b(AI|artificial intelligence|ChatGPT|OpenAI|machine learning|cyber|hack|vulnerability|ransomware|malware|app|software|hardware|chip|processor|robot|drone|startup)\b/.test(t)) {
    return 'Technology';
  }

  // Travel keywords
  if (/\b(hotel|restaurant|destination|travel|trip|vacation|tourist|itinerary|flight|airline)\b/.test(t)) {
    return 'Travel';
  }

  // Environment keywords
  if (/\b(climate|carbon|emissions|renewable|solar|wind|conservation|wildlife|species|biodiversity|pollution|ocean|reef)\b/.test(t)) {
    return 'Environment';
  }

  return null;
}

function extractTopicsFromText(title: string, excerpt: string, content?: string): string[] {
  // Use sentence-case body text, not the title — title-case headlines
  // make every word look like a proper noun.
  const text = (excerpt + ' ' + (content || '')).trim() || title;

  const STOP = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'from', 'with', 'and', 'but', 'or',
    'for', 'of', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its',
    'this', 'that', 'these', 'those', 'more', 'most', 'new', 'after', 'before',
    'over', 'under', 'into', 'about', 'against', 'between', 'during', 'says',
    'said', 'will', 'would', 'could', 'should', 'has', 'have', 'had', 'not',
    'than', 'then', 'so', 'also', 'just', 'now', 'first', 'last', 'many', 'may',
    'up', 'out', 'off', 'back', 'home', 'next', 'latest', 'watch', 'video',
    'once', 'gone', 'even', 'read', 'years', 'year', 'every', 'much',
  ]);

  // Capitalized sequences of 1-3 words = candidate proper-noun topics
  const freq = new Map<string, number>();
  const matches = text.matchAll(/\b([A-Z][a-zA-Z0-9À-ɏ]*(?:[ \-][A-Z][a-zA-Z0-9À-ɏ]*){0,2})\b/g);
  for (const m of matches) {
    const phrase = m[1].trim();
    if (phrase.length < 3) continue;
    const words = phrase.split(/[ \-]/);
    if (STOP.has(words[0].toLowerCase())) continue;
    if (words.every((w) => STOP.has(w.toLowerCase()))) continue;
    freq.set(phrase, (freq.get(phrase) || 0) + 1);
  }

  // Rank: frequency desc, shorter phrase first on ties (more canonical)
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);

  // Drop longer phrases that merely extend an already-kept shorter one
  const kept: string[] = [];
  for (const [phrase, count] of ranked) {
    const redundant = kept.some((k) => phrase.includes(k) && (freq.get(k) || 0) >= count);
    if (!redundant) kept.push(phrase);
    if (kept.length >= 3) break;
  }
  return kept;
}

const sourceEntities: Record<string, string[]> = {
  'Blabbermouth.net': ['Moonspell', 'Metallica', 'Slipknot', 'Cradle of Filth', 'Arch Enemy', 'Gojira'],
  'MusicRadar': ['Fender', 'Gibson', 'Neural DSP', 'IK Multimedia', 'Universal Audio'],
  'The Hacker News': ['CISA', 'FBI', 'Microsoft', 'Google', 'Cloudflare'],
  'Wired': ['OpenAI', 'Google', 'Apple', 'Meta', 'The Pentagon'],
  'NPR': ['Congress', 'White House', 'Supreme Court', 'FDA', 'CDC'],
  'DW': ['EU', 'NATO', 'Bundestag', 'European Commission', 'UN'],
  'ProPublica': ['IRS', 'SEC', 'Justice Department', 'Whistleblower', 'Investigation'],
  'BBC Future Planet': ['UNEP', 'IPCC', 'COP', 'G20', 'World Bank'],
  'Inside Climate News': ['NOAA', 'EPA', 'Green Climate Fund', 'Climate Watch', 'Carbon Brief'],
  'Good News Network': ['Red Cross', 'UNICEF', 'Make-A-Wish', 'Habitat for Humanity'],
  'Smiley Movement': ['Charity', 'Volunteer', 'Community', 'Impact', 'Donation'],
  'Quartz': ['S&P 500', 'NASDAQ', 'Wall Street', 'Bloomberg', 'Morgan Stanley'],
  'Yahoo Finance': ['Dow Jones', 'NYSE', 'CNBC', 'Goldman Sachs', 'JPMorgan'],
  "Fodor's Travel": ['Tripadvisor', 'Expedia', 'Booking.com', 'Lonely Planet', 'Airbnb'],
  'Lonely Planet': ['UNESCO', 'National Geographic', 'Skyscanner', 'Hostelworld', 'Airbnb'],
  'Sport.cz': ['NHL', 'Czech Republic', 'Football', 'Tennis', 'Extraliga'],
  'Budget Traveller': ['Europe', 'Hostels', 'Train travel', 'Budget guides', 'Backpacking'],
  'Be My Travel Muse': ['Solo female travel', 'Backpacking', 'Adventure', 'Travel tips', 'Nature'],
};

// Source name → contentKind for area hinting
const sourceContentKind: Record<string, string> = {
  'Wired': 'technology',
  'One Useful Thing': 'ai-newsletter',
  'The Hacker News': 'cybersecurity',
  'ProPublica': 'investigative',
  'NPR': 'news',
  'Deutsche Welle': 'news',
  'Blabbermouth.net': 'music-metal',
  'MusicRadar': 'music-gear',
  'Sport.cz': 'sports',
  'Inside Climate News': 'environment',
  'BBC Future Planet': 'environment',
  'Good News Network': 'positive-news',
  'Smiley Movement': 'positive-news',
  'Quartz': 'business',
  'Yahoo Finance': 'business',
  "Fodor's Travel": 'travel',
  'Lonely Planet': 'travel',
  'Budget Traveller': 'travel',
  'Be My Travel Muse': 'travel',
  'Atlas Obscura': 'travel',
  'Matador Network': 'travel',
  'Smithsonian Magazine': 'travel',
  'Longreads': 'travel',
  'Fathom Away': 'travel',
  'EUobserver': 'news',
  'The Verge': 'technology',
};

// Take whole sentences from text until maxLen is reached
function firstSentences(text: string, maxLen: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*(?:\s|$)/g);
  if (!sentences) return text.slice(0, maxLen).trim();
  let out = '';
  for (const s of sentences) {
    if (out.length > 0 && (out + s).length > maxLen) break;
    out += s;
  }
  return out.trim() || text.slice(0, maxLen).trim();
}

export async function enrichArticle(input: EnrichInput): Promise<EnrichOutput> {
  // 1. Determine area: title keywords > source contentKind > random
  const keywordArea = titleKeywordArea(input.title);
  const kindArea = contentKindArea[sourceContentKind[input.sourceName]] as Area | undefined;
  let selectedArea: Area;

  if (keywordArea) {
    selectedArea = keywordArea;
  } else if (kindArea) {
    selectedArea = kindArea;
  } else {
    selectedArea = AREAS[Math.floor(Math.random() * AREAS.length)];
  }

  // 2. Extract topics from actual text (excerpt + fetched content)
  const topics = extractTopicsFromText(input.title, input.excerpt, input.content);

  // 3. Entities from source-specific list or generic
  const entities = sourceEntities[input.sourceName] || ['Global Organization', 'Expert Analysis', 'Industry Leader'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const cleanExcerpt = stripHtml(input.excerpt || '');
  const cleanContent = input.content ? stripHtml(input.content) : '';
  let summary = cleanExcerpt;
  if (cleanContent && summary.length < 500) {
    summary = firstSentences((summary + ' ' + cleanContent).trim(), 800);
  }

  return {
    summary,
    areas: [{ area: selectedArea, confidence: keywordArea ? 0.85 : kindArea ? 0.7 : 0.5 }],
    topics,
    entities: [pick(entities), pick(entities)],
    titleEn: input.sourceLang === 'en' ? null : input.title,
    incomplete: false,
  };
}
