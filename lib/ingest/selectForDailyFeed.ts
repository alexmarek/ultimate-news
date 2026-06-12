// lib/ingest/selectForDailyFeed.ts
// Per-category selection with source variety for the daily feed.
// Pure function — no DB calls, unit-testable.

export interface CategoryFillReport {
  target: number;
  selected: number;
  shortfall: number;
  reason?: string;
  sources: Record<string, number>;
}

interface Candidate {
  articleId: string;
  canonicalUrl: string;
  primaryArea: string;
  sourceId: string;
  publishedAt: Date;
  [key: string]: unknown;
}

export function selectForDailyFeed(
  candidates: Candidate[],
  targets: Record<string, number>,
): {
  selected: Candidate[];
  categoryFill: Record<string, CategoryFillReport>;
  deduped: number;
} {
  const categoryFill: Record<string, CategoryFillReport> = {};
  const selected: Candidate[] = [];
  const seenUrls = new Set<string>();
  let deduped = 0;

  for (const [area, target] of Object.entries(targets)) {
    // Filter candidates for this category, sort by publishedAt DESC
    const pool = candidates
      .filter((c) => c.primaryArea === area)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    if (pool.length === 0) {
      categoryFill[area] = {
        target,
        selected: 0,
        shortfall: target,
        reason: 'No candidates for this category',
        sources: {},
      };
      continue;
    }

    // Group by source
    const bySource = new Map<string, Candidate[]>();
    for (const c of pool) {
      if (!bySource.has(c.sourceId)) bySource.set(c.sourceId, []);
      bySource.get(c.sourceId)!.push(c);
    }

    const sourceEntries = [...bySource.entries()];
    const maxPerSource = Math.max(1, Math.ceil(target * 0.6));

    // Round-robin: take 1 from each source per round, cap per source
    const picked: Candidate[] = [];
    const sourceCounts: Record<string, number> = {};
    let round = 0;

    while (picked.length < target) {
      let added = false;
      for (const [sourceId, articles] of sourceEntries) {
        if (picked.length >= target) break;
        const soFar = sourceCounts[sourceId] || 0;
        if (soFar >= maxPerSource) continue;
        if (round < articles.length) {
          picked.push(articles[round]);
          sourceCounts[sourceId] = soFar + 1;
          added = true;
        }
      }
      round++;
      if (!added) break;
    }

    // Fill remaining slots from any source with available articles
    if (picked.length < target) {
      for (const [, articles] of sourceEntries) {
        if (picked.length >= target) break;
        const used = new Set(picked.map((p) => p.articleId));
        for (const c of articles) {
          if (picked.length >= target) break;
          if (!used.has(c.articleId)) {
            picked.push(c);
            sourceCounts[c.sourceId] = (sourceCounts[c.sourceId] || 0) + 1;
          }
        }
      }
    }

    // Deduplicate against seen URLs (defensive)
    const deduped_picked: Candidate[] = [];
    for (const c of picked) {
      if (seenUrls.has(c.canonicalUrl)) {
        deduped++;
        continue;
      }
      seenUrls.add(c.canonicalUrl);
      deduped_picked.push(c);
    }

    selected.push(...deduped_picked);

    const sourceReport: Record<string, number> = {};
    for (const c of deduped_picked) {
      sourceReport[c.sourceId] = (sourceReport[c.sourceId] || 0) + 1;
    }

    const shortfall = target - deduped_picked.length;
    categoryFill[area] = {
      target,
      selected: deduped_picked.length,
      shortfall: Math.max(0, shortfall),
      reason: shortfall > 0
        ? pool.length < target
          ? `Only ${pool.length} candidates available`
          : 'Selection capped by source variety or dedup'
        : undefined,
      sources: sourceReport,
    };
  }

  return { selected, categoryFill, deduped };
}
