import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { resolvePublicUrl } from './2026-11-09-safe-url';
import { FactCheckFailure } from './2026-11-13-failure';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;

/** Fetch HTML only, rechecking DNS at each redirect and pinning the connected IP. */
export async function fetchPublicHtml(input: string): Promise<{ html: string; url: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let next = input;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      if (controller.signal.aborted) throw new Error('Fetch timed out');
      const resolved = await Promise.race([
        resolvePublicUrl(next),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Fetch timed out')), { once: true })),
      ]);
      const address = resolved.addresses[0];
      const lookup: LookupFunction = (_hostname, _options, callback) => callback(null, address.address, address.family as 4 | 6);
      const request = resolved.url.protocol === 'https:' ? httpsRequest : httpRequest;
      const response = await new Promise<{ status: number; location?: string; contentType: string; body: Buffer }>((resolve, reject) => {
        const req = request(resolved.url, { method: 'GET', lookup, family: address.family, signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'UltimateNewsFactChecker/1.0' } }, (res) => {
          const status = res.statusCode ?? 0;
          const location = res.headers.location;
          const contentType = res.headers['content-type'] ?? '';
          if (status >= 300 && status < 400) { res.resume(); resolve({ status, location, contentType, body: Buffer.alloc(0) }); return; }
          if (status === 403) {
            res.destroy();
            reject(new FactCheckFailure('article_blocked'));
            return;
          }
          if (status < 200 || status >= 300 || !/^text\/html(?:;|$)|^application\/xhtml\+xml(?:;|$)/i.test(contentType)) {
            res.destroy(); reject(new Error(`Unsupported response (${status})`)); return;
          }
          if (Number(res.headers['content-length'] ?? 0) > MAX_BYTES) { res.destroy(); reject(new Error('Response too large')); return; }
          const parts: Buffer[] = [];
          let length = 0;
          res.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length > MAX_BYTES) { res.destroy(new Error('Response too large')); return; }
            parts.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => resolve({ status, location, contentType, body: Buffer.concat(parts) }));
        });
        req.on('error', reject);
        req.end();
      });
      if (response.status >= 300 && response.status < 400) {
        if (!response.location || redirects === MAX_REDIRECTS) throw new Error('Too many or invalid redirects');
        next = new URL(response.location, resolved.url).href;
        continue;
      }
      return { html: response.body.toString('utf8'), url: resolved.url.href };
    }
    throw new Error('Too many redirects');
  } catch (error) {
    if (controller.signal.aborted) throw new FactCheckFailure('article_timeout', 'Fetch timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
