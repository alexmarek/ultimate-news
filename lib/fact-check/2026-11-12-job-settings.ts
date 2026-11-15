import { z } from 'zod';
import { DEFAULT_FACT_CHECK_MODEL, factCheckModelRoute, isDefaultFactCheckModel } from './2026-11-09-cost';
import { SEARCH_MAX_CALLS, SEARCH_OUTPUT_TOKENS } from './2026-11-09-openrouter';
import { calculateSearchReservation, GLM_53_SEARCH_LIMITS } from './2026-11-12-search-reservation';

const searchLimitsSchema = z.strictObject({
  maxModelCalls: z.number().int().min(2),
  maxInputTokensPerCall: z.number().int().positive(),
  maxOutputTokensPerCall: z.number().int().min(SEARCH_OUTPUT_TOKENS),
  maxSearchCalls: z.literal(SEARCH_MAX_CALLS),
  maxSearchFeeUsd: z.number().min(GLM_53_SEARCH_LIMITS.maxSearchFeeUsd),
});

/** Search bounds apply to the configured model and OpenRouter request settings. */
export function readFactCheckJobSettings(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.FACT_CHECK_ENABLED !== 'true') return null;
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const configuredModel = env.FACT_CHECK_MODEL?.trim() || DEFAULT_FACT_CHECK_MODEL;
  const { model } = factCheckModelRoute(configuredModel);
  const maxClaims = Number(env.FACT_CHECK_MAX_CLAIMS ?? 2);
  const maxSearches = Number(env.FACT_CHECK_MAX_SEARCHES ?? 16);
  const maxCostUsd = Number(env.FACT_CHECK_MAX_COST_USD ?? 3);
  if (!apiKey ||
      !Number.isSafeInteger(maxClaims) || maxClaims < 1 || maxClaims > 8 ||
      !Number.isSafeInteger(maxSearches) || maxSearches < 1 ||
      !Number.isSafeInteger(Math.floor(maxCostUsd * 1_000_000)) || maxCostUsd < 0.000001) return null;

  try {
    const searchLimits = isDefaultFactCheckModel(configuredModel) ? GLM_53_SEARCH_LIMITS :
      searchLimitsSchema.parse(JSON.parse(env.FACT_CHECK_SEARCH_LIMITS_JSON || 'null'));
    if (searchLimits.maxSearchCalls > maxSearches ||
        calculateSearchReservation(searchLimits, model) >= maxCostUsd) return null;
    return { apiKey, model, maxClaims, maxSearches, maxCostUsd, searchLimits, maxAttempts: 3, leaseMs: 240_000 };
  } catch {
    return null;
  }
}
