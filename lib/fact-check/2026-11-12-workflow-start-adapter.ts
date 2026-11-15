import type { DurableStartAdapter } from './2026-11-12-start-job';

export type FactCheckWorkflow = (jobId: string) => Promise<void>;

export interface WorkflowStartSdk {
  start(workflow: FactCheckWorkflow, args: [string], options: { experimental_hook: { token: string; experimental_minRetention: '7 days' } }): Promise<{ runId: string }>;
  isConflict(error: unknown): error is { kind?: string; conflictingRunId?: string };
  isUnknownStart(error: unknown): error is { runId: string };
}

/** Map our admission contract to the Workflow SDK's atomic start hook. */
export function createWorkflowStartAdapter(workflow: FactCheckWorkflow, sdk: WorkflowStartSdk): DurableStartAdapter {
  return {
    async start(jobId, options) {
      return sdk.start(workflow, [jobId], { experimental_hook: { token: options.token, experimental_minRetention: options.retention } });
    },
    classify(error) {
      if (sdk.isConflict(error) && error.kind === 'start' && error.conflictingRunId) return { kind: 'conflict', runId: error.conflictingRunId };
      if (sdk.isUnknownStart(error) && error.runId) return { kind: 'unknown', runId: error.runId };
      return null;
    },
  };
}

/** Load the SDK only when an explicitly authorized server-side action needs it. */
export async function loadWorkflowStartAdapter(workflow: FactCheckWorkflow): Promise<DurableStartAdapter> {
  const [{ start }, { HookConflictError, WorkflowStartError }] = await Promise.all([import('workflow/api'), import('workflow/errors')]);
  return createWorkflowStartAdapter(workflow, {
    start: (fn, args, options) => start(fn, args, options),
    isConflict: HookConflictError.is,
    isUnknownStart: WorkflowStartError.is,
  });
}
