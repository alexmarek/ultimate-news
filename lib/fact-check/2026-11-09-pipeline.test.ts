import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline, type PipelineServices } from './2026-11-09-pipeline';

const article = { canonicalUrl: 'https://example.org/article', title: 'Synthetic story', content: 'Synthetic content.' };

test('researches each claim and keeps insufficient evidence unverified', async () => {
  const stages: string[] = [];
  const services: PipelineServices = {
    identify: async () => [{ id: 'claim-1', statement: 'An assertion', central: true }],
    research: async () => [],
    evaluate: async () => ({ score: null, verdict: 'unverified', confidence: 'low', executiveSummary: 'Evidence is insufficient.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'The assertion is unverified.', claims: [{ claimId: 'claim-1', score: null, verdict: 'unverified', confidence: 'low', explanation: 'No evidence was retrieved.', supportingEvidenceIds: [], contradictingEvidenceIds: [], evidenceQuotes: [] }] }),
    progress: async (stage) => { stages.push(stage); },
  };
  const result = await runPipeline(article, services);
  assert.equal(result.assessment.score, null);
  assert.deepEqual(stages, ['identifying-claims', 'researching', 'evaluating']);
});

test('a failed research request does not become a definitive finding', async () => {
  let evaluated = false;
  const services: PipelineServices = {
    identify: async () => [{ id: 'claim-1', statement: 'An assertion', central: true }],
    research: async () => { throw new Error('Research unavailable'); },
    evaluate: async () => { evaluated = true; return {}; },
    progress: async () => {},
  };
  await assert.rejects(runPipeline(article, services), /Research unavailable/);
  assert.equal(evaluated, false);
});
