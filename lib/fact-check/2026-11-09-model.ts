import { z } from 'zod';
import { factCheckModelRoute } from './2026-11-09-cost';
import { FactCheckFailure, openRouterFailure, requestOpenRouter } from './2026-11-13-failure';

const errorSchema = z.object({ code: z.union([z.number(), z.string()]).optional() });
const responseSchema = z.object({
  error: errorSchema.nullish(),
  choices: z.array(z.object({
    error: errorSchema.nullish(),
    finish_reason: z.string().nullish(),
    message: z.object({ content: z.string().nullish() }).nullish(),
  })).optional(),
});

/** Accept one JSON answer and keep raw provider errors out of workflow state. */
export async function readCompletionJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
      throw new FactCheckFailure('provider_timeout');
    }
    throw new FactCheckFailure('provider_output');
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new FactCheckFailure('provider_output');
  const choice = parsed.data.choices?.[0];
  const providerError = parsed.data.error ?? choice?.error;
  if (providerError) throw openRouterFailure(Number(providerError.code));
  if (choice?.finish_reason === 'length') throw new FactCheckFailure('provider_truncated');
  if (choice?.finish_reason === 'error') throw new FactCheckFailure('provider_busy');
  const content = choice?.message?.content?.trim();
  if (!content) throw new FactCheckFailure('provider_output');
  const fencedJson = content.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/i);
  let value: unknown;
  try {
    value = JSON.parse(fencedJson?.[1] ?? content);
  } catch {
    throw new FactCheckFailure('provider_output');
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new FactCheckFailure('provider_output');
  return result.data;
}

/** The caller must reserve the maximum request cost in durable storage before calling. */
export async function structuredCompletion<T>({ model, apiKey, instruction, data, schema, schemaName, maxTokens, request = fetch }: {
  model: string; apiKey: string; instruction: string; data: unknown; schema: z.ZodType<T>; schemaName: string; maxTokens: number; request?: typeof fetch;
}): Promise<T> {
  if (!model || !apiKey || !instruction || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) throw new Error('Invalid model request');
  const serialized = JSON.stringify(data);
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > 200_000) throw new Error('Model input exceeds limit');
  const response = await requestOpenRouter(request, 'https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...factCheckModelRoute(model), max_tokens: maxTokens,
      reasoning: { effort: 'low' },
      response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema: z.toJSONSchema(schema) } },
      messages: [{ role: 'system', content: instruction }, { role: 'user', content: serialized }],
    }),
  });
  return readCompletionJson(response, schema);
}
