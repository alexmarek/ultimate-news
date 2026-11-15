import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractImageText } from './2026-11-14-image-text';
import { imageSubmissionFailureCode } from './2026-11-13-failure';

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

test('reports the provider error that prevented image transcription', async () => {
  const png = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'meme.png', { type: 'image/png' });
  for (const [status, expected] of [[400, 'image_request'], [401, 'image_access'], [402, 'image_credits'], [429, 'image_busy'], [504, 'image_timeout']] as const) {
    await assert.rejects(extractImageText(png, 'synthetic', async () => new Response('private response', { status })), error => {
      assert.equal(imageSubmissionFailureCode(error), expected);
      return true;
    });
  }
});
