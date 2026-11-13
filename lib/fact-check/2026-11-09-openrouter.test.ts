import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverSources, ResearchBudget } from './2026-11-09-openrouter';
import { PINNED_GLM_53 } from './2026-11-09-cost';

test('does not send a request after the budget is exhausted', async () => {
  let called = false;
  const request: typeof fetch = async () => { called = true; throw new Error('unexpected'); };
  await assert.rejects(discoverSources({ claim: 'A claim', model: 'test', apiKey: 'synthetic', budget: new ResearchBudget(0, 0), upperBoundUsd: 0.1, request }), /budget/);
  assert.equal(called, false);
});

test('uses one capped search and treats results as source suggestions', async () => {
  let searchLimit: unknown;
  let stopConditions: unknown;
  const request: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    searchLimit = body.tools[0].parameters.max_uses;
    stopConditions = body.stop_server_tools_when;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ urls: ['https://example.org/source', 'https://example.org/source'] }) } }] }), { status: 200 });
  };
  const budget = new ResearchBudget(1, 2);
  assert.deepEqual(await discoverSources({ claim: 'A claim', model: 'test', apiKey: 'synthetic', budget, upperBoundUsd: 0.1, request }), ['https://example.org/source']);
  assert.equal(searchLimit, 1);
  assert.deepEqual(stopConditions, [{ type: 'step_count_is', step_count: 1 }, { type: 'max_cost', max_cost_in_dollars: 0.1 }]);
  assert.equal(budget.remainingSearches, 1);
});

test('sends the model and price limits used by the default search reservation', async () => {
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, PINNED_GLM_53);
    assert.equal(body.provider.allow_fallbacks, false);
    assert.deepEqual(body.provider.only, ['wafer/us', 'inference-net/us', 'inference-net/fp4']);
    assert.deepEqual(body.provider.max_price, { prompt: 0.1, completion: 5, request: 0 });
    assert.equal(body.max_tokens, 1200);
    assert.equal(body.tool_choice, 'required');
    assert.equal(body.tools[0].parameters.mode, 'fast');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"urls":[]}' } }] }));
  };
  await discoverSources({ claim: 'A claim', model: 'z-ai/glm-5.3', apiKey: 'synthetic',
    budget: new ResearchBudget(1, 1), upperBoundUsd: 0.228716, request });
});

test('a truncated search answer is a provider failure rather than an empty result', async () => {
  await assert.rejects(discoverSources({
    claim: 'A claim', model: 'test', apiKey: 'synthetic', budget: new ResearchBudget(1, 1), upperBoundUsd: 0.1,
    request: async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '' } }] }),
  }), { code: 'provider_truncated' });
});

test('a provider error inside an HTTP 200 response retains its category', async () => {
  await assert.rejects(discoverSources({
    claim: 'A claim', model: 'test', apiKey: 'synthetic', budget: new ResearchBudget(1, 1), upperBoundUsd: 0.1,
    request: async () => Response.json({ error: { code: 429, message: 'Private provider details' } }),
  }), { code: 'provider_busy', message: 'OpenRouter request failed (429)' });
});
