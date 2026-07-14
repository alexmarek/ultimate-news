'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardNav(articleIds: string[]) {
  const router = useRouter();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const prevRef = useRef<string | null>(null);

  const reset = useCallback(() => setFocusedId(null), []);

  const navigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (articleIds.length === 0) return;
      setFocusedId((prev) => {
        const idx = prev ? articleIds.indexOf(prev) : -1;
        if (direction === 'next') {
          if (idx >= articleIds.length - 1 || idx < 0) return articleIds[0];
          return articleIds[idx + 1];
        }
        if (idx <= 0) return articleIds[articleIds.length - 1];
        return articleIds[idx - 1];
      });
    },
    [articleIds],
  );

  const openFocused = useCallback(() => {
    if (focusedId) router.push(`/article/${focusedId}`);
  }, [focusedId, router]);

  const markReadFocused = useCallback(() => {
    if (focusedId) {
      const COOKIE_NAME = 'read_articles';
      const match = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
      let ids: string[] = [];
      if (match) {
        try { ids = JSON.parse(decodeURIComponent(match[2])); } catch {}
      }
      if (!ids.includes(focusedId)) {
        ids.push(focusedId);
        const trimmed = ids.slice(-200);
        document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(trimmed))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      }
    }
  }, [focusedId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'j':
          e.preventDefault();
          navigate('next');
          break;
        case 'k':
          e.preventDefault();
          navigate('prev');
          break;
        case 'o':
          e.preventDefault();
          openFocused();
          break;
        case 'm':
          e.preventDefault();
          markReadFocused();
          break;
        case '/':
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>('input[type="search"]');
          input?.focus();
          break;
        case 'Escape':
          reset();
          break;
        case '?':
          if (!e.shiftKey) {
            e.preventDefault();
            setShowHelp((prev) => !prev);
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, openFocused, markReadFocused, reset]);

  // Visual focus ring on the focused card
  useEffect(() => {
    if (prevRef.current) {
      const prev = document.querySelector(`[data-kb-id="${prevRef.current}"]`);
      prev?.classList.remove('kb-focused');
    }
    if (focusedId) {
      const el = document.querySelector(`[data-kb-id="${focusedId}"]`);
      el?.classList.add('kb-focused');
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    prevRef.current = focusedId;
  }, [focusedId]);

  return { focusedId, showHelp, setShowHelp, reset };
}
