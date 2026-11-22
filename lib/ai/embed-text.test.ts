import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBED_SUMMARY_WORDS, articleEmbedText } from '@/lib/ai/embed-text';

test('embed text is the headline followed by the plain-text start of the summary', () => {
  assert.equal(
    articleEmbedText('Headline', 'Plain paragraph one.\n\nPlain paragraph two.'),
    'Headline. Plain paragraph one. Plain paragraph two.',
  );
});

test('embed text keeps only the first 80 summary words', () => {
  const words = Array.from({ length: 200 }, (_, i) => `w${i + 1}`).join(' ');
  const text = articleEmbedText('Title', words);
  assert.equal(EMBED_SUMMARY_WORDS, 80);
  assert.equal(text, `Title. ${Array.from({ length: 80 }, (_, i) => `w${i + 1}`).join(' ')}`);
});

test('embed text is just the headline when there is no summary', () => {
  assert.equal(articleEmbedText('Only a headline', null), 'Only a headline');
  assert.equal(articleEmbedText('Only a headline', ''), 'Only a headline');
});
