import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { editionWindow, selectEdition } from './2026-11-13-editions';

test('uses six local calendar days across month and daylight-saving changes', () => {
  assert.deepEqual(editionWindow(new Date('2026-11-02T00:30:00Z')), { first: '2026-10-28', last: '2026-11-02' });
  assert.deepEqual(editionWindow(new Date('2026-03-30T22:30:00Z')), { first: '2026-03-26', last: '2026-03-31' });
});

test('skips empty days, excludes older and future days, and links adjacent editions', () => {
  const data = ['2026-11-13', '2026-11-11', '2026-11-08', '2026-11-07', '2026-11-14'].map((day) => ({ publishedAt: new Date(`${day}T12:00:00Z`) }));
  const now = new Date('2026-11-13T12:00:00Z');
  const edition = selectEdition(data, '2026-11-11', now);
  assert.equal(edition.selected?.key, '2026-11-11');
  assert.equal(edition.newer?.key, '2026-11-13');
  assert.equal(edition.older?.key, '2026-11-08');
  assert.equal(selectEdition(data, '2026-11-07', now).selected?.key, '2026-11-13');
});

test('returns empty navigation when no stories occur within the window', () => {
  assert.deepEqual(selectEdition([], undefined, new Date('2026-11-13T12:00:00Z')), { selected: null, newer: null, older: null });
});
