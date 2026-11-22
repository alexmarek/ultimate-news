import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, stripHtml, STOPWORDS } from '@/lib/text';

test('decodes the basic named entities', () => {
  assert.equal(decodeEntities('&amp;'), '&');
  assert.equal(decodeEntities('&lt;'), '<');
  assert.equal(decodeEntities('&gt;'), '>');
  assert.equal(decodeEntities('&quot;'), '"');
  assert.equal(decodeEntities('&#39;'), "'");
  assert.equal(decodeEntities('&apos;'), "'");
});

test('decodes the typographic named entities', () => {
  assert.equal(decodeEntities('&mdash;'), '—');
  assert.equal(decodeEntities('&ndash;'), '–');
  assert.equal(decodeEntities('&hellip;'), '…');
  assert.equal(decodeEntities('&lsquo;'), '‘');
  assert.equal(decodeEntities('&rsquo;'), '’');
  assert.equal(decodeEntities('&ldquo;'), '“');
  assert.equal(decodeEntities('&rdquo;'), '”');
});

test('decodes decimal numeric character references', () => {
  assert.equal(decodeEntities('&#65;'), 'A');
  assert.equal(decodeEntities('&#8212;'), '—');
});

test('decodes hexadecimal character references', () => {
  assert.equal(decodeEntities('&#x41;'), 'A');
  assert.equal(decodeEntities('&#x2014;'), '—');
});

test('leaves unknown named entities and bare ampersands alone', () => {
  assert.equal(decodeEntities('&foobar;'), '&foobar;');
  assert.equal(decodeEntities('AT&T'), 'AT&T');
  assert.equal(decodeEntities('&amp'), '&amp');
});

test('decodes a mix of entity forms in one string', () => {
  assert.equal(decodeEntities('R&amp;D &#8211; &#x2014; &quot;notes&quot;'), 'R&D – — "notes"');
});

test('out-of-range numeric references are left as literal text instead of crashing', () => {
  // Per the HTML spec, a numeric reference whose code point exceeds U+10FFFF is a
  // parse error and the text is kept as-is. Regression test: decodeEntities() used to
  // throw `RangeError: Invalid code point` here, so one malformed feed text could
  // crash the whole summary path.
  assert.equal(decodeEntities('&#99999999999;'), '&#99999999999;');
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;');
});

test('removes tags and collapses whitespace', () => {
  assert.equal(stripHtml('  <p>  Hello&nbsp;&nbsp;world </p>  '), 'Hello world');
});

test('removes attributes and self-closing tags', () => {
  assert.equal(stripHtml('<div class="x"><br/><img src="z" />text</div>'), 'text');
});

test('handles an unclosed tag', () => {
  assert.equal(stripHtml('<div>text'), 'text');
});

test('decodes the entities left behind after tag removal', () => {
  assert.equal(stripHtml('&lt;b&gt;Hello &amp; world&lt;/b&gt;'), '<b>Hello & world</b>');
});

test('returns an empty string for blank or tag-only input', () => {
  assert.equal(stripHtml(''), '');
  assert.equal(stripHtml('   '), '');
  assert.equal(stripHtml('<br><hr>'), '');
});

test('keeps decoded angle brackets as literal text, not as tags', () => {
  assert.equal(stripHtml('Fish &amp; Chips &lt;3'), 'Fish & Chips <3');
});

test('contains the common function words used in scoring', () => {
  for (const word of ['the', 'a', 'an', 'and', 'or', 'of', 'to', 'is', 'was', 'said', 'says', 'i', 'it']) {
    assert.ok(STOPWORDS.has(word), word);
  }
});

test('does not contain content words', () => {
  for (const word of ['economy', 'germany', 'climate', 'pandemia']) {
    assert.ok(!STOPWORDS.has(word), word);
  }
});

test('every entry is a non-empty lowercase word', () => {
  // The set is case-sensitive on purpose: both consumers (lib/ai/extractive.ts
  // and lib/brief.ts) lowercase their tokens before looking them up.
  assert.ok([...STOPWORDS].every((w) => /^[a-z]+$/.test(w)));
  assert.equal(STOPWORDS.size, 119);
});
