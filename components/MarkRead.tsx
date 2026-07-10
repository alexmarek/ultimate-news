'use client';

import { useEffect, useRef } from 'react';

const COOKIE_NAME = 'read_articles';

function getReadIds(): string[] {
  if (typeof document === 'undefined') return [];
  const match = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match[2]));
  } catch {
    return [];
  }
}

function addReadId(articleId: string) {
  const ids = getReadIds();
  if (ids.includes(articleId)) return;
  ids.push(articleId);
  // Keep max 200 IDs to stay under 4KB cookie limit
  const trimmed = ids.slice(-200);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(trimmed))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export default function MarkRead({ articleId }: { articleId: string }) {
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    const timer = setTimeout(() => {
      marked.current = true;
      addReadId(articleId);
    }, 3_000);
    return () => clearTimeout(timer);
  }, [articleId]);

  return null;
}