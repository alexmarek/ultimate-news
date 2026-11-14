import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyJob, type IdentificationStore } from './2026-11-12-identify-job';
import type { extractArticle } from './2026-11-09-extraction';
import type { identifyClaims } from './2026-11-09-identify';

const jobId = 'job-1';
const article = { canonicalUrl: 'https://example.org/article', title: 'Synthetic article', publisher: null, author: null, publishedAt: null, language: 'en', content: 'Private synthetic article body.' };
const claims = [{ id: '00000000-0000-4000-8000-000000000001' as const, statement: 'A checkable claim', importance: 'central', central: true }];
const extract: typeof extractArticle = async () => article;
const options = { jobId, model: 'model', apiKey: 'key', maxClaims: 8, extract };

test('reserves before identification and stores metadata without article content', async () => {
  const events: string[] = [];
  const store: IdentificationStore = {
    acquire: async () => ({ kind: 'acquired', token: 'lease', articleUrl: article.canonicalUrl }),
    reserve: async (job, token, amount) => { assert.equal(job, jobId); assert.equal(token, 'lease'); assert.equal(amount, 0.01); events.push('reserve'); },
    complete: async (_job, token, metadata, savedClaims) => { assert.equal(token, 'lease'); assert.equal('content' in metadata, false); assert.deepEqual(savedClaims, claims); events.push('complete'); },
    release: async () => { throw new Error('unexpected'); },
  };
  const identify: typeof identifyClaims = async ({ reserve }) => { await reserve(0.01); events.push('identify'); return claims; };
  assert.deepEqual(await identifyJob({ ...options, store, identify }), { claimIds: [claims[0].id] });
  assert.deepEqual(events, ['reserve', 'identify', 'complete']);
});

test('reuses a completed checkpoint without extracting or spending again', async () => {
  const store: IdentificationStore = { acquire: async () => ({ kind: 'complete', claimIds: ['claim-1'] }), reserve: async () => { throw new Error('unexpected'); }, complete: async () => { throw new Error('unexpected'); }, release: async () => { throw new Error('unexpected'); } };
  const noExtract: typeof extractArticle = async () => { throw new Error('unexpected'); };
  assert.deepEqual(await identifyJob({ ...options, store, extract: noExtract }), { claimIds: ['claim-1'] });
});

test('releases a lease on failed identification without exposing internal errors', async () => {
  let released = false;
  const store: IdentificationStore = { acquire: async () => ({ kind: 'acquired', token: 'lease', articleUrl: article.canonicalUrl }), reserve: async () => {}, complete: async () => { throw new Error('unexpected'); }, release: async (_job, token) => { assert.equal(token, 'lease'); released = true; } };
  const identify: typeof identifyClaims = async () => { throw new Error('private content'); };
  await assert.rejects(identifyJob({ ...options, store, identify }), { message: 'Claim identification failed' });
  assert.equal(released, true);
});

test('does not begin extraction when another worker holds the lease', async () => {
  const store: IdentificationStore = { acquire: async () => ({ kind: 'busy' }), reserve: async () => {}, complete: async () => {}, release: async () => { throw new Error('unexpected'); } };
  const noExtract: typeof extractArticle = async () => { throw new Error('unexpected'); };
  await assert.rejects(identifyJob({ ...options, store, extract: noExtract }), /already being processed/);
});

test('identifies a pasted claim without fetching an article URL', async () => {
  const store: IdentificationStore = {
    acquire: async () => ({ kind: 'acquired', token: 'lease', articleUrl: 'https://fact-check.invalid/submission/example', inputType: 'text', inputText: 'A synthetic claim to check.' }),
    reserve: async () => {}, complete: async () => {}, release: async () => {},
  };
  const noExtract: typeof extractArticle = async () => { throw new Error('unexpected network fetch'); };
  const identify: typeof identifyClaims = async ({ article: input }) => { assert.equal(input.content, 'A synthetic claim to check.'); return claims; };
  assert.deepEqual(await identifyJob({ ...options, store, extract: noExtract, identify }), { claimIds: [claims[0].id] });
});
