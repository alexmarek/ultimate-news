import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArticle } from './2026-11-09-extraction';

const paragraph = 'This synthetic paragraph contains enough words to represent an article body in a predictable test fixture. '.repeat(5);
const fetcher = (html: string) => async () => ({ html, url: 'https://example.org/article?utm_source=test' });

test('extracts a substantial article without tracking parameters', async () => {
  const article = await extractArticle('https://example.org/article', fetcher(`<html lang="en"><head><title>Example article</title></head><body><article><p>${paragraph}</p><p>${paragraph}</p></article></body></html>`));
  assert.equal(article.canonicalUrl, 'https://example.org/article');
  assert.equal(article.title, 'Example article');
});

test('rejects short and paywalled content', async () => {
  await assert.rejects(extractArticle('https://example.org/article', fetcher('<title>Short</title><article><p>Teaser only.</p></article>')));
  await assert.rejects(extractArticle('https://example.org/article', fetcher(`<title>Paywall</title><article><p>${paragraph}</p><p>${paragraph}</p><p>Subscribe to continue</p></article>`)), /paywalled/);
});
