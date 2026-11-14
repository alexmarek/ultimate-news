import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadyForReview, createJobFinalizer } from './2026-11-12-finalize-job';

const report = { id: 'report-1', status: 'queued', canonicalUrl: 'https://article.example/story', title: 'A synthetic article', verdict: 'supported' as const, score: 9, confidence: 'medium', executiveSummary: 'A supported synthetic claim.', verifiedAt: new Date('2026-01-01') };
const claims = [{ id: 'claim-1', central: true, verdict: 'supported' as const, score: 9, checkpoint: 'complete' }];
const evidence = [{ id: 'source-1', claimId: 'claim-1', url: 'https://source.example/original', excerpt: 'This synthetic source supports the claim.' }];

test('allows a completed assessment with independent evidence', () => {
  assert.doesNotThrow(() => assertReadyForReview(report, claims, evidence));
});

test('rejects any claim whose research checkpoint is incomplete', () => {
  assert.throws(() => assertReadyForReview(report, [{ ...claims[0], checkpoint: 'leased' }], evidence));
  assert.throws(() => assertReadyForReview(report, [{ ...claims[0], checkpoint: null }], evidence));
});

test('rejects the submitted article as its own evidence and rejects missing evidence', () => {
  assert.throws(() => assertReadyForReview(report, claims, [{ ...evidence[0], url: report.canonicalUrl }]));
  assert.throws(() => assertReadyForReview(report, claims, []));
});

test('rejects evidence assigned to a different claim or with a short excerpt', () => {
  assert.throws(() => assertReadyForReview(report, claims, [{ ...evidence[0], claimId: 'other' }]));
  assert.throws(() => assertReadyForReview(report, claims, [{ ...evidence[0], excerpt: 'too short' }]));
});

test('accepts an honestly unverified result without invented evidence', () => {
  assert.doesNotThrow(() => assertReadyForReview({ ...report, verdict: 'unverified', score: null }, [{ ...claims[0], verdict: 'unverified', score: null }], []));
});

test('rejects unsupported overall scores and incomplete metadata', () => {
  assert.throws(() => assertReadyForReview({ ...report, verdict: 'unverified', score: 5 }, claims, evidence));
  assert.throws(() => assertReadyForReview({ ...report, title: ' ' }, claims, evidence));
  assert.throws(() => assertReadyForReview({ ...report, confidence: 'certain' }, claims, evidence));
});

test('persists the failure reason before releasing the article for a retry', async () => {
  const updates: Array<{ sql: string; values: unknown[] }> = [];
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray): Promise<T> => (
      query.join('').includes('FOR UPDATE OF a')
        ? [{ id: 'article-1', activeJobId: 'job-1' }]
        : [{ status: 'researching', reportId: 'report-1' }]
    ) as T,
    $executeRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      updates.push({ sql: query.join('?'), values });
      return 1;
    },
  };
  const finalizer = createJobFinalizer({ $transaction: async (run) => run(tx) });
  await finalizer.fail('job-1', 'provider_credits');
  assert.equal(updates.length, 3);
  assert.match(updates[1].sql, /UPDATE "FactCheckJob".*"errorCategory" = \?/);
  assert.deepEqual(updates[1].values, ['provider_credits', 'job-1']);
  assert.match(updates[2].sql, /"activeJobId" = NULL/);
});

test('publishes a validated result and replaces the previous published version atomically', async () => {
  const updates: string[] = [];
  const tx = {
    $queryRaw: async <T>(query: TemplateStringsArray): Promise<T> => {
      const sql = query.join('');
      if (sql.includes('FOR UPDATE OF a')) return [{ id: 'article-1', activeJobId: 'job-1' }] as T;
      if (sql.includes('SELECT "status", "reportId"')) return [{ status: 'evaluating', reportId: 'report-1' }] as T;
      if (sql.includes('FROM "FactCheckReport"')) return [report] as T;
      if (sql.includes('FROM "FactCheckClaim"')) return claims as T;
      if (sql.includes('FROM "FactCheckEvidence"')) return evidence as T;
      throw new Error('unexpected query');
    },
    $executeRaw: async (query: TemplateStringsArray) => { updates.push(query.join('?')); return 1; },
  };
  await createJobFinalizer({ $transaction: async run => run(tx) }).finish('job-1');
  assert.match(updates[0], /superseded/);
  assert.match(updates[1], /published/);
  assert.match(updates[2], /published/);
  assert.match(updates[3], /"publishedReportId" = \?/);
});
