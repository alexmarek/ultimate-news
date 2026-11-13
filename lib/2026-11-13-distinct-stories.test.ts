import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { distinctStories } from './2026-11-13-distinct-stories';

test('omits brief IDs and other reports in their clusters, while preserving independent stories', () => {
  const brief = [{ id: 'brief', clusterId: 'cluster-a' }, { id: 'unclustered', clusterId: null }];
  const stories = [brief[0], { id: 'other-report', clusterId: 'cluster-a' }, brief[1], { id: 'different', clusterId: null }];
  assert.deepEqual(distinctStories(stories, brief).map((story) => story.id), ['different']);
});

test('keeps only the first story in each cluster in the order provided', () => {
  const stories = [{ id: 'first', clusterId: 'cluster-b' }, { id: 'other', clusterId: null }, { id: 'second', clusterId: 'cluster-b' }];
  assert.deepEqual(distinctStories(stories, []).map((story) => story.id), ['first', 'other']);
});
