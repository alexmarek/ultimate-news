import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCheckpointRow } from './2026-11-12-checkpoint-parser';

test('accepts a valid database lease with an explicit expiry', () => {
  assert.deepEqual(parseCheckpointRow({ state: 'leased', leaseToken: 'token-1', leaseExpiresAt: new Date(2000), attempts: 1 }), { state: 'leased', leaseToken: 'token-1', leaseExpiresAtMs: 2000, attempts: 1 });
});

test('rejects unknown states and incomplete or stale lease fields', () => {
  assert.throws(() => parseCheckpointRow({ state: 'unknown', leaseToken: null, leaseExpiresAt: null, attempts: 0 }));
  assert.throws(() => parseCheckpointRow({ state: 'leased', leaseToken: 'token-1', leaseExpiresAt: null, attempts: 1 }));
  assert.throws(() => parseCheckpointRow({ state: 'complete', leaseToken: 'old', leaseExpiresAt: new Date(1), attempts: 1 }));
});
