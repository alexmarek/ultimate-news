import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, SOURCES_BY_ID, toSourceRecord } from '@/lib/config/sources';
import { DAILY_FEED_TARGETS, MAX_ARTICLE_AGE_DAYS, freshCutoff, visibleArticleFilter } from '@/lib/config/dailyFeed';
import { AREAS } from '@/lib/types';

const REMOVED = ['bbc-future-planet', 'thehackernews', 'dw', 'matadornetwork', 'longreads-travel', 'europeanbestdestinations', 'japantoday', 'allsides-world', 'japantimes', 'qz', 'insideclimatenews'];
const ADDED: Record<string, { url: string; category: string }> = {
  'ricksteves-cameron': { url: 'https://blog.ricksteves.com/cameron/', category: 'Travel' },
  zmescience: { url: 'https://www.zmescience.com/', category: 'Science' },
  'un-climate-reports': { url: 'https://news.un.org/en/news/topic/climate-change', category: 'Environment' },
  nautilus: { url: 'https://nautil.us/', category: 'Science' },
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

test('News On Japan uses the requested RSS feed', () => {
  assert.deepEqual(SOURCES_BY_ID.newsonjapan.feeds, ['https://newsonjapan.com/rss/top.xml']);
  assert.equal(SOURCES_BY_ID.newsonjapan.category, 'World News');
});

test('daily quotas: world news is the largest section, travel is small, no music or sport', () => {
  assert.equal(DAILY_FEED_TARGETS['World News'], 14);
  assert.equal(DAILY_FEED_TARGETS.Business, 6);
  assert.equal(DAILY_FEED_TARGETS.Travel, 4);
  assert.equal(DAILY_FEED_TARGETS.Music, 0);
  assert.equal(DAILY_FEED_TARGETS.Sport, 0);
  assert.equal(DAILY_FEED_TARGETS.Environment, 4);
  assert.ok(SOURCES_BY_ID.tagesschau.excludeUrl?.test('https://www.sportschau.de/regional/wdr/x-100.html'));
  assert.ok(!SOURCES_BY_ID.tagesschau.excludeUrl?.test('https://www.tagesschau.de/ausland/x-100.html'));
  for (const t of ['tagesthemen', 'tagesschau in 100 Sekunden', 'Wirtschaft vor acht vom 13.10.2026']) {
    assert.ok(SOURCES_BY_ID.tagesschau.excludeTitle?.test(t), t);
  }
  assert.ok(!SOURCES_BY_ID.tagesschau.excludeTitle?.test('tagesschau-Recherche: Wie die Bahn ihre Pünktlichkeit schönrechnet'));
  // German sources are translated.
  for (const id of ['faz', 'tagesschau', 'tagesschau-wirtschaft']) assert.equal(SOURCES_BY_ID[id].lang, 'de', id);
});

test('FAZ.NET is a German-language World News source read from its RSS feed (its pages block server-side requests)', () => {
  const faz = SOURCES_BY_ID.faz;
  assert.ok(faz, 'faz missing');
  assert.equal(faz.category, 'World News');
  assert.deepEqual(faz.feeds, ['https://www.faz.net/rss/aktuell/politik/']);
  assert.equal(faz.scrape, undefined);
  assert.equal(toSourceRecord(faz).lang, 'de');
  assert.equal(toSourceRecord(SOURCES_BY_ID.theverge).lang, 'en');
  assert.equal(SOURCES_BY_ID['faz-rss'], undefined, 'temporary probe source removed');
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
  assert.equal(toSourceRecord(SOURCES_BY_ID.zmescience).ingestStrategy, 'html');
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
