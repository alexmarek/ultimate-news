import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countByCategory, dayKey, dayLabelParts, groupByDay } from '@/lib/groupByDay';

const at = (iso: string, primaryArea = 'World News') => ({ publishedAt: new Date(iso), primaryArea });

test('a late-evening UTC time already belongs to the next day in Prague', () => {
  // 23:30 UTC on 8 Nov is 00:30 CET on 9 Nov.
  assert.equal(dayKey(new Date('2026-11-08T23:30:00Z')), '2026-11-09');
  assert.equal(dayKey(new Date('2026-11-08T22:30:00Z')), '2026-11-08');
});

test('summer time is handled (CEST is UTC+2)', () => {
  assert.equal(dayKey(new Date('2026-07-14T22:30:00Z')), '2026-07-15');
  assert.equal(dayKey(new Date('2026-07-14T21:30:00Z')), '2026-07-14');
});

test('groupByDay keeps newest-first order and splits at local midnight', () => {
  const groups = groupByDay([
    at('2026-11-08T23:30:00Z'),
    at('2026-11-08T12:00:00Z'),
    at('2026-11-08T08:00:00Z'),
    at('2026-11-07T20:00:00Z'),
  ]);
  assert.deepEqual(groups.map((g) => [g.key, g.items.length]), [
    ['2026-11-09', 1],
    ['2026-11-08', 2],
    ['2026-11-07', 1],
  ]);
});

test('groupByDay on an empty list gives no groups', () => {
  assert.deepEqual(groupByDay([]), []);
});

test('dayLabelParts splits the heading into weekday, day and month', () => {
  assert.deepEqual(dayLabelParts(new Date('2026-11-08T12:00:00Z')), { weekday: 'Sunday', day: '8', month: 'November' });
});

test('countByCategory sorts by count, then name', () => {
  const counts = countByCategory([
    { primaryArea: 'Business' },
    { primaryArea: 'World News' },
    { primaryArea: 'World News' },
    { primaryArea: 'Sport' },
  ]);
  assert.deepEqual(counts, [
    { area: 'World News', count: 2 },
    { area: 'Business', count: 1 },
    { area: 'Sport', count: 1 },
  ]);
});
