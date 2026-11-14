import { canonicalizeUrl } from '@/lib/ingest/canonicalize';
import { resolvePublicUrl } from './2026-11-09-safe-url';
import { startFactCheckJob, type DurableStartAdapter } from './2026-11-12-start-job';
import { FactCheckFailure } from './2026-11-13-failure';
import { randomUUID } from 'node:crypto';

export type SubmissionReservation =
  | { kind: 'existing'; articleId: string; reportId: string }
  | { kind: 'active'; articleId: string; reportId: string; jobId: string; needsDispatch: boolean }
  | { kind: 'created'; articleId: string; reportId: string; jobId: string };

/** Implement reserve atomically under the canonical article's database lock. */
export interface SubmissionStore {
  reserve(canonicalUrl: string, mode: 'check' | 'refresh', input?: { type: 'text' | 'image'; text: string }): Promise<SubmissionReservation>;
  recordRun(jobId: string, runId: string): Promise<void>;
}

export type SubmissionResult =
  | { status: 'existing'; articleId: string; reportId: string }
  | { status: 'active' | 'started' | 'start_pending'; articleId: string; reportId: string; jobId: string };

/** Server handlers must authorize before calling this function. */
export async function submitFactCheck({ url, mode, store, starter, resolve = resolvePublicUrl }: {
  url: string;
  mode: 'check' | 'refresh';
  store: SubmissionStore;
  starter: DurableStartAdapter;
  resolve?: typeof resolvePublicUrl;
}): Promise<SubmissionResult> {
  if (typeof url !== 'string' || url.length > 4096 || (mode !== 'check' && mode !== 'refresh')) throw new Error('Invalid submission');
  const { url: publicUrl } = await resolve(url).catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENODATA') throw new FactCheckFailure('unreachable');
    if (error instanceof TypeError || (error instanceof Error && ['Unsupported URL', 'Unsafe host', 'Unsafe destination'].includes(error.message))) {
      throw new FactCheckFailure('invalid', 'Unsafe or invalid article URL');
    }
    throw error;
  });
  const canonicalUrl = await canonicalizeUrl(publicUrl.href);
  const reservation = await store.reserve(canonicalUrl, mode);
  if (reservation.kind === 'existing') return { status: 'existing', articleId: reservation.articleId, reportId: reservation.reportId };
  if (reservation.kind === 'active' && !reservation.needsDispatch) return { status: 'active', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };

  // Never clear the job lock after an uncertain start: a run may already exist.
  // Reconciliation can retry with the same atomic workflow-admission token.
  try {
    const started = await startFactCheckJob(reservation.jobId, starter);
    if (started.status === 'outcome_unknown') return { status: 'start_pending', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
    await store.recordRun(reservation.jobId, started.runId);
    return { status: started.status === 'started' ? 'started' : 'active', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
  } catch {
    return { status: 'start_pending', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
  }
}

export async function submitTextFactCheck({ text, type, store, starter }: {
  text: string; type: 'text' | 'image'; store: SubmissionStore; starter: DurableStartAdapter;
}): Promise<SubmissionResult> {
  const content = text.trim();
  if (!content || content.length > 19000) throw new FactCheckFailure('invalid');
  const identity = `https://fact-check.invalid/submission/${randomUUID()}`;
  const reservation = await store.reserve(identity, 'check', { type, text: content });
  if (reservation.kind === 'existing') return { status: 'existing', articleId: reservation.articleId, reportId: reservation.reportId };
  if (reservation.kind === 'active' && !reservation.needsDispatch) return { status: 'active', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
  try {
    const started = await startFactCheckJob(reservation.jobId, starter);
    if (started.status === 'outcome_unknown') return { status: 'start_pending', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
    await store.recordRun(reservation.jobId, started.runId);
    return { status: started.status === 'started' ? 'started' : 'active', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
  } catch {
    return { status: 'start_pending', articleId: reservation.articleId, reportId: reservation.reportId, jobId: reservation.jobId };
  }
}
