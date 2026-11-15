import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowStartAdapter, type WorkflowStartSdk } from './2026-11-12-workflow-start-adapter';
import { startFactCheckJob } from './2026-11-12-start-job';

const workflow = async (_jobId: string) => {};

test('starts a workflow using the atomic admission token and retention', async () => {
  let received: unknown;
  const sdk: WorkflowStartSdk = { start: async (_fn, args, options) => { received = { args, options }; return { runId: 'run-1' }; }, isConflict: (_): _ is { kind?: string; conflictingRunId?: string } => false, isUnknownStart: (_): _ is { runId: string } => false };
  assert.deepEqual(await startFactCheckJob('job-1', createWorkflowStartAdapter(workflow, sdk)), { status: 'started', runId: 'run-1' });
  assert.deepEqual(received, { args: ['job-1'], options: { experimental_hook: { token: 'fact-check:job-1', experimental_minRetention: '7 days' } } });
});

test('recognizes a conflicting run without starting paid work again', async () => {
  const error = { kind: 'start', conflictingRunId: 'existing-run' };
  const sdk: WorkflowStartSdk = { start: async () => { throw error; }, isConflict: (value): value is typeof error => value === error, isUnknownStart: (_): _ is { runId: string } => false };
  assert.deepEqual(await startFactCheckJob('job-1', createWorkflowStartAdapter(workflow, sdk)), { status: 'already_started', runId: 'existing-run' });
});

test('preserves the uncertain-start outcome for safe reconciliation', async () => {
  const error = { runId: 'candidate-run' };
  const sdk: WorkflowStartSdk = { start: async () => { throw error; }, isConflict: (_): _ is { kind?: string; conflictingRunId?: string } => false, isUnknownStart: (value): value is typeof error => value === error };
  assert.deepEqual(await startFactCheckJob('job-1', createWorkflowStartAdapter(workflow, sdk)), { status: 'outcome_unknown', runId: 'candidate-run' });
});
