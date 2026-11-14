import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessSingleClaim } from './2026-11-12-claim-assessment';

const claim = { id: 'claim-1', statement: 'The library opens on Saturdays and Sundays.', central: false };
const evidence = [{ id: 'source-1', claimId: 'claim-1', title: 'Library hours', publisher: null, url: 'https://source.example/a', publishedAt: null, retrievedAt: new Date('2026-01-01'), content: 'The library opens every Saturday and is closed on Sundays.' }];

function mockResponse({ score = 9, bothRelationships = false, passageNumber = 1, cite = true, unverifiedClaim = false } = {}): typeof fetch {
  const output = {
    score, confidence: 'medium', executiveSummary: 'The schedule lists Saturday hours.',
    supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'The library opens Saturdays.',
    claims: [{ claimNumber: 1, score: unverifiedClaim ? null : score, confidence: 'medium',
      explanation: 'The schedule confirms Saturday hours and refutes Sunday hours.',
      citations: cite ? [{ passageNumber, relationship: bothRelationships ? 'supports-and-contradicts' : 'supports' }] : [],
    }],
  };
  return async () => Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
}

const options = { articleUrl: 'https://example.org/a', articleTitle: 'Synthetic', claim, evidence, model: 'test', apiKey: 'synthetic', reserve: async () => {} };

test('returns only a verified short excerpt for durable storage', async () => {
  const result = await assessSingleClaim({ ...options, request: mockResponse() });
  assert.equal(result.sources[0].relationship, 'supports');
  assert.equal(result.sources[0].excerpt, evidence[0].content);
  assert.equal('content' in result.sources[0], false);
  assert.equal(claim.central, false);
});

test('keeps one verified source when it supports and contradicts parts of a mixed claim', async () => {
  const result = await assessSingleClaim({ ...options, request: mockResponse({ score: 5, bothRelationships: true }) });
  assert.equal(result.assessment.verdict, 'mixed');
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].relationship, 'supports-and-contradicts');
  assert.equal(result.sources[0].excerpt, evidence[0].content);
});

test('keeps both sides of a passage when a claim has an accurate premise and a false conclusion', async () => {
  const result = await assessSingleClaim({
    ...options,
    claim: { ...claim, statement: 'The library opens on Saturdays, so it must also open on Sundays.' },
    request: mockResponse({ score: 3, bothRelationships: true }),
  });
  assert.equal(result.assessment.verdict, 'mostly-false');
  assert.equal(result.assessment.score, 3);
  assert.deepEqual(result.sources.map(({ excerpt, relationship }) => ({ excerpt, relationship })), [
    { excerpt: evidence[0].content, relationship: 'supports-and-contradicts' },
  ]);
});

test('rejects an unknown passage and a two-sided citation for a True or False verdict', async () => {
  await assert.rejects(assessSingleClaim({ ...options, request: mockResponse({
    score: 5, bothRelationships: true, passageNumber: 999,
  }) }), { code: 'evidence_passage' });
  await assert.rejects(assessSingleClaim({ ...options, request: mockResponse({ bothRelationships: true }) }), { code: 'evidence_relationship' });
  await assert.rejects(assessSingleClaim({ ...options, request: mockResponse({ score: 1, bothRelationships: true }) }), { code: 'evidence_relationship' });
});

test('distinguishes an invalid score, a missing citation, and an unsupported overall verdict', async () => {
  for (const [output, code] of [
    [{ score: 11 }, 'provider_output'],
    [{ cite: false }, 'evidence_required'],
    [{ cite: false, unverifiedClaim: true }, 'evidence_central'],
  ] as const) {
    await assert.rejects(assessSingleClaim({ ...options, request: mockResponse(output) }), { code });
  }
});
