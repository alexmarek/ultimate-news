import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, resolvePublicUrl } from './2026-11-09-safe-url';
import { fetchPublicHtml } from './2026-11-09-safe-fetch';

test('only accepts public IP addresses', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.1.1', '::1', '::ffff:127.0.0.1', '2001:db8::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('rejects unsafe schemes, credentials, and mixed DNS answers', async () => {
  await assert.rejects(resolvePublicUrl('file:///etc/passwd'));
  await assert.rejects(resolvePublicUrl('https://user:pass@example.com'));
  await assert.rejects(resolvePublicUrl('https://example.com', async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]));
  assert.equal((await resolvePublicUrl('https://example.com', async () => [{ address: '8.8.8.8', family: 4 }])).addresses[0].address, '8.8.8.8');
});

test('the fetcher rejects a local-network destination before connecting', async () => {
  await assert.rejects(fetchPublicHtml('http://127.0.0.1/private'), /Unsafe destination/);
});
