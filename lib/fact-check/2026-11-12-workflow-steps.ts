import { FatalError, RetryableError, getStepMetadata } from 'workflow';
import { prisma } from '@/lib/db';
import { createFactCheckActivities } from './2026-11-12-job-activities';
import { readFactCheckJobSettings } from './2026-11-12-job-settings';
import { createJobFinalizer } from './2026-11-12-finalize-job';
import { FactCheckFailure, type JobFailure } from './2026-11-13-failure';

function activities() {
  const settings = readFactCheckJobSettings();
  if (!settings) throw new FactCheckFailure('configuration');
  return createFactCheckActivities(prisma, settings);
}

async function runActivity<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof FactCheckFailure) {
      // Retrying these conditions without changing the inputs will fail again.
      const code = error.code;
      if (['article_blocked', 'article_paywall', 'article_text', 'no_claims', 'budget', 'provider_access', 'provider_credits', 'provider_request', 'provider_truncated', 'configuration', 'evidence_duplicate_source'].includes(code)
          || getStepMetadata().attempt >= 3) {
        throw new FatalError(code);
      }
      throw new Error(code);
    }
    if (FatalError.is(error)) throw new FatalError('Fact-check activity failed');
    // A crashed attempt can leave a lease in place for up to four minutes.
    // Delay a competing retry until the current holder can finish or expire.
    if (error instanceof Error && /is already being processed$/.test(error.message)) {
      throw new RetryableError('Fact-check activity is leased', { retryAfter: '4 minutes' });
    }
    throw new Error('Fact-check activity failed');
  }
}

export async function identifyFactCheck(jobId: string) {
  'use step';
  return runActivity(() => activities().identify(jobId));
}

export async function researchFactCheckClaim(jobId: string, claimId: string) {
  'use step';
  await runActivity(() => activities().researchClaim(jobId, claimId));
}

export async function evaluateFactCheck(jobId: string) {
  'use step';
  await runActivity(() => activities().evaluate(jobId));
}

export async function finishFactCheck(jobId: string) {
  'use step';
  await runActivity(() => createJobFinalizer(prisma).finish(jobId));
}

export async function failFactCheck(jobId: string, category: JobFailure = 'processing_failed') {
  'use step';
  await runActivity(() => createJobFinalizer(prisma).fail(jobId, category));
}
