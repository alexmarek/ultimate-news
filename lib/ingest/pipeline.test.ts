// Exercises the collect step against a local HTTP server that serves synthetic
// RSS and HTML fixtures (no network, no database). It verifies the pipeline
// logic — age filter before limit, feed fallback, auto-discovery, scraping and
// error reporting — not the real feeds of any website.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { collectFromSource } from '@/lib/ingest/pipeline';
import type { SourceDef } from '@/lib/config/sources';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

function rss(items: Array<{ title: string; days: number }>): string {
  const body = items
    .map(
      (i) => `<item><title>${i.title}</title><link>http://example.test/${encodeURIComponent(i.title)}</link>
      <pubDate>${ago(i.days).toUTCString()}</pubDate><description>About ${i.title}.</description></item>`,
    )
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${body}</channel></rss>`;
}

function article(title: string, days: number | null): string {
  const ld = days === null ? '' : `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"${ago(days).toISOString()}"}</script>`;
  return `<html><head><meta property="og:title" content="${title}"><meta property="og:description" content="Summary of ${title}.">${ld}</head>
    <body><article><p>${`${title} paragraph with enough words to count as body text. `.repeat(6)}</p></article></body></html>`;
}

let server: http.Server;
let base: string;

before(async () => {
  const routes: Record<string, [string, string]> = {
    // Three stale items first, then four fresh ones.
    '/stale-head.xml': ['application/xml', rss([
      { title: 'Stale A', days: 40 }, { title: 'Stale B', days: 30 }, { title: 'Stale C', days: 20 },
      { title: 'Fresh 1', days: 1 }, { title: 'Fresh 2', days: 3 }, { title: 'Fresh 3', days: 5 }, { title: 'Fresh 4', days: 9 },
    ])],
    '/discovered.xml': ['application/xml', rss([{ title: 'Discovered', days: 2 }])],
    '/home': ['text/html', '<html><head><link rel="alternate" type="application/rss+xml" href="/discovered.xml"></head><body></body></html>'],
    '/listing': ['text/html', `<html><body>
      <nav><h2><a href="/a/menu-page">Menu page</a></h2></nav>
      <main>
        <h2><a href="/a/fresh-one">Fresh one</a></h2>
        <h2><a href="/a/old-one">Old one</a></h2>
        <h2><a href="/a/undated">Undated page</a></h2>
        <h2><a href="/a/fresh-two">Fresh two</a></h2>
      </main></body></html>`],
    '/a/fresh-one': ['text/html', article('Fresh one', 2)],
    '/a/old-one': ['text/html', article('Old one', 30)],
    '/a/undated': ['text/html', article('Undated page', null)],
    '/a/fresh-two': ['text/html', article('Fresh two', 6)],
    '/a/menu-page': ['text/html', article('Menu page', 1)],
  };
  server = http.createServer((req, res) => {
    const hit = routes[req.url ?? ''];
    if (!hit) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': hit[0] }).end(hit[1]);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

const def = (over: Partial<SourceDef>): SourceDef => ({
  id: 'test',
  name: 'Test',
  url: `${base}/home`,
  category: 'Travel',
  limit: 2,
  contentKind: 'travel',
  tier: 'tier-2',
  weight: 0.8,
  ...over,
});

test('items older than 14 days are dropped before the limit is applied', async () => {
  const result = await collectFromSource(def({ feeds: [`${base}/stale-head.xml`], limit: 2 }));
  assert.equal(result.method, 'feed');
  assert.equal(result.seen, 7);
  assert.equal(result.skippedOld, 3);
  assert.deepEqual(result.articles.map((a) => a.title), ['Fresh 1', 'Fresh 2']);
  assert.ok(result.articles.every((a) => Date.now() - a.publishedAt.getTime() <= 14 * DAY));
});

test('a broken known feed falls back to auto-discovery from the site page', async () => {
  const result = await collectFromSource(def({ feeds: [`${base}/missing.xml`] }));
  assert.equal(result.method, 'feed');
  assert.equal(result.feedUrl, `${base}/discovered.xml`);
  assert.deepEqual(result.articles.map((a) => a.title), ['Discovered']);
  assert.equal(result.error, undefined);
});

test('without a feed, scraping keeps only dated, fresh articles (newest first) and skips navigation', async () => {
  const result = await collectFromSource(def({ url: `${base}/listing`, scrape: true, limit: 5 }));
  assert.equal(result.method, 'scrape');
  assert.deepEqual(result.articles.map((a) => a.title), ['Fresh one', 'Fresh two']);
  assert.ok(result.articles[0].content && result.articles[0].content.length > 200, 'body text captured');
  assert.equal(result.articles[0].excerpt, 'Summary of Fresh one.');
});

test('scraping respects the per-source limit', async () => {
  const result = await collectFromSource(def({ url: `${base}/listing`, scrape: true, limit: 1 }));
  assert.deepEqual(result.articles.map((a) => a.title), ['Fresh one']);
});

test('a source with no feed and no scrape fallback reports an error and no articles', async () => {
  const result = await collectFromSource(def({ url: `${base}/nothing`, feeds: [`${base}/missing.xml`] }));
  assert.equal(result.method, null);
  assert.equal(result.articles.length, 0);
  assert.match(result.error ?? '', /missing\.xml/);
});
