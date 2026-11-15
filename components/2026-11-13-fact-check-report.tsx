/// <reference lib="es2022.intl" />

import { ChevronDown } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { SCORE_MAX, SCORE_RUBRIC, scoreMatchesVerdict } from '@/lib/fact-check/2026-11-13-scoring-rubric';

const assessments: Record<string, { label: string; colour: string }> = {
  supported: { label: 'True', colour: 'sage' },
  'mostly-supported': { label: 'Mostly true', colour: 'beige' },
  mixed: { label: 'Mixed', colour: 'papaya' },
  'mostly-false': { label: 'Mostly false', colour: 'error' },
  false: { label: 'False', colour: 'error' },
  supports: { label: 'Supports claim', colour: 'sage' },
  contradicts: { label: 'Contradicts claim', colour: 'error' },
  'supports-and-contradicts': { label: 'Supports and contradicts parts', colour: 'papaya' },
};

export const factCheckLinkClass = 'font-medium text-[var(--accent)] underline decoration-[var(--text-faint)] underline-offset-4 hover:decoration-current';

export function safeReportLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function PaletteLabel({ colour, children, large = false }: { colour: string; children: ReactNode; large?: boolean }) {
  const typography = large ? 'font-serif text-headline-lg' : 'text-body-sm';
  if (colour === 'error') {
    return <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-body-sm font-semibold text-[var(--error)] ring-1 ring-current ring-inset">{children}</span>;
  }
  return <span className={`cat-fill rounded-full px-2.5 py-1 font-semibold ${typography}`}
    style={{ '--cat': `var(--${colour})` } as CSSProperties}>{children}</span>;
}

function Score({ score, verdict, prominent = false }: { score: number | null; verdict: string | null; prominent?: boolean }) {
  if (score === null && verdict === 'unverified') return null;
  if (!scoreMatchesVerdict(score, verdict)) return <span className="text-body-sm text-[var(--text-muted)]">Score needs review</span>;
  return <PaletteLabel colour="highlight" large={prominent}><span className="tabular-nums">{score}/{SCORE_MAX}</span></PaletteLabel>;
}

export function FactCheckVerdict({ verdict, score, prominent = false }: { verdict: string | null; score?: number | null; prominent?: boolean }) {
  const assessment = verdict ? assessments[verdict] : undefined;
  return <span className="inline-flex flex-wrap items-center gap-2">
    {score !== undefined && <Score score={score} verdict={verdict} prominent={prominent} />}
    {assessment
      ? <PaletteLabel colour={assessment.colour}>{assessment.label}</PaletteLabel>
      : <span className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-body-sm font-semibold text-[var(--text-muted)]">Insufficient evidence</span>}
  </span>;
}

function Confidence({ level }: { level: string }) {
  return <span className="text-body-sm text-[var(--text-muted)]"><span className="capitalize">{level}</span> confidence</span>;
}

export function FactCheckResult({ score, verdict, confidence, summary }: {
  score: number | null;
  verdict: string | null;
  confidence: string | null;
  summary: string | null;
}) {
  const text = summary?.trim() ?? '';
  const sentences = Array.from(new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text));
  const firstTwo = sentences.slice(0, 2).map(({ segment }) => segment).join('').trim();
  const preview = text.length <= 320 || firstTwo.length <= 320 ? firstTwo : sentences[0]?.segment.trim() ?? '';
  const rest = text.slice(preview.length).trim();

  return <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--panel)] px-4 py-4 sm:px-5">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FactCheckVerdict score={score} verdict={verdict} prominent />
      {confidence && <Confidence level={confidence} />}
    </div>
    <details className="mt-2 text-body-sm text-[var(--text-muted)]">
      <summary className={`w-fit cursor-pointer ${factCheckLinkClass}`}>How scoring works</summary>
      <p className="mt-1">{SCORE_RUBRIC}. Insufficient evidence leaves the result unscored.</p>
    </details>
    {preview && <p className="mt-3 whitespace-pre-line text-body-md">{preview}</p>}
    {rest && <details className="mt-2">
      <summary className={`w-fit cursor-pointer text-body-sm ${factCheckLinkClass}`}>More from the report</summary>
      <p className="mt-2 whitespace-pre-line text-body-md">{rest}</p>
    </details>}
  </div>;
}

type Claim = { id: string; statement: string; verdict: string; score: number | null; confidence: string; explanation: string };
type Evidence = { id: string; claimId: string; title: string; url: string; publisher: string | null; excerpt: string; relationship: string };

export function FactCheckClaims({ claims, evidence }: { claims: Claim[]; evidence: Evidence[] }) {
  if (!claims.length) return null;
  return <section className="mt-8" aria-labelledby="fact-check-claims">
    <h2 id="fact-check-claims" className="font-serif text-headline-lg font-semibold text-[var(--text)]">Claims and sources</h2>
    <div className="mt-3 space-y-2">
      {claims.map((claim) => {
        const sources = evidence.filter((source) => source.claimId === claim.id);
        return <details key={claim.id} className="group rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)]">
          <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-body-md font-semibold text-[var(--text)] [overflow-wrap:anywhere]">{claim.statement}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <FactCheckVerdict verdict={claim.verdict} />
                <span className="text-body-sm text-[var(--text-muted)]">{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
              </span>
            </span>
            <ChevronDown aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-[var(--text-muted)] group-open:rotate-180" />
          </summary>
          <div className="border-t border-[var(--border)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Score score={claim.score} verdict={claim.verdict} />
              <Confidence level={claim.confidence} />
            </div>
            <p className="mt-2 whitespace-pre-line text-body-md">{claim.explanation}</p>
            {sources.length > 0 && <ul className="mt-4 space-y-2">
              {sources.map((source) => {
                const href = safeReportLink(source.url);
                const relationship = assessments[source.relationship];
                return <li key={source.id} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {relationship && <PaletteLabel colour={relationship.colour}>{relationship.label}</PaletteLabel>}
                    {source.publisher && <span className="text-body-sm text-[var(--text-muted)]">{source.publisher}</span>}
                  </div>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className={factCheckLinkClass}>{source.title}</a> : <span className="font-semibold">{source.title}</span>}
                  <p className="mt-1 text-body-sm text-[var(--text-muted)]">{source.excerpt}</p>
                </li>;
              })}
            </ul>}
          </div>
        </details>;
      })}
    </div>
  </section>;
}
