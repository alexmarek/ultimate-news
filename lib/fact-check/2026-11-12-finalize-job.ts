import { validateAssessment, type ClaimVerdict } from './2026-11-09-report-validation';
import type { JobFailure } from './2026-11-13-failure';

interface SqlTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}
interface SqlDatabase { $transaction<T>(run: (tx: SqlTransaction) => Promise<T>): Promise<T> }
type Report = { id: string; status: string; canonicalUrl: string; title: string | null; verdict: ClaimVerdict | null; score: number | null; confidence: string | null; executiveSummary: string | null; verifiedAt: Date | null };
type Claim = { id: string; central: boolean; verdict: ClaimVerdict; score: number | null; checkpoint: string | null };
type Evidence = { id: string; claimId: string; url: string; excerpt: string };

/** Validate persisted results again before moving a report into the review queue. */
export function assertReadyForReview(report: Report, claims: Claim[], evidence: Evidence[]): void {
  if (!report.title?.trim() || !report.executiveSummary?.trim() || !report.verifiedAt || !Number.isFinite(report.verifiedAt.getTime()) ||
      !report.verdict || !['supported', 'mostly-supported', 'mixed', 'mostly-false', 'false', 'unverified'].includes(report.verdict) ||
      !report.confidence || !['high', 'medium', 'low'].includes(report.confidence) ||
      !claims.length || claims.length > 8 || claims.some(claim => claim.checkpoint !== 'complete' || !['supported', 'mostly-supported', 'mixed', 'mostly-false', 'false', 'unverified'].includes(claim.verdict)) ||
      evidence.some(item => !item.excerpt || item.excerpt.trim().length < 20)) throw new Error('Report is not ready for review');
  const errors = validateAssessment({ articleUrl: report.canonicalUrl, score: report.score, verdict: report.verdict,
    claims: claims.map(claim => ({ ...claim, evidenceIds: evidence.filter(item => item.claimId === claim.id).map(item => item.id) })), evidence });
  if (errors.length) throw new Error('Report is not ready for review');
}

/** PostgreSQL behavior and concurrent worker races require development-database verification before use. */
export function createJobFinalizer(db: SqlDatabase) {
  return {
    async finish(jobId: string): Promise<void> {
      if (!jobId) throw new Error('Invalid job');
      await db.$transaction(async tx => {
        const articleRows = await tx.$queryRaw<Array<{ id: string; activeJobId: string | null }>>`
          SELECT a."id", a."activeJobId" FROM "FactCheckArticle" a
          JOIN "FactCheckReport" r ON r."articleId" = a."id" JOIN "FactCheckJob" j ON j."reportId" = r."id"
          WHERE j."id" = ${jobId} FOR UPDATE OF a`;
        if (articleRows.length !== 1) throw new Error('Invalid job');
        const jobs = await tx.$queryRaw<Array<{ status: string; reportId: string }>>`
          SELECT "status", "reportId" FROM "FactCheckJob" WHERE "id" = ${jobId} FOR UPDATE`;
        const job = jobs[0];
        if (!job || jobs.length !== 1) throw new Error('Invalid job');
        if (job.status === 'ready-for-review') return;
        if (job.status !== 'evaluating' || articleRows[0].activeJobId !== jobId) throw new Error('Job is not ready');
        const reports = await tx.$queryRaw<Report[]>`SELECT r."id", r."status", a."canonicalUrl", r."title", r."verdict", r."score", r."confidence", r."executiveSummary", r."verifiedAt"
          FROM "FactCheckReport" r JOIN "FactCheckArticle" a ON a."id" = r."articleId" WHERE r."id" = ${job.reportId} FOR UPDATE OF r`;
        const report = reports[0];
        if (!report || reports.length !== 1 || report.status !== 'queued') throw new Error('Invalid report state');
        const claims = await tx.$queryRaw<Claim[]>`SELECT c."id", c."central", c."verdict", c."score", cp."state" AS "checkpoint"
          FROM "FactCheckClaim" c LEFT JOIN "FactCheckClaimCheckpoint" cp ON cp."claimId" = c."id" AND cp."jobId" = ${jobId}
          WHERE c."reportId" = ${job.reportId}`;
        const evidence = await tx.$queryRaw<Evidence[]>`SELECT "id", "claimId", "url", "excerpt" FROM "FactCheckEvidence" WHERE "reportId" = ${job.reportId}`;
        assertReadyForReview(report, claims, evidence);
        await tx.$executeRaw`UPDATE "FactCheckReport" SET "status" = 'ready-for-review', "updatedAt" = NOW() WHERE "id" = ${job.reportId}`;
        await tx.$executeRaw`UPDATE "FactCheckJob" SET "status" = 'ready-for-review', "updatedAt" = NOW() WHERE "id" = ${jobId}`;
        const released = await tx.$executeRaw`UPDATE "FactCheckArticle" SET "activeJobId" = NULL, "updatedAt" = NOW() WHERE "id" = ${articleRows[0].id} AND "activeJobId" = ${jobId}`;
        if (released !== 1) throw new Error('Job lock changed');
      });
    },
    async fail(jobId: string, category: JobFailure): Promise<void> {
      if (!jobId) throw new Error('Invalid job');
      await db.$transaction(async tx => {
        const articles = await tx.$queryRaw<Array<{ id: string; activeJobId: string | null }>>`
          SELECT a."id", a."activeJobId" FROM "FactCheckArticle" a
          JOIN "FactCheckReport" r ON r."articleId" = a."id" JOIN "FactCheckJob" j ON j."reportId" = r."id"
          WHERE j."id" = ${jobId} FOR UPDATE OF a`;
        if (articles.length !== 1) throw new Error('Invalid job');
        const jobs = await tx.$queryRaw<Array<{ status: string; reportId: string }>>`
          SELECT "status", "reportId" FROM "FactCheckJob" WHERE "id" = ${jobId} FOR UPDATE`;
        const job = jobs[0];
        if (!job || jobs.length !== 1) throw new Error('Invalid job');
        if (job.status === 'failed') return;
        if (!['queued', 'extracting', 'identifying-claims', 'researching', 'evaluating'].includes(job.status) || articles[0].activeJobId !== jobId) throw new Error('Job is not active');
        const reportUpdated = await tx.$executeRaw`UPDATE "FactCheckReport" SET "status" = 'failed', "updatedAt" = NOW()
          WHERE "id" = ${job.reportId} AND "status" = 'queued'`;
        if (reportUpdated !== 1) throw new Error('Invalid report state');
        await tx.$executeRaw`UPDATE "FactCheckJob" SET "status" = 'failed', "errorCategory" = ${category}, "updatedAt" = NOW() WHERE "id" = ${jobId}`;
        const released = await tx.$executeRaw`UPDATE "FactCheckArticle" SET "activeJobId" = NULL, "updatedAt" = NOW() WHERE "id" = ${articles[0].id} AND "activeJobId" = ${jobId}`;
        if (released !== 1) throw new Error('Job lock changed');
      });
    },
  };
}
