import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetrievedExcerpt, retrieveEvidence } from './2026-11-09-evidence';

test('only creates evidence for independently retrieved content', async () => {
  const text = 'A source document contains the relevant evidence about this synthetic example. '.repeat(5);
  const calls: string[] = [];
  const fetcher = async (url: string) => { calls.push(url); return { url, html: `<title>Source document</title><article><p>${text}</p></article>` }; };
  const records = await retrieveEvidence({ claimId: 'c1', candidates: ['https://example.org/article?utm_source=x', 'https://source.example/report', 'https://source.example/report'], articleUrl: 'https://example.org/article', fetcher });
  assert.equal(records.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(records[0].claimId, 'c1');
  assert.equal(isRetrievedExcerpt(records[0], 'A source document contains the relevant evidence'), true);
  assert.equal(isRetrievedExcerpt(records[0], 'An invented statement that is absent from this document'), false);
});

test('unavailable sources do not become evidence', async () => {
  const result = await retrieveEvidence({ claimId: 'c1', candidates: ['https://source.example/report'], articleUrl: 'https://example.org/article', fetcher: async () => { throw new Error('unavailable'); } });
  assert.deepEqual(result, []);
});
