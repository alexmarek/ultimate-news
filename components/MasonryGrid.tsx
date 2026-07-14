'use client';

import { useState, useEffect, ReactNode } from 'react';

export default function MasonryGrid({ children }: { children: ReactNode[] }) {
  const [columnCount, setColumnCount] = useState(4);

  useEffect(() => {
    const update = () => setColumnCount(window.innerWidth >= 1024 ? 4 : 1);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const columns: ReactNode[][] = Array.from({ length: columnCount }, () => []);
  (children as ReactNode[]).forEach((child, i) => {
    columns[i % columnCount].push(child);
  });

  return (
    <div className="flex gap-5">
      {columns.map((col, i) => (
        <div key={i} className="flex-1 flex flex-col gap-5 min-w-0">
          {col}
        </div>
      ))}
    </div>
  );
}
