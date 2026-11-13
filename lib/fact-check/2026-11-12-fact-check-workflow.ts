import { runFactCheckJob } from './2026-11-12-job-orchestrator';
import {
  evaluateFactCheck, failFactCheck, finishFactCheck, identifyFactCheck, researchFactCheckClaim,
} from './2026-11-12-workflow-steps';

/** Only identifiers and allowlisted failure codes cross durable step boundaries. */
export async function factCheckWorkflow(jobId: string): Promise<void> {
  'use workflow';
  await runFactCheckJob(jobId, {
    identify: identifyFactCheck,
    researchClaim: researchFactCheckClaim,
    evaluate: evaluateFactCheck,
    finish: finishFactCheck,
    fail: failFactCheck,
  });
}
