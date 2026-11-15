import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationStore } from './2026-11-12-evaluation-store';

test('an evaluation lease that expired while waiting for a lock cannot commit a report', async () => {
  let writes = 0;
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray) => query.join('?').includes('clock_timestamp()')
      ? [{ databaseNow: new Date(2500) }] as T
      : [{ state: 'leased', leaseToken: 'old', leaseExpiresAt: new Date(2000), attempts: 1, reportId: 'r', articleUrl: 'https://example.org/a', articleTitle: 'Article' }] as T,
    $executeRaw: async () => { writes++; return 1; },
  };
  const store = createEvaluationStore({ $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) }, { costUsd: 1, maxAttempts: 3, leaseMs: 60_000 });
  const result = { verdict: 'unverified' as const, score: null, confidence: 'low' as const, executiveSummary: 'Insufficient evidence.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'A claim.' };
  await assert.rejects(store.complete('job-1', 'old', result), /Lease expired/);
  assert.equal(writes, 0);
});
