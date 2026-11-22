// lib/2026-11-22-cron-auth.ts
// Vercel sends `Authorization: Bearer <CRON_SECRET>` on every scheduled run
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Without a configured secret every request is refused, so a missing variable fails closed.

import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
