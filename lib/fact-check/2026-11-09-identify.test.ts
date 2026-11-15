import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyClaims } from './2026-11-09-identify';

const article = { title: 'Synthetic article', content: 'Synthetic body', canonicalUrl: 'https://example.org/article' };

test('reserves the model budget before making the request', async () => {
  const calls: string[] = [];
  const request: typeof fetch = async () => { calls.push('request'); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ claims: [{ statement: 'A claim', importance: 'central', central: true }] }) } }] }), { status: 200 }); };
  const claims = await identifyClaims({ article, model: 'test', apiKey: 'synthetic', maxClaims: 2, reserve: async (cost) => { assert.ok(cost > 0); calls.push('reserve'); }, request });
  assert.deepEqual(calls, ['reserve', 'request']);
  assert.equal(claims.length, 1);
});

test('does not make a paid request when reservation fails', async () => {
  let called = false;
  const request: typeof fetch = async () => { called = true; throw new Error('unexpected'); };
  await assert.rejects(identifyClaims({ article, model: 'test', apiKey: 'synthetic', maxClaims: 2, reserve: async () => { throw new Error('Budget exceeded'); }, request }), /Budget exceeded/);
  assert.equal(called, false);
});
