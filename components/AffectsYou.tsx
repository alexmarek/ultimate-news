'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

type Story = { id: string; title: string; forYou: string | null; sourceName: string };

export default function AffectsYou({ stories, total, hideRead }: { stories: Story[]; total: number; hideRead: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!total) return null;
  return <section className="mb-7 border-t-[3px] border-[var(--ink)]" aria-label="Stories that affect you">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left">
      <span className="text-label font-bold uppercase tracking-[1.2px] text-[var(--accent)]">Affects you</span>
      <span className="text-meta text-[var(--meta)]">{total} {total === 1 ? 'story' : 'stories'}</span>
      <ChevronDown aria-hidden="true" className={`ml-auto h-5 w-5 ${open ? 'rotate-180' : ''}`} />
    </button>
    <div id={id} hidden={!open}>
      {stories.map((story) => <article key={story.id} className="border-t border-[var(--rule)] py-3"><h3 className="font-serif text-row font-semibold"><Link href={`/article/${story.id}`} className="hover:text-[var(--accent)]">{story.title}</Link></h3><p className="mt-1 text-meta text-[var(--meta)]">{story.sourceName}</p>{story.forYou && <p className="mt-2 text-ui"><span className="mr-1 border border-[var(--ink)] px-1 text-[10px] font-bold">AI</span><strong>Why it matters to you.</strong> {story.forYou}</p>}</article>)}
      <Link href={hideRead ? '/?forYou=1&hideRead=1' : '/?forYou=1'} className="inline-flex min-h-11 items-center text-ui font-semibold underline">All stories that affect you</Link>
    </div>
  </section>;
}
