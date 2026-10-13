import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SUMMARY_WORDS,
  countSummaryWords,
  dedupeSentences,
  dropMetaCommentary,
  firstSentence,
  isMetaCommentary,
  leadOnlySummary,
  normalizeSummary,
  parseInline,
  parseSummary,
  splitSentences,
  summaryPreview,
  summaryToPlainText,
} from '@/lib/summary';

const STRUCTURED = `**The EU agreed a new rule on battery recycling.**

Negotiators reached a deal on Tuesday after two years of talks. The rule sets recovery targets for lithium and cobalt.

## Key points

- Targets start in 2028.
- Producers must publish recycled-content data.

## Why it matters

Recycling reduces dependence on imported minerals.`;

test('parseSummary recognises lead, paragraph, heading and list blocks', () => {
  const blocks = parseSummary(STRUCTURED);
  assert.deepEqual(blocks.map((b) => b.type), ['lead', 'paragraph', 'heading', 'list', 'heading', 'paragraph']);
  assert.equal(blocks[0].type === 'lead' && blocks[0].text, 'The EU agreed a new rule on battery recycling.');
  const list = blocks[3];
  assert.ok(list.type === 'list' && list.items.length === 2);
});

test('plain legacy summaries parse as paragraphs without a lead', () => {
  const blocks = parseSummary('First paragraph here.\nSecond paragraph here.');
  assert.deepEqual(blocks.map((b) => b.type), ['paragraph']);
});

test('a bold first paragraph with extra text is not treated as a lead', () => {
  const blocks = parseSummary('**Bold start.** And then plain text.');
  assert.equal(blocks[0].type, 'paragraph');
});

test('a complete bold opening sentence followed by text becomes the lead (live Verge case)', () => {
  const blocks = parseSummary('**Ledger says tampered hardware drained users\' wallets.** Reports have been mounting since last week.\nThe reseller paused sales.');
  assert.deepEqual(blocks.map((b) => b.type), ['lead', 'paragraph']);
  assert.equal(blocks[0].type === 'lead' && blocks[0].text, 'Ledger says tampered hardware drained users\' wallets.');
  assert.equal(blocks[1].type === 'paragraph' && blocks[1].text, 'Reports have been mounting since last week. The reseller paused sales.');
});

test('several bold opening sentences form one lead; a bold name at the start does not', () => {
  const two = parseSummary('**The central bank raised rates again today.** **Markets reacted within minutes.** Analysts expect more.');
  assert.equal(two[0].type === 'lead' && two[0].text, 'The central bank raised rates again today. Markets reacted within minutes.');
  const name = parseSummary('**Apple** announced a new laptop with a faster chip and a longer battery life.');
  assert.equal(name[0].type, 'paragraph');
});

test('lead splitting survives normalizeSummary (stored as lead + paragraph)', () => {
  const out = normalizeSummary('**The council approved the new tram line on Monday evening.** Construction starts in spring.');
  assert.equal(out, '**The council approved the new tram line on Monday evening.**\n\nConstruction starts in spring.');
});

test('meta-commentary about the supplied text is detected and removed', () => {
  assert.ok(isMetaCommentary('The excerpt provided does not contain the detailed information about each diet.'));
  assert.ok(isMetaCommentary('The snippet only lists the headline.'));
  assert.ok(!isMetaCommentary('Researchers excerpted the report and found only minor errors.'));
  const cleaned = dropMetaCommentary('**U.S. News ranks diets for diabetes management each year.**\n\nThe excerpt provided does not contain the detailed information. Ten approaches are listed.');
  assert.equal(cleaned, '**U.S. News ranks diets for diabetes management each year.**\n\nTen approaches are listed.');
});

test('leadOnlySummary keeps the lead and one paragraph and drops lists and headings', () => {
  const out = leadOnlySummary(STRUCTURED);
  assert.deepEqual(parseSummary(out).map((b) => b.type), ['lead', 'paragraph']);
  assert.equal(leadOnlySummary('**Just a lead sentence for the story today.**'), '**Just a lead sentence for the story today.**');
});

test('parseInline handles bold, italic and stray asterisks', () => {
  assert.deepEqual(parseInline('a **b** c *d* e'), [
    { text: 'a ' },
    { text: 'b', bold: true },
    { text: ' c ' },
    { text: 'd', italic: true },
    { text: ' e' },
  ]);
  assert.deepEqual(parseInline('5 * 3 = 15'), [{ text: '5 * 3 = 15' }]);
});

