import React, { Fragment } from 'react';
import { parseInline, parseSummary } from '@/lib/summary';

function Inline({ text }: { text: string }) {
  return <>{parseInline(text).map((token, index) => <Fragment key={index}>{token.bold ? <strong>{token.text}</strong> : token.italic ? <em>{token.text}</em> : token.text}</Fragment>)}</>;
}

/** Render the article summary as prose; the opening paragraph may already be used as the deck. */
export default function SummaryView({ summary, omitOpening = false }: { summary: string | null | undefined; omitOpening?: boolean }) {
  const blocks = parseSummary(summary);
  let openingOmitted = false;
  let skipKeyPointsList = false;
  const content = blocks.map((block, index) => {
    if (block.type === 'heading' && /^key points?\s*:?$/i.test(block.text.trim())) { skipKeyPointsList = true; return null; }
    if (skipKeyPointsList) { skipKeyPointsList = false; if (block.type === 'list') return null; }
    if (block.type === 'heading') return <h2 key={index} className="pt-2 font-serif text-headline font-semibold text-[var(--ink)]">{block.text}</h2>;
    if (block.type === 'list') return <ul key={index} className="list-disc space-y-2 pl-6">{block.items.map((item, i) => <li key={i}><Inline text={item} /></li>)}</ul>;
    if (omitOpening && !openingOmitted) { openingOmitted = true; return null; }
    return <p key={index}><Inline text={block.text} /></p>;
  });
  return <div className="space-y-5 font-serif text-[19px] leading-[28px] text-[var(--article)] md:text-article md:leading-[31px]">{content}</div>;
}
