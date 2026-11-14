import { randomUUID } from 'node:crypto';
import { FactCheckFailure } from './2026-11-13-failure';
import { parseCheckpointRow } from './2026-11-12-checkpoint-parser';
import { canCommitClaimLease, decideClaimLease } from './2026-11-12-lease-policy';
import type { IdentificationStore } from './2026-11-12-identify-job';

interface SqlTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}
interface SqlDatabase { $transaction<T>(run: (tx: SqlTransaction) => Promise<T>): Promise<T> }
type Checkpoint = { state: string; leaseToken: string | null; leaseExpiresAt: Date | null; attempts: number };

/** Not for live use until its additive migration and PostgreSQL races are tested. */
export function createIdentificationStore(db: SqlDatabase, limits: { costUsd: number; maxAttempts: number; leaseMs: number }): IdentificationStore {
  const maxCostMicros = Math.floor(limits.costUsd * 1_000_000);
  if (!Number.isSafeInteger(maxCostMicros) || maxCostMicros < 1 || !Number.isSafeInteger(limits.maxAttempts) || limits.maxAttempts < 1 ||
      !Number.isSafeInteger(limits.leaseMs) || limits.leaseMs < 1 || limits.leaseMs > 600_000) throw new Error('Invalid job limits');
  return {
    async acquire(jobId) {
      if (!jobId) throw new Error('Invalid job');
      return db.$transaction(async tx => {
        await tx.$executeRaw`INSERT INTO "FactCheckIdentificationCheckpoint" ("jobId", "updatedAt")
          SELECT j."id", NOW() FROM "FactCheckJob" j JOIN "FactCheckReport" r ON r."id" = j."reportId"
          JOIN "FactCheckArticle" a ON a."id" = r."articleId"
          WHERE j."id" = ${jobId} AND a."activeJobId" = j."id" AND j."status" IN ('queued', 'extracting', 'identifying-claims')
          ON CONFLICT ("jobId") DO NOTHING`;
        const rows = await tx.$queryRaw<Array<Checkpoint & { articleUrl: string; inputType: string; inputText: string | null; reportId: string; jobStatus: string; activeJobId: string | null }>>`
          SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts", a."canonicalUrl" AS "articleUrl",
            a."inputType", a."inputText", j."reportId", j."status" AS "jobStatus", a."activeJobId"
          FROM "FactCheckIdentificationCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          JOIN "FactCheckReport" r ON r."id" = j."reportId" JOIN "FactCheckArticle" a ON a."id" = r."articleId"
          WHERE cp."jobId" = ${jobId} FOR UPDATE OF cp, j`;
        const row = rows[0];
        if (!row || rows.length !== 1) throw new Error('Invalid job');
        const checkpoint = parseCheckpointRow({ state: row.state, leaseToken: row.leaseToken, leaseExpiresAt: row.leaseExpiresAt, attempts: row.attempts });
        if (checkpoint.state === 'complete') {
          const claims = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "FactCheckClaim" WHERE "reportId" = ${row.reportId} ORDER BY "id"`;
          if (!claims.length || claims.length > 8) throw new Error('Invalid identification checkpoint');
          return { kind: 'complete', claimIds: claims.map(claim => claim.id) };
        }
        if (row.activeJobId !== jobId || !['queued', 'extracting', 'identifying-claims'].includes(row.jobStatus)) throw new Error('Job is not active');
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (!(clock[0]?.databaseNow instanceof Date)) throw new Error('Database clock unavailable');
        const decision = decideClaimLease(checkpoint, clock[0].databaseNow.getTime(), randomUUID(), limits.leaseMs, limits.maxAttempts);
        if (decision.kind === 'busy') return decision;
        if (decision.kind !== 'acquire') throw new Error('Identification retry limit reached');
        await tx.$executeRaw`UPDATE "FactCheckIdentificationCheckpoint" SET "state" = 'leased', "leaseToken" = ${decision.token},
          "leaseExpiresAt" = ${new Date(decision.expiresAtMs)}, "attempts" = ${decision.attempts}, "updatedAt" = NOW() WHERE "jobId" = ${jobId}`;
        await tx.$executeRaw`UPDATE "FactCheckJob" SET "status" = 'identifying-claims', "updatedAt" = NOW() WHERE "id" = ${jobId}`;
        return { kind: 'acquired', token: decision.token, articleUrl: row.articleUrl, inputType: row.inputType, inputText: row.inputText };
      });
    },
    async reserve(jobId, token, maximumCostUsd) {
      const micros = Math.ceil(maximumCostUsd * 1_000_000);
      if (!jobId || !token || !Number.isSafeInteger(micros) || micros < 1) throw new Error('Invalid reservation');
      await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<Checkpoint[]>`SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts"
          FROM "FactCheckIdentificationCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          WHERE cp."jobId" = ${jobId} AND j."status" = 'identifying-claims' FOR UPDATE OF cp, j`;
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (rows.length !== 1 || !(clock[0]?.databaseNow instanceof Date) || !canCommitClaimLease(parseCheckpointRow(rows[0]), token, clock[0].databaseNow.getTime())) throw new Error('Lease expired');
        const jobs = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "FactCheckJob" SET
          "estimatedCost" = (CEIL("estimatedCost"::numeric * 1000000) + ${micros}) / 1000000, "updatedAt" = NOW()
          WHERE "id" = ${jobId} AND "status" = 'identifying-claims' AND CEIL("estimatedCost"::numeric * 1000000) + ${micros} <= ${maxCostMicros}
          RETURNING "id"`;
        if (jobs.length === 0) throw new FactCheckFailure('budget', 'Budget exhausted');
        if (jobs.length !== 1) throw new Error('Invalid job reservation');
      });
    },
    async complete(jobId, token, metadata, claims) {
      if (!jobId || !token || !metadata.title?.trim() || !claims.length || claims.length > 8 ||
          claims.some(claim => !claim.id || !claim.statement.trim() || !claim.importance.trim()) || new Set(claims.map(claim => claim.id)).size !== claims.length) throw new Error('Invalid identification result');
      await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<Array<Checkpoint & { reportId: string }>>`SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts", j."reportId"
          FROM "FactCheckIdentificationCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          WHERE cp."jobId" = ${jobId} AND j."status" = 'identifying-claims' FOR UPDATE OF cp, j`;
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        const row = rows[0];
        if (!row || rows.length !== 1 || !(clock[0]?.databaseNow instanceof Date) || !canCommitClaimLease(parseCheckpointRow({ state: row.state, leaseToken: row.leaseToken, leaseExpiresAt: row.leaseExpiresAt, attempts: row.attempts }), token, clock[0].databaseNow.getTime())) throw new Error('Lease expired');
        const reports = await tx.$executeRaw`UPDATE "FactCheckReport" SET "title" = ${metadata.title}, "publisher" = ${metadata.publisher},
          "author" = ${metadata.author}, "articlePublishedAt" = ${metadata.publishedAt}, "language" = ${metadata.language}, "updatedAt" = NOW()
          WHERE "id" = ${row.reportId} AND "status" = 'queued'`;
        if (reports !== 1) throw new Error('Invalid report state');
        for (const claim of claims) {
          await tx.$executeRaw`INSERT INTO "FactCheckClaim" ("id", "reportId", "statement", "importance", "central", "verdict", "confidence", "explanation")
            VALUES (${claim.id}, ${row.reportId}, ${claim.statement}, ${claim.importance}, ${claim.central}, 'unverified', 'low', 'Research is pending.')`;
        }
        await tx.$executeRaw`UPDATE "FactCheckIdentificationCheckpoint" SET "state" = 'complete', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "leaseToken" = ${token}`;
        await tx.$executeRaw`UPDATE "FactCheckJob" SET "status" = 'researching', "updatedAt" = NOW() WHERE "id" = ${jobId}`;
      });
    },
    async release(jobId, token) {
      if (!jobId || !token) throw new Error('Invalid lease');
      await db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE "FactCheckIdentificationCheckpoint" SET "state" = 'pending', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "state" = 'leased' AND "leaseToken" = ${token}`;
      });
    },
  };
}
