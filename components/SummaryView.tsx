import { Fragment } from 'react';
import { parseInline, parseSummary } from '@/lib/summary';

/** Inline **bold** / *italic* as React elements (never raw HTML). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => (
        <Fragment key={i}>
          {t.bold ? (
            <strong className="font-semibold text-[var(--text)]">{t.text}</strong>
          ) : t.italic ? (
            <em>{t.text}</em>
          ) : (
            t.text
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Renders a stored summary (see lib/summary.ts for the format): a serif lead,
 * short paragraphs, small-caps sub-headings and bulleted key points.
 */
export default function SummaryView({ summary }: { summary: string | null | undefined }) {
  const blocks = parseSummary(summary);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'lead':
            return (
              <p
                key={i}
                className="font-serif text-headline-lg font-semibold text-[var(--text)] border-l-4 border-[var(--accent-3)] pl-4"
              >
                <Inline text={block.text} />
              </p>
            );
          case 'heading':
            return (
              <h3
                key={i}
                className="pt-2 text-body-sm font-semibold uppercase tracking-wide text-[var(--accent)]"
              >
                {block.text}
              </h3>
            );
          case 'list':
            return (
              <ul key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-body-lg text-[var(--text-body)]">
                    <span aria-hidden="true" className="mt-[0.6rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent-3)]" />
                    <span>
                      <Inline text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={i} className="text-body-lg text-[var(--text-body)]">
                <Inline text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
