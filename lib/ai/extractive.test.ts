import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractiveSummary, cleanSourceText } from '@/lib/ai/extractive';
import { countSummaryWords, parseSummary, splitSentences } from '@/lib/summary';

test('cleanSourceText removes feed boilerplate and the truncated tail', () => {
  const raw =
    'Reports have been mounting that users have seen their accounts drained. Using an embedded SIM card, the ... Read the full story at The Verge.';
  assert.equal(cleanSourceText(raw), 'Reports have been mounting that users have seen their accounts drained.');
});

test('cleanSourceText removes WordPress "appeared first on" footers', () => {
  const raw = 'A useful sentence about the topic at hand. The post Great Title appeared first on Some Blog.';
  assert.equal(cleanSourceText(raw), 'A useful sentence about the topic at hand.');
});

test('cleanSourceText cuts a headline that the feed repeats inside the same snippet', () => {
  const raw = 'U.S. News ranks diets for diabetes management each year \u2014 here are 10 top-performing approaches and how each works U.S. News ranks diets for diabetes management each year';
  assert.equal(cleanSourceText(raw), 'U.S. News ranks diets for diabetes management each year \u2014 here are 10 top-performing approaches and how each works.');
});

test('cleanSourceText keeps long articles whose opening words legitimately recur', () => {
  const body = Array.from({ length: 30 }, (_, i) => `According to the report published in March, finding number ${i} matters.`).join(' ');
  assert.equal(cleanSourceText(body), body);
});

test('identical excerpt and body without a final period are not doubled (live Quartz case)', () => {
  const snippet = 'U.S. News ranks diets for diabetes management each year \u2014 here are 10 top-performing approaches and how each works';
  const out = buildExtractiveSummary({ title: 'The best diets for people with diabetes, according to U.S. News', excerpt: snippet, content: snippet });
  assert.equal(out, `**${snippet}.**`);
});

test('excerpt that is repeated inside the body does not repeat in the summary (live-site bug)', () => {
  const excerpt = 'Critics have crowned a handful of standouts in the first half of 2026. Here are the five films with the strongest reviews.';
  const out = buildExtractiveSummary({ title: 'Best films of 2026 so far', excerpt, content: excerpt });
  const sentences = splitSentences(parseSummary(out).map((b) => (b.type === 'list' ? b.items.join(' ') : b.text)).join(' '));
  assert.equal(new Set(sentences.map((s) => s.replace(/\*/g, ''))).size, sentences.length, `repeated sentence in: ${out}`);
  assert.ok(out.startsWith('**'), 'has a bold lead');
});

test('long articles produce a lead, paragraphs and key points within 400 words', () => {
  // Distinct sentences (near-identical ones would, correctly, be collapsed by the repeat filter).
  const sentences = [
    'Health officials in Brno announced a revised vaccination schedule for the winter months.',
    'The agency recorded 1,240 new infections across the region this week, up 18% on last month.',
    'Hospital managers questioned whether staffing plans can cope with a sustained rise in admissions.',
    'Regional mayors welcomed new funding for community clinics but criticised the slow approval process.',
    'Transport planners postponed several overnight bus services to free drivers for testing sites.',
    'Pharmacy owners in northern Italy reported shortages of paediatric medicines during the past fortnight.',
    'Officials said 62 schools have already moved some classes online to limit contact between pupils.',
    'Port authorities near Rijeka defended stricter checks, arguing that inspections have been quick and proportionate.',
    'Farmers beside the Danube asked for exemptions so seasonal workers can still cross the border.',
    'Researchers at Charles University reviewed sewage data and found viral traces rising in 9 of 14 districts.',
    'Airport managers confirmed that rapid testing capacity will double before the holiday travel peak.',
    'Opposition politicians demanded a public inquiry into how supply contracts were awarded last spring.',
    'The government promised weekly updates, plain-language guidance and a dedicated helpline for care homes.',
    'Teachers unions said they would support the plan if protective equipment arrives before the end of November.',
  ];
  const out = buildExtractiveSummary({ title: 'Outbreak update', content: sentences.join(' ') });
  const blocks = parseSummary(out);
  assert.equal(blocks[0].type, 'lead');
  assert.ok(blocks.some((b) => b.type === 'paragraph'));
  assert.ok(countSummaryWords(out) <= 400);
});

test('sentences carrying figures become a "Key points" list', () => {
  const content = [
    'The central bank raised its benchmark rate to 4.25% on Thursday, the first increase in 14 months.',
    'Inflation reached 6.1% in September, well above the 2% target that policymakers have pursued since 2019.',
    'Mortgage lenders expect monthly payments to rise by about 85 euros for the average borrower.',
    'Economists at three major banks had forecast a smaller move and now expect two more rises before spring.',
    'Household savings climbed to 11.4% of income as consumers delayed large purchases.',
    'The governor said the decision was unanimous and that further steps depend on incoming wage data.',
    'Retail groups warned that discounting during the holiday season could squeeze margins by 3 points.',
    'Opposition parties called for targeted support for families with variable-rate loans.',
  ].join(' ');
  const out = buildExtractiveSummary({ title: 'Rates rise again', content });
  const blocks = parseSummary(out);
  const heading = blocks.find((b) => b.type === 'heading');
  assert.ok(heading && heading.text === 'Key points', out);
  assert.ok(blocks.some((b) => b.type === 'list'), out);
});

test('very short input yields a short summary instead of padding', () => {
  const out = buildExtractiveSummary({ title: 'Short', excerpt: 'Only one real sentence is available here.' });
  assert.equal(out, '**Only one real sentence is available here.**');
});

test('returns an empty string when there is no text at all', () => {
  assert.equal(buildExtractiveSummary({ title: 'Nothing' }), '');
});
