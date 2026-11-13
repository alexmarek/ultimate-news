-- Additive only. Apply only after reviewing the target development database.
CREATE TABLE "FactCheckIdentificationCheckpoint" (
  "jobId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckIdentificationCheckpoint_pkey" PRIMARY KEY ("jobId"),
  CONSTRAINT "FactCheckIdentificationCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FactCheckJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
