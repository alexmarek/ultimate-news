// lib/ai/language.ts
// Cheap check that a text is English. Used to catch a model reply that stayed in
// the source language (German, Czech, ...) when the article should have been
// translated. It compares common function words, so it needs a sentence or two.

const ENGLISH = new Set(
  'the and of to that is for with was by from are this has have be will said which their it on at as were been'.split(' '),
);
const GERMAN = new Set(
  'der die das und nicht ist mit von den dem des auf für ein eine einer sich auch wird werden nach bei im zum zur sind hat haben aus über wurde'.split(' '),
);

/** False only when the text is clearly not English. Too little text to judge counts as English. */
export function isLikelyEnglish(text: string): boolean {
  let en = 0;
  let de = 0;
  for (const w of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
    if (ENGLISH.has(w)) en++;
    if (GERMAN.has(w)) de++;
  }
  if (en + de < 3) return true;
  return en >= de * 2;
}
