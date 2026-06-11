// lib/ingest/canonicalize.ts
//
// URL canonicalization. Strips unnecessary query parameters, fragments,
// tracking tokens, etc. to produce a stable, comparable article identifier.
//
// Rules are per-domain (must be seeded with source entries). For now, a
// conservative default that just strips query + fragment.

import { createHash } from 'crypto';

/**
 * Strip tracking cruft from a URL to get a canonical identifier.
 */
export async function canonicalizeUrl(url: string): Promise<string> {
  const u = new URL(url);

  // Remove fragment
  u.hash = '';

  // Remove tracking parameters (common culprits)
  const trackingParams = [
    // utm_* family
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    // fbclid
    'fbclid',
    // gclid
    'gclid',
    // dclid
    'dclid',
    // msclkid
    'msclkid',
    // Other common trackers
    'ref',
    'source',
    'cid',
    'mc_cid',
    'mc_eid',
  ];

  for (const param of trackingParams) {
    u.searchParams.delete(param);
  }

  // If search params are now empty, strip the '?' entirely
  if (u.searchParams.size === 0) {
    u.search = '';
  }

  // Sort remaining params for consistency
  // (some sites may include the same params in different order)
  if (u.searchParams.size > 0) {
    const sorted = new URLSearchParams(
      Array.from(u.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    );
    u.search = sorted.toString();
  }

  return u.toString();
}

/**
 * Derive a stable article ID from the canonical URL.
 * SHA256 of the canonical URL, base64‑url encoded (no padding).
 */
export function articleIdFromUrl(canonicalUrl: string): string {
  return createHash('sha256').update(canonicalUrl).digest('base64url');
}