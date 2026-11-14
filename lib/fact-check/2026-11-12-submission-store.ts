import { randomUUID } from 'node:crypto';
import type { SubmissionStore } from './2026-11-12-submission';
import { FactCheckFailure } from './2026-11-13-failure';

interface SqlTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}
interface SqlDatabase { $transaction<T>(run: (tx: SqlTransaction) => Promise<T>): Promise<T> }

/** Requires the fact-check migration; database concurrency must be verified before use. */
export function createSubmissionStore(db: SqlDatabase, options: { modelId: string; methodologyVersion: string; maxConcurrentJobs?: number }): SubmissionStore {
  const maxConcurrentJobs = options.maxConcurrentJobs ?? 1;
  if (!options.modelId.trim() || !options.methodologyVersion.trim() || !Number.isSafeInteger(maxConcurrentJobs) || maxConcurrentJobs < 1 || maxConcurrentJobs > 10) throw new Error('Invalid fact-check configuration');
  return {
    async reserve(canonicalUrl, mode, input) {
      if (!canonicalUrl || (mode !== 'check' && mode !== 'refresh')) throw new Error('Invalid submission');
      return db.$transaction(async tx => {
        // Serialize admissions so the global limit also holds for different URLs.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(1690374772, 1178686251)`;
        const newArticleId = randomUUID();
        await tx.$executeRaw`INSERT INTO "FactCheckArticle" ("id", "canonicalUrl", "inputType", "inputText", "updatedAt")
          VALUES (${newArticleId}, ${canonicalUrl}, ${input?.type ?? 'url'}, ${input?.text ?? null}, NOW()) ON CONFLICT ("canonicalUrl") DO NOTHING`;
        const articles = await tx.$queryRaw<Array<{ id: string; activeJobId: string | null; publishedReportId: string | null }>>`
          SELECT "id", "activeJobId", "publishedReportId" FROM "FactCheckArticle" WHERE "canonicalUrl" = ${canonicalUrl} FOR UPDATE`;
        const article = articles[0];
        if (!article || articles.length !== 1) throw new Error('Invalid article');
        if (article.activeJobId) {
          const jobs = await tx.$queryRaw<Array<{ id: string; reportId: string; workflowId: string | null; createdAt: Date; databaseNow: Date }>>`
            SELECT j."id", j."reportId", j."workflowId", j."createdAt", clock_timestamp() AS "databaseNow" FROM "FactCheckJob" j
            JOIN "FactCheckReport" r ON r."id" = j."reportId"
            WHERE j."id" = ${article.activeJobId} AND r."articleId" = ${article.id}`;
          if (jobs.length !== 1) throw new Error('Invalid active job');
          const job = jobs[0];
          // The Workflow start token is retained for at least seven days. Stop
          // automatic recovery early enough that a stale retry cannot outlive it.
          if (job.workflowId === null) {
            if (!(job.databaseNow instanceof Date) || !(job.createdAt instanceof Date)) throw new FactCheckFailure('stalled', 'Job start needs manual recovery');
            const age = job.databaseNow.getTime() - job.createdAt.getTime();
            if (!Number.isFinite(age) || age < 0 || age >= 6 * 24 * 60 * 60 * 1000) throw new FactCheckFailure('stalled', 'Job start needs manual recovery');
          }
          return { kind: 'active', articleId: article.id, reportId: job.reportId, jobId: job.id, needsDispatch: job.workflowId === null };
        }
        if (mode === 'check') {
          const reports = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "FactCheckReport" WHERE "articleId" = ${article.id} AND
              (("id" = ${article.publishedReportId} AND "status" = 'published') OR "status" = 'ready-for-review')
            ORDER BY CASE WHEN "id" = ${article.publishedReportId} THEN 0 ELSE 1 END, "version" DESC LIMIT 1`;
          if (reports[0]) return { kind: 'existing', articleId: article.id, reportId: reports[0].id };
        }
        const totals = await tx.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::integer AS "count" FROM "FactCheckArticle" WHERE "activeJobId" IS NOT NULL`;
        if (totals.length !== 1 || !Number.isSafeInteger(totals[0].count)) throw new Error('Invalid active job count');
        if (totals[0].count >= maxConcurrentJobs) throw new FactCheckFailure('busy', 'Another fact check is already running');
        const versions = await tx.$queryRaw<Array<{ version: number }>>`
          SELECT COALESCE(MAX("version"), 0)::integer AS "version" FROM "FactCheckReport" WHERE "articleId" = ${article.id}`;
        const version = versions[0]?.version;
        if (!Number.isSafeInteger(version) || version < 0 || version >= 2147483647) throw new Error('Invalid report version');
        const reportId = randomUUID();
        const jobId = randomUUID();
        await tx.$executeRaw`INSERT INTO "FactCheckReport" ("id", "articleId", "version", "modelId", "methodologyVersion", "updatedAt")
          VALUES (${reportId}, ${article.id}, ${version + 1}, ${options.modelId}, ${options.methodologyVersion}, NOW())`;
        await tx.$executeRaw`INSERT INTO "FactCheckJob" ("id", "reportId", "updatedAt") VALUES (${jobId}, ${reportId}, NOW())`;
        const updated = await tx.$executeRaw`UPDATE "FactCheckArticle" SET "activeJobId" = ${jobId}, "updatedAt" = NOW()
          WHERE "id" = ${article.id} AND "activeJobId" IS NULL`;
        if (updated !== 1) throw new Error('Unable to reserve job');
        return { kind: 'created', articleId: article.id, reportId, jobId };
      });
    },
    async recordRun(jobId, runId) {
      if (!jobId || !runId) throw new Error('Invalid workflow run');
      await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "FactCheckJob" SET "workflowId" = ${runId}, "updatedAt" = NOW()
          WHERE "id" = ${jobId} AND ("workflowId" IS NULL OR "workflowId" = ${runId}) RETURNING "id"`;
        if (rows.length !== 1) throw new Error('Workflow run does not match job');
      });
    },
  };
}
