import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBrief } from '@/lib/brief';

const a = (id: string, primaryArea: string, importance: number | null, day: number) => ({ id, primaryArea, importance, publishedAt: new Date(Date.UTC(2026, 9, day)) });

test('the brief takes the most important stories, newest first on ties, max 2 per category, skips minor ones', () => {
  const picked = pickBrief([
    a('w1', 'World News', 5, 10), a('w2', 'World News', 5, 12), a('w3', 'World News', 5, 11),
    a('b1', 'Business', 4, 12), a('s1', 'Science', 4, 9), a('t1', 'Travel', 2, 12),
    a('e1', 'Environment', 3, 12), a('x1', 'Business', null, 12), a('e2', 'Environment', 3, 8),
  ]);
  assert.deepEqual(picked.map((p) => p.id), ['w2', 'w3', 'b1', 's1', 'e1']);
});
