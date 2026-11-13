import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { FactCheckActionButton, FactCheckRefreshButton } from '@/components/2026-11-13-fact-check-action-button';
import { FactCheckStatus } from '@/components/2026-11-13-fact-check-status';
import { FactCheckClaims, FactCheckResult, factCheckLinkClass } from '@/components/2026-11-13-fact-check-report';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/fact-check/2026-11-09-auth';
import { jobFailureMessage } from '@/lib/fact-check/2026-11-13-failure';
import { readFactCheckJobSettings } from '@/lib/fact-check/2026-11-12-job-settings';
import { isActiveJobState } from '@/lib/fact-check/2026-11-09-job-state';
import { scoreMatchesVerdict } from '@/lib/fact-check/2026-11-13-scoring-rubric';
import { publishReport, requestFactCheck, unpublishReport } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ReviewFactCheck({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submission?: string }> }) {
  if (process.env.FACT_CHECK_ENABLED !== 'true' || !await canAccess('manage-fact-checks')) notFound();
  const { id } = await params;
  const { submission } = await searchParams;
  const reports = await prisma.$queryRaw<Array<{ title: string | null; canonicalUrl: string; status: string; jobStatus: string | null; errorCategory: string | null; score: number | null; verdict: string | null; confidence: string | null; executiveSummary: string | null }>>`
    SELECT r."title", a."canonicalUrl", r."status", r."score", r."verdict", r."confidence", r."executiveSummary",
      job."status" AS "jobStatus", job."errorCategory"
    FROM "FactCheckReport" r JOIN "FactCheckArticle" a ON a."id" = r."articleId"
    LEFT JOIN LATERAL (
      SELECT j."status", j."errorCategory" FROM "FactCheckJob" j
      WHERE j."reportId" = r."id" ORDER BY j."createdAt" DESC LIMIT 1
    ) job ON TRUE
    WHERE r."id" = ${id} LIMIT 1`;
  const report = reports[0];
  if (!report) notFound();
  const status = report.status === 'queued' ? report.jobStatus ?? 'queued' : report.status;
  const canRetry = status === 'failed' && jobFailureMessage(report.errorCategory).retry && readFactCheckJobSettings();
  const assessed = ['ready-for-review', 'published', 'superseded'].includes(report.status);
  const [claims, evidence] = assessed ? await Promise.all([
    prisma.$queryRaw<Array<{ id: string; statement: string; score: number | null; verdict: string; confidence: string; explanation: string }>>`
      SELECT "id", "statement", "score", "verdict", "confidence", "explanation" FROM "FactCheckClaim" WHERE "reportId" = ${id} ORDER BY "id"`,
    prisma.$queryRaw<Array<{ id: string; claimId: string; title: string; url: string; publisher: string | null; excerpt: string; relationship: string }>>`
      SELECT "id", "claimId", "title", "url", "publisher", "excerpt", "relationship" FROM "FactCheckEvidence" WHERE "reportId" = ${id} ORDER BY "id"`,
  ]) : [[], []];
  const needsScoreReview = assessed && (!scoreMatchesVerdict(report.score, report.verdict) ||
    claims.some(claim => !scoreMatchesVerdict(claim.score, claim.verdict)));

  return <>
    <SiteHeader />
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link href="/admin/fact-check" className={factCheckLinkClass}>Back to administration</Link>
      <header className="mt-6">
        <h1 className="font-serif text-display-3 font-bold text-[var(--text)] sm:text-display-2">{report.title ?? 'Fact-check report'}</h1>
      </header>
      <div className={`mt-3 ${assessed ? '' : 'rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-4'}`}>
        <FactCheckStatus status={status} errorCategory={report.errorCategory} startPending={status === 'queued' && submission === 'pending'} showDetail />
        {isActiveJobState(status) && <FactCheckRefreshButton key={id} />}
        {canRetry && <form action={requestFactCheck} className="mt-3">
          <input type="hidden" name="url" value={report.canonicalUrl} />
          <input type="hidden" name="mode" value="refresh" />
          <FactCheckActionButton label="Retry check" pendingLabel="Starting recheck…" secondary />
        </form>}
      </div>
      {assessed && <div className="mt-4"><FactCheckResult score={report.score} verdict={report.verdict} confidence={report.confidence} summary={report.executiveSummary} /></div>}
      {needsScoreReview && <div className="mt-4">
        <p className="text-body-sm text-[var(--text-muted)]">This report has scores that don’t fit the current rubric. Recheck the article to create a new report.</p>
        {readFactCheckJobSettings() && <form action={requestFactCheck} className="mt-2">
          <input type="hidden" name="url" value={report.canonicalUrl} />
          <input type="hidden" name="mode" value="refresh" />
          <FactCheckActionButton label="Recheck article" pendingLabel="Starting recheck…" secondary />
        </form>}
      </div>}
      {report.status === 'ready-for-review' && !needsScoreReview && <form action={publishReport} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <FactCheckActionButton label="Publish report" pendingLabel="Publishing report…" />
      </form>}
      {report.status === 'published' && <form action={unpublishReport} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <FactCheckActionButton label="Unpublish report" pendingLabel="Unpublishing report…" secondary />
      </form>}
      <FactCheckClaims claims={claims} evidence={evidence} />
    </main>
  </>;
}
