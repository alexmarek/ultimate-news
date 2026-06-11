// lib/ai/enrich-simple.ts
// Simplified enrichment for development without AI dependencies

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

const topicPools: Record<string, string[]> = {
  Music: ['metal', 'new album', 'tour', 'guitar', 'review', 'interview', 'festival', 'band', 'single', 'vinyl', 'heavy metal', 'stoner rock', 'doom', 'death metal', 'black metal', 'lineup', 'shows', 'recording', 'label news', 'gear'],
  Technology: ['AI', 'startup', 'cybersecurity', 'software', 'hardware', 'privacy', 'innovation', 'cloud', 'data', 'regulation', 'mobile', 'gadgets', 'machine learning', 'automation', 'blockchain'],
  Politics: ['election', 'legislation', 'congress', 'policy', 'government', 'regulation', 'diplomacy', 'campaign', 'voting', 'senate', 'reform', 'immigration', 'healthcare', 'budget', 'oversight'],
  Business: ['markets', 'economy', 'trade', 'stocks', 'investment', 'banking', 'real estate', 'startups', 'retail', 'mergers', 'interest rates', 'inflation', 'supply chain', 'labor', 'consumer'],
  Environment: ['climate', 'emissions', 'renewable', 'conservation', 'pollution', 'sustainability', 'wildlife', 'energy', 'carbon', 'green tech', 'environment', 'species', 'warming', 'ecosystem'],
  World: ['international', 'conflict', 'diplomacy', 'crisis', 'aid', 'summit', 'war', 'security', 'alliance', 'migration', 'trade war', 'sanctions', 'treaty', 'negotiations', 'human rights'],
};

const generalTopics = ['analysis', 'opinion', 'report', 'data', 'study', 'insight', 'editorial', 'feature', 'breaking', 'exclusive', 'investigation', 'commentary', 'trending', 'profile'];

const sourceEntities: Record<string, string[]> = {
  'Blabbermouth.net': ['Moonspell', 'Metallica', 'Slipknot', 'Cradle of Filth', 'Arch Enemy', 'Gojira'],
  'MusicRadar': ['Fender', 'Gibson', 'Neural DSP', 'IK Multimedia', 'Universal Audio'],
  'Guitar World': ['Ibanez', 'ESP', 'BC Rich', 'Jackson', 'PRS', 'Marshall'],
  'The Hacker News': ['CISA', 'FBI', 'Microsoft', 'Google', 'Cloudflare'],
  'Wired': ['OpenAI', 'Google', 'Apple', 'Meta', 'The Pentagon'],
  'NPR': ['Congress', 'White House', 'Supreme Court', 'FDA', 'CDC'],
  'DW': ['EU', 'NATO', 'Bundestag', 'European Commission', 'UN'],
};

export async function enrichArticle(input: EnrichInput): Promise<EnrichOutput> {
  const musicSources = ['Blabbermouth.net', 'MusicRadar', 'Guitar World'];
  const isMusic = musicSources.includes(input.sourceName);

  const generalAreas = ['World', 'Technology', 'Environment', 'Politics', 'Business'];
  const areas = isMusic
    ? ['Music', ...generalAreas]
    : generalAreas;

  const areaIndex = isMusic
    ? Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * (areas.length - 1))
    : Math.floor(Math.random() * areas.length);

  const selectedArea = areas[areaIndex];
  const pool = topicPools[selectedArea] || generalTopics;
  const chosen: string[] = [];
  const used = new Set<number>();

  while (chosen.length < 3 && used.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (!used.has(i)) {
      used.add(i);
      chosen.push(pool[i]);
    }
  }

  const entities = sourceEntities[input.sourceName] || ['Global Organization', 'Expert Analysis', 'Industry Leader'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  return {
    summary: input.excerpt || input.content?.replace(/<[^>]*>/g, '').slice(0, 400) || '',
    areas: [{ area: selectedArea, confidence: 0.8 }],
    topics: chosen,
    entities: [pick(entities), pick(entities)],
    titleEn: input.sourceLang === 'en' ? null : input.title,
    incomplete: false,
  };
}
