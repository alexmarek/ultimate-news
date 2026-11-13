import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClaims } from './2026-11-09-evaluate';

test('returns an unverified result when no evidence was retrieved', async () => {
  let reserved = false;
  const output = { score: null, confidence: 'low', executiveSummary: 'No independent evidence was available.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'The claim remains unverified.', claims: [{ claimNumber: 1, score: null, confidence: 'low', explanation: 'No source was retrieved.', citations: [] }] };
  const request: typeof fetch = async () => { assert.equal(reserved, true); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status: 200 }); };
  const result = await evaluateClaims({ articleUrl: 'https://example.org/a', articleTitle: 'Synthetic', claims: [{ id: 'claim-1', statement: 'A claim', central: true }], evidence: [], model: 'test', apiKey: 'synthetic', reserve: async () => { reserved = true; }, request });
  assert.equal(result.score, null);
  assert.equal(result.verdict, 'unverified');
  assert.equal(result.claims[0].verdict, 'unverified');
});
