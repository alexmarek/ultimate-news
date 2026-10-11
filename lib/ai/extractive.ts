// lib/ai/extractive.ts
// Fallback summariser used when Claude is unavailable (no API key, API error,
// unparsable reply or the ingest time budget is spent).
//
// It is extractive: it selects the most informative sentences of the article's
// own text and lays them out in the standard summary format (bold lead,
// paragraphs, optional "Key points" list). It never invents text and never
// repeats a sentence. Quality is below an LLM summary, which is why the ingest
// report counts how many articles used it.

import { stripHtml } from '@/lib/text';
import {
  countWords,
  dedupeSentences,
  normalizeSummary,
  repeatsText,
  splitSentences,
} from '@/lib/summary';

const BOILERPLATE: RegExp[] = [
  /\bRead the full (?:story|article|post)\b[^.!?]*[.!?]?/gi,
  /\bThe post\b.{0,200}?\bappeared first on\b[^.!?]*[.!?]?/gi,
  /\b(?:Continue|Keep) reading\b[^.!?]*[.!?]?/gi,
  /\bRead more\b[^.!?]*[.!?]?/gi,
  /\bClick here\b[^.!?]*[.!?]?/gi,
  /\[(?:…|\.\.\.)\]/g,
  /\b(?:Sign up|Subscribe)\b[^.!?]*(?:newsletter|updates|free)[^.!?]*[.!?]/gi,
];

const NOISE_SENTENCE = /^(?:photo|photograph|image|credit|advertisement|related|read also|sign up|subscribe|follow us|share this|copyright|all rights reserved)\b/i;

const STOPWORDS = new Set(
  ('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just may me more most my no nor not of off on once only or other our out over own said says same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your')
    .split(' '),
);

/**
 * Some feeds give the headline followed by the start of the same text again
 * ("Title words ... Title words ..."). For short snippets, cut at the echo.
 * Long texts are left alone: a repeated opening there is legitimate prose.
 */
export function dropEchoedStart(text: string): string {
  const words = text.split(' ');
  if (words.length < 14 || words.length > 80) return text;
  const opening = words.slice(0, 6).join(' ').toLowerCase();
  for (let i = 8; i <= words.length - 6; i++) {
    if (words.slice(i, i + 6).join(' ').toLowerCase() === opening) {
      const cut = words.slice(0, i).join(' ').trim();
      return /[.!?]["'\u201D\u2019)\]]*$/.test(cut) ? cut : `${cut}.`;
    }
  }
  return text;
}

/** Strips feed boilerplate and drops a tail that the feed cut off mid-sentence. */
export function cleanSourceText(raw: string): string {
  let text = stripHtml(raw);
  for (const re of BOILERPLATE) text = text.replace(re, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  // "…the sentence was cut off ..." — remove the ellipsis and the incomplete sentence it ended.
  if (/(?:…|\.\.\.)\s*$/.test(text)) {
    text = text.replace(/\s*(?:…|\.\.\.)\s*$/, '');
    const sentences = splitSentences(text);
    if (sentences.length && !/[.!?]["'”’)\]]*$/.test(sentences[sentences.length - 1])) {
      sentences.pop();
      text = sentences.join(' ');
    }
  }
  return dropEchoedStart(text);
}

function tokenize(sentence: string): string[] {
  return sentence.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function pickSentences(sentences: string[], wordBudget: number): number[] {
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of tokenize(s)) if (!STOPWORDS.has(w) && w.length > 2) freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  const scored = sentences.map((s, index) => {
    const words = tokenize(s);
    const content = words.filter((w) => !STOPWORDS.has(w) && w.length > 2);
    let score = content.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.pow(Math.max(words.length, 1), 0.6);
    if (index === 0) score *= 3;
    else if (index < Math.ceil(sentences.length * 0.2)) score *= 1.4;
    if (/\d/.test(s)) score *= 1.15;
    return { index, score, words: words.length };
  });

  const chosen = new Set<number>([0]);
  let used = scored[0].words;
  for (const s of [...scored].sort((a, b) => b.score - a.score)) {
    if (chosen.has(s.index)) continue;
    if (used + s.words > wordBudget) continue;
    chosen.add(s.index);
    used += s.words;
  }
  return [...chosen].sort((a, b) => a - b);
}

export interface ExtractiveInput {
  title: string;
  excerpt?: string;
  content?: string;
}

export function buildExtractiveSummary({ title, excerpt = '', content = '' }: ExtractiveInput): string {
  const body = cleanSourceText(content);
  const lede = cleanSourceText(excerpt);
  // The feed excerpt is normally the start of the body: only use both when the body is short,
  // and never twice when one contains the other (some feeds put the same snippet in both fields).
  let text: string;
  if (body.length >= 200) text = body;
  else if (lede && body.includes(lede)) text = body;
  else if (body && lede.includes(body)) text = lede;
  else text = `${lede} ${body}`.trim();
  text = dropEchoedStart(text);
  // A snippet that is just a headline has no final period; give the lead one.
  if (text && !/[.!?]["'\u201D\u2019)\]]*$/.test(text)) text = `${text}.`;

  const sentences = dedupeSentences(splitSentences(text)).filter((s) => {
    const words = countWords(s);
    return words >= 5 && words <= 90 && !NOISE_SENTENCE.test(s) && !repeatsText(s, title);
  });

  if (sentences.length === 0) {
    const words = (lede || body).split(/\s+/).filter(Boolean).slice(0, 60);
    return words.length ? normalizeSummary(`**${words.join(' ')}**`) : '';
  }

  const totalWords = sentences.reduce((sum, s) => sum + countWords(s), 0);
  const budget = totalWords <= 90 ? totalWords : Math.min(300, Math.max(90, Math.round(totalWords * 0.4)));
  const picked = pickSentences(sentences, budget).map((i) => sentences[i]);

  // Lead: the first sentence, plus the second if the first is very short.
  const lead = [picked[0]];
  let rest = picked.slice(1);
  if (countWords(lead[0]) < 14 && rest.length > 1) lead.push(rest.shift() as string);

  // Sentences that carry figures read well as key points.
  const numeric = rest.filter((s) => /\d/.test(s) && countWords(s) <= 40);
  const keyPoints = numeric.length >= 2 ? numeric.slice(0, 4) : [];
  if (keyPoints.length) rest = rest.filter((s) => !keyPoints.includes(s));

  const paragraphs: string[] = [];
  for (let i = 0; i < rest.length; i += 3) paragraphs.push(rest.slice(i, i + 3).join(' '));

  const parts = [`**${lead.join(' ')}**`, ...paragraphs];
  if (keyPoints.length) parts.push(`## Key points\n${keyPoints.map((k) => `- ${k}`).join('\n')}`);
  return normalizeSummary(parts.join('\n\n'));
}
