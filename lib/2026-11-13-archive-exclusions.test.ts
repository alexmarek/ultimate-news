import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { archiveExclusions } from './2026-11-13-archive-exclusions';

test('excludes brief stories without excluding read stories when hide-read is off', () => {
  assert.deepEqual(archiveExclusions(['brief-a', 'brief-b'], new Set(['read-a']), false), ['brief-a', 'brief-b']);
});

test('combines brief and hidden-read exclusions without duplicates', () => {
  assert.deepEqual(archiveExclusions(['brief-a', 'brief-b'], new Set(['brief-a', 'read-a']), true), ['brief-a', 'brief-b', 'read-a']);
});

test('leaves the archive unfiltered when neither exclusion applies', () => {
  assert.deepEqual(archiveExclusions([], new Set(), false), []);
});
