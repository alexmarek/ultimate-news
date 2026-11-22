import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunk } from '@/lib/batches';

test('chunk splits into consecutive batches and every item appears exactly once', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const batches = chunk(items, 10);
  assert.deepEqual(batches.map((b) => b.length), [10, 10, 5]);
  assert.deepEqual(batches.flat(), items);
});

test('chunk of nothing is nothing, and an oversized batch holds everything', () => {
  assert.deepEqual(chunk([], 10), []);
  assert.deepEqual(chunk([1, 2, 3], 10), [[1, 2, 3]]);
});

test('chunk rejects a batch size that would never advance', () => {
  for (const size of [0, -1, 1.5, Number.NaN]) assert.throws(() => chunk([1], size), RangeError, String(size));
});
