import { prisma } from '@/lib/db';
import { canTransition, type JobState } from './2026-11-09-job-state';

/** Atomically reserves cost and search allowances before any paid request. */
export async function reserveJobBudget(jobId: string, amountUsd: number, searches: number, limitUsd: number, searchLimit: number): Promise<void> {
  if (!jobId || !Number.isFinite(amountUsd) || amountUsd <= 0 || !Number.isFinite(limitUsd) || limitUsd <= 0 || !Number.isInteger(searches) || searches < 0 || !Number.isInteger(searchLimit) || searchLimit < 0) throw new Error('Invalid budget');
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`UPDATE "FactCheckJob"
    SET "estimatedCost" = "estimatedCost" + ${amountUsd}, "searchCount" = "searchCount" + ${searches}, "updatedAt" = NOW()
    WHERE "id" = ${jobId} AND "status" IN ('extracting', 'identifying-claims', 'researching', 'evaluating')
      AND "estimatedCost" + ${amountUsd} <= ${limitUsd} AND "searchCount" + ${searches} <= ${searchLimit}
    RETURNING "id"`;
  if (rows.length !== 1) throw new Error('Research budget exceeded or job is inactive');
}

/** Compare-and-set prevents competing workers from advancing the same stage. */
export async function advanceJob(jobId: string, from: JobState, to: JobState): Promise<void> {
  if (!canTransition(from, to)) throw new Error('Invalid job transition');
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`UPDATE "FactCheckJob"
    SET "status" = ${to}, "updatedAt" = NOW() WHERE "id" = ${jobId} AND "status" = ${from} RETURNING "id"`;
  if (rows.length !== 1) throw new Error('Job state changed unexpectedly');
}
