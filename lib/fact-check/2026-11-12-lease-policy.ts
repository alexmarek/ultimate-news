export interface ClaimCheckpoint {
  state: 'pending' | 'leased' | 'complete';
  leaseToken: string | null;
  leaseExpiresAtMs: number | null;
  attempts: number;
}

export type LeaseDecision =
  | { kind: 'complete' }
  | { kind: 'busy' }
  | { kind: 'exhausted' }
  | { kind: 'acquire'; token: string; expiresAtMs: number; attempts: number };

/** Must be evaluated while holding an exclusive database row lock. */
export function decideClaimLease(current: ClaimCheckpoint, nowMs: number, token: string, leaseMs: number, maxAttempts: number): LeaseDecision {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || !token || !Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 600_000 || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || !Number.isSafeInteger(current.attempts) || current.attempts < 0 || nowMs + leaseMs > Number.MAX_SAFE_INTEGER) throw new Error('Invalid lease');
  if (current.state === 'complete') return { kind: 'complete' };
  if (current.state === 'leased') {
    if (!current.leaseToken || !Number.isSafeInteger(current.leaseExpiresAtMs)) throw new Error('Invalid existing lease');
    if (current.leaseExpiresAtMs! > nowMs) return { kind: 'busy' };
  }
  if (current.attempts >= maxAttempts) return { kind: 'exhausted' };
  return { kind: 'acquire', token, expiresAtMs: nowMs + leaseMs, attempts: current.attempts + 1 };
}

/** Check again under the same row lock before persisting an activity result. */
export function canCommitClaimLease(current: ClaimCheckpoint, token: string, nowMs: number): boolean {
  return current.state === 'leased' && !!token && current.leaseToken === token && Number.isSafeInteger(nowMs) && nowMs >= 0 && Number.isSafeInteger(current.leaseExpiresAtMs) && current.leaseExpiresAtMs! > nowMs;
}
