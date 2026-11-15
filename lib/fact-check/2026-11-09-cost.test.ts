import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maximumRequestCost } from './2026-11-09-cost';

test('calculates a conservative cost ceiling including tool charges', () => {
  assert.ok(Math.abs(maximumRequestCost(10_000, 2_000, 0.007) - 0.087) < 1e-10);
  assert.throws(() => maximumRequestCost(-1, 1));
});
