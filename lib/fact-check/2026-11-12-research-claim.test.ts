import { test } from 'node:test';
import assert from 'node:assert/strict';
import { researchClaim, type ClaimResearchStore } from './2026-11-12-research-claim';

const limits = { maxModelCalls: 2, maxInputTokensPerCall: 1000, maxOutputTokensPerCall: 1200, maxSearchCalls: 1, maxSearchFeeUsd: 0.007 };
const claim = { id: 'claim-1', statement: 'A synthetic claim', central: true };

function fixture() {
  const calls: string[] = [];
  const store: ClaimResearchStore = {
    acquire: async () => ({ kind: 'acquired', token: 'lease-1', claim, articleUrl: 'https://example.org/a', articleTitle: 'Synthetic', remainingUsd: 1, searchesRemaining: 1 }),
    reserve: async (_job, _token, _cost, searches) => { calls.push(`reserve:${searches}`); },
    complete: async (_job, _claim, _token, result) => { calls.push(`complete:${result.sources.length}`); assert.equal('content' in result.sources[0], false); },
    release: async () => { calls.push('release'); },
  };
  return { calls, store };
}

test('completed or busy claims do not trigger paid requests', async () => {
  const { store } = fixture();
  let requests = 0;
  const request: typeof fetch = async () => { requests++; throw new Error('unexpected'); };
  store.acquire = async () => ({ kind: 'complete' });
  await researchClaim({ jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request });
  store.acquire = async () => ({ kind: 'busy' });
  await assert.rejects(researchClaim({ jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request }), /already being processed/);
  assert.equal(requests, 0);
});

test('a denied reservation makes no request and releases the claim lease', async () => {
  const { calls, store } = fixture();
  let requests = 0;
  store.reserve = async () => { throw new Error('Budget exceeded'); };
  const request: typeof fetch = async () => { requests++; throw new Error('unexpected'); };
  await assert.rejects(researchClaim({ jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request }), /Claim research failed/);
  assert.equal(requests, 0);
  assert.deepEqual(calls, ['release']);
});

test('an OpenRouter credit failure keeps the recovery code without exposing the response', async () => {
  const { calls, store } = fixture();
  const request: typeof fetch = async () => new Response('Private synthetic response', { status: 402 });
  await assert.rejects(researchClaim({
    jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request,
  }), { code: 'provider_credits', message: 'OpenRouter request failed (402)' });
  assert.deepEqual(calls, ['reserve:1', 'release']);
});

test('a successful search with no usable sources checkpoints an unscored claim', async () => {
  const { calls, store } = fixture();
  store.complete = async (_job, _claim, _token, result) => {
    assert.equal(result.assessment.verdict, 'unverified');
    assert.equal(result.assessment.score, null);
    assert.deepEqual(result.sources, []);
    calls.push('complete');
  };
  const request: typeof fetch = async (_url, init) => {
    assert.ok(JSON.parse(String(init?.body)).tools, 'Only the search should call the model');
    calls.push('search');
    return Response.json({ choices: [{ message: { content: '```json\n{"urls":["https://source.example/blocked"]}\n```' } }] });
  };
  await researchClaim({ jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request,
    fetcher: async () => { throw new Error('Synthetic source is inaccessible'); },
  });
  assert.deepEqual(calls, ['reserve:1', 'search', 'complete']);
});

test('reserves before both model requests and checkpoints only cited excerpts', async () => {
  const { calls, store } = fixture();
  const passage = 'The synthetic source contains a factual statement supporting the claim. ';
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.tools) {
      calls.push('search');
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ urls: ['https://source.example/a'] }) } }] }), { status: 200 });
    }
    calls.push('evaluate');
    const input = JSON.parse(body.messages[1].content);
    const { passageNumber } = input.evidence[0].passages[0];
    const report = { score: 9, confidence: 'medium', executiveSummary: 'The claim is supported.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'A synthetic claim.', claims: [{ claimNumber: input.claims[0].claimNumber, score: 9, confidence: 'medium', explanation: 'The source supports it.', citations: [{ passageNumber, relationship: 'supports' }] }] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(report) } }] }), { status: 200 });
  };
  const fetcher = async (url: string) => ({ url, html: `<title>Synthetic source</title><article><p>${passage.repeat(5)}</p></article>` });
  await researchClaim({ jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request, fetcher });
  assert.deepEqual(calls, ['reserve:1', 'search', 'reserve:0', 'evaluate', 'complete:1']);
});

test('accepts multiple passages from one source without repeating the search or assessment', async () => {
  const { calls, store } = fixture();
  let assessments = 0;
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.tools) {
      calls.push('search');
      return Response.json({ choices: [{ message: { content: JSON.stringify({ urls: ['https://source.example/a'] }) } }] });
    }
    calls.push('evaluate');
    const input = JSON.parse(body.messages[1].content);
    const passages = input.evidence[0].passages;
    assert.ok(passages.length > 1);
    const citations = [{ passageNumber: passages[0].passageNumber, relationship: 'supports' }];
    if (assessments++ === 0) citations.push({ passageNumber: passages[1].passageNumber, relationship: 'supports' });
    const report = { score: 9, confidence: 'medium', executiveSummary: 'The claim is supported.', supportedFindings: [], unsupportedFindings: [], missingContext: [], accurateFormulation: 'A synthetic claim.', claims: [{ claimNumber: 1, score: 9, confidence: 'medium', explanation: 'The source supports it.', citations }] };
    return Response.json({ choices: [{ message: { content: JSON.stringify(report) } }] });
  };
  const fetcher = async (url: string) => ({ url, html: `<title>Synthetic source</title><article><p>${'The synthetic source contains a factual statement supporting the claim. '.repeat(20)}</p></article>` });
  await researchClaim({ jobId: 'job-1', claimId: claim.id, store, searchLimits: limits, model: 'test', apiKey: 'synthetic', request, fetcher });
  assert.deepEqual(calls, ['reserve:1', 'search', 'reserve:0', 'evaluate', 'complete:1']);
});
