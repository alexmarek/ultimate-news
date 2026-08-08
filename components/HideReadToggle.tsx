'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function HideReadToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const hideRead = searchParams.get('hideRead') === '1';

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (hideRead) {
      params.delete('hideRead');
    } else {
      params.set('hideRead', '1');
    }
    params.delete('page');
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : '/', { scroll: false });
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer ${
        isPending ? 'opacity-50' : ''
      } ${
        hideRead
          ? 'text-[var(--accent)] bg-[var(--surface)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
      }`}
      aria-label={hideRead ? 'Show read articles' : 'Hide read articles'}
      title={hideRead ? 'Show read articles' : 'Hide read articles'}
    >
      {hideRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
