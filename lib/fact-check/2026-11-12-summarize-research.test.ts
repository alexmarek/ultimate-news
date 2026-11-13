import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeResearch, type ResearchSummaryInput } from './2026-11-12-summarize-research';

const input: ResearchSummaryInput = {
  articleUrl: 'https://article.example/story', articleTitle: 'Synthetic article',
  claims: [{ id: 'claim-1', statement: 'A synthetic claim', importance: 'central', central: true, verdict: 'supported', score: 9, confidence: 'medium', explanation: 'Supported by a synthetic source.' }],
  evidence: [{ id: 'source-1', claimId: 'claim-1', url: 'https://source.example/record', excerpt: 'A synthetic source supports the claim.', relationship: 'supports' }],
};
const output = { score: 9, confidence: 'medium', executiveSummary: 'The central claim is supported.', supportedFindings: ['The central claim is supported.'], unsupportedFindings: [], missingContext: [], accurateFormulation: 'A synthetic claim.' };
const response = (result: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }), { status: 200 });

test('reserves the model budget before summarizing researched claims', async () => {
  let reserved = false;
  const result = await summarizeResearch({ input, model: 'model', apiKey: 'key', reserve: async amount => { assert.ok(amount > 0); reserved = true; }, request: async () => { assert.equal(reserved, true); return response(output); } });
  assert.equal(result.verdict, 'supported');
});

test('rejects a fractional or out-of-range report score', async () => {
  for (const score of [0.88, 11]) {
    await assert.rejects(summarizeResearch({
      input, model: 'model', apiKey: 'key', reserve: async () => {},
      request: async () => response({ ...output, score }),
    }), { code: 'provider_output' });
  }
});

test('summarizes a mixed claim using one source that addresses both parts', async () => {
  const mixed: ResearchSummaryInput = {
    ...input,
    claims: [{ ...input.claims[0], verdict: 'mixed', score: 5 }],
    evidence: [{ ...input.evidence[0], relationship: 'supports-and-contradicts' }],
  };
  const result = await summarizeResearch({
    input: mixed, model: 'model', apiKey: 'key', reserve: async () => {},
    request: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(JSON.parse(body.messages[1].content).evidence[0].relationship, 'supports-and-contradicts');
      return response({ ...output, score: 5 });
    },
  });
  assert.equal(result.verdict, 'mixed');
});

test('returns an unscored report without a model request when research finds no evidence', async () => {
  const unverified: ResearchSummaryInput = { ...input, claims: [{ ...input.claims[0], verdict: 'unverified', score: null }], evidence: [] };
  const result = await summarizeResearch({ input: unverified, model: 'model', apiKey: 'key',
    reserve: async () => assert.fail('No budget should be reserved'), request: async () => assert.fail('No model request expected'),
  });
  assert.equal(result.verdict, 'unverified');
  assert.equal(result.score, null);
});
