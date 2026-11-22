import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isAuthorizedCron } from './2026-11-22-cron-auth';

test('accepts only the exact bearer secret', () => {
  assert.equal(isAuthorizedCron('Bearer s3cret-value-1234', 's3cret-value-1234'), true);
  assert.equal(isAuthorizedCron('Bearer wrong-value-12345', 's3cret-value-1234'), false);
  assert.equal(isAuthorizedCron('s3cret-value-1234', 's3cret-value-1234'), false);
  assert.equal(isAuthorizedCron(null, 's3cret-value-1234'), false);
});

test('refuses everything when no secret is configured', () => {
  assert.equal(isAuthorizedCron('Bearer ', ''), false);
  assert.equal(isAuthorizedCron('Bearer undefined', undefined), false);
  assert.equal(isAuthorizedCron(null, undefined), false);
});
