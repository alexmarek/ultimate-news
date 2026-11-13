import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionStore } from './2026-11-12-submission-store';

test('does not reserve a new job while the global concurrency limit is reached', async () => {
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async <T>(query: TemplateStringsArray) => {
      const sql = query.join('?');
      if (sql.includes('pg_advisory_xact_lock')) return [] as T;
      if (sql.includes('COUNT(*)')) return [{ count: 1 }] as T;
      if (sql.includes('FactCheckReport')) return [] as T;
      return [{ id: 'article', activeJobId: null, publishedReportId: null }] as T;
    },
  };
  const store = createSubmissionStore({ $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) }, { modelId: 'model', methodologyVersion: 'v1' });
  await assert.rejects(store.reserve('https://example.org/story', 'check'), /already running/);
});
