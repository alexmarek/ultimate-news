-- Additive only. Apply only after reviewing the target development database.
CREATE TABLE "FactCheckEvaluationCheckpoint" (
  "jobId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckEvaluationCheckpoint_pkey" PRIMARY KEY ("jobId"),
  CONSTRAINT "FactCheckEvaluationCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FactCheckJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
