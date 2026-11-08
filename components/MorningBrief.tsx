import Link from 'next/link';
import type { Article, Source } from '@prisma/client';
import { decodeEntities } from '@/lib/text';
import { categoryShortLabel, categoryStyle } from '@/lib/categoryColor';
import { FEED_TIME_ZONE, dayLabelParts } from '@/lib/groupByDay';

type BriefArticle = Article & { source: Source };

/**
 * Today's essentials: a short numbered list of headlines (no summaries) with a clear end,
 * so the day's reading can be finished. One column on mobile, two inside the panel from `md`.
 */
export default function MorningBrief({
  articles,
  readIds,
}: {
  articles: BriefArticle[];
  readIds: Set<string>;
}) {
  const { weekday, day, month } = dayLabelParts(new Date(), FEED_TIME_ZONE);

  return (
    <section
      aria-labelledby="brief-heading"
      className="rounded-2xl bg-[var(--panel)] px-[18px] pb-2 pt-5 text-[var(--text)] md:rounded-[18px] md:px-7 md:pb-3 md:pt-6"
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 id="brief-heading" className="font-serif text-[24px] font-bold leading-7 md:text-[28px] md:leading-8">Today&apos;s brief</h2>
        <span className="text-body-sm text-[var(--text-muted)] md:text-[14px]">
          <span className="md:hidden">{weekday.slice(0, 3)} {day} {month.slice(0, 3)}</span>
          <span className="hidden md:inline">{weekday} {day} {month}</span>
        </span>
      </div>

      <ol className="md:columns-2 md:gap-x-10">
        {articles.map((a, i) => (
          <li
            key={a.id}
            className={`flex break-inside-avoid gap-3 border-b border-[rgb(26_28_24/0.10)] py-3 last:border-b-0 md:gap-4 md:py-3.5 dark:border-[rgb(254_252_240/0.12)] ${
              readIds.has(a.id) ? 'opacity-60' : ''
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--highlight)] font-serif text-[15px] font-bold leading-none text-[var(--ink)] md:h-7 md:w-7 md:text-[16px]"
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Link
                href={`/article/${a.id}`}
                className="font-serif text-[17px] font-semibold leading-[22px] text-[var(--text)] hover:underline md:text-[18px] md:leading-[23px]"
              >
                {decodeEntities(a.title)}
              </Link>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-[var(--text-muted)]">
                <span>{a.source.name}</span>
                <span className="cat-fill rounded-full px-2 py-0.5 text-[12px] font-medium leading-4" style={categoryStyle(a.primaryArea)}>
                  {categoryShortLabel(a.primaryArea)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
