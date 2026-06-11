'use client';

import { formatDistanceToNow } from 'date-fns';

export default function TimeAgo({ date }: { date: Date | string }) {
  return <span className="text-sm text-gray-500 flex-shrink-0">
    {formatDistanceToNow(date, { addSuffix: true })}
  </span>;
}
