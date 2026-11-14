import Image from 'next/image';
import Link from 'next/link';
import type { Article, Source, Cluster } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { decodeEntities } from '@/lib/text';
import { summaryPreview } from '@/lib/summary';
import { SOURCES } from '@/lib/config/sources';

export default function NewsCard({ article, cluster, isRead, dataKbId, variant = 'row' }: {
  article: Article & { source: Source }; cluster: Cluster | null; isRead?: boolean; dataKbId?: string; variant?: 'lead' | 'row' | 'off-duty';
}) {
  const showImage = Boolean(article.imageUrl && (variant === 'lead' || variant === 'off-duty' || (article.importance ?? 0) >= 3));
  const title = decodeEntities(article.title);
  let alsoIn: string[] = [];
  try {
    const ids: unknown = cluster ? JSON.parse(cluster.sourcesAttributed) : [];
    if (Array.isArray(ids)) alsoIn = ids.filter((id): id is string => typeof id === 'string' && id !== article.sourceId).map((id) => SOURCES.find((source) => source.id === id)?.name).filter((name): name is string => Boolean(name));
  } catch {}
  const src = article.imageUrl ? `/api/img?url=${encodeURIComponent(article.imageUrl)}&v=2` : '';
  return <article data-kb-id={dataKbId} className="relative flex min-w-0 gap-4 border-b border-[var(--rule)] py-3">
    {showImage && <div className={`relative order-last shrink-0 overflow-hidden ${variant === 'lead' ? 'aspect-[3/2] w-[100px] md:order-first md:w-[200px]' : 'aspect-[4/3] w-[84px]'}`}><Image src={src} alt="" fill sizes={variant === 'lead' ? '(max-width: 767px) 120px, 200px' : '84px'} className="object-cover" /></div>}
    <div className="min-w-0 flex-1">
      {variant === 'lead' && <p className="mb-2 text-label font-bold uppercase tracking-[1.2px] text-[var(--accent)]">{article.primaryArea}</p>}
      <h3 className={`font-serif font-semibold ${variant === 'lead' ? 'text-headline' : 'text-row'} ${isRead ? 'text-[var(--meta)]' : 'text-[var(--ink)]'}`}><Link href={`/article/${article.id}`} className="hover:text-[var(--accent)] after:absolute after:inset-0">{title}{isRead && <span className="sr-only"> (read)</span>}</Link></h3>
      {variant === 'lead' && article.summary && <p className="mt-2 line-clamp-2 text-ui text-[var(--body)]">{summaryPreview(article.summary)}</p>}
      <p className="mt-2 text-meta text-[var(--meta)]">{isRead && 'Read · '}<strong className="text-[var(--ink)]">{article.source.name}</strong> · {formatDistanceToNow(article.publishedAt, { addSuffix: true })}{alsoIn.length > 0 && ` · also in ${alsoIn.join(', ')}`}</p>
    </div>
  </article>;
}
