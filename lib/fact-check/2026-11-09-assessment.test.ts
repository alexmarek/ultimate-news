import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssessment } from './2026-11-09-assessment';

const claims = [{ id: 'claim-1', statement: 'A claim', central: true }];
const evidence = [{ id: 'evidence-1', claimId: 'claim-1', url: 'https://source.example/a', title: 'Source', publisher: null, publishedAt: null, retrievedAt: new Date('2026-01-01'), content: 'Synthetic source content that supports this claim.' }];
const report = () => ({ score: 9, verdict: 'supported', confidence: 'medium', executiveSummary: 'Supported by evidence.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'A claim.', claims: [{ claimId: 'claim-1', verdict: 'supported', score: 9, confidence: 'medium', explanation: 'Supported.', supportingEvidenceIds: ['evidence-1'], contradictingEvidenceIds: [], evidenceQuotes: [{ evidenceId: 'evidence-1', excerpt: 'Synthetic source content that supports this claim.' }] }] });

test('accepts an assessment with only recorded claim and evidence IDs', () => {
  assert.equal(parseAssessment(report(), 'https://example.org/article', claims, evidence).score, 9);
});

test('rejects a fractional claim score even when the report score is valid', () => {
  const invalid = report();
  invalid.claims[0].score = 0.88;
  assert.throws(() => parseAssessment(invalid, 'https://example.org/article', claims, evidence));
});

test('rejects invented quotations even when the evidence ID exists', () => {
  const invalid = report();
  invalid.claims[0].evidenceQuotes[0].excerpt = 'This quotation does not appear in the source.';
  assert.throws(() => parseAssessment(invalid, 'https://example.org/article', claims, evidence), /Invalid evidence quotation/);
});

test('rejects an invented passage appended to a real quotation', () => {
  const invalid = report();
  invalid.claims[0].evidenceQuotes[0].excerpt += '\n…\nThis invented passage was never in the source.';
  assert.throws(() => parseAssessment(invalid, 'https://example.org/article', claims, evidence), { code: 'evidence_quote' });
});

test('rejects an invented evidence ID and a missing claim', () => {
  const invented = report();
  invented.claims[0].supportingEvidenceIds = ['invented'];
  assert.throws(() => parseAssessment(invented, 'https://example.org/article', claims, evidence), { code: 'evidence_reference' });
  const missing = report();
  missing.claims = [];
  assert.throws(() => parseAssessment(missing, 'https://example.org/article', claims, evidence), { code: 'evidence_claims' });
});
