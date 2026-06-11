'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';

export default function ToggleSave({
  articleId,
  initialSaved,
  variant = 'icon',
}: {
  articleId: string;
  initialSaved: boolean;
  variant?: 'icon' | 'icon-label';
}) {
  const [saved, setSaved] = useState(initialSaved);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSaved(wasSaved);
        return;
      }
      if (data.saved !== undefined) setSaved(data.saved);
    } catch {
      setSaved(wasSaved);
    }
  }

  if (variant === 'icon-label') {
    return (
      <button
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
          saved
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
        }`}
      >
        <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer ${
        saved
          ? 'text-yellow-500 hover:text-yellow-600'
          : 'text-stone-300 hover:text-stone-500'
      }`}
    >
      <Bookmark className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
