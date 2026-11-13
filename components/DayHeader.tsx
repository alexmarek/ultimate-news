import { categoryShortLabel, categoryStyle } from '@/lib/categoryColor';
import { countByCategory, dayLabelParts, type DayGroup } from '@/lib/groupByDay';

/**
 * Heading for one day of the archive: "Sunday 8 November",
 * and a row of per-category count chips. On desktop the chips sit to the right, over a 2px ink rule.
 */
export default function DayHeader({ group, headingId }: { group: DayGroup<{ primaryArea: string }>; headingId: string }) {
  const { weekday, day, month } = dayLabelParts(group.date);
  const counts = countByCategory(group.items);

  return (
    <header className="mb-5 md:mb-6 md:flex md:flex-wrap md:items-end md:justify-between md:gap-3 md:border-b-2 md:border-[var(--text)] md:pb-3">
      <h2 id={headingId} className="font-serif text-display-3 font-bold text-[var(--text)] md:text-[40px] md:leading-[44px]">
        {weekday}{' '}
        <span>
          {day}
        </span>{' '}
        {month}
      </h2>
      <ul className="mt-2.5 flex flex-wrap gap-1.5 md:mt-0" aria-label="Stories per category">
        {counts.map(({ area, count }) => (
          <li
            key={area}
            className="cat-fill  px-[9px] py-[3px] text-[12px] font-medium leading-4 md:px-2.5 md:py-1 md:text-[13px]"
            style={categoryStyle(area)}
          >
            {categoryShortLabel(area)} {count}
          </li>
        ))}
      </ul>
    </header>
  );
}
