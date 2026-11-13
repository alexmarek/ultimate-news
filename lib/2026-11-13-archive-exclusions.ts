/** IDs excluded from an archive query before pagination. */
export function archiveExclusions(briefIds: readonly string[], readIds: ReadonlySet<string>, hideRead: boolean): string[] {
  return [...new Set([...briefIds, ...(hideRead ? readIds : [])])];
}
