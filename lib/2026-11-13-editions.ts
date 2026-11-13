import { dayKey, groupByDay, type DayGroup } from '@/lib/groupByDay';

/** Today and the five preceding calendar days in the feed time zone. */
export function editionWindow(now: Date): { first: string; last: string } {
  const last = dayKey(now);
  const firstDate = new Date(`${last}T12:00:00Z`);
  firstDate.setUTCDate(firstDate.getUTCDate() - 5);
  return { first: firstDate.toISOString().slice(0, 10), last };
}

/** The caller supplies newest-first articles; dates without stories are skipped. */
export function selectEdition<T extends { publishedAt: Date }>(articles: T[], requested: string | undefined, now: Date): {
  selected: DayGroup<T> | null; newer: DayGroup<T> | null; older: DayGroup<T> | null;
} {
  const { first, last } = editionWindow(now);
  const editions = groupByDay(articles).filter(({ key }) => key >= first && key <= last);
  const match = requested ? editions.findIndex(({ key }) => key === requested) : -1;
  const index = match >= 0 ? match : 0;
  return { selected: editions[index] ?? null, newer: editions[index - 1] ?? null, older: editions[index + 1] ?? null };
}
