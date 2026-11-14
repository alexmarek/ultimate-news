import { assessSingleClaim } from './2026-11-12-claim-assessment';
import { retrieveEvidence } from './2026-11-09-evidence';
import { discoverSources, ResearchBudget } from './2026-11-09-openrouter';
import { requireAvailableSearchBudget, type SearchRequestLimits } from './2026-11-12-search-reservation';
import type { ResearchClaim } from './2026-11-09-assessment';
import type { fetchPublicHtml } from './2026-11-09-safe-fetch';
import { FactCheckFailure } from './2026-11-13-failure';

type CompactAssessment = Awaited<ReturnType<typeof assessSingleClaim>>;
type ClaimLease =
  | { kind: 'complete' }
  | { kind: 'busy' }
  | { kind: 'acquired'; token: string; claim: ResearchClaim; articleUrl: string; articleTitle: string; remainingUsd: number; searchesRemaining: number };

/** Implementations must use atomic leases and fence all writes by lease token. */
export interface ClaimResearchStore {
  acquire(jobId: string, claimId: string): Promise<ClaimLease>;
  reserve(jobId: string, token: string, maximumCostUsd: number, searches: number): Promise<void>;
  complete(jobId: string, claimId: string, token: string, result: CompactAssessment): Promise<void>;
  release(jobId: string, claimId: string, token: string): Promise<void>;
}

/**
 * Research one claim with a durable, fenced store. Source bodies never leave
 * this activity; only verified excerpts may be committed by the store.
 */
export async function researchClaim({ jobId, claimId, store, searchLimits, model, apiKey, request = fetch, fetcher }: {
  jobId: string;
  claimId: string;
  store: ClaimResearchStore;
  searchLimits: SearchRequestLimits;
  model: string;
  apiKey: string;
  request?: typeof fetch;
  fetcher?: typeof fetchPublicHtml;
}): Promise<void> {
  if (!jobId || !claimId) throw new Error('Invalid job or claim');
  const lease = await store.acquire(jobId, claimId);
  if (lease.kind === 'complete') return;
  if (lease.kind === 'busy') throw new Error('Claim is already being processed');
  try {
    if (!lease.token || lease.claim.id !== claimId) throw new Error('Invalid claim lease');
    const reservation = requireAvailableSearchBudget(searchLimits, lease.remainingUsd, lease.searchesRemaining, model);
    await store.reserve(jobId, lease.token, reservation, searchLimits.maxSearchCalls);
    const candidates = await discoverSources({ claim: lease.claim.statement, model, apiKey, budget: new ResearchBudget(reservation, 1), upperBoundUsd: reservation, request });
    const evidence = await retrieveEvidence({ claimId, candidates, articleUrl: lease.articleUrl, fetcher });
    const result = await assessSingleClaim({
      articleUrl: lease.articleUrl, articleTitle: lease.articleTitle, claim: lease.claim, evidence, model, apiKey,
      reserve: (cost) => store.reserve(jobId, lease.token, cost, 0), request,
    });
    await store.complete(jobId, claimId, lease.token, result);
  } catch (error) {
    // Reservations are deliberately not refunded: the provider may have billed
    // a timed-out or interrupted request before a retry starts.
    try { await store.release(jobId, claimId, lease.token); } catch { /* Lease expiry handles recovery. */ }
    if (error instanceof FactCheckFailure) throw error;
    throw new Error('Claim research failed');
  }
}
