import { Suspense } from 'react';

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>{children}</Suspense>;
}
