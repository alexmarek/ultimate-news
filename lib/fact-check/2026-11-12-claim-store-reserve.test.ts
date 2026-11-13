import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClaimResearchStore } from './2026-11-12-claim-store';

function fixture(databaseNow: number, budgetAllowsUpdate = true) {
  let updates = 0;
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray) => {
      const sql = query.join('?');
      if (sql.includes('clock_timestamp()')) return [{ databaseNow: new Date(databaseNow) }] as T;
      if (sql.includes('UPDATE "FactCheckJob"')) { updates++; return (budgetAllowsUpdate ? [{ id: 'job-1' }] : []) as T; }
      return [{ state: 'leased', leaseToken: 'lease-1', leaseExpiresAt: new Date(2000), attempts: 1 }] as T;
    },
    $executeRaw: async () => 1,
  };
  const db = { $transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => run(tx) };
  return { store: createClaimResearchStore(db, { costUsd: 1, searches: 2, maxAttempts: 3, leaseMs: 60_000 }), updates: () => updates };
}

test('an active lease can reserve a bounded request', async () => {
  const { store, updates } = fixture(1000);
  await store.reserve('job-1', 'lease-1', 0.03, 1);
  assert.equal(updates(), 1);
});

test('an expired lease cannot reserve or start another paid request', async () => {
  const { store, updates } = fixture(2000);
  await assert.rejects(store.reserve('job-1', 'lease-1', 0.03, 1), /Lease expired/);
  assert.equal(updates(), 0);
});

test('a concurrent budget exhaustion rejects the reservation', async () => {
  const { store, updates } = fixture(1000, false);
  await assert.rejects(store.reserve('job-1', 'lease-1', 0.03, 1), /Budget exhausted/);
  assert.equal(updates(), 1);
});
