export type StartJobResult =
  | { status: 'started' | 'already_started'; runId: string }
  | { status: 'outcome_unknown'; runId: string };

/**
 * Start adapters must use Workflow SDK's atomic start hook and classify its
 * documented conflict and uncertain-outcome errors without exposing details.
 */
export interface DurableStartAdapter {
  start(jobId: string, options: { token: string; retention: '7 days' }): Promise<{ runId: string }>;
  classify(error: unknown): { kind: 'conflict' | 'unknown'; runId: string } | null;
}

/** The same job always uses the same durable admission token. */
export async function startFactCheckJob(jobId: string, adapter: DurableStartAdapter): Promise<StartJobResult> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(jobId)) throw new Error('Invalid fact-check job');
  try {
    const run = await adapter.start(jobId, { token: `fact-check:${jobId}`, retention: '7 days' });
    if (!run.runId) throw new Error('Invalid workflow run');
    return { status: 'started', runId: run.runId };
  } catch (error) {
    const classified = adapter.classify(error);
    if (classified?.runId && classified.kind === 'conflict') return { status: 'already_started', runId: classified.runId };
    if (classified?.runId && classified.kind === 'unknown') return { status: 'outcome_unknown', runId: classified.runId };
    throw new Error('Unable to start fact-check job');
  }
}
