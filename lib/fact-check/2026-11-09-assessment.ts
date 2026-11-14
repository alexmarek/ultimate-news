import { evaluationSchema } from './2026-11-09-report-schema';
import { validateAssessment } from './2026-11-09-report-validation';
import { isRetrievedExcerpt, type RetrievedEvidence } from './2026-11-09-evidence';
import { FactCheckFailure } from './2026-11-13-failure';

export interface ResearchClaim {
  id: string;
  statement: string;
  central: boolean;
}

/** Validate a model's result against the exact claims and independently fetched records. */
export function parseAssessment(output: unknown, articleUrl: string, claims: ResearchClaim[], evidence: RetrievedEvidence[]) {
  const parsed = evaluationSchema.safeParse(output);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const failure = issue.code === 'custom' ? issue.params?.failure : undefined;
      if (failure === 'evidence_score' || failure === 'evidence_required') throw new FactCheckFailure(failure);
    }
    throw new FactCheckFailure('evidence_validation');
  }
  const report = parsed.data;
  if (!claims.length || report.claims.length !== claims.length) throw new FactCheckFailure('evidence_claims', 'Assessment must cover each identified claim exactly once');
  const expected = new Map(claims.map((claim) => [claim.id, claim]));
  if (expected.size !== claims.length || new Set(report.claims.map((claim) => claim.claimId)).size !== claims.length || report.claims.some((claim) => !expected.has(claim.claimId))) throw new FactCheckFailure('evidence_claims', 'Invalid assessment claim IDs');
  if (report.verdict !== 'unverified' && !report.claims.some(claim => claim.verdict !== 'unverified' && expected.get(claim.claimId)?.central)) {
    throw new FactCheckFailure('evidence_central');
  }
  const evidenceById = new Map(evidence.map(record => [record.id, record]));
  for (const claim of report.claims) {
    for (const id of [...claim.supportingEvidenceIds, ...claim.contradictingEvidenceIds]) {
      if (evidenceById.get(id)?.claimId !== claim.claimId) {
        throw new FactCheckFailure('evidence_reference', 'Invalid evidence reference');
      }
    }
  }
  const errors = validateAssessment({
    articleUrl,
    verdict: report.verdict,
    score: report.score,
    claims: report.claims.map((claim) => ({
      id: claim.claimId,
      verdict: claim.verdict,
      score: claim.score,
      central: expected.get(claim.claimId)!.central,
      evidenceIds: [...claim.supportingEvidenceIds, ...claim.contradictingEvidenceIds],
    })),
    evidence: evidence.map((record) => ({ id: record.id, claimId: record.claimId, url: record.url })),
  });
  if (errors.length) throw new Error(`Invalid assessment: ${errors.join('; ')}`);
  for (const claim of report.claims) {
    const supporting = new Set(claim.supportingEvidenceIds);
    const hasPartialVerdict = claim.verdict === 'mixed' || claim.verdict === 'mostly-false' || claim.verdict === 'mostly-supported';
    if (!hasPartialVerdict && claim.contradictingEvidenceIds.some(id => supporting.has(id))) {
      throw new FactCheckFailure('evidence_relationship');
    }
    const cited = new Set([...claim.supportingEvidenceIds, ...claim.contradictingEvidenceIds]);
    const quotes = new Set<string>();
    for (const quote of claim.evidenceQuotes) {
      const record = evidenceById.get(quote.evidenceId);
      if (!record || record.claimId !== claim.claimId || !cited.has(quote.evidenceId)) {
        throw new FactCheckFailure('evidence_reference', 'Invalid evidence quotation reference');
      }
      if (quotes.has(quote.evidenceId) || !quote.excerpt.split('\n…\n').every(excerpt => isRetrievedExcerpt(record, excerpt))) {
        throw new FactCheckFailure('evidence_quote', 'Invalid evidence quotation');
      }
      quotes.add(quote.evidenceId);
    }
    if ([...cited].some((id) => !quotes.has(id))) throw new FactCheckFailure('evidence_quote', 'Every cited source requires a verified quotation');
  }
  return report;
}
