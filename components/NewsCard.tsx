'use client';

import Link from 'next/link';
import type { Article, Source, Cluster } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Newspaper } from 'lucide-react';
import ToggleSave from '@/components/ToggleSave';
import ArticleImage from '@/components/ArticleImage';

interface NewsCardProps {
  article: Article & { source: Source };
  cluster: Cluster | null;
  isRead?: boolean;
  initialSaved?: boolean;
  dataKbId?: string;
}

export default function NewsCard({ article, cluster, isRead, initialSaved, dataKbId }: NewsCardProps) {
  const timeAgo = formatDistanceToNow(article.publishedAt, { addSuffix: true });

  return (
    <div data-kb-id={dataKbId} className={`relative bg-[var(--surface-elevated)] rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-[var(--border)] flex flex-col ${isRead ? 'opacity-60' : ''}`}>
      {/* Read badge */}
      {isRead && (
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-[var(--surface)] px-2 py-0.5 rounded-full text-[10px] font-medium text-[var(--text-muted)]">
            Read
          </span>
        </div>
      )}
      {/* Image */}
      {article.imageUrl && (
        <Link href={`/article/${article.id}`} className="block relative">
          <ArticleImage
            src={`/api/img?url=${encodeURIComponent(article.imageUrl)}`}
            alt={article.imageAlt || article.title}
            sourceName={article.source.name}
          />
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-[var(--surface-elevated)]/90 backdrop-blur-sm px-3 py-1 rounded-full text-body-sm font-medium text-[var(--text)]">
              {article.primaryArea}
            </span>
          </div>
        </Link>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* Source and time */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Newspaper className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
            <span className="text-body-md font-medium text-[var(--text-body)] truncate">
              {article.source.name}
            </span>
          </div>
          <span className="text-body-md text-[var(--text-muted)] flex-shrink-0 ml-2">{timeAgo}</span>
        </div>

        {/* Title */}
        <Link href={`/article/${article.id}`} className="block">
          <h3 className={`font-serif text-headline-md font-semibold text-[var(--text)] line-clamp-2 hover:text-[var(--text-body)] transition-colors ${cluster && cluster.totalSourceCount > 1 ? 'mb-1.5' : 'mb-3'}`}>
            {article.title}
          </h3>
        </Link>

        {/* Cluster multi-source badge */}
        {cluster && cluster.totalSourceCount > 1 && (
          <Link href={`/article/${article.id}`} className="block mb-3">
            <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--accent-3)]">
              Covered by {cluster.totalSourceCount} sources
              {cluster.hasIndependentVoice && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-2)]" />
              )}
            </span>
          </Link>
        )}

        {/* Summary */}
        {article.summary && (
          <p className="text-[var(--text-body)] mb-4 line-clamp-5 text-body-md">
            {article.summary}
          </p>
        )}

        {/* Topics */}
        {article.topics && article.topics.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-3 mb-4">
            {article.topics.split(',').slice(0, 3).map((topic) => (
              <li
                key={topic}
                className="px-2 py-0.5 rounded-full text-body-sm bg-[var(--surface)] text-[var(--text)] leading-none"
              >
                {topic.trim()}
              </li>
            ))}
            {article.topics.split(',').length > 3 && (
              <li className="px-2 py-0.5 rounded-full text-body-sm bg-[var(--surface)] text-[var(--text)] leading-none">
                +{article.topics.split(',').length - 3}
              </li>
            )}
          </ul>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] mt-auto">
          <Link
            href={`/article/${article.id}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--text)] text-[var(--surface-elevated)] rounded-lg hover:bg-[var(--accent)] transition-colors duration-200 text-body-md font-medium"
          >
            Read summary
          </Link>

          <ToggleSave articleId={article.id} initialSaved={initialSaved ?? false} />
        </div>
      </div>
    </div>
  );
}
