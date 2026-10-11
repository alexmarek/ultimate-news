import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, enrichArticle, isSnippet, parseResponse } from '@/lib/ai/enrich';
import { countSummaryWords, parseSummary } from '@/lib/summary';

const GOOD_REPLY = `<metadata>
{"areas": [{"area": "Technology", "confidence": 0.92}], "topics": ["Ledger", "hardware wallets", "supply-chain attack"], "entities": ["Ledger", "CryptoBillis"], "titleEn": null, "incomplete": false}
</metadata>
<summary>
**Ledger says tampered hardware sold by a reseller drained users' crypto wallets.**

Reports of emptied accounts have been mounting, and Ledger confirmed that one affected device held an unauthorised hardware implant. The reseller has been asked to pause all sales while an investigation runs.

## Key points

- Photos and videos show a small circuit board sandwiched under the screen.
- The implant allegedly intercepts the seed phrase displayed during setup.
- Ledger asked the reseller to stop selling its wallets.

## Why it matters

Buying hardware wallets only from the manufacturer reduces this kind of risk.
</summary>`;

test('parseResponse reads metadata and a structured summary', () => {
  const parsed = parseResponse(GOOD_REPLY);
  assert.ok(parsed);
  assert.deepEqual(parsed.areas, [{ area: 'Technology', confidence: 0.92 }]);
  assert.deepEqual(parsed.topics, ['Ledger', 'hardware wallets', 'supply-chain attack']);
  assert.equal(parsed.titleEn, null);
  assert.deepEqual(parseSummary(parsed.summary).map((b) => b.type), ['lead', 'paragraph', 'heading', 'list', 'heading', 'paragraph']);
});

test('parseResponse still returns the summary when the metadata JSON is malformed', () => {
  const parsed = parseResponse(GOOD_REPLY.replace('"confidence": 0.92}]', '"confidence": 0.92}'));
  assert.ok(parsed);
  assert.deepEqual(parsed.areas, []);
  assert.ok(countSummaryWords(parsed.summary) > 20);
});

test('parseResponse enforces the 400-word cap even if the model overshoots', () => {
  const long = Array.from({ length: 150 }, (_, i) => `Distinct point number ${i} concerns subject ${i * 3} and region ${i * 5}.`).join(' ');
  const parsed = parseResponse(`<metadata>{}</metadata><summary>**Lead sentence for the long story.**\n\n${long}</summary>`);
  assert.ok(parsed);
  assert.ok(countSummaryWords(parsed.summary) <= 400);
});

test('parseResponse removes sentences the model repeated', () => {
  const parsed = parseResponse(
    '<metadata>{}</metadata><summary>**Critics have crowned a handful of standouts in the first half of 2026.**\n\nCritics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews.</summary>',
  );
  assert.ok(parsed);
  assert.equal(parsed.summary.split('Critics have crowned').length - 1, 1);
});

test('parseResponse handles a reply cut off at max_tokens (unclosed summary)', () => {
  const parsed = parseResponse('<metadata>{}</metadata><summary>**A complete lead sentence about the story.**\n\nA full second sentence follows here. And this one was cut o', true);
  assert.ok(parsed);
  assert.ok(parsed.summary.endsWith('A full second sentence follows here.'));
});

test('parseResponse rejects replies with no usable summary', () => {
  assert.equal(parseResponse('Sorry, I cannot help with that.'), null);
  assert.equal(parseResponse('<metadata>{}</metadata><summary>Too short.</summary>'), null);
});

// What the model actually returned for the Quartz snippet (headline only) before the snippet rule existed.
const QUARTZ_REPLY = `<metadata>{"areas": [{"area": "Science", "confidence": 0.6}], "topics": ["diabetes"], "entities": ["U.S. News"], "titleEn": null, "incomplete": true}</metadata>
<summary>
**U.S. News ranks diets for diabetes management each year, listing 10 top-performing approaches.**

The excerpt provided does not contain the detailed information about how each approach works.

## Key points

- U.S. News publishes an annual ranking of diets.
- Ten approaches are listed for diabetes management.

## Why it matters

Diet plays a central role in managing diabetes.
</summary>`;

test('snippet replies keep only the lead: no meta-commentary, key points or invented context', () => {
  const parsed = parseResponse(QUARTZ_REPLY, false, true);
  assert.ok(parsed);
  assert.equal(parsed.summary, '**U.S. News ranks diets for diabetes management each year, listing 10 top-performing approaches.**');
  assert.ok(!/excerpt/i.test(parsed.summary));
});

test('full-article replies drop meta-commentary but keep their structure', () => {
  const parsed = parseResponse(QUARTZ_REPLY.replace('the detailed information about how each approach works', 'the detailed information'), false, false);
  assert.ok(parsed);
  assert.ok(!/excerpt/i.test(parsed.summary));
  assert.deepEqual(parseSummary(parsed.summary).map((b) => b.type), ['lead', 'heading', 'list', 'heading', 'paragraph']);
});

test('isSnippet / buildPrompt flag short texts so the prompt applies the snippet rule', () => {
  const short = { sourceName: 'Quartz', sourceLang: 'en', title: 'T', excerpt: 'Only a headline-length snippet here.' };
  assert.ok(isSnippet(short));
  assert.ok(buildPrompt(short).includes('Text type: SNIPPET'));
  const long = { ...short, content: Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ') };
  assert.ok(!isSnippet(long));
  assert.ok(buildPrompt(long).includes('Text type: full article text'));
});

test('buildPrompt substitutes article text literally ($ patterns and {placeholders} are not interpreted)', () => {
  const prompt = buildPrompt({
    sourceName: 'Test Source',
    sourceLang: 'en',
    title: 'Costs rise {content}',
    excerpt: 'Prices hit $& and $$ today.',
    content: 'Body mentions $1.1 billion and {title}.',
  });
  assert.ok(prompt.includes('Title: Costs rise {content}'));
  assert.ok(prompt.includes('Excerpt: Prices hit $& and $$ today.'));
  assert.ok(prompt.includes('Text: Body mentions $1.1 billion and {title}.'));
  assert.ok(prompt.includes('at most 400 words'));
  assert.ok(prompt.includes('"Science"'), 'Science is a valid category');
});

test('without an API key, enrichArticle falls back and says so', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await enrichArticle({
      sourceName: 'Quartz',
      sourceLang: 'en',
      title: 'Best films of 2026',
      excerpt: 'Critics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews.',
      content: 'Critics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews.',
    });
    assert.equal(result.engine, 'fallback');
    assert.match(result.fallbackReason ?? '', /ANTHROPIC_API_KEY/);
    assert.equal(result.summary.split('Critics have crowned').length - 1, 1, 'no repeated sentence');
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
