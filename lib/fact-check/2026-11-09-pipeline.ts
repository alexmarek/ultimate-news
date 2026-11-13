import { parseAssessment, type ResearchClaim } from './2026-11-09-assessment';
import type { RetrievedEvidence } from './2026-11-09-evidence';

export interface PipelineArticle { canonicalUrl: string; title: string; content: string }

export interface PipelineServices {
  identify(article: PipelineArticle): Promise<ResearchClaim[]>;
  research(claim: ResearchClaim, articleUrl: string): Promise<RetrievedEvidence[]>;
  evaluate(article: PipelineArticle, claims: ResearchClaim[], evidence: RetrievedEvidence[]): Promise<unknown>;
  progress(stage: 'identifying-claims' | 'researching' | 'evaluating'): Promise<void>;
}

/** Pipeline dependencies must reserve external-call budgets and persist state before each call. */
export async function runPipeline(article: PipelineArticle, services: PipelineServices) {
  await services.progress('identifying-claims');
  const claims = await services.identify(article);
  if (!claims.length || claims.length > 8 || new Set(claims.map((claim) => claim.id)).size !== claims.length || claims.some((claim) => !claim.id || !claim.statement.trim())) throw new Error('Invalid extracted claims');
  await services.progress('researching');
  const evidence: RetrievedEvidence[] = [];
  for (const claim of claims) {
    const records = await services.research(claim, article.canonicalUrl);
    if (records.some((record) => record.claimId !== claim.id)) throw new Error('Evidence belongs to the wrong claim');
    evidence.push(...records);
  }
  await services.progress('evaluating');
  const output = await services.evaluate(article, claims, evidence);
  return { claims, evidence, assessment: parseAssessment(output, article.canonicalUrl, claims, evidence) };
}
