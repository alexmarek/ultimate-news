import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, SOURCES_BY_ID, toSourceRecord } from '@/lib/config/sources';
import { DAILY_FEED_TARGETS, MAX_ARTICLE_AGE_DAYS, freshCutoff, visibleArticleFilter } from '@/lib/config/dailyFeed';
import { AREAS } from '@/lib/types';

const REMOVED = ['bbc-future-planet', 'thehackernews', 'dw', 'matadornetwork', 'longreads-travel'];
const ADDED: Record<string, { url: string; category: string }> = {
  'ricksteves-cameron': { url: 'https://blog.ricksteves.com/cameron/', category: 'Travel' },
  europeanbestdestinations: { url: 'https://www.europeanbestdestinations.com/', category: 'Travel' },
  zmescience: { url: 'https://www.zmescience.com/', category: 'Science' },
  'allsides-world': { url: 'https://www.allsides.com/topics/world', category: 'World News' },
  'un-climate-reports': { url: 'https://www.un.org/en/climatechange/reports', category: 'Environment' },
  nautilus: { url: 'https://nautil.us/', category: 'Positive News' },
};

test('source ids are unique', () => {
  const ids = SOURCES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every source has a valid category, a positive limit and an http(s) URL', () => {
  for (const s of SOURCES) {
    assert.ok((AREAS as readonly string[]).includes(s.category), `${s.id}: category ${s.category}`);
    assert.ok(s.limit > 0, `${s.id}: limit`);
    assert.match(s.url, /^https?:\/\//, `${s.id}: url`);
  }
});

test('removed sources are gone', () => {
  for (const id of REMOVED) assert.equal(SOURCES_BY_ID[id], undefined, id);
});

test('requested sources are configured with the requested URL and category', () => {
  for (const [id, expected] of Object.entries(ADDED)) {
    const s = SOURCES_BY_ID[id];
    assert.ok(s, `${id} missing`);
    assert.equal(s.url, expected.url, `${id}: url`);
    assert.equal(s.category, expected.category, `${id}: category`);
  }
});

test('the six new sources are scrape-only: no feed URLs configured', () => {
  for (const id of Object.keys(ADDED)) {
    assert.equal(SOURCES_BY_ID[id].scrape, true, `${id}: scrape`);
    assert.equal(SOURCES_BY_ID[id].feeds, undefined, `${id}: feeds`);
    assert.equal(toSourceRecord(SOURCES_BY_ID[id]).feedUrl, null, `${id}: feedUrl`);
    assert.equal(toSourceRecord(SOURCES_BY_ID[id]).ingestStrategy, 'html', `${id}: strategy`);
  }
});

test('category targets equal the sum of source limits', () => {
  for (const area of AREAS) {
    const sum = SOURCES.filter((s) => s.category === area).reduce((n, s) => n + s.limit, 0);
    assert.equal(DAILY_FEED_TARGETS[area], sum, area);
  }
});

test('toSourceRecord produces a DB row', () => {
  const row = toSourceRecord(SOURCES_BY_ID.theverge);
  assert.equal(row.feedUrl, 'https://www.theverge.com/rss/tech/index.xml');
  assert.equal(row.ingestStrategy, 'rss');
  assert.equal(toSourceRecord(SOURCES_BY_ID['allsides-world']).ingestStrategy, 'html');
});

test('freshness window is 14 days', () => {
  assert.equal(MAX_ARTICLE_AGE_DAYS, 14);
  const now = Date.UTC(2026, 9, 11, 12, 0, 0);
  assert.equal(freshCutoff(now).toISOString(), '2026-09-27T12:00:00.000Z');
  const filter = visibleArticleFilter(now);
  assert.equal(filter.publishedAt.gte.toISOString(), '2026-09-27T12:00:00.000Z');
  assert.ok(filter.sourceId.in.includes('zmescience'));
  assert.ok(!filter.sourceId.in.includes('dw'));
});
