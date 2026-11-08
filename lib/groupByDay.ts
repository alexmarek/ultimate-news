// Groups feed articles by local calendar day, for the day headers in the archive.

/** The feed's "day" is the reader's local day, not UTC. */
export const FEED_TIME_ZONE = 'Europe/Prague';

export interface DayGroup<T> {
  /** `YYYY-MM-DD` in the feed time zone. */
  key: string;
  /** Any moment within that day (the first item's); format it with the same time zone. */
  date: Date;
  items: T[];
}

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions, locale: string) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat(locale, { timeZone, ...options }).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}

/** `YYYY-MM-DD` of the day `date` falls on in `timeZone`. */
export function dayKey(date: Date, timeZone: string = FEED_TIME_ZONE): string {
  const p = parts(date, timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA');
  return `${p.year}-${p.month}-${p.day}`;
}

/** The pieces of "Sunday 8 November", for rendering the day numeral on its own. */
export function dayLabelParts(date: Date, timeZone: string = FEED_TIME_ZONE): { weekday: string; day: string; month: string } {
  const p = parts(date, timeZone, { weekday: 'long', day: 'numeric', month: 'long' }, 'en-GB');
  return { weekday: p.weekday, day: p.day, month: p.month };
}

/** Groups in order of first appearance (so a newest-first list gives newest-day-first groups). */
export function groupByDay<T extends { publishedAt: Date }>(items: T[], timeZone: string = FEED_TIME_ZONE): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const key = dayKey(item.publishedAt, timeZone);
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, date: item.publishedAt, items: [item] });
  }
  return [...groups.values()];
}

/** Articles per category, most first (ties alphabetical). */
export function countByCategory(items: { primaryArea: string }[]): { area: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { primaryArea } of items) counts.set(primaryArea, (counts.get(primaryArea) ?? 0) + 1);
  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}
