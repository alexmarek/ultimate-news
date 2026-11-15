import { jobFailureFromStep, type JobFailure } from './2026-11-13-failure';

/**
 * Activity boundaries for one fact-check job. Implementations must checkpoint
 * results durably and make each activity idempotent before this is connected
 * to a queue. In particular, paid calls need a persisted reservation per try.
 */
export interface FactCheckActivities {
  identify(jobId: string): Promise<{ claimIds: string[] }>;
  researchClaim(jobId: string, claimId: string): Promise<void>;
  evaluate(jobId: string): Promise<void>;
  finish(jobId: string): Promise<void>;
  fail(jobId: string, category: JobFailure): Promise<void>;
}

/**
 * Run only with durable activities: article bodies and source contents stay
 * inside their activities rather than being returned in workflow state.
 */
export async function runFactCheckJob(jobId: string, activities: FactCheckActivities): Promise<void> {
  if (!jobId || jobId.length > 200) throw new Error('Invalid fact-check job');
  let stage: JobFailure = 'identification_failed';
  try {
    const { claimIds } = await activities.identify(jobId);
    if (!Array.isArray(claimIds) || !claimIds.length || claimIds.length > 8 || claimIds.some((id) => typeof id !== 'string' || !id || id.length > 200) || new Set(claimIds).size !== claimIds.length) {
      throw new Error('Invalid claim identifiers');
    }
    stage = 'research_failed';
    for (const claimId of claimIds) await activities.researchClaim(jobId, claimId);
    stage = 'evaluation_failed';
    await activities.evaluate(jobId);
    stage = 'review_failed';
    await activities.finish(jobId);
  } catch (error) {
    // Never propagate publisher content, API responses, or credentials to job logs.
    try {
      await activities.fail(jobId, jobFailureFromStep(error, stage));
    } catch {
      throw new Error('Fact-check failed and its status could not be recorded');
    }
    throw new Error('Fact-check processing failed');
  }
}
