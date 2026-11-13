'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/fact-check/2026-11-09-auth';
import { validateAssessment, type ClaimVerdict } from '@/lib/fact-check/2026-11-09-report-validation';
import { factCheckWorkflow } from '@/lib/fact-check/2026-11-12-fact-check-workflow';
import { readFactCheckJobSettings } from '@/lib/fact-check/2026-11-12-job-settings';
import { createSubmissionStore } from '@/lib/fact-check/2026-11-12-submission-store';
import { submitFactCheck } from '@/lib/fact-check/2026-11-12-submission';
import { loadWorkflowStartAdapter } from '@/lib/fact-check/2026-11-12-workflow-start-adapter';
import { submissionFailureCode } from '@/lib/fact-check/2026-11-13-failure';
import { FACT_CHECK_METHODOLOGY_VERSION } from '@/lib/fact-check/2026-11-13-scoring-rubric';

type ReviewReport = { id: string; articleId: string; status: string; canonicalUrl: string; score: number | null; verdict: ClaimVerdict | null; title: string | null; executiveSummary: string | null; verifiedAt: Date | null; confidence: string | null };
type ReviewClaim = { id: string; verdict: ClaimVerdict; score: number | null; central: boolean };
type ReviewEvidence = { id: string; claimId: string; url: string; excerpt: string };

export async function requestFactCheck(form: FormData): Promise<void> {
  if (!await canAccess('manage-fact-checks')) throw new Error('Unauthorized');
  const settings = readFactCheckJobSettings();
  if (!settings) redirect('/admin/fact-check?submission=unavailable');
  const url = form.get('url');
  const mode = form.get('mode') ?? 'check';
  if (typeof url !== 'string' || !url.trim() || url.length > 4096 || (mode !== 'check' && mode !== 'refresh')) {
    redirect('/admin/fact-check?submission=invalid');
  }

  let destination: string;
  try {
    const result = await submitFactCheck({
      url: url.trim(),
      mode,
      store: createSubmissionStore(prisma, { modelId: settings.model, methodologyVersion: FACT_CHECK_METHODOLOGY_VERSION }),
      starter: await loadWorkflowStartAdapter(factCheckWorkflow),
    });
    const pending = result.status === 'start_pending' ? '?submission=pending' : '';
    destination = `/admin/fact-check/${encodeURIComponent(result.reportId)}${pending}`;
  } catch (error) {
    destination = `/admin/fact-check?submission=${submissionFailureCode(error)}`;
  }
  redirect(destination);
}

export async function publishReport(form: FormData): Promise<void> {
  if (!await canAccess('manage-fact-checks')) throw new Error('Unauthorized');
  const id = form.get('id');
  if (typeof id !== 'string' || !id) throw new Error('Invalid report');
  await prisma.$transaction(async (tx) => {
    const reports = await tx.$queryRaw<ReviewReport[]>`SELECT r."id", r."articleId", r."status", a."canonicalUrl", r."score", r."verdict", r."title", r."executiveSummary", r."verifiedAt", r."confidence"
      FROM "FactCheckReport" r JOIN "FactCheckArticle" a ON a."id" = r."articleId" WHERE r."id" = ${id} FOR UPDATE OF r, a`;
    const report = reports[0];
    if (!report || report.status !== 'ready-for-review' || !report.title || !report.executiveSummary || !report.verifiedAt || !report.confidence || !report.verdict) throw new Error('Report is not ready for publication');
    const claims = await tx.$queryRaw<ReviewClaim[]>`SELECT "id", "verdict", "score", "central" FROM "FactCheckClaim" WHERE "reportId" = ${id}`;
    const evidence = await tx.$queryRaw<ReviewEvidence[]>`SELECT "id", "claimId", "url", "excerpt" FROM "FactCheckEvidence" WHERE "reportId" = ${id}`;
    if (!claims.length || evidence.some((item) => item.excerpt.trim().length < 20)) throw new Error('Report lacks reviewed evidence');
    const errors = validateAssessment({ articleUrl: report.canonicalUrl, score: report.score, verdict: report.verdict,
      claims: claims.map((claim) => ({ ...claim, evidenceIds: evidence.filter((item) => item.claimId === claim.id).map((item) => item.id) })), evidence });
    if (errors.length) throw new Error('Report did not pass publication validation');
    await tx.$executeRaw`UPDATE "FactCheckReport" SET "status" = 'superseded', "updatedAt" = NOW()
      WHERE "id" = (SELECT "publishedReportId" FROM "FactCheckArticle" WHERE "id" = ${report.articleId}) AND "id" <> ${id}`;
    await tx.$executeRaw`UPDATE "FactCheckReport" SET "status" = 'published', "publishedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = ${id}`;
    await tx.$executeRaw`UPDATE "FactCheckArticle" SET "publishedReportId" = ${id}, "updatedAt" = NOW() WHERE "id" = ${report.articleId}`;
  });
  revalidatePath('/fact-check');
  revalidatePath('/admin/fact-check');
}

export async function unpublishReport(form: FormData): Promise<void> {
  if (!await canAccess('manage-fact-checks')) throw new Error('Unauthorized');
  const id = form.get('id');
  if (typeof id !== 'string' || !id) throw new Error('Invalid report');
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ articleId: string }>>`SELECT r."articleId" FROM "FactCheckReport" r JOIN "FactCheckArticle" a ON a."id" = r."articleId"
      WHERE r."id" = ${id} AND r."status" = 'published' AND a."publishedReportId" = r."id" FOR UPDATE OF r, a`;
    if (!rows[0]) throw new Error('Report is not published');
    await tx.$executeRaw`UPDATE "FactCheckArticle" SET "publishedReportId" = NULL, "updatedAt" = NOW() WHERE "id" = ${rows[0].articleId}`;
    await tx.$executeRaw`UPDATE "FactCheckReport" SET "status" = 'ready-for-review', "updatedAt" = NOW() WHERE "id" = ${id}`;
  });
  revalidatePath('/fact-check');
  revalidatePath('/admin/fact-check');
}
