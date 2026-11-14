import { z } from 'zod';
import { parseAssessment, type ResearchClaim } from './2026-11-09-assessment';
import { maximumRequestCost } from './2026-11-09-cost';
import type { RetrievedEvidence } from './2026-11-09-evidence';
import { structuredCompletion } from './2026-11-09-model';
import { EVIDENCE_EVALUATION_INSTRUCTIONS } from './2026-11-09-prompts';
import { passageEvaluationSchema } from './2026-11-09-report-schema';
import { FactCheckFailure } from './2026-11-13-failure';
import { verdictForScore } from './2026-11-13-scoring-rubric';

function sourcePassages(content: string): string[] {
  const text = content.slice(0, 3000);
  const passages: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 480, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start + 360) end = boundary;
    }
    const passage = text.slice(start, end).trim();
    if (passage.length >= 20) passages.push(passage);
    if (end === text.length) break;
    const overlap = text.lastIndexOf(' ', end - 80);
    start = overlap > start ? overlap + 1 : end - 80;
  }
  return passages;
}

/** Evaluate claims only after evidence retrieval and a durable budget reservation. */
export async function evaluateClaims({ articleUrl, articleTitle, claims, evidence, model, apiKey, reserve, request = fetch }: {
  articleUrl: string;
  articleTitle: string;
  claims: ResearchClaim[];
  evidence: RetrievedEvidence[];
  model: string;
  apiKey: string;
  reserve: (maximumCostUsd: number) => Promise<void>;
  request?: typeof fetch;
}) {
  if (!claims.length || claims.length > 8 || evidence.length > 40) throw new Error('Invalid evaluation input');
  const claimNumbers = new Map(claims.map(({ id }, index) => [id, index + 1]));
  if (claimNumbers.size !== claims.length) throw new FactCheckFailure('evidence_claims');
  const passages = new Map<number, { evidenceId: string; claimNumber: number; text: string }>();
  const sources = evidence.map(({ id, claimId, title, publisher, url, publishedAt, retrievedAt, content }) => {
    const claimNumber = claimNumbers.get(claimId);
    if (claimNumber === undefined) throw new FactCheckFailure('evidence_reference');
    return {
      claimNumber, title, publisher, url, publishedAt, retrievedAt,
      passages: sourcePassages(content).map(text => {
        const passageNumber = passages.size + 1;
        passages.set(passageNumber, { evidenceId: id, claimNumber, text });
        return { passageNumber, text };
      }),
    };
  });
  const data = { articleTitle, claims: claims.map(({ statement, central }, index) => ({ claimNumber: index + 1, statement, central })), evidence: sources };
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, 'utf8') > 190_000) throw new Error('Evidence exceeds evaluation limit');
  const inputBytes = Buffer.byteLength(serialized + EVIDENCE_EVALUATION_INSTRUCTIONS + JSON.stringify(z.toJSONSchema(passageEvaluationSchema)), 'utf8');
  const outputTokenLimit = 8192;
  await reserve(maximumRequestCost(inputBytes * 4 + 4096, outputTokenLimit, 0, model));
  const output = await structuredCompletion({ model, apiKey, instruction: EVIDENCE_EVALUATION_INSTRUCTIONS, data, schema: passageEvaluationSchema, schemaName: 'fact_check', maxTokens: outputTokenLimit, request });
  try {
    const { claims: scoredClaims, ...report } = output;
    const assessments = scoredClaims.map(({ claimNumber, citations, ...assessment }) => {
      const claim = claims[claimNumber - 1];
      if (!claim) throw new FactCheckFailure('evidence_claims');
      const supportingEvidenceIds: string[] = [];
      const contradictingEvidenceIds: string[] = [];
      const citedSources = new Map<string, Set<number>>();
      const evidenceQuotes: Array<{ evidenceId: string; excerpt: string }> = [];
      for (const { passageNumber, relationship } of citations) {
        const passage = passages.get(passageNumber);
        if (!passage) throw new FactCheckFailure('evidence_passage');
        if (passage.claimNumber !== claimNumber) throw new FactCheckFailure('evidence_wrong_claim');
        const { evidenceId, text } = passage;
        const prior = citedSources.get(evidenceId);
        if (relationship !== 'contradicts' && !supportingEvidenceIds.includes(evidenceId)) supportingEvidenceIds.push(evidenceId);
        if (relationship !== 'supports' && !contradictingEvidenceIds.includes(evidenceId)) contradictingEvidenceIds.push(evidenceId);
        if (prior?.has(passageNumber)) continue;
        if (prior) {
          prior.add(passageNumber);
          evidenceQuotes.find(quote => quote.evidenceId === evidenceId)!.excerpt += `\n…\n${text}`;
        } else {
          citedSources.set(evidenceId, new Set([passageNumber]));
          evidenceQuotes.push({ evidenceId, excerpt: text });
        }
      }
      return { ...assessment, verdict: verdictForScore(assessment.score), claimId: claim.id, supportingEvidenceIds, contradictingEvidenceIds, evidenceQuotes };
    });
    return parseAssessment({ ...report, verdict: verdictForScore(report.score), claims: assessments }, articleUrl, claims, evidence);
  } catch (error) {
    if (error instanceof FactCheckFailure) throw error;
    throw new FactCheckFailure('evidence_validation');
  }
}
