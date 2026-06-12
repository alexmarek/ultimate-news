'use client';

import { useState } from 'react';

const fallbackColors = ['#3D8268', '#A8501C', '#C4923A', '#3A6B8C', '#6B9BBE', '#5FA371', '#D17A3F', '#1F4E3D'];

function sourceColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

function fallbackSvg(name: string): string {
  const color = sourceColor(name);
  const initial = name.charAt(0).toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect fill="#F2F1EC" width="800" height="450"/><circle cx="400" cy="200" r="60" fill="${color}" opacity="0.15"/><text x="400" y="215" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="48" font-weight="600" fill="${color}">${initial}</text><text x="400" y="280" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="16" fill="#9A9D8E">${name}</text></svg>`
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
        className={`relative w-full flex items-center justify-center overflow-hidden ${className}`}
        style={{ aspectRatio, backgroundColor: 'var(--surface)' }}
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
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio, backgroundColor: 'var(--border)' }}
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
