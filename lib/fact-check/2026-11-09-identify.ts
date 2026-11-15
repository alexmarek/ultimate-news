import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { claimExtractionSchema } from './2026-11-09-report-schema';
import { CLAIM_EXTRACTION_INSTRUCTIONS } from './2026-11-09-prompts';
import { maximumRequestCost } from './2026-11-09-cost';
import { structuredCompletion } from './2026-11-09-model';
import type { PipelineArticle } from './2026-11-09-pipeline';
import { FactCheckFailure } from './2026-11-13-failure';

/** Reserve a conservative amount before sending article content to the model. */
export async function identifyClaims({ article, model, apiKey, maxClaims, reserve, request = fetch }: {
  article: PipelineArticle;
  model: string;
  apiKey: string;
  maxClaims: number;
  reserve: (maximumCostUsd: number) => Promise<void>;
  request?: typeof fetch;
}) {
  if (!Number.isInteger(maxClaims) || maxClaims < 1 || maxClaims > 8) throw new Error('Invalid claim limit');
  const data = { articleTitle: article.title, articleText: article.content, maxClaims };
  const inputBytes = Buffer.byteLength(JSON.stringify(data) + CLAIM_EXTRACTION_INSTRUCTIONS + JSON.stringify(z.toJSONSchema(claimExtractionSchema)), 'utf8');
  const outputTokenLimit = 4096;
  await reserve(maximumRequestCost(inputBytes * 4 + 4096, outputTokenLimit, 0, model));
  const result = await structuredCompletion({ model, apiKey, instruction: CLAIM_EXTRACTION_INSTRUCTIONS, data, schema: claimExtractionSchema, schemaName: 'claims', maxTokens: outputTokenLimit, request });
  if (!result.claims.length) throw new FactCheckFailure('no_claims');
  if (result.claims.length > maxClaims) throw new Error('Claim limit exceeded');
  return result.claims.map((claim) => ({ id: randomUUID(), ...claim }));
}
