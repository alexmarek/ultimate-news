import { z } from 'zod';
import type { ClaimCheckpoint } from './2026-11-12-lease-policy';

const checkpointRow = z.object({
  state: z.enum(['pending', 'leased', 'complete']),
  leaseToken: z.string().min(1).max(200).nullable(),
  leaseExpiresAt: z.date().nullable(),
  attempts: z.number().int().nonnegative().safe(),
}).strict().superRefine((row, context) => {
  const hasLease = row.leaseToken !== null && row.leaseExpiresAt !== null;
  const hasNoLease = row.leaseToken === null && row.leaseExpiresAt === null;
  if ((row.state === 'leased' && !hasLease) || (row.state !== 'leased' && !hasNoLease)) {
    context.addIssue({ code: 'custom', message: 'Checkpoint lease does not match state' });
  }
});

/** Validate database state before passing it to the lease decision logic. */
export function parseCheckpointRow(value: unknown): ClaimCheckpoint {
  const row = checkpointRow.parse(value);
  return { state: row.state, leaseToken: row.leaseToken, leaseExpiresAtMs: row.leaseExpiresAt?.getTime() ?? null, attempts: row.attempts };
}
