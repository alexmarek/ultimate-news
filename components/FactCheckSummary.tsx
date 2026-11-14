import Link from 'next/link';

export type FactCheckSummaryReport = {
  id: string;
  published: boolean;
  verdict: 'supported' | 'mostly-supported' | 'mixed' | 'mostly-false' | 'false' | 'unverified';
  score: number | null;
  confidence: 'high' | 'medium' | 'low';
  executiveSummary: string;
  claims: { statement: string; verdict: FactCheckSummaryReport['verdict']; evidenceCount: number }[];
};

const colours: Record<FactCheckSummaryReport['verdict'], string> = {
  supported: 'var(--verdict-supported)', 'mostly-supported': 'var(--verdict-supported)', mixed: 'var(--verdict-mixed)',
  'mostly-false': 'var(--verdict-false)', false: 'var(--verdict-false)', unverified: 'var(--meta)',
};
const verdictText = (verdict: FactCheckSummaryReport['verdict']) => verdict.replace(/-/g, ' ');

/** Only pass a report obtained through the published-report relation. */
export default function FactCheckSummary({ report }: { report: FactCheckSummaryReport | null }) {
  if (process.env.FACT_CHECK_ENABLED !== 'true' || !report?.published) return null;
  return <section aria-labelledby="fact-check-heading" className="border-t-[3px] border-[var(--ink)] pt-3">
    <h2 id="fact-check-heading" className="text-label font-bold uppercase tracking-[1.2px]">Fact check</h2>
    <p className="mt-2 font-serif text-[32px] font-semibold capitalize leading-none md:text-[34px]" style={{ color: colours[report.verdict] }}>{verdictText(report.verdict)}</p>
    <p className="mt-2 text-meta text-[var(--meta)]">{report.verdict !== 'unverified' && report.score !== null && `Score ${report.score} of 10 · `}confidence {report.confidence}</p>
    <p className="mt-4 text-ui text-[var(--body)]">{report.executiveSummary}</p>
    {report.claims.slice(0, 2).map((claim, i) => <div key={i} className="mt-3 border-t border-[var(--rule)] pt-3 text-ui"><p>“{claim.statement}”</p><p className="mt-1 text-meta text-[var(--meta)]"><strong className="capitalize" style={{ color: colours[claim.verdict] }}>{verdictText(claim.verdict)}</strong> · {claim.evidenceCount} {claim.evidenceCount === 1 ? 'source' : 'sources'}</p></div>)}
    <Link href={`/fact-check/${encodeURIComponent(report.id)}`} className="mt-4 inline-block min-h-11 text-ui font-semibold underline">Full report and evidence</Link>
    <p className="text-meta text-[var(--meta)]">AI analysis against independently retrieved evidence.</p>
  </section>;
}
