'use client';

import { formatDistanceToNow } from 'date-fns';

export default function TimeAgo({ date }: { date: Date | string }) {
  return <span className="text-body-md text-[var(--text-muted)] flex-shrink-0">
    {formatDistanceToNow(date, { addSuffix: true })}
  </span>;
}
