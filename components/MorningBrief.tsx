import Image from 'next/image';
import Link from 'next/link';
import type { Article, Source } from '@prisma/client';
import { decodeEntities } from '@/lib/text';
import { firstSentence } from '@/lib/summary';

type BriefArticle = Article & { source: Source };

export default function MorningBrief({ articles, readIds }: { articles: BriefArticle[]; readIds: Set<string> }) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  return <section aria-labelledby="brief-heading" className="text-[var(--ink)]">
    <h2 id="brief-heading" className="mb-3 text-label font-bold uppercase tracking-[1.2px] text-[var(--accent)]">Today&apos;s brief</h2>
    <article className="border-b border-[var(--ink)] pb-6">
      {lead.imageUrl && <Link href={`/article/${lead.id}`} tabIndex={-1} aria-hidden="true" className="relative -mx-4 mb-4 block aspect-[3/2] w-[calc(100%+2rem)] overflow-hidden md:mx-0 md:w-full"><Image src={`/api/img?url=${encodeURIComponent(lead.imageUrl)}&v=2`} alt="" fill sizes="(max-width: 767px) 100vw, (max-width: 1200px) 65vw, 800px" className="object-cover" /></Link>}
      <h3 className={`font-serif text-[36px] leading-[37px] font-semibold tracking-[-1px] [text-wrap:balance] md:text-lead md:leading-[59px] ${readIds.has(lead.id) ? 'text-[var(--meta)]' : ''}`}><Link href={`/article/${lead.id}`} className="hover:text-[var(--accent)]">{decodeEntities(lead.title)}{readIds.has(lead.id) && <span className="sr-only"> (read)</span>}</Link></h3>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_240px]">
        <p className="font-serif text-[20px] leading-[27px] md:text-deck-front">{firstSentence(lead.summary) || lead.excerpt}</p>
        <div className="text-meta text-[var(--meta)]">{lead.forYou && <p className="mb-3 text-ui text-[var(--body)]"><span className="mr-1 border border-[var(--ink)] px-1 text-[10px] font-bold">AI</span><strong>Why it matters to you.</strong> {lead.forYou}</p>}<strong className="text-[var(--ink)]">{lead.source.name}</strong> · {lead.primaryArea}</div>
      </div>
    </article>
    <ol start={2} className="grid md:grid-cols-2 md:gap-x-10">{rest.map((article, i) => <li key={article.id} className="relative flex gap-4 border-b border-[var(--rule)] py-4">
      <span aria-hidden="true" className="font-serif text-brief">{i + 2}</span><div className="min-w-0 flex-1"><h3 className={`font-serif text-[22px] leading-[26px] font-semibold md:text-[26px] md:leading-[30px] ${readIds.has(article.id) ? 'text-[var(--meta)]' : ''}`}><Link href={`/article/${article.id}`} className="hover:text-[var(--accent)] after:absolute after:inset-0">{decodeEntities(article.title)}{readIds.has(article.id) && <span className="sr-only"> (read)</span>}</Link></h3><p className="mt-2 text-meta text-[var(--meta)]"><strong className="text-[var(--ink)]">{article.source.name}</strong> · {article.primaryArea}</p></div>
    </li>)}</ol>
  </section>;
}
