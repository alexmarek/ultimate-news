'use client';

import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { useFormStatus } from 'react-dom';

export function FactCheckActionButton({ label, pendingLabel, mode, secondary = false }: {
  label: string;
  pendingLabel: string;
  mode?: 'check' | 'refresh';
  secondary?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const working = pending && (!mode || (data?.get('mode') ?? 'check') === mode);
  const tone = secondary
    ? 'border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--text)]'
    : 'bg-[var(--accent)] text-[var(--bg)]';

  return <>
    <button type="submit" name={mode && 'mode'} value={mode} disabled={pending}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:cursor-wait ${working ? 'cat-fill' : tone} ${pending && !working ? 'opacity-60' : ''}`}>
      {working && <LoaderCircle size={17} aria-hidden="true" className="motion-safe:animate-spin" />}
      {working ? pendingLabel : label}
    </button>
    <span role="status" className="sr-only">{working ? pendingLabel : ''}</span>
  </>;
}

export function FactCheckRefreshButton() {
  const router = useRouter();
  const [pending, startManualRefresh] = useTransition();
  const [polling, startAutoRefresh] = useTransition();

  useEffect(() => {
    if (pending || polling) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        startAutoRefresh(() => router.refresh());
      }
    };

    const timer = window.setInterval(refreshIfVisible, 4_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, [pending, polling, router]);

  return <>
    <p className="mt-2 text-body-sm text-[var(--text-muted)]">This page updates automatically.</p>
    <button type="button" disabled={pending || polling} onClick={() => startManualRefresh(() => router.refresh())}
      className="mt-1 inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-body-sm font-medium text-[var(--accent)] underline underline-offset-4 disabled:cursor-wait">
      <RefreshCw size={15} aria-hidden="true" className={pending ? 'motion-safe:animate-spin' : undefined} />
      {pending ? 'Checking status…' : 'Refresh status'}
    </button>
    <span role="status" className="sr-only">{pending ? 'Checking status…' : ''}</span>
  </>;
}
