import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCommitClaimLease, decideClaimLease, type ClaimCheckpoint } from './2026-11-12-lease-policy';

const leased: ClaimCheckpoint = { state: 'leased', leaseToken: 'worker-a', leaseExpiresAtMs: 2000, attempts: 1 };

test('an active lease prevents a second worker from processing the claim', () => {
  assert.deepEqual(decideClaimLease(leased, 1000, 'worker-b', 1000, 3), { kind: 'busy' });
});

test('an expired lease can be replaced, but a stale worker cannot commit', () => {
  const decision = decideClaimLease(leased, 2000, 'worker-b', 1000, 3);
  assert.deepEqual(decision, { kind: 'acquire', token: 'worker-b', expiresAtMs: 3000, attempts: 2 });
  const replacement: ClaimCheckpoint = { state: 'leased', leaseToken: 'worker-b', leaseExpiresAtMs: 3000, attempts: 2 };
  assert.equal(canCommitClaimLease(replacement, 'worker-a', 2100), false);
  assert.equal(canCommitClaimLease(replacement, 'worker-b', 2100), true);
  assert.equal(canCommitClaimLease(replacement, 'worker-b', 3000), false);
});

test('completed claims are not repeated and exhausted retries do not restart', () => {
  assert.deepEqual(decideClaimLease({ ...leased, state: 'complete' }, 3000, 'worker-b', 1000, 3), { kind: 'complete' });
  assert.deepEqual(decideClaimLease({ ...leased, attempts: 3 }, 3000, 'worker-b', 1000, 3), { kind: 'exhausted' });
});
