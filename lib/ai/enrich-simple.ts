// lib/ai/enrich-simple.ts
// Simplified enrichment for development without AI dependencies.
// Uses source contentKind as area signal + title keywords for topic extraction.

import { AREAS, type Area } from '@/lib/types';

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

function extractTopicsFromText(title: string, excerpt: string): string[] {
  const text = (title + ' ' + excerpt).toLowerCase();
  const words = text.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 3);
  const wordFreq = new Map<string, number>();
  for (const w of words) {
    wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }

  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'their',
    'about', 'which', 'when', 'what', 'more', 'than', 'over', 'into', 'also',
    'after', 'before', 'would', 'could', 'these', 'those', 'there', 'very',
  ]);

  // Multi-word phrases: adjacent capitalized or significant words
  const phrases: string[] = [];
  const titleWords = title.split(/[^a-zA-Z0-9\u00C0-\u024F]+/).filter((w) => w.length > 1);
  for (let i = 0; i < titleWords.length - 1; i++) {
    const phrase = titleWords.slice(i, i + 2).join(' ');
    if (phrase.length > 5 && !stopWords.has(phrase.toLowerCase().split(' ')[0])) {
      phrases.push(phrase);
    }
  }

  // Get top single words by frequency
  const sorted = [...wordFreq.entries()]
    .filter(([w]) => !stopWords.has(w) && w.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  // Combine phrases + top words, take up to 3
  const result = [...new Set([...phrases, ...sorted])].slice(0, 3);

  return result.length > 0 ? result : [];
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
};

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

  // 2. Extract topics from actual text (title + excerpt)
  const topics = extractTopicsFromText(input.title, input.excerpt);

  // 3. Entities from source-specific list or generic
  const entities = sourceEntities[input.sourceName] || ['Global Organization', 'Expert Analysis', 'Industry Leader'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  return {
    summary: input.excerpt || input.content?.replace(/<[^>]*>/g, '').slice(0, 400) || '',
    areas: [{ area: selectedArea, confidence: keywordArea ? 0.85 : kindArea ? 0.7 : 0.5 }],
    topics,
    entities: [pick(entities), pick(entities)],
    titleEn: input.sourceLang === 'en' ? null : input.title,
    incomplete: false,
  };
}
