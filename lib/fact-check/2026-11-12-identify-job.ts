import { extractArticle } from './2026-11-09-extraction';
import { identifyClaims } from './2026-11-09-identify';
import { FactCheckFailure } from './2026-11-13-failure';

type Article = Awaited<ReturnType<typeof extractArticle>>;
type IdentifiedClaim = Awaited<ReturnType<typeof identifyClaims>>[number];
type Metadata = Omit<Article, 'content'>;
type IdentificationLease =
  | { kind: 'complete'; claimIds: string[] }
  | { kind: 'busy' }
  | { kind: 'acquired'; token: string; articleUrl: string; inputType?: string; inputText?: string | null };

/** The backing store must atomically lease, reserve and fence every write by token. */
export interface IdentificationStore {
  acquire(jobId: string): Promise<IdentificationLease>;
  reserve(jobId: string, token: string, maximumCostUsd: number): Promise<void>;
  complete(jobId: string, token: string, metadata: Metadata, claims: IdentifiedClaim[]): Promise<void>;
  release(jobId: string, token: string): Promise<void>;
}

/** Article text is used in memory only; the workflow receives claim IDs. */
export async function identifyJob({ jobId, store, model, apiKey, maxClaims, extract = extractArticle, identify = identifyClaims }: {
  jobId: string; store: IdentificationStore; model: string; apiKey: string; maxClaims: number;
  extract?: typeof extractArticle; identify?: typeof identifyClaims;
}): Promise<{ claimIds: string[] }> {
  if (!jobId || !model || !apiKey || !Number.isInteger(maxClaims) || maxClaims < 1 || maxClaims > 8) throw new Error('Invalid identification request');
  const lease = await store.acquire(jobId);
  if (lease.kind === 'complete') {
    if (!lease.claimIds.length || lease.claimIds.length > 8 || lease.claimIds.some(id => !id) || new Set(lease.claimIds).size !== lease.claimIds.length) throw new Error('Invalid checkpoint');
    return { claimIds: lease.claimIds };
  }
  if (lease.kind === 'busy') throw new Error('Identification is already being processed');
  try {
    if (!lease.token || !lease.articleUrl) throw new Error('Invalid identification lease');
    if (lease.inputType && !['url', 'text', 'image'].includes(lease.inputType)) throw new Error('Invalid input type');
    const article = lease.inputType && lease.inputType !== 'url' ? {
      canonicalUrl: lease.articleUrl, title: lease.inputText?.slice(0, 140) || 'Submitted text', content: lease.inputText || '',
      publisher: null, author: null, publishedAt: null, language: null,
    } : await extract(lease.articleUrl).catch((error: unknown) => {
      if (error instanceof FactCheckFailure) throw error;
      throw new FactCheckFailure('article_access');
    });
    if (!article.content.trim()) throw new FactCheckFailure('article_text');
    const claims = await identify({ article, model, apiKey, maxClaims, reserve: amount => store.reserve(jobId, lease.token, amount) });
    if (!claims.length || claims.length > maxClaims || claims.some(claim => !claim.id || !claim.statement.trim()) || new Set(claims.map(claim => claim.id)).size !== claims.length) throw new Error('Invalid claims');
    const { content: _content, ...metadata } = article;
    await store.complete(jobId, lease.token, metadata, claims);
    return { claimIds: claims.map(claim => claim.id) };
  } catch (error) {
    // A timed-out request may already have been billed; do not refund its reservation.
    try { await store.release(jobId, lease.token); } catch { /* The lease expiry handles recovery. */ }
    if (error instanceof FactCheckFailure) throw error;
    throw new Error('Claim identification failed');
  }
}
