// These tests use small synthetic HTML snippets that follow common markup
// conventions (JSON-LD, Open Graph, <time>). They check the extraction logic,
// not the real markup of any particular website.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractListingLinks, extractPageMeta, extractPublishedAt } from '@/lib/ingest/pageMeta';
import { mapPool } from '@/lib/ingest/pool';

const load = (html: string) => cheerio.load(html);

test('publish date: JSON-LD (including @graph) wins', () => {
  const $ = load(`<head><script type="application/ld+json">
    {"@graph":[{"@type":"WebSite"},{"@type":"NewsArticle","datePublished":"2026-10-08T09:30:00+02:00"}]}
  </script><meta property="article:published_time" content="2020-01-01T00:00:00Z"></head>`);
  assert.equal(extractPublishedAt($, 'https://example.org/a')?.toISOString(), '2026-10-08T07:30:00.000Z');
});

test('publish date: falls back to meta tags, then <time>, then the URL', () => {
  assert.equal(
    extractPublishedAt(load('<meta property="article:published_time" content="2026-10-01T10:00:00Z">'), 'https://example.org/a')?.toISOString(),
    '2026-10-01T10:00:00.000Z',
  );
  assert.equal(
    extractPublishedAt(load('<article><time datetime="2026-09-30T08:00:00Z">Sept 30</time></article>'), 'https://example.org/a')?.toISOString(),
    '2026-09-30T08:00:00.000Z',
  );
  assert.equal(
    extractPublishedAt(load('<p>no date markup</p>'), 'https://example.org/news/2026-10-05/some-story')?.toISOString(),
    '2026-10-05T00:00:00.000Z',
  );
});

test('publish date: undated, malformed and implausible dates yield null', () => {
  assert.equal(extractPublishedAt(load('<p>nothing</p>'), 'https://example.org/reports'), null);
  assert.equal(extractPublishedAt(load('<meta property="article:published_time" content="not a date">'), 'https://example.org/a'), null);
  assert.equal(extractPublishedAt(load('<meta property="article:published_time" content="1970-01-01T00:00:00Z">'), 'https://example.org/a'), null);
  assert.equal(extractPublishedAt(load('<meta property="article:published_time" content="2099-01-01T00:00:00Z">'), 'https://example.org/a'), null);
});

test('page meta: Open Graph title, description and absolute image URL', () => {
  const $ = load(`<head>
    <meta property="og:title" content="A Headline">
    <meta property="og:description" content="A short description.">
    <meta property="og:image" content="/img/hero.jpg">
    <meta name="author" content="Jane Doe">
  </head>`);
  const meta = extractPageMeta($, 'https://example.org/story');
  assert.equal(meta.title, 'A Headline');
  assert.equal(meta.description, 'A short description.');
  assert.equal(meta.image, 'https://example.org/img/hero.jpg');
  assert.equal(meta.author, 'Jane Doe');
});

test('listing links: heading links kept; nav, footer, assets, homepage and duplicates dropped', () => {
  const $ = load(`
    <body>
      <nav><a href="/about-us-and-our-mission-statement">About us and our mission</a></nav>
      <main>
        <article><h2><a href="/news/story-one">Story one</a></h2></article>
        <article><h3><a href="/news/story-two">Story two</a></h3><a href="/news/story-two">Story two again, longer text here</a></article>
        <ul><li><a href="/reports/annual-report-2026">The annual climate report for 2026</a></li></ul>
        <a href="/img/chart.png">A chart image link in a heading-less place</a>
        <h2><a href="/">Home</a></h2>
        <a href="/random-short">More</a>
      </main>
      <footer><h4><a href="/privacy">Privacy</a></h4></footer>
    </body>`);
  const links = extractListingLinks($, 'https://example.org/topics/world', 10);
  assert.deepEqual(links.map((l) => l.url), [
    'https://example.org/news/story-one',
    'https://example.org/news/story-two',
    'https://example.org/reports/annual-report-2026',
  ]);
});

test('listing links: respects the maximum', () => {
  const items = Array.from({ length: 30 }, (_, i) => `<h2><a href="/s/${i}">Story ${i}</a></h2>`).join('');
  assert.equal(extractListingLinks(load(`<main>${items}</main>`), 'https://example.org/', 5).length, 5);
});

test('mapPool keeps input order and never exceeds the concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const out = await mapPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5 * (9 - n)));
    active--;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14, 16]);
  assert.ok(peak <= 3, `peak concurrency ${peak}`);
});
