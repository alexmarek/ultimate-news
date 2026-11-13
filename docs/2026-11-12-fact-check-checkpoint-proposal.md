# Fact-check checkpoint proposal

The research worker needs to recover from interrupted steps without running the same claim concurrently. This is a proposal; no database operation has been run.

## Proposed data change

Add a `FactCheckClaimCheckpoint` table with one row per job and claim:

```sql
CREATE TABLE "FactCheckClaimCheckpoint" (
  "jobId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckClaimCheckpoint_pkey" PRIMARY KEY ("jobId", "claimId"),
  CONSTRAINT "FactCheckClaimCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FactCheckJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FactCheckClaimCheckpoint_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "FactCheckClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
```

Add a corresponding model and back-relations to `prisma/schema.prisma`, and add an additive migration under `prisma/migrations/`. The implementation will check in a transaction that the job and claim refer to the same report. No existing article or feed table is altered.

## Worker behavior

1. Acquire a time-limited lease atomically. A completed claim is skipped; an active lease blocks a competing worker.
2. Reserve the maximum permitted search cost atomically against the job before making a paid request. A retry makes a new reservation; uncertain or timed-out calls are not refunded automatically.
3. Retrieve source material and assess the claim inside the activity. Persist only validated short quotations and metadata, never the full article or source body.
4. Commit results only if the lease token is still current. A worker holding an expired or replaced token cannot overwrite another worker's result.
5. Release the lease on a handled failure; expiry allows recovery after an interrupted worker. Keep retries bounded and never publish on failure.

## Before enabling paid requests

OpenRouter documents that pending server-tool calls and a final model turn can still run when a stop condition fires. The request-cost stop condition alone is therefore not a demonstrated strict per-request ceiling. Confirm a conservative bound on all model turns, input and output tokens and search fees, then reserve it before each request. If the bound is unknown or exceeds the job budget, fail closed.

## Validation and rollout

- Unit tests use synthetic claims and mocked external calls.
- Verify lease races, expiry, budget reservations and migration rollback behavior against the confirmed Neon `development` branch after explicit approval.
- Review the migration history before applying the additive migration. Do not run `prisma migrate deploy` blindly against a database cloned from production.
- Keep `FACT_CHECK_ENABLED` disabled until submission, the durable worker, user access, evidence integrity, publication and failure recovery have been checked together.
