import { z } from 'zod';
import { SCORE_MAX, SCORE_MIN, scoreMatchesVerdict } from './2026-11-13-scoring-rubric';

const text = z.string().trim().min(1).max(4000);
const verdict = z.enum(['supported', 'mostly-supported', 'mixed', 'mostly-false', 'false', 'unverified']);
const confidence = z.enum(['high', 'medium', 'low']);
export const scoreSchema = z.number().int().min(SCORE_MIN).max(SCORE_MAX).nullable();

export const claimExtractionSchema = z.object({
  claims: z.array(z.object({ statement: text, importance: text, central: z.boolean() }).strict()).max(8),
}).strict();

const claimAssessment = z.object({ verdict, score: scoreSchema, confidence, explanation: text });
const evaluatedClaim = claimAssessment.extend({
  claimId: text,
  supportingEvidenceIds: z.array(text).max(30), contradictingEvidenceIds: z.array(text).max(30),
  evidenceQuotes: z.array(z.object({ evidenceId: text, excerpt: z.string().min(20).max(15090) }).strict()).max(30),
}).strict();

const reportAssessment = z.object({
  score: scoreSchema, verdict, confidence, executiveSummary: text,
  supportedFindings: z.array(text).max(20), unsupportedFindings: z.array(text).max(20),
  missingContext: z.array(text).max(20), accurateFormulation: text,
});

export const passageEvaluationSchema = reportAssessment.omit({ verdict: true }).extend({
  claims: z.array(claimAssessment.omit({ verdict: true }).extend({
    claimNumber: z.number().int().min(1).max(8),
    citations: z.array(z.object({
      passageNumber: z.number().int().min(1),
      relationship: z.enum(['supports', 'contradicts', 'supports-and-contradicts']),
    }).strict()).max(30),
  }).strict()).max(8),
}).strict();

export const evaluationSchema = reportAssessment.extend({
  claims: z.array(evaluatedClaim).max(8),
}).strict().superRefine((report, context) => {
  if (!scoreMatchesVerdict(report.score, report.verdict)) context.addIssue({ code: 'custom', message: 'Score must match the verdict on the 1–10 rubric', path: ['score'], params: { failure: 'evidence_score' } });
  for (const [index, claim] of report.claims.entries()) {
    if (!scoreMatchesVerdict(claim.score, claim.verdict)) context.addIssue({ code: 'custom', message: 'Score must match the verdict on the 1–10 rubric', path: ['claims', index, 'score'], params: { failure: 'evidence_score' } });
    if (claim.verdict !== 'unverified' && !claim.supportingEvidenceIds.length && !claim.contradictingEvidenceIds.length) context.addIssue({ code: 'custom', message: 'Verified claim requires evidence', path: ['claims', index], params: { failure: 'evidence_required' } });
  }
});
