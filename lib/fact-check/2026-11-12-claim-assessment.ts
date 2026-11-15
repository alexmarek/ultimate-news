import { evaluateClaims } from './2026-11-09-evaluate';
import type { ResearchClaim } from './2026-11-09-assessment';
import type { RetrievedEvidence } from './2026-11-09-evidence';

/** A compact result suitable for a durable checkpoint; full source text stays in memory. */
export async function assessSingleClaim({ articleUrl, articleTitle, claim, evidence, model, apiKey, reserve, request = fetch }: {
  articleUrl: string;
  articleTitle: string;
  claim: ResearchClaim;
  evidence: RetrievedEvidence[];
  model: string;
  apiKey: string;
  reserve: (maximumCostUsd: number) => Promise<void>;
  request?: typeof fetch;
}) {
  if (evidence.some((record) => record.claimId !== claim.id)) throw new Error('Evidence belongs to the wrong claim');
  if (evidence.length === 0) {
    return {
      assessment: {
        claimId: claim.id, verdict: 'unverified' as const, score: null, confidence: 'low' as const,
        explanation: 'The search did not yield usable independent evidence for this claim.',
        supportingEvidenceIds: [], contradictingEvidenceIds: [], evidenceQuotes: [],
      },
      sources: [],
    };
  }
  // Treat this claim as central only for the single-claim evaluation. The
  // original centrality remains on the claim for the overall report.
  const output = await evaluateClaims({ articleUrl, articleTitle, claims: [{ ...claim, central: true }], evidence, model, apiKey, reserve, request });
  const assessment = output.claims[0];
  const supporting = new Set(assessment.supportingEvidenceIds);
  const contradicting = new Set(assessment.contradictingEvidenceIds);
  const sources = assessment.evidenceQuotes.map(({ evidenceId, excerpt }) => {
    const record = evidence.find((item) => item.id === evidenceId);
    if (!record) throw new Error('Unknown evidence');
    return {
      id: record.id, claimId: record.claimId, title: record.title, publisher: record.publisher,
      url: record.url, publishedAt: record.publishedAt, retrievedAt: record.retrievedAt,
      excerpt,
      relationship: supporting.has(evidenceId)
        ? contradicting.has(evidenceId) ? 'supports-and-contradicts' as const : 'supports' as const
        : 'contradicts' as const,
    };
  });
  return { assessment, sources };
}
