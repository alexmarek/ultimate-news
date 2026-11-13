/** Keep one report per cluster and omit reports already represented in the brief. */
export function distinctStories<T extends { id: string; clusterId: string | null }>(stories: T[], brief: T[]): T[] {
  const briefIds = new Set(brief.map((story) => story.id));
  const seenClusters = new Set(brief.flatMap((story) => story.clusterId ? [story.clusterId] : []));
  return stories.filter((story) => {
    if (briefIds.has(story.id) || (story.clusterId && seenClusters.has(story.clusterId))) return false;
    if (story.clusterId) seenClusters.add(story.clusterId);
    return true;
  });
}
