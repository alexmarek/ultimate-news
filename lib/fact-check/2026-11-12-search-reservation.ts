import { maximumRequestCost } from './2026-11-09-cost';
import { SEARCH_MAX_CALLS, SEARCH_OUTPUT_TOKENS } from './2026-11-09-openrouter';
import { FactCheckFailure } from './2026-11-13-failure';

/**
 * Limits must come from a verified provider contract, not observed averages.
 * A server-side search may invoke the model more than once; a per-tool stop
 * condition alone does not prove the total number of billable model calls.
 */
export interface SearchRequestLimits {
  maxModelCalls: number;
  maxInputTokensPerCall: number;
  maxOutputTokensPerCall: number;
  maxSearchCalls: number;
  maxSearchFeeUsd: number;
}

// The pinned GLM 5.3 endpoints have a 1,048,576-token context window.
// A one-step search can produce one initial model turn and one final turn.
// Exa Fast includes five results within its $0.007 search fee.
export const GLM_53_SEARCH_LIMITS = {
  maxModelCalls: 2,
  maxInputTokensPerCall: 1_048_576,
  maxOutputTokensPerCall: SEARCH_OUTPUT_TOKENS,
  maxSearchCalls: SEARCH_MAX_CALLS,
  maxSearchFeeUsd: 0.007,
} satisfies SearchRequestLimits;

/** Returns a conservative reservation, rounded up to a millionth of a dollar. */
export function calculateSearchReservation(limits: SearchRequestLimits, model?: string): number {
  const counts = [limits.maxModelCalls, limits.maxInputTokensPerCall, limits.maxOutputTokensPerCall, limits.maxSearchCalls];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 1) || !Number.isFinite(limits.maxSearchFeeUsd) || limits.maxSearchFeeUsd < 0) {
    throw new Error('Verified search limits are required');
  }
  const total = limits.maxModelCalls * maximumRequestCost(limits.maxInputTokensPerCall, limits.maxOutputTokensPerCall, 0, model)
    + limits.maxSearchCalls * limits.maxSearchFeeUsd;
  if (!Number.isFinite(total) || total <= 0 || total > Number.MAX_SAFE_INTEGER / 1_000_000) throw new Error('Invalid search reservation');
  return Math.ceil(total * 1_000_000) / 1_000_000;
}

/** Fail before making an external request when the reservation cannot fit. */
export function requireAvailableSearchBudget(limits: SearchRequestLimits, availableUsd: number, searchesRemaining: number, model?: string): number {
  if (!Number.isFinite(availableUsd) || availableUsd < 0 || !Number.isSafeInteger(searchesRemaining) || searchesRemaining < 0) throw new Error('Invalid remaining budget');
  const reservation = calculateSearchReservation(limits, model);
  if (limits.maxSearchCalls > searchesRemaining || reservation > availableUsd) throw new FactCheckFailure('budget', 'Research budget exceeded');
  return reservation;
}
