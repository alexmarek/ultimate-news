/** The personal relevance line, visibly identified as AI-generated. */
export default function ForYouNote({ text, compact = false }: { text: string; compact?: boolean }) {
  return <p className={`${compact ? 'text-meta' : 'text-ui'} text-[var(--body)]`}><span className="mr-1 border border-[var(--ink)] px-1 text-[10px] font-bold leading-none">AI</span><strong>Why it matters to you.</strong> {text}</p>;
}
