'use client';

import { ReactNode, ReactElement } from 'react';

export default function MasonryGrid({ children }: { children: ReactNode[] }) {
  return (
    <div className="columns-1 lg:columns-4 gap-5">
      {(children as ReactElement[]).map((child, i) => (
        <div key={child?.key ?? i} className="break-inside-avoid mb-5 animate-fade-in">
          {child}
        </div>
      ))}
    </div>
  );
}
