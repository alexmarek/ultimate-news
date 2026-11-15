/** Select an isolated database for previews that enable fact checking. */
export function previewDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string | undefined {
  if (env.VERCEL_ENV !== 'preview' || env.FACT_CHECK_ENABLED !== 'true') return undefined;
  const url = env.FACT_CHECK_PREVIEW_DATABASE_URL?.trim();
  if (!url) throw new Error('FACT_CHECK_PREVIEW_DATABASE_URL is required for fact-check previews');
  return url;
}
