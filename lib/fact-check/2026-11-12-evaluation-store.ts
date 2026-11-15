import { randomUUID } from 'node:crypto';
import { FactCheckFailure } from './2026-11-13-failure';
import { parseCheckpointRow } from './2026-11-12-checkpoint-parser';
import { canCommitClaimLease, decideClaimLease } from './2026-11-12-lease-policy';
import type { EvaluationStore } from './2026-11-12-evaluate-job';
import type { ResearchSummaryInput } from './2026-11-12-summarize-research';
import { assertReadyForReview } from './2026-11-12-finalize-job';

interface SqlTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}
interface SqlDatabase { $transaction<T>(run: (tx: SqlTransaction) => Promise<T>): Promise<T> }
type Checkpoint = { state: string; leaseToken: string | null; leaseExpiresAt: Date | null; attempts: number };
type StoredClaim = ResearchSummaryInput['claims'][number] & { checkpoint: string | null };
type StoredEvidence = ResearchSummaryInput['evidence'][number];

/** PostgreSQL locking and the associated migration must be tested before use. */
export function createEvaluationStore(db: SqlDatabase, limits: { costUsd: number; maxAttempts: number; leaseMs: number }): EvaluationStore {
  const maxCostMicros = Math.floor(limits.costUsd * 1_000_000);
  if (!Number.isSafeInteger(maxCostMicros) || maxCostMicros < 1 || !Number.isSafeInteger(limits.maxAttempts) || limits.maxAttempts < 1 ||
      !Number.isSafeInteger(limits.leaseMs) || limits.leaseMs < 1 || limits.leaseMs > 600_000) throw new Error('Invalid job limits');
  const readClaims = async (tx: SqlTransaction, jobId: string, reportId: string) => tx.$queryRaw<StoredClaim[]>`
    SELECT c."id", c."statement", c."importance", c."central", c."verdict", c."score", c."confidence", c."explanation", cp."state" AS "checkpoint"
    FROM "FactCheckClaim" c LEFT JOIN "FactCheckClaimCheckpoint" cp ON cp."jobId" = ${jobId} AND cp."claimId" = c."id"
    WHERE c."reportId" = ${reportId} ORDER BY c."id"`;
  const readEvidence = async (tx: SqlTransaction, reportId: string) => tx.$queryRaw<StoredEvidence[]>`
    SELECT "id", "claimId", "url", "excerpt", "relationship" FROM "FactCheckEvidence" WHERE "reportId" = ${reportId} ORDER BY "id"`;
  return {
    async acquire(jobId) {
      if (!jobId) throw new Error('Invalid job');
      return db.$transaction(async tx => {
        await tx.$executeRaw`INSERT INTO "FactCheckEvaluationCheckpoint" ("jobId", "updatedAt")
          SELECT j."id", NOW() FROM "FactCheckJob" j JOIN "FactCheckReport" r ON r."id" = j."reportId"
          JOIN "FactCheckArticle" a ON a."id" = r."articleId"
          WHERE j."id" = ${jobId} AND a."activeJobId" = j."id" AND j."status" IN ('researching', 'evaluating')
          ON CONFLICT ("jobId") DO NOTHING`;
        const rows = await tx.$queryRaw<Array<Checkpoint & { reportId: string; jobStatus: string; activeJobId: string | null; articleUrl: string; articleTitle: string | null }>>`
          SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts", j."reportId", j."status" AS "jobStatus",
            a."activeJobId", a."canonicalUrl" AS "articleUrl", r."title" AS "articleTitle"
          FROM "FactCheckEvaluationCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          JOIN "FactCheckReport" r ON r."id" = j."reportId" JOIN "FactCheckArticle" a ON a."id" = r."articleId"
          WHERE cp."jobId" = ${jobId} FOR UPDATE OF cp, j`;
        const row = rows[0];
        if (!row || rows.length !== 1) throw new Error('Invalid job');
        const checkpoint = parseCheckpointRow({ state: row.state, leaseToken: row.leaseToken, leaseExpiresAt: row.leaseExpiresAt, attempts: row.attempts });
        if (checkpoint.state === 'complete') return { kind: 'complete' };
        if (row.activeJobId !== jobId || !['researching', 'evaluating'].includes(row.jobStatus) || !row.articleTitle) throw new Error('Job is not active');
        const claims = await readClaims(tx, jobId, row.reportId);
        if (!claims.length || claims.length > 8 || claims.some(claim => claim.checkpoint !== 'complete')) throw new Error('Research is not complete');
        const evidence = await readEvidence(tx, row.reportId);
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (!(clock[0]?.databaseNow instanceof Date)) throw new Error('Database clock unavailable');
        const decision = decideClaimLease(checkpoint, clock[0].databaseNow.getTime(), randomUUID(), limits.leaseMs, limits.maxAttempts);
        if (decision.kind === 'busy') return decision;
        if (decision.kind !== 'acquire') throw new Error('Evaluation retry limit reached');
        await tx.$executeRaw`UPDATE "FactCheckEvaluationCheckpoint" SET "state" = 'leased', "leaseToken" = ${decision.token},
          "leaseExpiresAt" = ${new Date(decision.expiresAtMs)}, "attempts" = ${decision.attempts}, "updatedAt" = NOW() WHERE "jobId" = ${jobId}`;
        await tx.$executeRaw`UPDATE "FactCheckJob" SET "status" = 'evaluating', "updatedAt" = NOW() WHERE "id" = ${jobId}`;
        return { kind: 'acquired', token: decision.token, input: { articleUrl: row.articleUrl, articleTitle: row.articleTitle,
          claims: claims.map(({ checkpoint: _checkpoint, ...claim }) => claim), evidence } };
      });
    },
    async reserve(jobId, token, maximumCostUsd) {
      const micros = Math.ceil(maximumCostUsd * 1_000_000);
      if (!jobId || !token || !Number.isSafeInteger(micros) || micros < 1) throw new Error('Invalid reservation');
      await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<Checkpoint[]>`SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts"
          FROM "FactCheckEvaluationCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          WHERE cp."jobId" = ${jobId} AND j."status" = 'evaluating' FOR UPDATE OF cp, j`;
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (rows.length !== 1 || !(clock[0]?.databaseNow instanceof Date) || !canCommitClaimLease(parseCheckpointRow(rows[0]), token, clock[0].databaseNow.getTime())) throw new Error('Lease expired');
        const jobs = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "FactCheckJob" SET
          "estimatedCost" = (CEIL("estimatedCost"::numeric * 1000000) + ${micros}) / 1000000, "updatedAt" = NOW()
          WHERE "id" = ${jobId} AND "status" = 'evaluating' AND CEIL("estimatedCost"::numeric * 1000000) + ${micros} <= ${maxCostMicros} RETURNING "id"`;
        if (jobs.length === 0) throw new FactCheckFailure('budget', 'Budget exhausted');
        if (jobs.length !== 1) throw new Error('Invalid job reservation');
      });
    },
    async complete(jobId, token, result) {
      if (!jobId || !token) throw new Error('Invalid lease');
      await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<Array<Checkpoint & { reportId: string; articleUrl: string; articleTitle: string | null }>>`
          SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts", j."reportId", a."canonicalUrl" AS "articleUrl", r."title" AS "articleTitle"
          FROM "FactCheckEvaluationCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          JOIN "FactCheckReport" r ON r."id" = j."reportId" JOIN "FactCheckArticle" a ON a."id" = r."articleId"
          WHERE cp."jobId" = ${jobId} AND j."status" = 'evaluating' FOR UPDATE OF cp, j`;
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        const row = rows[0];
        if (!row || rows.length !== 1 || !(clock[0]?.databaseNow instanceof Date) || !canCommitClaimLease(parseCheckpointRow({ state: row.state, leaseToken: row.leaseToken, leaseExpiresAt: row.leaseExpiresAt, attempts: row.attempts }), token, clock[0].databaseNow.getTime())) throw new Error('Lease expired');
        const claims = await readClaims(tx, jobId, row.reportId);
        const evidence = await readEvidence(tx, row.reportId);
        assertReadyForReview({ id: row.reportId, status: 'queued', canonicalUrl: row.articleUrl, title: row.articleTitle,
          verdict: result.verdict, score: result.score, confidence: result.confidence, executiveSummary: result.executiveSummary, verifiedAt: clock[0].databaseNow }, claims, evidence);
        const updated = await tx.$executeRaw`UPDATE "FactCheckReport" SET "score" = ${result.score}, "verdict" = ${result.verdict}, "confidence" = ${result.confidence},
          "executiveSummary" = ${result.executiveSummary}, "supportedFindings" = ${JSON.stringify(result.supportedFindings)}::jsonb,
          "unsupportedFindings" = ${JSON.stringify(result.unsupportedFindings)}::jsonb, "missingContext" = ${JSON.stringify(result.missingContext)}::jsonb,
          "accurateFormulation" = ${result.accurateFormulation}, "verifiedAt" = ${clock[0].databaseNow}, "updatedAt" = NOW()
          WHERE "id" = ${row.reportId} AND "status" = 'queued'`;
        if (updated !== 1) throw new Error('Invalid report state');
        await tx.$executeRaw`UPDATE "FactCheckEvaluationCheckpoint" SET "state" = 'complete', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "leaseToken" = ${token}`;
      });
    },
    async release(jobId, token) {
      if (!jobId || !token) throw new Error('Invalid lease');
      await db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE "FactCheckEvaluationCheckpoint" SET "state" = 'pending', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "state" = 'leased' AND "leaseToken" = ${token}`;
      });
    },
  };
}
