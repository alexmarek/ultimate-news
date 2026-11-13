import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPipelineServices } from './2026-11-09-services';
import { runPipeline } from './2026-11-09-pipeline';

test('runs the mocked stages with reservations and leaves missing evidence unverified', async () => {
  const reservations: number[] = [];
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    let result: unknown;
    if (body.tools) result = { urls: ['https://source.example/article'] };
    else if (body.response_format.json_schema.name === 'claims') result = { claims: [{ statement: 'A synthetic claim', importance: 'central', central: true }] };
    else {
      const input = JSON.parse(body.messages[1].content);
      result = { score: null, confidence: 'low', executiveSummary: 'No independent evidence was retrieved.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'The claim remains unverified.', claims: [{ claimNumber: input.claims[0].claimNumber, score: null, confidence: 'low', explanation: 'The source was unavailable.', citations: [] }] };
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }), { status: 200 });
  };
  const article = { canonicalUrl: 'https://example.org/article', title: 'Synthetic article', content: 'Synthetic body.' };
  const services = createPipelineServices({ articleUrl: article.canonicalUrl, model: 'test', apiKey: 'synthetic', maxClaims: 2, searchReservationUsd: 0.1, reserve: async (_cost, searches) => { reservations.push(searches); }, progress: async () => {}, request, fetcher: async () => { throw new Error('source unavailable'); } });
  const result = await runPipeline(article, services);
  assert.deepEqual(reservations, [0, 1, 0]);
  assert.equal(result.assessment.score, null);
});
