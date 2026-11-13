import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PINNED_GLM_53 } from './2026-11-09-cost';
import { readFactCheckJobSettings } from './2026-11-12-job-settings';
import { calculateSearchReservation, GLM_53_SEARCH_LIMITS, requireAvailableSearchBudget } from './2026-11-12-search-reservation';

const limits = { maxModelCalls: 2, maxInputTokensPerCall: 1_000_000, maxOutputTokensPerCall: 1200, maxSearchCalls: 1, maxSearchFeeUsd: 0.007 };

test('reserves for every possible model call and search fee', () => {
  assert.equal(calculateSearchReservation(limits), 10.043);
  assert.equal(requireAvailableSearchBudget(limits, 11, 1), 10.043);
});

test('rejects a budget that cannot cover the full request before searching', () => {
  assert.throws(() => requireAvailableSearchBudget(limits, 1, 1), /budget exceeded/);
  assert.throws(() => requireAvailableSearchBudget(limits, 20, 0), /budget exceeded/);
});

test('fails closed if provider limits are missing or invalid', () => {
  assert.throws(() => calculateSearchReservation({ ...limits, maxModelCalls: 0 }), /Verified search limits/);
  assert.throws(() => calculateSearchReservation({ ...limits, maxInputTokensPerCall: Number.POSITIVE_INFINITY }), /Verified search limits/);
  assert.throws(() => calculateSearchReservation({ ...limits, maxSearchFeeUsd: Number.NaN }), /Verified search limits/);
});

test('the pinned GLM 5.3 route reserves both turns within the default job budget', () => {
  const env = { FACT_CHECK_ENABLED: 'true', OPENROUTER_API_KEY: 'synthetic' };
  const settings = readFactCheckJobSettings(env);
  assert.ok(settings);
  assert.equal(settings.model, PINNED_GLM_53);
  assert.equal(settings.maxClaims, 2);
  assert.equal(calculateSearchReservation(settings.searchLimits, settings.model), 0.228716);
  assert.equal(readFactCheckJobSettings({ ...env, FACT_CHECK_MAX_COST_USD: '0.22' }), null);
  assert.equal(readFactCheckJobSettings({ ...env, FACT_CHECK_MODEL: 'different/model' }), null);
  assert.throws(() => requireAvailableSearchBudget(GLM_53_SEARCH_LIMITS, 0.22, 1, PINNED_GLM_53), /budget exceeded/);
});
