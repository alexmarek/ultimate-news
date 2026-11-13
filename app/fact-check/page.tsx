import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { FactCheckVerdict, factCheckLinkClass } from '@/components/2026-11-13-fact-check-report';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function FactCheckArchive() {
  if (process.env.FACT_CHECK_ENABLED !== 'true') notFound();
  const reports = await prisma.$queryRaw<Array<{ id: string; title: string | null; publisher: string | null; verdict: string | null; score: number | null; verifiedAt: Date | null }>>`
    SELECT a."id", r."title", r."publisher", r."verdict", r."score", r."verifiedAt"
    FROM "FactCheckArticle" a JOIN "FactCheckReport" r ON a."publishedReportId" = r."id"
    WHERE r."articleId" = a."id" AND r."status" = 'published'
    ORDER BY r."verifiedAt" DESC NULLS LAST`;
  return <>
    <SiteHeader />
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="font-serif text-display-2 font-bold text-[var(--text)]">Fact checks</h1>
      {reports.length === 0 ? <p className="mt-5 text-[var(--text-muted)]">No fact checks have been published yet.</p> : <ul className="mt-5 space-y-2">
        {reports.map((report) => <li key={report.id} className="rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] p-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h2 className="min-w-0 grow font-serif text-headline-md font-semibold">
              <Link href={`/fact-check/${encodeURIComponent(report.id)}`} className={factCheckLinkClass}>{report.title ?? 'Untitled article'}</Link>
            </h2>
            <FactCheckVerdict verdict={report.verdict} score={report.score} />
          </div>
          {(report.publisher || report.verifiedAt) && <p className="mt-1 text-body-sm text-[var(--text-muted)]">
            {[report.publisher, report.verifiedAt && `Verified ${report.verifiedAt.toISOString().slice(0, 10)}`].filter(Boolean).join(' · ')}
          </p>}
        </li>)}
      </ul>}
    </main>
  </>;
}
