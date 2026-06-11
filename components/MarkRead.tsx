'use client';

import { useEffect, useRef } from 'react';

export default function MarkRead({ articleId }: { articleId: string }) {
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    const timer = setTimeout(() => {
      marked.current = true;
      fetch('/api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
    }, 3_000);
    return () => clearTimeout(timer);
  }, [articleId]);

  return null;
}
