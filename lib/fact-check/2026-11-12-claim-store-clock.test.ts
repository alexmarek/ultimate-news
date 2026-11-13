import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClaimResearchStore } from './2026-11-12-claim-store';

test('a lease that expires while waiting for a lock cannot commit', async () => {
  let writes = 0;
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray) => {
      const sql = query.join('?');
      if (sql.includes('clock_timestamp()')) return [{ databaseNow: new Date(2500) }] as T;
      return [{ state: 'leased', leaseToken: 'old-token', leaseExpiresAt: new Date(2000), attempts: 1, databaseNow: new Date(1000), reportId: 'report-1' }] as T;
    },
    $executeRaw: async () => { writes++; return 1; },
  };
  const db = { $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) };
  const store = createClaimResearchStore(db, { costUsd: 1, searches: 2, maxAttempts: 3, leaseMs: 60_000 });
  const result = { assessment: { claimId: 'claim-1', verdict: 'unverified' as const, score: null, confidence: 'low' as const, explanation: 'Insufficient evidence.', supportingEvidenceIds: [], contradictingEvidenceIds: [], evidenceQuotes: [] }, sources: [] };
  await assert.rejects(store.complete('job-1', 'claim-1', 'old-token', result), /lease expired/);
  assert.equal(writes, 0);
});
