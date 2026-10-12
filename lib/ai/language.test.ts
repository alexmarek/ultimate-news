import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyEnglish } from '@/lib/ai/language';

test('English text passes, including German names and quoted terms', () => {
  assert.ok(isLikelyEnglish('The government said that the reform of the pension system will be debated in the Bundestag, according to Chancellor Merz.'));
  assert.ok(isLikelyEnglish('The coalition agreed on the so-called *Bürgergeld* overhaul, which has been criticised by the opposition.'));
});

test('German text is rejected', () => {
  assert.ok(!isLikelyEnglish('Die Bundesregierung hat sich auf eine Reform der Rente geeinigt, die von der Opposition nicht mitgetragen wird.'));
});

test('very short text cannot be judged and counts as English', () => {
  assert.ok(isLikelyEnglish('Merz in Brüssel'));
});
