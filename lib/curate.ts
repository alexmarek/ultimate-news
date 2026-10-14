// lib/curate.ts
// The daily pick for curated categories (Travel): the best-rated candidates,
// with a cap per source so one prolific site cannot fill the whole section.

export interface CurateCandidate {
  sourceId: string;
  /** Claude's 1-5 rating; null when the fallback summariser was used (unrated). */
  score: number | null;
  publishedAt: Date;
}

/**
 * Highest score first (newer first on ties), at most `perSourceCap` per source.
 * If the cap leaves fewer than `picks`, the rest is filled from the remaining
 * candidates in the same order. Unrated candidates come last.
 */
export function pickCurated<T extends CurateCandidate>(candidates: T[], picks: number, perSourceCap: number): T[] {
  const ranked = [...candidates].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
  const chosen: T[] = [];
  const perSource = new Map<string, number>();
  for (const c of ranked) {
    if (chosen.length >= picks) break;
    const n = perSource.get(c.sourceId) ?? 0;
    if (n >= perSourceCap) continue;
    perSource.set(c.sourceId, n + 1);
    chosen.push(c);
  }
  for (const c of ranked) {
    if (chosen.length >= picks) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen;
}
