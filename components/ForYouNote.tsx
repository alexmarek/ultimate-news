import { Sparkles } from 'lucide-react';

/** The personal "why it matters to you" line, labelled as an AI inference. */
export default function ForYouNote({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <p className={`flex gap-2 ${compact ? 'text-body-sm' : 'text-body-md'} text-[var(--text-body)]`}>
      <Sparkles aria-hidden="true" className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--accent-3)]" />
      <span>
        <span className="font-semibold text-[var(--text)]">For you</span>{' '}
        <span className="text-[var(--text-faint)]">(AI inference)</span>: {text}
      </span>
    </p>
  );
}
