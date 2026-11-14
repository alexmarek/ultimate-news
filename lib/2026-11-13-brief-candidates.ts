import { pickBrief, type BriefCandidate } from '@/lib/brief';
import { editionWindow } from '@/lib/2026-11-13-editions';
import { dayKey } from '@/lib/groupByDay';

/** Fill the brief from the six-day window through the newest edition. */
export function pickEditionBrief<T extends BriefCandidate>(articles: T[], newestDay: string, now: Date): T[] {
  const { first } = editionWindow(now);
  return pickBrief(articles.filter((article) => {
    const day = dayKey(article.publishedAt);
    return day >= first && day <= newestDay;
  }));
}
