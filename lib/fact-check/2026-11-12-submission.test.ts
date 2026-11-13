import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitFactCheck, type SubmissionStore } from './2026-11-12-submission';
import type { DurableStartAdapter } from './2026-11-12-start-job';
import type { resolvePublicUrl } from './2026-11-09-safe-url';

const resolve: typeof resolvePublicUrl = async (input) => ({ url: new URL(input), addresses: [{ address: '8.8.8.8', family: 4 }] });
const ids = { articleId: 'article-1', reportId: 'report-1', jobId: 'job-1' };

test('reuses an existing report without starting paid research', async () => {
  let starts = 0;
  const store: SubmissionStore = { reserve: async (url) => { assert.equal(url, 'https://example.org/a'); return { kind: 'existing', articleId: ids.articleId, reportId: ids.reportId }; }, recordRun: async () => { throw new Error('unexpected'); } };
  const starter: DurableStartAdapter = { start: async () => { starts++; return { runId: 'run-1' }; }, classify: () => null };
  assert.deepEqual(await submitFactCheck({ url: 'https://example.org/a?utm_source=test', mode: 'check', store, starter, resolve }), { status: 'existing', articleId: ids.articleId, reportId: ids.reportId });
  assert.equal(starts, 0);
});

test('starts and records a newly reserved job', async () => {
  const recorded: string[] = [];
  const store: SubmissionStore = { reserve: async () => ({ kind: 'created', ...ids }), recordRun: async (jobId, runId) => { recorded.push(`${jobId}:${runId}`); } };
  const starter: DurableStartAdapter = { start: async () => ({ runId: 'run-1' }), classify: () => null };
  assert.deepEqual(await submitFactCheck({ url: 'https://example.org/a', mode: 'check', store, starter, resolve }), { status: 'started', ...ids });
  assert.deepEqual(recorded, ['job-1:run-1']);
});

test('an uncertain start keeps the job pending for safe reconciliation', async () => {
  let recorded = false;
  const store: SubmissionStore = { reserve: async () => ({ kind: 'created', ...ids }), recordRun: async () => { recorded = true; } };
  const starter: DurableStartAdapter = { start: async () => { throw new Error('timeout'); }, classify: () => ({ kind: 'unknown', runId: 'candidate' }) };
  assert.deepEqual(await submitFactCheck({ url: 'https://example.org/a', mode: 'check', store, starter, resolve }), { status: 'start_pending', ...ids });
  assert.equal(recorded, false);
});

test('unsafe URLs fail before any job is reserved', async () => {
  let reservations = 0;
  const store: SubmissionStore = { reserve: async () => { reservations++; return { kind: 'created', ...ids }; }, recordRun: async () => {} };
  const starter: DurableStartAdapter = { start: async () => ({ runId: 'run-1' }), classify: () => null };
  await assert.rejects(submitFactCheck({ url: 'http://127.0.0.1/', mode: 'check', store, starter }), /Unsafe/);
  assert.equal(reservations, 0);
});

test('a DNS failure gives the user a distinct submission error without starting a job', async () => {
  const store: SubmissionStore = { reserve: async () => assert.fail('Unexpected reservation'), recordRun: async () => {} };
  const starter: DurableStartAdapter = { start: async () => assert.fail('Unexpected start'), classify: () => null };
  await assert.rejects(submitFactCheck({
    url: 'https://example.org/a', mode: 'check', store, starter,
    resolve: async () => { throw Object.assign(new Error('Private DNS details'), { code: 'ENOTFOUND' }); },
  }), { code: 'unreachable', message: 'unreachable' });
});
