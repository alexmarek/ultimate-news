'use client';

import type { Article, Source, Cluster } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Newspaper, Users, Shield } from 'lucide-react';

interface NewsCardProps {
  article: Article & { source: Source };
  cluster: Cluster | null;
}

export default function NewsCard({ article, cluster }: NewsCardProps) {
  const timeAgo = formatDistanceToNow(article.publishedAt, { addSuffix: true });
  const corroborationScore = cluster ? Math.round(cluster.corroborationScore * 100) : 30;

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-gray-200 cursor-pointer flex flex-col">
      {/* Image */}
      {article.imageUrl && (
        <div className="relative h-48 w-full overflow-hidden cursor-pointer">
          <img
            src={`/api/img?url=${encodeURIComponent(article.imageUrl)}`}
            alt={article.imageAlt || article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-800">
              {article.primaryArea}
            </span>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* Source and time */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Newspaper className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 truncate">
              {article.source.name}
            </span>
          </div>
          <span className="text-sm text-gray-500 flex-shrink-0 ml-2">{timeAgo}</span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2">
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p className="text-gray-600 mb-4 line-clamp-5 text-sm">
            {article.summary}
          </p>
        )}

        {/* Cluster stats */}
        {cluster && (
          <div className="space-y-3 mb-5 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  {cluster.totalSourceCount} source{cluster.totalSourceCount !== 1 ? 's' : ''}
                </span>
              </div>

              {cluster.hasIndependentVoice && (
                <div className="flex items-center gap-1">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 font-medium">Independent</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-300"
                    style={{ width: `${corroborationScore}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                {corroborationScore}%
              </span>
            </div>
          </div>
        )}

        {/* Topics */}
        {article.topics && article.topics.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-2">
            {article.topics.split(',').slice(0, 3).map((topic) => (
              <li
                key={topic}
                className="px-2 py-0.5 rounded-full text-xs bg-[#D3BDB0]/30 dark:bg-[#D3BDB0]/15 text-stone-800 dark:text-stone-200 leading-none"
              >
                {topic.trim()}
              </li>
            ))}
            {article.topics.split(',').length > 3 && (
              <li className="px-2 py-0.5 rounded-full text-xs bg-[#D3BDB0]/30 dark:bg-[#D3BDB0]/15 text-stone-800 dark:text-stone-200 leading-none">
                +{article.topics.split(',').length - 3}
              </li>
            )}
          </ul>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100 mt-auto">
          <a
            href={article.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm font-medium cursor-pointer"
          >
            Read full story
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="text-xs text-gray-500 text-center sm:text-right">
            {article.lang.toUpperCase()} • {article.source.editorialIndependence}
          </div>
        </div>
      </div>
    </div>
  );
}