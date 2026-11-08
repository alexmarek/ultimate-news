import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS } from '@/lib/types';
import {
  PALETTE_HEX,
  categoryColor,
  categoryColorVar,
  categoryHex,
  categoryShortLabel,
  categoryStyle,
} from '@/lib/categoryColor';

test('known categories map to their palette colour variable', () => {
  assert.equal(categoryColorVar('World News'), '--cat-world');
  assert.equal(categoryColorVar('Environment'), '--cat-environment');
  assert.equal(categoryColorVar('Business'), '--cat-business');
  assert.equal(categoryColorVar('Technology'), '--cat-tech');
  assert.equal(categoryColorVar('Science'), '--cat-science');
  assert.equal(categoryColorVar('Travel'), '--cat-travel');
  assert.equal(categoryColorVar('Sport'), '--cat-sport');
});

test('lookup ignores case and surrounding whitespace, and accepts the short spellings', () => {
  assert.equal(categoryColorVar('  world news '), '--cat-world');
  assert.equal(categoryColorVar('TECH'), '--cat-tech');
  assert.equal(categoryColorVar('world'), '--cat-world');
});

test('Music, Positive News and unknown or missing categories use the fallback instead of breaking', () => {
  for (const area of ['Music', 'Positive News', 'Underwater Basket Weaving', '', null, undefined]) {
    assert.equal(categoryColorVar(area), '--cat-fallback');
    assert.equal(categoryColor(area), 'var(--cat-fallback)');
    assert.equal(categoryHex(area), PALETTE_HEX.beige);
  }
});

test('every stored category resolves to one of the five palette colours', () => {
  const palette = new Set<string>(Object.values(PALETTE_HEX));
  for (const area of AREAS) assert.ok(palette.has(categoryHex(area)), area);
});

test('categoryStyle sets the --cat custom property', () => {
  assert.deepEqual(categoryStyle('Travel'), { '--cat': 'var(--cat-travel)' });
});

test('long category names get a short label, others are unchanged', () => {
  assert.equal(categoryShortLabel('World News'), 'World');
  assert.equal(categoryShortLabel('Technology'), 'Tech');
  assert.equal(categoryShortLabel('Business'), 'Business');
  assert.equal(categoryShortLabel('Positive News'), 'Positive News');
  assert.equal(categoryShortLabel(null), '');
});