test('splitSentences keeps abbreviations, initials and decimals together', () => {
  const s = splitSentences('Dr. Smith met J. K. Rowling in the U.S. on 3.5 occasions. They talked. Then they left!');
  assert.deepEqual(s, ['Dr. Smith met J. K. Rowling in the U.S. on 3.5 occasions.', 'They talked.', 'Then they left!']);
});

test('dedupeSentences drops exact, contained and near-identical repeats', () => {
  const out = dedupeSentences([
    'Critics have crowned a handful of standouts in the first half of 2026.',
    'Here are the five films with the strongest reviews.',
    'Critics have crowned a handful of standouts in the first half of 2026.',
    'Here are the five films with the strongest reviews.',
    'Critics crowned a handful of standouts in the first half of 2026.',
    'Something genuinely new appears here at last.',
  ]);
  assert.deepEqual(out, [
    'Critics have crowned a handful of standouts in the first half of 2026.',
    'Here are the five films with the strongest reviews.',
    'Something genuinely new appears here at last.',
  ]);
});

test('normalizeSummary removes the repeated-excerpt pattern seen on the live site', () => {
  const raw =
    'Critics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews. ' +
    'Critics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews.';
  const out = normalizeSummary(raw);
  assert.equal(out, 'Critics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews.');
});

test('normalizeSummary drops bullets that repeat a body sentence', () => {
  const raw = `**Main point of the story is this one.**

Prices rose sharply across the region last quarter, analysts said.

## Key points

- Prices rose sharply across the region last quarter, analysts said.
- A second, genuinely different fact appears here.`;
  const out = normalizeSummary(raw);
  assert.ok(!/- Prices rose/.test(out));
  assert.ok(/- A second, genuinely different fact/.test(out));
});

test('normalizeSummary caps the summary at 400 words on a sentence boundary', () => {
  const sentence = (i: number) => `Sentence number ${i} adds a distinct fact about subject ${i} and place ${i * 7}.`;
  const body = Array.from({ length: 120 }, (_, i) => sentence(i)).join(' ');
  const out = normalizeSummary(`**Lead statement for the story.**\n\n${body}`);
  const words = countSummaryWords(out);
  assert.ok(words <= MAX_SUMMARY_WORDS, `got ${words} words`);
  assert.ok(words > MAX_SUMMARY_WORDS - 25, `cut too early: ${words} words`);
  assert.ok(/[.!?]$/.test(out), 'ends on a full sentence');
});

test('normalizeSummary drops a trailing fragment when output was truncated', () => {
  const out = normalizeSummary('**A complete lead sentence.**\n\nA complete sentence here. And a fragment that was cut of', {
    dropTrailingFragment: true,
  });
  assert.ok(out.endsWith('A complete sentence here.'));
});

test('normalizeSummary strips HTML and unbalanced emphasis', () => {
  const out = normalizeSummary('<p>Some **unbalanced text here.</p><script>alert(1)</script>');
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('**'));
});

test('normalizeSummary drops headings that have no content after them', () => {
  const out = normalizeSummary('A real paragraph with enough words to stay.\n\n## Why it matters');
  assert.ok(!out.includes('##'));
});

test('summaryPreview returns the plain lead without markup', () => {
  assert.equal(summaryPreview(STRUCTURED), 'The EU agreed a new rule on battery recycling.');
  assert.equal(summaryPreview('Just a plain old summary.'), 'Just a plain old summary.');
});

test('summaryToPlainText flattens every block', () => {
  const text = summaryToPlainText(STRUCTURED);
  assert.ok(text.startsWith('The EU agreed'));
  assert.ok(text.includes('Targets start in 2028.'));
  assert.ok(!text.includes('*') && !text.includes('#'));
});

test('firstSentence gives the first sentence of the lead without markup', () => {
  assert.equal(firstSentence(STRUCTURED), 'The EU agreed a new rule on battery recycling.');
  assert.equal(firstSentence('**The *Bundestag* passed it. It takes effect in May.**'), 'The Bundestag passed it.');
  assert.equal(firstSentence(''), '');
});
