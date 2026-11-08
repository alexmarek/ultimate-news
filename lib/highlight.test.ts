import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitByMatches } from '@/lib/highlight';

test('wraps a case-insensitive match and keeps the surrounding text', () => {
  assert.deepEqual(splitByMatches("Merz poised to nominate Germany's first woman president", 'germany'), [
    { text: 'Merz poised to nominate ', match: false },
    { text: 'Germany', match: true },
    { text: "'s first woman president", match: false },
  ]);
});

test('highlights every word of a multi-word query', () => {
  const parts = splitByMatches('Millions of young people in Germany', 'young germany');
  assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), ['young', 'Germany']);
});

test('returns the whole text as one plain part when nothing matches', () => {
  assert.deepEqual(splitByMatches('Shares rally', 'zzz'), [{ text: 'Shares rally', match: false }]);
});

test('an empty query or empty text highlights nothing', () => {
  assert.deepEqual(splitByMatches('Shares rally', ''), [{ text: 'Shares rally', match: false }]);
  assert.deepEqual(splitByMatches('', 'rally'), [{ text: '', match: false }]);
});

test('single-letter words are ignored', () => {
  assert.deepEqual(splitByMatches('A day at the sea', 'a'), [{ text: 'A day at the sea', match: false }]);
});

test('regex characters in the query are matched literally', () => {
  assert.deepEqual(splitByMatches('Why C++ (still) matters', 'c++ (still)'), [
    { text: 'Why ', match: false },
    { text: 'C++', match: true },
    { text: ' ', match: false },
    { text: '(still)', match: true },
    { text: ' matters', match: false },
  ]);
});
