import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { structuredCompletion } from './2026-11-09-model';

test('requires structured output and validates model data', async () => {
  let required: unknown;
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    required = body.provider.require_parameters;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"value":"yes"}' } }] }), { status: 200 });
  };
  const result = await structuredCompletion({ model: 'test', apiKey: 'synthetic', instruction: 'Return data.', data: { input: 'x' }, schema: z.object({ value: z.string() }).strict(), schemaName: 'test', maxTokens: 100, request });
  assert.deepEqual(result, { value: 'yes' });
  assert.equal(required, true);
});

test('rejects model responses that do not match the schema', async () => {
  const request: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"value":1}' } }] }), { status: 200 });
  await assert.rejects(structuredCompletion({ model: 'test', apiKey: 'synthetic', instruction: 'Return data.', data: {}, schema: z.object({ value: z.string() }).strict(), schemaName: 'test', maxTokens: 100, request }));
});
