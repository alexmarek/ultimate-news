import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractImageText } from './2026-11-14-image-text';

test('extracts image text via the existing provider and rejects invalid image bytes', async () => {
  const png = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'meme.png', { type: 'image/png' });
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages[0].content[1].image_url.url.startsWith('data:image/png;base64,'), true);
    return Response.json({ choices: [{ message: { content: 'Synthetic meme claim' } }] });
  };
  assert.equal(await extractImageText(png, 'synthetic', request), 'Synthetic meme claim');
  const invalid = new File(['not an image'], 'fake.png', { type: 'image/png' });
  await assert.rejects(extractImageText(invalid, 'synthetic', request), { code: 'invalid' });
});
