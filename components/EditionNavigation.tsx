import Link from 'next/link';
import { dayLabelParts } from '@/lib/groupByDay';

type Edition = { key: string; date: Date };
function label(edition: Edition) {
  const { weekday, day, month } = dayLabelParts(edition.date);
  return `${weekday} ${day} ${month}`;
}
export default function EditionNavigation({ newer, older, category, hideRead }: {
  newer: Edition | null; older: Edition | null; category?: string; hideRead: boolean;
}) {
  const href = (edition: Edition) => {
    const params = new URLSearchParams({ day: edition.key });
    if (category && category !== 'all') params.set('category', category);
    if (hideRead) params.set('hideRead', '1');
    return `/?${params}`;
  };
  if (!newer && !older) return null;
  return <nav aria-label="Editions" className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ink)] py-2 text-ui">
    {newer ? <Link className="inline-flex min-h-11 items-center hover:text-[var(--accent)]" href={href(newer)}>← {label(newer)}</Link> : <span className="text-[var(--meta)]">Older editions</span>}
    {older && <Link className="inline-flex min-h-11 items-center font-semibold hover:text-[var(--accent)]" href={href(older)}>{label(older)} →</Link>}
  </nav>;
}
