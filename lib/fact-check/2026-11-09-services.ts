import { identifyClaims } from './2026-11-09-identify';
import { evaluateClaims } from './2026-11-09-evaluate';
import { retrieveEvidence } from './2026-11-09-evidence';
import { discoverSources, ResearchBudget } from './2026-11-09-openrouter';
import type { PipelineServices } from './2026-11-09-pipeline';
import type { fetchPublicHtml } from './2026-11-09-safe-fetch';

/**
 * Callers must persist reservations atomically. The search reservation must
 * conservatively bound the whole server-tool loop, including model tokens.
 */
export function createPipelineServices({ articleUrl, model, apiKey, maxClaims, searchReservationUsd, reserve, progress, request = fetch, fetcher }: {
  articleUrl: string;
  model: string;
  apiKey: string;
  maxClaims: number;
  searchReservationUsd: number;
  reserve: (maximumCostUsd: number, searches: number) => Promise<void>;
  progress: PipelineServices['progress'];
  request?: typeof fetch;
  fetcher?: typeof fetchPublicHtml;
}): PipelineServices {
  if (!Number.isFinite(searchReservationUsd) || searchReservationUsd <= 0) throw new Error('Invalid search reservation');
  return {
    progress,
    identify: (article) => identifyClaims({ article, model, apiKey, maxClaims, reserve: (cost) => reserve(cost, 0), request }),
    async research(claim, requestedArticleUrl) {
      if (requestedArticleUrl !== articleUrl) throw new Error('Article identity changed');
      await reserve(searchReservationUsd, 1);
      const candidates = await discoverSources({ claim: claim.statement, model, apiKey, budget: new ResearchBudget(searchReservationUsd, 1), upperBoundUsd: searchReservationUsd, request });
      return retrieveEvidence({ claimId: claim.id, candidates, articleUrl, fetcher });
    },
    evaluate: (article, claims, evidence) => {
      if (article.canonicalUrl !== articleUrl) throw new Error('Article identity changed');
      return evaluateClaims({ articleUrl, articleTitle: article.title, claims, evidence, model, apiKey, reserve: (cost) => reserve(cost, 0), request });
    },
  };
}
