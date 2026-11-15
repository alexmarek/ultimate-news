import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { runFactCheckJob, type FactCheckActivities } from './2026-11-12-job-orchestrator';

function fixture() {
  const calls: string[] = [];
  const activities: FactCheckActivities = {
    identify: async () => { calls.push('identify'); return { claimIds: ['claim-a', 'claim-b'] }; },
    researchClaim: async (_jobId, claimId) => { calls.push(`research:${claimId}`); },
    evaluate: async () => { calls.push('evaluate'); },
    finish: async () => { calls.push('finish'); },
    fail: async (_jobId, category) => { calls.push(`fail:${category}`); },
  };
  return { calls, activities };
}

test('researches each claim before evaluating and finishing a report', async () => {
  const { calls, activities } = fixture();
  await runFactCheckJob('job-1', activities);
  assert.deepEqual(calls, ['identify', 'research:claim-a', 'research:claim-b', 'evaluate', 'finish']);
});

test('a failed research step records failure and never evaluates or finishes', async () => {
  const { calls, activities } = fixture();
  activities.researchClaim = async () => { throw new Error('private source details'); };
  await assert.rejects(runFactCheckJob('job-1', activities), (error: Error) => error.message === 'Fact-check processing failed');
  assert.deepEqual(calls, ['identify', 'fail:research_failed']);
});

test('duplicate or excessive claim identifiers cannot trigger research', async () => {
  const { calls, activities } = fixture();
  activities.identify = async () => ({ claimIds: ['same', 'same'] });
  await assert.rejects(runFactCheckJob('job-1', activities), /processing failed/);
  assert.deepEqual(calls, ['fail:identification_failed']);
});

test('preserves only a known failure code from a workflow step', async () => {
  const { calls, activities } = fixture();
  activities.researchClaim = async () => {
    throw Object.assign(new Error('Workflow exhausted its retries'), { cause: new Error('provider_timeout') });
  };
  await assert.rejects(runFactCheckJob('job-1', activities), /processing failed/);
  assert.deepEqual(calls, ['identify', 'fail:provider_timeout']);
});

test('preserves an article access failure returned from a different JavaScript realm', async () => {
  const { calls, activities } = fixture();
  const publisherError: unknown = runInNewContext('new Error("article_blocked")');
  activities.identify = async () => {
    throw Object.assign(new Error('Workflow step failed'), { cause: publisherError });
  };
  await assert.rejects(runFactCheckJob('job-1', activities), /processing failed/);
  assert.deepEqual(calls, ['fail:article_blocked']);
});

test('a failure recording error does not expose the original private error', async () => {
  const { activities } = fixture();
  activities.identify = async () => { throw new Error('private source details'); };
  activities.fail = async () => { throw new Error('secret diagnostic'); };
  await assert.rejects(runFactCheckJob('job-1', activities), (error: Error) => error.message === 'Fact-check failed and its status could not be recorded');
});
