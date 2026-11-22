// lib/ai/embed-text.ts
// The text that is embedded for story grouping: the (English) headline plus the start of the summary.
// The similarity threshold in lib/dedup/cluster.ts was calibrated on exactly this text, so every place
// that embeds an article (the ingest and the backfill scripts) must build it here.

import { summaryToPlainText } from '@/lib/summary';

export const EMBED_SUMMARY_WORDS = 80;

export function articleEmbedText(title: string, summary: string | null | undefined): string {
  const start = summaryToPlainText(summary ?? '').split(/\s+/).slice(0, EMBED_SUMMARY_WORDS).join(' ');
  return [title, start].filter(Boolean).join('. ');
}
