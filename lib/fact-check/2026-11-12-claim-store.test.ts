import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClaimResearchStore } from './2026-11-12-claim-store';

const result = { assessment: { claimId: 'claim-1', verdict: 'unverified' as const, score: null, confidence: 'low' as const, explanation: 'Insufficient evidence.', supportingEvidenceIds: [], contradictingEvidenceIds: [], evidenceQuotes: [] }, sources: [] };
const limits = { costUsd: 1, searches: 2, maxAttempts: 3, leaseMs: 60_000 };

test('an expired lease cannot write a claim or its evidence', async () => {
  let writes = 0;
  const tx = {
    $queryRaw: async <T>() => [{ state: 'leased', leaseToken: 'old-token', leaseExpiresAt: new Date(1000), attempts: 1, databaseNow: new Date(2000), reportId: 'report-1' }] as T,
    $executeRaw: async () => { writes++; return 1; },
  };
  const db = { $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) };
  const store = createClaimResearchStore(db, limits);
  await assert.rejects(store.complete('job-1', 'claim-1', 'old-token', result), /lease expired/);
  assert.equal(writes, 0);
});

test('corrupt checkpoint state cannot be acquired', async () => {
  const tx = {
    $queryRaw: async <T>() => [{ state: 'unexpected', leaseToken: null, leaseExpiresAt: null, attempts: 0, databaseNow: new Date(2000), articleUrl: 'https://example.org/a', articleTitle: 'Synthetic', statement: 'A claim', central: true, estimatedCost: 0, searchCount: 0 }] as T,
    $executeRaw: async () => 1,
  };
  const db = { $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) };
  await assert.rejects(createClaimResearchStore(db, limits).acquire('job-1', 'claim-1'));
});
