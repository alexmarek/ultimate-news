import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from './2026-11-09-job-state';

test('only completed reports can be published', () => {
  assert.equal(canTransition('ready-for-review', 'published'), true);
  assert.equal(canTransition('researching', 'published'), false);
  assert.equal(canTransition('failed', 'published'), false);
});

test('failed jobs may be queued for retry', () => {
  assert.equal(canTransition('failed', 'queued'), true);
  assert.equal(canTransition('published', 'queued'), false);
});
