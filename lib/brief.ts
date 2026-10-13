// lib/brief.ts
// Picks the stories for the daily brief: the most important ones for the reader
// (importance, set by Claude at ingest), newest first on ties, with at most a
// few per category so one busy topic cannot fill the whole brief, and one item
// per story when several sources report the same event. Science,
// positive news and travel are left out: worth reading, but not "must know".

import { firstSentence } from '@/lib/summary';
import { STOPWORDS } from '@/lib/text';

export interface BriefCandidate {
  primaryArea: string;
  importance: number | null;
  publishedAt: Date;
  title?: string;
  summary?: string | null;
  clusterId?: string | null;
}

function storyWords(a: BriefCandidate): Set<string> {
  const text = `${a.title ?? ''} ${firstSentence(a.summary)}`.toLowerCase();
  return new Set((text.match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

/**
 * Two articles about the same event (e.g. the same news from tagesschau and FAZ):
 * the same story cluster, or headline + first sentence sharing most of their key words.
 */
export function sameStory(a: BriefCandidate, b: BriefCandidate): boolean {
  if (a.clusterId && a.clusterId === b.clusterId) return true;
  const wa = storyWords(a);
  const wb = storyWords(b);
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared >= 4 && shared / Math.min(wa.size, wb.size) >= 0.4;
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
    if (n >= PER_CATEGORY || picked.some((p) => sameStory(p, a))) continue;
    perCategory.set(a.primaryArea, n + 1);
    picked.push(a);
    if (picked.length === size) break;
  }
  return picked;
}
