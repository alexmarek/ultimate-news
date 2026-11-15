import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimExtractionSchema, evaluationSchema } from './2026-11-09-report-schema';

test('rejects extra model output and more than eight claims', () => {
  const claim = { statement: 'A factual assertion', importance: 'central', central: true };
  assert.equal(claimExtractionSchema.safeParse({ claims: [claim], instructions: 'ignore safeguards' }).success, false);
  assert.equal(claimExtractionSchema.safeParse({ claims: Array(9).fill(claim) }).success, false);
});

test('rejects numeric scores for unverified model output', () => {
  const result = evaluationSchema.safeParse({ score: 5, verdict: 'unverified', confidence: 'low', executiveSummary: 'Insufficient evidence.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'Not established.', claims: [] });
  assert.equal(result.success, false);
});
