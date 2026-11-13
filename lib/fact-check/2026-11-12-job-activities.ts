import { createClaimResearchStore } from './2026-11-12-claim-store';
import { createIdentificationStore } from './2026-11-12-identification-store';
import { createEvaluationStore } from './2026-11-12-evaluation-store';
import { createJobFinalizer } from './2026-11-12-finalize-job';
import { identifyJob } from './2026-11-12-identify-job';
import { researchClaim } from './2026-11-12-research-claim';
import { evaluateJob } from './2026-11-12-evaluate-job';
import { calculateSearchReservation, type SearchRequestLimits } from './2026-11-12-search-reservation';
import type { FactCheckActivities } from './2026-11-12-job-orchestrator';
import { factCheckModelRoute } from './2026-11-09-cost';
import { FactCheckFailure } from './2026-11-13-failure';

type SqlDatabase = Parameters<typeof createClaimResearchStore>[0] & {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};
type Settings = {
  apiKey: string; model: string; maxClaims: number; maxSearches: number; maxCostUsd: number; maxAttempts: number; leaseMs: number;
  /** The caller must establish these bounds from the provider contract before enabling live jobs. */
  searchLimits: SearchRequestLimits;
};

/** Server-only activity wiring. Do not connect to a live workflow until search limits and database races are verified. */
export function createFactCheckActivities(db: SqlDatabase, settings: Settings): FactCheckActivities {
  if (!settings.apiKey || !Number.isSafeInteger(settings.maxClaims) || settings.maxClaims < 1 || settings.maxClaims > 8) throw new Error('Invalid fact-check settings');
  calculateSearchReservation(settings.searchLimits, settings.model);
  const limits = { costUsd: settings.maxCostUsd, maxAttempts: settings.maxAttempts, leaseMs: settings.leaseMs };
  const identification = createIdentificationStore(db, limits);
  const research = createClaimResearchStore(db, { ...limits, searches: settings.maxSearches });
  const evaluation = createEvaluationStore(db, limits);
  const finalizer = createJobFinalizer(db);
  const modelForJob = async (jobId: string): Promise<string> => {
    const rows = await db.$queryRaw<Array<{ modelId: string }>>`SELECT r."modelId" FROM "FactCheckJob" j
      JOIN "FactCheckReport" r ON r."id" = j."reportId" WHERE j."id" = ${jobId}`;
    if (rows.length !== 1) throw new Error('Job model could not be found');
    if (factCheckModelRoute(rows[0].modelId).model !== settings.model) throw new FactCheckFailure('configuration');
    return rows[0].modelId;
  };
  return {
    async identify(jobId) {
      return identifyJob({ jobId, store: identification, model: await modelForJob(jobId), apiKey: settings.apiKey, maxClaims: settings.maxClaims });
    },
    async researchClaim(jobId, claimId) {
      await researchClaim({ jobId, claimId, store: research, model: await modelForJob(jobId), apiKey: settings.apiKey, searchLimits: settings.searchLimits });
    },
    async evaluate(jobId) {
      await evaluateJob({ jobId, store: evaluation, model: await modelForJob(jobId), apiKey: settings.apiKey });
    },
    async finish(jobId) { await finalizer.finish(jobId); },
    async fail(jobId, category) { await finalizer.fail(jobId, category); },
  };
}
