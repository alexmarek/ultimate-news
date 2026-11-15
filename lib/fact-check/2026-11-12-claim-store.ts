import { randomUUID } from 'node:crypto';
import { FactCheckFailure } from './2026-11-13-failure';
import { parseCheckpointRow } from './2026-11-12-checkpoint-parser';
import { canCommitClaimLease, decideClaimLease } from './2026-11-12-lease-policy';
import type { ClaimResearchStore } from './2026-11-12-research-claim';
import { scoreMatchesVerdict } from './2026-11-13-scoring-rubric';

interface SqlTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

interface SqlDatabase {
  $transaction<T>(run: (tx: SqlTransaction) => Promise<T>): Promise<T>;
}

interface CheckpointRecord {
  state: string; leaseToken: string | null; leaseExpiresAt: Date | null; attempts: number;
  articleUrl: string; articleTitle: string | null; statement: string; central: boolean; estimatedCost: number; searchCount: number;
}

/**
 * This adapter requires the separately reviewed FactCheckClaimCheckpoint table.
 * It must not be connected to a live worker until its migration and database
 * race behavior have been tested on the confirmed development branch.
 */
export function createClaimResearchStore(db: SqlDatabase, limits: { costUsd: number; searches: number; maxAttempts: number; leaseMs: number }): ClaimResearchStore {
  if (!Number.isFinite(limits.costUsd) || limits.costUsd <= 0 || !Number.isSafeInteger(limits.searches) || limits.searches < 0 || !Number.isSafeInteger(limits.maxAttempts) || limits.maxAttempts < 1 || !Number.isSafeInteger(limits.leaseMs) || limits.leaseMs < 1 || limits.leaseMs > 600_000) throw new Error('Invalid job limits');
  const maxCostMicros = Math.floor(limits.costUsd * 1_000_000);
  if (!Number.isSafeInteger(maxCostMicros) || maxCostMicros < 1) throw new Error('Invalid cost limit');
  return {
    async acquire(jobId, claimId) {
      return db.$transaction(async (tx) => {
        // The join prevents a claim from another report being attached to this job.
        await tx.$executeRaw`INSERT INTO "FactCheckClaimCheckpoint" ("jobId", "claimId", "updatedAt")
          SELECT j."id", c."id", NOW() FROM "FactCheckJob" j JOIN "FactCheckClaim" c ON c."reportId" = j."reportId"
          WHERE j."id" = ${jobId} AND c."id" = ${claimId} AND j."status" = 'researching'
          ON CONFLICT ("jobId", "claimId") DO NOTHING`;
        const rows = await tx.$queryRaw<CheckpointRecord[]>`SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts",
          a."canonicalUrl" AS "articleUrl", r."title" AS "articleTitle", c."statement", c."central", j."estimatedCost", j."searchCount"
          FROM "FactCheckClaimCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          JOIN "FactCheckClaim" c ON c."id" = cp."claimId" AND c."reportId" = j."reportId"
          JOIN "FactCheckReport" r ON r."id" = j."reportId" JOIN "FactCheckArticle" a ON a."id" = r."articleId"
          WHERE cp."jobId" = ${jobId} AND cp."claimId" = ${claimId} AND j."status" = 'researching' FOR UPDATE OF cp, j`;
        const row = rows[0];
        if (!row || !row.articleTitle || !row.statement || !Number.isFinite(row.estimatedCost) || row.estimatedCost < 0 || !Number.isSafeInteger(row.searchCount) || row.searchCount < 0) throw new Error('Invalid research job');
        const checkpoint = parseCheckpointRow({ state: row.state, leaseToken: row.leaseToken, leaseExpiresAt: row.leaseExpiresAt, attempts: row.attempts });
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (!(clock[0]?.databaseNow instanceof Date)) throw new Error('Database clock unavailable');
        const decision = decideClaimLease(checkpoint, clock[0].databaseNow.getTime(), randomUUID(), limits.leaseMs, limits.maxAttempts);
        if (decision.kind === 'complete' || decision.kind === 'busy') return decision;
        if (decision.kind === 'exhausted') throw new Error('Claim retry limit reached');
        await tx.$executeRaw`UPDATE "FactCheckClaimCheckpoint" SET "state" = 'leased', "leaseToken" = ${decision.token},
          "leaseExpiresAt" = ${new Date(decision.expiresAtMs)}, "attempts" = ${decision.attempts}, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "claimId" = ${claimId}`;
        return { kind: 'acquired', token: decision.token, claim: { id: claimId, statement: row.statement, central: row.central },
          articleUrl: row.articleUrl, articleTitle: row.articleTitle, remainingUsd: Math.max(0, (maxCostMicros - Math.ceil(row.estimatedCost * 1_000_000)) / 1_000_000),
          searchesRemaining: Math.max(0, limits.searches - row.searchCount) };
      });
    },
    async reserve(jobId, token, maximumCostUsd, searches) {
      const costMicros = Math.ceil(maximumCostUsd * 1_000_000);
      if (!token || !Number.isSafeInteger(costMicros) || costMicros < 1 || !Number.isSafeInteger(searches) || searches < 0) throw new Error('Invalid reservation');
      await db.$transaction(async (tx) => {
        const leases = await tx.$queryRaw<Array<{ state: string; leaseToken: string | null; leaseExpiresAt: Date | null; attempts: number }>>`
          SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts"
          FROM "FactCheckClaimCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          WHERE cp."jobId" = ${jobId} AND cp."leaseToken" = ${token} AND cp."state" = 'leased' AND j."status" = 'researching'
          FOR UPDATE OF cp, j`;
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (leases.length !== 1 || !(clock[0]?.databaseNow instanceof Date) || !canCommitClaimLease(parseCheckpointRow(leases[0]), token, clock[0].databaseNow.getTime())) throw new Error('Lease expired');
        const rows = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "FactCheckJob" j
          SET "estimatedCost" = (CEIL(j."estimatedCost"::numeric * 1000000) + ${costMicros}) / 1000000,
              "searchCount" = j."searchCount" + ${searches}, "updatedAt" = NOW()
          WHERE j."id" = ${jobId} AND j."status" = 'researching'
            AND CEIL(j."estimatedCost"::numeric * 1000000) + ${costMicros} <= ${maxCostMicros}
            AND j."searchCount" + ${searches} <= ${limits.searches} RETURNING j."id"`;
        if (rows.length === 0) throw new FactCheckFailure('budget', 'Budget exhausted');
        if (rows.length !== 1) throw new Error('Invalid job reservation');
      });
    },
    async complete(jobId, claimId, token, result) {
      if (!scoreMatchesVerdict(result.assessment.score, result.assessment.verdict)) {
        throw new FactCheckFailure('evidence_validation');
      }
      await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ state: string; leaseToken: string | null; leaseExpiresAt: Date | null; attempts: number; reportId: string }>>`
          SELECT cp."state", cp."leaseToken", cp."leaseExpiresAt", cp."attempts", j."reportId"
          FROM "FactCheckClaimCheckpoint" cp JOIN "FactCheckJob" j ON j."id" = cp."jobId"
          JOIN "FactCheckClaim" c ON c."id" = cp."claimId" AND c."reportId" = j."reportId"
          WHERE cp."jobId" = ${jobId} AND cp."claimId" = ${claimId} AND j."status" = 'researching' FOR UPDATE OF cp, j`;
        const row = rows[0];
        const clock = await tx.$queryRaw<Array<{ databaseNow: Date }>>`SELECT clock_timestamp() AS "databaseNow"`;
        if (!row || !(clock[0]?.databaseNow instanceof Date) || !canCommitClaimLease(parseCheckpointRow({ state: row.state, leaseToken: row.leaseToken, leaseExpiresAt: row.leaseExpiresAt, attempts: row.attempts }), token, clock[0].databaseNow.getTime()) || result.assessment.claimId !== claimId || result.sources.some((source) => source.claimId !== claimId)) throw new Error('Claim lease expired or result is invalid');
        const updated = await tx.$executeRaw`UPDATE "FactCheckClaim" SET "score" = ${result.assessment.score}, "verdict" = ${result.assessment.verdict},
          "confidence" = ${result.assessment.confidence}, "explanation" = ${result.assessment.explanation} WHERE "id" = ${claimId} AND "reportId" = ${row.reportId}`;
        if (updated !== 1) throw new Error('Claim not found');
        for (const source of result.sources) {
          await tx.$executeRaw`INSERT INTO "FactCheckEvidence" ("id", "reportId", "claimId", "title", "publisher", "url", "publishedAt", "retrievedAt", "sourceType", "excerpt", "relationship")
            VALUES (${source.id}, ${row.reportId}, ${claimId}, ${source.title}, ${source.publisher}, ${source.url}, ${source.publishedAt}, ${source.retrievedAt}, 'unclassified', ${source.excerpt}, ${source.relationship})`;
        }
        await tx.$executeRaw`UPDATE "FactCheckClaimCheckpoint" SET "state" = 'complete', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "claimId" = ${claimId} AND "leaseToken" = ${token}`;
      });
    },
    async release(jobId, claimId, token) {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "FactCheckClaimCheckpoint" SET "state" = 'pending', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
          WHERE "jobId" = ${jobId} AND "claimId" = ${claimId} AND "state" = 'leased' AND "leaseToken" = ${token}`;
      });
    },
  };
}
