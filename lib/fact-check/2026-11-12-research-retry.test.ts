import { test } from 'node:test';
import assert from 'node:assert/strict';
import { researchClaim, type ClaimResearchStore } from './2026-11-12-research-claim';

test('a failed or timed-out provider request keeps its reservation and releases the lease', async () => {
  const events: string[] = [];
  const store: ClaimResearchStore = {
    acquire: async () => ({ kind: 'acquired', token: 'lease-1', claim: { id: 'claim-1', statement: 'A synthetic claim', central: true }, articleUrl: 'https://example.org/a', articleTitle: 'Synthetic', remainingUsd: 1, searchesRemaining: 1 }),
    reserve: async () => { events.push('reserve'); },
    complete: async () => { events.push('complete'); },
    release: async () => { events.push('release'); },
  };
  const request: typeof fetch = async () => { events.push('request'); throw new Error('provider timeout or private details'); };
  const limits = { maxModelCalls: 2, maxInputTokensPerCall: 1000, maxOutputTokensPerCall: 1200, maxSearchCalls: 1, maxSearchFeeUsd: 0.007 };
  await assert.rejects(researchClaim({ jobId: 'job-1', claimId: 'claim-1', store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request }), (error: Error) => error.message === 'Claim research failed');
  assert.deepEqual(events, ['reserve', 'request', 'release']);
});
