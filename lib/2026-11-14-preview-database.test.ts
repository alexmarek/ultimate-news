import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewDatabaseUrl } from './2026-11-14-preview-database';

test('requires an explicit database for fact-check previews', () => {
  const env = { VERCEL_ENV: 'preview', FACT_CHECK_ENABLED: 'true' };
  assert.throws(() => previewDatabaseUrl(env), /FACT_CHECK_PREVIEW_DATABASE_URL/);
  assert.equal(previewDatabaseUrl({ ...env, FACT_CHECK_PREVIEW_DATABASE_URL: 'postgresql://example.test/dev' }), 'postgresql://example.test/dev');
  assert.equal(previewDatabaseUrl({ ...env, VERCEL_ENV: 'production' }), undefined);
  assert.equal(previewDatabaseUrl({ ...env, FACT_CHECK_ENABLED: 'false' }), undefined);
});
