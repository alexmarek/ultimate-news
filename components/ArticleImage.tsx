'use client';

import { useState } from 'react';
import { PALETTE_HEX, categoryHex, categoryStyle } from '@/lib/categoryColor';

const INK = '#1A1C18';
const INK_MUTED = '#5C5F4E';

function fallbackSvg(name: string, area?: string | null): string {
  const initial = name.charAt(0).toUpperCase();
  // The category colour is the backdrop; `cornsilk` is only used when there is no category at all.
  const backdrop = area ? categoryHex(area) : PALETTE_HEX.cornsilk;
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect fill="${backdrop}" width="800" height="450"/><circle cx="400" cy="200" r="60" fill="${INK}" opacity="0.12"/><text x="400" y="215" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="48" font-weight="600" fill="${INK}">${initial}</text><text x="400" y="280" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="16" fill="${INK_MUTED}">${name}</text></svg>`
  )}`;
}

export default function ArticleImage({
  src,
  alt,
  sourceName,
  area,
  aspectRatio = '16/9',
  className = '',
}: {
  src: string;
  alt: string;
  sourceName: string;
  /** Article.primaryArea: the placeholder / loading background takes this category's colour. */
  area?: string | null;
  aspectRatio?: '16/9' | '3/2';
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const tintClass = area ? 'cat-tint' : 'bg-[var(--border)]';

  if (errored) {
    return (
      <div
        className={`relative w-full flex items-center justify-center overflow-hidden ${tintClass} ${className}`}
        style={{ aspectRatio, ...categoryStyle(area) }}
      >
        <img
          src={fallbackSvg(sourceName, area)}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden ${tintClass} ${className}`}
      style={{ aspectRatio, ...categoryStyle(area) }}
    >
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
      />
    </div>
  );
}
