import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentificationStore } from './2026-11-12-identification-store';

test('a lease that expires while waiting for its database lock cannot reserve or write', async () => {
  let writes = 0;
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray) => {
      if (query.join('?').includes('clock_timestamp()')) return [{ databaseNow: new Date(2500) }] as T;
      return [{ state: 'leased', leaseToken: 'old-token', leaseExpiresAt: new Date(2000), attempts: 1 }] as T;
    },
    $executeRaw: async () => { writes++; return 1; },
  };
  const db = { $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) };
  const store = createIdentificationStore(db, { costUsd: 1, maxAttempts: 3, leaseMs: 60_000 });
  const metadata = { canonicalUrl: 'https://example.org/article', title: 'Article', publisher: null, author: null, publishedAt: null, language: 'en' };
  const claims = [{ id: '00000000-0000-4000-8000-000000000001' as const, statement: 'A claim', importance: 'central', central: true }];
  await assert.rejects(store.reserve('job-1', 'old-token', 0.01), /Lease expired/);
  await assert.rejects(store.complete('job-1', 'old-token', metadata, claims), /Lease expired/);
  assert.equal(writes, 0);
});

test('an exhausted budget rejects the model reservation', async () => {
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray) => {
      const sql = query.join('?');
      if (sql.includes('clock_timestamp()')) return [{ databaseNow: new Date(1000) }] as T;
      if (sql.includes('UPDATE "FactCheckJob"')) return [] as T;
      return [{ state: 'leased', leaseToken: 'lease', leaseExpiresAt: new Date(2000), attempts: 1 }] as T;
    },
    $executeRaw: async () => 1,
  };
  const db = { $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) };
  const store = createIdentificationStore(db, { costUsd: 1, maxAttempts: 3, leaseMs: 60_000 });
  await assert.rejects(store.reserve('job-1', 'lease', 0.01), /Budget exhausted/);
});
