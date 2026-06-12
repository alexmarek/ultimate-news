import { Suspense } from 'react';

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text-faint)]">Loading...</div>}>{children}</Suspense>;
}
