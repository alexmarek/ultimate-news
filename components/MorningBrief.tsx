import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { Article, Source } from '@prisma/client';
import { decodeEntities } from '@/lib/text';
import { firstSentence } from '@/lib/summary';
import ForYouNote from '@/components/ForYouNote';

type BriefArticle = Article & { source: Source };

/** Today's essentials: a short numbered list with a clear end, so the day's reading can be finished. */
export default function MorningBrief({
  articles,
  readIds,
  forYouCount,
}: {
  articles: BriefArticle[];
  readIds: Set<string>;
  forYouCount: number;
}) {
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date());

  return (
    <section aria-labelledby="brief-heading" className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 id="brief-heading" className="font-serif text-headline-lg font-semibold text-[var(--text)]">Today&apos;s brief</h2>
        <span className="text-body-sm text-[var(--text-muted)]">{today}</span>
      </div>

      <ol className="space-y-5">
        {articles.map((a, i) => {
          const line = firstSentence(a.summary);
          return (
            <li key={a.id} className={`flex gap-3 ${readIds.has(a.id) ? 'opacity-60' : ''}`}>
              <span aria-hidden="true" className="font-serif text-headline-md font-semibold text-[var(--accent-3)] leading-tight w-5 flex-shrink-0">{i + 1}</span>
              <div className="min-w-0 space-y-1">
                <Link href={`/article/${a.id}`} className="block font-serif text-headline-sm font-semibold text-[var(--text)] hover:text-[var(--text-body)]">
                  {decodeEntities(a.title)}
                </Link>
                <p className="text-body-sm text-[var(--text-muted)]">{a.source.name} · {a.primaryArea}</p>
                {line && <p className="text-body-md text-[var(--text-body)]">{line}</p>}
                {a.forYou && <ForYouNote text={a.forYou} compact />}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body-md font-medium text-[var(--text)]">
          <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-[var(--accent-2)]" />
          You&apos;re up to date. Everything below is optional.
        </p>
        {forYouCount > 0 && (
          <Link href="/?forYou=1" className="text-body-sm font-medium text-[var(--accent)] hover:underline">
            {forYouCount === 1 ? 'The 1 story that affects you' : `All ${forYouCount} stories that affect you`} →
          </Link>
        )}
      </div>
    </section>
  );
}
