import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionStore } from './2026-11-12-submission-store';

test('stops automatic dispatch when an uncertain job start is older than the safe recovery window', async () => {
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async <T>(query: TemplateStringsArray) => query.join('?').includes('FROM "FactCheckJob"')
      ? [{ id: 'job', reportId: 'report', workflowId: null, createdAt: new Date('2026-01-01'), databaseNow: new Date('2026-01-08') }] as T
      : [{ id: 'article', activeJobId: 'job', publishedReportId: null }] as T,
  };
  const store = createSubmissionStore({ $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) }, { modelId: 'model', methodologyVersion: 'v1' });
  await assert.rejects(store.reserve('https://example.org/story', 'check'), /manual recovery/);
});
