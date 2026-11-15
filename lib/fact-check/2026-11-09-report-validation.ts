/** Evidence references and scoring rules shared by report creation and publication. */
import { scoreMatchesVerdict, type ClaimVerdict } from './2026-11-13-scoring-rubric';

export type Confidence = 'high' | 'medium' | 'low';
export type { ClaimVerdict } from './2026-11-13-scoring-rubric';

export interface EvidenceReference {
  id: string;
  claimId: string;
  url: string;
}

export interface ClaimAssessment {
  id: string;
  verdict: ClaimVerdict;
  score: number | null;
  evidenceIds: string[];
  central: boolean;
}

export interface ReportAssessment {
  articleUrl: string;
  verdict: ClaimVerdict;
  score: number | null;
  claims: ClaimAssessment[];
  evidence: EvidenceReference[];
}

/** Reject invalid citations and overconfident scores before a report can be published. */
export function validateAssessment(report: ReportAssessment): string[] {
  const errors: string[] = [];
  const claimIds = new Set<string>();
  const evidenceById = new Map<string, EvidenceReference>();
  if (!scoreMatchesVerdict(report.score, report.verdict)) errors.push('Overall score must match the verdict on the 1–10 rubric. Unverified reports require a null score.');

  for (const claim of report.claims) {
    if (claimIds.has(claim.id)) errors.push(`Duplicate claim ID: ${claim.id}`);
    claimIds.add(claim.id);
    if (!scoreMatchesVerdict(claim.score, claim.verdict)) errors.push(`Invalid score or verdict for claim: ${claim.id}`);
  }

  for (const evidence of report.evidence) {
    if (evidenceById.has(evidence.id)) errors.push(`Duplicate evidence ID: ${evidence.id}`);
    evidenceById.set(evidence.id, evidence);
    if (!claimIds.has(evidence.claimId)) errors.push(`Evidence references unknown claim: ${evidence.id}`);
    try {
      const url = new URL(evidence.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL');
      const original = new URL(report.articleUrl);
      url.hash = '';
      original.hash = '';
      if (url.href === original.href) errors.push(`Original article is not independent evidence: ${evidence.id}`);
    } catch {
      errors.push(`Invalid evidence or article URL: ${evidence.id}`);
    }
  }

  for (const claim of report.claims) {
    if (claim.verdict !== 'unverified' && claim.evidenceIds.length === 0) errors.push(`Verified claim has no evidence: ${claim.id}`);
    for (const id of claim.evidenceIds) {
      const evidence = evidenceById.get(id);
      if (!evidence || evidence.claimId !== claim.id) errors.push(`Invalid evidence reference ${id} for claim: ${claim.id}`);
    }
  }

  if (report.verdict !== 'unverified' && !report.claims.some((claim) => claim.central && claim.verdict !== 'unverified')) {
    errors.push('An overall verdict requires at least one verified central claim.');
  }
  return errors;
}
