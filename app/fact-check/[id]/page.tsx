import { notFound } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { FactCheckClaims, FactCheckResult, factCheckLinkClass, safeReportLink } from '@/components/2026-11-13-fact-check-report';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Report = { id: string; title: string | null; publisher: string | null; author: string | null; canonicalUrl: string; articlePublishedAt: Date | null; score: number | null; verdict: string | null; confidence: string | null; executiveSummary: string | null; supportedFindings: unknown; unsupportedFindings: unknown; missingContext: unknown; accurateFormulation: string | null; verifiedAt: Date | null; methodologyVersion: string };
type Claim = { id: string; statement: string; score: number | null; verdict: string; confidence: string; explanation: string };
type Evidence = { id: string; claimId: string; title: string; url: string; publisher: string | null; excerpt: string; relationship: string };

function Findings({ title, value }: { title: string; value: unknown }) {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length ? <section className="mt-4">
    <h3 className="font-serif text-headline-md font-semibold text-[var(--text)]">{title}</h3>
    <ul className="mt-2 list-disc space-y-2 pl-5">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
  </section> : null;
}

export default async function FactCheckReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.FACT_CHECK_ENABLED !== 'true') notFound();
  const { id } = await params;
  const reports = await prisma.$queryRaw<Report[]>`SELECT r."id", r."title", r."publisher", r."author", a."canonicalUrl", r."articlePublishedAt", r."score", r."verdict", r."confidence", r."executiveSummary", r."supportedFindings", r."unsupportedFindings", r."missingContext", r."accurateFormulation", r."verifiedAt", r."methodologyVersion"
    FROM "FactCheckArticle" a JOIN "FactCheckReport" r ON a."publishedReportId" = r."id"
    WHERE a."id" = ${id} AND r."articleId" = a."id" AND r."status" = 'published' LIMIT 1`;
  const report = reports[0];
  if (!report) notFound();
  const claims = await prisma.$queryRaw<Claim[]>`SELECT "id", "statement", "score", "verdict", "confidence", "explanation" FROM "FactCheckClaim" WHERE "reportId" = ${report.id} ORDER BY "id"`;
  const evidence = await prisma.$queryRaw<Evidence[]>`SELECT "id", "claimId", "title", "url", "publisher", "excerpt", "relationship" FROM "FactCheckEvidence" WHERE "reportId" = ${report.id} ORDER BY "id"`;
  const originalUrl = safeReportLink(report.canonicalUrl);
  const articleDetails = [report.publisher, report.author, report.articlePublishedAt?.toISOString().slice(0, 10)].filter(Boolean).join(' · ');
  const hasFindings = report.accurateFormulation || [report.supportedFindings, report.unsupportedFindings, report.missingContext]
    .some((value) => Array.isArray(value) && value.some((item) => typeof item === 'string'));

  return <>
    <SiteHeader />
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link href="/fact-check" className={factCheckLinkClass}>All fact checks</Link>
      <h1 className="mt-6 font-serif text-display-3 font-bold text-[var(--text)] sm:text-display-2">{report.title ?? 'Fact-check report'}</h1>
      {(articleDetails || originalUrl) && <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-body-sm text-[var(--text-muted)]">
        {articleDetails && <p>{articleDetails}</p>}
        {originalUrl && <a href={originalUrl} rel="noopener noreferrer" target="_blank" className={factCheckLinkClass}>Read original article</a>}
      </div>}
      <div className="mt-4">
        <FactCheckResult score={report.score} verdict={report.verdict} confidence={report.confidence} summary={report.executiveSummary} />
      </div>
      <FactCheckClaims claims={claims} evidence={evidence} />
      {hasFindings && <details className="mt-5 rounded-lg border border-[var(--border-strong)] bg-[var(--panel)] px-4 py-3 text-body-md">
        <summary className="cursor-pointer font-semibold text-[var(--text)]">Findings and context</summary>
        <Findings title="What the article gets right" value={report.supportedFindings} />
        <Findings title="Incorrect, unsupported or misleading" value={report.unsupportedFindings} />
        <Findings title="Missing context" value={report.missingContext} />
        {report.accurateFormulation && <section className="mt-4">
          <h3 className="font-serif text-headline-md font-semibold text-[var(--text)]">A more accurate formulation</h3>
          <p className="mt-2">{report.accurateFormulation}</p>
        </section>}
      </details>}
      <p className="mt-8 border-t border-[var(--border)] pt-4 text-body-sm text-[var(--text-muted)]">AI-generated analysis reviewed by an administrator. Claims are assessed against independently retrieved evidence. {report.verifiedAt ? `Verified ${report.verifiedAt.toISOString().slice(0, 10)}. ` : ''}Methodology {report.methodologyVersion}.</p>
    </main>
  </>;
}
