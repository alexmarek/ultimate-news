import { summarizeResearch, type ResearchSummary, type ResearchSummaryInput } from './2026-11-12-summarize-research';
import { FactCheckFailure } from './2026-11-13-failure';

type EvaluationLease = { kind: 'complete' } | { kind: 'busy' } | { kind: 'acquired'; token: string; input: ResearchSummaryInput };

/** Implementations must durably reserve spend and fence writes with the lease. */
export interface EvaluationStore {
  acquire(jobId: string): Promise<EvaluationLease>;
  reserve(jobId: string, token: string, maximumCostUsd: number): Promise<void>;
  complete(jobId: string, token: string, result: ResearchSummary): Promise<void>;
  release(jobId: string, token: string): Promise<void>;
}

/** Workflow state receives no source text or generated report contents. */
export async function evaluateJob({ jobId, store, model, apiKey, summarize = summarizeResearch }: {
  jobId: string; store: EvaluationStore; model: string; apiKey: string; summarize?: typeof summarizeResearch;
}): Promise<void> {
  if (!jobId || !model || !apiKey) throw new Error('Invalid evaluation request');
  const lease = await store.acquire(jobId);
  if (lease.kind === 'complete') return;
  if (lease.kind === 'busy') throw new Error('Evaluation is already being processed');
  try {
    if (!lease.token) throw new Error('Invalid evaluation lease');
    const report = await summarize({ input: lease.input, model, apiKey, reserve: amount => store.reserve(jobId, lease.token, amount) });
    await store.complete(jobId, lease.token, report);
  } catch (error) {
    // A timed-out request may have been billed; its reservation is never refunded.
    try { await store.release(jobId, lease.token); } catch { /* Lease expiry handles recovery. */ }
    if (error instanceof FactCheckFailure) throw error;
    throw new Error('Report evaluation failed');
  }
}
