'use client';

import { useState } from 'react';

function sourceColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#94a3b8', '#a8a29e', '#78716c', '#8D165F', '#2B7878', '#92400e', '#1e40af', '#166534'];
  return colors[Math.abs(hash) % colors.length];
}

function fallbackSvg(name: string): string {
  const color = sourceColor(name);
  const initial = name.charAt(0).toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect fill="#f5f5f4" width="800" height="450"/><circle cx="400" cy="200" r="60" fill="${color}" opacity="0.15"/><text x="400" y="215" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="48" font-weight="600" fill="${color}">${initial}</text><text x="400" y="280" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="16" fill="#a8a29e">${name}</text></svg>`
  )}`;
}

export default function ArticleImage({
  src,
  alt,
  sourceName,
  aspectRatio = '16/9',
  className = '',
}: {
  src: string;
  alt: string;
  sourceName: string;
  aspectRatio?: '16/9' | '3/2';
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`relative w-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <img
          src={fallbackSvg(sourceName)}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full bg-stone-200 dark:bg-stone-800 overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setErrored(true)}
      />
    </div>
  );
}
