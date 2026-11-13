import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFactCheckJob, type DurableStartAdapter } from './2026-11-12-start-job';

test('uses a stable job-specific token and returns the started run', async () => {
  const calls: unknown[] = [];
  const adapter: DurableStartAdapter = { start: async (id, options) => { calls.push({ id, options }); return { runId: 'run-1' }; }, classify: () => null };
  assert.deepEqual(await startFactCheckJob('job-1', adapter), { status: 'started', runId: 'run-1' });
  assert.deepEqual(calls, [{ id: 'job-1', options: { token: 'fact-check:job-1', retention: '7 days' } }]);
});

test('duplicate starts return the existing workflow instead of starting another', async () => {
  const adapter: DurableStartAdapter = { start: async () => { throw new Error('conflict'); }, classify: () => ({ kind: 'conflict', runId: 'run-1' }) };
  assert.deepEqual(await startFactCheckJob('job-1', adapter), { status: 'already_started', runId: 'run-1' });
});

test('an uncertain start is not misreported as a failed job', async () => {
  const adapter: DurableStartAdapter = { start: async () => { throw new Error('timeout'); }, classify: () => ({ kind: 'unknown', runId: 'run-1' }) };
  assert.deepEqual(await startFactCheckJob('job-1', adapter), { status: 'outcome_unknown', runId: 'run-1' });
});

test('unexpected errors and invalid IDs do not expose internal details', async () => {
  const adapter: DurableStartAdapter = { start: async () => { throw new Error('private diagnostic'); }, classify: () => null };
  await assert.rejects(startFactCheckJob('job-1', adapter), (error: Error) => error.message === 'Unable to start fact-check job');
  await assert.rejects(startFactCheckJob('bad id', adapter), /Invalid fact-check job/);
});
