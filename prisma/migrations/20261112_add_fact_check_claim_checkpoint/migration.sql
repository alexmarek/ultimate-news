-- Additive migration. Do not apply until the matching Prisma model is reviewed
-- and the target is confirmed to be the non-production development branch.
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
