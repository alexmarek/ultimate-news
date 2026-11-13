import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { FactCheckActionButton } from '@/components/2026-11-13-fact-check-action-button';
import { FactCheckStatus } from '@/components/2026-11-13-fact-check-status';
import { prisma } from '@/lib/db';
import { auth, canAccess, signIn, signOut } from '@/lib/fact-check/2026-11-09-auth';
import { readFactCheckJobSettings } from '@/lib/fact-check/2026-11-12-job-settings';
import { submissionFailureMessage } from '@/lib/fact-check/2026-11-13-failure';
import { requestFactCheck } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminFactCheckPage({ searchParams }: { searchParams: Promise<{ submission?: string }> }) {
  if (process.env.FACT_CHECK_ENABLED !== 'true') notFound();
  const session = await auth();
  const allowed = session && await canAccess('manage-fact-checks');
  const owner = allowed && await canAccess('manage-users');
  const canSubmit = allowed && !!readFactCheckJobSettings();
  const { submission } = await searchParams;
  const feedback = submissionFailureMessage(submission) ?? (!canSubmit ? submissionFailureMessage('unavailable') : undefined);
  const reports = allowed ? await prisma.$queryRaw<Array<{ id: string; title: string | null; status: string; errorCategory: string | null; createdAt: Date }>>`
    SELECT r."id", r."title", r."createdAt", job."errorCategory",
      CASE WHEN r."status" = 'queued' THEN COALESCE(job."status", r."status") ELSE r."status" END AS "status"
    FROM "FactCheckReport" r
    LEFT JOIN LATERAL (
      SELECT j."status", j."errorCategory" FROM "FactCheckJob" j
      WHERE j."reportId" = r."id" ORDER BY j."createdAt" DESC LIMIT 1
    ) job ON TRUE
    ORDER BY r."createdAt" DESC LIMIT 50` : [];
  return <>
    <SiteHeader />
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-bold">Fact-check administration</h1>
      {!session ? <form className="mt-6" action={async () => { 'use server'; await signIn('google', { redirectTo: '/admin/fact-check' }); }}>
        <FactCheckActionButton label="Sign in with Google" pendingLabel="Opening Google sign-in…" />
      </form> : !allowed ? <p className="mt-6">This Google account does not have fact-check access.</p> : <>
        {feedback && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] p-3 text-[var(--error)]">
          <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          {feedback}
        </p>}
        {canSubmit && <form action={requestFactCheck} className="mt-6 space-y-3">
          <label htmlFor="fact-check-url" className="block font-semibold">Article URL</label>
          <input id="fact-check-url" name="url" type="url" required maxLength={4096}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2" />
          <div className="flex flex-wrap gap-3">
            <FactCheckActionButton mode="check" label="Check article" pendingLabel="Starting check…" />
            <FactCheckActionButton mode="refresh" label="Recheck article" pendingLabel="Starting recheck…" secondary />
          </div>
        </form>}
        <ul className="mt-6 divide-y divide-[var(--border)]">
          {reports.map((report) => <li key={report.id} className="py-4">
            <Link href={`/admin/fact-check/${encodeURIComponent(report.id)}`} className="font-serif text-lg font-semibold underline">{report.title ?? 'Untitled report'}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <FactCheckStatus status={report.status} errorCategory={report.errorCategory} />
              <time className="text-body-sm text-[var(--text-muted)]" dateTime={report.createdAt.toISOString()}>{report.createdAt.toISOString().slice(0, 10)}</time>
            </div>
          </li>)}
        </ul>
        {owner && <p className="mt-6"><Link className="underline" href="/admin/fact-check/users">Manage users</Link></p>}
        <form className="mt-6" action={async () => { 'use server'; await signOut({ redirectTo: '/admin/fact-check' }); }}>
          <FactCheckActionButton label="Sign out" pendingLabel="Signing out…" secondary />
        </form>
      </>}
    </main>
  </>;
}
