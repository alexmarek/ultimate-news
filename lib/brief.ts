// lib/brief.ts
// Picks the stories for the daily brief: the most important ones for the reader
// (importance, set by Claude at ingest), newest first on ties, with at most a
// few per category so one busy topic cannot fill the whole brief. Science,
// positive news and travel are left out: worth reading, but not "must know".

export interface BriefCandidate {
  primaryArea: string;
  importance: number | null;
  publishedAt: Date;
}

export const BRIEF_SIZE = 5;
const PER_CATEGORY = 2;
/** Stories rated below this are never "must know", even on a quiet day. */
const MIN_IMPORTANCE = 3;
/** Good reading, but never "must know": these sections stay out of the brief. */
const LEISURE = new Set(['Science', 'Positive News', 'Travel']);

export function pickBrief<T extends BriefCandidate>(articles: T[], size = BRIEF_SIZE): T[] {
  const ranked = articles
    .filter((a) => (a.importance ?? 0) >= MIN_IMPORTANCE && !LEISURE.has(a.primaryArea))
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || b.publishedAt.getTime() - a.publishedAt.getTime());
  const perCategory = new Map<string, number>();
  const picked: T[] = [];
  for (const a of ranked) {
    const n = perCategory.get(a.primaryArea) ?? 0;
    if (n >= PER_CATEGORY) continue;
    perCategory.set(a.primaryArea, n + 1);
    picked.push(a);
    if (picked.length === size) break;
  }
  return picked;
}
