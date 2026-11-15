import { Archive, CircleAlert, CircleCheck, Clock3, Globe, LoaderCircle } from 'lucide-react';
import { jobFailureMessage } from '@/lib/fact-check/2026-11-13-failure';

const activeStages = {
  queued: { label: 'Queued', detail: 'Waiting for the check to start.' },
  extracting: { label: 'Reading article', detail: 'Retrieving the article text.' },
  'identifying-claims': { label: 'Identifying claims', detail: 'Finding the main claims to check.' },
  researching: { label: 'Researching', detail: 'Looking for independent sources.' },
  evaluating: { label: 'Evaluating evidence', detail: 'Comparing the claims with the sources.' },
};

const completedStages = {
  'ready-for-review': { label: 'Ready for review', icon: CircleCheck },
  published: { label: 'Published', icon: Globe },
  superseded: { label: 'Superseded', icon: Archive },
  failed: { label: 'Check failed', icon: CircleAlert },
};

export function FactCheckStatus({ status, errorCategory, showDetail = false, startPending = false }: {
  status: string;
  errorCategory?: string | null;
  showDetail?: boolean;
  startPending?: boolean;
}) {
  const active = activeStages[status as keyof typeof activeStages];
  const completed = completedStages[status as keyof typeof completedStages];
  const Icon = status === 'queued' ? Clock3 : active ? LoaderCircle : completed?.icon ?? Clock3;
  const failure = status === 'failed' ? jobFailureMessage(errorCategory) : null;
  const label = startPending ? 'Start pending' : failure?.title ?? active?.label ?? completed?.label ?? status;
  const detail = startPending ? 'If the check stays here, submit the same URL again to retry starting it.'
    : failure?.next ?? active?.detail;
  const tone = status === 'failed'
    ? 'text-[var(--error)]'
    : status === 'published' || status === 'ready-for-review' ? 'text-[var(--success)]' : 'text-[var(--text)]';

  return <div role={showDetail ? 'status' : undefined}>
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-body-sm font-semibold ${active ? 'cat-fill' : `bg-[var(--panel)] ${tone}`}`}>
      <Icon size={16} aria-hidden="true" className={active && status !== 'queued' ? 'motion-safe:animate-spin' : undefined} />
      {label}
    </span>
    {showDetail && detail && <p className="mt-2 text-body-sm text-[var(--text-muted)]">{detail}</p>}
  </div>;
}
