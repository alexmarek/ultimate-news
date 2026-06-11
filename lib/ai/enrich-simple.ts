// lib/ai/enrich-simple.ts
// Simplified enrichment for development without AI dependencies

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

const topicPools: Record<Area, string[]> = {
  World: ['international', 'conflict', 'diplomacy', 'crisis', 'aid', 'summit', 'war', 'security', 'alliance', 'migration', 'trade war', 'sanctions', 'treaty', 'negotiations', 'human rights'],
  Politics: ['election', 'legislation', 'congress', 'policy', 'government', 'regulation', 'diplomacy', 'campaign', 'voting', 'senate', 'reform', 'immigration', 'healthcare', 'budget', 'oversight'],
  Tech: ['AI', 'startup', 'cybersecurity', 'software', 'hardware', 'privacy', 'innovation', 'cloud', 'data', 'regulation', 'mobile', 'gadgets', 'machine learning', 'automation', 'blockchain'],
  Business: ['markets', 'economy', 'trade', 'stocks', 'investment', 'banking', 'real estate', 'startups', 'retail', 'mergers', 'interest rates', 'inflation', 'supply chain', 'labor', 'consumer'],
  Science: ['research', 'discovery', 'study', 'space', 'medicine', 'biology', 'physics', 'chemistry', 'genetics', 'climate', 'breakthrough', 'NASA', 'experiment', 'peer-reviewed', 'journal'],
  Culture: ['film', 'art', 'literature', 'theater', 'museum', 'exhibition', 'heritage', 'festival', 'fashion', 'architecture', 'design', 'media', 'pop culture', 'awards', 'review'],
  'Music industry': ['metal', 'new album', 'tour', 'guitar', 'review', 'interview', 'festival', 'band', 'single', 'vinyl', 'heavy metal', 'stoner rock', 'doom', 'death metal', 'black metal', 'lineup', 'shows', 'recording', 'label news', 'gear'],
  'CZ-local': ['Prague', 'Brno', 'Ostrava', 'parliament', 'government', 'municipal', 'regional', 'infrastructure', 'housing', 'education', 'healthcare', 'transport', 'elections', 'opinion', 'economy'],
  Sport: ['football', 'hockey', 'tennis', 'championship', 'league', 'tournament', 'transfer', 'injury', 'playoffs', 'standings', 'ranking', 'Olympics', 'World Cup', 'match', 'score'],
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

  const areas: Area[] = isMusic
    ? ['Music industry', ...AREAS.filter((a) => a !== 'Music industry')]
    : [...AREAS];

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
