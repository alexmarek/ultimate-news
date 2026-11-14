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

test('deduplicates identical citations but rejects different passages from one source', async () => {
  const source = 'The library opens on Saturdays and closes on Sundays. '.repeat(20);
  const options = { articleUrl: 'https://article.example/a', articleTitle: 'Synthetic', claims: [{ id: 'claim', statement: 'A claim', central: true }], evidence: [{ id: 'source', claimId: 'claim', url: 'https://source.example/a', title: 'Source', publisher: null, publishedAt: null, retrievedAt: new Date(), content: source }], model: 'test', apiKey: 'synthetic', reserve: async () => {} };
  const request = (secondPassage: number): typeof fetch => async () => Response.json({ choices: [{ message: { content: JSON.stringify({ score: 9, confidence: 'medium', executiveSummary: 'Supported.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'A claim.', claims: [{ claimNumber: 1, score: 9, confidence: 'medium', explanation: 'Supported.', citations: [{ passageNumber: 1, relationship: 'supports' }, { passageNumber: secondPassage, relationship: 'supports' }] }] }) } }] });
  const result = await evaluateClaims({ ...options, request: request(1) });
  assert.equal(result.claims[0].evidenceQuotes.length, 1);
  await assert.rejects(evaluateClaims({ ...options, request: request(2) }), { code: 'evidence_duplicate_source' });
  await assert.rejects(evaluateClaims({ ...options, request: request(999) }), { code: 'evidence_passage' });
});
