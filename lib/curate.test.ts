import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCurated } from '@/lib/curate';

const c = (sourceId: string, score: number | null, day: number) => ({ sourceId, score, publishedAt: new Date(Date.UTC(2026, 9, day)), id: `${sourceId}-${score}-${day}` });

test('pickCurated takes the best scores, at most two per source while others are available', () => {
  const picked = pickCurated(
    [c('a', 5, 1), c('a', 5, 2), c('a', 5, 3), c('b', 4, 1), c('c', 2, 1), c('d', 3, 1), c('e', null, 9)],
    4,
    2,
  );
  // Newest first among equal scores; the third 'a' is left out for 'd' despite its higher score.
  assert.deepEqual(picked.map((p) => p.id), ['a-5-3', 'a-5-2', 'b-4-1', 'd-3-1']);
});

test('pickCurated fills past the per-source cap when there are not enough sources', () => {
  const picked = pickCurated([c('a', 5, 1), c('a', 4, 2), c('a', 3, 3), c('b', 2, 1), c('b', null, 5)], 4, 1);
  assert.deepEqual(picked.map((p) => p.id), ['a-5-1', 'b-2-1', 'a-4-2', 'a-3-3']);
});

test('pickCurated returns everything when the pool is smaller than the pick count', () => {
  assert.equal(pickCurated([c('a', 3, 1), c('b', null, 1)], 6, 2).length, 2);
});
