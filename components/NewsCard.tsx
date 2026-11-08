'use client';

import Link from 'next/link';
import type { Article, Source, Cluster } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import ArticleImage from '@/components/ArticleImage';
import { decodeEntities } from '@/lib/text';
import { summaryPreview } from '@/lib/summary';
import { categoryShortLabel, categoryStyle } from '@/lib/categoryColor';

interface NewsCardProps {
  article: Article & { source: Source };
  cluster: Cluster | null;
  isRead?: boolean;
  dataKbId?: string;
}

/**
 * One story. Below `md` the whole card is a single link (the headline link is stretched over it, so
 * there is one tab stop and its accessible name is the headline). From `md` up the headline, image and
 * the "Read summary" button are separate links.
 *
 * Image cards sit on a white surface; cards without an image are filled with their category colour.
 */
export default function NewsCard({ article, cluster, isRead, dataKbId }: NewsCardProps) {
  const timeAgo = formatDistanceToNow(article.publishedAt, { addSuffix: true });
  const href = `/article/${article.id}`;
  const hasImage = Boolean(article.imageUrl);
  const firstTopic = article.topics ? article.topics.split(',')[0].trim() : '';
  const multiSource = Boolean(cluster && cluster.totalSourceCount > 1);

  const mutedText = 'text-[var(--text-muted)]';

  const eyebrow = (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--bg)] px-2.5 py-1 text-[12px] leading-4 text-[var(--text)]">
      <strong className="shrink-0 font-semibold uppercase tracking-[0.3px]">{categoryShortLabel(article.primaryArea)}</strong>
      {firstTopic && <span className="min-w-0 truncate">· {firstTopic}</span>}
    </span>
  );

  const meta = (
    <div className="flex items-center justify-between gap-3 text-body-sm">
      <span className="min-w-0 truncate font-semibold text-[var(--text-body)] md:font-medium">{article.source.name}</span>
      <span className={`shrink-0 ${mutedText}`}>
        {article.fromTeaser && (
          <span className="mr-2 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]" title="Summary written from a teaser only">
            Teaser
          </span>
        )}
        {timeAgo}
      </span>
    </div>
  );

  const title = (
    <h3 className="line-clamp-4 font-serif text-[19px] font-semibold leading-6 text-[var(--text)] md:text-[20px] md:leading-[25px]">
      <Link
        href={href}
        className="hover:underline max-md:after:absolute max-md:after:inset-0 max-md:after:content-[''] max-md:focus-visible:outline-none"
      >
        {decodeEntities(article.title)}
      </Link>
    </h3>
  );

  const coveredBy = multiSource && cluster && (
    <p className={`flex items-center gap-1.5 text-body-sm font-medium ${mutedText}`}>
      Covered by {cluster.totalSourceCount} sources
      {cluster.hasIndependentVoice && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--highlight)]" />}
    </p>
  );

  const summary = article.summary && (
    <p className="line-clamp-3 text-body-md text-[var(--text-body)] md:line-clamp-5">{summaryPreview(article.summary)}</p>
  );

  const readSummary = (
    <div className="mt-1.5 hidden md:block">
      <Link
        href={href}
        className="inline-flex items-center rounded-lg bg-[var(--text)] px-3.5 py-2 text-[14px] font-medium text-[var(--surface-elevated)] transition-opacity hover:opacity-90"
      >
        Read summary
      </Link>
    </div>
  );

  return (
    <div
      data-kb-id={dataKbId}
      style={hasImage ? undefined : categoryStyle(article.primaryArea)}
      className={`relative flex flex-col overflow-hidden rounded-[14px] max-md:transition-[transform,filter] max-md:active:scale-[0.99] max-md:active:brightness-[0.96] max-md:has-[:focus-visible]:outline-2 max-md:has-[:focus-visible]:outline-offset-2 max-md:has-[:focus-visible]:outline-[var(--accent)] ${
        hasImage
          ? 'border border-[var(--border)] bg-[var(--surface-elevated)] transition-shadow md:hover:shadow-md'
          : 'cat-card'
      } ${isRead ? 'opacity-60' : ''}`}
    >
      {isRead && (
        <span className="absolute right-3.5 top-3.5 z-10 rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
          Read
        </span>
      )}

      {hasImage ? (
        <>
          <div className="relative">
            {/* Mouse/touch convenience only: the headline link is the accessible one. */}
            <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
              <ArticleImage
                src={`/api/img?url=${encodeURIComponent(article.imageUrl!)}&v=2`}
                alt={article.imageAlt || article.title}
                sourceName={article.source.name}
                area={article.primaryArea}
              />
            </Link>
            <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)]">{eyebrow}</div>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4 md:px-[18px] md:pb-[18px]">
            {meta}
            {title}
            {coveredBy}
            {summary}
            {readSummary}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col p-4 md:p-[18px]">
          <div className="mb-3 pr-14">{eyebrow}</div>
          <div className="mb-2">{title}</div>
          {coveredBy && <div className="mb-2">{coveredBy}</div>}
          {summary && <div className="mb-3">{summary}</div>}
          <div className="mt-auto">{meta}</div>
          {readSummary}
        </div>
      )}
    </div>
  );
}
