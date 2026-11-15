import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAssessment, type ReportAssessment } from './2026-11-09-report-validation';

function report(): ReportAssessment {
  return {
    articleUrl: 'https://example.org/article',
    verdict: 'supported',
    score: 9,
    claims: [{ id: 'claim-1', verdict: 'supported', score: 9, central: true, evidenceIds: ['evidence-1'] }],
    evidence: [{ id: 'evidence-1', claimId: 'claim-1', url: 'https://evidence.example/record' }],
  };
}

test('accepts a supported central claim with recorded evidence', () => {
  assert.deepEqual(validateAssessment(report()), []);
});

test('rejects citations that do not resolve to the correct claim', () => {
  const value = report();
  value.claims[0].evidenceIds = ['invented'];
  assert.ok(validateAssessment(value).some((error) => error.includes('Invalid evidence reference')));
});

test('unverified claims and overall verdicts have null scores', () => {
  const value = report();
  value.claims[0] = { ...value.claims[0], verdict: 'unverified', score: 5 };
  value.verdict = 'unverified';
  value.score = 5;
  assert.ok(validateAssessment(value).some((error) => error.includes('Invalid score or verdict for claim')));
  assert.ok(validateAssessment(value).some((error) => error.includes('null score')));
});

test('requires a whole score in the verdict band for both the report and its claims', () => {
  for (const score of [0, 0.88, 8.5, 11, 1]) {
    const value = report();
    value.score = score;
    value.claims[0].score = score;
    const errors = validateAssessment(value);
    assert.ok(errors.some(error => error.includes('Overall score')), `report score ${score}`);
    assert.ok(errors.some(error => error.includes('Invalid score or verdict for claim')), `claim score ${score}`);
  }
  for (const [verdict, score] of [['false', 1], ['mostly-false', 3], ['mixed', 5], ['mostly-supported', 7], ['supported', 10]] as const) {
    const value = report();
    Object.assign(value, { verdict, score });
    Object.assign(value.claims[0], { verdict, score });
    assert.deepEqual(validateAssessment(value), []);
  }
});

test('an unsupported central claim cannot produce a numeric overall verdict', () => {
  const value = report();
  value.claims[0] = { ...value.claims[0], verdict: 'unverified', score: null };
  assert.ok(validateAssessment(value).some((error) => error.includes('verified central claim')));
});

test('rejects the submitted article as evidence for itself', () => {
  const value = report();
  value.evidence[0].url = value.articleUrl;
  assert.ok(validateAssessment(value).some((error) => error.includes('not independent')));
});
